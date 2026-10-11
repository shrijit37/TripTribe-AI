import type { Metadata } from "next";
import SiteChrome from "@/components/SiteChrome";
import Account from "@/screens/Account";

/**
 * `/account` — profile, password, delete.
 * Signed-in only (the screen redirects when there is no session).
 * `noindex`: an account page has nothing to offer a search result.
 */
export const metadata: Metadata = {
  title: "Your account",
  description: "Edit your TripTribe profile, change your password, or delete your account.",
  robots: { index: false, follow: true },
};

export default function AccountPage() {
  return (
    <SiteChrome>
      <Account />
    </SiteChrome>
  );
}
