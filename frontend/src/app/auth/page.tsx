import type { Metadata } from "next";
import SiteChrome from "@/components/SiteChrome";
import Auth from "@/screens/Auth";

/**
 * `/auth` — sign in and register.
 *
 * `noindex` was set inside the component by `react-helmet` before the
 * migration, and it is kept: an account page has nothing to offer a search
 * result, and the two directives differ in that this one also stops crawlers
 * following out of the page.
 */
export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to TripTribe, or create an account to keep your trips.",
  robots: { index: false, follow: true },
};

export default function AuthPage() {
  return (
    <SiteChrome>
      <Auth />
    </SiteChrome>
  );
}