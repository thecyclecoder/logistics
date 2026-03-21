"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { Package, Layers, Boxes, ChevronDown, Plus, Trash2, Search, Check, X } from "lucide-react";
import type { Product, SkuMapping, Source } from "@/lib/types/database";

type ProductCategory = "finished_good" | "component" | "finished_good_no_bom";

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

interface ExternalSku {
  external_id: string;
  source: string;
  label: string | null;
  title: string | null;
  image_url: string | null;
  price: number | null;
  quantity: number | null;
  mapped: boolean;
  mapped_to: string | null;
}

interface ProductsClientProps {
  initialProducts: Product[];
  initialMappings: SkuMapping[];
}

function classifyProduct(
  p: Product,
  componentIds: Set<string>
): ProductCategory {
  if (p.product_category === "component") return "component";
  if (p.product_category === "finished_good") {
    return p.item_type === "bundle" ? "finished_good" : "finished_good_no_bom";
  }
  if (p.item_type === "bundle") return "finished_good";
  if (componentIds.has(p.id)) return "component";
  return "finished_good_no_bom";
}

const CATEGORY_LABELS: Record<ProductCategory, string> = {
  finished_good: "Finished Good",
  component: "Component / Raw Material",
  finished_good_no_bom: "Finished Good (No BOM)",
};

const CATEGORY_STYLES: Record<ProductCategory, string> = {
  finished_good: "bg-brand-50 text-brand-700",
  component: "bg-orange-50 text-orange-700",
  finished_good_no_bom: "bg-emerald-50 text-emerald-700",
};

