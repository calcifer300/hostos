import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ShoppingBag } from "lucide-react";
import { canEditCurrentFleet, getCurrentHostId } from "@/lib/host/context";
import { getCommerceOrders, getProducts, getStore, getSyncRuns } from "@/lib/commerce/queries";
import { computeStoreAnalytics } from "@/lib/commerce/analytics";
import { StoreDetail } from "@/components/commerce/store-detail";
import { Badge } from "@/components/ui/badge";
import { routes } from "@/lib/routes";

export const metadata: Metadata = { title: "Store" };

export default async function StorePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const { id } = await params;
  const { tab } = await searchParams;
  const hostId = await getCurrentHostId();
  const store = await getStore(hostId, id);
  if (!store) notFound();

  const [products, orders, runs, canEdit] = await Promise.all([getProducts(hostId, id), getCommerceOrders(hostId, id), getSyncRuns(hostId, id), canEditCurrentFleet()]);
  const analytics = computeStoreAnalytics(orders, products, store.timezone, store.lowStockThreshold);

  return (
    <div className="mx-auto w-full max-w-6xl">
      <Link href={routes.commerce} className="mb-4 inline-flex items-center gap-1.5 text-[12.5px] text-muted-foreground transition-colors hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> All stores
      </Link>
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,color-mix(in_oklab,var(--accent)_16%,transparent),color-mix(in_oklab,var(--accent-2)_10%,transparent))] text-accent">
          <ShoppingBag className="h-5 w-5" strokeWidth={1.75} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-[28px] font-semibold tracking-tight">{store.name}</h1>
            <Badge variant={store.status === "active" ? "success" : "neutral"} className="capitalize">{store.status}</Badge>
          </div>
          <p className="mt-0.5 text-[13px] text-muted-foreground">{[store.provider === "shopify" ? "Shopify" : store.provider, store.domain, store.currency].filter(Boolean).join(" · ")}</p>
        </div>
      </div>
      <StoreDetail store={store} initialTab={tab ?? "overview"} products={products} orders={orders} analytics={analytics} runs={runs} canEdit={canEdit} />
    </div>
  );
}
