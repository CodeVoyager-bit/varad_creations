import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ObjectId } from "mongodb";
import { BillDoc } from "@/components/bill-doc";
import { PageLoading } from "@/components/ui";
import { C, plain } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { loadSettings } from "@/server/settings";

export const metadata: Metadata = { title: "Bill", robots: { index: false } };

export default function BillPage(props: PageProps<"/orders/[id]/bill">) {
  return (
    <div className="px-4 py-4">
      <Suspense fallback={<PageLoading />}>
        <Content {...props} />
      </Suspense>
    </div>
  );
}

async function Content({ params }: PageProps<"/orders/[id]/bill">) {
  const { id } = await params;
  const user = await requireUser(`/orders/${id}/bill`);
  const o = ObjectId.isValid(id) ? await C.orders.findOne({ _id: new ObjectId(id), userId: user.id }) : null;
  if (!o || o.status === "placed") notFound();
  return <BillDoc o={plain(o)} s={await loadSettings()} />;
}
