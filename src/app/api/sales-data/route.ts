import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get("start") || "";
  const endDate = searchParams.get("end") || "";
  const channel = searchParams.get("channel") || "all"; // all, amazon, shopify

  if (!startDate || !endDate) {
    return NextResponse.json({ error: "start and end required" }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Fetch product mappings to resolve to QB products
  const { data: mappings } = await supabase
    .from("sku_mappings")
    .select("external_id, source, product_id, unit_multiplier")
    .eq("active", true);

  const mappingLookup = new Map<string, { product_id: string; multiplier: number }>();
  for (const m of mappings || []) {
    mappingLookup.set(`${m.external_id}::${m.source}`, {
      product_id: m.product_id,
      multiplier: m.unit_multiplier || 1,
    });
  }

  // Fetch products (only finished goods)
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

  // Aggregate by QB product
  const productSales = new Map<string, {
    product_id: string;
    name: string;
    sku: string | null;
    image_url: string | null;
    amazon: { units: number; revenue: number; recurring: number; sns_checkout: number; one_time: number };
    shopify: { units: number; revenue: number; recurring: number; first_sub: number; one_time: number };
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
        amazon: { units: 0, revenue: 0, recurring: 0, sns_checkout: 0, one_time: 0 },
        shopify: { units: 0, revenue: 0, recurring: 0, first_sub: 0, one_time: 0 },
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
      ps.shopify.recurring += row.recurring_units * mapping.multiplier;
      ps.shopify.first_sub += row.first_sub_units * mapping.multiplier;
      ps.shopify.one_time += row.one_time_units * mapping.multiplier;
    }
  }

  // Build response
  const items = Array.from(productSales.values())
    .map((ps) => ({
      ...ps,
      total_units: ps.amazon.units + ps.shopify.units,
      total_revenue: ps.amazon.revenue + ps.shopify.revenue,
    }))
    .filter((ps) => ps.total_units > 0 || ps.total_revenue > 0)
    .sort((a, b) => b.total_revenue - a.total_revenue);

  const totals = {
    units: items.reduce((s, i) => s + i.total_units, 0),
    revenue: items.reduce((s, i) => s + i.total_revenue, 0),
    amazon_units: items.reduce((s, i) => s + i.amazon.units, 0),
    amazon_revenue: items.reduce((s, i) => s + i.amazon.revenue, 0),
    shopify_units: items.reduce((s, i) => s + i.shopify.units, 0),
    shopify_revenue: items.reduce((s, i) => s + i.shopify.revenue, 0),
    recurring_units: items.reduce((s, i) => s + i.amazon.recurring + i.shopify.recurring, 0),
    sub_checkout_units: items.reduce((s, i) => s + i.amazon.sns_checkout + i.shopify.first_sub, 0),
    one_time_units: items.reduce((s, i) => s + i.amazon.one_time + i.shopify.one_time, 0),
  };

  return NextResponse.json({ items, totals });
}
