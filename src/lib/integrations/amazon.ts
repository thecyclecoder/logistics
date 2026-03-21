const LWA_TOKEN_URL = "https://api.amazon.com/auth/o2/token";
const SP_API_BASE = "https://sellingpartnerapi-na.amazon.com";
const MARKETPLACE_ID = process.env.AMAZON_MARKETPLACE_ID || "ATVPDKIKX0DER";

let cachedToken: { access_token: string; expires_at: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expires_at - 60_000) {
    return cachedToken.access_token;
  }

  const res = await fetch(LWA_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: process.env.AMAZON_SP_REFRESH_TOKEN!,
      client_id: process.env.AMAZON_SP_CLIENT_ID!,
      client_secret: process.env.AMAZON_SP_CLIENT_SECRET!,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Amazon LWA token refresh failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  cachedToken = {
    access_token: data.access_token,
    expires_at: Date.now() + data.expires_in * 1000,
  };
  return data.access_token;
}

export interface FBAInventorySummary {
  asin: string;
  fnSku: string;
  sellerSku: string;
  condition: string;
  totalFulfillableQuantity: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  inventoryDetails?: any;
}

export async function fetchFBAInventory(): Promise<FBAInventorySummary[]> {
  const token = await getAccessToken();
  const summaries: FBAInventorySummary[] = [];
  let nextToken: string | null = null;

  do {
    const params = new URLSearchParams({
      details: "true",
      granularityType: "Marketplace",
      granularityId: MARKETPLACE_ID,
      marketplaceIds: MARKETPLACE_ID,
    });
    if (nextToken) params.set("nextToken", nextToken);

    const res = await fetch(
      `${SP_API_BASE}/fba/inventory/v1/summaries?${params}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "x-amz-access-token": token,
        },
      }
    );

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Amazon FBA inventory fetch failed: ${res.status} ${text}`);
    }

    const data = await res.json();
    const batch = data.payload?.inventorySummaries || [];
    summaries.push(
      ...batch.map(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (s: any): FBAInventorySummary => ({
          asin: s.asin,
          fnSku: s.fnSku,
          sellerSku: s.sellerSku,
          condition: s.condition,
          totalFulfillableQuantity:
            s.inventoryDetails?.fulfillableQuantity ?? s.totalQuantity ?? 0,
          inventoryDetails: s.inventoryDetails,
        })
      )
    );

    nextToken = data.pagination?.nextToken || null;
  } while (nextToken);

  return summaries;
}

export interface AmazonOrder {
  AmazonOrderId: string;
  PurchaseDate: string;
  OrderStatus: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  OrderTotal?: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

export interface AmazonOrderItem {
  ASIN: string;
  SellerSKU: string;
  OrderItemId: string;
  QuantityOrdered: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ItemPrice?: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ItemTax?: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  PromotionDiscount?: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

export async function fetchOrders(
  createdAfter: string,
  createdBefore: string
): Promise<AmazonOrder[]> {
  const token = await getAccessToken();
  const orders: AmazonOrder[] = [];
  let nextToken: string | null = null;

  do {
    const params = new URLSearchParams({
      MarketplaceIds: MARKETPLACE_ID,
      CreatedAfter: createdAfter,
      CreatedBefore: createdBefore,
      OrderStatuses: "Shipped",
    });
    if (nextToken) params.set("NextToken", nextToken);

    const res = await fetch(`${SP_API_BASE}/orders/v0/orders?${params}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "x-amz-access-token": token,
      },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Amazon orders fetch failed: ${res.status} ${text}`);
    }

    const data = await res.json();
    const batch = data.payload?.Orders || [];
    orders.push(...batch);

    nextToken = data.payload?.NextToken || null;
  } while (nextToken);

  return orders;
}

export async function fetchOrderItems(
  orderId: string
): Promise<AmazonOrderItem[]> {
  const token = await getAccessToken();
  const items: AmazonOrderItem[] = [];
  let nextToken: string | null = null;

  do {
    let url = `${SP_API_BASE}/orders/v0/orders/${orderId}/orderItems`;
    if (nextToken) url += `?NextToken=${encodeURIComponent(nextToken)}`;

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        "x-amz-access-token": token,
      },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Amazon order items fetch failed: ${res.status} ${text}`);
    }

    const data = await res.json();
    const batch = data.payload?.OrderItems || [];
    items.push(...batch);

    nextToken = data.payload?.NextToken || null;
  } while (nextToken);

  return items;
}

export interface CatalogItem {
  asin: string;
  title: string;
  imageUrl: string | null;
  price: number | null;
  parentAsin: string | null;
  classification: "VARIATION_CHILD" | "VARIATION_PARENT" | "SELF_PUBLISHED" | string | null;
}

export async function fetchCatalogItems(
  asins: string[]
): Promise<CatalogItem[]> {
  const token = await getAccessToken();
  const results: CatalogItem[] = [];

  // API accepts up to 20 ASINs at a time
  for (let i = 0; i < asins.length; i += 20) {
    const batch = asins.slice(i, i + 20);
    const params = new URLSearchParams({
      identifiers: batch.join(","),
      identifiersType: "ASIN",
      marketplaceIds: MARKETPLACE_ID,
      includedData: "summaries,images,relationships",
    });

    const res = await fetch(
      `${SP_API_BASE}/catalog/2022-04-01/items?${params}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "x-amz-access-token": token,
        },
      }
    );

    if (!res.ok) {
      const text = await res.text();
      console.error(`Catalog fetch failed for batch: ${res.status} ${text}`);
      continue;
    }

    const data = await res.json();
    for (const item of data.items || []) {
      const summary = item.summaries?.[0];
      const mainImage = item.images?.[0]?.images?.find(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (img: any) => img.variant === "MAIN"
      ) || item.images?.[0]?.images?.[0];

      // Find parent relationship
      let parentAsin: string | null = null;
      let classification: string | null = null;
      for (const rel of item.relationships || []) {
        for (const r of rel.relationships || []) {
          if (r.type === "VARIATION" && r.parentAsins?.[0]) {
            parentAsin = r.parentAsins[0];
            classification = "VARIATION_CHILD";
          }
          if (r.type === "VARIATION" && r.childAsins?.length > 0) {
            classification = "VARIATION_PARENT";
          }
        }
      }

      results.push({
        asin: item.asin,
        title: summary?.itemName || "",
        imageUrl: mainImage?.link || null,
        price: summary?.buyBoxPrices?.[0]?.price?.amount
          ? parseFloat(summary.buyBoxPrices[0].price.amount)
          : null,
        parentAsin,
        classification,
      });
    }

    // Rate limit: SP-API allows ~5 requests/sec for catalog
    if (i + 20 < asins.length) {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }

  return results;
}
