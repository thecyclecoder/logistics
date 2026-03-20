import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const source = searchParams.get("source") || "";

  const supabase = createServiceClient();
  let query = supabase
    .from("external_skus")
    .select("external_id, source, label")
    .order("external_id");

  if (source) {
    query = query.eq("source", source);
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
