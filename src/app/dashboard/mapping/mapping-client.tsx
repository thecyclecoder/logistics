"use client";

import { useState, useMemo } from "react";
import { Plus, Search, Pencil, Trash2, AlertTriangle, X } from "lucide-react";
import type { Product, SkuMapping, Source } from "@/lib/types/database";

const SOURCE_COLORS: Record<Source, string> = {
  amazon: "bg-amber-50 text-amber-700",
  "3pl": "bg-purple-50 text-purple-700",
  shopify: "bg-emerald-50 text-emerald-700",
  manual: "bg-gray-100 text-gray-600",
};

const SOURCE_HINTS: Record<Source, string> = {
  amazon: "Add one row per ASIN and one per Seller SKU if different",
  "3pl": "Use the SKU as it appears in the 3PL system",
  shopify: "Use the Shopify variant SKU",
  manual: "Any custom identifier",
};

type ProductOption = Pick<Product, "id" | "quickbooks_name" | "sku">;

interface MappingClientProps {
  initialMappings: SkuMapping[];
  products: ProductOption[];
  unmappedProducts: ProductOption[];
}

interface ModalState {
  open: boolean;
  editing: SkuMapping | null;
  productId: string;
  source: Source;
  externalId: string;
  label: string;
  unitMultiplier: number;
}

const INITIAL_MODAL: ModalState = {
  open: false,
  editing: null,
  productId: "",
  source: "amazon",
  externalId: "",
  label: "",
  unitMultiplier: 1,
};

