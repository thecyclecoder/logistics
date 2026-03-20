import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { z } from "zod";

const createMappingSchema = z.object({
  product_id: z.string().uuid(),
  external_id: z.string().min(1),
  source: z.enum(["amazon", "3pl", "shopify", "manual"]),
  label: z.string().optional().nullable(),
});

const updateMappingSchema = z.object({
  id: z.string().uuid(),
  product_id: z.string().uuid().optional(),
  external_id: z.string().min(1).optional(),
  source: z.enum(["amazon", "3pl", "shopify", "manual"]).optional(),
  label: z.string().optional().nullable(),
});

export async function GET(request: NextRequest) {
  const supabase = createServiceClient();
  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") || "";
  const source = searchParams.get("source") || "";

  let query = supabase
    .from("sku_mappings")
    .select("*, products(quickbooks_name, sku)")
    .eq("active", true)
    .order("created_at", { ascending: false });

  if (source) {
    query = query.eq("source", source);
  }

  if (search) {
    query = query.or(
      `external_id.ilike.%${search}%,label.ilike.%${search}%,products.quickbooks_name.ilike.%${search}%`
    );
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = createMappingSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("sku_mappings")
    .insert(parsed.data)
    .select("*, products(quickbooks_name, sku)")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const body = await request.json();
  const parsed = updateMappingSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { id, ...updates } = parsed.data;
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("sku_mappings")
    .update(updates)
    .eq("id", id)
    .select("*, products(quickbooks_name, sku)")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
