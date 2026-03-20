const API_VERSION = "2024-01";

function shopifyUrl(path: string): string {
  const domain = process.env.SHOPIFY_STORE_DOMAIN!;
  return `https://${domain}/admin/api/${API_VERSION}${path}`;
}

function getHeaders(): Record<string, string> {
  return {
    "X-Shopify-Access-Token": process.env.SHOPIFY_ACCESS_TOKEN!,
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
  const orders: ShopifyOrder[] = [];
  let url: string | null = shopifyUrl(
    `/orders.json?status=any&created_at_min=${createdAtMin}&created_at_max=${createdAtMax}&limit=250`
  );

  while (url) {
    const res: Response = await fetch(url, { headers: getHeaders() });

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

export async function fetchProductVariants(): Promise<ShopifyVariant[]> {
  const variants: ShopifyVariant[] = [];
  let url: string | null = shopifyUrl(`/products.json?limit=250`);

  while (url) {
    const res: Response = await fetch(url, { headers: getHeaders() });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Shopify products fetch failed: ${res.status} ${text}`);
    }

    const data = await res.json();
    for (const product of data.products || []) {
      variants.push(...(product.variants || []));
    }

    const linkHeader = res.headers.get("link");
    url = null;
    if (linkHeader) {
      const match = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
      if (match) url = match[1];
    }
  }

  return variants;
}
