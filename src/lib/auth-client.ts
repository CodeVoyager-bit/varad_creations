"use client";
import { createAuthClient } from "better-auth/react";
import { inferAdditionalFields, phoneNumberClient, twoFactorClient } from "better-auth/client/plugins";
import type { auth } from "./auth";

export const authClient = createAuthClient({
  plugins: [phoneNumberClient(), twoFactorClient(), inferAdditionalFields<typeof auth>()],
});
