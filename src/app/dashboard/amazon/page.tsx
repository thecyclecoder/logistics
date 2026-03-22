"use client";

import { useState, useEffect } from "react";
import { RefreshCw, AlertTriangle, DollarSign, Package } from "lucide-react";

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

interface Totals {
  units: number;
  revenue: number;
  fba_fees: number;
  referral_fees: number;
  promotions: number;
  other_fees: number;
  total_amazon_fees: number;
  net_after_amazon: number;
  total_cogs: number;
  products_missing_cost: number;
}

function fmt(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(n);
}

function fmtPct(n: number): string {
  return n.toFixed(1) + "%";
}

export default function AmazonMarginPage() {
  const [month, setMonth] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<ProductMargin[]>([]);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [unmappedSkus, setUnmappedSkus] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/amazon/margin?month=${month}`, { cache: "no-store" });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setProducts(data.products || []);
        setTotals(data.totals || null);
        setUnmappedSkus(data.unmapped_skus || []);
      }
    } catch {
      setError("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [month]);

  const totalMarginPreCogs = totals && totals.revenue > 0
    ? (totals.net_after_amazon / totals.revenue) * 100 : 0;
  const totalNetAfterCogs = totals ? totals.net_after_amazon - totals.total_cogs : 0;
  const totalMarginAfterCogs = totals && totals.revenue > 0
    ? (totalNetAfterCogs / totals.revenue) * 100 : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Amazon Margin Analysis</h1>
          <p className="text-sm text-gray-500 mt-1">Revenue, Amazon fees, and profitability by product</p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
          <button
            onClick={loadData}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 rounded-lg px-4 py-3">
          <AlertTriangle className="h-4 w-4" /> {error}
        </div>
      )}

      {/* Summary Cards */}
      {totals && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="text-xs font-medium text-gray-500">Revenue</p>
            <p className="mt-1 text-xl font-bold text-gray-900">{fmt(totals.revenue)}</p>
            <p className="text-xs text-gray-400 mt-1">{totals.units.toLocaleString()} units</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="text-xs font-medium text-gray-500">Amazon Fees</p>
            <p className="mt-1 text-xl font-bold text-red-600">{fmt(totals.total_amazon_fees)}</p>
            <p className="text-xs text-red-400 mt-1">{totals.revenue > 0 ? fmtPct((totals.total_amazon_fees / totals.revenue) * 100) : "0%"} of revenue</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="text-xs font-medium text-gray-500">Net After Amazon</p>
            <p className="mt-1 text-xl font-bold text-blue-700">{fmt(totals.net_after_amazon)}</p>
            <p className="text-xs text-blue-500 mt-1">{fmtPct(totalMarginPreCogs)} margin</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="text-xs font-medium text-gray-500">COGS</p>
            <p className="mt-1 text-xl font-bold text-gray-700">{fmt(totals.total_cogs)}</p>
            {totals.products_missing_cost > 0 && (
              <p className="text-xs text-amber-600 mt-1">{totals.products_missing_cost} products missing cost</p>
            )}
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="text-xs font-medium text-gray-500">Net Profit</p>
            <p className={`mt-1 text-xl font-bold ${totalNetAfterCogs >= 0 ? "text-green-700" : "text-red-700"}`}>{fmt(totalNetAfterCogs)}</p>
            <p className={`text-xs mt-1 ${totalMarginAfterCogs >= 0 ? "text-green-500" : "text-red-500"}`}>{fmtPct(totalMarginAfterCogs)} margin</p>
          </div>
        </div>
      )}

      {/* Fee Breakdown */}
      {totals && (
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Fee Breakdown</h2>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <div className="flex items-center gap-3">
              <div className="h-8 w-1 rounded-full bg-orange-400" />
              <div>
                <p className="text-xs text-gray-500">FBA Fulfillment</p>
                <p className="text-sm font-semibold text-gray-900">{fmt(totals.fba_fees)}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-8 w-1 rounded-full bg-purple-400" />
              <div>
                <p className="text-xs text-gray-500">Referral Commission</p>
                <p className="text-sm font-semibold text-gray-900">{fmt(totals.referral_fees)}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-8 w-1 rounded-full bg-pink-400" />
              <div>
                <p className="text-xs text-gray-500">Promotions</p>
                <p className="text-sm font-semibold text-gray-900">{fmt(totals.promotions)}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-8 w-1 rounded-full bg-gray-400" />
              <div>
                <p className="text-xs text-gray-500">Other Fees</p>
                <p className="text-sm font-semibold text-gray-900">{fmt(totals.other_fees)}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Unmapped SKUs Warning */}
      {unmappedSkus.length > 0 && (
        <div className="flex items-start gap-2 text-sm text-amber-700 bg-amber-50 rounded-lg px-4 py-3">
          <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium">{unmappedSkus.length} unmapped Seller SKU{unmappedSkus.length > 1 ? "s" : ""}</p>
            <p className="text-xs text-amber-600 mt-0.5">
              {unmappedSkus.slice(0, 5).join(", ")}{unmappedSkus.length > 5 ? ` +${unmappedSkus.length - 5} more` : ""}
            </p>
          </div>
        </div>
      )}

      {/* Product Table */}
      {products.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr className="border-b border-gray-200">
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Product</th>
                  <th className="px-3 py-3 text-right font-medium text-gray-500">Units</th>
                  <th className="px-3 py-3 text-right font-medium text-gray-500">Revenue</th>
                  <th className="px-3 py-3 text-right font-medium text-gray-500">FBA Fee</th>
                  <th className="px-3 py-3 text-right font-medium text-gray-500">Referral</th>
                  <th className="px-3 py-3 text-right font-medium text-gray-500">Promos</th>
                  <th className="px-3 py-3 text-right font-medium text-gray-500">Net Amazon</th>
                  <th className="px-3 py-3 text-right font-medium text-gray-500">Margin</th>
                  <th className="px-3 py-3 text-right font-medium text-gray-500">COGS</th>
                  <th className="px-3 py-3 text-right font-medium text-gray-500">Net Profit</th>
                  <th className="px-3 py-3 text-right font-medium text-gray-500">Margin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {products.map((p) => (
                  <tr key={p.product_id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {p.image_url ? (
                          <img src={p.image_url} alt="" className="h-8 w-8 rounded object-contain border border-gray-100 flex-shrink-0" />
                        ) : (
                          <div className="h-8 w-8 rounded bg-gray-100 flex items-center justify-center flex-shrink-0">
                            <Package className="h-4 w-4 text-gray-400" />
                          </div>
                        )}
                        <span className="font-medium text-gray-900 truncate max-w-[200px]">{p.name}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right text-gray-700">{p.units}</td>
                    <td className="px-3 py-3 text-right font-medium text-gray-900">{fmt(p.revenue)}</td>
                    <td className="px-3 py-3 text-right text-red-600">{fmt(p.fba_fees)}</td>
                    <td className="px-3 py-3 text-right text-red-600">{fmt(p.referral_fees)}</td>
                    <td className="px-3 py-3 text-right text-pink-600">{fmt(p.promotions)}</td>
                    <td className="px-3 py-3 text-right font-medium text-blue-700">{fmt(p.net_after_amazon)}</td>
                    <td className="px-3 py-3 text-right">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        p.margin_pre_cogs >= 50 ? "bg-green-50 text-green-700"
                        : p.margin_pre_cogs >= 30 ? "bg-blue-50 text-blue-700"
                        : "bg-amber-50 text-amber-700"
                      }`}>
                        {fmtPct(p.margin_pre_cogs)}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right">
                      {p.unit_cost !== null ? (
                        <span className={p.cost_incomplete ? "text-amber-600" : "text-gray-700"}>
                          {fmt(p.total_cogs || 0)}
                          {p.cost_incomplete && <span className="text-amber-400 ml-0.5">*</span>}
                        </span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right">
                      {p.net_after_cogs !== null ? (
                        <span className={`font-medium ${p.net_after_cogs >= 0 ? "text-green-700" : "text-red-700"}`}>
                          {fmt(p.net_after_cogs)}
                        </span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right">
                      {p.margin_after_cogs !== null ? (
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          p.margin_after_cogs >= 30 ? "bg-green-50 text-green-700"
                          : p.margin_after_cogs >= 15 ? "bg-blue-50 text-blue-700"
                          : p.margin_after_cogs >= 0 ? "bg-amber-50 text-amber-700"
                          : "bg-red-50 text-red-700"
                        }`}>
                          {fmtPct(p.margin_after_cogs)}
                        </span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                  </tr>
                ))}
                {/* Totals row */}
                {totals && (
                  <tr className="bg-gray-50 font-semibold">
                    <td className="px-4 py-3 text-gray-900">Totals</td>
                    <td className="px-3 py-3 text-right text-gray-900">{totals.units}</td>
                    <td className="px-3 py-3 text-right text-gray-900">{fmt(totals.revenue)}</td>
                    <td className="px-3 py-3 text-right text-red-700">{fmt(totals.fba_fees)}</td>
                    <td className="px-3 py-3 text-right text-red-700">{fmt(totals.referral_fees)}</td>
                    <td className="px-3 py-3 text-right text-pink-700">{fmt(totals.promotions)}</td>
                    <td className="px-3 py-3 text-right text-blue-800">{fmt(totals.net_after_amazon)}</td>
                    <td className="px-3 py-3 text-right">
                      <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-blue-50 text-blue-700">
                        {fmtPct(totalMarginPreCogs)}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right text-gray-700">{fmt(totals.total_cogs)}</td>
                    <td className="px-3 py-3 text-right">
                      <span className={totalNetAfterCogs >= 0 ? "text-green-800" : "text-red-800"}>
                        {fmt(totalNetAfterCogs)}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        totalMarginAfterCogs >= 0 ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
                      }`}>
                        {fmtPct(totalMarginAfterCogs)}
                      </span>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && products.length === 0 && !error && (
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center">
          <DollarSign className="mx-auto h-10 w-10 text-gray-300 mb-3" />
          <p className="text-gray-500">No Amazon financial data for {month}</p>
          <p className="text-sm text-gray-400 mt-1">Data comes from Amazon&apos;s Finances API settlement events</p>
        </div>
      )}
    </div>
  );
}
