import { Card, Notice } from "@/components/ui";
import { ADMIN_REQUIRE_2FA, requireAdmin } from "@/lib/session";
import { TwoFactorSetup } from "@/components/two-factor-setup";

export const metadata = { title: "Security" };

export default async function Security() {
  const user = await requireAdmin({ allowSetup: true });
  return (
    <div className="mx-auto max-w-xl space-y-4">
      <h1 className="text-[1.75rem] font-semibold tracking-tight text-ink-900">Admin security</h1>
      {!user.twoFactorEnabled &&
        (ADMIN_REQUIRE_2FA ? (
          <Notice tone="warn">Admin accounts must use an authenticator app. Set it up to open the admin portal.</Notice>
        ) : (
          <Notice tone="info">
            Optional while you’re developing locally. On the live site every admin must set up an authenticator app (Google Authenticator, Microsoft Authenticator or similar) before the admin portal opens.
          </Notice>
        ))}
      <Card className="p-4">
        <TwoFactorSetup enabled={!!user.twoFactorEnabled} />
      </Card>
      <p className="text-sm text-ink-500">Admin sessions expire after 12 hours. Every admin change is recorded in the audit log.</p>
    </div>
  );
}
