import { ImageResponse } from "next/og";
import { fromSlug } from "@/lib/seo";

/**
 * The social card for one city.
 *
 * A route-level `openGraph` block replaces the site's default card entirely,
 * so the city pages — the pages worth sharing — get their own. The card names
 * the city and states the answer, because a link preview is the one piece of
 * text a person reads before deciding to click.
 *
 * Rendered at build time alongside the page it belongs to, one per city.
 */

export const alt = "Best places to visit";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

interface PageProps {
  params: Promise<{ city?: string }>;
}

export default async function CityOpengraphImage({ params }: PageProps) {
  const slug = (await params).city;
  const city = slug ? fromSlug(slug) : "";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: "#e8e6de",
          color: "#14181c",
          fontFamily: "sans-serif",
        }}
      >
        {/* Running head. */}
        <div style={{ display: "flex", alignItems: "baseline", gap: 16 }}>
          <div style={{ fontSize: 40, fontWeight: 700, letterSpacing: "-0.02em" }}>
            TripTribe
          </div>
          <div style={{ fontSize: 18, letterSpacing: "0.18em", color: "#525a61" }}>
            TT/ROUTE
          </div>
        </div>

        {/* The query, answered. */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              fontSize: 34,
              letterSpacing: "0.14em",
              color: "#1d4e8c",
              textTransform: "uppercase",
            }}
          >
            Best places to visit in
          </div>
          <div
            style={{
              marginTop: 14,
              fontSize: 104,
              fontWeight: 700,
              lineHeight: 1,
              letterSpacing: "-0.035em",
            }}
          >
            {city}
          </div>
          <div
            style={{
              marginTop: 26,
              fontSize: 28,
              lineHeight: 1.35,
              color: "#3d454c",
              maxWidth: 860,
            }}
          >
            Ranked by traveller reviews, with the route between them worked out
            for your days and your budget.
          </div>
        </div>

        {/* Rule, then the route threading it. */}
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ height: 3, background: "#14181c", width: "100%" }} />
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div
              style={{ width: 14, height: 14, borderRadius: 999, background: "#1d4e8c" }}
            />
            <div style={{ height: 3, width: 420, background: "#1d4e8c" }} />
            <div
              style={{ width: 20, height: 20, borderRadius: 999, background: "#1d4e8c" }}
            />
          </div>
        </div>
      </div>
    ),
    size,
  );
}