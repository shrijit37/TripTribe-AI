import "server-only";
import { cookies, headers } from "next/headers";
import { authSupabase } from "@/server/db/mongo";
import {
  getOrCreate,
  type SessionIdentity,
} from "@/server/db/repositories/users";
import type { UserDoc } from "@/server/db/documents";

/**
 * Who is calling, resolved once per request.
 *
 * Auth used to be a shared Better Auth hub on auth.shrijit.tech: every authed
 * request fetched a session cookie and then self-joined the TripTribe org, two
 * remote calls plus a user upsert. It is now the fleet Supabase project: the
 * browser holds a Supabase session, mirrors its access token to a cookie (and
 * sends it as a Bearer header), and this module verifies that token with
 * `supabase.auth.getUser()`. A valid Supabase user is the membership test —
 * there is no separate org hub to join, so the two remote calls collapse into
 * one token verification.
 *
 * Nothing here reads the request body's `email`: identity comes only from the
 * verified token, so a caller cannot save a trip under someone else's address.
 */

/** Cookie the browser Supabase client mirrors the access token into. */
const ACCESS_TOKEN_COOKIE = "sb-access-token";

export interface Viewer {
  identity: SessionIdentity;
  user: UserDoc;
}

/** The caller's Supabase access token: Authorization header first, then cookie. */
async function requestToken(): Promise<string | null> {
  const requestHeaders = await headers();
  const authorization = requestHeaders.get("authorization");
  if (authorization?.toLowerCase().startsWith("bearer ")) {
    return authorization.slice(7).trim() || null;
  }
  const jar = await cookies();
  return jar.get(ACCESS_TOKEN_COOKIE)?.value ?? null;
}

const metadataString = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value : null;

/**
 * The signed-in TripTribe identity, or null.
 *
 * Null covers no token, an expired/forged token Supabase refuses, and a user
 * with no email. Verification is fail-closed: an auth outage locks people out
 * rather than letting an unverified caller through.
 */
export const getSession = async (): Promise<SessionIdentity | null> => {
  const token = await requestToken();
  if (!token) return null;

  try {
    const { data, error } = await authSupabase().auth.getUser(token);
    const user = error ? null : data.user;
    if (!user?.email) return null;

    const meta = user.user_metadata as Record<string, unknown> | undefined;
    const name =
      metadataString(meta?.name) ??
      metadataString(meta?.full_name) ??
      user.email.split("@")[0] ??
      user.email;

    return { authId: user.id, email: user.email, name };
  } catch {
    return null;
  }
};

/** The signed-in identity plus its local profile, or null. One DB round trip. */
export const getViewer = async (): Promise<Viewer | null> => {
  const identity = await getSession();
  if (!identity) return null;
  try {
    const user = await getOrCreate(identity);
    return { identity, user };
  } catch {
    return null;
  }
};
