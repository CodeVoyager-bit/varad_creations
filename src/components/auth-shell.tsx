import Link from "next/link";
import { Skyline } from "./skyline";

export function AuthShell({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-md px-4 py-8">
      <div className="overflow-hidden rounded-[1.75rem] bg-white shadow-[var(--shadow-card)] ring-1 ring-cream-300/70">
        <div className="bg-burgundy-700 px-6 pb-2 pt-5">
          <Skyline labels={false} className="h-14 w-full text-white/35" />
        </div>
        <div className="p-6">
        <h1 className="font-display text-2xl font-semibold text-ink-900">{title}</h1>
        {subtitle && <p className="mb-5 mt-1 text-sm text-ink-500">{subtitle}</p>}
        {children}
        </div>
      </div>
      <p className="mt-4 text-center text-xs text-ink-500">
        By continuing you agree to our{" "}
        <Link href="/terms" className="underline">
          Terms
        </Link>{" "}
        and{" "}
        <Link href="/privacy-policy" className="underline">
          Privacy policy
        </Link>
        .
      </p>
    </div>
  );
}
