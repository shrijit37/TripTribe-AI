import { lookup } from "node:dns/promises";
import { NextResponse } from "next/server";
import { fail } from "@/server/http/errors";
import { checkLimit, IMAGE_LIMIT } from "@/server/http/rateLimit";

/**
 * GET /api/image?url= — fetch a remote image server-side, for hotlink-proof hosts.
 * Replaces `GET /api/itenary/proxy-image`, which fetched *any* URL with no
 * checks — an open SSRF proxy. This one allows https only, a fixed host
 * allowlist, and rejects resolved private-range IPs (DNS-rebinding guard).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const ALLOWED_HOSTS: readonly string[] = [
  "lh3.googleusercontent.com",
  "images.googleapis.com",
  "gstatic.com",
  "picsum.photos",
];

const isAllowedHost = (hostname: string): boolean =>
  ALLOWED_HOSTS.some(
    (allowed) => hostname === allowed || hostname.endsWith(`.${allowed}`),
  );

const isPrivateIp = (address: string): boolean => {
  // IPv4 private/link-local/loopback.
  if (/^\d+\.\d+\.\d+\.\d+$/.test(address)) {
    const [a, b] = address.split(".").map(Number);
    return (
      a === 10 ||
      a === 127 ||
      (a === 169 && b === 254) ||
      (a === 172 && (b as number) >= 16 && (b as number) <= 31) ||
      (a === 192 && b === 168) ||
      (a as number) >= 224
    );
  }
  // IPv6 loopback/link-local/unique-local.
  const lower = address.toLowerCase();
  return (
    lower === "::1" ||
    lower.startsWith("fe80:") ||
    lower.startsWith("fc") ||
    lower.startsWith("fd")
  );
};

export async function GET(request: Request) {
  const limit = await checkLimit("proxy", IMAGE_LIMIT);
  if (!limit.allowed) {
    return fail("RATE_LIMITED", "Too many image requests — try again later");
  }

  const raw = new URL(request.url).searchParams.get("url");
  if (!raw) return fail("BAD_INPUT", "Missing url parameter");

  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return fail("BAD_INPUT", "That image address is not allowed");
  }
  if (target.protocol !== "https:") {
    return fail("BAD_INPUT", "That image address is not allowed");
  }
  if (!isAllowedHost(target.hostname)) {
    return fail("BAD_INPUT", "That image address is not allowed");
  }
  try {
    const records = await lookup(target.hostname, { all: true });
    if (records.some((record) => isPrivateIp(record.address))) {
      return fail("BAD_INPUT", "That image address is not allowed");
    }
  } catch {
    return fail("BAD_INPUT", "That image address is not allowed");
  }

  try {
    const imageRes = await fetch(target.toString(), {
      signal: AbortSignal.timeout(15_000),
    });
    if (!imageRes.ok) {
      return fail("UPSTREAM_UNAVAILABLE", "Could not fetch that image");
    }
    const contentType = imageRes.headers.get("content-type") ?? "";
    if (!contentType.startsWith("image/")) {
      return fail("BAD_INPUT", "That address is not an image");
    }
    const buffer = Buffer.from(await imageRes.arrayBuffer());
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, s-maxage=86400",
      },
    });
  } catch {
    return fail("UPSTREAM_UNAVAILABLE", "Could not fetch that image");
  }
}
