"use client";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import type { AdminResult } from "@/app/actions/admin";
import { Button, cx, Notice, type ButtonProps } from "./ui";

type Act = (fd: FormData) => Promise<AdminResult>;

/** Server-action form with pending, error and success states. Refreshes server data on success. */
export function ActionForm({ action, children, className, confirm, resetOnSuccess, onDone }: { action: Act; children: React.ReactNode; className?: string; confirm?: string; resetOnSuccess?: boolean; onDone?: (r: AdminResult) => void }) {
  const router = useRouter();
  const ref = useRef<HTMLFormElement>(null);
  const [res, setRes] = useState<AdminResult | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      ref={ref}
      className={className}
      action={(fd) =>
        start(async () => {
          if (confirm && !window.confirm(confirm)) return;
          const r = await action(fd);
          setRes(r);
          onDone?.(r);
          if (r.ok) {
            if (resetOnSuccess) ref.current?.reset();
            router.refresh();
          }
        })
      }
    >
      <fieldset disabled={pending} className="contents">
        {children}
      </fieldset>
      {res && (res.ok ? res.message && <Notice tone="good" className="mt-2">{res.message}</Notice> : <Notice tone="bad" className="mt-2">{res.error}</Notice>)}
    </form>
  );
}

/** One-click action (no inputs), e.g. "Accept order". */
export function ActionButton({ action, children, confirm, ...p }: Omit<ButtonProps, "action"> & { action: () => Promise<AdminResult>; confirm?: string }) {
  const router = useRouter();
  const [res, setRes] = useState<AdminResult | null>(null);
  const [pending, start] = useTransition();
  return (
    <span className="inline-flex flex-col gap-1">
      <Button
        {...p}
        type="button"
        disabled={pending || p.disabled}
        onClick={() =>
          start(async () => {
            if (confirm && !window.confirm(confirm)) return;
            const r = await action();
            setRes(r);
            if (r.ok) router.refresh();
          })
        }
      >
        {pending ? "Working…" : children}
      </Button>
      {res && !res.ok && <span className="text-xs font-medium text-danger-600">{res.error}</span>}
      {res?.ok && res.message && <span className="text-xs font-medium text-leaf-700">{res.message}</span>}
    </span>
  );
}

export function Disclosure({ label, children, variant = "secondary" }: { label: string; children: React.ReactNode; variant?: ButtonProps["variant"] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={cx(open && "w-full")}>
      <Button size="sm" variant={variant} type="button" onClick={() => setOpen(!open)} aria-expanded={open}>
        {label}
      </Button>
      {open && <div className="mt-2 rounded-xl border border-cream-300 bg-cream-50 p-3">{children}</div>}
    </div>
  );
}

export function InviteLink({ link, phone }: { link: string; phone?: string }) {
  const [copied, setCopied] = useState(false);
  const text = `Varad Creation delivery access (valid 2 hours, single use): ${link}`;
  return (
    <div className="space-y-2 rounded-xl bg-saffron-50 p-3 text-sm">
      <p className="font-semibold text-saffron-700">Share this link with the partner only. It works once and is shown only now.</p>
      <p className="break-all font-mono text-xs">{link}</p>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" type="button" variant="secondary" onClick={() => navigator.clipboard.writeText(link).then(() => setCopied(true))}>
          {copied ? "Copied" : "Copy link"}
        </Button>
        {phone && (
          <a className="inline-flex h-9 items-center rounded-xl bg-leaf-600 px-3 text-sm font-semibold text-white" target="_blank" rel="noopener" href={`https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`}>
            Send on WhatsApp
          </a>
        )}
      </div>
    </div>
  );
}

export function SelectAll({ name, formId }: { name: string; formId: string }) {
  return (
    <input
      type="checkbox"
      aria-label="Select all"
      className="accent-burgundy-600"
      onChange={(e) => document.querySelectorAll<HTMLInputElement>(`#${formId} input[name="${name}"]`).forEach((c) => (c.checked = e.target.checked))}
    />
  );
}
