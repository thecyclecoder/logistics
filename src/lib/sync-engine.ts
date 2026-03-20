import { createServiceClient } from "@/lib/supabase/server";
import * as qb from "@/lib/integrations/quickbooks";
import * as amazon from "@/lib/integrations/amazon";
import * as shopify from "@/lib/integrations/shopify";
import * as amplifier from "@/lib/integrations/amplifier";

type SyncResult = {
  job: string;
  status: "success" | "error";
  records: number;
  error?: string;
};

async function startLog(jobName: string): Promise<string> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("cron_logs")
    .insert({ job_name: jobName, status: "running" })
    .select("id")
    .single();
  if (error) throw new Error(`Failed to create cron_log: ${error.message}`);
  return data.id;
}

async function finishLog(
  logId: string,
  status: "success" | "error",
  recordsProcessed: number,
  errorMessage?: string
) {
  const supabase = createServiceClient();
  await supabase
    .from("cron_logs")
    .update({
      status,
      records_processed: recordsProcessed,
      error_message: errorMessage || null,
      finished_at: new Date().toISOString(),
    })
    .eq("id", logId);
}

async function resolveProductByMapping(
  externalId: string,
  source: string
): Promise<string | null> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("sku_mappings")
    .select("product_id")
    .eq("external_id", externalId)
    .eq("source", source)
    .eq("active", true)
    .limit(1)
    .single();
  return data?.product_id || null;
}

export async function syncQBProducts(): Promise<SyncResult> {
  const logId = await startLog("syncQBProducts");
  try {
    const items = await qb.fetchInventoryItems();
    const supabase = createServiceClient();
    let count = 0;

    for (const item of items) {
      const { error } = await supabase
        .from("products")
        .upsert(
          {
            quickbooks_id: item.Id,
            quickbooks_name: item.Name,
            sku: item.Sku || null,
            unit_cost: item.UnitPrice || null,
            active: item.Active,
          },
          { onConflict: "quickbooks_id" }
        );

      if (error) {
        console.error(`Failed to upsert product ${item.Id}:`, error.message);
        continue;
      }

      // Get the product id for snapshot
      const { data: product } = await supabase
        .from("products")
        .select("id")
        .eq("quickbooks_id", item.Id)
        .single();

      if (product && item.QtyOnHand !== undefined) {
        await supabase.from("inventory_snapshots").insert({
          product_id: product.id,
          source: "quickbooks",
          quantity: Math.floor(item.QtyOnHand),
          raw_payload: item,
        });
      }

      count++;
    }

    await finishLog(logId, "success", count);
    return { job: "syncQBProducts", status: "success", records: count };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await finishLog(logId, "error", 0, msg);
    return { job: "syncQBProducts", status: "error", records: 0, error: msg };
  }
}

export async function syncAmazonInventory(): Promise<SyncResult> {
  const logId = await startLog("syncAmazonInventory");
  try {
    const summaries = await amazon.fetchFBAInventory();
    const supabase = createServiceClient();
    let count = 0;

    for (const s of summaries) {
      // Try to resolve by ASIN first, then sellerSku
      const productId =
        (await resolveProductByMapping(s.asin, "amazon")) ||
        (await resolveProductByMapping(s.sellerSku, "amazon"));

      if (!productId) continue;

      await supabase.from("inventory_snapshots").insert({
        product_id: productId,
        source: "amazon_fba",
        quantity: s.totalFulfillableQuantity,
        raw_payload: s as unknown as Record<string, unknown>,
      });

      count++;
    }

    await finishLog(logId, "success", count);
    return { job: "syncAmazonInventory", status: "success", records: count };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await finishLog(logId, "error", 0, msg);
    return {
      job: "syncAmazonInventory",
      status: "error",
      records: 0,
      error: msg,
    };
  }
}

export async function sync3PLInventory(): Promise<SyncResult> {
  const logId = await startLog("sync3PLInventory");
  try {
    const items = await amplifier.fetchInventory();
    const supabase = createServiceClient();
    let count = 0;

    for (const item of items) {
      const productId = await resolveProductByMapping(item.sku, "3pl");
      if (!productId) continue;

      await supabase.from("inventory_snapshots").insert({
        product_id: productId,
        source: "3pl",
        quantity: item.quantity_available,
        raw_payload: item as unknown as Record<string, unknown>,
      });

      count++;
    }

    await finishLog(logId, "success", count);
    return { job: "sync3PLInventory", status: "success", records: count };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await finishLog(logId, "error", 0, msg);
    return { job: "sync3PLInventory", status: "error", records: 0, error: msg };
  }
}

function getMonthRange(offset: number = 0): {
  start: string;
  end: string;
  period: string;
} {
  const now = new Date();
  const target = new Date(now.getFullYear(), now.getMonth() - offset, 1);
  const nextMonth = new Date(target.getFullYear(), target.getMonth() + 1, 1);
  const period = `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, "0")}`;
  return {
    start: target.toISOString(),
    end: nextMonth.toISOString(),
    period,
  };
}