export default function ProductsClient({ initialProducts, initialMappings }: ProductsClientProps) {
  const [products, setProducts] = useState(initialProducts);
  const [mappings, setMappings] = useState(initialMappings);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Mapping modal state
  const [modalProductId, setModalProductId] = useState<string | null>(null);
  const [externalSkus, setExternalSkus] = useState<ExternalSku[]>([]);
  const [selectedSource, setSelectedSource] = useState<Source>("amazon");
  const [skuSearch, setSkuSearch] = useState("");
  const [multiplier, setMultiplier] = useState(1);
  const [manualId, setManualId] = useState("");
  const [mappingSaving, setMappingSaving] = useState(false);

  useEffect(() => {
    if (modalProductId) {
      fetch("/api/external-skus")
        .then((r) => r.json())
        .then((data) => {
          if (Array.isArray(data)) setExternalSkus(data);
        });
    }
  }, [modalProductId]);

  const componentIds = useMemo(() => {
    const ids = new Set<string>();
    for (const p of products) {
      if (p.bundle_id) ids.add(p.id);
    }
    return ids;
  }, [products]);

  const componentMap = useMemo(() => {
    const map = new Map<string, Product[]>();
    for (const p of products) {
      if (p.bundle_id) {
        const list = map.get(p.bundle_id) || [];
        list.push(p);
        map.set(p.bundle_id, list);
      }
    }
    return map;
  }, [products]);

  const mappingsByProduct = useMemo(() => {
    const map = new Map<string, SkuMapping[]>();
    for (const m of mappings) {
      const list = map.get(m.product_id) || [];
      list.push(m);
      map.set(m.product_id, list);
    }
    return map;
  }, [mappings]);

  const finishedGoods = products.filter((p) => classifyProduct(p, componentIds) === "finished_good");
  const standaloneFinished = products.filter((p) => classifyProduct(p, componentIds) === "finished_good_no_bom");
  const rawMaterials = products.filter((p) => classifyProduct(p, componentIds) === "component");

  const handleRecategorize = useCallback(async (product: Product, newCategory: ProductCategory) => {
    setSaving(true);
    setEditingId(null);
    try {
      const productCategory = newCategory === "component" ? "component" : "finished_good";
      const res = await fetch(`/api/products/${product.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_category: productCategory }),
      });
      if (res.ok) {
        const updated = await res.json();
        setProducts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      }
    } finally {
      setSaving(false);
    }
  }, []);

  const canEdit = useCallback((product: Product): boolean => {
    if (product.item_type === "bundle") return false;
    if (product.bundle_id) return false;
    return true;
  }, []);

  const addMapping = async (externalId: string, source: Source) => {
    if (!modalProductId || !externalId) return;
    setMappingSaving(true);
    try {
      const res = await fetch("/api/mappings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_id: modalProductId,
          external_id: externalId,
          source,
          unit_multiplier: multiplier,
        }),
      });
      if (res.ok) {
        const created = await res.json();
        setMappings((prev) => [created, ...prev]);
        setExternalSkus((prev) =>
          prev.map((s) =>
            s.external_id === externalId && s.source === source
              ? { ...s, mapped: true, mapped_to: products.find((p) => p.id === modalProductId)?.quickbooks_name || "" }
              : s
          )
        );
        setManualId("");
      } else {
        const err = await res.json();
        alert(typeof err.error === "string" ? err.error : "Failed to create mapping");
      }
    } finally {
      setMappingSaving(false);
    }
  };

  const deleteMapping = async (id: string) => {
    const res = await fetch(`/api/mappings/${id}`, { method: "DELETE" });
    if (res.ok) {
      setMappings((prev) => prev.filter((m) => m.id !== id));
    }
  };

  const openMappingModal = (productId: string) => {
    setModalProductId(productId);
    setSelectedSource("amazon");
    setSkuSearch("");
    setManualId("");
    setMultiplier(1);
  };

  const filteredExternalSkus = useMemo(() => {
    let list = externalSkus.filter((s) => s.source === selectedSource);
    if (skuSearch) {
      const q = skuSearch.toLowerCase();
      list = list.filter(
        (s) =>
          s.external_id.toLowerCase().includes(q) ||
          s.title?.toLowerCase().includes(q) ||
          s.label?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [externalSkus, selectedSource, skuSearch]);

  const totalFinishedGoods = finishedGoods.length + standaloneFinished.length;

  const renderCategoryBadge = (product: Product) => {
    const current = classifyProduct(product, componentIds);
    const editable = canEdit(product);

    if (!editable) {
      return (
        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${CATEGORY_STYLES[current]}`}>
          {CATEGORY_LABELS[current]}
        </span>
      );
    }

    const isEditing = editingId === product.id;

    return (
      <div className="relative inline-block">
        <button
          onClick={(e) => { e.stopPropagation(); setEditingId(isEditing ? null : product.id); }}
          disabled={saving}
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium cursor-pointer transition-colors ${CATEGORY_STYLES[current]} hover:opacity-80`}
        >
          {CATEGORY_LABELS[current]}
          <ChevronDown className="h-3 w-3" />
        </button>
        {isEditing && (
          <div
            className="fixed z-50 w-56 rounded-lg border border-gray-200 bg-white shadow-lg py-1"
            ref={(el) => {
              if (el) {
                const btn = el.previousElementSibling as HTMLElement;
                if (btn) {
                  const rect = btn.getBoundingClientRect();
                  const spaceBelow = window.innerHeight - rect.bottom;
                  if (spaceBelow < 140) {
                    el.style.top = `${rect.top - 140}px`;
                  } else {
                    el.style.top = `${rect.bottom + 4}px`;
                  }
                  el.style.left = `${Math.max(8, rect.right - 224)}px`;
                }
              }
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {(Object.keys(CATEGORY_LABELS) as ProductCategory[]).map((cat) => {
              const isCurrent = cat === current;
              return (
                <button
                  key={cat}
                  onClick={(e) => { e.stopPropagation(); if (isCurrent) { setEditingId(null); } else { handleRecategorize(product, cat); } }}
                  disabled={saving}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2 ${isCurrent ? "font-medium text-gray-900 bg-gray-50" : "text-gray-600"}`}
                >
                  <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${CATEGORY_STYLES[cat]}`}>
                    {CATEGORY_LABELS[cat]}
                  </span>
                  {isCurrent && <span className="text-xs text-gray-400">current</span>}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const renderMappings = (productId: string) => {
    const productMappings = mappingsByProduct.get(productId) || [];
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        {productMappings.map((m) => (
          <span
            key={m.id}
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${SOURCE_COLORS[m.source]}`}
          >
            {SOURCE_LABELS[m.source]}: {m.label || m.external_id}
            {m.unit_multiplier > 1 && <span className="text-xs opacity-70">({m.unit_multiplier}x)</span>}
            <button
              onClick={(e) => { e.stopPropagation(); deleteMapping(m.id); }}
              className="ml-0.5 rounded-full hover:bg-black/10 p-0.5"
            >
              <X className="h-2.5 w-2.5" />
            </button>
          </span>
        ))}
        <button
          onClick={() => openMappingModal(productId)}
          className="inline-flex items-center gap-0.5 rounded-full border border-dashed border-gray-300 px-2 py-0.5 text-xs text-gray-400 hover:border-gray-400 hover:text-gray-600"
        >
          <Plus className="h-3 w-3" />
          Map
        </button>
      </div>
    );
  };

  const modalSources: Source[] = ["amazon", "3pl", "shopify", "manual"];
  const modalProduct = products.find((p) => p.id === modalProductId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Products</h1>
        <div className="flex items-center gap-4 text-sm text-gray-500">
          <span className="flex items-center gap-1.5">
            <Layers className="h-4 w-4" />
            {totalFinishedGoods} finished goods
          </span>
          <span className="flex items-center gap-1.5">
            <Boxes className="h-4 w-4" />
            {rawMaterials.length} components
          </span>
        </div>
      </div>

      {products.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center">
          <Package className="mx-auto h-10 w-10 text-gray-300 mb-3" />
          <p className="text-gray-500">No products yet. Sync QuickBooks to pull in your catalog.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Finished Goods with BOM */}
          {finishedGoods.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                Finished Goods ({finishedGoods.length})
              </h2>
              <div className="space-y-3">
                {finishedGoods.map((fg) => {
                  const components = componentMap.get(fg.id) || [];
                  return (
                    <div key={fg.id} className="rounded-xl border border-gray-200 bg-white">
                      <div className="flex items-start gap-3 px-5 py-3.5 bg-gradient-to-r from-brand-50 to-white border-b border-gray-100 rounded-t-xl">
                        {fg.image_url ? (
                          <img src={fg.image_url} alt="" className="h-10 w-10 rounded-lg object-contain bg-white border border-gray-100 flex-shrink-0" />
                        ) : (
                          <div className="h-10 w-10 rounded-lg bg-brand-100 flex items-center justify-center flex-shrink-0">
                            <Layers className="h-4 w-4 text-brand-600" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-gray-900 truncate">{fg.quickbooks_name}</p>
                            <span className="rounded-full bg-brand-100 px-2.5 py-0.5 text-xs font-medium text-brand-700 flex-shrink-0">
                              Finished Good
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5">{fg.sku || "No SKU"}</p>
                          <div className="mt-2">{renderMappings(fg.id)}</div>
                        </div>
                      </div>
                      {components.length > 0 && (
                        <div>
                          <div className="px-5 py-1.5 bg-gray-50 border-b border-gray-100">
                            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Bill of Materials</p>
                          </div>
                          <div className="divide-y divide-gray-50">
                            {components.map((comp) => (
                              <div key={comp.id} className="flex items-center gap-3 px-5 py-2.5 pl-16">
                                <div className="h-1.5 w-1.5 rounded-full bg-gray-300 flex-shrink-0" />
                                <p className="text-sm text-gray-700 truncate flex-1">{comp.quickbooks_name}</p>
                                <span className="text-xs text-gray-400 font-mono">{comp.sku || "—"}</span>
                                <span className="text-xs text-gray-500">&times;{comp.bundle_quantity || 1}</span>
                                <span className="rounded-full bg-orange-50 px-2 py-0.5 text-xs font-medium text-orange-700">Component</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Standalone Finished Goods */}
          {standaloneFinished.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                Finished Goods — No BOM ({standaloneFinished.length})
              </h2>
              <div className="rounded-xl border border-gray-200 bg-white divide-y divide-gray-100">
                {standaloneFinished.map((p) => (
                  <div key={p.id} className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      {p.image_url ? (
                        <img src={p.image_url} alt="" className="h-10 w-10 rounded-lg object-contain bg-white border border-gray-100 flex-shrink-0" />
                      ) : (
                        <div className="h-10 w-10 rounded-lg bg-gray-100 flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-gray-900">{p.quickbooks_name}</p>
                          <span className="text-xs text-gray-400 font-mono">{p.sku || "—"}</span>
                        </div>
                        <div className="mt-1.5">{renderMappings(p.id)}</div>
                      </div>
                      {renderCategoryBadge(p)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Components */}
          {rawMaterials.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                Components / Raw Materials ({rawMaterials.length})
              </h2>
              <div className="rounded-xl border border-gray-200 bg-white divide-y divide-gray-100">
                {rawMaterials.map((p) => {
                  const usedIn = finishedGoods.filter((fg) =>
                    (componentMap.get(fg.id) || []).some((c) => c.id === p.id)
                  );
                  return (
                    <div key={p.id} className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        {p.image_url ? (
                          <img src={p.image_url} alt="" className="h-10 w-10 rounded-lg object-contain bg-white border border-gray-100 flex-shrink-0" />
                        ) : (
                          <div className="h-10 w-10 rounded-lg bg-gray-100 flex-shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-gray-900">{p.quickbooks_name}</p>
                            <span className="text-xs text-gray-400 font-mono">{p.sku || "—"}</span>
                          </div>
                          {usedIn.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {usedIn.map((fg) => (
                                <span key={fg.id} className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500">
                                  {fg.quickbooks_name}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        {renderCategoryBadge(p)}
                      </div>
                      <div className="mt-2">{renderMappings(p.id)}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Category dropdown click-away */}
      {editingId && <div className="fixed inset-0 z-40" onClick={() => setEditingId(null)} />}

      {/* Mapping Modal */}
      {modalProductId && modalProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Map SKUs</h2>
                <p className="text-sm text-gray-500">{modalProduct.quickbooks_name}</p>
              </div>
              <button onClick={() => setModalProductId(null)} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              {/* Current mappings */}
              {(() => {
                const existing = mappings.filter((m) => m.product_id === modalProductId);
                if (existing.length === 0) return null;
                return (
                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Current Mappings</label>
                    <div className="space-y-1">
                      {existing.map((m) => (
                        <div key={m.id} className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-1.5">
                          <span className={`rounded-full px-1.5 py-0.5 text-xs font-medium ${SOURCE_COLORS[m.source]}`}>
                            {SOURCE_LABELS[m.source]}
                          </span>
                          <span className="font-mono text-xs text-gray-700 flex-1">{m.external_id}</span>
                          {m.unit_multiplier > 1 && <span className="text-xs text-blue-600">{m.unit_multiplier}x</span>}
                          <button onClick={() => deleteMapping(m.id)} className="text-gray-400 hover:text-red-500">
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Source tabs */}
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Add External SKU</label>
                <div className="flex gap-1 mb-3">
                  {modalSources.map((s) => (
                    <button
                      key={s}
                      onClick={() => { setSelectedSource(s); setSkuSearch(""); setManualId(""); }}
                      className={`flex-1 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                        selectedSource === s ? "bg-brand-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
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
                  {multiplier > 1 && <span className="text-xs text-blue-600">({multiplier}-pack)</span>}
                </div>

                {selectedSource === "manual" ? (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={manualId}
                      onChange={(e) => setManualId(e.target.value)}
                      placeholder="Enter external ID..."
                      className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm placeholder-gray-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                    />
                    <button
                      onClick={() => addMapping(manualId, "manual")}
                      disabled={!manualId || mappingSaving}
                      className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
                    >
                      Add
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="relative mb-2">
                      <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        placeholder={`Search ${SOURCE_LABELS[selectedSource]} SKUs...`}
                        value={skuSearch}
                        onChange={(e) => setSkuSearch(e.target.value)}
                        className="w-full rounded-lg border border-gray-300 bg-white pl-9 pr-3 py-2 text-sm placeholder-gray-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                      />
                    </div>
                    <div className="max-h-48 overflow-y-auto rounded-lg border border-gray-200">
                      {filteredExternalSkus.length === 0 ? (
                        <div className="px-3 py-6 text-center text-sm text-gray-400">
                          {externalSkus.filter((s) => s.source === selectedSource).length === 0
                            ? `No ${SOURCE_LABELS[selectedSource]} SKUs found. Sync first.`
                            : "No matches"}
                        </div>
                      ) : (
                        filteredExternalSkus.map((sku) => {
                          const alreadyMapped = mappings.some(
                            (m) => m.external_id === sku.external_id && m.source === sku.source && m.product_id === modalProductId
                          );
                          const hasRichData = !!sku.title;
                          return (
                            <button
                              key={`${sku.external_id}-${sku.source}`}
                              onClick={() => { if (!alreadyMapped) addMapping(sku.external_id, selectedSource); }}
                              disabled={alreadyMapped || mappingSaving}
                              className={`w-full text-left px-3 py-2.5 text-sm border-b border-gray-50 last:border-0 flex items-center gap-3 ${
                                alreadyMapped ? "bg-green-50" : sku.mapped ? "bg-gray-50 hover:bg-gray-100" : "hover:bg-brand-50"
                              }`}
                            >
                              {hasRichData && sku.image_url ? (
                                <img src={sku.image_url} alt="" className="h-10 w-10 rounded-md object-contain bg-white border border-gray-100 flex-shrink-0" />
                              ) : hasRichData ? (
                                <div className="h-10 w-10 rounded-md bg-gray-100 flex-shrink-0" />
                              ) : null}
                              <div className="flex-1 min-w-0">
                                {hasRichData ? (
                                  <>
                                    <p className="text-xs font-medium text-gray-900 truncate">{sku.title}</p>
                                    <div className="flex items-center gap-2 mt-0.5">
                                      <span className="font-mono text-xs text-gray-500">
                                        {sku.label || sku.external_id}
                                      </span>
                                      {sku.price && <span className="text-xs text-gray-400">${sku.price.toFixed(2)}</span>}
                                      {sku.quantity != null && (
                                        <span className={`text-xs font-medium ${sku.quantity > 0 ? "text-green-600" : "text-gray-300"}`}>
                                          {sku.quantity} in stock
                                        </span>
                                      )}
                                    </div>
                                  </>
                                ) : (
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono truncate text-gray-900">{sku.external_id}</span>
                                    {sku.quantity != null && (
                                      <span className={`text-xs font-medium ${sku.quantity > 0 ? "text-green-600" : "text-gray-300"}`}>
                                        {sku.quantity} in stock
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                              {alreadyMapped ? (
                                <Check className="h-4 w-4 text-green-600 flex-shrink-0" />
                              ) : sku.mapped ? (
                                <span className="text-xs text-gray-400 flex-shrink-0 max-w-20 truncate">→ {sku.mapped_to}</span>
                              ) : (
                                <Plus className="h-4 w-4 text-gray-400 flex-shrink-0" />
                              )}
                            </button>
                          );
                        })
                      )}
                    </div>
                    <div className="mt-2 flex gap-2">
                      <input
                        type="text"
                        value={manualId}
                        onChange={(e) => setManualId(e.target.value)}
                        placeholder="Or type a custom ID..."
                        className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-xs placeholder-gray-400 focus:border-brand-500 focus:outline-none"
                      />
                      <button
                        onClick={() => addMapping(manualId, selectedSource)}
                        disabled={!manualId || mappingSaving}
                        className="rounded-lg bg-gray-100 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200 disabled:opacity-50"
                      >
                        Add
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-100">
              <button
                onClick={() => setModalProductId(null)}
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
