import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createServiceClient();

  // 1. Get QB inventory (last sync = end of previous month baseline)
  const { data: qbSnapshots } = await supabase
    .from("inventory_snapshots")
    .select("product_id, quantity, snapshot_at")
    .eq("source", "quickbooks")
    .order("snapshot_at", { ascending: false });

  // Get latest QB snapshot per product
  const qbInventory = new Map<string, number>();
  const qbSnapshotDate = qbSnapshots?.[0]?.snapshot_at?.split("T")[0] || null;
  for (const snap of qbSnapshots || []) {
    if (!qbInventory.has(snap.product_id)) {
      qbInventory.set(snap.product_id, snap.quantity);
    }
  }

  // 2. Get products (finished goods only)
  const { data: products } = await supabase
    .from("products")
    .select("id, quickbooks_name, sku, image_url, item_type, product_category, bundle_id")
    .eq("active", true);

  const productMap = new Map<string, {
    name: string;
    sku: string | null;
    image_url: string | null;
    isFinishedGood: boolean;
  }>();

  for (const p of products || []) {
    const isComponent = p.product_category === "component" || (p.bundle_id && p.item_type === "inventory");
    productMap.set(p.id, {
      name: p.quickbooks_name,
      sku: p.sku,
      image_url: p.image_url,
      isFinishedGood: !isComponent,
    });
  }

  // 3. Get SKU mappings
  const { data: mappings } = await supabase
    .from("sku_mappings")
    .select("external_id, source, product_id, unit_multiplier")
    .eq("active", true);

  const mappingsByProduct = new Map<string, Array<{ external_id: string; source: string; multiplier: number }>>();
  for (const m of mappings || []) {
    const list = mappingsByProduct.get(m.product_id) || [];
    list.push({ external_id: m.external_id, source: m.source, multiplier: m.unit_multiplier || 1 });
    mappingsByProduct.set(m.product_id, list);
  }

  // 4. Calculate sales since QB snapshot date (start of current month)
  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

  const { data: amazonSales } = await supabase
    .from("amazon_sales_snapshots")
    .select("asin, units_shipped")
    .gte("sale_date", monthStart);

  const { data: shopifySales } = await supabase
    .from("shopify_sales_snapshots")
    .select("variant_id, units_sold")
    .gte("sale_date", monthStart);

  // Map sales to products
  const amazonSalesByMapping = new Map<string, number>();
  for (const row of amazonSales || []) {
    amazonSalesByMapping.set(row.asin, (amazonSalesByMapping.get(row.asin) || 0) + row.units_shipped);
  }

  const shopifySalesByMapping = new Map<string, number>();
  for (const row of shopifySales || []) {
    shopifySalesByMapping.set(row.variant_id, (shopifySalesByMapping.get(row.variant_id) || 0) + row.units_sold);
  }

  // 5. Get current FBA inventory (latest snapshot)
  const { data: latestFbaDate } = await supabase
    .from("amazon_inventory_snapshots")
    .select("snapshot_date")
    .order("snapshot_date", { ascending: false })
    .limit(1)
    .single();

  const fbaByAsin = new Map<string, number>();
  if (latestFbaDate) {
    const { data: fbaSnaps } = await supabase
      .from("amazon_inventory_snapshots")
      .select("asin, quantity_fulfillable")
      .eq("snapshot_date", latestFbaDate.snapshot_date);
    for (const snap of fbaSnaps || []) {
      fbaByAsin.set(snap.asin, snap.quantity_fulfillable);
    }
  }

  // 6. Get current 3PL inventory (latest snapshot)
  const { data: latestTplDate } = await supabase
    .from("tpl_inventory_snapshots")
    .select("snapshot_date")
    .order("snapshot_date", { ascending: false })
    .limit(1)
    .single();

  const tplBySku = new Map<string, number>();
  if (latestTplDate) {
    const { data: tplSnaps } = await supabase
      .from("tpl_inventory_snapshots")
      .select("sku, quantity_available")
      .eq("snapshot_date", latestTplDate.snapshot_date);
    for (const snap of tplSnaps || []) {
      tplBySku.set(snap.sku, snap.quantity_available);
    }
  }

  // 7. Build audit for each finished good product
  const audit = [];

  for (const [productId, prod] of Array.from(productMap.entries())) {
    if (!prod.isFinishedGood) continue;

    const qbQty = qbInventory.get(productId) || 0;
    if (qbQty === 0 && !mappingsByProduct.has(productId)) continue;

    const productMappings = mappingsByProduct.get(productId) || [];

    // Calculate total sold since month start
    let amazonSold = 0;
    let shopifySold = 0;
    let currentFba = 0;
    let currentTpl = 0;

    for (const mapping of productMappings) {
      if (mapping.source === "amazon") {
        const sold = amazonSalesByMapping.get(mapping.external_id) || 0;
        amazonSold += sold * mapping.multiplier;
        const fba = fbaByAsin.get(mapping.external_id) || 0;
        currentFba += fba * mapping.multiplier;
      } else if (mapping.source === "shopify") {
        const sold = shopifySalesByMapping.get(mapping.external_id) || 0;
        shopifySold += sold * mapping.multiplier;
      } else if (mapping.source === "3pl") {
        const tpl = tplBySku.get(mapping.external_id) || 0;
        currentTpl += tpl * mapping.multiplier;
      }
    }

    const totalSold = amazonSold + shopifySold;
    const expectedRemaining = qbQty - totalSold;
    const actualOnHand = currentFba + currentTpl;
    const variance = actualOnHand - expectedRemaining;

    audit.push({
      product_id: productId,
      name: prod.name,
      sku: prod.sku,
      image_url: prod.image_url,
      qb_starting: qbQty,
      amazon_sold: amazonSold,
      shopify_sold: shopifySold,
      total_sold: totalSold,
      expected_remaining: expectedRemaining,
      current_fba: currentFba,
      current_tpl: currentTpl,
      actual_on_hand: actualOnHand,
      variance,
    });
  }

  // Sort by absolute variance descending (biggest discrepancies first)
  audit.sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance));

  return NextResponse.json({
    audit,
    meta: {
      qb_snapshot_date: qbSnapshotDate,
      sales_since: monthStart,
      fba_snapshot_date: latestFbaDate?.snapshot_date || null,
      tpl_snapshot_date: latestTplDate?.snapshot_date || null,
    },
  });
}
