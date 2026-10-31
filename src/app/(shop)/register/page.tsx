import type { Metadata } from "next";
import { Suspense } from "react";
import { RegisterForm } from "@/components/auth-forms";
import { AuthShell } from "@/components/auth-shell";

export const metadata: Metadata = { title: "Create account", robots: { index: false } };

export default function RegisterPage() {
  return (
    <AuthShell title="Create your account" subtitle="Your cart stays as it is while you sign up.">
      <Suspense>
        <RegisterForm />
      </Suspense>
    </AuthShell>
  );
}
