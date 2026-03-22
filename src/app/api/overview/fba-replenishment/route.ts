import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = createServiceClient();

    // 1. Get Amazon mappings with product names
    const { data: allMappings } = await supabase
      .from("sku_mappings")
      .select("external_id, product_id, unit_multiplier, active, label, products(quickbooks_name, image_url, item_type)")
      .eq("source", "amazon");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mappings = (allMappings || []).filter((m: any) => m.active);

    // 2. Get latest FBA snapshot (fulfillable + transit)
    const { data: latestFbaDate } = await supabase
      .from("amazon_inventory_snapshots")
      .select("snapshot_date")
      .order("snapshot_date", { ascending: false })
      .limit(1)
      .single();

    const fbaByAsin = new Map<string, { fulfillable: number; transit: number }>();
    if (latestFbaDate) {
      const { data: fbaSnaps } = await supabase
        .from("amazon_inventory_snapshots")
        .select("asin, quantity_fulfillable, quantity_transit")
        .eq("snapshot_date", latestFbaDate.snapshot_date);
      for (const s of fbaSnaps || []) {
        fbaByAsin.set(s.asin, { fulfillable: s.quantity_fulfillable, transit: s.quantity_transit || 0 });
      }
    }

    // 3. Get 14-day Amazon sales by ASIN
    const now = new Date();
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const today = now.toISOString().split("T")[0];

    const { data: salesData } = await supabase
      .from("amazon_sales_snapshots")
      .select("asin, units_shipped")
      .gte("sale_date", fourteenDaysAgo)
      .lte("sale_date", today);

    const salesByAsin = new Map<string, number>();
    for (const r of salesData || []) {
      salesByAsin.set(r.asin, (salesByAsin.get(r.asin) || 0) + r.units_shipped);
    }

    // 4. Get external_skus for seller SKU info
    const { data: extSkus } = await supabase
      .from("external_skus")
      .select("external_id, seller_sku")
      .eq("source", "amazon");

    const sellerSkuByAsin = new Map<string, string>();
    for (const s of extSkus || []) {
      if (s.seller_sku) sellerSkuByAsin.set(s.external_id, s.seller_sku);
    }

    // 5. Build alerts
    const needsReplenishment = [];
    const inTransit = [];

    for (const mapping of mappings) {
      const asin = mapping.external_id;
      const fba = fbaByAsin.get(asin);
      const fulfillable = fba?.fulfillable || 0;
      const transit = fba?.transit || 0;
      const sales14d = salesByAsin.get(asin) || 0;
      const dailyBurn = sales14d / 14;
      const monthlyBurn = dailyBurn * 30;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const product = mapping.products as any;
      const productName = product?.quickbooks_name || asin;
      const multiplier = mapping.unit_multiplier || 1;
      const sellerSku = sellerSkuByAsin.get(asin) || mapping.label || asin;

      // Friendly display name
      const displayName = multiplier > 1
        ? `${productName} ${multiplier}-Pack`
        : productName;

      // Days of stock = fulfillable / daily burn
      const daysOfStock = dailyBurn > 0 ? Math.floor(fulfillable / dailyBurn) : 999;
      // Days including transit
      const daysWithTransit = dailyBurn > 0 ? Math.floor((fulfillable + transit) / dailyBurn) : 999;

      // In transit items
      if (transit > 0) {
        inTransit.push({
          asin,
          seller_sku: sellerSku,
          display_name: displayName,
          image_url: product?.image_url || null,
          fulfillable,
          transit,
          daily_burn: Math.round(dailyBurn * 10) / 10,
          days_until_stockout: daysOfStock,
        });
      }

      // Need replenishment: less than 30 days of stock (accounting for transit)
      if (dailyBurn > 0 && daysWithTransit < 30) {
        needsReplenishment.push({
          asin,
          seller_sku: sellerSku,
          display_name: displayName,
          image_url: product?.image_url || null,
          fulfillable,
          transit,
          daily_burn: Math.round(dailyBurn * 10) / 10,
          monthly_burn: Math.round(monthlyBurn),
          days_of_stock: daysOfStock,
          days_with_transit: daysWithTransit,
          suggested_qty: Math.max(0, Math.ceil(monthlyBurn * 2 - fulfillable - transit)),
          multiplier,
        });
      }
    }

    // Sort by urgency
    needsReplenishment.sort((a, b) => a.days_of_stock - b.days_of_stock);
    inTransit.sort((a, b) => b.transit - a.transit);

    return NextResponse.json({
      needs_replenishment: needsReplenishment,
      in_transit: inTransit,
      fba_snapshot_date: latestFbaDate?.snapshot_date || null,
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
