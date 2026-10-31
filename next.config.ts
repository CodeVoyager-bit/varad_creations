import type { NextConfig } from "next";

const isProdDeploy = process.env.VERCEL_ENV ? process.env.VERCEL_ENV === "production" : true;
const privateNoStore = [
  { key: "Cache-Control", value: "private, no-store, max-age=0" },
  { key: "X-Robots-Tag", value: "noindex, nofollow" },
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  serverExternalPackages: ["mongodb"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  experimental: {
    // payment screenshots and product images are posted through server actions
    serverActions: { bodySizeLimit: "6mb" },
    // private pages deliberately block on the session, and product/category pages resolve
    // params up front so unknown slugs get a real 404; validate only segments that opt in
    instantInsights: { validationLevel: "manual-warning" },
  },
  images: {
    loader: "custom",
    loaderFile: "./src/lib/image-loader.ts",
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Permissions-Policy", value: "geolocation=(self), camera=(), microphone=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
          // preview deployments must never be indexed
          ...(isProdDeploy ? [] : [{ key: "X-Robots-Tag", value: "noindex, nofollow" }]),
        ],
      },
      ...["/admin/:path*", "/delivery/:path*", "/account/:path*", "/orders/:path*", "/checkout", "/cart", "/api/:path*"].map(
        (source) => ({ source, headers: privateNoStore }),
      ),
    ];
  },
};

export default nextConfig;
