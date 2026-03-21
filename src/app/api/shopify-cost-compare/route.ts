import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getVariantCost } from "@/lib/integrations/shopify";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createServiceClient();

  // Fetch products
  const { data: products } = await supabase
    .from("products")
    .select(
      "id, quickbooks_name, sku, image_url, item_type, product_category, bundle_id, bundle_quantity, unit_cost"
    )
    .eq("active", true);

  // Build BOM component map: bundle_id -> components
  const bomMap = new Map<
    string,
    Array<{ unit_cost: number | null; quantity: number }>
  >();
  for (const p of products || []) {
    if (p.bundle_id) {
      const list = bomMap.get(p.bundle_id) || [];
      list.push({
        unit_cost: p.unit_cost ? Number(p.unit_cost) : null,
        quantity: p.bundle_quantity || 1,
      });
      bomMap.set(p.bundle_id, list);
    }
  }

  // Calculate costs per product
  const productCosts = new Map<
    string,
    {
      name: string;
      image_url: string | null;
      unit_cost: number | null;
      cost_incomplete: boolean;
    }
  >();

  for (const p of products || []) {
    // Skip components
    const isComponent =
      p.product_category === "component" ||
      (p.bundle_id && p.item_type === "inventory");
    if (isComponent) continue;

    let unitCost: number | null = null;
    let costIncomplete = false;

    if (p.item_type === "bundle") {
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
      if (unitCost === null) {
        costIncomplete = true;
      }
    }

    productCosts.set(p.id, {
      name: p.quickbooks_name,
      image_url: p.image_url,
      unit_cost: unitCost,
      cost_incomplete: costIncomplete,
    });
  }

  // Get Shopify sku_mappings
  const { data: mappings } = await supabase
    .from("sku_mappings")
    .select("external_id, product_id")
    .eq("source", "shopify")
    .eq("active", true);

  if (!mappings || mappings.length === 0) {
    return NextResponse.json({ items: [] });
  }

  // For each mapping, fetch variant cost from Shopify
  const items: Array<{
    product_name: string;
    image_url: string | null;
    qb_cost: number | null;
    shopify_cost: number | null;
    needs_sync: boolean;
    cost_incomplete: boolean;
    variant_id: string;
    shopify_variant_id: string;
  }> = [];

  for (const m of mappings) {
    const product = productCosts.get(m.product_id);
    if (!product) continue;

    // external_id format: "product_id-variant_id"
    const parts = m.external_id.split("-");
    const shopifyVariantId = parts.length > 1 ? parts[parts.length - 1] : parts[0];
    const numericVariantId = parseInt(shopifyVariantId, 10);

    if (isNaN(numericVariantId)) continue;

    let shopifyCost: number | null = null;
    try {
      const variantData = await getVariantCost(numericVariantId);
      if (variantData.cost !== null) {
        shopifyCost = parseFloat(variantData.cost);
      }
    } catch (err) {
      console.error(`Failed to fetch Shopify variant ${numericVariantId}:`, err);
      continue;
    }

    const qbCost = product.unit_cost;
    let needsSync = false;
    if (qbCost !== null && !product.cost_incomplete) {
      if (shopifyCost === null) {
        needsSync = true;
      } else {
        // Compare rounded to 4 decimals
        needsSync =
          Math.abs(qbCost - shopifyCost) > 0.0001;
      }
    }

    items.push({
      product_name: product.name,
      image_url: product.image_url,
      qb_cost: qbCost,
      shopify_cost: shopifyCost,
      needs_sync: needsSync,
      cost_incomplete: product.cost_incomplete,
      variant_id: m.external_id,
      shopify_variant_id: shopifyVariantId,
    });
  }

  return NextResponse.json({ items });
}
