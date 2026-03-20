import { createClient } from "@/lib/supabase/server";
import StatCard from "@/components/stat-card";
import SyncButton from "@/components/sync-button";
import RevenueChart from "@/components/revenue-chart";
import { Package, DollarSign, ShoppingCart, Boxes, AlertTriangle, Clock } from "lucide-react";
import type { CronLog, CurrentInventory } from "@/lib/types/database";

export const revalidate = 60;

function formatCurrency(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

function timeAgo(date: string): string {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default async function DashboardPage() {
  const supabase = createClient();

  // Fetch stats in parallel
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const [productsRes, salesRes, inventoryRes, cronRes] = await Promise.all([
    supabase.from("products").select("id", { count: "exact" }).eq("active", true),
    supabase.from("monthly_sales_summary").select("*").eq("period_month", currentMonth),
    supabase.from("current_inventory").select("*"),
    supabase
      .from("cron_logs")
      .select("*")
      .order("started_at", { ascending: false })
      .limit(10),
  ]);

  const productCount = productsRes.count || 0;

  const salesData = (salesRes.data || []) as { total_net: number; total_quantity: number }[];
  const mtdRevenue = salesData.reduce((s, r) => s + Number(r.total_net), 0);
  const mtdUnits = salesData.reduce((s, r) => s + Number(r.total_quantity), 0);

  const inventory = (inventoryRes.data || []) as CurrentInventory[];
  const totalInventory = inventory.reduce((s, r) => s + r.total, 0);
  const lowStock = inventory.filter(
    (i) => i.reorder_point > 0 && i.total < i.reorder_point && i.total > 0
  );
  const outOfStock = inventory.filter((i) => i.total === 0 && i.reorder_point > 0);

  const cronLogs = (cronRes.data || []) as CronLog[];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Overview</h1>
        <SyncButton />
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Products in QB" value={productCount} icon={Package} />
        <StatCard title="MTD Revenue" value={formatCurrency(mtdRevenue)} icon={DollarSign} />
        <StatCard title="MTD Units Sold" value={mtdUnits.toLocaleString()} icon={ShoppingCart} />
        <StatCard title="Total Inventory" value={totalInventory.toLocaleString()} icon={Boxes} />
      </div>

      {/* Revenue Chart */}
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="mb-4 text-base font-semibold text-gray-900">Revenue (Last 6 Months)</h2>
        <RevenueChart />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Low Stock Alerts */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="h-4.5 w-4.5 text-amber-500" />
            <h2 className="text-base font-semibold text-gray-900">
              Low Stock Alerts ({lowStock.length + outOfStock.length})
            </h2>
          </div>
          {lowStock.length === 0 && outOfStock.length === 0 ? (
            <p className="text-sm text-gray-400">No alerts</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {outOfStock.map((item) => (
                <div
                  key={item.product_id}
                  className="flex items-center justify-between rounded-lg bg-red-50 px-3 py-2"
                >
                  <span className="text-sm font-medium text-red-800">
                    {item.quickbooks_name}
                  </span>
                  <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                    Out of Stock
                  </span>
                </div>
              ))}
              {lowStock.map((item) => (
                <div
                  key={item.product_id}
                  className="flex items-center justify-between rounded-lg bg-amber-50 px-3 py-2"
                >
                  <span className="text-sm font-medium text-amber-800">
                    {item.quickbooks_name}
                  </span>
                  <span className="text-xs text-amber-600">
                    {item.total} / {item.reorder_point}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Sync Jobs */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="h-4.5 w-4.5 text-gray-400" />
            <h2 className="text-base font-semibold text-gray-900">Recent Sync Jobs</h2>
          </div>
          {cronLogs.length === 0 ? (
            <p className="text-sm text-gray-400">No sync jobs yet</p>
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
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                            log.status === "success"
                              ? "bg-green-50 text-green-700"
                              : log.status === "error"
                                ? "bg-red-50 text-red-700"
                                : "bg-blue-50 text-blue-700"
                          }`}
                        >
                          {log.status}
                        </span>
                      </td>
                      <td className="py-2 text-right text-gray-500">
                        {log.records_processed ?? "-"}
                      </td>
                      <td className="py-2 text-right text-gray-500">
                        {timeAgo(log.started_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
