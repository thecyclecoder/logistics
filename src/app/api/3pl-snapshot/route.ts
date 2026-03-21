import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createServiceClient();

  // Get the latest snapshot date
  const { data: latestDate } = await supabase
    .from("tpl_inventory_snapshots")
    .select("snapshot_date")
    .order("snapshot_date", { ascending: false })
    .limit(1)
    .single();

  if (!latestDate) {
    return NextResponse.json({ items: [], snapshot_date: null, warning: "No snapshots yet" });
  }

  const today = new Date().toISOString().split("T")[0];
  const warning = latestDate.snapshot_date < today
    ? `Latest snapshot is from ${latestDate.snapshot_date}. Daily cron may not be running.`
    : null;

  const { data: items } = await supabase
    .from("tpl_inventory_snapshots")
    .select("*")
    .eq("snapshot_date", latestDate.snapshot_date)
    .order("sku");

  return NextResponse.json({
    items: items || [],
    snapshot_date: latestDate.snapshot_date,
    warning,
  });
}
