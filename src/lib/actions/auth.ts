"use server";

import { signIn, signOut } from "@/auth";

export async function googleSignIn() {
  await signIn("google", { redirectTo: "/" });
}

export async function userSignOut() {
  await signOut({ redirectTo: "/login" });
}
