"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ExternalLink, KeyRound, ShoppingBag } from "lucide-react";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input, Label, NativeSelect } from "@/components/ui/input";
import { connectShopifyStore, createManualStore } from "@/lib/actions/commerce";
import { routes } from "@/lib/routes";

const STEPS = [
  "In Shopify admin, open Settings → Apps and sales channels → Develop apps → Create an app.",
  "Under Configuration, grant Admin API scopes read_products, read_inventory and read_orders.",
  "Install the app, then copy the Admin API access token (it starts with shpat_ and is shown once).",
  "Paste the token and your store's myshopify.com domain below.",
];

export function ConnectStoreDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [domain, setDomain] = React.useState("");
  const [token, setToken] = React.useState("");
  const [name, setName] = React.useState("");
  const [manualName, setManualName] = React.useState("");
  const [provider, setProvider] = React.useState("shopify");

  function connect() {
    startTransition(async () => {
      const result = await connectShopifyStore({ domain, accessToken: token, name });
      if (!result.ok) {
        toast.error(result.error ?? "Couldn't connect the store.");
        return;
      }
      toast.success("Store connected and synced");
      onOpenChange(false);
      if (result.id) router.push(routes.store(result.id));
    });
  }

  function createManual() {
    startTransition(async () => {
      const result = await createManualStore({ name: manualName, provider });
      if (!result.ok) {
        toast.error(result.error ?? "Couldn't create the store.");
        return;
      }
      toast.success("Store created — import a products export to fill it");
      onOpenChange(false);
      if (result.id) router.push(routes.store(result.id));
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Add a store</DialogTitle>
          <DialogDescription>Connect Shopify directly for live products and orders, or create a store fed by CSV exports.</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <Tabs defaultValue="shopify">
            <TabsList>
              <TabsTrigger value="shopify">
                <ShoppingBag className="h-3.5 w-3.5" /> Shopify (API)
              </TabsTrigger>
              <TabsTrigger value="manual">CSV exports</TabsTrigger>
            </TabsList>

            <TabsContent value="shopify" className="space-y-4">
              <ol className="space-y-1.5 rounded-xl border border-border bg-background/40 p-4 text-[12.5px] text-muted-foreground">
                {STEPS.map((s, i) => (
                  <li key={s} className="flex gap-2">
                    <span className="font-semibold text-accent">{i + 1}.</span>
                    {s}
                  </li>
                ))}
                <li className="pt-1">
                  <a href="https://help.shopify.com/en/manual/apps/app-types/custom-apps" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-accent hover:underline">
                    Shopify&rsquo;s guide to custom apps <ExternalLink className="h-3 w-3" />
                  </a>
                </li>
              </ol>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="shop-domain">Store domain</Label>
                  <Input id="shop-domain" value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="my-shop.myshopify.com" autoComplete="off" />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="shop-token">Admin API access token</Label>
                  <div className="relative">
                    <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input id="shop-token" type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder="shpat_…" className="pl-9 font-mono" autoComplete="off" />
                  </div>
                  <p className="text-[11.5px] text-muted-foreground">Stored encrypted. Verified against Shopify before anything is saved.</p>
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="shop-name">Display name (optional)</Label>
                  <Input id="shop-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Defaults to the shop's name" />
                </div>
              </div>
              <div className="flex justify-end">
                <Button variant="primary" onClick={connect} loading={pending} disabled={!domain.trim() || !token.trim()}>
                  Connect and sync
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="manual" className="space-y-4">
              <p className="text-[13px] text-muted-foreground">
                No API access yet? Create the store and import Shopify&rsquo;s (or any platform&rsquo;s) product and order CSV exports from the store page.
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="manual-name">Store name</Label>
                  <Input id="manual-name" value={manualName} onChange={(e) => setManualName(e.target.value)} placeholder="Downtown Goods" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="manual-provider">Platform</Label>
                  <NativeSelect id="manual-provider" value={provider} onChange={(e) => setProvider(e.target.value)}>
                    <option value="shopify">Shopify</option>
                    <option value="woocommerce">WooCommerce</option>
                    <option value="square">Square Online</option>
                    <option value="other">Other</option>
                  </NativeSelect>
                </div>
              </div>
              <div className="flex justify-end">
                <Button variant="primary" onClick={createManual} loading={pending} disabled={!manualName.trim()}>
                  Create store
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
