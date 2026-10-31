/**
 * Signature line art: Indore's Rajwada (left) joined by a delivery route to Pune's
 * Shaniwar Wada (right) — Indori favourites, delivered in Pune. Decorative only.
 */
const arches = (xs: number[], base: number, h = 7, w = 7) => xs.map((x) => `M${x} ${base}v-${h}a${w / 2} ${w / 2} 0 0 1 ${w} 0v${h}`).join("");
const range = (from: number, to: number, step: number) => Array.from({ length: Math.floor((to - from) / step) + 1 }, (_, i) => from + i * step);

export function Skyline({ className, labels = true }: { className?: string; labels?: boolean }) {
  return (
    <svg aria-hidden viewBox="0 0 640 152" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" className={className}>
      {/* Rajwada, Indore */}
      <path d="M10 135H170M14 135V96H166V135M24 96V72H156V96M36 72V52H144V52V72M50 52V36H130V52M62 36V24H118V36" />
      <path d="M58 24a6 6 0 0 1 12 0M110 24a6 6 0 0 1 12 0M82 24a8 8 0 0 1 16 0" />
      <path d="M80 135v-20a10 10 0 0 1 20 0v20" />
      <path d={arches(range(22, 64, 14), 128) + arches(range(110, 152, 14), 128) + arches(range(30, 146, 13), 90, 8, 6) + arches(range(42, 134, 13), 67, 7, 6) + arches(range(56, 120, 12), 48, 6, 5)} />
      {/* delivery route */}
      <path d="M176 66C262 8 384 8 464 70" strokeDasharray="1 7" strokeWidth={2.2} />
      <path d="M458 62l7 9-11 2" />
      {/* Shaniwar Wada, Pune */}
      <path d="M470 135H632M472 135V84H630V135" />
      <path d={range(476, 624, 10).map((x) => `M${x} 84v-5h5v5`).join("")} />
      <path d="M472 135V66a14 14 0 0 1 28 0V135M602 135V66a14 14 0 0 1 28 0V135" />
      <path d="M530 135V58H572V135M526 58H576M538 58a13 13 0 0 1 26 0" />
      <path d="M540 135V104Q551 86 562 104V135" />
      <path d={arches([482, 612], 100, 9, 8) + arches(range(508, 520, 12), 112, 6, 5) + arches(range(582, 594, 12), 112, 6, 5)} />
      {labels && (
        <g fill="currentColor" stroke="none" fontSize="11" fontFamily="system-ui, sans-serif" letterSpacing="3" textAnchor="middle">
          <text x="90" y="150">INDORE</text>
          <text x="551" y="150">PUNE</text>
        </g>
      )}
    </svg>
  );
}
