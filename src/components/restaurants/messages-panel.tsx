"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MessageSquareText, Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { logRestaurantMessage } from "@/lib/actions/restaurants";
import { draftRestaurantReply } from "@/lib/actions/butler";
import type { RestaurantMessage } from "@/lib/restaurants/types";
import { cn, formatRelativeTime } from "@/lib/utils";

/**
 * Customer conversations for one store. The Companion fills this from the
 * merchant portal when it can; a person can also log a message by hand and
 * ask the Butler for a grounded reply before sending it on DoorDash.
 */
export function MessagesPanel({
  restaurantId,
  messages,
  canEdit,
}: {
  restaurantId: string;
  messages: RestaurantMessage[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [drafting, startDraft] = React.useTransition();
  const [customer, setCustomer] = React.useState("");
  const [body, setBody] = React.useState("");
  const [fromStore, setFromStore] = React.useState(false);
  const [draft, setDraft] = React.useState<{ text: string; sources: string[]; escalate: boolean } | null>(null);

  const threads = React.useMemo(() => {
    const map = new Map<string, RestaurantMessage[]>();
    for (const m of messages) {
      const key = m.customerName ?? "Unknown customer";
      map.set(key, [...(map.get(key) ?? []), m]);
    }
    return Array.from(map.entries());
  }, [messages]);

  function log() {
    startTransition(async () => {
      const result = await logRestaurantMessage({ restaurantId, body, customerName: customer, fromStore });
      if (!result.ok) {
        toast.error(result.error ?? "Couldn't save the message.");
        return;
      }
      setBody("");
      setDraft(null);
      toast.success("Message logged");
      router.refresh();
    });
  }

  function askButler() {
    const lastInbound = messages.find((m) => !m.fromStore && (!customer || m.customerName === customer));
    const source = body.trim() || lastInbound?.body;
    if (!source) {
      toast.error("Paste the customer's message first.");
      return;
    }
    startDraft(async () => {
      const result = await draftRestaurantReply({ restaurantId, message: source, customerName: customer || lastInbound?.customerName || null });
      if (!result.ok) {
        toast.error(result.error ?? "The Butler couldn't draft that.");
        return;
      }
      setDraft({ text: result.draft, sources: result.sources, escalate: result.escalate });
    });
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.2fr_1fr]">
      <Card>
        <div className="flex items-center gap-2 border-b border-border px-5 py-3">
          <MessageSquareText className="h-4 w-4 text-muted-foreground" />
          <p className="text-[13px] font-semibold">Conversations</p>
          <span className="ml-auto text-[12px] text-muted-foreground">{messages.length} messages</span>
        </div>
        {threads.length === 0 ? (
          <p className="px-5 py-10 text-center text-[13px] text-muted-foreground">
            No messages yet. The Companion captures DoorDash chat when it&rsquo;s open on the Merchant Portal; you can also log one on the right.
          </p>
        ) : (
          <div className="divide-y divide-border">
            {threads.map(([name, list]) => (
              <div key={name} className="px-5 py-4">
                <p className="mb-2 text-[13px] font-semibold">{name}</p>
                <div className="space-y-2">
                  {list.slice(0, 6).map((m) => (
                    <div key={m.id} className={cn("flex", m.fromStore ? "justify-end" : "justify-start")}>
                      <div
                        className={cn(
                          "max-w-[85%] rounded-2xl px-3.5 py-2 text-[12.5px] leading-relaxed",
                          m.fromStore ? "bg-accent text-accent-foreground" : "bg-muted text-foreground"
                        )}
                      >
                        <p className="whitespace-pre-wrap">{m.body}</p>
                        <p className={cn("mt-1 text-[10.5px]", m.fromStore ? "text-white/70" : "text-muted-foreground")}>
                          {m.fromStore ? "Store" : "Customer"} · {formatRelativeTime(m.sentAt)}
                          {m.orderExternalId ? ` · order ${m.orderExternalId}` : ""}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card padding="md" className="h-fit">
        <p className="text-[13px] font-semibold">Log a message</p>
        <p className="mt-1 text-[12px] text-muted-foreground">Paste what the customer wrote, or record what you sent. Ask the Butler for a reply grounded in your knowledge base.</p>
        <div className="mt-4 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="msg-customer">Customer</Label>
            <Input id="msg-customer" value={customer} onChange={(e) => setCustomer(e.target.value)} placeholder="Name as shown on DoorDash" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="msg-body">Message</Label>
            <Textarea id="msg-body" rows={4} value={body} onChange={(e) => setBody(e.target.value)} placeholder="“My order arrived without the drinks…”" />
          </div>
          <label className="flex items-center gap-2 text-[12.5px] text-muted-foreground">
            <input type="checkbox" checked={fromStore} onChange={(e) => setFromStore(e.target.checked)} className="h-3.5 w-3.5 accent-[var(--accent)]" />
            This is a message the store sent
          </label>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={askButler} loading={drafting}>
              <Sparkles className="text-accent" /> Draft a reply
            </Button>
            <Button variant="primary" size="sm" onClick={log} disabled={!canEdit || !body.trim()} loading={pending}>
              <Send /> Log message
            </Button>
          </div>
        </div>

        {draft && (
          <div className={cn("mt-4 rounded-xl border p-3.5", draft.escalate ? "border-warning/40 bg-warning-bg" : "border-accent/30 bg-accent/5")}>
            <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-accent">
              <Sparkles className="h-3 w-3" /> Butler draft
            </p>
            {draft.escalate && <p className="mb-2 text-[12px] font-medium text-warning">Flagged for a person to review before sending.</p>}
            <p className="whitespace-pre-wrap text-[13px] leading-relaxed">{draft.text}</p>
            {draft.sources.length > 0 && (
              <p className="mt-2 text-[11px] text-muted-foreground">Grounded in: {draft.sources.join(" · ")}</p>
            )}
            <div className="mt-3 flex gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setBody(draft.text);
                  setFromStore(true);
                }}
              >
                Use as store reply
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  void navigator.clipboard.writeText(draft.text);
                  toast.success("Copied");
                }}
              >
                Copy
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
