import SiteChrome from "@/components/SiteChrome";
import NotFound from "@/screens/NotFound";

/**
 * The 404.
 *
 * Next.js renders this for any unmatched URL. A crawler that followed a broken
 * link lands here and gets a real page — with a 404 status, which is the
 * honest signal, rather than a 200 that says "fine, ignore it".
 */
export default function NotFoundRoute() {
  return (
    <SiteChrome>
      <NotFound />
    </SiteChrome>
  );
}