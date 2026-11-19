"use client";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useMemo, useState } from "react";
import { rupees } from "@/lib/money";
import { cx, Icon } from "./ui";

interface Hit {
  slug: string;
  name: string;
  brand: string;
  image: string | null;
  fromPaise: number;
  inStock: boolean;
  keys: string;
}

const HINTS = ["ratlami sev", "khari", "poha masala", "bhujia", "chivda"];

// fetched once per page load, on first focus
let index: Promise<Hit[]> | null = null;
const loadIndex = () =>
  (index ??= fetch("/search-index")
    .then((r) => (r.ok ? r.json() : []))
    .catch(() => ((index = null), [])));

/** Bold the first matching term in a product name. */
function Mark({ text, term }: { text: string; term?: string }) {
  const i = term ? text.toLowerCase().indexOf(term) : -1;
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <b className="font-bold text-ink-900">{text.slice(i, i + term!.length)}</b>
      {text.slice(i + term!.length)}
    </>
  );
}

/**
 * Header search with instant suggestions (photo, brand, price) as you type. Arrow keys move
 * through suggestions, Enter opens one, or runs the full search when none is highlighted.
 */
export function SearchBox({ className = "flex" }: { className?: string }) {
  const router = useRouter();
  const id = useId();
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Hit[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const terms = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const hits = useMemo(
    () =>
      terms.length
        ? items
            .filter((h) => terms.every((t) => h.keys.includes(t)))
            .sort((a, b) => Number(b.inStock) - Number(a.inStock) || Number(b.name.toLowerCase().includes(terms[0])) - Number(a.name.toLowerCase().includes(terms[0])))
            .slice(0, 6)
        : [],
    // terms is derived from q
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [q, items],
  );
  const show = open && (terms.length > 0 || !q);
  const go = (slug: string) => {
    setOpen(false);
    setQ("");
    router.push(`/p/${slug}`);
  };

  return (
    <form
      action="/search"
      role="search"
      onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && setOpen(false)}
      className={`${className} relative h-11 items-center gap-2.5 rounded-xl border border-transparent bg-cream-100 px-3.5 transition-colors focus-within:border-burgundy-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-burgundy-500/15`}
    >
      <Icon name="search" className="size-5 shrink-0 text-ink-500" />
      <input
        name="q"
        type="search"
        value={q}
        placeholder=" "
        role="combobox"
        aria-label="Search products and brands"
        aria-autocomplete="list"
        aria-expanded={show}
        aria-controls={`${id}-list`}
        aria-activedescendant={show && active >= 0 && active < hits.length ? `${id}-${active}` : undefined}
        autoComplete="off"
        enterKeyHint="search"
        onFocus={() => {
          setOpen(true);
          loadIndex().then(setItems);
        }}
        onChange={(e) => {
          setQ(e.target.value);
          setActive(-1);
          setOpen(true);
          loadIndex().then(setItems); // also covers a field focused before hydration
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") return setOpen(false);
          if (!hits.length) return;
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            const n = hits.length;
            setActive((a) => (e.key === "ArrowDown" ? (a + 1) % n : (a - 1 + n) % n));
          } else if (e.key === "Enter" && active >= 0 && active < hits.length) {
            e.preventDefault();
            go(hits[active].slug);
          }
        }}
        style={{ outline: "none" }} // the field itself shows focus (border + ring)
        className="peer h-full w-full bg-transparent text-base md:text-[15px]"
      />
      {/* animated placeholder: hidden as soon as there's text */}
      <span aria-hidden className="pointer-events-none absolute inset-y-0 left-11 flex items-center gap-1 text-base text-ink-500 peer-[:not(:placeholder-shown)]:hidden md:text-[15px]">
        Search
        <span className="relative h-6 overflow-hidden">
          <span className="block animate-[hints_12s_cubic-bezier(.7,0,.3,1)_infinite]">
            {[...HINTS, HINTS[0]].map((h, i) => (
              <span key={i} className="block h-6 leading-6">
                “{h}”
              </span>
            ))}
          </span>
        </span>
      </span>

      {show && (
        // mousedown would blur the input before the click lands
        <div onMouseDown={(e) => e.preventDefault()} className="absolute inset-x-0 top-full z-40 mt-2 animate-[rise_200ms_cubic-bezier(.2,.8,.2,1)] overflow-hidden rounded-2xl bg-white shadow-[0_24px_48px_-20px_rgb(36_23_15/0.4)] ring-1 ring-black/[0.06]">
          {!q ? (
            <div className="p-3">
              <p className="px-1 pb-2 text-xs font-semibold text-ink-500">Popular searches</p>
              <div className="flex flex-wrap gap-2">
                {HINTS.map((h) => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => setQ(h)}
                    className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full bg-cream-100 px-3 text-sm font-medium text-ink-700 hover:bg-cream-200"
                  >
                    <Icon name="search" className="size-3.5 text-ink-500" />
                    {h}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              <ul id={`${id}-list`} role="listbox" aria-label="Suggestions" className="max-h-[60vh] overflow-y-auto overscroll-contain py-1">
                {hits.map((h, i) => (
                  <li key={h.slug} id={`${id}-${i}`} role="option" aria-selected={i === active}>
                    <Link
                      href={`/p/${h.slug}`}
                      tabIndex={-1}
                      onClick={() => {
                        setOpen(false);
                        setQ("");
                      }}
                      onMouseEnter={() => setActive(i)}
                      className={cx("flex items-center gap-3 px-3 py-2", i === active && "bg-cream-100")}
                    >
                      <span className="relative size-11 shrink-0 overflow-hidden rounded-lg bg-[var(--color-tile)]">
                        {h.image && <Image src={h.image} alt="" fill sizes="44px" className="object-contain p-1 mix-blend-multiply" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-ink-700">
                          <Mark text={h.name} term={terms[0]} />
                        </span>
                        <span className="block truncate text-xs text-ink-500">
                          {h.brand}
                          {!h.inStock && " · out of stock"}
                        </span>
                      </span>
                      <span className="shrink-0 text-sm font-semibold tabular-nums text-ink-900">{rupees(h.fromPaise)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
              {!hits.length && <p className="px-4 py-3 text-sm text-ink-500">{items.length ? "No products match yet — try another word." : "Loading suggestions…"}</p>}
              <button type="submit" className="flex w-full cursor-pointer items-center gap-2 border-t border-cream-200 px-4 py-3 text-left text-sm font-semibold text-burgundy-700 hover:bg-cream-100">
                <Icon name="search" className="size-4" />
                See all results for “{q.trim()}”
              </button>
            </>
          )}
        </div>
      )}
    </form>
  );
}
