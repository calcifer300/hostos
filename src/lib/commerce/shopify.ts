import "server-only";
import { fetchWithTimeout, UpstreamResponseError } from "@/lib/http";

/**
 * Shopify Admin REST API client.
 *
 * Authenticates with a custom-app Admin API access token (shpat_…), which a
 * merchant creates in Shopify admin → Settings → Apps and sales channels →
 * Develop apps. That is the only credential HostOS holds — no OAuth app
 * review needed to get a pilot store live — and it is stored encrypted
 * (lib/crypto.ts).
 *
 * Pagination follows the Link header (page_info cursors); Shopify caps REST
 * at 250 rows per page and rate-limits to 2 requests/second on the leaky
 * bucket, which the small delay between pages respects.
 */

export const SHOPIFY_API_VERSION = "2025-07";

export interface ShopifyProduct {
  id: number;
  title: string;
  vendor: string | null;
  product_type: string | null;
  status: string;
  image: { src: string } | null;
  variants: { id: number; sku: string | null; price: string; compare_at_price: string | null; inventory_quantity: number | null }[];
  updated_at: string;
}

export interface ShopifyOrder {
  id: number;
  name: string;
  order_number: number;
  created_at: string;
  cancelled_at: string | null;
  closed_at: string | null;
  financial_status: string | null;
  fulfillment_status: string | null;
  currency: string;
  subtotal_price: string;
  total_price: string;
  total_tax: string;
  total_discounts: string;
  total_shipping_price_set?: { shop_money: { amount: string } };
  customer?: { first_name: string | null; last_name: string | null; email: string | null } | null;
  email: string | null;
  line_items: { title: string; quantity: number; price: string; sku: string | null }[];
  fulfillments?: { created_at: string }[];
}

export interface ShopifyShop {
  name: string;
  myshopify_domain: string;
  currency: string;
  iana_timezone: string;
  email: string | null;
}

/** "my-shop", "my-shop.myshopify.com" and "https://my-shop.myshopify.com/" all normalise to the domain. */
export function normalizeShopDomain(input: string): string | null {
  const trimmed = input.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  if (!trimmed) return null;
  const domain = trimmed.includes(".") ? trimmed : `${trimmed}.myshopify.com`;
  return /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(domain) ? domain : null;
}

export function looksLikeAccessToken(token: string): boolean {
  return /^shp(at|ca|pa)_[a-f0-9]{16,}$/i.test(token.trim());
}

function nextPageInfo(link: string | null): string | null {
  if (!link) return null;
  const m = link.match(/<[^>]*[?&]page_info=([^&>]+)[^>]*>;\s*rel="next"/);
  return m ? m[1] : null;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class ShopifyClient {
  private readonly domain: string;
  private readonly token: string;

  // Explicit fields rather than parameter properties: the test runner strips
  // types only, and parameter properties are the one syntax that needs more.
  constructor(domain: string, token: string) {
    this.domain = domain;
    this.token = token;
  }

  private url(path: string, params: Record<string, string> = {}): string {
    const u = new URL(`https://${this.domain}/admin/api/${SHOPIFY_API_VERSION}/${path}`);
    for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
    return u.toString();
  }

  private async get<T>(path: string, params: Record<string, string> = {}): Promise<{ body: T; link: string | null }> {
    const res = await fetchWithTimeout("Shopify", this.url(path, params), {
      headers: { "X-Shopify-Access-Token": this.token, Accept: "application/json" },
      timeoutMs: 20_000,
    });
    if (res.status === 429) {
      // Respect the bucket rather than fail the sync.
      const retry = Number(res.headers.get("Retry-After") ?? "2");
      await sleep(Math.min(10, Math.max(1, retry)) * 1000);
      return this.get<T>(path, params);
    }
    if (!res.ok) {
      const text = (await res.text().catch(() => "")).replace(/\s+/g, " ").slice(0, 200);
      throw new UpstreamResponseError("Shopify", res.status, text || res.statusText);
    }
    return { body: (await res.json()) as T, link: res.headers.get("link") };
  }

  async shop(): Promise<ShopifyShop> {
    const { body } = await this.get<{ shop: ShopifyShop }>("shop.json");
    return body.shop;
  }

  async *products(): AsyncGenerator<ShopifyProduct[]> {
    let pageInfo: string | null = null;
    do {
      const params: Record<string, string> = { limit: "250" };
      if (pageInfo) params.page_info = pageInfo;
      else params.status = "any";
      const { body, link } = await this.get<{ products: ShopifyProduct[] }>("products.json", params);
      yield body.products;
      pageInfo = nextPageInfo(link);
      if (pageInfo) await sleep(600);
    } while (pageInfo);
  }

  async *orders(sinceIso: string | null): AsyncGenerator<ShopifyOrder[]> {
    let pageInfo: string | null = null;
    do {
      const params: Record<string, string> = { limit: "250" };
      if (pageInfo) params.page_info = pageInfo;
      else {
        params.status = "any";
        if (sinceIso) params.updated_at_min = sinceIso;
      }
      const { body, link } = await this.get<{ orders: ShopifyOrder[] }>("orders.json", params);
      yield body.orders;
      pageInfo = nextPageInfo(link);
      if (pageInfo) await sleep(600);
    } while (pageInfo);
  }
}
