import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  product_id: z.string().uuid(),
  quantity: z.number().int(),
  location: z.string().min(1),
  note: z.string().optional().nullable(),
});

export async function GET() {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("manual_inventory")
    .select("*, products(quickbooks_name, sku, image_url)")
    .eq("active", true)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("manual_inventory")
    .insert(parsed.data)
    .select("*, products(quickbooks_name, sku, image_url)")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data, { status: 201 });
}
