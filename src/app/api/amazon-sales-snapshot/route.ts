import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const days = parseInt(searchParams.get("days") || "7");

  const supabase = createServiceClient();

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const { data, error } = await supabase
    .from("amazon_sales_snapshots")
    .select("*")
    .gte("sale_date", startDate.toISOString().split("T")[0])
    .order("sale_date", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Aggregate totals
  const totals = {
    units_shipped: 0,
    revenue: 0,
    recurring_units: 0,
    recurring_revenue: 0,
    sns_checkout_units: 0,
    sns_checkout_revenue: 0,
    one_time_units: 0,
    one_time_revenue: 0,
    units_pending: 0,
  };

  for (const row of data || []) {
    totals.units_shipped += row.units_shipped;
    totals.revenue += Number(row.revenue);
    totals.recurring_units += row.recurring_units;
    totals.recurring_revenue += Number(row.recurring_revenue);
    totals.sns_checkout_units += row.sns_checkout_units;
    totals.sns_checkout_revenue += Number(row.sns_checkout_revenue);
    totals.one_time_units += row.one_time_units;
    totals.one_time_revenue += Number(row.one_time_revenue);
    totals.units_pending += row.units_pending;
  }

  return NextResponse.json({
    items: data || [],
    totals,
    days,
  });
}
