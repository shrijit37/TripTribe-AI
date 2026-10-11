import type { Metadata } from "next";
import SiteChrome from "@/components/SiteChrome";
import Hero from "@/screens/Hero";

/**
 * `/` — the landing page.
 *
 * `Hero` carries its own client behaviour (the live map, the form slip), but
 * the route itself renders on the server so the headline and the body copy are
 * in the HTML a crawler receives. That is the difference between a page that
 * can be indexed and one that cannot.
 *
 * The metadata here replaces what `react-helmet` used to set from inside the
 * component.
 */
export const metadata: Metadata = {
  title: "TripTribe — A trip is a route, not a list",
  description:
    "Give TripTribe a city, a budget and a number of days. It returns a full itinerary sequenced so each stop leads to the next, with meals and hotel prices built around the figure you set.",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    title: "TripTribe — A trip is a route, not a list",
    description: "AI-generated personalized travel itineraries.",
    url: "/",
  },
};

export default function HomePage() {
  return (
    <SiteChrome>
      <Hero />
    </SiteChrome>
  );
}