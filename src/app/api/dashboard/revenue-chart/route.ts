import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = createServiceClient();

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const startPeriod = `${sixMonthsAgo.getFullYear()}-${String(
    sixMonthsAgo.getMonth() + 1
  ).padStart(2, "0")}`;

  const { data, error } = await supabase
    .from("monthly_sales_summary")
    .select("period_month, channel, total_net")
    .gte("period_month", startPeriod)
    .order("period_month");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Pivot into { month, amazon, shopify } format
  const byMonth: Record<string, { amazon: number; shopify: number }> = {};
  for (const row of data || []) {
    if (!byMonth[row.period_month]) {
      byMonth[row.period_month] = { amazon: 0, shopify: 0 };
    }
    byMonth[row.period_month][row.channel as "amazon" | "shopify"] += Number(
      row.total_net
    );
  }

  const chartData = Object.entries(byMonth)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, values]) => ({
      month,
      amazon: Math.round(values.amazon * 100) / 100,
      shopify: Math.round(values.shopify * 100) / 100,
    }));

  return NextResponse.json(chartData);
}
