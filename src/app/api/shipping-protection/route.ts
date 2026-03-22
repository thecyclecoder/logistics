import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET() {
  try {
    const supabase = createServiceClient();
    const { data: flagged } = await supabase
      .from("shipping_protection_products")
      .select("shopify_product_id, title");

    // Also get all unique Shopify products from recent orders for the selector
    const shopRes = await fetch(`${SUPABASE_URL}/rest/v1/shopify_tokens?select=shop_domain,access_token&limit=1`, {
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
      cache: "no-store",
    });
    const shopToken = (await shopRes.json())?.[0];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let shopifyProducts: any[] = [];
    if (shopToken) {
      const res = await fetch(
        `https://${shopToken.shop_domain}/admin/api/2024-01/products.json?limit=250&fields=id,title,product_type`,
        { headers: { "X-Shopify-Access-Token": shopToken.access_token } }
      );
      if (res.ok) {
        const data = await res.json();
        shopifyProducts = (data.products || []).map((p: { id: number; title: string; product_type: string }) => ({
          id: String(p.id),
          title: p.title,
          product_type: p.product_type,
        }));
      }
    }

    return NextResponse.json({
      flagged: flagged || [],
      shopify_products: shopifyProducts,
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const { shopify_product_id, title } = await request.json();

    if (!shopify_product_id) {
      return NextResponse.json({ error: "shopify_product_id required" }, { status: 400 });
    }

    const { error } = await supabase.from("shipping_protection_products").upsert(
      { shopify_product_id, title: title || "Shipping Protection" },
      { onConflict: "shopify_product_id" }
    );

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const { shopify_product_id } = await request.json();

    if (!shopify_product_id) {
      return NextResponse.json({ error: "shopify_product_id required" }, { status: 400 });
    }

    await supabase.from("shipping_protection_products").delete().eq("shopify_product_id", shopify_product_id);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
