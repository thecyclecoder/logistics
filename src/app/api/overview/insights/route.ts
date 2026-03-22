import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = createServiceClient();
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const today = now.toISOString().split("T")[0];

    // 1. Processor fee summary (MTD)
    const { data: processorData } = await supabase
      .from("payment_processor_summaries")
      .select("processor, gross_sales, processing_fees, refunds, chargebacks")
      .eq("closing_month", month);

    const processorSummary = (processorData || []).map((p) => ({
      processor: p.processor,
      gross: Number(p.gross_sales),
      fees: Number(p.processing_fees),
      refunds: Number(p.refunds),
      chargebacks: Number(p.chargebacks),
      fee_pct: Number(p.gross_sales) > 0 ? (Number(p.processing_fees) / Number(p.gross_sales)) * 100 : 0,
    }));

    const totalGross = processorSummary.reduce((s, p) => s + p.gross, 0);
    const totalFees = processorSummary.reduce((s, p) => s + p.fees, 0);
    const totalRefunds = processorSummary.reduce((s, p) => s + p.refunds, 0);
    const totalChargebacks = processorSummary.reduce((s, p) => s + p.chargebacks, 0);

    // 2. Top products by burn rate (14-day sales → monthly)
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://shoptics.ai";
    const salesRes = await fetch(
      `${baseUrl}/api/sales-data?start=${fourteenDaysAgo}&end=${today}&channel=all`,
      { cache: "no-store" }
    ).catch(() => null);

    interface BurnItem {
      name: string;
      image_url: string | null;
      monthly_burn: number;
      total_units: number;
      total_revenue: number;
    }
    let topBurners: BurnItem[] = [];

    if (salesRes?.ok) {
      const salesData = await salesRes.json();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      topBurners = (salesData.items || [])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((item: any) => ({
          name: item.name,
          image_url: item.image_url,
          monthly_burn: Math.round((item.total_units / 14) * 30),
          total_units: item.total_units,
          total_revenue: item.total_revenue,
        }))
        .sort((a: BurnItem, b: BurnItem) => b.monthly_burn - a.monthly_burn)
        .slice(0, 10);
    }

    // 3. Refund/chargeback rates — current month + previous month for trending
    const prevMonth = now.getMonth() === 0
      ? `${now.getFullYear() - 1}-12`
      : `${now.getFullYear()}-${String(now.getMonth()).padStart(2, "0")}`;

    const { data: prevProcessorData } = await supabase
      .from("payment_processor_summaries")
      .select("processor, gross_sales, refunds, chargebacks")
      .eq("closing_month", prevMonth);

    const prevTotalGross = (prevProcessorData || []).reduce((s, p) => s + Number(p.gross_sales), 0);
    const prevTotalRefunds = (prevProcessorData || []).reduce((s, p) => s + Number(p.refunds), 0);
    const prevTotalChargebacks = (prevProcessorData || []).reduce((s, p) => s + Number(p.chargebacks), 0);

    return NextResponse.json({
      processor_fees: {
        processors: processorSummary,
        total_gross: totalGross,
        total_fees: totalFees,
        total_refunds: totalRefunds,
        total_chargebacks: totalChargebacks,
        total_fee_pct: totalGross > 0 ? (totalFees / totalGross) * 100 : 0,
      },
      top_burners: topBurners,
      refund_chargeback_trend: {
        current: {
          month,
          gross: totalGross,
          refunds: totalRefunds,
          chargebacks: totalChargebacks,
          refund_rate: totalGross > 0 ? (totalRefunds / totalGross) * 100 : 0,
          chargeback_rate: totalGross > 0 ? (totalChargebacks / totalGross) * 100 : 0,
        },
        previous: {
          month: prevMonth,
          gross: prevTotalGross,
          refunds: prevTotalRefunds,
          chargebacks: prevTotalChargebacks,
          refund_rate: prevTotalGross > 0 ? (prevTotalRefunds / prevTotalGross) * 100 : 0,
          chargeback_rate: prevTotalGross > 0 ? (prevTotalChargebacks / prevTotalGross) * 100 : 0,
        },
      },
    });
  } catch {
    return NextResponse.json({
      processor_fees: { processors: [], total_gross: 0, total_fees: 0, total_refunds: 0, total_chargebacks: 0, total_fee_pct: 0 },
      top_burners: [],
      refund_chargeback_trend: { current: { month: "", gross: 0, refunds: 0, chargebacks: 0, refund_rate: 0, chargeback_rate: 0 }, previous: { month: "", gross: 0, refunds: 0, chargebacks: 0, refund_rate: 0, chargeback_rate: 0 } },
    });
  }
}
