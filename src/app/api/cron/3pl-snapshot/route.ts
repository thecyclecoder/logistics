import { NextRequest, NextResponse } from "next/server";
import { sync3PLSnapshot } from "@/lib/sync-engine";

export const maxDuration = 120;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await sync3PLSnapshot();
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? `${err.message}\n${err.stack}` : String(err);
    console.error("3PL snapshot cron failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
