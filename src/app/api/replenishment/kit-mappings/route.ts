import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = createServiceClient();

    // Get all kit mappings
    const { data: mappings, error: mapErr } = await supabase
      .from("kit_mappings")
      .select("*")
      .order("created_at", { ascending: false });

    if (mapErr) throw mapErr;

    // Get Amazon SKU mappings with product info for the product select
    const { data: allSkuMappings } = await supabase
      .from("sku_mappings")
      .select("external_id, product_id, unit_multiplier, active, label, products(id, quickbooks_name, image_url, item_type)")
      .eq("source", "amazon");

    // Filter active in JS (Supabase boolean filter quirk)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const skuMappings = (allSkuMappings || []).filter((m: any) => m.active);

    // Build friendly Amazon product list
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const amazonProducts = skuMappings.map((m: any) => {
      const product = m.products;
      const multiplier = m.unit_multiplier || 1;
      const name = product?.quickbooks_name || m.external_id;
      return {
        asin: m.external_id,
        product_id: m.product_id,
        name: multiplier > 1 ? `${name} ${multiplier}-Pack` : name,
        image_url: product?.image_url || null,
        item_type: product?.item_type || null,
        multiplier,
      };
    });

    // Sort by name
    amazonProducts.sort((a: { name: string }, b: { name: string }) =>
      a.name.localeCompare(b.name)
    );

    // Get 3PL SKU mappings with product info for the Amplifier kit select
    const { data: allTplMappings } = await supabase
      .from("sku_mappings")
      .select("external_id, product_id, unit_multiplier, active, label, products(id, quickbooks_name, image_url, item_type)")
      .eq("source", "3pl");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tplMappings = (allTplMappings || []).filter((m: any) => m.active);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tplProducts = tplMappings.map((m: any) => {
      const product = m.products;
      const multiplier = m.unit_multiplier || 1;
      const name = product?.quickbooks_name || m.external_id;
      return {
        sku: m.external_id,
        product_id: m.product_id,
        name: multiplier > 1 ? `${name} ${multiplier}-Pack` : name,
        image_url: product?.image_url || null,
        label: m.label || null,
        multiplier,
      };
    });

    tplProducts.sort((a: { name: string }, b: { name: string }) =>
      a.name.localeCompare(b.name)
    );

    // Get latest FBA inventory snapshot
    const { data: latestFbaDate } = await supabase
      .from("amazon_inventory_snapshots")
      .select("snapshot_date")
      .order("snapshot_date", { ascending: false })
      .limit(1)
      .single();

    const fbaInventory: Record<string, { fulfillable: number; inbound: number }> = {};
    if (latestFbaDate) {
      const { data: fbaSnaps } = await supabase
        .from("amazon_inventory_snapshots")
        .select("asin, quantity_fulfillable, quantity_inbound")
        .eq("snapshot_date", latestFbaDate.snapshot_date);
      for (const s of fbaSnaps || []) {
        fbaInventory[s.asin] = {
          fulfillable: s.quantity_fulfillable,
          inbound: s.quantity_inbound || 0,
        };
      }
    }

    // Get latest 3PL inventory snapshot
    const { data: latestTplDate } = await supabase
      .from("tpl_inventory_snapshots")
      .select("snapshot_date")
      .order("snapshot_date", { ascending: false })
      .limit(1)
      .single();

    const tplInventory: Record<string, { available: number; on_hand: number }> = {};
    if (latestTplDate) {
      const { data: tplSnaps } = await supabase
        .from("tpl_inventory_snapshots")
        .select("sku, quantity_available, quantity_on_hand")
        .eq("snapshot_date", latestTplDate.snapshot_date);
      for (const s of tplSnaps || []) {
        tplInventory[s.sku] = {
          available: s.quantity_available,
          on_hand: s.quantity_on_hand,
        };
      }
    }

    return NextResponse.json({
      mappings: mappings || [],
      amazon_products: amazonProducts,
      tpl_products: tplProducts,
      fba_inventory: fbaInventory,
      tpl_inventory: tplInventory,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const body = await request.json();

    const { asin, amplifier_kit_sku, transparency_enrolled, notes } = body;
    if (!asin || !amplifier_kit_sku) {
      return NextResponse.json(
        { error: "asin and amplifier_kit_sku are required" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("kit_mappings")
      .insert({
        asin,
        amplifier_kit_sku,
        transparency_enrolled: transparency_enrolled || false,
        notes: notes || null,
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from("kit_mappings")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const { error } = await supabase
      .from("kit_mappings")
      .delete()
      .eq("id", id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
