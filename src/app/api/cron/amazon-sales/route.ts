import { NextRequest, NextResponse } from "next/server";
import { syncAmazonSalesSnapshot } from "@/lib/sync-engine";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await syncAmazonSalesSnapshot();
  return NextResponse.json(result);
}
