"use client";

import { useState, useEffect, useCallback } from "react";
import { Check, RefreshCw, ArrowUpDown, Loader2 } from "lucide-react";

interface CostCompareItem {
  product_name: string;
  image_url: string | null;
  qb_cost: number | null;
  shopify_cost: number | null;
  needs_sync: boolean;
  cost_incomplete: boolean;
  variant_id: string;
  shopify_variant_id: string;
}

export default function CostSyncPage() {
  const [items, setItems] = useState<CostCompareItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncingIds, setSyncingIds] = useState<Set<string>>(new Set());
  const [syncAllRunning, setSyncAllRunning] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/shopify-cost-compare");
      if (!res.ok) throw new Error("Failed to fetch cost comparison");
      const data = await res.json();
      setItems(data.items || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const syncOne = async (item: CostCompareItem) => {
    if (item.qb_cost === null) return;

    setSyncingIds((prev) => {
      const next = new Set(prev);
      next.add(item.variant_id);
      return next;
    });

    try {
      const res = await fetch("/api/shopify-cost-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          variant_id: item.variant_id,
          cost: item.qb_cost,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Sync failed");
      }

      // Update local state to reflect synced cost
      setItems((prev) =>
        prev.map((i) => {
          if (i.variant_id === item.variant_id) {
            return {
              ...i,
              shopify_cost: item.qb_cost,
              needs_sync: false,
            };
          }
          return i;
        })
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sync failed";
      alert(`Failed to sync ${item.product_name}: ${message}`);
    } finally {
      setSyncingIds((prev) => {
        const next = new Set(prev);
        next.delete(item.variant_id);
        return next;
      });
    }
  };

  const syncAll = async () => {
    const toSync = displayItems.filter((i) => i.needs_sync);
    if (toSync.length === 0) return;

    setSyncAllRunning(true);
    for (const item of toSync) {
      await syncOne(item);
    }
    setSyncAllRunning(false);
  };

  // Only show items with a Shopify mapping and complete cost
  const displayItems = items.filter((i) => !i.cost_incomplete);
  const needsSyncCount = displayItems.filter((i) => i.needs_sync).length;

  const formatCost = (cost: number | null): string => {
    if (cost === null) return "--";
    return `$${cost.toFixed(4)}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        <span className="ml-3 text-gray-500">
          Loading cost comparison...
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
        <p className="text-red-700">{error}</p>
        <button
          onClick={fetchData}
          className="mt-3 rounded-lg bg-red-100 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-200"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Cost Sync</h1>
          <p className="text-sm text-gray-500 mt-1">
            Push QuickBooks costs to Shopify variant costs
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchData}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
          {needsSyncCount > 0 && (
            <button
              onClick={syncAll}
              disabled={syncAllRunning}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {syncAllRunning ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowUpDown className="h-4 w-4" />
              )}
              Sync All ({needsSyncCount})
            </button>
          )}
        </div>
      </div>

      {displayItems.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center">
          <ArrowUpDown className="mx-auto h-10 w-10 text-gray-300 mb-3" />
          <p className="text-gray-500">
            No Shopify-mapped products with complete costs found.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Product
                </th>
                <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  QB Cost
                </th>
                <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Shopify Cost
                </th>
                <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Diff
                </th>
                <th className="px-5 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {displayItems.map((item) => {
                const isSyncing = syncingIds.has(item.variant_id);
                let diff: number | null = null;
                if (
                  item.qb_cost !== null &&
                  item.shopify_cost !== null
                ) {
                  diff = item.qb_cost - item.shopify_cost;
                }

                return (
                  <tr key={item.variant_id} className="hover:bg-gray-50">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        {item.image_url ? (
                          <img
                            src={item.image_url}
                            alt=""
                            className="h-9 w-9 rounded-lg object-contain bg-white border border-gray-100 flex-shrink-0"
                          />
                        ) : (
                          <div className="h-9 w-9 rounded-lg bg-gray-100 flex-shrink-0" />
                        )}
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {item.product_name}
                          </p>
                          <p className="text-xs text-gray-400 font-mono">
                            {item.shopify_variant_id}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-right text-sm font-mono text-gray-900">
                      {formatCost(item.qb_cost)}
                    </td>
                    <td className="px-5 py-3 text-right text-sm font-mono text-gray-900">
                      {formatCost(item.shopify_cost)}
                    </td>
                    <td className="px-5 py-3 text-right text-sm font-mono">
                      {diff !== null && diff !== 0 ? (
                        <span
                          className={
                            diff > 0
                              ? "text-red-600"
                              : "text-green-600"
                          }
                        >
                          {diff > 0 ? "+" : ""}
                          {diff.toFixed(4)}
                        </span>
                      ) : diff === 0 ? (
                        <span className="text-gray-400">--</span>
                      ) : (
                        <span className="text-gray-400">--</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-center">
                      {item.needs_sync ? (
                        <button
                          onClick={() => syncOne(item)}
                          disabled={isSyncing}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50"
                        >
                          {isSyncing ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <ArrowUpDown className="h-3 w-3" />
                          )}
                          Sync
                        </button>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-green-600">
                          <Check className="h-4 w-4" />
                          <span className="text-xs font-medium">
                            Synced
                          </span>
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {items.filter((i) => i.cost_incomplete).length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-medium text-amber-800">
            {items.filter((i) => i.cost_incomplete).length} product(s) with
            incomplete costs are hidden. Update their costs in QuickBooks
            first.
          </p>
        </div>
      )}
    </div>
  );
}
