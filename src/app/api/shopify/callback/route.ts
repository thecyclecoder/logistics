import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getCredentials } from "@/lib/credentials";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const shop = searchParams.get("shop");

  if (!code || !shop) {
    return NextResponse.json(
      { error: "Missing code or shop parameter" },
      { status: 400 }
    );
  }

  const creds = await getCredentials("shopify");

  const res = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: creds.client_id,
      client_secret: creds.client_secret,
      code,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json(
      { error: "Token exchange failed", details: text },
      { status: 500 }
    );
  }

  const data = await res.json();

  // Store tokens in DB
  const supabase = createServiceClient();
  await supabase.from("shopify_tokens").upsert({
    id: "current",
    shop_domain: shop,
    access_token: data.access_token,
    updated_at: new Date().toISOString(),
  });

  return NextResponse.redirect(`${origin}/dashboard/connections/shopify`);
}
