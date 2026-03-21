import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("products")
    .select("id, quickbooks_name, sku, image_url, item_type, product_category, bundle_id")
    .eq("active", true)
    .order("quickbooks_name");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
