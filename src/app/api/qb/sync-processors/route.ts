import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { aggregateShopifyPayments } from "@/lib/integrations/shopify-payments";
import { aggregatePayPalTransactions } from "@/lib/integrations/paypal";
import { aggregateBraintreeTransactions } from "@/lib/integrations/braintree-client";

export const dynamic = "force-dynamic";
export const maxDuration = 120; // These API calls can take time

export async function POST(request: NextRequest) {
  try {
    const { month } = await request.json();
    if (!month) {
      return NextResponse.json({ error: "month (YYYY-MM) required" }, { status: 400 });
    }

    const supabase = createServiceClient();
    const results: Array<{ processor: string; status: string; data?: unknown; error?: string }> = [];

    // Shopify Payments
    try {
      const shopify = await aggregateShopifyPayments(month);
      await supabase.from("payment_processor_summaries").upsert({
        closing_month: month,
        processor: "shopify_payments",
        gross_sales: shopify.gross_sales,
        processing_fees: shopify.processing_fees,
        refunds: shopify.refunds,
        chargebacks: shopify.chargebacks,
        adjustments: shopify.adjustments,
        net_deposits: shopify.net_deposits,
        raw_payload: shopify,
        synced_at: new Date().toISOString(),
      }, { onConflict: "closing_month,processor" });
      results.push({ processor: "shopify_payments", status: "success", data: shopify });
    } catch (err) {
      results.push({ processor: "shopify_payments", status: "error", error: err instanceof Error ? err.message : String(err) });
    }

    // PayPal
    try {
      const paypal = await aggregatePayPalTransactions(month);
      await supabase.from("payment_processor_summaries").upsert({
        closing_month: month,
        processor: "paypal",
        gross_sales: paypal.gross_sales,
        processing_fees: paypal.processing_fees,
        refunds: paypal.refunds,
        chargebacks: paypal.chargebacks,
        adjustments: 0,
        net_deposits: paypal.net_deposits,
        raw_payload: paypal,
        synced_at: new Date().toISOString(),
      }, { onConflict: "closing_month,processor" });
      results.push({ processor: "paypal", status: "success", data: paypal });
    } catch (err) {
      results.push({ processor: "paypal", status: "error", error: err instanceof Error ? err.message : String(err) });
    }

    // Braintree
    try {
      const bt = await aggregateBraintreeTransactions(month);
      await supabase.from("payment_processor_summaries").upsert({
        closing_month: month,
        processor: "braintree",
        gross_sales: bt.gross_sales,
        processing_fees: bt.total_fees,
        refunds: bt.refunds,
        chargebacks: bt.chargebacks,
        adjustments: 0,
        net_deposits: bt.net_deposits,
        raw_payload: bt,
        synced_at: new Date().toISOString(),
      }, { onConflict: "closing_month,processor" });
      results.push({ processor: "braintree", status: "success", data: bt });
    } catch (err) {
      results.push({ processor: "braintree", status: "error", error: err instanceof Error ? err.message : String(err) });
    }

    const allSuccess = results.every((r) => r.status === "success");
    return NextResponse.json({ results, month, all_success: allSuccess });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
