"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { GitCompareArrows, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/input";
import { UploadCard } from "@/components/restaurants/upload-card";
import { ComparisonResults } from "@/components/restaurants/comparison-results";
import { runComparison } from "@/lib/actions/restaurants";
import type { Comparison, MenuUploadSummary, Restaurant } from "@/lib/restaurants/types";
import { formatRelativeTime } from "@/lib/utils";

export function MenuSync({
  restaurant,
  uploads,
  comparisons,
  active,
  canEdit,
}: {
  restaurant: Restaurant;
  uploads: MenuUploadSummary[];
  comparisons: Omit<Comparison, "rows">[];
  /** The comparison currently displayed (latest by default, or one picked from history). */
  active: Comparison | null;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  const posUploads = uploads.filter((u) => u.source === "pos");
  const ddUploads = uploads.filter((u) => u.source === "doordash");
  const [posChoice, setPosId] = React.useState("");
  const [ddChoice, setDdId] = React.useState("");
  // Newest upload by default; an explicit choice wins once made.
  const posId = posUploads.some((u) => u.id === posChoice) ? posChoice : posUploads[0]?.id ?? "";
  const ddId = ddUploads.some((u) => u.id === ddChoice) ? ddChoice : ddUploads[0]?.id ?? "";

  function compare() {
    startTransition(async () => {
      const result = await runComparison(restaurant.id, posId, ddId);
      if (!result.ok) {
        toast.error(result.error ?? "Comparison failed.");
        return;
      }
      toast.success("Comparison complete");
      router.push(`?tab=menu&comparison=${result.id}`);
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <UploadCard restaurantId={restaurant.id} source="pos" latest={posUploads[0] ?? null} canEdit={canEdit} />
        <UploadCard restaurantId={restaurant.id} source="doordash" latest={ddUploads[0] ?? null} canEdit={canEdit} />
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
        <div className="min-w-[200px] flex-1 space-y-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">POS export</p>
          <NativeSelect value={posId} onChange={(e) => setPosId(e.target.value)} disabled={posUploads.length === 0}>
            {posUploads.length === 0 && <option value="">Upload a POS export first</option>}
            {posUploads.map((u) => (
              <option key={u.id} value={u.id}>
                {u.fileName} · {formatRelativeTime(u.uploadedAt)}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="min-w-[200px] flex-1 space-y-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">DoorDash export</p>
          <NativeSelect value={ddId} onChange={(e) => setDdId(e.target.value)} disabled={ddUploads.length === 0}>
            {ddUploads.length === 0 && <option value="">Upload a DoorDash export first</option>}
            {ddUploads.map((u) => (
              <option key={u.id} value={u.id}>
                {u.fileName} · {formatRelativeTime(u.uploadedAt)}
              </option>
            ))}
          </NativeSelect>
        </div>
        <Button variant="primary" onClick={compare} disabled={!canEdit || !posId || !ddId} loading={pending}>
          <GitCompareArrows /> Compare menus
        </Button>
      </div>

      {active ? (
        <ComparisonResults comparison={active} restaurantId={restaurant.id} restaurantName={restaurant.name} canEdit={canEdit} />
      ) : (
        <p className="rounded-2xl border border-dashed border-border px-5 py-8 text-center text-[13px] text-muted-foreground">
          Upload both exports and run a comparison to see what needs updating on DoorDash.
        </p>
      )}

      {comparisons.length > 1 && (
        <div className="rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]">
          <div className="flex items-center gap-2 border-b border-border px-5 py-3">
            <History className="h-4 w-4 text-muted-foreground" />
            <p className="text-[13px] font-semibold">History</p>
          </div>
          <ul className="divide-y divide-border">
            {comparisons.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => router.push(`?tab=menu&comparison=${c.id}`)}
                  className={`flex w-full items-center justify-between gap-3 px-5 py-3 text-left text-[13px] transition-colors hover:bg-muted/50 ${active?.id === c.id ? "bg-muted/40" : ""}`}
                >
                  <span>
                    <span className="font-medium">{formatRelativeTime(c.createdAt)}</span>
                    <span className="text-muted-foreground"> · {c.summary.total} items · {c.summary.needsUpdate} need updates · {c.summary.missingOnDoordash} missing</span>
                  </span>
                  <span className="text-[12px] text-muted-foreground">{c.createdBy ?? ""}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
