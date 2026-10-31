import type { FoodInfo, NonFoodInfo } from "./types";

/** Public, serializable catalog shapes (no internal stock numbers beyond what's shown). */
export interface ShopVariant {
  id: string;
  label: string;
  mrpPaise: number;
  pricePaise: number;
  inStock: boolean;
  /** set only when stock is at or below the low-stock threshold (real numbers, no fake urgency) */
  fewLeft?: number;
  /** unit sale price (Legal Metrology), e.g. "₹34.00 / 100 g" */
  unitPrice?: string;
  /** lowest selling price in the last 30 days, shown next to any discount */
  lowest30Paise?: number;
}

export interface ShopProduct {
  id: string;
  slug: string;
  name: string;
  brand: { name: string; slug: string };
  category: { name: string; slug: string };
  image?: string;
  isDemo: boolean;
  bestseller: boolean;
  featured: boolean;
  tags: string[];
  variants: ShopVariant[];
}

export interface ShopProductDetail extends ShopProduct {
  kind: "food" | "nonfood";
  description: string;
  images: string[];
  labelImages: string[];
  status: "active" | "discontinued";
  food?: FoodInfo;
  nonFood?: NonFoodInfo;
  attributes: { label: string; value: string }[];
  seo?: { title?: string; description?: string };
  updatedAt: string;
}

export interface ShopCategory {
  id: string;
  slug: string;
  name: string;
  description?: string;
  image?: string;
  /** a pack shot from one of its products, used when no category/brand image is uploaded */
  packImage?: string;
  productCount?: number;
  seo?: { title?: string; description?: string };
}
export type ShopBrand = ShopCategory & { logo?: string };

export const inStock = (p: ShopProduct) => p.variants.some((v) => v.inStock);
export const fromPrice = (p: ShopProduct) => Math.min(...p.variants.map((v) => v.pricePaise));
