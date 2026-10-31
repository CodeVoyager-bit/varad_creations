"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteAddress, updateProfile } from "@/app/actions/customer";
import { authClient } from "@/lib/auth-client";
import { AddressForm, type SavedAddress } from "./address-form";
import { SupportForm } from "./order-customer";
import { Button, Card, Field, Input, Notice } from "./ui";

export function AccountView({ user, addresses }: { user: { name: string; phone: string }; addresses: SavedAddress[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<SavedAddress | "new" | null>(null);
  const [name, setName] = useState(user.name);
  const [msg, setMsg] = useState<{ tone: "good" | "bad"; text: string } | null>(null);
  const [pending, start] = useTransition();
  const [pw, setPw] = useState({ current: "", next: "" });

  return (
    <div className="space-y-4">
      <Card className="space-y-3 p-4">
        <h2 className="font-semibold">Profile</h2>
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const r = await updateProfile(name);
              setMsg(r.ok ? { tone: "good", text: "Name updated." } : { tone: "bad", text: r.error });
              router.refresh();
            });
          }}
        >
          <Field label="Name" className="flex-1">
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required />
          </Field>
          <Button variant="secondary" disabled={pending || name === user.name}>
            Save
          </Button>
        </form>
        <p className="text-sm text-ink-500">Mobile: {user.phone}</p>
        {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
      </Card>

      <Card className="space-y-3 p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Saved addresses</h2>
          {!editing && (
            <Button size="sm" variant="ghost" onClick={() => setEditing("new")}>
              + Add
            </Button>
          )}
        </div>
        {editing ? (
          <AddressForm
            initial={editing === "new" ? undefined : editing}
            defaultName={user.name}
            defaultPhone={user.phone}
            onCancel={() => setEditing(null)}
            onSaved={() => {
              setEditing(null);
              router.refresh();
            }}
          />
        ) : addresses.length ? (
          <ul className="space-y-2">
            {addresses.map((a) => (
              <li key={a.id} className="flex items-start justify-between gap-3 rounded-xl border border-cream-200 p-3 text-sm">
                <span>
                  <b>{a.label}</b> · {a.name}, {a.phone}
                  <span className="block text-ink-700">
                    {a.flat}, {a.building}, {a.street}, {a.city} {a.pincode}
                  </span>
                </span>
                <span className="flex shrink-0 gap-2">
                  <button className="font-semibold text-burgundy-700" onClick={() => setEditing(a)}>
                    Edit
                  </button>
                  <button
                    className="font-semibold text-danger-600"
                    onClick={() =>
                      start(async () => {
                        await deleteAddress(a.id);
                        router.refresh();
                      })
                    }
                  >
                    Delete
                  </button>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ink-500">No saved addresses yet.</p>
        )}
      </Card>

      <Card className="space-y-3 p-4">
        <h2 className="font-semibold">Change password</h2>
        <form
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const r = await authClient.changePassword({ currentPassword: pw.current, newPassword: pw.next, revokeOtherSessions: true });
              setMsg(r.error ? { tone: "bad", text: "Current password is incorrect, or the new one is too short." } : { tone: "good", text: "Password changed. Other devices were signed out." });
              setPw({ current: "", next: "" });
            });
          }}
        >
          <Field label="Current password">
            <Input type="password" autoComplete="current-password" required value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} />
          </Field>
          <Field label="New password" hint="At least 8 characters.">
            <Input type="password" autoComplete="new-password" minLength={8} required value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} />
          </Field>
          <Button variant="secondary" disabled={pending} className="sm:col-span-2 sm:justify-self-start">
            Update password
          </Button>
        </form>
      </Card>

      <Card className="space-y-3 p-4">
        <h2 className="font-semibold">Help & privacy requests</h2>
        <SupportForm
          topics={[
            ["other", "General question or complaint"],
            ["payment", "Payment or refund question"],
            ["account_deletion", "Delete my account and personal data"],
          ]}
        />
      </Card>

      <Button
        variant="ghost"
        onClick={() =>
          start(async () => {
            await authClient.signOut();
            router.replace("/");
            router.refresh();
          })
        }
      >
        Sign out
      </Button>
    </div>
  );
}
