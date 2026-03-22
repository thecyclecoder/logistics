const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function getShopifyToken(): Promise<{ shop_domain: string; access_token: string }> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/shopify_tokens?select=shop_domain,access_token&limit=1`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
    cache: "no-store",
  });
  const tokens = await res.json();
  if (!tokens?.[0]) throw new Error("Shopify not connected");
  return tokens[0];
}

export interface ShopifyPaymentsSummary {
  gross_sales: number;
  processing_fees: number;
  refunds: number;
  chargebacks: number;
  adjustments: number;
  net_deposits: number;
  payout_count: number;
}

export async function aggregateShopifyPayments(month: string): Promise<ShopifyPaymentsSummary> {
  const { shop_domain, access_token } = await getShopifyToken();
  const [year, mon] = month.split("-").map(Number);
  const lastDay = new Date(year, mon, 0).getDate();
  const dateMin = `${month}-01`;
  const dateMax = `${month}-${String(lastDay).padStart(2, "0")}`;

  // Fetch all paid payouts for the month (paginated)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let allPayouts: any[] = [];
  let url: string | null = `https://${shop_domain}/admin/api/2024-01/shopify_payments/payouts.json?date_min=${dateMin}&date_max=${dateMax}&status=paid&limit=100`;

  while (url) {
    const pageRes: Response = await fetch(url, {
      headers: { "X-Shopify-Access-Token": access_token },
    });
    if (!pageRes.ok) throw new Error(`Shopify Payouts API error: ${pageRes.status}`);
    const pageData = await pageRes.json();
    allPayouts = allPayouts.concat(pageData.payouts || []);

    // Check for next page
    const lh: string = pageRes.headers.get("link") || "";
    const nm: RegExpMatchArray | null = lh.match(/<([^>]+)>;\s*rel="next"/);
    url = nm ? nm[1] : null;
  }

  // Aggregate from payout summaries
  let grossSales = 0;
  let chargesFees = 0;
  let refunds = 0;
  let refundsFees = 0;
  let chargebacks = 0; // adjustments_gross = chargebacks/disputes
  let chargebackFees = 0;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const payout of allPayouts) {
    const s = payout.summary || {};
    grossSales += Number(s.charges_gross_amount || 0);
    chargesFees += Number(s.charges_fee_amount || 0);
    refunds += Math.abs(Number(s.refunds_gross_amount || 0));
    refundsFees += Number(s.refunds_fee_amount || 0);
    chargebacks += Math.abs(Number(s.adjustments_gross_amount || 0));
    chargebackFees += Number(s.adjustments_fee_amount || 0);
  }

  const totalFees = Math.abs(chargesFees) + Math.abs(refundsFees) + Math.abs(chargebackFees);

  return {
    gross_sales: grossSales,
    processing_fees: totalFees,
    refunds,
    chargebacks,
    adjustments: 0,
    net_deposits: allPayouts.reduce((s, p) => s + Number(p.amount || 0), 0),
    payout_count: allPayouts.length,
  };
}
