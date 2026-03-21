import { NextResponse } from "next/server";

export async function GET() {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://logistics-beige-seven.vercel.app";
  const shop = "superfoodsco.myshopify.com";
  const clientId = process.env.SHOPIFY_CLIENT_ID!;
  const redirectUri = `${baseUrl}/api/shopify/callback`;
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
