import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getCredentials } from "@/lib/credentials";

export const dynamic = "force-dynamic";

const QB_TOKEN_URL = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";

const CHANNEL_CONFIG = {
  amazon: {
    customerRef: "40",     // Amazon Customer
    depositAccount: "117", // Amazon Carried Balances
    memo: "Amazon COGS - ",
  },
  shopify: {
    customerRef: "30410",  // Shopify Customer
    depositAccount: "589", // Shopify
    memo: "Shopify COGS - ",
  },
} as const;

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { channel, month } = body as { channel: "amazon" | "shopify"; month: string };

  if (!channel || !month || !CHANNEL_CONFIG[channel]) {
    return NextResponse.json({ error: "channel (amazon|shopify) and month (YYYY-MM) required" }, { status: 400 });
  }

  // Parse month to get date range and last day
  const [year, mon] = month.split("-").map(Number);
  const lastDay = new Date(year, mon, 0);
  const txnDate = lastDay.toISOString().split("T")[0];
  const startDate = `${month}-01`;
  const endDate = txnDate;

  const supabase = createServiceClient();

  // Get sales data for the month
  let salesByProduct: Map<string, { product_id: string; units: number }>;

  if (channel === "amazon") {
    const { data } = await supabase
      .from("amazon_sales_snapshots")
      .select("asin, units_shipped")
      .gte("sale_date", startDate)
      .lte("sale_date", endDate);

    // Get mappings to resolve ASINs to products
    const { data: mappings } = await supabase
      .from("sku_mappings")
      .select("external_id, product_id, unit_multiplier")
      .eq("source", "amazon")
      .eq("active", true);

    const mappingLookup = new Map<string, { product_id: string; multiplier: number }>();
    for (const m of mappings || []) {
      mappingLookup.set(m.external_id, { product_id: m.product_id, multiplier: m.unit_multiplier || 1 });
    }

    salesByProduct = new Map();
    for (const row of data || []) {
      const mapping = mappingLookup.get(row.asin);
      if (!mapping) continue;
      const key = mapping.product_id;
      if (!salesByProduct.has(key)) {
        salesByProduct.set(key, { product_id: key, units: 0 });
      }
      salesByProduct.get(key)!.units += row.units_shipped * mapping.multiplier;
    }
  } else {
    const { data } = await supabase
      .from("shopify_sales_snapshots")
      .select("variant_id, units_sold")
      .gte("sale_date", startDate)
      .lte("sale_date", endDate);

    const { data: mappings } = await supabase
      .from("sku_mappings")
      .select("external_id, product_id, unit_multiplier")
      .eq("source", "shopify")
      .eq("active", true);

    const mappingLookup = new Map<string, { product_id: string; multiplier: number }>();
    for (const m of mappings || []) {
      mappingLookup.set(m.external_id, { product_id: m.product_id, multiplier: m.unit_multiplier || 1 });
    }

    salesByProduct = new Map();
    for (const row of data || []) {
      const mapping = mappingLookup.get(row.variant_id);
      if (!mapping) continue;
      const key = mapping.product_id;
      if (!salesByProduct.has(key)) {
        salesByProduct.set(key, { product_id: key, units: 0 });
      }
      salesByProduct.get(key)!.units += row.units_sold * mapping.multiplier;
    }
  }

  if (salesByProduct.size === 0) {
    return NextResponse.json({ error: "No sales data found for " + month + " on " + channel }, { status: 400 });
  }

  // Get QB item IDs for each product (need quickbooks_id)
  const productIds = Array.from(salesByProduct.keys());
  const { data: products } = await supabase
    .from("products")
    .select("id, quickbooks_id, quickbooks_name, item_type")
    .in("id", productIds);

  // Build Sales Receipt line items — only FG with BOM (bundle) and FG no BOM (inventory without bundle_id)
  // All at $0 unit price
  const lines = [];
  let lineNum = 1;

  for (const product of products || []) {
    const sales = salesByProduct.get(product.id);
    if (!sales || sales.units <= 0) continue;

    lines.push({
      LineNum: lineNum++,
      DetailType: "SalesItemLineDetail",
      Amount: 0,
      Description: `${product.quickbooks_name} - ${channel} ${month}`,
      SalesItemLineDetail: {
        ItemRef: { value: product.quickbooks_id },
        Qty: sales.units,
        UnitPrice: 0,
      },
    });
  }

  if (lines.length === 0) {
    return NextResponse.json({ error: "No line items to create" }, { status: 400 });
  }

  // Get QB access token
  const qbCreds = await getCredentials("quickbooks");
  const { data: qbTokens } = await supabase
    .from("qb_tokens")
    .select("refresh_token, realm_id")
    .eq("id", "current")
    .single();

  if (!qbTokens) {
    return NextResponse.json({ error: "QuickBooks not connected" }, { status: 400 });
  }

  const basicAuth = Buffer.from(`${qbCreds.client_id}:${qbCreds.client_secret}`).toString("base64");
  const tokenRes = await fetch(QB_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: `Basic ${basicAuth}` },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: qbTokens.refresh_token }),
  });

  if (!tokenRes.ok) {
    return NextResponse.json({ error: "QB token refresh failed" }, { status: 500 });
  }

  const tokenData = await tokenRes.json();

  // Store rotated token
  await supabase.from("qb_tokens").update({
    refresh_token: tokenData.refresh_token,
    updated_at: new Date().toISOString(),
  }).eq("id", "current");

  const config = CHANNEL_CONFIG[channel];

  // Create Sales Receipt
  const receiptBody = {
    TxnDate: txnDate,
    CustomerRef: { value: config.customerRef },
    DepositToAccountRef: { value: config.depositAccount },
    PrivateNote: config.memo + month,
    Line: lines,
  };

  const createRes = await fetch(
    `https://quickbooks.api.intuit.com/v3/company/${qbTokens.realm_id}/salesreceipt?minorversion=65`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(receiptBody),
    }
  );

  if (!createRes.ok) {
    const errText = await createRes.text();
    return NextResponse.json({ error: "Failed to create Sales Receipt", details: errText }, { status: 500 });
  }

  const result = await createRes.json();
  const receipt = result.SalesReceipt;

  return NextResponse.json({
    success: true,
    receipt_id: receipt.Id,
    doc_number: receipt.DocNumber,
    txn_date: receipt.TxnDate,
    line_count: lines.length,
    total_units: lines.reduce((s, l) => s + (l.SalesItemLineDetail?.Qty || 0), 0),
    channel,
    month,
  });
}
