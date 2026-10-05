"use client";

import * as React from "react";
import { requestAccess } from "@/lib/actions/access";

/** The sign-in page when the door is closed: a stranger says who they are; the Founder decides. */
export function RequestAccess({ email }: { email?: string | null }) {
  const [state, setState] = React.useState<"idle" | "busy" | "sent" | "error">("idle");
  const [error, setError] = React.useState("");
  return state === "sent" ? (
    <p className="mt-4 rounded-xl border border-border bg-background px-3 py-3 text-[13px] leading-relaxed">Thanks — your request is with the Founder. You’ll get an email once your Google account is switched on, usually within one working day.</p>
  ) : (
    <form className="mt-4 space-y-2" onSubmit={async (e) => { e.preventDefault(); setState("busy"); const r = await requestAccess(new FormData(e.currentTarget)); if (r.ok) setState("sent"); else { setError(r.error ?? "Try again."); setState("error"); } }}>
      <p className="text-[13px] leading-relaxed text-muted-foreground">HostOS is by invitation. Tell us who you are and the Founder will open the door.</p>
      <input name="name" required placeholder="Your name" className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-[13.5px]" />
      <input name="email" type="email" required defaultValue={email ?? ""} placeholder="The Google email you’ll sign in with" className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-[13.5px]" />
      <input name="business" placeholder="Your business (e.g. 12-car Turo fleet in Austin)" className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-[13.5px]" />
      <textarea name="message" rows={2} placeholder="What you’d like HostOS to run" className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-[13.5px]" />
      {state === "error" && <p className="text-[12.5px] text-danger">{error}</p>}
      <button type="submit" disabled={state === "busy"} className="w-full rounded-full bg-accent px-6 py-3 text-[14px] font-semibold text-white transition hover:opacity-90 disabled:opacity-60">{state === "busy" ? "Sending…" : "Request access"}</button>
    </form>
  );
}
