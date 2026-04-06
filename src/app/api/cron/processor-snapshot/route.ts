import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { aggregateShopifyPayments } from "@/lib/integrations/shopify-payments";
import { aggregatePayPalTransactions } from "@/lib/integrations/paypal";
import { aggregateBraintreeTransactions } from "@/lib/integrations/braintree-client";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const supabase = createServiceClient();
  const results: Array<{ processor: string; status: string; error?: string }> = [];

  // Shopify Payments
  try {
    const data = await aggregateShopifyPayments(month);
    await supabase.from("payment_processor_summaries").upsert({
      closing_month: month, processor: "shopify_payments",
      gross_sales: data.gross_sales, processing_fees: data.processing_fees,
      refunds: data.refunds, chargebacks: data.chargebacks,
      adjustments: 0, net_deposits: data.net_deposits,
      raw_payload: data, synced_at: new Date().toISOString(),
    }, { onConflict: "closing_month,processor" });
    results.push({ processor: "shopify_payments", status: "success" });
  } catch (err) {
    results.push({ processor: "shopify_payments", status: "error", error: err instanceof Error ? err.message : String(err) });
  }

  // PayPal
  try {
    const data = await aggregatePayPalTransactions(month);
    await supabase.from("payment_processor_summaries").upsert({
      closing_month: month, processor: "paypal",
      gross_sales: data.gross_sales, processing_fees: data.processing_fees,
      refunds: data.refunds, chargebacks: data.chargebacks,
      adjustments: 0, net_deposits: data.net_deposits,
      raw_payload: data, synced_at: new Date().toISOString(),
    }, { onConflict: "closing_month,processor" });
    results.push({ processor: "paypal", status: "success" });
  } catch (err) {
    results.push({ processor: "paypal", status: "error", error: err instanceof Error ? err.message : String(err) });
  }

  // Braintree
  try {
    const data = await aggregateBraintreeTransactions(month);
    await supabase.from("payment_processor_summaries").upsert({
      closing_month: month, processor: "braintree",
      gross_sales: data.gross_sales, processing_fees: data.total_fees,
      refunds: data.refunds, chargebacks: data.chargebacks,
      adjustments: 0, net_deposits: data.net_deposits,
      raw_payload: data, synced_at: new Date().toISOString(),
    }, { onConflict: "closing_month,processor" });
    results.push({ processor: "braintree", status: "success" });
  } catch (err) {
    results.push({ processor: "braintree", status: "error", error: err instanceof Error ? err.message : String(err) });
  }

  return NextResponse.json({ month, results });
}
