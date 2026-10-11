import type { ReactNode } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

/**
 * The chrome every route shares.
 *
 * Navbar above, footer below, the routed page between — the same arrangement
 * the SPA had, in the same order, so no page's spacing changes. This is a
 * server component: only the Navbar crosses into the client, because it reads
 * the session and holds the account drawer.
 */
export default function SiteChrome({ children }: { children: ReactNode }) {
  return (
    <>
      <Navbar />
      {children}
      <Footer />
    </>
  );
}