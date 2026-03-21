"use client";

import { useEffect, useState, useMemo } from "react";
import { Search, Check, Eye, EyeOff, Archive } from "lucide-react";

interface ExternalSku {
  id: string;
  external_id: string;
  source: string;
  label: string | null;
  title: string | null;
  quantity: number | null;
  status: string;
  mapped: boolean;
  mapped_to: string | null;
}

type FilterKey = "unmapped" | "mapped" | "dismissed" | "discontinued" | "all";

export default function ThreePLReviewClient() {
  const [skus, setSkus] = useState<ExternalSku[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterKey>("unmapped");
  const [saving, setSaving] = useState<Set<string>>(new Set());

  useEffect(() => {
    const needsAll = filter === "dismissed" || filter === "discontinued" || filter === "all";
    fetch(`/api/external-skus?source=3pl${needsAll ? "&include_all=true" : ""}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setSkus(data);
        setLoading(false);
      });
  }, [filter]);

  const filtered = useMemo(() => {
    let list = skus;

    if (filter === "unmapped") list = list.filter((s) => !s.mapped && s.status === "active");
    else if (filter === "mapped") list = list.filter((s) => s.mapped);
    else if (filter === "dismissed") list = list.filter((s) => s.status === "dismissed");
    else if (filter === "discontinued") list = list.filter((s) => s.status === "discontinued");

    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (s) =>
          s.external_id.toLowerCase().includes(q) ||
          s.title?.toLowerCase().includes(q)
      );
    }

    return list.sort((a, b) => (b.quantity ?? 0) - (a.quantity ?? 0));
  }, [skus, filter, search]);

  const setStatusBatch = async (ids: string[], status: string) => {
    setSaving((prev) => new Set([...Array.from(prev), ...ids]));
    await fetch("/api/external-skus", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids, status }),
    });
    setSkus((prev) =>
      prev.map((s) => (ids.includes(s.id) ? { ...s, status } : s))
    );
    setSaving((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.delete(id));
      return next;
    });
  };

  const dismissAllZero = () => {
    const zeroIds = filtered
      .filter((s) => (s.quantity ?? 0) === 0 && !s.mapped && s.status === "active")
      .map((s) => s.id);
    if (zeroIds.length > 0) setStatusBatch(zeroIds, "dismissed");
  };

  const unmappedCount = skus.filter((s) => !s.mapped && s.status === "active").length;
  const mappedCount = skus.filter((s) => s.mapped).length;
  const dismissedCount = skus.filter((s) => s.status === "dismissed").length;
  const discontinuedCount = skus.filter((s) => s.status === "discontinued").length;

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-gray-400">Loading 3PL inventory...</div>;
  }

  const filters: { key: FilterKey; label: string }[] = [
    { key: "unmapped", label: `Needs Review (${unmappedCount})` },
    { key: "mapped", label: `Mapped (${mappedCount})` },
    { key: "dismissed", label: `Dismissed (${dismissedCount})` },
    { key: "discontinued", label: `Discontinued (${discontinuedCount})` },
    { key: "all", label: "All" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">3PL Review</h1>
        <p className="text-sm text-gray-500 mt-1">Review all Amplifier SKUs. Map products or dismiss retired items.</p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-1 flex-wrap">
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
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
            placeholder="Search SKU or name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white pl-9 pr-3 py-2 text-sm placeholder-gray-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>
      </div>

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

      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-3 text-left font-medium text-gray-500">SKU</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Name</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">Available</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                    {filter === "unmapped" ? "All 3PL SKUs have been reviewed!" : "No SKUs match your filter."}
                  </td>
                </tr>
              ) : (
                filtered.map((sku) => (
                  <tr key={sku.id} className={`hover:bg-gray-50 ${sku.status !== "active" && !sku.mapped ? "opacity-50" : ""}`}>
                    <td className="px-4 py-3 font-mono text-sm text-gray-900">{sku.external_id}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">{sku.title || "—"}</td>
                    <td className={`px-4 py-3 text-right font-medium ${(sku.quantity ?? 0) === 0 ? "text-gray-300" : "text-gray-900"}`}>
                      {sku.quantity ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      {sku.mapped ? (
                        <div>
                          <span className="inline-flex rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">Mapped</span>
                          <p className="text-xs text-gray-400 mt-0.5 truncate max-w-40">→ {sku.mapped_to}</p>
                        </div>
                      ) : sku.status === "discontinued" ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2 py-0.5 text-xs font-medium text-orange-700">
                          <Archive className="h-3 w-3" /> Discontinued
                        </span>
                      ) : sku.status === "dismissed" ? (
                        <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">Dismissed</span>
                      ) : (
                        <span className="inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">Needs Mapping</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {sku.status === "dismissed" || sku.status === "discontinued" ? (
                        <button
                          onClick={() => setStatusBatch([sku.id], "active")}
                          disabled={saving.has(sku.id)}
                          className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                        >
                          <Eye className="h-3 w-3" /> Restore
                        </button>
                      ) : sku.mapped ? (
                        <Check className="h-4 w-4 text-green-500 inline" />
                      ) : (
                        <button
                          onClick={() => setStatusBatch([sku.id], "dismissed")}
                          disabled={saving.has(sku.id)}
                          className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-2 py-1 text-xs font-medium text-gray-600 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                        >
                          <EyeOff className="h-3 w-3" /> Dismiss
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
