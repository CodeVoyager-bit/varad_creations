import { requireAdmin } from "@/lib/session";
import { audit } from "@/server/core";
import { exportCsv, range } from "@/server/reports";

export async function GET(req: Request) {
  const user = await requireAdmin();
  const sp = Object.fromEntries(new URL(req.url).searchParams);
  const { from, to } = range(sp);
  const type = ["orders", "payments", "stock"].includes(sp.type) ? sp.type : "orders";
  await audit({ id: user.id, role: "admin", name: user.name }, "report.export", "report", type, `${from.toISOString()}..${to.toISOString()}`);
  return new Response(await exportCsv(type, from, to), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="varad-${type}-${from.toISOString().slice(0, 10)}.csv"`, "Cache-Control": "private, no-store" },
  });
}
