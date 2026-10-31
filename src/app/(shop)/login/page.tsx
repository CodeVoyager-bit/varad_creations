import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "@/components/auth-forms";
import { AuthShell } from "@/components/auth-shell";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

export default function LoginPage() {
  return (
    <AuthShell title="Sign in" subtitle="Use your mobile number and password.">
      <Suspense>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
