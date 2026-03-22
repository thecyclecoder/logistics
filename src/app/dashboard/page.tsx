"use client";

import { useEffect, useState } from "react";
import { DollarSign, ShoppingCart, AlertTriangle, Clock, CalendarCheck, TrendingUp, Truck, PackageCheck, CreditCard, Flame, ArrowDown, ArrowUp } from "lucide-react";

interface ProcessorFee {
  processor: string;
  gross: number;
  fees: number;
  refunds: number;
  chargebacks: number;
  fee_pct: number;
}

interface TopBurner {
  name: string;
  image_url: string | null;
  monthly_burn: number;
  total_units: number;
  total_revenue: number;
}

interface Insights {
  processor_fees: {
    processors: ProcessorFee[];
    total_gross: number;
    total_fees: number;
    total_refunds: number;
    total_chargebacks: number;
    total_fee_pct: number;
  };
  top_burners: TopBurner[];
  refund_chargeback_trend: {
    current: { month: string; gross: number; refunds: number; chargebacks: number; refund_rate: number; chargeback_rate: number };
    previous: { month: string; gross: number; refunds: number; chargebacks: number; refund_rate: number; chargeback_rate: number };
  };
}

const PROCESSOR_LABELS: Record<string, string> = {
  shopify_payments: "Shopify Payments",
  paypal: "PayPal",
  braintree: "Braintree",
};

interface LowStockItem {
  name: string;
  image_url: string | null;
  current: number;
  threshold: number;
  burn_rate: number;
  months_left: number;
}

interface CronLog {
  id: string;
  job_name: string;
  status: string;
  records_processed: number | null;
  started_at: string;
}

interface Closing {
  id: string;
  closing_month: string;
  status: string;
  completed_at: string | null;
}

interface ReplenishmentItem {
  asin: string;
  seller_sku: string;
  display_name: string;
  image_url: string | null;
  fulfillable: number;
  transit: number;
  daily_burn: number;
  monthly_burn: number;
  days_of_stock: number;
  days_with_transit: number;
  suggested_qty: number;
  multiplier: number;
}

interface InTransitItem {
  asin: string;
  seller_sku: string;
  display_name: string;
  image_url: string | null;
  fulfillable: number;
  transit: number;
  daily_burn: number;
  days_until_stockout: number;
}

function fmt(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
}

