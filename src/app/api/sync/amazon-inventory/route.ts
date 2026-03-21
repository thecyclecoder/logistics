import { NextResponse } from "next/server";
import { syncAmazonInventory } from "@/lib/sync-engine";

export async function POST() {
  try {
    const result = await syncAmazonInventory();
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Amazon sync failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
