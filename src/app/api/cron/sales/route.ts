import { NextRequest, NextResponse } from "next/server";
import { syncAmazonSales, syncShopifySales } from "@/lib/sync-engine";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results = await Promise.allSettled([
    syncAmazonSales(0),
    syncShopifySales(0),
  ]);

  return NextResponse.json({
    results: results.map((r) =>
      r.status === "fulfilled" ? r.value : { error: r.reason?.message }
    ),
  });
}
