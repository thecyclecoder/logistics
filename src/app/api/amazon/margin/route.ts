import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getCredentials } from "@/lib/credentials";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const LWA_TOKEN_URL = "https://api.amazon.com/auth/o2/token";
const SP_API_BASE = "https://sellingpartnerapi-na.amazon.com";

async function getAmazonToken(): Promise<string> {
  const creds = await getCredentials("amazon");
  const res = await fetch(LWA_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: creds.refresh_token,
      client_id: creds.client_id,
      client_secret: creds.client_secret,
    }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error("Amazon token refresh failed");
  return data.access_token;
}

interface ItemFinancials {
  sellerSku: string;
  quantity: number;
  revenue: number;
  tax: number;
  fbaFees: number;
  referralFees: number;
  promotions: number;
  otherFees: number;
}

export async function GET(request: NextRequest) {
  const month = request.nextUrl.searchParams.get("month");
  if (!month) return NextResponse.json({ error: "month (YYYY-MM) required" }, { status: 400 });

  try {
    const token = await getAmazonToken();
    const [year, mon] = month.split("-").map(Number);
    const startDate = `${month}-01T00:00:00Z`;
    const lastDay = new Date(year, mon, 0).getDate();
    const endDate = `${month}-${String(lastDay).padStart(2, "0")}T23:59:59Z`;

    // 1. Get all financial event groups that overlap this month
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let allGroups: any[] = [];
    let groupNextToken: string | null = null;

    do {
      const params = new URLSearchParams({
        MaxResultsPerPage: "100",
        FinancialEventGroupStartedAfter: startDate,
        FinancialEventGroupStartedBefore: endDate,
      });
      if (groupNextToken) params.set("NextToken", groupNextToken);

      const res = await fetch(`${SP_API_BASE}/finances/v0/financialEventGroups?${params}`, {
        headers: { "x-amz-access-token": token },
      });
      if (!res.ok) throw new Error(`Finances API error: ${res.status}`);
      const data = await res.json();
      allGroups = allGroups.concat(data.payload?.FinancialEventGroupList || []);
      groupNextToken = data.payload?.NextToken || null;
    } while (groupNextToken);

    // 2. Get financial events from each group
    const itemMap = new Map<string, ItemFinancials>();

    for (const group of allGroups) {
      let eventNextToken: string | null = null;
      do {
        const params = new URLSearchParams({ MaxResultsPerPage: "100" });
        if (eventNextToken) params.set("NextToken", eventNextToken);

        const res = await fetch(
          `${SP_API_BASE}/finances/v0/financialEventGroups/${group.FinancialEventGroupId}/financialEvents?${params}`,
          { headers: { "x-amz-access-token": token } }
        );
        if (!res.ok) break;
        const data = await res.json();
        const events = data.payload?.FinancialEvents;

        // Process shipment events (sales)
        for (const shipment of events?.ShipmentEventList || []) {
          for (const item of shipment.ShipmentItemList || []) {
            processItem(itemMap, item, 1);
          }
        }

        // Process refund events
        for (const refund of events?.RefundEventList || []) {
          for (const item of refund.ShipmentItemList || []) {
            processItem(itemMap, item, -1);
          }
        }

        eventNextToken = data.payload?.NextToken || null;
      } while (eventNextToken);
    }

    // 3. Map SKUs to products and aggregate by product
    const supabase = createServiceClient();

    const { data: allMappings } = await supabase
      .from("sku_mappings")
      .select("external_id, product_id, unit_multiplier, active")
      .eq("source", "amazon");

    // Build seller_sku → product mapping (seller SKU, not ASIN)
    // We need to check external_skus for seller_sku → ASIN mapping
    const { data: externalSkus } = await supabase
      .from("external_skus")
      .select("external_id, seller_sku")
      .eq("source", "amazon");

    // Build seller_sku → ASIN lookup
    const skuToAsin = new Map<string, string>();
    for (const es of externalSkus || []) {
      if (es.seller_sku) skuToAsin.set(es.seller_sku, es.external_id);
    }

    // Build ASIN → product_id lookup
    const asinToProduct = new Map<string, { product_id: string; multiplier: number }>();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const m of (allMappings || []).filter((m: any) => m.active)) {
      asinToProduct.set(m.external_id, { product_id: m.product_id, multiplier: m.unit_multiplier || 1 });
    }

    // Get products with cost data
    const { data: products } = await supabase
      .from("products")
      .select("id, quickbooks_name, image_url, item_type, unit_cost, bundle_id");

    // Get BOM data for cost rollup
    const { data: bomRows } = await supabase
      .from("product_bom")
      .select("parent_id, component_id, quantity");

    const productById = new Map<string, { name: string; image_url: string | null; unit_cost: number | null; item_type: string }>();
    for (const p of products || []) {
      productById.set(p.id, { name: p.quickbooks_name, image_url: p.image_url, unit_cost: p.unit_cost ? Number(p.unit_cost) : null, item_type: p.item_type });
    }

    // Calculate BOM costs for bundles
    const bomCosts = new Map<string, { cost: number | null; incomplete: boolean }>();
    for (const p of products || []) {
      if (p.item_type === "bundle") {
        const components = (bomRows || []).filter((b) => b.parent_id === p.id);
        if (components.length > 0) {
          let total = 0;
          let incomplete = false;
          for (const comp of components) {
            const compProduct = productById.get(comp.component_id);
            if (compProduct?.unit_cost !== null && compProduct?.unit_cost !== undefined) {
              total += compProduct.unit_cost * Number(comp.quantity);
            } else {
              incomplete = true;
            }
          }
          bomCosts.set(p.id, { cost: total, incomplete });
        }
      }
    }

    // Aggregate financials by product
    interface ProductMargin {
      product_id: string;
      name: string;
      image_url: string | null;
      units: number;
      revenue: number;
      fba_fees: number;
      referral_fees: number;
      promotions: number;
      other_fees: number;
      total_amazon_fees: number;
      net_after_amazon: number;
      margin_pre_cogs: number;
      unit_cost: number | null;
      cost_incomplete: boolean;
      total_cogs: number | null;
      net_after_cogs: number | null;
      margin_after_cogs: number | null;
    }

    const productMargins = new Map<string, ProductMargin>();

    for (const [sellerSku, fin] of Array.from(itemMap)) {
      // Map seller_sku → ASIN → product_id
      const asin = skuToAsin.get(sellerSku);
      const mapping = asin ? asinToProduct.get(asin) : null;

      if (!mapping) continue;

      const product = productById.get(mapping.product_id);
      if (!product) continue;

      const existing = productMargins.get(mapping.product_id) || {
        product_id: mapping.product_id,
        name: product.name,
        image_url: product.image_url,
        units: 0,
        revenue: 0,
        fba_fees: 0,
        referral_fees: 0,
        promotions: 0,
        other_fees: 0,
        total_amazon_fees: 0,
        net_after_amazon: 0,
        margin_pre_cogs: 0,
        unit_cost: null,
        cost_incomplete: false,
        total_cogs: null,
        net_after_cogs: null,
        margin_after_cogs: null,
      };

      existing.units += fin.quantity * mapping.multiplier;
      existing.revenue += fin.revenue;
      existing.fba_fees += Math.abs(fin.fbaFees);
      existing.referral_fees += Math.abs(fin.referralFees);
      existing.promotions += Math.abs(fin.promotions);
      existing.other_fees += Math.abs(fin.otherFees);

      productMargins.set(mapping.product_id, existing);
    }

    // Calculate margins
    const results: ProductMargin[] = [];
    for (const [, pm] of Array.from(productMargins)) {
      pm.total_amazon_fees = pm.fba_fees + pm.referral_fees + pm.other_fees;
      pm.net_after_amazon = pm.revenue - pm.total_amazon_fees - pm.promotions;
      pm.margin_pre_cogs = pm.revenue > 0 ? (pm.net_after_amazon / pm.revenue) * 100 : 0;

      // Get COGS
      const product = productById.get(pm.product_id);
      if (product?.item_type === "bundle") {
        const bom = bomCosts.get(pm.product_id);
        if (bom) {
          pm.unit_cost = bom.cost;
          pm.cost_incomplete = bom.incomplete;
        }
      } else if (product?.unit_cost !== null && product?.unit_cost !== undefined) {
        pm.unit_cost = product.unit_cost;
        pm.cost_incomplete = false;
      }

      if (pm.unit_cost !== null) {
        pm.total_cogs = pm.unit_cost * pm.units;
        pm.net_after_cogs = pm.net_after_amazon - pm.total_cogs;
        pm.margin_after_cogs = pm.revenue > 0 ? (pm.net_after_cogs / pm.revenue) * 100 : 0;
      }

      if (pm.units > 0 || pm.revenue > 0) results.push(pm);
    }

    // Sort by revenue descending
    results.sort((a, b) => b.revenue - a.revenue);

    // Totals
    const totals = {
      units: results.reduce((s, r) => s + r.units, 0),
      revenue: results.reduce((s, r) => s + r.revenue, 0),
      fba_fees: results.reduce((s, r) => s + r.fba_fees, 0),
      referral_fees: results.reduce((s, r) => s + r.referral_fees, 0),
      promotions: results.reduce((s, r) => s + r.promotions, 0),
      other_fees: results.reduce((s, r) => s + r.other_fees, 0),
      total_amazon_fees: results.reduce((s, r) => s + r.total_amazon_fees, 0),
      net_after_amazon: results.reduce((s, r) => s + r.net_after_amazon, 0),
      total_cogs: results.filter((r) => r.total_cogs !== null).reduce((s, r) => s + (r.total_cogs || 0), 0),
      products_missing_cost: results.filter((r) => r.unit_cost === null || r.cost_incomplete).length,
    };

    // Count unmapped SKUs
    const unmappedSkus = Array.from(itemMap.keys()).filter((sku) => {
      const asin = skuToAsin.get(sku);
      return !asin || !asinToProduct.get(asin);
    });

    return NextResponse.json({
      month,
      products: results,
      totals,
      unmapped_skus: unmappedSkus,
      financial_event_groups: allGroups.length,
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function processItem(map: Map<string, ItemFinancials>, item: any, sign: number) {
  const sku = item.SellerSKU;
  if (!sku) return;

  const existing = map.get(sku) || {
    sellerSku: sku,
    quantity: 0,
    revenue: 0,
    tax: 0,
    fbaFees: 0,
    referralFees: 0,
    promotions: 0,
    otherFees: 0,
  };

  existing.quantity += (item.QuantityShipped || 1) * sign;

  for (const charge of item.ItemChargeList || []) {
    const amt = (charge.ChargeAmount?.CurrencyAmount || 0) * sign;
    if (charge.ChargeType === "Principal") existing.revenue += amt;
    else if (charge.ChargeType === "Tax") existing.tax += amt;
  }

  for (const fee of item.ItemFeeList || []) {
    const amt = (fee.FeeAmount?.CurrencyAmount || 0) * sign;
    if (fee.FeeType === "FBAPerUnitFulfillmentFee" || fee.FeeType === "FBAPerOrderFulfillmentFee" || fee.FeeType === "FBAWeightBasedFee") {
      existing.fbaFees += amt;
    } else if (fee.FeeType === "Commission") {
      existing.referralFees += amt;
    } else {
      existing.otherFees += amt;
    }
  }

  for (const promo of item.PromotionList || []) {
    existing.promotions += (promo.PromotionAmount?.CurrencyAmount || 0) * sign;
  }

  map.set(sku, existing);
}
