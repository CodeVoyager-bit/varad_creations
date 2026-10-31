"use server";
import { updateTag } from "next/cache";
import { toPaise } from "@/lib/money";
import { requirePartner } from "@/lib/session";
import { AppError } from "@/server/core";
import { markDelivered, markFailed, pickUpBatch } from "@/server/delivery";
import { TAGS } from "@/server/storefront";

type R = { ok: true } | { ok: false; error: string };

/** Partner scope is re-derived from the session on every call; nothing from the client is trusted. */
async function run(fn: (u: Awaited<ReturnType<typeof requirePartner>>["user"]) => Promise<void>): Promise<R> {
  const { user } = await requirePartner();
  try {
    await fn(user);
    return { ok: true };
  } catch (e) {
    if (e instanceof AppError) return { ok: false, error: e.message };
    if (e instanceof Error && /Invalid amount/.test(e.message)) return { ok: false, error: "Enter the amount in rupees." };
    console.error("[delivery action]", (e as Error)?.message);
    return { ok: false, error: "Couldn't save. Check your connection and try again." };
  }
}

const actor = (u: { id: string; name: string }) => ({ id: u.id, role: "delivery" as const, name: u.name });

export async function startBatch(batchId: string) {
  return run((u) => pickUpBatch(u, batchId));
}

export async function deliver(orderId: string, fd: FormData) {
  return run(async (u) => {
    const method = String(fd.get("method") ?? "");
    const amount = String(fd.get("amount") ?? "");
    await markDelivered(actor(u), u, orderId, {
      confirm: fd.get("confirm") === "on",
      note: String(fd.get("note") ?? "") || undefined,
      cod: method ? { method: method === "upi" ? "upi" : "cash", amountPaise: toPaise(amount), reference: String(fd.get("reference") ?? "") || undefined } : undefined,
    });
    updateTag(TAGS.catalog);
  });
}

export async function failDelivery(orderId: string, fd: FormData) {
  return run((u) => markFailed(actor(u), u, orderId, String(fd.get("reason") ?? ""), String(fd.get("note") ?? "") || undefined));
}
