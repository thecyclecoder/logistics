"use client";

import { useEffect, useState } from "react";
import { RefreshCw, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";

interface AuditItem {
  product_id: string;
  name: string;
  sku: string | null;
  image_url: string | null;
  qb_starting: number;
  amazon_sold: number;
  shopify_sold: number;
  total_sold: number;
  expected_remaining: number;
  current_fba: number;
  current_tpl: number;
  actual_on_hand: number;
  variance: number;
}

interface AuditMeta {
  qb_snapshot_date: string | null;
  sales_since: string;
  fba_snapshot_date: string | null;
  tpl_snapshot_date: string | null;
}

export default function InventoryPage() {
  const [audit, setAudit] = useState<AuditItem[]>([]);
  const [meta, setMeta] = useState<AuditMeta | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/inventory-audit")
      .then((r) => r.json())
      .then((data) => {
        setAudit(data.audit || []);
        setMeta(data.meta || null);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-400">
        <RefreshCw className="h-5 w-5 animate-spin mr-2" /> Loading inventory audit...
      </div>
    );
  }

  const totalVariance = audit.reduce((s, a) => s + a.variance, 0);
  const matchCount = audit.filter((a) => a.variance === 0).length;
  const overCount = audit.filter((a) => a.variance > 0).length;
  const underCount = audit.filter((a) => a.variance < 0).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Inventory Audit</h1>
        <p className="text-sm text-gray-500 mt-1">
          Reconcile QuickBooks starting inventory against actual channel inventory after sales.
        </p>
      </div>

      {/* Meta info */}
      {meta && (
        <div className="rounded-lg bg-gray-50 border border-gray-200 px-4 py-3 text-xs text-gray-500 space-y-1">
          <p>QB Starting Inventory: <span className="font-medium text-gray-700">{meta.qb_snapshot_date || "Not synced"}</span></p>
          <p>Sales counted since: <span className="font-medium text-gray-700">{meta.sales_since}</span></p>
          <p>FBA Snapshot: <span className="font-medium text-gray-700">{meta.fba_snapshot_date || "None"}</span> · 3PL Snapshot: <span className="font-medium text-gray-700">{meta.tpl_snapshot_date || "None"}</span></p>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <p className="text-sm font-medium text-gray-500">Products Tracked</p>
          <p className="mt-2 text-2xl font-semibold text-gray-900">{audit.length}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <p className="text-sm font-medium text-gray-500">Reconciled</p>
          <p className="mt-2 text-2xl font-semibold text-green-600">{matchCount}</p>
          <p className="text-xs text-gray-400">variance = 0</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <p className="text-sm font-medium text-gray-500">Over / Under</p>
          <p className="mt-2 text-2xl font-semibold text-gray-900">
            <span className="text-green-600">{overCount}</span>
            {" / "}
            <span className="text-red-600">{underCount}</span>
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <p className="text-sm font-medium text-gray-500">Net Variance</p>
          <p className={`mt-2 text-2xl font-semibold ${totalVariance === 0 ? "text-green-600" : totalVariance > 0 ? "text-blue-600" : "text-red-600"}`}>
            {totalVariance > 0 ? "+" : ""}{totalVariance}
          </p>
        </div>
      </div>

      {/* Audit table */}
      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-3 text-left font-medium text-gray-500 w-10"></th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Product</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">QB Start</th>
                <th className="px-4 py-3 text-right font-medium text-amber-600">AMZ Sold</th>
                <th className="px-4 py-3 text-right font-medium text-emerald-600">Shop Sold</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">Expected</th>
                <th className="px-4 py-3 text-right font-medium text-amber-600">FBA</th>
                <th className="px-4 py-3 text-right font-medium text-purple-600">3PL</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">Actual</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">Variance</th>
                <th className="px-4 py-3 text-center font-medium text-gray-500 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {audit.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-4 py-8 text-center text-gray-400">
                    No audit data. Sync QuickBooks, run inventory syncs, and map your products.
                  </td>
                </tr>
              ) : (
                audit.map((item) => (
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
                    <td className="px-4 py-2.5 text-right font-medium text-gray-900">{item.qb_starting}</td>
                    <td className="px-4 py-2.5 text-right text-amber-700">{item.amazon_sold > 0 ? `-${item.amazon_sold}` : "—"}</td>
                    <td className="px-4 py-2.5 text-right text-emerald-700">{item.shopify_sold > 0 ? `-${item.shopify_sold}` : "—"}</td>
                    <td className="px-4 py-2.5 text-right font-medium text-gray-700">{item.expected_remaining}</td>
                    <td className="px-4 py-2.5 text-right text-amber-600">{item.current_fba || "—"}</td>
                    <td className="px-4 py-2.5 text-right text-purple-600">{item.current_tpl || "—"}</td>
                    <td className="px-4 py-2.5 text-right font-medium text-gray-900">{item.actual_on_hand}</td>
                    <td className={`px-4 py-2.5 text-right font-semibold ${
                      item.variance === 0 ? "text-green-600" : item.variance > 0 ? "text-blue-600" : "text-red-600"
                    }`}>
                      {item.variance > 0 ? "+" : ""}{item.variance}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      {item.variance === 0 ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500 inline" />
                      ) : Math.abs(item.variance) <= 5 ? (
                        <AlertTriangle className="h-4 w-4 text-amber-500 inline" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-500 inline" />
                      )}
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
