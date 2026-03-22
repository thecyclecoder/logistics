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
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Filter active in JS — .eq("active", true) has a type issue in deployed env
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const filtered = (data || []).filter((m: any) => m.active);

  const response = NextResponse.json(filtered);
  response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
  return response;
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
