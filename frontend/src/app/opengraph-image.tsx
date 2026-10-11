import { ImageResponse } from "next/og";

/**
 * The social card.
 *
 * Without one, every share of this site renders as a bare text link — and the
 * city pages are the pages people would actually share. The card is the same
 * world as the site: uncoated stock, prussian for the route, the measuring face
 * for anything numeric.
 *
 * Rendered by `next/og` at build time. Next injects the `og:image` tag and
 * wires it into every route that does not override `openGraph.images`, so this
 * one file covers the whole site.
 */

export const alt = "TripTribe — a trip is a route, not a list";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpengraphImage() {
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
        {/* The running head. */}
        <div style={{ display: "flex", alignItems: "baseline", gap: 16 }}>
          <div style={{ fontSize: 44, fontWeight: 700, letterSpacing: "-0.02em" }}>
            TripTribe
          </div>
          <div
            style={{
              fontSize: 18,
              letterSpacing: "0.18em",
              color: "#525a61",
            }}
          >
            TT/ROUTE
          </div>
        </div>

        {/* The thesis, stated. */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              fontSize: 92,
              fontWeight: 700,
              lineHeight: 1.02,
              letterSpacing: "-0.035em",
              maxWidth: 900,
            }}
          >
            A trip is a route, not a list.
          </div>
          <div
            style={{
              marginTop: 28,
              fontSize: 30,
              lineHeight: 1.35,
              color: "#3d454c",
              maxWidth: 820,
            }}
          >
            Day by day, the stops are sequenced so one leads into the next — with
            meals and hotels placed around the budget you set.
          </div>
        </div>

        {/* The rule, and the route threading it. */}
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ height: 3, background: "#14181c", width: "100%" }} />
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div
              style={{ width: 14, height: 14, borderRadius: 999, background: "#1d4e8c" }}
            />
            <div style={{ height: 3, width: 380, background: "#1d4e8c" }} />
            <div
              style={{ width: 18, height: 18, borderRadius: 999, background: "#1d4e8c" }}
            />
          </div>
        </div>
      </div>
    ),
    size,
  );
}