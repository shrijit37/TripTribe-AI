import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "@/index.css";
import "@/mx-plan.css";
import "@/mx-chrome.css";
import "@/mx-result.css";
import "@/mx-auth.css";
import AppProviders from "@/components/AppProviders";

/**
 * The document shell.
 *
 * `metadataBase` is what makes every relative URL in this app's metadata —
 * the canonical, the Open Graph image, the sitemap — resolve to an absolute
 * one. Without it Next emits a warning and browsers cannot resolve them,
 * which matters because canonical URLs are how a search engine decides which
 * of two copies of a city page is the real one.
 */
export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://triptribe.shrijit.tech"),
  title: {
    default: "TripTribe — A trip is a route, not a list",
    template: "%s · TripTribe",
  },
  description:
    "Give TripTribe a city, a budget and a number of days. It returns a full itinerary sequenced so each stop leads to the next, with meals and hotel prices built around the figure you set.",
  applicationName: "TripTribe",
  openGraph: {
    type: "website",
    siteName: "TripTribe",
    title: "TripTribe — A trip is a route, not a list",
    description:
      "Give TripTribe a city, a budget and a number of days. It returns a full itinerary sequenced so each stop leads to the next, with meals and hotel prices built around the figure you set.",
  },
  twitter: {
    card: "summary_large_image",
    title: "TripTribe — A trip is a route, not a list",
    description:
      "Give TripTribe a city, a budget and a number of days. It returns a full itinerary sequenced so each stop leads to the next, with meals and hotel prices built around the figure you set.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
  alternates: { canonical: "/" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0f1215",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Google tag (gtag.js) — kept from the Vite shell, same measurement
            id, loaded the same way. */}
        <script async src="https://www.googletagmanager.com/gtag/js?id=G-5WSN5W64PG" />
        <script
          dangerouslySetInnerHTML={{
            __html: `window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', 'G-5WSN5W64PG');`,
          }}
        />
      </head>
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}