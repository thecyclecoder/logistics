import { NextResponse } from "next/server";
import { syncShopifySalesSnapshot } from "@/lib/sync-engine";

export async function POST() {
  try {
    const result = await syncShopifySalesSnapshot();
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Shopify sales sync failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
