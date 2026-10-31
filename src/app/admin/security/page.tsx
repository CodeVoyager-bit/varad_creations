import { Card, Notice } from "@/components/ui";
import { requireAdmin } from "@/lib/session";
import { TwoFactorSetup } from "@/components/two-factor-setup";

export const metadata = { title: "Security" };

export default async function Security() {
  const user = await requireAdmin({ allowSetup: true });
  return (
    <div className="mx-auto max-w-xl space-y-4">
      <h1 className="font-display text-2xl font-semibold text-burgundy-700">Admin security</h1>
      {!user.twoFactorEnabled && <Notice tone="warn">Admin accounts must use an authenticator app. Set it up to open the admin portal.</Notice>}
      <Card className="p-4">
        <TwoFactorSetup enabled={!!user.twoFactorEnabled} />
      </Card>
      <p className="text-sm text-ink-500">Admin sessions expire after 12 hours. Every admin change is recorded in the audit log.</p>
    </div>
  );
}
