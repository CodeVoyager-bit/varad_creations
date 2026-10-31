"use client";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export function SignOutButton() {
  const router = useRouter();
  return (
    <button
      className="font-semibold text-burgundy-700"
      onClick={async () => {
        await authClient.signOut();
        router.replace("/login");
      }}
    >
      Sign out
    </button>
  );
}
