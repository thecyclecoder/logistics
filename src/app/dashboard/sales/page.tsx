"use client";

import { useState, useEffect, useMemo } from "react";
import { DollarSign, ShoppingCart, RefreshCw, TrendingUp } from "lucide-react";

interface ProductSales {
  product_id: string;
  name: string;
  sku: string | null;
  image_url: string | null;
  amazon: { units: number; revenue: number; recurring: number; sns_checkout: number; one_time: number };
  shopify: { units: number; revenue: number; recurring: number; first_sub: number; one_time: number };
  total_units: number;
  total_revenue: number;
}

interface Totals {
  units: number;
  revenue: number;
  amazon_units: number;
  amazon_revenue: number;
  shopify_units: number;
  shopify_revenue: number;
  recurring_units: number;
  one_time_units: number;
}

type Channel = "all" | "amazon" | "shopify";
type TimeRange = "mtd" | "last_month" | "custom";

function fmt(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency", currency: "USD",
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(n);
}

function getDateRange(range: TimeRange, customStart?: string, customEnd?: string) {
  const now = new Date();
  if (range === "mtd") {
    return {
      start: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`,
      end: now.toISOString().split("T")[0],
      label: "Month to Date",
    };
  }
  if (range === "last_month") {
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth(), 0);
    return {
      start: lastMonth.toISOString().split("T")[0],
      end: lastDay.toISOString().split("T")[0],
      label: `${lastMonth.toLocaleString("default", { month: "long" })} ${lastMonth.getFullYear()}`,
    };
  }
  return { start: customStart || "", end: customEnd || "", label: "Custom Range" };
}

export default function SalesPage() {
  const [items, setItems] = useState<ProductSales[]>([]);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<TimeRange>("mtd");
  const [channel, setChannel] = useState<Channel>("all");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  const dateRange = useMemo(
    () => getDateRange(timeRange, customStart, customEnd),
    [timeRange, customStart, customEnd]
  );

  useEffect(() => {
    if (!dateRange.start || !dateRange.end) return;
    setLoading(true);
    fetch(`/api/sales-data?start=${dateRange.start}&end=${dateRange.end}&channel=${channel}`)
      .then((r) => r.json())
      .then((data) => {
        setItems(data.items || []);
        setTotals(data.totals || null);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [dateRange.start, dateRange.end, channel]);

  const recurringPct = totals && totals.units > 0
    ? ((totals.recurring_units / totals.units) * 100).toFixed(1)
    : "0";

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-gray-900">Sales</h1>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {/* Time range */}
          {(["mtd", "last_month", "custom"] as TimeRange[]).map((t) => (
            <button
              key={t}
              onClick={() => setTimeRange(t)}
              className={`rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                timeRange === t
                  ? "bg-brand-600 text-white"
                  : "bg-white border border-gray-300 text-gray-600 hover:bg-gray-50"
              }`}
            >
              {t === "mtd" ? "Month to Date" : t === "last_month" ? "Last Month" : "Custom"}
            </button>
          ))}
          {timeRange === "custom" && (
            <div className="flex items-center gap-1">
              <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)}
                className="rounded-lg border border-gray-300 px-2 py-1.5 text-xs" />
              <span className="text-xs text-gray-400">to</span>
              <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)}
                className="rounded-lg border border-gray-300 px-2 py-1.5 text-xs" />
            </div>
          )}
        </div>
        <div className="flex gap-1">
          {(["all", "amazon", "shopify"] as Channel[]).map((c) => (
            <button
              key={c}
              onClick={() => setChannel(c)}
              className={`rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                channel === c
                  ? "bg-brand-600 text-white"
                  : "bg-white border border-gray-300 text-gray-600 hover:bg-gray-50"
              }`}
            >
              {c === "all" ? "All Channels" : c === "amazon" ? "Amazon" : "Shopify"}
            </button>
          ))}
        </div>
      </div>

      {/* Date label */}
      <p className="text-sm text-gray-500">{dateRange.label}: {dateRange.start} — {dateRange.end}</p>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400">
          <RefreshCw className="h-5 w-5 animate-spin mr-2" /> Loading sales data...
        </div>
      ) : (
        <>
          {/* Stat Cards */}
          {totals && (
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <div className="rounded-xl border border-gray-200 bg-white p-5">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-gray-500">Revenue</p>
                  <DollarSign className="h-4 w-4 text-gray-400" />
                </div>
                <p className="mt-2 text-2xl font-semibold text-gray-900">{fmt(totals.revenue)}</p>
                {channel === "all" && (
                  <p className="mt-1 text-xs text-gray-400">
                    AMZ {fmt(totals.amazon_revenue)} · Shop {fmt(totals.shopify_revenue)}
                  </p>
                )}
              </div>
              <div className="rounded-xl border border-gray-200 bg-white p-5">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-gray-500">Units Sold</p>
                  <ShoppingCart className="h-4 w-4 text-gray-400" />
                </div>
                <p className="mt-2 text-2xl font-semibold text-gray-900">{totals.units.toLocaleString()}</p>
                {channel === "all" && (
                  <p className="mt-1 text-xs text-gray-400">
                    AMZ {totals.amazon_units} · Shop {totals.shopify_units}
                  </p>
                )}
              </div>
              <div className="rounded-xl border border-gray-200 bg-white p-5">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-gray-500">Recurring</p>
                  <TrendingUp className="h-4 w-4 text-gray-400" />
                </div>
                <p className="mt-2 text-2xl font-semibold text-gray-900">{totals.recurring_units.toLocaleString()}</p>
                <p className="mt-1 text-xs text-green-600">{recurringPct}% of total</p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white p-5">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-gray-500">One-Time</p>
                  <ShoppingCart className="h-4 w-4 text-gray-400" />
                </div>
                <p className="mt-2 text-2xl font-semibold text-gray-900">{totals.one_time_units.toLocaleString()}</p>
              </div>
            </div>
          )}

          {/* Product table */}
          <div className="rounded-xl border border-gray-200 bg-white">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="px-4 py-3 text-left font-medium text-gray-500 w-12"></th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">Product</th>
                    {(channel === "all" || channel === "amazon") && (
                      <>
                        <th className="px-4 py-3 text-right font-medium text-amber-600">AMZ Units</th>
                        <th className="px-4 py-3 text-right font-medium text-amber-600">AMZ Rev</th>
                      </>
                    )}
                    {(channel === "all" || channel === "shopify") && (
                      <>
                        <th className="px-4 py-3 text-right font-medium text-emerald-600">Shop Units</th>
                        <th className="px-4 py-3 text-right font-medium text-emerald-600">Shop Rev</th>
                      </>
                    )}
                    <th className="px-4 py-3 text-right font-medium text-gray-500">Total Units</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-500">Total Rev</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-500">Recurring %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-gray-400">
                        No sales data for this period. Make sure products are mapped.
                      </td>
                    </tr>
                  ) : (
                    items.map((item) => {
                      const recurUnits = item.amazon.recurring + item.shopify.recurring;
                      const pct = item.total_units > 0 ? ((recurUnits / item.total_units) * 100).toFixed(0) : "0";
                      return (
                        <tr key={item.product_id} className="hover:bg-gray-50">
                          <td className="px-4 py-2.5">
                            {item.image_url ? (
                              <img src={item.image_url} alt="" className="h-8 w-8 rounded-md object-contain bg-white border border-gray-100" />
                            ) : (
                              <div className="h-8 w-8 rounded-md bg-gray-100" />
                            )}
                          </td>
                          <td className="px-4 py-2.5">
                            <p className="text-sm font-medium text-gray-900 truncate max-w-xs">{item.name}</p>
                            {item.sku && <p className="text-xs text-gray-400">{item.sku}</p>}
                          </td>
                          {(channel === "all" || channel === "amazon") && (
                            <>
                              <td className="px-4 py-2.5 text-right text-gray-700">{item.amazon.units || "—"}</td>
                              <td className="px-4 py-2.5 text-right text-gray-700">{item.amazon.revenue ? fmt(item.amazon.revenue) : "—"}</td>
                            </>
                          )}
                          {(channel === "all" || channel === "shopify") && (
                            <>
                              <td className="px-4 py-2.5 text-right text-gray-700">{item.shopify.units || "—"}</td>
                              <td className="px-4 py-2.5 text-right text-gray-700">{item.shopify.revenue ? fmt(item.shopify.revenue) : "—"}</td>
                            </>
                          )}
                          <td className="px-4 py-2.5 text-right font-medium text-gray-900">{item.total_units}</td>
                          <td className="px-4 py-2.5 text-right font-medium text-gray-900">{fmt(item.total_revenue)}</td>
                          <td className="px-4 py-2.5 text-right">
                            <span className={`text-xs font-medium ${Number(pct) >= 50 ? "text-green-600" : "text-gray-400"}`}>
                              {pct}%
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