export default function MappingClient({
  initialMappings,
  products,
  unmappedProducts: initialUnmapped,
}: MappingClientProps) {
  const [mappings, setMappings] = useState(initialMappings);
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState<Source | "all">("all");
  const [modal, setModal] = useState<ModalState>(INITIAL_MODAL);
  const [saving, setSaving] = useState(false);
  const [productSearch, setProductSearch] = useState("");

  const filtered = useMemo(() => {
    let list = mappings;
    if (sourceFilter !== "all") {
      list = list.filter((m) => m.source === sourceFilter);
    }
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (m) =>
          m.external_id.toLowerCase().includes(q) ||
          m.label?.toLowerCase().includes(q) ||
          m.products?.quickbooks_name?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [mappings, search, sourceFilter]);

  const unmappedProducts = useMemo(() => {
    const mappedIds = new Set(mappings.map((m) => m.product_id));
    return initialUnmapped.filter((p) => !mappedIds.has(p.id));
  }, [mappings, initialUnmapped]);

  const filteredProducts = useMemo(() => {
    if (!productSearch) return products;
    const q = productSearch.toLowerCase();
    return products.filter(
      (p) =>
        p.quickbooks_name.toLowerCase().includes(q) ||
        p.sku?.toLowerCase().includes(q)
    );
  }, [products, productSearch]);

  const openAdd = (presetProductId?: string) => {
    setModal({
      ...INITIAL_MODAL,
      open: true,
      productId: presetProductId || "",
    });
    setProductSearch("");
  };

  const openEdit = (mapping: SkuMapping) => {
    setModal({
      open: true,
      editing: mapping,
      productId: mapping.product_id,
      source: mapping.source,
      externalId: mapping.external_id,
      label: mapping.label || "",
      unitMultiplier: mapping.unit_multiplier || 1,
    });
    setProductSearch("");
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (modal.editing) {
        const res = await fetch("/api/mappings", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: modal.editing.id,
            product_id: modal.productId,
            external_id: modal.externalId,
            source: modal.source,
            label: modal.label || null,
            unit_multiplier: modal.unitMultiplier,
          }),
        });
        if (res.ok) {
          const updated = await res.json();
          setMappings((prev) =>
            prev.map((m) => (m.id === updated.id ? updated : m))
          );
        }
      } else {
        const res = await fetch("/api/mappings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            product_id: modal.productId,
            external_id: modal.externalId,
            source: modal.source,
            label: modal.label || null,
            unit_multiplier: modal.unitMultiplier,
          }),
        });
        if (res.ok) {
          const created = await res.json();
          setMappings((prev) => [created, ...prev]);
        }
      }
      setModal(INITIAL_MODAL);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/mappings/${id}`, { method: "DELETE" });
    if (res.ok) {
      setMappings((prev) => prev.filter((m) => m.id !== id));
    }
  };

  const sources: (Source | "all")[] = ["all", "amazon", "3pl", "shopify", "manual"];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">SKU Mapping</h1>
        <button
          onClick={() => openAdd()}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add Mapping
        </button>
      </div>

      {/* Warning banner */}
      {unmappedProducts.length > 0 && (
        <div className="flex items-center gap-3 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3">
          <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0" />
          <p className="text-sm text-amber-800">
            <span className="font-medium">{unmappedProducts.length} QB product(s)</span> have no
            active SKU mappings. Syncs cannot resolve these until mapped.
          </p>
        </div>
      )}

      {/* Filter bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by product name or external ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white pl-9 pr-3 py-2 text-sm text-gray-700 placeholder-gray-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>
        <div className="flex gap-1">
          {sources.map((s) => (
            <button
              key={s}
              onClick={() => setSourceFilter(s)}
              className={`rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                sourceFilter === s
                  ? "bg-brand-600 text-white"
                  : "bg-white border border-gray-300 text-gray-600 hover:bg-gray-50"
              }`}
            >
              {s === "all" ? "All" : s === "3pl" ? "3PL" : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Mappings table */}
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-3 text-left font-medium text-gray-500">External ID</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Source</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Label</th>
                <th className="px-4 py-3 text-center font-medium text-gray-500">Units</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">QB Product</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                    {mappings.length === 0
                      ? "No mappings yet. Add your first mapping to get started."
                      : "No mappings match your filters."}
                  </td>
                </tr>
              ) : (
                filtered.map((m) => (
                  <tr key={m.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-sm text-gray-900">
                      {m.external_id}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${SOURCE_COLORS[m.source]}`}
                      >
                        {m.source === "3pl" ? "3PL" : m.source}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{m.label || "—"}</td>
                    <td className="px-4 py-3 text-center">
                      {m.unit_multiplier > 1 ? (
                        <span className="rounded bg-blue-50 px-1.5 py-0.5 text-xs font-medium text-blue-700">
                          {m.unit_multiplier}-pack
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">1</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {m.products?.quickbooks_name || "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEdit(m)}
                          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(m.id)}
                          className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Unmapped QB Products */}
      {unmappedProducts.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="mb-4 text-base font-semibold text-gray-900">
            Unmapped QB Products ({unmappedProducts.length})
          </h2>
          <div className="space-y-2">
            {unmappedProducts.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between rounded-lg border border-gray-100 px-4 py-2.5"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900">{p.quickbooks_name}</p>
                  {p.sku && <p className="text-xs text-gray-400">SKU: {p.sku}</p>}
                </div>
                <button
                  onClick={() => openAdd(p.id)}
                  className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  <Plus className="h-3 w-3" />
                  Map
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal */}
      {modal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-gray-900">
                {modal.editing ? "Edit Mapping" : "Add Mapping"}
              </h2>
              <button
                onClick={() => setModal(INITIAL_MODAL)}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* QB Product */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  QB Product
                </label>
                <input
                  type="text"
                  placeholder="Search products..."
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 placeholder-gray-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 mb-1"
                />
                <select
                  value={modal.productId}
                  onChange={(e) =>
                    setModal((m) => ({ ...m, productId: e.target.value }))
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  size={5}
                >
                  {filteredProducts.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.quickbooks_name} {p.sku ? `(${p.sku})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              {/* Source */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Source
                </label>
                <div className="flex gap-1">
                  {(["amazon", "3pl", "shopify", "manual"] as Source[]).map(
                    (s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setModal((m) => ({ ...m, source: s }))}
                        className={`flex-1 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                          modal.source === s
                            ? "bg-brand-600 text-white"
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        }`}
                      >
                        {s === "3pl" ? "3PL" : s.charAt(0).toUpperCase() + s.slice(1)}
                      </button>
                    )
                  )}
                </div>
              </div>

              {/* External ID */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  External ID
                </label>
                <input
                  type="text"
                  value={modal.externalId}
                  onChange={(e) =>
                    setModal((m) => ({ ...m, externalId: e.target.value }))
                  }
                  placeholder="e.g., B08XYZ123 or SKU-001"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 placeholder-gray-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
                <p className="mt-1 text-xs text-gray-400">
                  {SOURCE_HINTS[modal.source]}
                </p>
              </div>

              {/* Label */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Label <span className="text-gray-400">(optional)</span>
                </label>
                <input
                  type="text"
                  value={modal.label}
                  onChange={(e) =>
                    setModal((m) => ({ ...m, label: e.target.value }))
                  }
                  placeholder="e.g., Main ASIN, Seller SKU"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 placeholder-gray-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>

              {/* Unit Multiplier */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Units per SKU
                </label>
                <input
                  type="number"
                  min={1}
                  value={modal.unitMultiplier}
                  onChange={(e) =>
                    setModal((m) => ({
                      ...m,
                      unitMultiplier: Math.max(1, parseInt(e.target.value) || 1),
                    }))
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
                <p className="mt-1 text-xs text-gray-400">
                  How many finished good units does this SKU represent? (e.g., 2 for a 2-pack)
                </p>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setModal(INITIAL_MODAL)}
                className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !modal.productId || !modal.externalId}
                className="flex-1 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50 transition-colors"
              >
                {saving ? "Saving..." : modal.editing ? "Update" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
