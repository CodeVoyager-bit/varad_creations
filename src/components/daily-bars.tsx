import { rupees } from "@/lib/money";
import { cx } from "./ui";

export interface Day {
  key: string;
  label: string;
  orders: number;
  valuePaise: number;
}

/**
 * Single-series bar chart (order value per day). One colour, so no legend; the card title
 * names the series. Each bar is focusable with a tooltip, and a table carries the same data
 * for screen readers.
 */
export function DailyBars({ days }: { days: Day[] }) {
  const max = Math.max(...days.map((d) => d.valuePaise));
  if (!max) return <p className="grid h-40 place-items-center rounded-2xl bg-cream-50 text-sm text-ink-500">No orders in the last {days.length} days yet.</p>;
  return (
    <figure>
      <ol className="flex h-40 items-end gap-0.5 border-b border-cream-300" aria-hidden>
        {days.map((d, i) => (
          <li key={d.key} tabIndex={0} className="group relative flex h-full flex-1 cursor-default items-end outline-none">
            <span
              className={cx("w-full rounded-t-[4px] transition-colors", d.valuePaise ? "bg-[var(--color-chart)] group-hover:bg-burgundy-700 group-focus-visible:bg-burgundy-700" : "h-[2px] bg-cream-300")}
              style={d.valuePaise ? { height: `${Math.max(3, (d.valuePaise / max) * 100)}%` } : undefined}
            />
            <span
              className={cx(
                "pointer-events-none absolute bottom-full z-10 mb-2 whitespace-nowrap rounded-lg bg-ink-900 px-2.5 py-1.5 text-xs leading-snug text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100",
                i < 3 ? "left-0" : i > days.length - 4 ? "right-0" : "left-1/2 -translate-x-1/2",
              )}
            >
              {d.label}
              <b className="block tabular-nums">{rupees(d.valuePaise)}</b>
              {d.orders} order{d.orders === 1 ? "" : "s"}
            </span>
          </li>
        ))}
      </ol>
      <figcaption className="mt-1.5 flex justify-between text-[11px] text-ink-500" aria-hidden>
        <span>{days[0].label}</span>
        <span>{days[Math.floor(days.length / 2)].label}</span>
        <span>Today</span>
      </figcaption>
      <table className="sr-only">
        <caption>Order value per day</caption>
        <thead>
          <tr>
            <th>Day</th>
            <th>Orders</th>
            <th>Value</th>
          </tr>
        </thead>
        <tbody>
          {days.map((d) => (
            <tr key={d.key}>
              <td>{d.label}</td>
              <td>{d.orders}</td>
              <td>{rupees(d.valuePaise)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
