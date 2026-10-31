import { notFound } from "next/navigation";
import { ObjectId } from "mongodb";
import { BillDoc } from "@/components/bill-doc";
import { C, plain } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { loadSettings } from "@/server/settings";

export const metadata = { title: "Bill" };

export default async function AdminBill({ params }: PageProps<"/admin/orders/[id]/bill">) {
  await requireAdmin();
  const { id } = await params;
  const o = ObjectId.isValid(id) ? await C.orders.findOne({ _id: new ObjectId(id) }) : null;
  if (!o) notFound();
  return <BillDoc o={plain(o)} s={await loadSettings()} />;
}
