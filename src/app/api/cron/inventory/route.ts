import { NextRequest, NextResponse } from "next/server";
import {
  syncAmazonInventory,
  sync3PLInventory,
} from "@/lib/sync-engine";

export const maxDuration = 120;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const results = await Promise.allSettled([
      syncAmazonInventory(),
      sync3PLInventory(),
    ]);

    return NextResponse.json({
      results: results.map((r) =>
        r.status === "fulfilled" ? r.value : { error: r.reason?.message, stack: r.reason?.stack }
      ),
    });
  } catch (err) {
    const message = err instanceof Error ? `${err.message}\n${err.stack}` : String(err);
    console.error("Inventory cron failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