function timeAgo(date: string): string {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function DashboardPage() {
  const [salesData, setSalesData] = useState<{ units: number; revenue: number; recurring_units: number } | null>(null);
  const [lowStock, setLowStock] = useState<LowStockItem[]>([]);
  const [cronLogs, setCronLogs] = useState<CronLog[]>([]);
  const [closings, setClosings] = useState<Closing[]>([]);
  const [replenishment, setReplenishment] = useState<ReplenishmentItem[]>([]);
  const [inTransit, setInTransit] = useState<InTransitItem[]>([]);
  const [insights, setInsights] = useState<Insights | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const now = new Date();
    const mtdStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    const today = now.toISOString().split("T")[0];

    Promise.all([
      // MTD sales
      fetch(`/api/sales-data?start=${mtdStart}&end=${today}&channel=all`, { cache: "no-store" }).then((r) => r.json()),
      // Low stock (from inventory audit + sales burn)
      fetch("/api/overview/low-stock", { cache: "no-store" }).then((r) => r.json()).catch(() => []),
      // Cron logs
      fetch("/api/overview/cron-logs", { cache: "no-store" }).then((r) => r.json()).catch(() => []),
      // Month-end closings
      fetch("/api/qb/month-end-closing/history", { cache: "no-store" }).then((r) => r.json()).catch(() => []),
      // FBA replenishment
      fetch("/api/overview/fba-replenishment", { cache: "no-store" }).then((r) => r.json()).catch(() => ({})),
      // Insights (processor fees, top burners, refund trends)
      fetch("/api/overview/insights", { cache: "no-store" }).then((r) => r.json()).catch(() => null),
    ]).then(([sales, stock, logs, closes, fbaData, insightsData]) => {
      setSalesData(sales.totals || null);
      if (Array.isArray(stock)) setLowStock(stock);
      if (Array.isArray(logs)) setCronLogs(logs);
      if (Array.isArray(closes)) setClosings(closes);
      if (fbaData.needs_replenishment) setReplenishment(fbaData.needs_replenishment);
      if (fbaData.in_transit) setInTransit(fbaData.in_transit);
      if (insightsData) setInsights(insightsData);
      setLoading(false);
    });
  }, []);

  const recurringPct = salesData && salesData.units > 0
    ? ((salesData.recurring_units / salesData.units) * 100).toFixed(0)
    : "0";

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-gray-900">Overview</h1>

      {/* Stat Cards */}
      {salesData && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-500">MTD Revenue</p>
              <DollarSign className="h-4 w-4 text-gray-400" />
            </div>
            <p className="mt-2 text-2xl font-semibold text-gray-900">{fmt(salesData.revenue)}</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-500">MTD Units Sold</p>
              <ShoppingCart className="h-4 w-4 text-gray-400" />
            </div>
            <p className="mt-2 text-2xl font-semibold text-gray-900">{salesData.units.toLocaleString()}</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-500">Recurring</p>
              <TrendingUp className="h-4 w-4 text-green-500" />
            </div>
            <p className="mt-2 text-2xl font-semibold text-green-600">{salesData.recurring_units.toLocaleString()}</p>
            <p className="mt-1 text-xs text-green-600">{recurringPct}% of total</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-500">Low Stock Alerts</p>
              <AlertTriangle className="h-4 w-4 text-amber-500" />
            </div>
            <p className={`mt-2 text-2xl font-semibold ${lowStock.length > 0 ? "text-amber-600" : "text-green-600"}`}>
              {loading ? "..." : lowStock.length}
            </p>
          </div>
        </div>
      )}

      {/* FBA Replenishment & In Transit */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Replenishment Alerts */}
        <div className="rounded-xl border border-red-200 bg-white p-5">
          <div className="flex items-center gap-2 mb-4">
            <PackageCheck className="h-4 w-4 text-red-500" />
            <h2 className="text-base font-semibold text-gray-900">
              FBA Replenishment Needed ({replenishment.length})
            </h2>
          </div>
          <p className="text-xs text-gray-400 mb-3">ASINs with less than 30 days of FBA stock (including in-transit)</p>
          {replenishment.length === 0 ? (
            <p className="text-sm text-gray-400">{loading ? "Loading..." : "All ASINs well stocked"}</p>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {replenishment.map((item) => (
                <div key={item.asin} className={`rounded-lg px-3 py-2 ${item.days_of_stock <= 7 ? "bg-red-50" : "bg-amber-50"}`}>
                  <div className="flex items-center gap-2">
                    {item.image_url ? (
                      <img src={item.image_url} alt="" className="h-8 w-8 rounded object-contain border border-gray-100 flex-shrink-0" />
                    ) : null}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{item.display_name}</p>
                      <p className="text-xs text-gray-500">{item.asin} · {item.seller_sku}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-1.5 text-xs">
                    <span className={`font-medium ${item.days_of_stock <= 7 ? "text-red-700" : "text-amber-700"}`}>
                      {item.days_of_stock} days left
                      {item.transit > 0 && <span className="text-gray-400"> ({item.days_with_transit}d w/ transit)</span>}
                    </span>
                    <span className="text-gray-500">
                      FBA: {item.fulfillable} · Burn: {item.monthly_burn}/mo · Send: {item.suggested_qty}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* In Transit */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="flex items-center gap-2 mb-4">
            <Truck className="h-4 w-4 text-blue-500" />
            <h2 className="text-base font-semibold text-gray-900">
              FBA In Transit ({inTransit.length})
            </h2>
          </div>
          <p className="text-xs text-gray-400 mb-3">ASINs with pending/shipped/receiving inventory at Amazon</p>
          {inTransit.length === 0 ? (
            <p className="text-sm text-gray-400">{loading ? "Loading..." : "Nothing in transit"}</p>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {inTransit.map((item) => (
                <div key={item.asin} className="rounded-lg bg-blue-50 px-3 py-2">
                  <div className="flex items-center gap-2">
                    {item.image_url ? (
                      <img src={item.image_url} alt="" className="h-8 w-8 rounded object-contain border border-gray-100 flex-shrink-0" />
                    ) : null}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{item.display_name}</p>
                      <p className="text-xs text-gray-500">{item.asin} · {item.seller_sku}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-blue-700">{item.transit}</p>
                      <p className="text-xs text-blue-500">in transit</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-1 text-xs text-gray-500">
                    <span>FBA: {item.fulfillable}</span>
                    <span>Burn: {item.daily_burn}/day</span>
                    <span>{item.days_until_stockout}d until stockout</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Insights Row */}
      {insights && insights.processor_fees.processors.length > 0 && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Processor Fee Summary */}
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <div className="flex items-center gap-2 mb-3">
              <CreditCard className="h-4 w-4 text-gray-400" />
              <h2 className="text-sm font-semibold text-gray-900">MTD Processing Fees</h2>
            </div>
            <div className="space-y-2">
              {insights.processor_fees.processors.map((p) => (
                <div key={p.processor} className="flex items-center justify-between">
                  <span className="text-xs text-gray-600">{PROCESSOR_LABELS[p.processor] || p.processor}</span>
                  <div className="text-right">
                    <span className="text-xs font-semibold text-gray-900">{fmt(p.fees)}</span>
                    <span className="text-xs text-gray-400 ml-1">({p.fee_pct.toFixed(1)}%)</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
              <span className="text-xs font-medium text-gray-500">Total</span>
              <div className="text-right">
                <span className="text-sm font-bold text-gray-900">{fmt(insights.processor_fees.total_fees)}</span>
                <span className="text-xs text-gray-400 ml-1">({insights.processor_fees.total_fee_pct.toFixed(1)}%)</span>
              </div>
            </div>
          </div>

          {/* Top Products by Burn Rate */}
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <div className="flex items-center gap-2 mb-3">
              <Flame className="h-4 w-4 text-orange-500" />
              <h2 className="text-sm font-semibold text-gray-900">Top Burn Rate (14d)</h2>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {insights.top_burners.slice(0, 7).map((item, i) => (
                <div key={i} className="flex items-center gap-2">
                  {item.image_url ? (
                    <img src={item.image_url} alt="" className="h-6 w-6 rounded object-contain border border-gray-100 flex-shrink-0" />
                  ) : (
                    <div className="h-6 w-6 rounded bg-gray-100 flex-shrink-0" />
                  )}
                  <span className="text-xs text-gray-700 truncate flex-1">{item.name}</span>
                  <span className="text-xs font-semibold text-orange-700 flex-shrink-0">{item.monthly_burn}/mo</span>
                </div>
              ))}
            </div>
          </div>

          {/* Refund/Chargeback Trending */}
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="h-4 w-4 text-gray-400" />
              <h2 className="text-sm font-semibold text-gray-900">Refund & Chargeback Rate</h2>
            </div>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-500">Refund Rate</span>
                  {(() => {
                    const curr = insights.refund_chargeback_trend.current.refund_rate;
                    const prev = insights.refund_chargeback_trend.previous.refund_rate;
                    const diff = curr - prev;
                    return (
                      <div className="flex items-center gap-1">
                        <span className="text-sm font-bold text-gray-900">{curr.toFixed(2)}%</span>
                        {prev > 0 && (
                          <span className={`flex items-center text-xs ${diff > 0 ? "text-red-500" : "text-green-500"}`}>
                            {diff > 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                            {Math.abs(diff).toFixed(2)}%
                          </span>
                        )}
                      </div>
                    );
                  })()}
                </div>
                <div className="flex items-center justify-between text-xs text-gray-400">
                  <span>{fmt(insights.refund_chargeback_trend.current.refunds)} this month</span>
                  <span>{fmt(insights.refund_chargeback_trend.previous.refunds)} last month</span>
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-500">Chargeback Rate</span>
                  {(() => {
                    const curr = insights.refund_chargeback_trend.current.chargeback_rate;
                    const prev = insights.refund_chargeback_trend.previous.chargeback_rate;
                    const diff = curr - prev;
                    return (
                      <div className="flex items-center gap-1">
                        <span className="text-sm font-bold text-gray-900">{curr.toFixed(2)}%</span>
                        {prev > 0 && (
                          <span className={`flex items-center text-xs ${diff > 0 ? "text-red-500" : "text-green-500"}`}>
                            {diff > 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                            {Math.abs(diff).toFixed(2)}%
                          </span>
                        )}
                      </div>
                    );
                  })()}
                </div>
                <div className="flex items-center justify-between text-xs text-gray-400">
                  <span>{fmt(insights.refund_chargeback_trend.current.chargebacks)} this month</span>
                  <span>{fmt(insights.refund_chargeback_trend.previous.chargebacks)} last month</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Low Stock Alerts */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <h2 className="text-base font-semibold text-gray-900">
              Low Stock Alerts ({lowStock.length})
            </h2>
          </div>
          <p className="text-xs text-gray-400 mb-3">Products with less than 6 months of inventory based on 14-day burn rate</p>
          {lowStock.length === 0 ? (
            <p className="text-sm text-gray-400">{loading ? "Loading..." : "All products well stocked"}</p>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {lowStock.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between rounded-lg bg-amber-50 px-3 py-2">
                  <div className="flex items-center gap-2">
                    {item.image_url ? (
                      <img src={item.image_url} alt="" className="h-6 w-6 rounded object-contain border border-gray-100" />
                    ) : null}
                    <span className="text-sm font-medium text-amber-800 truncate max-w-[200px]">{item.name}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-amber-700 font-medium">
                      {item.months_left.toFixed(1)} months left
                    </span>
                    <p className="text-xs text-amber-500">{item.current} on hand · {Math.round(item.burn_rate)}/mo burn</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Sync Jobs + Month-End History */}
        <div className="space-y-6">
          {/* Sync Jobs */}
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="h-4 w-4 text-gray-400" />
              <h2 className="text-base font-semibold text-gray-900">Recent Sync Jobs</h2>
            </div>
            {cronLogs.length === 0 ? (
              <p className="text-sm text-gray-400">{loading ? "Loading..." : "No sync jobs yet"}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="pb-2 text-left font-medium text-gray-500">Job</th>
                      <th className="pb-2 text-left font-medium text-gray-500">Status</th>
                      <th className="pb-2 text-right font-medium text-gray-500">Records</th>
                      <th className="pb-2 text-right font-medium text-gray-500">When</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {cronLogs.map((log) => (
                      <tr key={log.id}>
                        <td className="py-2 font-medium text-gray-700">{log.job_name}</td>
                        <td className="py-2">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                            log.status === "success" ? "bg-green-50 text-green-700"
                              : log.status === "error" ? "bg-red-50 text-red-700"
                                : "bg-blue-50 text-blue-700"
                          }`}>{log.status}</span>
                        </td>
                        <td className="py-2 text-right text-gray-500">{log.records_processed ?? "-"}</td>
                        <td className="py-2 text-right text-gray-500">{timeAgo(log.started_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Month-End Closing History */}
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <div className="flex items-center gap-2 mb-4">
              <CalendarCheck className="h-4 w-4 text-gray-400" />
              <h2 className="text-base font-semibold text-gray-900">Month-End Closings</h2>
            </div>
            {closings.length === 0 ? (
              <p className="text-sm text-gray-400">{loading ? "Loading..." : "No closings yet"}</p>
            ) : (
              <div className="space-y-2">
                {closings.map((c) => (
                  <div key={c.id} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${
                        c.status === "completed" ? "bg-green-500"
                          : c.status === "error" ? "bg-red-500"
                            : "bg-amber-500"
                      }`} />
                      <span className="text-sm font-medium text-gray-700">{c.closing_month}</span>
                    </div>
                    <span className="text-xs text-gray-500">
                      {c.completed_at ? new Date(c.completed_at).toLocaleDateString() : c.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
