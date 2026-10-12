import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    /**
     * `msw/browser` declares `"node": null` in its exports map, so neither Node
     * nor Turbopack resolves it when bundling for the server. Pointing the
     * specifier straight at the browser entry lets the module be bundled; it
     * only ever runs inside a browser effect.
     */
    resolveAlias: {
      "msw/browser": "./node_modules/msw/lib/browser/index.js",
    },
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;