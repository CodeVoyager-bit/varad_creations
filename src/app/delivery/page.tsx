import { Suspense } from "react";
import { DeliveryHome } from "@/components/delivery-app";
import { EmptyState, PageLoading } from "@/components/ui";
import { plain } from "@/lib/db";
import { requirePartner } from "@/lib/session";
import { partnerHome, partnerView } from "@/server/delivery";
import { loadSettings } from "@/server/settings";
import { SignOutButton } from "@/components/sign-out";

export default function DeliveryPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <Home />
    </Suspense>
  );
}

async function Home() {
  const { user } = await requirePartner();
  const [data, s] = await Promise.all([partnerHome(user), loadSettings()]);
  const batches = (data?.batches ?? []).map((b) => ({
    id: b._id.toHexString(),
    code: b.code,
    status: b.status,
    stops: data!.orders.filter((o) => o.delivery.batchId?.equals(b._id)).map((o) => plain(partnerView(o))),
  }));
  return (
    <div className="space-y-4">
      {batches.length ? <DeliveryHome batches={batches} shopPhone={s.phone} /> : <EmptyState title="No deliveries assigned" body="When the shop assigns you a batch, it will appear here." />}
      <p className="flex items-center justify-between text-xs text-ink-500">
        Signed in as {user.name} {user.partnerType === "temporary" && "(temporary access)"}
        <SignOutButton />
      </p>
    </div>
  );
}
