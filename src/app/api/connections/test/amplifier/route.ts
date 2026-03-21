import { NextResponse } from "next/server";
import { fetchInventory } from "@/lib/integrations/amplifier";

export async function GET() {
  try {
    const items = await fetchInventory();
    return NextResponse.json({ connected: true, items: items.length });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Amplifier connection failed";
    return NextResponse.json(
      { connected: false, error: message },
      { status: 500 }
    );
  }
}
