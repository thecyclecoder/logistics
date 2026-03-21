import { NextResponse } from "next/server";
import { syncShopifyProducts } from "@/lib/sync-engine";

export async function POST() {
  try {
    const result = await syncShopifyProducts();
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Shopify sync failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
