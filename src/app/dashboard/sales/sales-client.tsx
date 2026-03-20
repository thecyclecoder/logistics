"use client";

import { useState } from "react";
import type { MonthlySalesSummary } from "@/lib/types/database";
import type { LucideIcon } from "lucide-react";

interface SalesClientProps {
  months: string[];
  salesData: MonthlySalesSummary[];
  formatCurrency: (n: number) => string;
  StatCard: React.ComponentType<{
    title: string;
    value: string | number;
    icon: LucideIcon;
  }>;
  icons: {
    DollarSign: LucideIcon;
    ShoppingCart: LucideIcon;
    RotateCcw: LucideIcon;
    Receipt: LucideIcon;
  };
}

export default function SalesClient({
  months,
  salesData,
  formatCurrency,
  StatCard,
  icons,
}: SalesClientProps) {
  const [selectedMonth, setSelectedMonth] = useState(months[0] || "");

  const filtered = salesData.filter((s) => s.period_month === selectedMonth);

  const netRevenue = filtered.reduce((s, r) => s + Number(r.total_net), 0);
  const unitsSold = filtered.reduce((s, r) => s + Number(r.total_quantity), 0);
  const totalRefunds = filtered.reduce((s, r) => s + Number(r.total_refunds), 0);
  const totalFees = filtered.reduce((s, r) => s + Number(r.total_fees), 0);

  const amazonSales = filtered.filter((s) => s.channel === "amazon");
  const shopifySales = filtered.filter((s) => s.channel === "shopify");

  const channelStats = (items: MonthlySalesSummary[]) => ({
    net: items.reduce((s, r) => s + Number(r.total_net), 0),
    units: items.reduce((s, r) => s + Number(r.total_quantity), 0),
    orders: items.reduce((s, r) => s + Number(r.order_count), 0),
  });

  const amzStats = channelStats(amazonSales);
  const shopStats = channelStats(shopifySales);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Sales</h1>
        <select
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        >
          {months.length === 0 && <option value="">No data</option>}
          {months.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Net Revenue" value={formatCurrency(netRevenue)} icon={icons.DollarSign} />
        <StatCard title="Units Sold" value={unitsSold.toLocaleString()} icon={icons.ShoppingCart} />
        <StatCard
          title="Total Refunds"
          value={formatCurrency(totalRefunds)}
          icon={icons.RotateCcw}
        />
        <StatCard title="Platform Fees" value={formatCurrency(totalFees)} icon={icons.Receipt} />
      </div>

      {/* Channel Breakdown */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
            <h3 className="text-sm font-semibold text-gray-900">Amazon</h3>
          </div>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-lg font-semibold text-gray-900">{formatCurrency(amzStats.net)}</p>
              <p className="text-xs text-gray-500">Revenue</p>
            </div>
            <div>
              <p className="text-lg font-semibold text-gray-900">{amzStats.units}</p>
              <p className="text-xs text-gray-500">Units</p>
            </div>
            <div>
              <p className="text-lg font-semibold text-gray-900">{amzStats.orders}</p>
              <p className="text-xs text-gray-500">Orders</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
            <h3 className="text-sm font-semibold text-gray-900">Shopify</h3>
          </div>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-lg font-semibold text-gray-900">
                {formatCurrency(shopStats.net)}
              </p>
              <p className="text-xs text-gray-500">Revenue</p>
            </div>
            <div>
              <p className="text-lg font-semibold text-gray-900">{shopStats.units}</p>
              <p className="text-xs text-gray-500">Units</p>
            </div>
            <div>
              <p className="text-lg font-semibold text-gray-900">{shopStats.orders}</p>
              <p className="text-xs text-gray-500">Orders</p>
            </div>
          </div>
        </div>
      </div>

      {/* Per-product table */}
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-3 text-left font-medium text-gray-500">Product</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Channel</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">Units</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">Gross</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">Refunds</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">Fees</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">Net</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                    No sales data for this period
                  </td>
                </tr>
              ) : (
                filtered.map((row, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {row.quickbooks_name}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          row.channel === "amazon"
                            ? "bg-amber-50 text-amber-700"
                            : "bg-emerald-50 text-emerald-700"
                        }`}
                      >
                        {row.channel}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">
                      {Number(row.total_quantity)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">
                      {formatCurrency(Number(row.total_gross))}
                    </td>
                    <td className="px-4 py-3 text-right text-red-600">
                      {Number(row.total_refunds) > 0
                        ? `-${formatCurrency(Number(row.total_refunds))}`
                        : "$0"}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-500">
                      {formatCurrency(Number(row.total_fees))}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">
                      {formatCurrency(Number(row.total_net))}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
