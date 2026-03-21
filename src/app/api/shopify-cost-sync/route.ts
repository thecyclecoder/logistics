import { NextRequest, NextResponse } from "next/server";
import {
  getVariantCost,
  updateVariantCost,
} from "@/lib/integrations/shopify";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { variant_id, cost } = body as { variant_id: string; cost: number };

  if (!variant_id || cost === undefined || cost === null) {
    return NextResponse.json(
      { error: "variant_id and cost are required" },
      { status: 400 }
    );
  }

  // Extract numeric Shopify variant ID from "product_id-variant_id" format
  const parts = variant_id.split("-");
  const shopifyVariantId = parts.length > 1 ? parts[parts.length - 1] : parts[0];
  const numericVariantId = parseInt(shopifyVariantId, 10);

  if (isNaN(numericVariantId)) {
    return NextResponse.json(
      { error: "Invalid variant_id format" },
      { status: 400 }
    );
  }

  try {
    // Get inventory_item_id from the variant
    const variantData = await getVariantCost(numericVariantId);
    const inventoryItemId = variantData.inventory_item_id;

    if (!inventoryItemId) {
      return NextResponse.json(
        { error: "Could not find inventory_item_id for variant" },
        { status: 404 }
      );
    }

    // Update the cost on the inventory item
    await updateVariantCost(inventoryItemId, cost);

    return NextResponse.json({ success: true, variant_id, cost });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Cost sync failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
