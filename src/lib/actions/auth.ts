"use server";

import { signIn, signOut } from "@/auth";
import { routes, safeAppRedirect } from "@/lib/routes";

/**
 * Starts Google sign-in. `callbackUrl` is the deep link middleware captured
 * when it bounced a signed-out visitor, so they land where they were aimed —
 * validated to a product path, never an arbitrary URL.
 */
export async function googleSignIn(formData?: FormData) {
  const raw = formData?.get("callbackUrl");
  const redirectTo = safeAppRedirect(typeof raw === "string" ? raw : null);
  await signIn("google", { redirectTo });
}

export async function userSignOut() {
  await signOut({ redirectTo: routes.home });
}
