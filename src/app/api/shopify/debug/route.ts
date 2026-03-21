import { NextResponse } from "next/server";
import { getCredentials } from "@/lib/credentials";

export async function GET() {
  const creds = await getCredentials("shopify");
  const shop = "superfoodsco.myshopify.com";

  const params = new URLSearchParams({
    client_id: creds.client_id,
    scope: "read_orders,read_products,read_inventory",
    redirect_uri: "https://logistics-beige-seven.vercel.app/api/shopify/callback",
    state: "test",
  });

  return NextResponse.json({
    authorize_url: `https://${shop}/admin/oauth/authorize?${params}`,
    client_id: creds.client_id,
    redirect_uri: "https://logistics-beige-seven.vercel.app/api/shopify/callback",
    site_url_env: process.env.NEXT_PUBLIC_SITE_URL || "NOT SET",
  });
}
