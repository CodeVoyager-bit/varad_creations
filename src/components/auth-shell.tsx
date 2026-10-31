import Link from "next/link";

export function AuthShell({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-md px-4 py-8">
      <div className="rounded-2xl bg-white p-6 shadow-[var(--shadow-card)]">
        <h1 className="font-display text-2xl font-semibold text-burgundy-700">{title}</h1>
        {subtitle && <p className="mb-5 mt-1 text-sm text-ink-500">{subtitle}</p>}
        {children}
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
