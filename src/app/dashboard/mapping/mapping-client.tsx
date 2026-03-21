"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { Plus, Search, Trash2, AlertTriangle, X, Check } from "lucide-react";
import type { Product, SkuMapping, Source } from "@/lib/types/database";

const SOURCE_COLORS: Record<Source, string> = {
  amazon: "bg-amber-50 text-amber-700",
  "3pl": "bg-purple-50 text-purple-700",
  shopify: "bg-emerald-50 text-emerald-700",
  manual: "bg-gray-100 text-gray-600",
};

const SOURCE_LABELS: Record<Source, string> = {
  amazon: "Amazon",
  "3pl": "3PL",
  shopify: "Shopify",
  manual: "Manual",
};

type ProductOption = Pick<Product, "id" | "quickbooks_name" | "sku">;

interface ExternalSku {
  external_id: string;
  source: string;
  label: string | null;
  title: string | null;
  image_url: string | null;
  price: number | null;
  parent_asin: string | null;
  item_type: string | null;
  mapped: boolean;
  mapped_to: string | null;
}

interface MappingClientProps {
  initialMappings: SkuMapping[];
  products: ProductOption[];
  unmappedProducts: ProductOption[];
}

export default function MappingClient({
  initialMappings,
  products,
  unmappedProducts: initialUnmapped,
}: MappingClientProps) {
  const [mappings, setMappings] = useState(initialMappings);
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState<Source | "all">("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [externalSkus, setExternalSkus] = useState<ExternalSku[]>([]);
  const [skuSearch, setSkuSearch] = useState("");
  const [selectedSource, setSelectedSource] = useState<Source>("amazon");
  const [saving, setSaving] = useState(false);
  const [manualId, setManualId] = useState("");
  const [multiplier, setMultiplier] = useState(1);

  // Fetch external SKUs when modal opens
  useEffect(() => {
    if (modalOpen) {
      fetch("/api/external-skus")
        .then((r) => r.json())
        .then((data) => {
          if (Array.isArray(data)) setExternalSkus(data);
        })
        .catch(() => {});
    }
  }, [modalOpen]);

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

  // Group mappings by product
  const groupedByProduct = useMemo(() => {
    const map = new Map<
      string,
      { product: { id: string; name: string }; mappings: SkuMapping[] }
    >();
    for (const m of filtered) {
      const key = m.product_id;
      if (!map.has(key)) {
        map.set(key, {
          product: {
            id: m.product_id,
            name: m.products?.quickbooks_name || "Unknown",
          },
          mappings: [],
        });
      }
      map.get(key)!.mappings.push(m);
    }
    return Array.from(map.values());
  }, [filtered]);

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

  const filteredExternalSkus = useMemo(() => {
    let list = externalSkus.filter((s) => s.source === selectedSource);
    if (skuSearch) {
      const q = skuSearch.toLowerCase();
      list = list.filter(
        (s) =>
          s.external_id.toLowerCase().includes(q) ||
          s.label?.toLowerCase().includes(q) ||
          s.title?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [externalSkus, selectedSource, skuSearch]);

  const openModal = useCallback((presetProductId?: string) => {
    setSelectedProductId(presetProductId || "");
    setProductSearch("");
    setSkuSearch("");
    setSelectedSource("amazon");
    setManualId("");
    setMultiplier(1);
    setModalOpen(true);
  }, []);

  const addMapping = async (externalId: string, source: Source) => {
    if (!selectedProductId || !externalId) return;
    setSaving(true);
    try {
      const res = await fetch("/api/mappings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_id: selectedProductId,
          external_id: externalId,
          source,
          unit_multiplier: multiplier,
        }),
      });
      if (res.ok) {
        const created = await res.json();
        setMappings((prev) => [created, ...prev]);
      } else {
        const err = await res.json();
        const msg = typeof err.error === "string" ? err.error : "Failed to create mapping";
        alert(msg);
        // Update external SKU as mapped
        setExternalSkus((prev) =>
          prev.map((s) =>
            s.external_id === externalId && s.source === source
              ? { ...s, mapped: true, mapped_to: products.find((p) => p.id === selectedProductId)?.quickbooks_name || "" }
              : s
          )
        );
        setManualId("");
      }
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
  const modalSources: Source[] = ["amazon", "3pl", "shopify", "manual"];

  const selectedProduct = products.find((p) => p.id === selectedProductId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">SKU Mapping</h1>
        <button
          onClick={() => openModal()}
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
              {s === "all" ? "All" : SOURCE_LABELS[s as Source]}
            </button>
          ))}
        </div>
      </div>

      {/* Mappings grouped by product */}
      <div className="space-y-3">
        {groupedByProduct.length === 0 ? (
          <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-gray-400">
            {mappings.length === 0
              ? "No mappings yet. Sync inventory first, then add mappings."
              : "No mappings match your filters."}
          </div>
        ) : (
          groupedByProduct.map(({ product, mappings: productMappings }) => (
            <div
              key={product.id}
              className="rounded-xl border border-gray-200 bg-white"
            >
              <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 bg-gray-50 rounded-t-xl">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-gray-900">
                    {product.name}
                  </span>
                  <span className="text-xs text-gray-400">
                    {productMappings.length} mapping{productMappings.length !== 1 ? "s" : ""}
                  </span>
                </div>
                <button
                  onClick={() => openModal(product.id)}
                  className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-2 py-1 text-xs font-medium text-gray-600 hover:bg-white transition-colors"
                >
                  <Plus className="h-3 w-3" />
                  Add
                </button>
              </div>
              <div className="divide-y divide-gray-50">
                {productMappings.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center gap-3 px-5 py-2.5"
                  >
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${SOURCE_COLORS[m.source]}`}
                    >
                      {SOURCE_LABELS[m.source]}
                    </span>
                    <span className="font-mono text-sm text-gray-900 flex-1">
                      {m.external_id}
                    </span>
                    {m.label && (
                      <span className="text-xs text-gray-400">{m.label}</span>
                    )}
                    {m.unit_multiplier > 1 && (
                      <span className="rounded bg-blue-50 px-1.5 py-0.5 text-xs font-medium text-blue-700">
                        {m.unit_multiplier}-pack
                      </span>
                    )}
                    <button
                      onClick={() => handleDelete(m.id)}
                      className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
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
                  onClick={() => openModal(p.id)}
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

      {/* Mapping Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">Map External SKUs</h2>
              <button
                onClick={() => setModalOpen(false)}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
              {/* Step 1: Select QB Product */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  QB Product
                </label>
                {selectedProduct ? (
                  <div className="flex items-center justify-between rounded-lg border border-brand-200 bg-brand-50 px-3 py-2">
                    <div>
                      <p className="text-sm font-medium text-brand-900">
                        {selectedProduct.quickbooks_name}
                      </p>
                      {selectedProduct.sku && (
                        <p className="text-xs text-brand-600">{selectedProduct.sku}</p>
                      )}
                    </div>
                    <button
                      onClick={() => setSelectedProductId("")}
                      className="text-xs text-brand-600 hover:underline"
                    >
                      Change
                    </button>
                  </div>
                ) : (
                  <div>
                    <input
                      type="text"
                      placeholder="Search products..."
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 placeholder-gray-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 mb-1"
                    />
                    <div className="max-h-40 overflow-y-auto rounded-lg border border-gray-200">
                      {filteredProducts.map((p) => (
                        <button
                          key={p.id}
                          onClick={() => {
                            setSelectedProductId(p.id);
                            setProductSearch("");
                          }}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 border-b border-gray-50 last:border-0"
                        >
                          <span className="font-medium text-gray-900">{p.quickbooks_name}</span>
                          {p.sku && (
                            <span className="ml-2 text-xs text-gray-400">{p.sku}</span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {selectedProduct && (
                <>
                  {/* Existing mappings for this product */}
                  {(() => {
                    const existing = mappings.filter(
                      (m) => m.product_id === selectedProductId
                    );
                    if (existing.length === 0) return null;
                    return (
                      <div>
                        <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                          Current Mappings
                        </label>
                        <div className="space-y-1">
                          {existing.map((m) => (
                            <div
                              key={m.id}
                              className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-1.5"
                            >
                              <span className={`rounded-full px-1.5 py-0.5 text-xs font-medium ${SOURCE_COLORS[m.source]}`}>
                                {SOURCE_LABELS[m.source]}
                              </span>
                              <span className="font-mono text-xs text-gray-700 flex-1">
                                {m.external_id}
                              </span>
                              {m.unit_multiplier > 1 && (
                                <span className="text-xs text-blue-600">{m.unit_multiplier}x</span>
                              )}
                              <button
                                onClick={() => handleDelete(m.id)}
                                className="text-gray-400 hover:text-red-500"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Step 2: Add SKUs */}
                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                      Add External SKU
                    </label>

                    {/* Source tabs */}
                    <div className="flex gap-1 mb-3">
                      {modalSources.map((s) => (
                        <button
                          key={s}
                          onClick={() => {
                            setSelectedSource(s);
                            setSkuSearch("");
                            setManualId("");
                          }}
                          className={`flex-1 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                            selectedSource === s
                              ? "bg-brand-600 text-white"
                              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                          }`}
                        >
                          {SOURCE_LABELS[s]}
                        </button>
                      ))}
                    </div>

                    {/* Multiplier */}
                    <div className="flex items-center gap-2 mb-3">
                      <label className="text-xs text-gray-500">Units per SKU:</label>
                      <input
                        type="number"
                        min={1}
                        value={multiplier}
                        onChange={(e) => setMultiplier(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-16 rounded border border-gray-300 px-2 py-1 text-xs text-center focus:border-brand-500 focus:outline-none"
                      />
                      {multiplier > 1 && (
                        <span className="text-xs text-blue-600">({multiplier}-pack)</span>
                      )}
                    </div>

                    {selectedSource === "manual" ? (
                      /* Manual entry */
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={manualId}
                          onChange={(e) => setManualId(e.target.value)}
                          placeholder="Enter external ID..."
                          className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 placeholder-gray-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                        />
                        <button
                          onClick={() => addMapping(manualId, "manual")}
                          disabled={!manualId || saving}
                          className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
                        >
                          Add
                        </button>
                      </div>
                    ) : (
                      /* Searchable SKU list */
                      <>
                        <div className="relative mb-2">
                          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                          <input
                            type="text"
                            placeholder={`Search ${SOURCE_LABELS[selectedSource]} SKUs...`}
                            value={skuSearch}
                            onChange={(e) => setSkuSearch(e.target.value)}
                            className="w-full rounded-lg border border-gray-300 bg-white pl-9 pr-3 py-2 text-sm text-gray-700 placeholder-gray-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                          />
                        </div>
                        <div className="max-h-48 overflow-y-auto rounded-lg border border-gray-200">
                          {filteredExternalSkus.length === 0 ? (
                            <div className="px-3 py-6 text-center text-sm text-gray-400">
                              {externalSkus.filter((s) => s.source === selectedSource).length === 0
                                ? `No ${SOURCE_LABELS[selectedSource]} SKUs found. Run Sync Inventory first.`
                                : "No matches"}
                            </div>
                          ) : (
                            filteredExternalSkus.map((sku) => {
                              const alreadyMapped = mappings.some(
                                (m) =>
                                  m.external_id === sku.external_id &&
                                  m.source === sku.source &&
                                  m.product_id === selectedProductId
                              );
                              const hasRichData = !!sku.title;
                              return (
                                <button
                                  key={`${sku.external_id}-${sku.source}`}
                                  onClick={() => {
                                    if (!alreadyMapped) {
                                      addMapping(sku.external_id, selectedSource);
                                    }
                                  }}
                                  disabled={alreadyMapped || saving}
                                  className={`w-full text-left px-3 py-2.5 text-sm border-b border-gray-50 last:border-0 flex items-center gap-3 ${
                                    alreadyMapped
                                      ? "bg-green-50 text-green-700"
                                      : sku.mapped
                                        ? "bg-gray-50 text-gray-500 hover:bg-gray-100"
                                        : "hover:bg-brand-50"
                                  }`}
                                >
                                  {/* Product image for Amazon */}
                                  {hasRichData && sku.image_url ? (
                                    <img
                                      src={sku.image_url}
                                      alt=""
                                      className="h-10 w-10 rounded-md object-contain bg-white border border-gray-100 flex-shrink-0"
                                    />
                                  ) : hasRichData ? (
                                    <div className="h-10 w-10 rounded-md bg-gray-100 flex-shrink-0" />
                                  ) : null}
                                  <div className="flex-1 min-w-0">
                                    {hasRichData ? (
                                      <>
                                        <p className="text-xs font-medium text-gray-900 truncate">
                                          {sku.title}
                                        </p>
                                        <div className="flex items-center gap-2 mt-0.5">
                                          <span className="font-mono text-xs text-gray-500">
                                            {sku.external_id}
                                          </span>
                                          {sku.label && (
                                            <span className="text-xs text-gray-400">
                                              {sku.label}
                                            </span>
                                          )}
                                          {sku.price && (
                                            <span className="text-xs text-gray-400">
                                              ${sku.price.toFixed(2)}
                                            </span>
                                          )}
                                        </div>
                                      </>
                                    ) : (
                                      <span className="font-mono truncate text-gray-900">
                                        {sku.external_id}
                                      </span>
                                    )}
                                  </div>
                                  {alreadyMapped ? (
                                    <Check className="h-4 w-4 text-green-600 flex-shrink-0" />
                                  ) : sku.mapped ? (
                                    <span className="text-xs text-gray-400 flex-shrink-0 max-w-20 truncate">
                                      → {sku.mapped_to}
                                    </span>
                                  ) : (
                                    <Plus className="h-4 w-4 text-gray-400 flex-shrink-0" />
                                  )}
                                </button>
                              );
                            })
                          )}
                        </div>
                        {/* Manual fallback */}
                        <div className="mt-2 flex gap-2">
                          <input
                            type="text"
                            value={manualId}
                            onChange={(e) => setManualId(e.target.value)}
                            placeholder="Or type a custom ID..."
                            className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-700 placeholder-gray-400 focus:border-brand-500 focus:outline-none"
                          />
                          <button
                            onClick={() => addMapping(manualId, selectedSource)}
                            disabled={!manualId || saving}
                            className="rounded-lg bg-gray-100 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200 disabled:opacity-50"
                          >
                            Add
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-100">
              <button
                onClick={() => setModalOpen(false)}
                className="w-full rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
