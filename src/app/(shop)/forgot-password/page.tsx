import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/auth-forms";
import { AuthShell } from "@/components/auth-shell";

export const metadata: Metadata = { title: "Reset password", robots: { index: false } };

export default function ForgotPasswordPage() {
  return (
    <AuthShell title="Reset your password" subtitle="We'll send a one-time code to your registered mobile number.">
      <ForgotPasswordForm />
    </AuthShell>
  );
}
