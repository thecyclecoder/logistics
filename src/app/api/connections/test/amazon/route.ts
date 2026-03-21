import { NextResponse } from "next/server";
import { fetchFBAInventory } from "@/lib/integrations/amazon";

export async function GET() {
  try {
    // Attempt to fetch FBA inventory - this will test token refresh and API access
    await fetchFBAInventory();
    return NextResponse.json({ connected: true });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Amazon connection failed";
    return NextResponse.json(
      { connected: false, error: message },
      { status: 500 }
    );
  }
}
