import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Varad Creation",
    short_name: "Varad",
    description: "Indori favourites, delivered across Pune and PCMC.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#fbf5ea",
    theme_color: "#861c30",
    orientation: "portrait",
    categories: ["shopping", "food"],
    icons: [
      { src: "/icons/192", sizes: "192x192", type: "image/png" },
      { src: "/icons/512", sizes: "512x512", type: "image/png" },
      { src: "/icons/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
