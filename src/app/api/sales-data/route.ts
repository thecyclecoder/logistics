import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get("start") || "";
  const endDate = searchParams.get("end") || "";
  const channel = searchParams.get("channel") || "all";

  if (!startDate || !endDate) {
    return NextResponse.json({ error: "start and end required" }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Fetch product mappings (filter active in JS — .eq("active", true) returns 0 rows on Vercel)
  const { data: allMappings } = await supabase
    .from("sku_mappings")
    .select("external_id, source, product_id, unit_multiplier, active");

  const mappingLookup = new Map<string, { product_id: string; multiplier: number }>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const m of (allMappings || []).filter((m: any) => m.active)) {
    mappingLookup.set(`${m.external_id}::${m.source}`, {
      product_id: m.product_id,
      multiplier: m.unit_multiplier || 1,
    });
  }

  // Fetch products (filter active in JS — .eq("active", true) returns 0 rows on Vercel)
  const { data: allProducts_raw } = await supabase
    .from("products")
    .select("id, quickbooks_name, sku, image_url, item_type, product_category, bundle_id, bundle_quantity, unit_cost, active");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const products = (allProducts_raw || []).filter((p: any) => p.active);

  // Build product map and calculate BOM costs
  const productMap = new Map<string, {
    name: string;
    sku: string | null;
    image_url: string | null;
    isFinishedGood: boolean;
    unit_cost: number | null;
    cost_incomplete: boolean;
  }>();

  // First pass: index all products
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allProducts = new Map<string, any>();
  for (const p of products || []) {
    allProducts.set(p.id, p);
  }

  // Build BOM component map: bundle_id → components
  const bomMap = new Map<string, Array<{ unit_cost: number | null; quantity: number }>>();
  for (const p of products || []) {
    if (p.bundle_id) {
      const list = bomMap.get(p.bundle_id) || [];
      list.push({ unit_cost: p.unit_cost ? Number(p.unit_cost) : null, quantity: p.bundle_quantity || 1 });
      bomMap.set(p.bundle_id, list);
    }
  }

  for (const p of products || []) {
    const isComponent = p.product_category === "component" || (p.bundle_id && p.item_type === "inventory");

    let unitCost: number | null = null;
    let costIncomplete = false;

    if (p.item_type === "bundle") {
      // BOM cost = sum of component costs × quantities
      const components = bomMap.get(p.id) || [];
      if (components.length > 0) {
        let total = 0;
        for (const comp of components) {
          if (comp.unit_cost === null) {
            costIncomplete = true;
          } else {
            total += comp.unit_cost * comp.quantity;
          }
        }
        unitCost = total;
      }
    } else {
      unitCost = p.unit_cost ? Number(p.unit_cost) : null;
      if (unitCost === null) costIncomplete = true;
    }

    productMap.set(p.id, {
      name: p.quickbooks_name,
      sku: p.sku,
      image_url: p.image_url,
      isFinishedGood: !isComponent,
      unit_cost: unitCost,
      cost_incomplete: costIncomplete,
    });
  }

  // Aggregate sales by QB product
  const productSales = new Map<string, {
    product_id: string;
    name: string;
    sku: string | null;
    image_url: string | null;
    unit_cost: number | null;
    cost_incomplete: boolean;
    amazon: { units: number; revenue: number; orders: number; recurring: number; sns_checkout: number; one_time: number };
    shopify: { units: number; revenue: number; orders: number; recurring: number; first_sub: number; one_time: number };
  }>();

  const initProduct = (productId: string) => {
    const prod = productMap.get(productId);
    if (!prod || !prod.isFinishedGood) return null;
    if (!productSales.has(productId)) {
      productSales.set(productId, {
        product_id: productId,
        name: prod.name,
        sku: prod.sku,
        image_url: prod.image_url,
        unit_cost: prod.unit_cost,
        cost_incomplete: prod.cost_incomplete,
        amazon: { units: 0, revenue: 0, orders: 0, recurring: 0, sns_checkout: 0, one_time: 0 },
        shopify: { units: 0, revenue: 0, orders: 0, recurring: 0, first_sub: 0, one_time: 0 },
      });
    }
    return productSales.get(productId)!;
  };

  // Amazon sales
  if (channel === "all" || channel === "amazon") {
    const { data: amazonSales } = await supabase
      .from("amazon_sales_snapshots")
      .select("asin, units_shipped, revenue, recurring_units, recurring_revenue, sns_checkout_units, sns_checkout_revenue, one_time_units, one_time_revenue")
      .gte("sale_date", startDate)
      .lte("sale_date", endDate);

    for (const row of amazonSales || []) {
      const mapping = mappingLookup.get(`${row.asin}::amazon`);
      if (!mapping) continue;
      const ps = initProduct(mapping.product_id);
      if (!ps) continue;
      ps.amazon.units += row.units_shipped * mapping.multiplier;
      ps.amazon.revenue += Number(row.revenue);
      ps.amazon.orders += row.units_shipped; // Each line item = approximate order
      ps.amazon.recurring += row.recurring_units * mapping.multiplier;
      ps.amazon.sns_checkout += row.sns_checkout_units * mapping.multiplier;
      ps.amazon.one_time += row.one_time_units * mapping.multiplier;
    }
  }

  // Shopify sales
  if (channel === "all" || channel === "shopify") {
    const { data: shopifySales } = await supabase
      .from("shopify_sales_snapshots")
      .select("variant_id, units_sold, revenue, recurring_units, recurring_revenue, first_sub_units, first_sub_revenue, one_time_units, one_time_revenue")
      .gte("sale_date", startDate)
      .lte("sale_date", endDate);

    for (const row of shopifySales || []) {
      const mapping = mappingLookup.get(`${row.variant_id}::shopify`);
      if (!mapping) continue;
      const ps = initProduct(mapping.product_id);
      if (!ps) continue;
      ps.shopify.units += row.units_sold * mapping.multiplier;
      ps.shopify.revenue += Number(row.revenue);
      ps.shopify.orders += row.units_sold;
      ps.shopify.recurring += row.recurring_units * mapping.multiplier;
      ps.shopify.first_sub += row.first_sub_units * mapping.multiplier;
      ps.shopify.one_time += row.one_time_units * mapping.multiplier;
    }
  }

  const items = Array.from(productSales.values())
    .map((ps) => {
      const totalUnits = ps.amazon.units + ps.shopify.units;
      const totalRevenue = ps.amazon.revenue + ps.shopify.revenue;
      const totalOrders = ps.amazon.orders + ps.shopify.orders;
      const asp = totalUnits > 0 ? totalRevenue / totalUnits : 0;
      const aov = totalOrders > 0 ? totalRevenue / totalOrders : 0;
      const avgUnitsPerOrder = totalOrders > 0 ? totalUnits / totalOrders : 0;
      const totalCost = ps.unit_cost !== null ? ps.unit_cost * totalUnits : null;
      const margin = totalCost !== null && totalRevenue > 0
        ? ((totalRevenue - totalCost) / totalRevenue) * 100
        : null;

      return {
        ...ps,
        total_units: totalUnits,
        total_revenue: totalRevenue,
        total_orders: totalOrders,
        asp,
        aov,
        avg_units_per_order: avgUnitsPerOrder,
        total_cost: totalCost,
        margin,
      };
    })
    .filter((ps) => ps.total_units > 0 || ps.total_revenue > 0)
    .sort((a, b) => b.total_revenue - a.total_revenue);

  const totalUnits = items.reduce((s, i) => s + i.total_units, 0);
  const totalRevenue = items.reduce((s, i) => s + i.total_revenue, 0);
  const totalOrders = items.reduce((s, i) => s + i.total_orders, 0);
  const totalCostSum = items.reduce((s, i) => s + (i.total_cost || 0), 0);

  const totals = {
    units: totalUnits,
    revenue: totalRevenue,
    orders: totalOrders,
    amazon_units: items.reduce((s, i) => s + i.amazon.units, 0),
    amazon_revenue: items.reduce((s, i) => s + i.amazon.revenue, 0),
    shopify_units: items.reduce((s, i) => s + i.shopify.units, 0),
    shopify_revenue: items.reduce((s, i) => s + i.shopify.revenue, 0),
    recurring_units: items.reduce((s, i) => s + i.amazon.recurring + i.shopify.recurring, 0),
    sub_checkout_units: items.reduce((s, i) => s + i.amazon.sns_checkout + i.shopify.first_sub, 0),
    one_time_units: items.reduce((s, i) => s + i.amazon.one_time + i.shopify.one_time, 0),
    asp: totalUnits > 0 ? totalRevenue / totalUnits : 0,
    aov: totalOrders > 0 ? totalRevenue / totalOrders : 0,
    total_cost: totalCostSum,
    margin: totalRevenue > 0 ? ((totalRevenue - totalCostSum) / totalRevenue) * 100 : 0,
  };

  return NextResponse.json({ items, totals });
}
