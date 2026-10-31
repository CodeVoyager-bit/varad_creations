"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { saveStorefrontDraft, uploadBannerImage } from "@/app/actions/admin";
import type { Banner, Collection, StorefrontContent } from "@/lib/types";
import { ImagePicker } from "./image-picker";
import { Button, Card, Field, Input, Notice } from "./ui";

const uid = () => Math.random().toString(36).slice(2, 9);

export function StorefrontEditor({ initial }: { initial: StorefrontContent }) {
  const router = useRouter();
  const [c, setC] = useState<StorefrontContent>(initial);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const setBanner = (i: number, b: Partial<Banner>) => setC({ ...c, banners: c.banners.map((x, k) => (k === i ? { ...x, ...b } : x)) });
  const setCol = (i: number, b: Partial<Collection>) => setC({ ...c, collections: c.collections.map((x, k) => (k === i ? { ...x, ...b } : x)) });

  return (
    <div className="space-y-4">
      <Card className="space-y-3 p-4">
        <h2 className="font-semibold">Announcement strip (optional)</h2>
        <Input value={c.announcement ?? ""} onChange={(e) => setC({ ...c, announcement: e.target.value || undefined })} placeholder="e.g. Diwali orders: place by 28 Oct for delivery before the festival" />
      </Card>
      <Card className="space-y-3 p-4">
        <h2 className="font-semibold">Banners (the first active one is shown)</h2>
        {c.banners.map((b, i) => (
          <div key={b.id} className="grid gap-2 rounded-xl border border-cream-200 p-3 sm:grid-cols-2">
            <Field label="Title">
              <Input value={b.title} onChange={(e) => setBanner(i, { title: e.target.value })} />
            </Field>
            <Field label="Subtitle">
              <Input value={b.subtitle ?? ""} onChange={(e) => setBanner(i, { subtitle: e.target.value })} />
            </Field>
            <Field label="Link">
              <Input value={b.href ?? ""} onChange={(e) => setBanner(i, { href: e.target.value })} placeholder="/c/namkeen" />
            </Field>
            <div className="sm:col-span-2">
              <span className="mb-1 block text-sm font-medium text-ink-700">Banner image (optional — keep food imagery restrained)</span>
              <ImagePicker
                current={b.image}
                label="Upload banner image"
                hint="Wide image, at least 1600 px across · up to 5 MB"
                onFiles={([f]) => {
                  const fd = new FormData();
                  fd.set("file", f);
                  start(async () => {
                    const r = await uploadBannerImage(fd);
                    if (r.ok && r.data?.url) setBanner(i, { image: r.data.url });
                    else if (!r.ok) setMsg({ ok: false, text: r.error });
                  });
                }}
              />
              {b.image && (
                <button type="button" className="mt-1 min-h-9 cursor-pointer text-xs font-semibold text-danger-600" onClick={() => setBanner(i, { image: undefined })}>
                  Remove image from banner
                </button>
              )}
            </div>
            <div className="flex items-center gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={b.active} onChange={(e) => setBanner(i, { active: e.target.checked })} className="accent-burgundy-600" /> Active
              </label>
              <button type="button" className="text-danger-600" onClick={() => setC({ ...c, banners: c.banners.filter((_, k) => k !== i) })}>
                Delete
              </button>
            </div>
          </div>
        ))}
        <Button size="sm" variant="secondary" type="button" onClick={() => setC({ ...c, banners: [...c.banners, { id: uid(), title: "New banner", active: false }] })}>
          + Banner
        </Button>
      </Card>
      <Card className="space-y-3 p-4">
        <h2 className="font-semibold">Homepage collections</h2>
        <p className="text-xs text-ink-500">Each collection shows active products carrying its tag (set tags on the product page). Use these for seasonal collections.</p>
        {c.collections.map((col, i) => (
          <div key={col.id} className="grid gap-2 rounded-xl border border-cream-200 p-3 sm:grid-cols-4">
            <Field label="Title">
              <Input value={col.title} onChange={(e) => setCol(i, { title: e.target.value })} />
            </Field>
            <Field label="Subtitle">
              <Input value={col.subtitle ?? ""} onChange={(e) => setCol(i, { subtitle: e.target.value })} />
            </Field>
            <Field label="Product tag">
              <Input value={col.tag} onChange={(e) => setCol(i, { tag: e.target.value.trim().toLowerCase() })} />
            </Field>
            <div className="flex items-end gap-4 pb-3 text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={col.active} onChange={(e) => setCol(i, { active: e.target.checked })} className="accent-burgundy-600" /> Active
              </label>
              <button type="button" className="text-danger-600" onClick={() => setC({ ...c, collections: c.collections.filter((_, k) => k !== i) })}>
                Delete
              </button>
            </div>
          </div>
        ))}
        <Button size="sm" variant="secondary" type="button" onClick={() => setC({ ...c, collections: [...c.collections, { id: uid(), title: "New collection", tag: "", active: false }] })}>
          + Collection
        </Button>
      </Card>
      {msg && <Notice tone={msg.ok ? "good" : "bad"}>{msg.text}</Notice>}
      <Button
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await saveStorefrontDraft(JSON.stringify(c));
            setMsg(r.ok ? { ok: true, text: r.message ?? "Saved" } : { ok: false, text: r.error });
            router.refresh();
          })
        }
      >
        Save draft
      </Button>
    </div>
  );
}
