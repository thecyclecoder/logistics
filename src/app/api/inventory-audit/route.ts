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

  const fbaByAsin = new Map<string, number>();
  if (latestFbaDate) {
    const { data: fbaSnaps } = await supabase
      .from("amazon_inventory_snapshots")
      .select("asin, quantity_fulfillable")
      .eq("snapshot_date", latestFbaDate.snapshot_date);
    for (const s of fbaSnaps || []) {
      fbaByAsin.set(s.asin, s.quantity_fulfillable);
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

  // 5. Manual inventory
  const { data: manualEntries } = await supabase
    .from("manual_inventory")
    .select("product_id, quantity, location, note")
    .eq("active", true);

  const manualByProduct = new Map<string, Array<{ quantity: number; location: string; note: string | null }>>();
  for (const m of manualEntries || []) {
    const list = manualByProduct.get(m.product_id) || [];
    list.push({ quantity: m.quantity, location: m.location, note: m.note });
    manualByProduct.set(m.product_id, list);
  }

  // Build product index
  interface ProductInfo {
    id: string;
    name: string;
    sku: string | null;
    image_url: string | null;
    item_type: string;
    product_category: string | null;
    bundle_id: string | null;
    bundle_quantity: number | null;
  }
  const productById = new Map<string, ProductInfo>();
  for (const p of products || []) {
    productById.set(p.id, {
      id: p.id,
      name: p.quickbooks_name,
      sku: p.sku,
      image_url: p.image_url,
      item_type: p.item_type,
      product_category: p.product_category,
      bundle_id: p.bundle_id,
      bundle_quantity: p.bundle_quantity,
    });
  }

  // Mapping lookup
  const mappingsByProduct = new Map<string, Array<{ external_id: string; source: string; multiplier: number }>>();
  for (const m of mappings || []) {
    const list = mappingsByProduct.get(m.product_id) || [];
    list.push({ external_id: m.external_id, source: m.source, multiplier: m.unit_multiplier || 1 });
    mappingsByProduct.set(m.product_id, list);
  }

  function getChannelInventory(productId: string) {
    const productMappings = mappingsByProduct.get(productId) || [];
    let fba = 0;
    let tpl = 0;
    for (const m of productMappings) {
      if (m.source === "amazon") {
        fba += (fbaByAsin.get(m.external_id) || 0) * m.multiplier;
      } else if (m.source === "3pl") {
        tpl += (tplBySku.get(m.external_id) || 0) * m.multiplier;
      }
    }
    const manualList = manualByProduct.get(productId) || [];
    const manual = manualList.reduce((s, m) => s + m.quantity, 0);
    return { fba, tpl, manual, manual_entries: manualList, total: fba + tpl + manual };
  }

  // Classify products
  const bundles: ProductInfo[] = [];
  const bomComponents = new Map<string, ProductInfo[]>();
  const componentIds = new Set<string>();

  for (const p of Array.from(productById.values())) {
    if (p.item_type === "bundle") {
      bundles.push(p);
    } else if (p.bundle_id) {
      componentIds.add(p.id);
      const list = bomComponents.get(p.bundle_id) || [];
      list.push(p);
      bomComponents.set(p.bundle_id, list);
    }
  }

  const standaloneFinished: ProductInfo[] = [];
  const unattachedComponents: ProductInfo[] = [];

  for (const p of Array.from(productById.values())) {
    if (p.item_type === "bundle") continue;
    if (componentIds.has(p.id)) continue;
    if (p.product_category === "component") {
      unattachedComponents.push(p);
    } else {
      standaloneFinished.push(p);
    }
  }

  // Build finished goods with BOM
  const finishedGoodsWithBOM = bundles.map((bundle) => {
    const inv = getChannelInventory(bundle.id);
    const components = bomComponents.get(bundle.id) || [];

    const bomItems = components.map((comp) => {
      const bomQty = comp.bundle_quantity || 1;
      const impliedFromParent = inv.total * bomQty;
      const compInv = getChannelInventory(comp.id);

      return {
        product_id: comp.id,
        name: comp.name,
        sku: comp.sku,
        image_url: comp.image_url,
        bom_quantity: bomQty,
        implied_units: impliedFromParent,
        standalone_fba: compInv.fba,
        standalone_tpl: compInv.tpl,
        standalone_manual: compInv.manual,
        standalone_manual_entries: compInv.manual_entries,
        standalone_total: compInv.total,
        total_inventory: impliedFromParent + compInv.total,
      };
    });

    return {
      product_id: bundle.id,
      name: bundle.name,
      sku: bundle.sku,
      image_url: bundle.image_url,
      fba: inv.fba,
      tpl: inv.tpl,
      manual: inv.manual,
      manual_entries: inv.manual_entries,
      finished_good_units: inv.total,
      bom_items: bomItems,
    };
  }).filter((fg) => fg.finished_good_units > 0 || fg.bom_items.some((b) => b.total_inventory > 0));

  const standaloneItems = standaloneFinished
    .map((p) => ({ ...p, ...getChannelInventory(p.id) }))
    .filter((i) => i.total > 0);

  const unattachedItems = unattachedComponents
    .map((p) => ({ ...p, ...getChannelInventory(p.id) }))
    .filter((i) => i.total > 0);

  return NextResponse.json({
    finished_goods_with_bom: finishedGoodsWithBOM,
    standalone_finished_goods: standaloneItems,
    unattached_components: unattachedItems,
    meta: {
      fba_snapshot_date: latestFbaDate?.snapshot_date || null,
      tpl_snapshot_date: latestTplDate?.snapshot_date || null,
    },
  });
}
