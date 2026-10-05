"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FileSpreadsheet, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { NativeSelect } from "@/components/ui/input";
import { guessColumnMapping, parseFile, type ParsedFile } from "@/lib/restaurants/parse";
import { saveMenuUpload } from "@/lib/actions/restaurants";
import { CANONICAL_FIELDS, CANONICAL_FIELD_LABELS, type ColumnMapping, type MenuUploadSummary, type UploadSource } from "@/lib/restaurants/types";
import { cn, formatRelativeTime } from "@/lib/utils";

const SOURCE_COPY: Record<UploadSource, { title: string; hint: string }> = {
  pos: { title: "POS export", hint: "Inventory or menu export from NRS, Square, Clover, Toast…" },
  doordash: { title: "DoorDash export", hint: "Menu / item export from the Merchant Portal" },
};

const NONE = "__none__";

function ColumnMapperDialog({
  open,
  onOpenChange,
  fileName,
  parsed,
  initialMapping,
  onConfirm,
  pending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fileName: string;
  parsed: ParsedFile;
  initialMapping: ColumnMapping;
  onConfirm: (mapping: ColumnMapping) => void;
  pending: boolean;
}) {
  const [mapping, setMapping] = React.useState<ColumnMapping>(initialMapping);
  const preview = parsed.rows.slice(0, 3);
  const missingName = !mapping.name;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="xl">
        <DialogHeader>
          <DialogTitle>Map columns — {fileName}</DialogTitle>
          <DialogDescription>
            Columns were auto-detected from the headers. Fix anything that looks wrong; only the item name is required.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {CANONICAL_FIELDS.map((field) => (
              <label key={field} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background/40 px-3 py-2">
                <span className="text-[13px] font-medium">
                  {CANONICAL_FIELD_LABELS[field]}
                  {field === "name" && <span className="text-danger"> *</span>}
                </span>
                <NativeSelect
                  className="h-8 w-[55%] text-[12.5px]"
                  value={mapping[field] ?? NONE}
                  onChange={(e) => setMapping((m) => ({ ...m, [field]: e.target.value === NONE ? undefined : e.target.value }))}
                >
                  <option value={NONE}>Not in file</option>
                  {parsed.headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </NativeSelect>
              </label>
            ))}
          </div>

          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Preview (first 3 rows)</p>
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-[12px]">
                <thead className="bg-muted/50 text-left text-muted-foreground">
                  <tr>
                    {CANONICAL_FIELDS.map((f) => (
                      <th key={f} className="whitespace-nowrap px-3 py-2 font-medium">
                        {CANONICAL_FIELD_LABELS[f]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.map((row, i) => (
                    <tr key={i} className="border-t border-border">
                      {CANONICAL_FIELDS.map((f) => (
                        <td key={f} className="max-w-[180px] truncate px-3 py-2">
                          {mapping[f] ? row[mapping[f]!] : <span className="text-muted-foreground/50">—</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </DialogBody>
        <DialogFooter>
          <span className="mr-auto text-[12px] text-muted-foreground">{parsed.rows.length.toLocaleString()} rows</span>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="primary" disabled={missingName} loading={pending} onClick={() => onConfirm(mapping)}>
            Save upload
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function UploadCard({
  restaurantId,
  source,
  latest,
  canEdit,
}: {
  restaurantId: string;
  source: UploadSource;
  latest: MenuUploadSummary | null;
  canEdit: boolean;
}) {
  const router = useRouter();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [pending, setPending] = React.useState<{ fileName: string; parsed: ParsedFile } | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [saving, startSave] = React.useTransition();
  const [dragging, setDragging] = React.useState(false);
  const copy = SOURCE_COPY[source];

  async function handleFile(file: File) {
    setBusy(true);
    try {
      const parsed = await parseFile(file);
      if (parsed.rows.length === 0) {
        toast.error("No rows found in that file.");
        return;
      }
      setPending({ fileName: file.name, parsed });
    } catch {
      toast.error("Couldn't read that file. Make sure it's a CSV or Excel export.");
    } finally {
      setBusy(false);
    }
  }

  function confirm(mapping: ColumnMapping) {
    if (!pending) return;
    startSave(async () => {
      const result = await saveMenuUpload({
        restaurantId,
        source,
        fileName: pending.fileName,
        headers: pending.parsed.headers,
        mapping,
        rows: pending.parsed.rows,
      });
      if (!result.ok) {
        toast.error(result.error ?? "Couldn't save the upload.");
        return;
      }
      toast.success(`${copy.title} saved (${pending.parsed.rows.length.toLocaleString()} items)`);
      setPending(null);
      router.refresh();
    });
  }

  return (
    <>
      <Card
        padding="md"
        className={cn("transition-colors", dragging && "border-accent/60 bg-accent/5")}
        onDragOver={(e) => {
          e.preventDefault();
          if (canEdit) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files?.[0];
          if (file && canEdit) void handleFile(file);
        }}
      >
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
            <FileSpreadsheet className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-semibold tracking-tight">{copy.title}</p>
            <p className="text-[12px] text-muted-foreground">{copy.hint}</p>
            {latest ? (
              <p className="mt-2 truncate text-[12.5px]">
                <span className="font-medium">{latest.fileName}</span>
                <span className="text-muted-foreground"> · {latest.rowCount.toLocaleString()} items · {formatRelativeTime(latest.uploadedAt)}</span>
              </p>
            ) : (
              <p className="mt-2 text-[12.5px] text-muted-foreground">Nothing uploaded yet.</p>
            )}
          </div>
        </div>
        {canEdit && (
          <div className="mt-4 flex items-center gap-2">
            <input
              ref={inputRef}
              type="file"
              accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleFile(f);
                e.currentTarget.value = "";
              }}
            />
            <Button variant="secondary" size="sm" loading={busy} onClick={() => inputRef.current?.click()}>
              <UploadCloud /> {latest ? "Upload a newer export" : "Upload export"}
            </Button>
            <span className="text-[11.5px] text-muted-foreground">or drop a CSV / XLSX here</span>
          </div>
        )}
      </Card>

      {pending && (
        <ColumnMapperDialog
          open
          onOpenChange={(o) => !o && setPending(null)}
          fileName={pending.fileName}
          parsed={pending.parsed}
          initialMapping={guessColumnMapping(pending.parsed.headers)}
          onConfirm={confirm}
          pending={saving}
        />
      )}
    </>
  );
}
