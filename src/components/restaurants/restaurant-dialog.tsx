"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Label, NativeSelect } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createRestaurant, updateRestaurant, type RestaurantInput } from "@/lib/actions/restaurants";
import { US_ZONES } from "@/lib/timezones";
import type { Restaurant } from "@/lib/restaurants/types";
import { routes } from "@/lib/routes";

const POS_SYSTEMS = ["NRS", "Square", "Clover", "Toast", "Lightspeed", "Revel", "Shopify POS", "Other"];

export function RestaurantDialog({
  open,
  onOpenChange,
  restaurant,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restaurant?: Restaurant | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const editing = Boolean(restaurant);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const input: RestaurantInput = {
      name: String(fd.get("name") ?? ""),
      contactName: String(fd.get("contactName") ?? ""),
      email: String(fd.get("email") ?? ""),
      phone: String(fd.get("phone") ?? ""),
      posSystem: String(fd.get("posSystem") ?? ""),
      doordashStoreId: String(fd.get("doordashStoreId") ?? ""),
      address: String(fd.get("address") ?? ""),
      timezone: String(fd.get("timezone") ?? ""),
      lowStockThreshold: Number(fd.get("lowStockThreshold") ?? 5),
      priceTolerance: Number(fd.get("priceTolerance") ?? 0.01),
      notes: String(fd.get("notes") ?? ""),
    };

    startTransition(async () => {
      const result = restaurant ? await updateRestaurant(restaurant.id, input) : await createRestaurant(input);
      if (!result.ok) {
        toast.error(result.error ?? "Something went wrong.");
        return;
      }
      toast.success(restaurant ? "Restaurant updated" : "Restaurant added");
      onOpenChange(false);
      if (!restaurant && result.id) router.push(routes.restaurant(result.id));
      else router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <form onSubmit={onSubmit} className="flex min-h-0 flex-col">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit restaurant" : "Add a restaurant"}</DialogTitle>
            <DialogDescription>
              A restaurant is one DoorDash storefront with its own POS export, menu comparison, orders and messages.
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="r-name">Name</Label>
                <Input id="r-name" name="name" defaultValue={restaurant?.name ?? ""} placeholder="Downtown Kitchen" required autoFocus />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="r-pos">POS system</Label>
                <NativeSelect id="r-pos" name="posSystem" defaultValue={restaurant?.posSystem ?? ""}>
                  <option value="">Not set</option>
                  {POS_SYSTEMS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="r-store">DoorDash store ID</Label>
                <Input id="r-store" name="doordashStoreId" defaultValue={restaurant?.doordashStoreId ?? ""} placeholder="From the merchant portal URL" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="r-contact">Contact name</Label>
                <Input id="r-contact" name="contactName" defaultValue={restaurant?.contactName ?? ""} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="r-phone">Phone</Label>
                <Input id="r-phone" name="phone" defaultValue={restaurant?.phone ?? ""} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="r-email">Email</Label>
                <Input id="r-email" name="email" type="email" defaultValue={restaurant?.email ?? ""} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="r-tz">Timezone</Label>
                <NativeSelect id="r-tz" name="timezone" defaultValue={restaurant?.timezone ?? "America/Denver"}>
                  {US_ZONES.map((z) => (
                    <option key={z.id} value={z.id}>
                      {z.label}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="r-address">Address</Label>
                <Input id="r-address" name="address" defaultValue={restaurant?.address ?? ""} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="r-low">Low-stock threshold (units)</Label>
                <Input id="r-low" name="lowStockThreshold" type="number" min={0} defaultValue={restaurant?.lowStockThreshold ?? 5} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="r-tol">Price tolerance ($)</Label>
                <Input id="r-tol" name="priceTolerance" type="number" step="0.01" min={0} defaultValue={restaurant?.priceTolerance ?? 0.01} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="r-notes">Notes</Label>
                <Textarea id="r-notes" name="notes" rows={3} defaultValue={restaurant?.notes ?? ""} placeholder="Hours, quirks of their POS export, who to call when the store pauses…" />
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={pending}>
              {editing ? "Save changes" : "Add restaurant"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
