import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createServiceClient();

  // Current month start
  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

  const { data, error } = await supabase
    .from("amazon_sales_snapshots")
    .select("asin, units_shipped")
    .gte("sale_date", monthStart);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Aggregate by ASIN
  const byAsin = new Map<string, number>();
  for (const row of data || []) {
    byAsin.set(row.asin, (byAsin.get(row.asin) || 0) + row.units_shipped);
  }

  return NextResponse.json(Object.fromEntries(byAsin));
}
