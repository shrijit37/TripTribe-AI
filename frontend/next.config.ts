import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The API is this app. There is no second origin to resolve: every `/api/*`
  // route below is a route handler in `src/app/api`, so the rewrite that used
  // to forward them to `${BACKEND_URL}` is gone — and with it the class of bug
  // where CI built the client against one backend name and the container ran
  // with another. One deployable, one origin, nothing to disagree about.
  output: "standalone",
  // The repo holds two lockfiles (root and frontend). Without an explicit root
  // Next infers the workspace root from them and scans from the repo root
  // instead of this package — which silently broke dynamic route detection.
  outputFileTracingRoot: import.meta.dirname,
  turbopack: { root: import.meta.dirname },
  async rewrites() {
    return [
      // The keyword URL is the whole point of the SEO work — the query is
      // "best places to visit in <city>", one hyphenated string. Next only
      // treats a route segment as dynamic when the *entire* segment is
      // bracketed, so the flat form has to be a rewrite onto the real
      // `[city]` route. It is a rewrite rather than a redirect so the
      // canonical URL stays the flat one: no extra hop, and the crawler keeps
      // the URL it asked for.
      { source: "/best-places-to-visit-in-:city", destination: "/best-places-to-visit-in/:city" },
    ];
  },
};

export default nextConfig;