import { ObjectId } from "mongodb";
import { connection } from "next/server";
import { getSession } from "@/lib/session";
import { audit } from "@/server/core";
import { readPrivateFile, verifyFileSig } from "@/server/storage";

/** Payment evidence: needs a valid short-lived signature AND an admin session (or the uploader). */
export async function GET(req: Request, { params }: RouteContext<"/api/files/[id]">) {
  await connection();
  const { id } = await params;
  const sp = new URL(req.url).searchParams;
  const deny = () => new Response("Not found", { status: 404, headers: { "Cache-Control": "private, no-store" } });
  if (!ObjectId.isValid(id) || !verifyFileSig(id, sp.get("exp") ?? "", sp.get("sig") ?? "")) return deny();
  const session = await getSession();
  if (!session) return deny();
  const f = await readPrivateFile(id);
  if (!f) return deny();
  const isAdmin = session.user.role === "admin";
  if (!isAdmin && f.ownerId !== session.user.id) return deny();
  if (isAdmin) await audit({ id: session.user.id, role: "admin", name: session.user.name }, "file.view", "payment_proof", id);
  return new Response(new Uint8Array(f.buf), {
    headers: {
      "Content-Type": f.contentType,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; img-src 'self'",
      "Content-Disposition": "inline",
    },
  });
}
