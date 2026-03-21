import { createServiceClient } from "@/lib/supabase/server";

const API_VERSION = "2024-01";

let cachedCreds: { domain: string; token: string } | null = null;

async function getCredentials(): Promise<{ domain: string; token: string }> {
  if (cachedCreds) return cachedCreds;

  // Try DB first, fall back to env vars
  try {
    const supabase = createServiceClient();
    const { data } = await supabase
      .from("shopify_tokens")
      .select("shop_domain, access_token")
      .eq("id", "current")
      .single();
    if (data) {
      cachedCreds = { domain: data.shop_domain, token: data.access_token };
      return cachedCreds;
    }
  } catch {}

  const domain = process.env.SHOPIFY_STORE_DOMAIN;
  const token = process.env.SHOPIFY_ACCESS_TOKEN;
  if (!domain || !token) {
    throw new Error("Shopify not connected. Connect at /dashboard/connections/shopify");
  }
  cachedCreds = { domain, token };
  return cachedCreds;
}

function shopifyUrl(domain: string, path: string): string {
  return `https://${domain}/admin/api/${API_VERSION}${path}`;
}

function getHeaders(token: string): Record<string, string> {
  return {
    "X-Shopify-Access-Token": token,
    "Content-Type": "application/json",
  };
}

export interface ShopifyOrder {
  id: number;
  name: string;
  created_at: string;
  financial_status: string;
  total_price: string;
  total_discounts: string;
  refunds: ShopifyRefund[];
  line_items: ShopifyLineItem[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

export interface ShopifyLineItem {
  id: number;
  sku: string;
  quantity: number;
  price: string;
  total_discount: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

export interface ShopifyRefund {
  id: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  refund_line_items: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

export async function fetchOrders(
  createdAtMin: string,
  createdAtMax: string
): Promise<ShopifyOrder[]> {
  const creds = await getCredentials();
  const orders: ShopifyOrder[] = [];
  let url: string | null = shopifyUrl(
    creds.domain,
    `/orders.json?status=any&created_at_min=${createdAtMin}&created_at_max=${createdAtMax}&limit=250`
  );

  while (url) {
    const res: Response = await fetch(url, { headers: getHeaders(creds.token) });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Shopify orders fetch failed: ${res.status} ${text}`);
    }

    const data = await res.json();
    orders.push(...(data.orders || []));

    // Cursor pagination via Link header
    const linkHeader = res.headers.get("link");
    url = null;
    if (linkHeader) {
      const match = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
      if (match) url = match[1];
    }
  }

  return orders;
}

export interface ShopifyVariant {
  id: number;
  product_id: number;
  sku: string;
  title: string;
  inventory_quantity: number;
  price: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

export interface ShopifyProductWithVariants {
  productTitle: string;
  productImage: string | null;
  variant: ShopifyVariant;
}

export async function fetchProductsWithVariants(): Promise<ShopifyProductWithVariants[]> {
  const creds = await getCredentials();
  const results: ShopifyProductWithVariants[] = [];
  let url: string | null = shopifyUrl(creds.domain, `/products.json?limit=250&fields=id,title,variants,images`);

  while (url) {
    const res: Response = await fetch(url, { headers: getHeaders(creds.token) });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Shopify products fetch failed: ${res.status} ${text}`);
    }

    const data = await res.json();
    for (const product of data.products || []) {
      const imageUrl = product.images?.[0]?.src || null;
      for (const variant of product.variants || []) {
        const variantTitle = variant.title === "Default Title"
          ? product.title
          : `${product.title} - ${variant.title}`;
        results.push({
          productTitle: variantTitle,
          productImage: imageUrl,
          variant,
        });
      }
    }

    const linkHeader = res.headers.get("link");
    url = null;
    if (linkHeader) {
      const match = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
      if (match) url = match[1];
    }
  }

  return results;
}
