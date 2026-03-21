"use client";

import { useEffect, useState, useMemo } from "react";
import { Search, Check, Eye, EyeOff } from "lucide-react";

interface ExternalSku {
  id: string;
  external_id: string;
  source: string;
  title: string | null;
  image_url: string | null;
  price: number | null;
  quantity: number | null;
  seller_sku: string | null;
  dismissed: boolean;
  mapped: boolean;
  mapped_to: string | null;
}

export default function AmazonReviewClient() {
  const [skus, setSkus] = useState<ExternalSku[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "unmapped" | "mapped" | "dismissed">("unmapped");
  const [saving, setSaving] = useState<Set<string>>(new Set());
  const [showDismissed, setShowDismissed] = useState(false);

  useEffect(() => {
    const includeDismissed = filter === "dismissed" || showDismissed;
    fetch(`/api/external-skus?source=amazon${includeDismissed ? "&include_dismissed=true" : ""}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setSkus(data);
        setLoading(false);
      });
  }, [filter, showDismissed]);

  const filtered = useMemo(() => {
    let list = skus;

    if (filter === "unmapped") list = list.filter((s) => !s.mapped && !s.dismissed);
    else if (filter === "mapped") list = list.filter((s) => s.mapped);
    else if (filter === "dismissed") list = list.filter((s) => s.dismissed);

    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (s) =>
          s.external_id.toLowerCase().includes(q) ||
          s.title?.toLowerCase().includes(q) ||
          s.seller_sku?.toLowerCase().includes(q)
      );
    }

    return list.sort((a, b) => (b.quantity ?? 0) - (a.quantity ?? 0));
  }, [skus, filter, search]);

  const dismiss = async (ids: string[]) => {
    setSaving((prev) => new Set([...Array.from(prev), ...ids]));
    await fetch("/api/external-skus", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids, dismissed: true }),
    });
    setSkus((prev) =>
      prev.map((s) => (ids.includes(s.id) ? { ...s, dismissed: true } : s))
    );
    setSaving((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.delete(id));
      return next;
    });
  };

  const undismiss = async (ids: string[]) => {
    setSaving((prev) => new Set([...Array.from(prev), ...ids]));
    await fetch("/api/external-skus", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids, dismissed: false }),
    });
    setSkus((prev) =>
      prev.map((s) => (ids.includes(s.id) ? { ...s, dismissed: false } : s))
    );
    setSaving((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.delete(id));
      return next;
    });
  };

  const dismissAllZero = () => {
    const zeroIds = filtered
      .filter((s) => (s.quantity ?? 0) === 0 && !s.mapped && !s.dismissed)
      .map((s) => s.id);
    if (zeroIds.length > 0) dismiss(zeroIds);
  };

  const unmappedCount = skus.filter((s) => !s.mapped && !s.dismissed).length;
  const mappedCount = skus.filter((s) => s.mapped).length;
  const dismissedCount = skus.filter((s) => s.dismissed).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-400">
        Loading Amazon listings...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Amazon Review</h1>
          <p className="text-sm text-gray-500 mt-1">
            Review all Amazon ASINs. Map products or dismiss retired listings.
          </p>
        </div>
      </div>

      {/* Stats + filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-1">
          {[
            { key: "unmapped" as const, label: `Needs Review (${unmappedCount})` },
            { key: "mapped" as const, label: `Mapped (${mappedCount})` },
            { key: "dismissed" as const, label: `Dismissed (${dismissedCount})` },
            { key: "all" as const, label: "All" },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => {
                setFilter(f.key);
                if (f.key === "dismissed") setShowDismissed(true);
              }}
              className={`rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                filter === f.key
                  ? "bg-brand-600 text-white"
                  : "bg-white border border-gray-300 text-gray-600 hover:bg-gray-50"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by title, ASIN, or SKU..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white pl-9 pr-3 py-2 text-sm placeholder-gray-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>
      </div>

      {/* Bulk actions */}
      {filter === "unmapped" && (
        <div className="flex gap-2">
          <button
            onClick={dismissAllZero}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
          >
            <EyeOff className="h-3.5 w-3.5" />
            Dismiss all with 0 inventory
          </button>
        </div>
      )}

      {/* Listing table */}
      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-3 text-left font-medium text-gray-500 w-16">Image</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Product</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">ASIN</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Seller SKU</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">FBA Qty</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">Price</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                    {filter === "unmapped"
                      ? "All Amazon listings have been reviewed!"
                      : "No listings match your filter."}
                  </td>
                </tr>
              ) : (
                filtered.map((sku) => (
                  <tr key={sku.id} className={`hover:bg-gray-50 ${sku.dismissed ? "opacity-50" : ""}`}>
                    <td className="px-4 py-2.5">
                      {sku.image_url ? (
                        <img
                          src={sku.image_url}
                          alt=""
                          className="h-12 w-12 rounded-md object-contain bg-white border border-gray-100"
                        />
                      ) : (
                        <div className="h-12 w-12 rounded-md bg-gray-100" />
                      )}
                    </td>
                    <td className="px-4 py-2.5 max-w-xs">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {sku.title || "—"}
                      </p>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-gray-600">
                      {sku.external_id}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-gray-500">
                      {sku.seller_sku || "—"}
                    </td>
                    <td className={`px-4 py-2.5 text-right font-medium ${
                      (sku.quantity ?? 0) === 0 ? "text-gray-300" : "text-gray-900"
                    }`}>
                      {sku.quantity ?? "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right text-gray-600">
                      {sku.price ? `$${sku.price.toFixed(2)}` : "—"}
                    </td>
                    <td className="px-4 py-2.5">
                      {sku.mapped ? (
                        <div>
                          <span className="inline-flex rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
                            Mapped
                          </span>
                          <p className="text-xs text-gray-400 mt-0.5 truncate max-w-32">
                            → {sku.mapped_to}
                          </p>
                        </div>
                      ) : sku.dismissed ? (
                        <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
                          Dismissed
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                          Needs Mapping
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {sku.dismissed ? (
                        <button
                          onClick={() => undismiss([sku.id])}
                          disabled={saving.has(sku.id)}
                          className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                        >
                          <Eye className="h-3 w-3" />
                          Restore
                        </button>
                      ) : sku.mapped ? (
                        <span className="text-xs text-gray-400">
                          <Check className="h-4 w-4 text-green-500 inline" />
                        </span>
                      ) : (
                        <button
                          onClick={() => dismiss([sku.id])}
                          disabled={saving.has(sku.id)}
                          className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-2 py-1 text-xs font-medium text-gray-600 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                        >
                          <EyeOff className="h-3 w-3" />
                          Dismiss
                        </button>
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
