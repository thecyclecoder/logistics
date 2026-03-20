import { NextResponse } from "next/server";
import { syncQB } from "@/lib/sync-engine";

export async function POST() {
  try {
    const results = await syncQB();
    return NextResponse.json({ results });
  } catch (err) {
    const message = err instanceof Error ? err.message : "QB sync failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
