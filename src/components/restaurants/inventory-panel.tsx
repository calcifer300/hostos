"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Barcode, Package, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { deleteInventoryItem, upsertInventoryItem } from "@/lib/actions/restaurants";
import { generateUpcFromName } from "@/lib/restaurants/upc";
import type { InventoryItem } from "@/lib/restaurants/types";
import { formatMoney } from "@/lib/restaurants/analytics";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";

function ItemDialog({
  restaurantId,
  item,
  open,
  onOpenChange,
  defaultThreshold,
}: {
  restaurantId: string;
  item: InventoryItem | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  defaultThreshold: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  // Remounted per item by the key below, so initial state is the item's.
  const [name, setName] = React.useState(item?.name ?? "");
  const [sku, setSku] = React.useState(item?.sku ?? "");
  const [available, setAvailable] = React.useState(item?.available ?? true);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const num = (k: string) => {
      const v = String(fd.get(k) ?? "").trim();
      return v === "" ? null : Number(v);
    };
    startTransition(async () => {
      const result = await upsertInventoryItem({
        restaurantId,
        id: item?.id,
        name,
        sku,
        category: String(fd.get("category") ?? ""),
        price: num("price"),
        quantity: num("quantity"),
        available,
        lowStockThreshold: num("threshold"),
      });
      if (!result.ok) {
        toast.error(result.error ?? "Couldn't save the item.");
        return;
      }
      toast.success(item ? "Item updated" : "Item added");
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>{item ? "Edit item" : "Add inventory item"}</DialogTitle>
            <DialogDescription>Tracked items raise a low-stock alert between exports.</DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="inv-name">Name</Label>
              <Input id="inv-name" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="inv-sku">SKU / UPC</Label>
                <div className="flex gap-1.5">
                  <Input id="inv-sku" value={sku} onChange={(e) => setSku(e.target.value)} placeholder="Optional" />
                  <Button type="button" variant="secondary" size="icon" aria-label="Generate a UPC from the name" onClick={() => name.trim() && setSku(generateUpcFromName(name))}>
                    <Barcode />
                  </Button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="inv-cat">Category</Label>
                <Input id="inv-cat" name="category" defaultValue={item?.category ?? ""} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="inv-price">Price</Label>
                <Input id="inv-price" name="price" type="number" step="0.01" min={0} defaultValue={item?.price ?? ""} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="inv-qty">Quantity on hand</Label>
                <Input id="inv-qty" name="quantity" type="number" min={0} defaultValue={item?.quantity ?? ""} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="inv-th">Low-stock threshold</Label>
                <Input id="inv-th" name="threshold" type="number" min={0} defaultValue={item?.lowStockThreshold ?? ""} placeholder={String(defaultThreshold)} />
              </div>
              <div className="flex items-end justify-between rounded-lg border border-border px-3 py-2">
                <span className="text-[12.5px]">Available</span>
                <Switch checked={available} onCheckedChange={setAvailable} />
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={pending}>
              {item ? "Save" : "Add item"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function InventoryPanel({
  restaurantId,
  items,
  defaultThreshold,
  canEdit,
}: {
  restaurantId: string;
  items: InventoryItem[];
  defaultThreshold: number;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = React.useState<InventoryItem | null>(null);
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  const low = items.filter((i) => i.quantity !== null && i.quantity <= (i.lowStockThreshold ?? defaultThreshold));

  function remove(item: InventoryItem) {
    startTransition(async () => {
      const result = await deleteInventoryItem(restaurantId, item.id);
      if (!result.ok) toast.error(result.error ?? "Couldn't delete the item.");
      else router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
          <Package className="h-4 w-4" />
          {items.length} tracked items
          {low.length > 0 && <Badge variant="danger">{low.length} low</Badge>}
        </div>
        <div className="flex gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href={routes.upcGenerator}>
              <Barcode /> UPC generator
            </Link>
          </Button>
          {canEdit && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setEditing(null);
                setOpen(true);
              }}
            >
              <Plus /> Add item
            </Button>
          )}
        </div>
      </div>

      <Card>
        {items.length === 0 ? (
          <p className="px-5 py-10 text-center text-[13px] text-muted-foreground">
            Nothing tracked yet. Add the handful of items you actually run out of — the comparison handles the rest from exports.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead className="bg-muted/40 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-5 py-2 font-medium">Item</th>
                  <th className="px-3 py-2 font-medium">SKU</th>
                  <th className="px-3 py-2 font-medium">Price</th>
                  <th className="px-3 py-2 font-medium">Qty</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  {canEdit && <th className="px-3 py-2" />}
                </tr>
              </thead>
              <tbody>
                {items.map((it) => {
                  const isLow = it.quantity !== null && it.quantity <= (it.lowStockThreshold ?? defaultThreshold);
                  return (
                    <tr key={it.id} className="border-t border-border">
                      <td className="px-5 py-2.5">
                        <p className="font-medium">{it.name}</p>
                        {it.category && <p className="text-[11px] text-muted-foreground">{it.category}</p>}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-[11.5px] text-muted-foreground">{it.sku ?? "—"}</td>
                      <td className="px-3 py-2.5 tabular-nums">{formatMoney(it.price)}</td>
                      <td className={cn("px-3 py-2.5 tabular-nums", isLow && "font-semibold text-danger")}>{it.quantity ?? "—"}</td>
                      <td className="px-3 py-2.5">
                        {!it.available ? <Badge variant="danger">86&rsquo;d</Badge> : isLow ? <Badge variant="warning">Low stock</Badge> : <Badge variant="success">In stock</Badge>}
                      </td>
                      {canEdit && (
                        <td className="px-3 py-2.5 text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setEditing(it);
                                setOpen(true);
                              }}
                            >
                              Edit
                            </Button>
                            <Button variant="ghost" size="icon-sm" aria-label="Delete" onClick={() => remove(it)} disabled={pending}>
                              <Trash2 />
                            </Button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <ItemDialog key={editing?.id ?? "new"} restaurantId={restaurantId} item={editing} open={open} onOpenChange={setOpen} defaultThreshold={defaultThreshold} />
    </div>
  );
}
