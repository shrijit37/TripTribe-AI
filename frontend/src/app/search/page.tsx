import type { Metadata } from "next";
import SiteChrome from "@/components/SiteChrome";
import Search from "@/screens/Search";

/**
 * `/search` — the planner stepper.
 *
 * `noindex` on purpose: this is a form that produces a private result. There is
 * nothing here for an index, and a crawler filling in a form generates nothing
 * but noise in the logs.
 */
export const metadata: Metadata = {
  title: "Plan a trip",
  description:
    "Give TripTribe a city, a budget and the number of days you have. It returns a day-by-day route with meals and hotels placed around your budget.",
  alternates: { canonical: "/search" },
  robots: { index: false, follow: true },
};

export default function SearchPage() {
  return (
    <SiteChrome>
      <Search />
    </SiteChrome>
  );
}