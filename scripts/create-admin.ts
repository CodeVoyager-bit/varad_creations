/**
 * Creates the first admin (the owner) or promotes nothing — it only creates new accounts.
 *
 *   npm run admin:create -- --name "Owner Name" --phone 98XXXXXXXX
 *
 * The password is read from ADMIN_PASSWORD or prompted. After the first sign-in the admin
 * must enrol an authenticator app (two-factor) before the admin portal opens.
 */
import { createInterface } from "node:readline/promises";
import { client, ensureIndexes } from "@/lib/db";
import { createPhoneUser } from "@/server/users";

function arg(name: string) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

async function main() {
  const name = arg("name");
  const phone = arg("phone");
  if (!name || !phone) throw new Error('Usage: npm run admin:create -- --name "Owner" --phone 98XXXXXXXX');
  let password = process.env.ADMIN_PASSWORD;
  if (!password) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    password = await rl.question("Password (min 12 characters): ");
    rl.close();
  }
  if (password.length < 12) throw new Error("Admin password must be at least 12 characters.");
  await ensureIndexes();
  const u = await createPhoneUser({ name, phone, password, role: "admin" });
  console.log(`Admin created: ${u.name} (${u.id}). Sign in at /login, then set up two-factor at /admin/security.`);
}

main()
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(() => client.close());
