import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const source = searchParams.get("source") || "";
  const includeDismissed = searchParams.get("include_dismissed") === "true";

  const supabase = createServiceClient();
  let query = supabase
    .from("external_skus")
    .select("id, external_id, source, label, title, image_url, price, parent_asin, item_type, quantity, seller_sku, dismissed")
    .order("external_id");

  if (source) {
    query = query.eq("source", source);
  }

  if (!includeDismissed) {
    query = query.eq("dismissed", false);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Also include which ones are already mapped
  const { data: mappings } = await supabase
    .from("sku_mappings")
    .select("external_id, source, product_id, products(quickbooks_name)")
    .eq("active", true);

  const mappedSet = new Map<string, string>();
  for (const m of mappings || []) {
    mappedSet.set(
      `${m.external_id}::${m.source}`,
      (m.products as unknown as { quickbooks_name: string } | null)?.quickbooks_name || ""
    );
  }

  const enriched = (data || []).map((sku) => ({
    ...sku,
    mapped: mappedSet.has(`${sku.external_id}::${sku.source}`),
    mapped_to: mappedSet.get(`${sku.external_id}::${sku.source}`) || null,
  }));

  return NextResponse.json(enriched);
}

export async function PATCH(request: NextRequest) {
  const body = await request.json();
  const { ids, dismissed } = body as { ids: string[]; dismissed: boolean };

  if (!ids?.length) {
    return NextResponse.json({ error: "ids required" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { error } = await supabase
    .from("external_skus")
    .update({ dismissed })
    .in("id", ids);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
