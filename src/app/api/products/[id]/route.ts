import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { z } from "zod";

const updateSchema = z.object({
  item_type: z.enum(["inventory", "bundle"]).optional(),
  bundle_id: z.string().uuid().nullable().optional(),
  bundle_quantity: z.number().int().nullable().optional(),
  reorder_point: z.number().int().optional(),
  category: z.string().nullable().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await request.json();
  const parsed = updateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("products")
    .update(parsed.data)
    .eq("id", params.id)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
