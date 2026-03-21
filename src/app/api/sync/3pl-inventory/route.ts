import { NextResponse } from "next/server";
import { sync3PLInventory } from "@/lib/sync-engine";

export async function POST() {
  try {
    const result = await sync3PLInventory();
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "3PL sync failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
