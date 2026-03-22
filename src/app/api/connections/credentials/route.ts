import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const { integration, credentials } = await request.json();

    if (!integration || !credentials) {
      return NextResponse.json({ error: "integration and credentials required" }, { status: 400 });
    }

    const validIntegrations = ["amazon", "quickbooks", "shopify", "amplifier", "paypal", "braintree"];
    if (!validIntegrations.includes(integration)) {
      return NextResponse.json({ error: "Invalid integration" }, { status: 400 });
    }

    const supabase = createServiceClient();
    const { error } = await supabase.from("integration_credentials").upsert({
      id: integration,
      credentials,
      updated_at: new Date().toISOString(),
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
