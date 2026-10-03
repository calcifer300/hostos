"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import { getFleetsForUser, SELECTED_HOST_COOKIE } from "@/lib/host/context";

export interface SwitchFleetResult {
  ok: boolean;
  error?: string;
}

/**
 * Switches which fleet the signed-in user is viewing.
 *
 * Membership is re-checked here rather than trusting the id the client sent.
 * A server action is a public endpoint: without this, anyone could post an
 * arbitrary host_id and read another operator's fleet. The cookie is only ever
 * set to a fleet this session is actually a member of, and getCurrentHostId
 * validates it again on read.
 */
export async function switchFleet(hostId: string): Promise<SwitchFleetResult> {
  const session = await auth();
  const email = session?.user?.email ?? null;

  if (!email) {
    return { ok: false, error: "Sign in to switch fleets." };
  }

  const fleets = await getFleetsForUser(email);
  if (!fleets.some((f) => f.hostId === hostId)) {
    return { ok: false, error: "You don't have access to that fleet." };
  }

  const store = await cookies();
  store.set(SELECTED_HOST_COOKIE, hostId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  // Every surface is fleet-scoped, so the whole tree is stale after a switch.
  revalidatePath("/app", "layout");
  return { ok: true };
}
