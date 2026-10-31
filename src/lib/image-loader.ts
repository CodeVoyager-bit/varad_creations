"use client";

/**
 * next/image loader: Cloudinary resizes and picks the format (WebP/AVIF), so product photos
 * don't use the hosting platform's image-optimisation quota. Other sources (local dev uploads)
 * are served as they are.
 */
export default function imageLoader({ src, width, quality }: { src: string; width: number; quality?: number }) {
  const m = src.match(/^(https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)(.+)$/);
  if (m) return `${m[1]}f_auto,q_${quality ?? "auto"},c_limit,w_${width}/${m[2]}`;
  return `${src}${src.includes("?") ? "&" : "?"}w=${width}`;
}
