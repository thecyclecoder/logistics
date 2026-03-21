import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { origin } = new URL(request.url);
  const shop = "superfoodsco.myshopify.com";
  const clientId = process.env.SHOPIFY_CLIENT_ID!;
  const redirectUri = `${origin}/api/shopify/callback`;
  const scopes = "read_orders,read_products,read_inventory";
  const nonce = crypto.randomUUID();

  const params = new URLSearchParams({
    client_id: clientId,
    scope: scopes,
    redirect_uri: redirectUri,
    state: nonce,
  });

  return NextResponse.redirect(
    `https://${shop}/admin/oauth/authorize?${params}`
  );
}