function parseAmount(amountObj: { Amount?: string; CurrencyCode?: string } | undefined): number {
  return amountObj?.Amount ? parseFloat(amountObj.Amount) : 0;
}

export async function syncAmazonSales(
  monthOffset: number = 0
): Promise<SyncResult> {
  const logId = await startLog("syncAmazonSales");
  try {
    const { start, end, period } = getMonthRange(monthOffset);
    const orders = await amazon.fetchOrders(start, end);
    const supabase = createServiceClient();
    let count = 0;

    for (const order of orders) {
      const items = await amazon.fetchOrderItems(order.AmazonOrderId);

      for (const item of items) {
        const productId =
          (await resolveProductByMapping(item.ASIN, "amazon")) ||
          (await resolveProductByMapping(item.SellerSKU, "amazon"));
        if (!productId) continue;

        const gross = parseAmount(item.ItemPrice);
        const fees = parseAmount(item.ItemTax);

        // Check if this order item already exists
        const { data: existing } = await supabase
          .from("sale_records")
          .select("id")
          .eq("order_id", order.AmazonOrderId)
          .eq("product_id", productId)
          .limit(1)
          .single();

        if (existing) continue;

        await supabase.from("sale_records").insert({
          product_id: productId,
          channel: "amazon",
          order_id: order.AmazonOrderId,
          quantity: item.QuantityOrdered,
          gross_amount: gross,
          refund_amount: 0,
          fee_amount: fees,
          net_amount: gross - fees,
          sale_date: order.PurchaseDate.split("T")[0],
          period_month: period,
          raw_payload: { order, item },
        });

        count++;
      }
    }

    await finishLog(logId, "success", count);
    return { job: "syncAmazonSales", status: "success", records: count };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await finishLog(logId, "error", 0, msg);
    return { job: "syncAmazonSales", status: "error", records: 0, error: msg };
  }
}

export async function syncShopifySales(
  monthOffset: number = 0
): Promise<SyncResult> {
  const logId = await startLog("syncShopifySales");
  try {
    const { start, end, period } = getMonthRange(monthOffset);
    const orders = await shopify.fetchOrders(start, end);
    const supabase = createServiceClient();
    let count = 0;

    for (const order of orders) {
      const totalRefunds = order.refunds?.reduce(
        (sum: number, r: { refund_line_items?: { subtotal: string }[] }) =>
          sum +
          (r.refund_line_items || []).reduce(
            (s: number, li: { subtotal: string }) => s + parseFloat(li.subtotal || "0"),
            0
          ),
        0
      ) || 0;

      for (const item of order.line_items) {
        if (!item.sku) continue;

        const productId = await resolveProductByMapping(item.sku, "shopify");
        if (!productId) continue;

        const { data: existing } = await supabase
          .from("sale_records")
          .select("id")
          .eq("order_id", String(order.id))
          .eq("product_id", productId)
          .limit(1)
          .single();

        if (existing) continue;

        const gross = parseFloat(item.price) * item.quantity;
        const lineRefund =
          totalRefunds > 0
            ? (gross / parseFloat(order.total_price || "1")) * totalRefunds
            : 0;

        await supabase.from("sale_records").insert({
          product_id: productId,
          channel: "shopify",
          order_id: String(order.id),
          quantity: item.quantity,
          gross_amount: gross,
          refund_amount: lineRefund,
          fee_amount: 0,
          net_amount: gross - lineRefund,
          sale_date: order.created_at.split("T")[0],
          period_month: period,
          raw_payload: { order: { id: order.id, name: order.name }, item },
        });

        count++;
      }
    }

    await finishLog(logId, "success", count);
    return { job: "syncShopifySales", status: "success", records: count };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await finishLog(logId, "error", 0, msg);
    return {
      job: "syncShopifySales",
      status: "error",
      records: 0,
      error: msg,
    };
  }
}

// QB-only sync — manual trigger only (month-end closing)
export async function syncQB(): Promise<SyncResult[]> {
  const results = await Promise.allSettled([syncQBProducts()]);
  return results.map((r) =>
    r.status === "fulfilled"
      ? r.value
      : {
          job: "syncQBProducts",
          status: "error" as const,
          records: 0,
          error: r.reason?.message || String(r.reason),
        }
  );
}

// Automated sync — excludes QB (QB requires manual trigger)
export async function syncAll(): Promise<SyncResult[]> {
  const results = await Promise.allSettled([
    syncAmazonInventory(),
    sync3PLInventory(),
    syncAmazonSales(0),
    syncShopifySales(0),
  ]);

  return results.map((r) =>
    r.status === "fulfilled"
      ? r.value
      : {
          job: "unknown",
          status: "error" as const,
          records: 0,
          error: r.reason?.message || String(r.reason),
        }
  );
}
