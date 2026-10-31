import { Notice } from "@/components/ui";

export const metadata = { title: "Access ended" };

export default function Ended() {
  return (
    <div className="space-y-4 pt-10 text-center">
      <h1 className="font-display text-2xl font-extrabold tracking-[-0.02em] text-ink-900">Delivery access has ended</h1>
      <Notice tone="info">Your batch is complete, or the shop ended or replaced your access. Contact the shop if you still have packages to deliver.</Notice>
      <p className="text-sm text-ink-500">
        Shop staff with an account can{" "}
        <a href="/login?next=/delivery" className="font-semibold text-burgundy-700 underline">
          sign in again
        </a>
        .
      </p>
    </div>
  );
}
