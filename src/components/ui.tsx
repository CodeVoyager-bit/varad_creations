import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import type { Tone } from "@/lib/order-rules";

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

const btnBase =
  "inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl font-semibold transition-[transform,background-color,color,border-color] duration-150 active:scale-[0.98] motion-reduce:active:scale-100 disabled:pointer-events-none disabled:opacity-50 select-none";
const btnVariants = {
  primary: "bg-burgundy-600 text-white hover:bg-burgundy-700 active:bg-burgundy-800",
  secondary: "border border-burgundy-600/30 bg-white text-burgundy-700 hover:bg-burgundy-50",
  ghost: "text-burgundy-700 hover:bg-burgundy-50",
  dark: "bg-ink-900 text-white hover:bg-ink-700",
  saffron: "bg-saffron-400 text-ink-900 hover:bg-saffron-500",
  danger: "bg-danger-600 text-white hover:brightness-95",
  success: "bg-leaf-600 text-white hover:bg-leaf-700",
};
const btnSizes = { sm: "h-9 px-3 text-sm", md: "h-11 px-4 text-[15px]", lg: "h-12 px-5 text-base" };

export type ButtonProps = ComponentProps<"button"> & { variant?: keyof typeof btnVariants; size?: keyof typeof btnSizes; block?: boolean };

export function Button({ variant = "primary", size = "md", block, className, ...p }: ButtonProps) {
  return <button {...p} className={cx(btnBase, btnVariants[variant], btnSizes[size], block && "w-full", className)} />;
}

export function ButtonLink({ variant = "primary", size = "md", block, className, ...p }: ComponentProps<typeof Link> & Omit<ButtonProps, keyof ComponentProps<"button">>) {
  return <Link {...p} className={cx(btnBase, btnVariants[variant], btnSizes[size], block && "w-full", className)} />;
}

const toneClass: Record<Tone, string> = {
  neutral: "bg-cream-200 text-ink-700",
  warn: "bg-saffron-100 text-saffron-700",
  good: "bg-leaf-100 text-leaf-700",
  bad: "bg-danger-50 text-danger-600",
  info: "bg-burgundy-50 text-burgundy-700",
};

export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return <span className={cx("inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold whitespace-nowrap", toneClass[tone], className)}>{children}</span>;
}

export function Card({ className, ...p }: ComponentProps<"div">) {
  return <div {...p} className={cx("rounded-[var(--radius-card)] bg-white shadow-[var(--shadow-card)]", className)} />;
}

export function Field({ label, hint, error, children, className }: { label: string; hint?: ReactNode; error?: string; children: ReactNode; className?: string }) {
  return (
    <label className={cx("block", className)}>
      <span className="mb-1 block text-sm font-medium text-ink-700">{label}</span>
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-ink-500">{hint}</span>}
      {error && <span className="mt-1 block text-xs font-medium text-danger-600">{error}</span>}
    </label>
  );
}

export const inputClass =
  // 16px text: smaller inputs make iOS Safari zoom the page on focus
  "w-full rounded-xl border border-cream-300 bg-white px-3 h-11 text-base text-ink-900 placeholder:text-ink-500 focus:border-burgundy-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-burgundy-500/25 disabled:bg-cream-100";

export function Input(p: ComponentProps<"input">) {
  return <input {...p} className={cx(inputClass, p.className)} />;
}
export function Select(p: ComponentProps<"select">) {
  return <select {...p} className={cx(inputClass, "pr-8", p.className)} />;
}
export function Textarea(p: ComponentProps<"textarea">) {
  return <textarea {...p} className={cx(inputClass, "h-auto min-h-24 py-2", p.className)} />;
}

export function Notice({ tone = "info", title, children, className }: { tone?: Tone; title?: string; children?: ReactNode; className?: string }) {
  return (
    <div role={tone === "bad" ? "alert" : "status"} className={cx("rounded-xl px-4 py-3 text-sm", toneClass[tone], className)}>
      {title && <p className="font-semibold">{title}</p>}
      {children && <div className={cx(title && "mt-0.5", "opacity-90")}>{children}</div>}
    </div>
  );
}

export function EmptyState({ title, body, action }: { title: string; body?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
      <svg aria-hidden viewBox="0 0 64 64" className="size-16 text-saffron-400">
        <circle cx="32" cy="34" r="22" fill="currentColor" opacity=".18" />
        <path d="M18 30c4 10 24 10 28 0" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" />
        <path d="M32 12c-3 4-3 8 0 12 3-4 3-8 0-12z" fill="#1e8a43" />
      </svg>
      <p className="font-display text-lg font-semibold">{title}</p>
      {body && <div className="max-w-sm text-sm text-ink-500">{body}</div>}
      {action}
    </div>
  );
}

