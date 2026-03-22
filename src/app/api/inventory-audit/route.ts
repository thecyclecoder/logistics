import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createServiceClient();

  // 1. Products
  const { data: products } = await supabase
    .from("products")
    .select("id, quickbooks_name, sku, image_url, item_type, product_category, bundle_id, bundle_quantity, unit_cost")
    .eq("active", true);

  // 1b. BOM relationships (multi-parent support)
  const { data: bomRows } = await supabase
    .from("product_bom")
    .select("parent_id, component_id, quantity");

  // 2. SKU Mappings
  const { data: mappings } = await supabase
    .from("sku_mappings")
    .select("external_id, source, product_id, unit_multiplier")
    .eq("active", true);

  // 3. Latest FBA inventory
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

  // 4. Latest 3PL inventory
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
    for (const s of tplSnaps || []) {
      tplBySku.set(s.sku, s.quantity_available);
    }
  }

  // 5. Manual inventory — use direct REST call to bypass any client caching
  const manualRes = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/manual_inventory?select=product_id,quantity,location,note,active`,
    {
      headers: {
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
      },
      cache: "no-store",
    }
  );
  const manualEntriesAll = await manualRes.json();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const manualEntries = (manualEntriesAll || []).filter((m: any) => m.active);

  const manualByProduct = new Map<string, Array<{ quantity: number; location: string; note: string | null }>>();
  for (const m of manualEntries || []) {
    const list = manualByProduct.get(m.product_id) || [];
    list.push({ quantity: m.quantity, location: m.location, note: m.note });
    manualByProduct.set(m.product_id, list);
  }

  // 6. QB inventory snapshots (latest per product = end of prev month baseline)
  const { data: qbSnapshots } = await supabase
    .from("inventory_snapshots")
    .select("product_id, quantity, snapshot_at")
    .eq("source", "quickbooks")
    .order("snapshot_at", { ascending: false });

  const qbInventory = new Map<string, number>();
  for (const snap of qbSnapshots || []) {
    if (!qbInventory.has(snap.product_id)) {
      qbInventory.set(snap.product_id, snap.quantity);
    }
  }
  const qbSnapshotDate = qbSnapshots?.[0]?.snapshot_at?.split("T")[0] || null;

  // 7. Sales since month start (for burn calculation)
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

  const amzSalesByAsin = new Map<string, number>();
  for (const r of amazonSales || []) {
    amzSalesByAsin.set(r.asin, (amzSalesByAsin.get(r.asin) || 0) + r.units_shipped);
  }
  const shopSalesByVariant = new Map<string, number>();
  for (const r of shopifySales || []) {
    shopSalesByVariant.set(r.variant_id, (shopSalesByVariant.get(r.variant_id) || 0) + r.units_sold);
  }

  // Build indexes
  interface ProductInfo {
    id: string; name: string; sku: string | null; image_url: string | null;
    item_type: string; product_category: string | null;
    bundle_id: string | null; bundle_quantity: number | null;
  }
  const productById = new Map<string, ProductInfo>();
  for (const p of products || []) {
    productById.set(p.id, { id: p.id, name: p.quickbooks_name, sku: p.sku, image_url: p.image_url, item_type: p.item_type, product_category: p.product_category, bundle_id: p.bundle_id, bundle_quantity: p.bundle_quantity });
  }

  // Build BOM indexes from product_bom table (multi-parent support)
  // parentToComponents: parent_id → [{component_id, quantity}]
  // componentToParents: component_id → [{parent_id, quantity}]
  const parentToComponents = new Map<string, Array<{ component_id: string; quantity: number }>>();
  const componentToParents = new Map<string, Array<{ parent_id: string; quantity: number }>>();
  const componentIds = new Set<string>();

  for (const row of bomRows || []) {
    const pList = parentToComponents.get(row.parent_id) || [];
    pList.push({ component_id: row.component_id, quantity: Number(row.quantity) });
    parentToComponents.set(row.parent_id, pList);

    const cList = componentToParents.get(row.component_id) || [];
    cList.push({ parent_id: row.parent_id, quantity: Number(row.quantity) });
    componentToParents.set(row.component_id, cList);

    componentIds.add(row.component_id);
  }

  const mappingsByProduct = new Map<string, Array<{ external_id: string; source: string; multiplier: number }>>();
  for (const m of mappings || []) {
    const list = mappingsByProduct.get(m.product_id) || [];
    list.push({ external_id: m.external_id, source: m.source, multiplier: m.unit_multiplier || 1 });
    mappingsByProduct.set(m.product_id, list);
  }

  function getChannelInventory(productId: string) {
    const pm = mappingsByProduct.get(productId) || [];
    let fba = 0, fbaTransit = 0, tpl = 0;
    for (const m of pm) {
      if (m.source === "amazon") {
        const snap = fbaByAsin.get(m.external_id);
        fba += (snap?.fulfillable || 0) * m.multiplier;
        fbaTransit += (snap?.transit || 0) * m.multiplier;
      } else if (m.source === "3pl") {
        tpl += (tplBySku.get(m.external_id) || 0) * m.multiplier;
      }
    }
    const manualList = manualByProduct.get(productId) || [];
    const manual = manualList.reduce((s, m) => s + m.quantity, 0);
    return { fba, fba_transit: fbaTransit, tpl, manual, total: fba + fbaTransit + tpl + manual };
  }

  function getSalesBurn(productId: string) {
    const pm = mappingsByProduct.get(productId) || [];
    let amzSold = 0, shopSold = 0;
    for (const m of pm) {
      if (m.source === "amazon") { amzSold += (amzSalesByAsin.get(m.external_id) || 0) * m.multiplier; }
      else if (m.source === "shopify") { shopSold += (shopSalesByVariant.get(m.external_id) || 0) * m.multiplier; }
    }
    return { amazon_sold: amzSold, shopify_sold: shopSold, total_sold: amzSold + shopSold };
  }

  // Pre-compute total component burn across ALL parent Groups
  // For each component, sum (parent_sales × bom_qty) across all parents
  const componentTotalBurn = new Map<string, { amazon_sold: number; shopify_sold: number; total_sold: number }>();
  for (const [compId, parents] of Array.from(componentToParents)) {
    let totalAmz = 0, totalShop = 0;
    for (const { parent_id, quantity } of parents) {
      const parentBurn = getSalesBurn(parent_id);
      totalAmz += parentBurn.amazon_sold * quantity;
      totalShop += parentBurn.shopify_sold * quantity;
    }
    componentTotalBurn.set(compId, { amazon_sold: totalAmz, shopify_sold: totalShop, total_sold: totalAmz + totalShop });
  }

  // Pre-compute total implied inventory for each component across ALL parents
  const componentTotalImplied = new Map<string, { fba: number; fba_transit: number; tpl: number; manual: number; total: number }>();
  for (const [compId, parents] of Array.from(componentToParents)) {
    let totalFba = 0, totalTransit = 0, totalTpl = 0, totalManual = 0;
    for (const { parent_id, quantity } of parents) {
      const parentInv = getChannelInventory(parent_id);
      totalFba += parentInv.fba * quantity;
      totalTransit += parentInv.fba_transit * quantity;
      totalTpl += parentInv.tpl * quantity;
      totalManual += parentInv.manual * quantity;
    }
    const total = totalFba + totalTransit + totalTpl + totalManual;
    componentTotalImplied.set(compId, { fba: totalFba, fba_transit: totalTransit, tpl: totalTpl, manual: totalManual, total });
  }

  // Classify
  const bundles: ProductInfo[] = [];
  for (const p of Array.from(productById.values())) {
    if (p.item_type === "bundle") bundles.push(p);
  }

  const standaloneFinished: ProductInfo[] = [];
  const unattachedComponents: ProductInfo[] = [];
  for (const p of Array.from(productById.values())) {
    if (p.item_type === "bundle" || componentIds.has(p.id)) continue;
    if (p.product_category === "component") { unattachedComponents.push(p); }
    else { standaloneFinished.push(p); }
  }

  // Build output
  const finishedGoodsWithBOM = bundles.map((bundle) => {
    const inv = getChannelInventory(bundle.id);
    const burn = getSalesBurn(bundle.id);
    const components = parentToComponents.get(bundle.id) || [];

    // QB Start comes FROM components UP to parent
    let qbStart = 0;
    if (components.length > 0) {
      const componentStarts = components.map(({ component_id, quantity }) => {
        const compQb = qbInventory.get(component_id) || 0;
        return Math.floor(compQb / quantity);
      });
      qbStart = Math.min(...componentStarts);
    }

    const expected = qbStart - burn.total_sold;

    const bomItems = components.map(({ component_id, quantity: bomQty }) => {
      const comp = productById.get(component_id);
      if (!comp) return null;

      // QB Start: actual QB value for this component
      const compQbStart = qbInventory.get(comp.id) || 0;

      // Sales burn: use TOTAL burn across ALL parent Groups (not just this parent)
      const totalBurn = componentTotalBurn.get(comp.id) || { amazon_sold: 0, shopify_sold: 0, total_sold: 0 };
      const compExpected = compQbStart - totalBurn.total_sold;

      // Implied inventory from THIS parent only (for display)
      const impliedFba = inv.fba * bomQty;
      const impliedFbaTransit = inv.fba_transit * bomQty;
      const impliedTpl = inv.tpl * bomQty;
      const impliedManual = inv.manual * bomQty;
      const impliedTotal = inv.total * bomQty;

      // Total implied across ALL parents (for variance calculation)
      const totalImplied = componentTotalImplied.get(comp.id) || { fba: 0, fba_transit: 0, tpl: 0, manual: 0, total: 0 };

      const compInv = getChannelInventory(comp.id);
      const actualTotal = totalImplied.total + compInv.total;
      const compVariance = actualTotal - compExpected;

      return {
        product_id: comp.id, name: comp.name, sku: comp.sku, image_url: comp.image_url,
        bom_quantity: bomQty,
        qb_starting: compQbStart,
        amazon_sold: totalBurn.amazon_sold,
        shopify_sold: totalBurn.shopify_sold,
        total_sold: totalBurn.total_sold,
        expected_remaining: compExpected,
        implied_fba: impliedFba,
        implied_fba_transit: impliedFbaTransit,
        implied_tpl: impliedTpl,
        implied_manual: impliedManual,
        implied_total: impliedTotal,
        standalone_fba: compInv.fba,
        standalone_fba_transit: compInv.fba_transit,
        standalone_tpl: compInv.tpl,
        standalone_manual: compInv.manual,
        standalone_total: compInv.total,
        actual_total: actualTotal,
        variance: compVariance,
      };
    }).filter(Boolean);

    return {
      product_id: bundle.id, name: bundle.name, sku: bundle.sku, image_url: bundle.image_url,
      fba: inv.fba, fba_transit: inv.fba_transit, tpl: inv.tpl, manual: inv.manual, finished_good_units: inv.total,
      qb_starting: qbStart, amazon_sold: burn.amazon_sold, shopify_sold: burn.shopify_sold,
      total_sold: burn.total_sold, expected_remaining: expected,
      variance: inv.total - expected,
      bom_items: bomItems,
    };
  });

  const standaloneItems = standaloneFinished.map((p) => {
    const inv = getChannelInventory(p.id);
    const burn = getSalesBurn(p.id);
    const qbStart = qbInventory.get(p.id) || 0;
    const expected = qbStart - burn.total_sold;
    return {
      product_id: p.id, name: p.name, sku: p.sku, image_url: p.image_url,
      fba: inv.fba, fba_transit: inv.fba_transit, tpl: inv.tpl, manual: inv.manual, total: inv.total,
      qb_starting: qbStart, amazon_sold: burn.amazon_sold, shopify_sold: burn.shopify_sold,
      total_sold: burn.total_sold, expected_remaining: expected,
      variance: inv.total - expected,
    };
  });

  const unattachedItems = unattachedComponents.map((p) => {
    const inv = getChannelInventory(p.id);
    return {
      product_id: p.id, name: p.name, sku: p.sku, image_url: p.image_url,
      fba: inv.fba, fba_transit: inv.fba_transit, tpl: inv.tpl, manual: inv.manual, total: inv.total,
    };
  });

  const response = NextResponse.json({
    finished_goods_with_bom: finishedGoodsWithBOM.filter((fg) => fg.finished_good_units > 0 || fg.qb_starting > 0 || fg.bom_items.some((b) => b !== null && (b as { actual_total: number }).actual_total > 0)),
    standalone_finished_goods: standaloneItems.filter((i) => i.total > 0 || i.qb_starting > 0),
    unattached_components: unattachedItems.filter((i) => i.total > 0),
    meta: {
      qb_snapshot_date: qbSnapshotDate,
      sales_since: monthStart,
      fba_snapshot_date: latestFbaDate?.snapshot_date || null,
      tpl_snapshot_date: latestTplDate?.snapshot_date || null,
      manual_entries_count: manualEntries.length,
    },
  });
  response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
  return response;
}
