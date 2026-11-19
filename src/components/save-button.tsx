"use client";
import { useState } from "react";
import { saved, useSaved } from "./device-lists";
import { cx, Icon } from "./ui";

/** Heart toggle for the device's saved list (see /saved). */
export function SaveButton({ id, name, className }: { id: string; name: string; className?: string }) {
  const on = useSaved().includes(id);
  const [touched, setTouched] = useState(false);
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={`Save ${name}`}
      onClick={() => {
        setTouched(true);
        saved.toggle(id);
      }}
      className={cx("grid size-9 cursor-pointer place-items-center rounded-full bg-white/90 text-ink-500 shadow-[0_2px_8px_-2px_rgb(36_23_15/0.25)] transition-[color,scale] hover:text-burgundy-600 active:scale-90", className)}
    >
      <Icon name="heart" className={cx("size-[18px]", on && "fill-burgundy-600 text-burgundy-600", touched && on && "animate-[pop_320ms_cubic-bezier(.3,1.6,.5,1)]")} />
    </button>
  );
}
