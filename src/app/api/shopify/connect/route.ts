import { NextResponse } from "next/server";
import { getCredentials } from "@/lib/credentials";

export async function GET() {
  const creds = await getCredentials("shopify");
  const shopName = creds.shop_name;
  if (!shopName) {
    return NextResponse.json(
      { error: "Shop name not configured. Set it in Connections → Shopify." },
      { status: 400 }
    );
  }

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL!;
  const scopes = "read_orders,read_products,read_inventory";
  const nonce = crypto.randomUUID();

  const params = new URLSearchParams({
    client_id: creds.client_id,
    scope: scopes,
    redirect_uri: `${baseUrl}/api/shopify/callback`,
    state: nonce,
  });

  return NextResponse.redirect(
    `https://${shopName}.myshopify.com/admin/oauth/authorize?${params}`
  );
}
