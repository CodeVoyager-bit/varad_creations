import Image from "next/image";
import Link from "next/link";

/** Temporary wordmark until the real logo is uploaded in admin settings. */
export function Logo({ name, logoUrl, compact }: { name: string; logoUrl?: string; compact?: boolean }) {
  return (
    <Link href="/" className="inline-flex items-center gap-2" aria-label={`${name} home`}>
      {logoUrl ? (
        <Image src={logoUrl} alt={name} width={compact ? 120 : 160} height={40} className="h-9 w-auto object-contain" priority />
      ) : (
        <span className="flex flex-col leading-none">
          <span className="flex items-center gap-1 font-display text-[22px] font-bold text-burgundy-700">
            {name}
            <svg aria-hidden viewBox="0 0 24 24" className="-mt-3 size-5">
              <path d="M12 21c0-6 1-10 6-14-6 1-8 5-8 9" fill="none" stroke="#9b2238" strokeWidth="1.8" strokeLinecap="round" />
              <path d="M12 14c-1-4-4-6-8-6 1 4 4 6 8 6z" fill="#1e8a43" />
              <path d="M13 11c1-4 4-6 8-6-1 4-4 6-8 6z" fill="#e08a0b" />
            </svg>
          </span>
          {!compact && <span className="mt-0.5 text-[9px] font-semibold tracking-[0.14em] text-ink-500">INDORI NAMKEEN &amp; MORE</span>}
        </span>
      )}
    </Link>
  );
}
