"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { decideAccess } from "@/lib/actions/access";
import type { AccessRequest } from "@/lib/access-requests";

/** Who asked to get in, and the two buttons that answer them. */
export function AccessRequests({ requests }: { requests: AccessRequest[] }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const decide = (id: string, status: "approved" | "denied") => start(async () => { const r = await decideAccess(id, status); if (!r.ok) return void toast.error(r.error ?? "Couldn't save."); toast.success(status === "approved" ? "Approved — they can sign in with Google now" : "Denied"); router.refresh(); });
  const open = requests.filter((r) => r.status === "pending");
  const decided = requests.filter((r) => r.status !== "pending");
  return (
    <Card padding="md">
      <p className="text-[13px] font-semibold">Access requests</p>
      <p className="mt-0.5 text-[12.5px] text-muted-foreground">HostOS is by invitation. People who ask on the sign-in page appear here; approve one and their Google account opens the app.</p>
      {open.length === 0 && <p className="mt-4 text-[13px] text-muted-foreground">Nothing waiting.</p>}
      <ul className="mt-4 space-y-2">
        {open.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-3">
            <div className="min-w-0"><p className="text-[13.5px] font-semibold">{r.name} <span className="font-mono text-[12px] font-normal text-muted-foreground">{r.email}</span></p><p className="text-[12.5px] text-muted-foreground">{r.business || "—"}{r.message ? ` · ${r.message}` : ""}</p></div>
            <div className="flex gap-2"><Button size="sm" variant="primary" disabled={pending} onClick={() => decide(r.id, "approved")}>Approve</Button><Button size="sm" variant="ghost" disabled={pending} onClick={() => decide(r.id, "denied")}>Deny</Button></div>
          </li>
        ))}
      </ul>
      {decided.length > 0 && (
        <details className="mt-4"><summary className="cursor-pointer text-[12px] text-muted-foreground">Decided · {decided.length}</summary>
          <ul className="mt-2 space-y-1 text-[12.5px] text-muted-foreground">{decided.map((r) => <li key={r.id} className="flex justify-between gap-3"><span>{r.name} · <span className="font-mono">{r.email}</span></span><span className={r.status === "approved" ? "text-success" : ""}>{r.status}{r.status === "denied" && <button className="ml-2 underline" disabled={pending} onClick={() => decide(r.id, "approved")}>approve</button>}</span></li>)}</ul>
        </details>
      )}
    </Card>
  );
}
