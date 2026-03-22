import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://shoptics.ai";

    // Get inventory audit data
    const auditRes = await fetch(`${baseUrl}/api/inventory-audit`, {
      cache: "no-store",
    }).catch(() => null);

    const products: Array<{ name: string; image_url: string | null; current: number; product_id: string }> = [];

    if (auditRes?.ok) {
      const audit = await auditRes.json();
      for (const fg of audit.finished_goods_with_bom || []) {
        products.push({ name: fg.name, image_url: fg.image_url, current: fg.finished_good_units, product_id: fg.product_id });
      }
      for (const item of audit.standalone_finished_goods || []) {
        products.push({ name: item.name, image_url: item.image_url, current: item.total, product_id: item.product_id });
      }
    }

    // Get 14-day sales burn for each product
    const now = new Date();
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const today = now.toISOString().split("T")[0];

    const salesRes = await fetch(
      `${baseUrl}/api/sales-data?start=${fourteenDaysAgo}&end=${today}&channel=all`,
      { cache: "no-store" }
    ).catch(() => null);

    const burnByProduct = new Map<string, number>();
    if (salesRes?.ok) {
      const salesData = await salesRes.json();
      for (const item of salesData.items || []) {
        // 14-day units → monthly rate = units * 30/14
        const monthlyBurn = (item.total_units / 14) * 30;
        burnByProduct.set(item.product_id, monthlyBurn);
      }
    }

    // Find low stock: less than 6 months of inventory
    const lowStock = products
      .map((p) => {
        const burnRate = burnByProduct.get(p.product_id) || 0;
        if (burnRate <= 0) return null; // No sales = no alert
        const monthsLeft = p.current / burnRate;
        if (monthsLeft >= 6) return null;
        return {
          name: p.name,
          image_url: p.image_url,
          current: p.current,
          threshold: Math.round(burnRate * 6),
          burn_rate: burnRate,
          months_left: monthsLeft,
        };
      })
      .filter(Boolean)
      .sort((a, b) => a!.months_left - b!.months_left);

    return NextResponse.json(lowStock);
  } catch {
    return NextResponse.json([]);
  }
}
