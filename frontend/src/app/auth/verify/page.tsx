import type { Metadata } from "next";
import SiteChrome from "@/components/SiteChrome";
import Verify from "@/screens/Verify";

/**
 * `/auth/verify` — the verification-link landing.
 * `noindex`: a token page has nothing to offer a search result.
 */
export const metadata: Metadata = {
  title: "Verify your email",
  description: "Confirm your TripTribe address from the verification link.",
  robots: { index: false, follow: true },
};

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const params = await searchParams;
  return (
    <SiteChrome>
      <Verify token={params.token} linkError={params.error} />
    </SiteChrome>
  );
}
