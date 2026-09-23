"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Copy, FileText, Plus, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input, Label, NativeSelect } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { removeReplyTemplate, saveReplyTemplate, seedDefaultTemplates } from "@/lib/actions/workspace";
import type { ReplyTemplate } from "@/lib/templates/queries";

const CATEGORY_LABEL: Record<string, string> = {
  check_in: "Check-in",
  in_trip: "In trip",
  return: "Return",
  post_trip: "Post-trip",
  host_report: "Owner report",
  customer: "Customer",
  other: "Other",
};

const PLACEHOLDERS = ["{GUEST_NAME}", "{VEHICLE}", "{PLATE}", "{PICKUP_LOCATION}", "{RETURN_LOCATION}", "{START_TIME}", "{END_TIME}", "{HOST_NAME}"];

function TemplateDialog({ open, onOpenChange, template }: { open: boolean; onOpenChange: (o: boolean) => void; template: ReplyTemplate | null }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await saveReplyTemplate({
        id: template?.id,
        module: String(fd.get("module") ?? "other") as "fleet" | "restaurants" | "other",
        title: String(fd.get("title") ?? ""),
        category: String(fd.get("category") ?? "other"),
        triggers: String(fd.get("triggers") ?? ""),
        body: String(fd.get("body") ?? ""),
      });
      if (!result.ok) return void toast.error(result.error ?? "Couldn't save.");
      toast.success(template ? "Template updated" : "Template added");
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <form onSubmit={submit} className="flex min-h-0 flex-col">
          <DialogHeader>
            <DialogTitle>{template ? "Edit template" : "New reply template"}</DialogTitle>
            <DialogDescription>Shared with everyone on the workspace, offered by the Companion, and read by the Butler when it drafts.</DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="space-y-1.5 sm:col-span-3">
                <Label htmlFor="tpl-title">Title</Label>
                <Input id="tpl-title" name="title" defaultValue={template?.title ?? ""} required autoFocus />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tpl-module">Module</Label>
                <NativeSelect id="tpl-module" name="module" defaultValue={template?.module ?? "fleet"}>
                  <option value="fleet">Fleet</option>
                  <option value="restaurants">Restaurants</option>
                  <option value="other">Any</option>
                </NativeSelect>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tpl-cat">Category</Label>
                <NativeSelect id="tpl-cat" name="category" defaultValue={template?.category ?? "other"}>
                  {Object.entries(CATEGORY_LABEL).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tpl-trig">Trigger phrases</Label>
                <Input id="tpl-trig" name="triggers" defaultValue={template?.triggers ?? ""} placeholder="lockbox code, where is the key" />
              </div>
              <div className="space-y-1.5 sm:col-span-3">
                <Label htmlFor="tpl-body">Body</Label>
                <Textarea id="tpl-body" name="body" rows={8} defaultValue={template?.body ?? ""} required />
                <p className="text-[11.5px] text-muted-foreground">Placeholders: {PLACEHOLDERS.join(" ")}</p>
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={pending}>
              Save template
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function TemplatesEditor({ templates, canEdit }: { templates: ReplyTemplate[]; canEdit: boolean }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<ReplyTemplate | null>(null);
  const [pending, startTransition] = React.useTransition();

  function seed() {
    startTransition(async () => {
      const result = await seedDefaultTemplates();
      if (!result.ok) return void toast.error(result.error ?? "Couldn't add templates.");
      toast.success(`${result.added} starter templates added`);
      router.refresh();
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      const result = await removeReplyTemplate(id);
      if (!result.ok) return void toast.error(result.error ?? "Couldn't delete.");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13px] text-muted-foreground">{templates.length} templates · used by the Companion&rsquo;s saved replies and the Butler&rsquo;s drafts.</p>
        {canEdit && (
          <div className="flex gap-2">
            {templates.length === 0 && (
              <Button variant="secondary" size="sm" onClick={seed} loading={pending}>
                <Sparkles className="text-accent" /> Add starter templates
              </Button>
            )}
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setEditing(null);
                setOpen(true);
              }}
            >
              <Plus /> New template
            </Button>
          </div>
        )}
      </div>

      {templates.length === 0 ? (
        <Card variant="dashed" padding="lg" className="text-center text-[13px] text-muted-foreground">
          No templates yet. Add the starter set — check-in, return, review and customer replies — then make them yours.
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {templates.map((t) => (
            <Card key={t.id} padding="md" className="flex flex-col">
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <p className="truncate text-[13.5px] font-semibold">{t.title}</p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Badge variant="neutral" className="capitalize">{t.module}</Badge>
                  <Badge variant="accent">{CATEGORY_LABEL[t.category] ?? t.category}</Badge>
                </div>
              </div>
              <p className="mt-2 line-clamp-4 whitespace-pre-wrap text-[12.5px] leading-relaxed text-muted-foreground">{t.body}</p>
              {t.triggers && <p className="mt-2 text-[11px] text-muted-foreground/80">Triggers: {t.triggers}</p>}
              <div className="mt-3 flex gap-1 border-t border-border pt-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    void navigator.clipboard.writeText(t.body);
                    toast.success("Copied");
                  }}
                >
                  <Copy /> Copy
                </Button>
                {canEdit && (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditing(t);
                        setOpen(true);
                      }}
                    >
                      Edit
                    </Button>
                    <Button variant="ghost" size="icon-sm" className="ml-auto" aria-label="Delete" disabled={pending} onClick={() => remove(t.id)}>
                      <Trash2 />
                    </Button>
                  </>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      <TemplateDialog open={open} onOpenChange={setOpen} template={editing} />
    </div>
  );
}
