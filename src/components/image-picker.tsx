"use client";
import { useEffect, useId, useRef, useState } from "react";
import { cx, Icon } from "./ui";

const ACCEPT = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 5 * 1024 * 1024;
const kb = (n: number) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.round(n / 1024)} KB`);

/**
 * Upload control: a real button plus drag-and-drop, with a preview of the current image and of
 * what's been picked. The native file input stays in the form (by `name`), so server actions
 * receive the file exactly as before. The server still re-checks type and size.
 */
export function ImagePicker({
  name,
  current,
  multiple,
  required,
  label = "Choose image",
  hint = "JPEG, PNG or WebP · up to 5 MB",
  onFiles,
}: {
  name?: string;
  current?: string;
  multiple?: boolean;
  required?: boolean;
  label?: string;
  hint?: string;
  /** called with the picked files (for upload-on-pick flows) */
  onFiles?: (files: File[]) => void;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [picked, setPicked] = useState<{ file: File; url: string }[]>([]);
  const [error, setError] = useState("");
  const [over, setOver] = useState(false);

  const clear = () => {
    setPicked((p) => (p.forEach((x) => URL.revokeObjectURL(x.url)), []));
    setError("");
    if (input.current) input.current.value = "";
  };

  // a successful form submit resets the form; follow it
  useEffect(() => {
    const form = input.current?.form;
    form?.addEventListener("reset", clear);
    return () => form?.removeEventListener("reset", clear);
  }, []);

  function take(list: FileList | null) {
    const files = [...(list ?? [])];
    const bad = files.find((f) => !ACCEPT.includes(f.type) || f.size > MAX_BYTES);
    if (bad) {
      clear();
      return setError(!ACCEPT.includes(bad.type) ? `“${bad.name}” isn’t a JPEG, PNG or WebP image.` : `“${bad.name}” is ${kb(bad.size)} — the limit is 5 MB.`);
    }
    setError("");
    setPicked((p) => (p.forEach((x) => URL.revokeObjectURL(x.url)), files.map((file) => ({ file, url: URL.createObjectURL(file) }))));
    if (files.length) onFiles?.(files);
  }

  const preview = picked[0]?.url ?? current;
  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          if (!input.current || !e.dataTransfer.files.length) return;
          const dt = new DataTransfer();
          [...e.dataTransfer.files].slice(0, multiple ? 12 : 1).forEach((f) => dt.items.add(f));
          input.current.files = dt.files;
          take(dt.files);
        }}
        className={cx("flex items-center gap-3 rounded-2xl border-2 border-dashed p-3 transition-colors", over ? "border-burgundy-500 bg-burgundy-50" : "border-cream-300 bg-cream-50")}
      >
        <span className="relative grid size-16 shrink-0 place-items-center overflow-hidden rounded-xl bg-white ring-1 ring-cream-300">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element -- local blob/remote preview, not a page image
            <img src={preview} alt="" className="size-full object-contain" />
          ) : (
            <Icon name="upload" className="size-6 text-ink-500" />
          )}
          {picked.length > 1 && <span className="absolute bottom-0.5 right-0.5 rounded-md bg-ink-900 px-1 text-[11px] font-bold text-white">+{picked.length - 1}</span>}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => input.current?.click()}
              aria-describedby={`${id}-hint`}
              className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl bg-ink-900 px-4 text-sm font-semibold text-white transition-[transform,background-color] hover:bg-ink-700 active:scale-[0.98] motion-reduce:active:scale-100"
            >
              <Icon name="upload" className="size-4" />
              {picked.length ? (multiple ? "Choose different photos" : "Choose another") : current ? "Replace image" : label}
            </button>
            {picked.length > 0 && (
              <button type="button" onClick={clear} className="inline-flex h-10 cursor-pointer items-center rounded-xl px-3 text-sm font-semibold text-ink-700 hover:bg-cream-200">
                Clear
              </button>
            )}
          </span>
          <span id={`${id}-hint`} className="mt-1 block truncate text-xs text-ink-500" aria-live="polite">
            {picked.length ? `${picked.length === 1 ? picked[0].file.name : `${picked.length} photos`} · ${kb(picked.reduce((a, x) => a + x.file.size, 0))} — ready to upload` : `${hint} · or drop ${multiple ? "files" : "a file"} here`}
          </span>
        </span>
        <input
          ref={input}
          id={id}
          type="file"
          name={name}
          accept={ACCEPT.join(",")}
          multiple={multiple}
          required={required}
          onChange={(e) => take(e.target.files)}
          className="sr-only"
          tabIndex={-1}
        />
      </div>
      {error && (
        <p role="alert" className="mt-1.5 text-xs font-medium text-danger-600">
          {error}
        </p>
      )}
    </div>
  );
}
