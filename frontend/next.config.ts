import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The API base is resolved at request time from the environment, not baked
  // into the bundle, so one image works for local docker compose and for the
  // internal swarm DNS name production uses.
  output: "standalone",
  // The repo holds two lockfiles (root and frontend). Without an explicit root
  // Next infers the workspace root from them and scans from the repo root
  // instead of this package — which silently broke dynamic route detection.
  outputFileTracingRoot: import.meta.dirname,
  turbopack: { root: import.meta.dirname },
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${process.env.BACKEND_URL ?? "http://localhost:8080"}/api/:path*` },
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