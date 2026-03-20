import { NextResponse } from "next/server";
import { syncAll } from "@/lib/sync-engine";

export async function POST() {
  try {
    const results = await syncAll();
    return NextResponse.json({ results });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sync failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
