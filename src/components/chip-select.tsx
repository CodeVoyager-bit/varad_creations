"use client";
import { useMemo, useState } from "react";
import { cx, Icon } from "./ui";

/**
 * Multi-select as tappable chips (native checkboxes underneath, so forms submit as before).
 * Replaces <select multiple>, which needs Ctrl/Cmd-click and clips on phones.
 */
export function ChipSelect({
  name,
  label,
  options,
  defaultValue = [],
  emptyMeans = "Applies to all",
  searchable,
}: {
  name: string;
  label: string;
  options: { value: string; label: string }[];
  defaultValue?: string[];
  emptyMeans?: string;
  searchable?: boolean;
}) {
  const [picked, setPicked] = useState<string[]>(defaultValue);
  const [q, setQ] = useState("");
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? options.filter((o) => o.label.toLowerCase().includes(t) || picked.includes(o.value)) : options;
  }, [q, options, picked]);
  const toggle = (v: string) => setPicked((p) => (p.includes(v) ? p.filter((x) => x !== v) : [...p, v]));

  return (
    <fieldset className="min-w-0">
      <legend className="mb-1 flex w-full items-center justify-between gap-2 text-sm font-medium text-ink-700">
        {label}
        <span className="text-xs font-normal text-ink-500">{picked.length ? `${picked.length} selected` : emptyMeans}</span>
      </legend>
      {searchable && options.length > 8 && (
        <label className="mb-2 flex h-10 items-center gap-2 rounded-xl border border-cream-300 bg-white px-3 focus-within:border-burgundy-500">
          <Icon name="search" className="size-4 text-ink-500" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${options.length} items…`} aria-label={`Search ${label.toLowerCase()}`} autoComplete="off" className="w-full bg-transparent text-base outline-none placeholder:text-ink-500 sm:text-sm" />
        </label>
      )}
      <div className={cx("flex flex-wrap gap-2", searchable && "max-h-48 overflow-y-auto overscroll-contain rounded-xl p-0.5")}>
        {shown.map((o) => {
          const on = picked.includes(o.value);
          return (
            <label key={o.value} className="cursor-pointer">
              <input type="checkbox" name={name} value={o.value} checked={on} onChange={() => toggle(o.value)} className="peer sr-only" />
              <span
                className={cx(
                  "inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-saffron-500 peer-focus-visible:ring-offset-1",
                  on ? "border-ink-900 bg-ink-900 text-white" : "border-cream-300 bg-white text-ink-700 hover:border-ink-500",
                )}
              >
                {on && <Icon name="check" className="size-3.5" />}
                {o.label}
              </span>
            </label>
          );
        })}
        {!shown.length && <p className="px-1 text-sm text-ink-500">No matches.</p>}
      </div>
      {picked.length > 0 && (
        <button type="button" onClick={() => setPicked([])} className="mt-1.5 min-h-9 cursor-pointer text-xs font-semibold text-burgundy-700 hover:underline">
          Clear selection
        </button>
      )}
    </fieldset>
  );
}
