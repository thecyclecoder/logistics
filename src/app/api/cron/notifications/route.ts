import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

import webpush from "web-push";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const notifications: Array<{ type: string; title: string; body: string }> = [];
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://shoptics.ai";

  // 1. Low stock (< 3 months runway)
  try {
    const res = await fetch(`${baseUrl}/api/overview/low-stock`, { cache: "no-store" }).catch(() => null);
    if (res?.ok) {
      const items = await res.json();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const critical = (Array.isArray(items) ? items : []).filter((i: any) => i.months_left < 3);
      if (critical.length > 0) {
        notifications.push({
          type: "low_stock",
          title: `Low Stock: ${critical.length} product${critical.length > 1 ? "s" : ""}`,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          body: critical.slice(0, 3).map((i: any) => `${i.name} (${i.months_left.toFixed(1)}mo)`).join(", "),
        });
      }
    }
  } catch {}

  // 2. FBA replenishment (< 14 days stock)
  try {
    const res = await fetch(`${baseUrl}/api/overview/fba-replenishment`, { cache: "no-store" }).catch(() => null);
    if (res?.ok) {
      const data = await res.json();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const urgent = (data.needs_replenishment || []).filter((i: any) => i.days_of_stock < 14);
      if (urgent.length > 0) {
        notifications.push({
          type: "replenishment",
          title: `FBA Replenishment: ${urgent.length} ASIN${urgent.length > 1 ? "s" : ""} urgent`,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          body: urgent.slice(0, 3).map((i: any) => `${i.display_name} (${i.days_of_stock}d)`).join(", "),
        });
      }
    }
  } catch {}

  // 3. Month-end closing reminder (only on the 1st of the month)
  try {
    const now = new Date();
    if (now.getUTCDate() === 1) {
      const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const closingMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}`;

      const { data: closings } = await supabase
        .from("month_end_closings")
        .select("id, status")
        .eq("closing_month", closingMonth);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const completed = (closings || []).some((c: any) => c.status === "completed");
      if (!completed) {
        const monthName = prevDate.toLocaleString("en-US", { month: "long", year: "numeric" });
        notifications.push({
          type: "month_end",
          title: "Month-End Closing Due",
          body: `Time to do your ${monthName} month-end closing!`,
        });
      }
    }
  } catch {}

  // 3b. Gateway fee review reminder (on the 6th of the month)
  try {
    const now = new Date();
    if (now.getUTCDate() === 6) {
      const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const monthName = prevDate.toLocaleString("en-US", { month: "long" });
      notifications.push({
        type: "month_end",
        title: "Review Transaction Fees",
        body: `Braintree & gateway fee statements for ${monthName} should be available. Update your journal entry with actual fees.`,
      });
    }
  } catch {}

  // 4. Unmapped SKUs — active external_skus without a corresponding sku_mapping
  try {
    const { data: externalAll } = await supabase
      .from("external_skus")
      .select("id, external_id, source, status");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const activeSkus = (externalAll || []).filter((s: any) => s.status === "active");

    // Get all mapped external_ids to exclude
    const { data: mappingsAll } = await supabase
      .from("sku_mappings")
      .select("external_id, active");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mappedIds = new Set((mappingsAll || []).filter((m: any) => m.active).map((m: any) => m.external_id));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const unmapped = activeSkus.filter((s: any) => !mappedIds.has(s.external_id));

    if (unmapped.length > 0) {
      notifications.push({
        type: "unmapped",
        title: `${unmapped.length} Unmapped SKU${unmapped.length > 1 ? "s" : ""} Need Review`,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        body: unmapped.slice(0, 3).map((u: any) => `${u.external_id} (${u.source})`).join(", ") +
          (unmapped.length > 3 ? ` +${unmapped.length - 3} more` : ""),
      });
    }
  } catch {}

  // 5. Missing snapshots (FBA or 3PL didn't run today)
  try {
    const today = new Date().toISOString().split("T")[0];

    const { data: fbaSnap } = await supabase
      .from("amazon_inventory_snapshots")
      .select("id")
      .eq("snapshot_date", today)
      .limit(1);

    const { data: tplSnap } = await supabase
      .from("tpl_inventory_snapshots")
      .select("id")
      .eq("snapshot_date", today)
      .limit(1);

    const missing: string[] = [];
    if (!fbaSnap?.length) missing.push("Amazon FBA");
    if (!tplSnap?.length) missing.push("Amplifier 3PL");

    if (missing.length > 0) {
      notifications.push({
        type: "snapshot_missing",
        title: "Inventory Snapshot Missing",
        body: `No snapshot today for: ${missing.join(", ")}. Check sync status.`,
      });
    }
  } catch {}

  if (notifications.length === 0) {
    return NextResponse.json({ message: "No alerts", sent: 0 });
  }

  // Get all subscriptions and send
  const { data: subs } = await supabase
    .from("push_subscriptions")
    .select("id, subscription");

  if (!subs?.length) {
    return NextResponse.json({ alerts: notifications.length, sent: 0, reason: "no_subscriptions" });
  }

  webpush.setVapidDetails(
    "mailto:dylan@superfoodscompany.com",
    process.env.VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  );

  let totalSent = 0;
  for (const notification of notifications) {
    const payload = JSON.stringify({
      title: notification.title,
      body: notification.body,
      type: notification.type,
      tag: notification.type,
    });

    const results = await Promise.allSettled(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      subs.map((sub: any) => webpush.sendNotification(sub.subscription, payload))
    );
    totalSent += results.filter((r) => r.status === "fulfilled").length;
  }

  return NextResponse.json({
    alerts: notifications.length,
    notifications: notifications.map((n) => n.type),
    sent: totalSent,
  });
}
