"use client";

import { useEffect, useState } from "react";
import { DollarSign, ShoppingCart, AlertTriangle, Clock, CalendarCheck, TrendingUp } from "lucide-react";

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
    ]).then(([sales, stock, logs, closes]) => {
      setSalesData(sales.totals || null);
      if (Array.isArray(stock)) setLowStock(stock);
      if (Array.isArray(logs)) setCronLogs(logs);
      if (Array.isArray(closes)) setClosings(closes);
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
