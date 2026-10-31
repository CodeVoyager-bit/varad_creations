import type { Metadata, Viewport } from "next";
import { Inter, Lora, Plus_Jakarta_Sans } from "next/font/google";
import { getSettings } from "@/server/storefront";
import { SwRegister } from "@/components/sw-register";
import { isIndexable, siteUrl } from "@/lib/site";
import "./globals.css";

const body = Inter({ variable: "--font-body", subsets: ["latin"], display: "swap" });
const heading = Plus_Jakarta_Sans({ variable: "--font-heading", subsets: ["latin"], weight: ["600", "700", "800"], display: "swap" });
// serif only for the "Varad Creation" wordmark
const brand = Lora({ variable: "--font-brand-serif", subsets: ["latin"], weight: ["600", "700"], display: "swap" });

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings();
  return {
    metadataBase: new URL(siteUrl),
    title: { default: s.seo.title, template: `%s | ${s.businessName}` },
    description: s.seo.description,
    applicationName: s.businessName,
    openGraph: { type: "website", siteName: s.businessName, locale: "en_IN", title: s.seo.title, description: s.seo.description },
    twitter: { card: "summary_large_image" },
    appleWebApp: { capable: true, title: s.businessName, statusBarStyle: "default" },
    formatDetection: { telephone: false },
    robots: isIndexable ? undefined : { index: false, follow: false },
  };
}

export const viewport: Viewport = {
  themeColor: "#ffffff", // matches the header surface
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN" className={`${body.variable} ${heading.variable} ${brand.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        {children}
        <SwRegister />
      </body>
    </html>
  );
}
