import type { Metadata } from "next";
import SiteChrome from "@/components/SiteChrome";
import Reset from "@/screens/Reset";

/**
 * `/auth/reset` — request + confirm the password reset.
 * `noindex`: a token page has nothing to offer a search result.
 */
export const metadata: Metadata = {
  title: "Reset your password",
  description: "Request a TripTribe password reset link, or set a new password.",
  robots: { index: false, follow: true },
};

export default async function ResetPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const params = await searchParams;
  void params.error;
  return (
    <SiteChrome>
      <Reset token={params.token} />
    </SiteChrome>
  );
}
