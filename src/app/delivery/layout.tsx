import type { Metadata } from "next";

export const metadata: Metadata = { title: { default: "Deliveries", template: "%s · Deliveries" }, robots: { index: false, follow: false } };

// private, per-request pages: blocking navigation is fine and nothing here belongs in a static shell
export const instant = false;

export default function DeliveryLayout({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto min-h-dvh w-full max-w-lg bg-cream-100 px-4 pb-[calc(2rem+var(--safe-bottom))] pt-[calc(1rem+var(--safe-top))]">{children}</main>;
}
