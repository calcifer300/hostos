"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { createProposal } from "@/lib/actions/proposals";

/**
 * A new proposal takes four facts about the client; everything else starts
 * from the house story and is edited afterwards.
 */
export function NewProposalButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [form, setForm] = useState({ clientCompany: "", clientContact: "", clientEmail: "", industry: "" });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.clientCompany.trim()) {
      toast.error("Name the client company.");
      return;
    }
    start(async () => {
      const result = await createProposal(form);
      if (result.ok && result.id) {
        toast.success("Proposal created from the house story.");
        setOpen(false);
        setForm({ clientCompany: "", clientContact: "", clientEmail: "", industry: "" });
        router.push(`/app/proposals/${result.id}`);
      } else {
        toast.error(result.error ?? "Could not create the proposal.");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="gradient" size="lg">
          <Plus /> New proposal
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New client proposal</DialogTitle>
          <DialogDescription>It starts from the full HostOS story. Everything — pricing, case studies, branding — is editable afterwards.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4 pt-2">
          <Field label="Client company" required>
            <Input value={form.clientCompany} onChange={set("clientCompany")} placeholder="Cedar Park Auto Glass" autoFocus />
          </Field>
          <Field label="Contact name">
            <Input value={form.clientContact} onChange={set("clientContact")} placeholder="Dana Whitfield" />
          </Field>
          <Field label="Contact email">
            <Input type="email" value={form.clientEmail} onChange={set("clientEmail")} placeholder="dana@example.com" />
          </Field>
          <Field label="Industry">
            <Input value={form.industry} onChange={set("industry")} placeholder="Home services" />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={pending}>
              Create proposal
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block font-mono text-[10.5px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
        {required && <span className="ml-1 text-danger">*</span>}
      </span>
      {children}
    </label>
  );
}
