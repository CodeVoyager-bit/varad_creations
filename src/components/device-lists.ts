"use client";
import { useSyncExternalStore } from "react";

/**
 * Small per-device lists of product ids (saved items, recently viewed), kept in localStorage
 * like the cart. Nothing is sent to the server, so no sign-in is needed.
 */
function listStore(key: string, max: number) {
  let ids: string[] = [];
  let loaded = false;
  const subs = new Set<() => void>();
  const load = () => {
    if (loaded || typeof window === "undefined") return;
    loaded = true;
    try {
      const raw = JSON.parse(localStorage.getItem(key) ?? "[]");
      if (Array.isArray(raw)) ids = raw.filter((x) => typeof x === "string").slice(0, max);
    } catch {
      /* blocked storage: list stays in memory */
    }
  };
  const save = (next: string[]) => {
    ids = next.slice(0, max);
    try {
      localStorage.setItem(key, JSON.stringify(ids));
    } catch {}
    subs.forEach((f) => f());
  };
  if (typeof window !== "undefined")
    window.addEventListener("storage", (e) => {
      if (e.key !== key) return;
      loaded = false;
      load();
      subs.forEach((f) => f());
    });
  const snapshot = () => (load(), ids);
  return {
    subscribe: (f: () => void) => (subs.add(f), () => void subs.delete(f)),
    snapshot,
    toggle: (id: string) => save(snapshot().includes(id) ? ids.filter((x) => x !== id) : [id, ...ids]),
    push: (id: string) => save([id, ...snapshot().filter((x) => x !== id)]),
  };
}

const NONE: string[] = [];
export const saved = listStore("vc-saved-v1", 100);
export const recent = listStore("vc-recent-v1", 12);
export const useSaved = () => useSyncExternalStore(saved.subscribe, saved.snapshot, () => NONE);
export const useRecent = () => useSyncExternalStore(recent.subscribe, recent.snapshot, () => NONE);
