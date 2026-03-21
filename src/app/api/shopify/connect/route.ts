import { NextResponse } from "next/server";
import { getCredentials } from "@/lib/credentials";

export async function GET() {
  const creds = await getCredentials("shopify");
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://logistics-beige-seven.vercel.app";
  const shop = "superfoodsco.myshopify.com";
  const redirectUri = `${baseUrl}/api/shopify/callback`;
  const scopes = "read_orders,read_products,read_inventory";
  const nonce = crypto.randomUUID();

  const params = new URLSearchParams({
    client_id: creds.client_id,
    scope: scopes,
    redirect_uri: redirectUri,
    state: nonce,
  });

  return NextResponse.redirect(
    `https://${shop}/admin/oauth/authorize?${params}`
  );
}
