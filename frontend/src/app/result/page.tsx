import type { Metadata } from "next";
import SiteChrome from "@/components/SiteChrome";
import Result from "@/screens/Result";

/**
 * `/result` — the generated itinerary.
 *
 * `noindex`, and it cannot be otherwise: the page is the rendering of a payload
 * the visitor's own POST produced, carried across in `sessionStorage`. A
 * crawler arriving here directly has nothing to render but the empty state, so
 * indexing it would index an empty page. It is also excluded in `robots.ts`.
 */
export const metadata: Metadata = {
  title: "Your itinerary",
  description: "Your day-by-day route, sequenced so each stop leads to the next.",
  robots: { index: false, follow: false },
};

export default function ResultPage() {
  return (
    <SiteChrome>
      <Result />
    </SiteChrome>
  );
}