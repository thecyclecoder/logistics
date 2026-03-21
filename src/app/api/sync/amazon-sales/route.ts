import { NextResponse } from "next/server";
import { syncAmazonSalesSnapshot } from "@/lib/sync-engine";

export async function POST() {
  try {
    const result = await syncAmazonSalesSnapshot();
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Amazon sales sync failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