export function Spinner({ label = "Loading…" }: { label?: string }) {
  return (
    <span role="status" className="inline-flex items-center gap-2 text-sm text-ink-500">
      <span className="size-4 animate-spin rounded-full border-2 border-burgundy-500 border-t-transparent motion-reduce:animate-none" />
      {label}
    </span>
  );
}

export function PageLoading() {
  return (
    <div className="mx-auto max-w-6xl space-y-3 p-4" aria-busy>
      <div className="h-7 w-48 animate-pulse rounded-lg bg-cream-200" />
      <div className="h-28 animate-pulse rounded-2xl bg-cream-200" />
      <div className="h-28 animate-pulse rounded-2xl bg-cream-200" />
      <span className="sr-only">Loading…</span>
    </div>
  );
}

export function SectionTitle({ title, href, linkLabel = "View all" }: { title: string; href?: string; linkLabel?: string }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <h2 className="font-display text-xl font-semibold text-burgundy-700">{title}</h2>
      {href && (
        <Link href={href} className="text-sm font-semibold text-burgundy-600 hover:underline">
          {linkLabel}
        </Link>
      )}
    </div>
  );
}

export function Icon({ name, className = "size-5" }: { name: keyof typeof paths; className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
      {paths[name]}
    </svg>
  );
}

const paths = {
  home: <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />,
  grid: <path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" />,
  box: <path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5zM3 7.5l9 4.5 9-4.5M12 12v9" />,
  user: <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0" />,
  cart: <path d="M3 4h2l2.4 11.2a1 1 0 0 0 1 .8h9.2a1 1 0 0 0 1-.8L20 8H6.2M9 20.5a.5.5 0 1 0 0-1 .5.5 0 0 0 0 1zM18 20.5a.5.5 0 1 0 0-1 .5.5 0 0 0 0 1z" />,
  search: <path d="M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4" />,
  pin: <path d="M12 21s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12zM12 11.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z" />,
  chevron: <path d="m9 6 6 6-6 6" />,
  down: <path d="m6 9 6 6 6-6" />,
  back: <path d="m15 6-6 6 6 6" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  phone: <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" />,
  nav: <path d="M3 11 21 3l-8 18-2-8z" />,
  truck: <path d="M3 6h11v10H3zM14 9h4l3 3v4h-7zM7 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM17.5 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" />,
  check: <path d="m5 12 5 5 9-10" />,
  clock: <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2" />,
  shield: <path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z" />,
  whatsapp: <path d="M4 20l1.3-4A8 8 0 1 1 8 18.7zM9 9c0 3 3 6 6 6l1.2-1.4-2-1-1 .8a4 4 0 0 1-2.6-2.6l.8-1-1-2z" />,
  instagram: <path d="M4 8a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v8a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4zM12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM17 7h.01" />,
  filter: <path d="M4 6h16M7 12h10M10 18h4" />,
  tag: <path d="M3 12V4h8l10 10-8 8zM7.5 8.5h.01" />,
  wallet: <path d="M3 7h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM3 7l12-4v4M16 14h.01" />,
  alert: <path d="M12 3 2 20h20zM12 10v4M12 17h.01" />,
  logout: <path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10" />,
  upload: <path d="M12 16V4M7 9l5-5 5 5M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />,
  refresh: <path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7" />,
  locate: <path d="M12 19a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM12 3v2M12 19v2M3 12h2M19 12h2M12 14.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z" />,
  gift: <path d="M4 11h16v9H4zM3 7h18v4H3zM12 7v13M12 7c-1.5-3-5-3.5-5-1.2C7 7 9 7 12 7zM12 7c1.5-3 5-3.5 5-1.2C17 7 15 7 12 7z" />,
  bell: <path d="M6 9a6 6 0 1 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9zM10 20a2 2 0 0 0 4 0" />,
  chart: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
  users: <path d="M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21a7 7 0 0 1 14 0M17 11a3 3 0 1 0 0-6M22 21a6 6 0 0 0-4-5.6" />,
  settings: <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />,
  doc: <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zM14 3v6h6M8 13h8M8 17h5" />,
  store: <path d="M3 9l1.5-5h15L21 9M3 9v11h18V9M3 9h18M9 20v-6h6v6" />,
  history: <path d="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l3 2" />,
};

export const fmtDate = (d: string | Date | undefined | null, withTime = true) =>
  d
    ? new Date(d).toLocaleString("en-IN", {
        day: "numeric",
        month: "short",
        ...(withTime ? { hour: "numeric", minute: "2-digit" } : { year: "numeric" }),
        timeZone: "Asia/Kolkata",
      })
    : "—";
