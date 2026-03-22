import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const PROCESSOR_OPTIONS = [
  { value: "shopify_payments", label: "Shopify Payments" },
  { value: "paypal", label: "PayPal" },
  { value: "braintree", label: "Braintree" },
  { value: "gift_card", label: "Gift Card" },
  { value: "walmart", label: "Walmart" },
  { value: "other", label: "Other" },
];

export async function GET() {
  try {
    const supabase = createServiceClient();
    const { data: mappings } = await supabase
      .from("gateway_mappings")
      .select("gateway_name, processor")
      .order("gateway_name");

    return NextResponse.json({
      mappings: mappings || [],
      processor_options: PROCESSOR_OPTIONS,
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const { gateway_name, processor } = await request.json();

    if (!gateway_name || !processor) {
      return NextResponse.json({ error: "gateway_name and processor required" }, { status: 400 });
    }

    const validProcessors = PROCESSOR_OPTIONS.map((p) => p.value);
    if (!validProcessors.includes(processor)) {
      return NextResponse.json({ error: "Invalid processor" }, { status: 400 });
    }

    const { error } = await supabase.from("gateway_mappings").upsert(
      { gateway_name, processor },
      { onConflict: "gateway_name" }
    );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
