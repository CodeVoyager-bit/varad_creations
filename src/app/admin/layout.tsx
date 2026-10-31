import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminNav } from "@/components/admin-nav";
import { PageLoading } from "@/components/ui";

export const metadata: Metadata = { title: { default: "Admin", template: "%s · Admin" }, robots: { index: false, follow: false } };

// private, per-request pages: blocking navigation is fine and nothing here belongs in a static shell
export const instant = false;

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-cream-100 md:flex">
      <Suspense>
        <AdminNav />
      </Suspense>
      <main className="min-w-0 flex-1 px-4 pb-16 pt-4 md:px-8">
        <Suspense fallback={<PageLoading />}>{children}</Suspense>
      </main>
    </div>
  );
}
