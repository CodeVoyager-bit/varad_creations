import type { MetadataRoute } from "next";
import { isIndexable, siteUrl } from "@/lib/site";

/** Robots rules keep crawlers tidy; they are not access control (every private route checks the session). */
export default function robots(): MetadataRoute.Robots {
  if (!isIndexable) return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/delivery", "/account", "/orders", "/cart", "/checkout", "/login", "/register", "/forgot-password", "/search", "/api/"],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
