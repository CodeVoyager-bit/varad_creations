"use client";
export function PrintButton() {
  return (
    <button onClick={() => window.print()} className="no-print mt-2 rounded-lg bg-cream-200 px-3 py-1 text-xs font-semibold">
      Print / save PDF
    </button>
  );
}
