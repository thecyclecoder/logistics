"use client";

import { useState, useMemo } from "react";
import { Package, Layers, Boxes, ChevronDown } from "lucide-react";
import type { Product } from "@/lib/types/database";

type ProductCategory = "finished_good" | "component" | "finished_good_no_bom";

interface ProductsClientProps {
  initialProducts: Product[];
}

function classifyProduct(
  p: Product,
  componentIds: Set<string>
): ProductCategory {
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

export default function ProductsClient({ initialProducts }: ProductsClientProps) {
  const [products, setProducts] = useState(initialProducts);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Build component set from bundle relationships
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

  const finishedGoods = products.filter((p) => p.item_type === "bundle");
  const standaloneFinished = products.filter(
    (p) => p.item_type === "inventory" && !componentIds.has(p.id)
  );
  const rawMaterials = products.filter(
    (p) => p.item_type === "inventory" && componentIds.has(p.id)
  );

  const handleRecategorize = async (
    product: Product,
    newCategory: ProductCategory
  ) => {
    setSaving(true);
    try {
      let updates: Record<string, unknown> = {};

      if (newCategory === "finished_good") {
        // Convert to bundle type
        updates = { item_type: "bundle", bundle_id: null, bundle_quantity: null };
      } else if (newCategory === "component") {
        // Convert to inventory, keep as component (bundle_id stays if it has one)
        updates = { item_type: "inventory" };
      } else {
        // finished_good_no_bom: inventory type, remove bundle linkage
        updates = { item_type: "inventory", bundle_id: null, bundle_quantity: null };
      }

      const res = await fetch(`/api/products/${product.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });

      if (res.ok) {
        const updated = await res.json();
        setProducts((prev) =>
          prev.map((p) => (p.id === updated.id ? updated : p))
        );
      }
    } finally {
      setSaving(false);
      setEditingId(null);
    }
  };

  const totalFinishedGoods = finishedGoods.length + standaloneFinished.length;

  const renderCategoryDropdown = (product: Product) => {
    const current = classifyProduct(product, componentIds);
    const isEditing = editingId === product.id;

    return (
      <div className="relative">
        <button
          onClick={() => setEditingId(isEditing ? null : product.id)}
          disabled={saving}
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${CATEGORY_STYLES[current]} hover:opacity-80`}
        >
          {CATEGORY_LABELS[current]}
          <ChevronDown className="h-3 w-3" />
        </button>
        {isEditing && (
          <div className="absolute right-0 top-full mt-1 z-10 w-56 rounded-lg border border-gray-200 bg-white shadow-lg py-1">
            {(Object.keys(CATEGORY_LABELS) as ProductCategory[]).map((cat) => (
              <button
                key={cat}
                onClick={() => handleRecategorize(product, cat)}
                disabled={saving}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${
                  cat === current ? "font-medium text-gray-900" : "text-gray-600"
                }`}
              >
                <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium mr-2 ${CATEGORY_STYLES[cat]}`}>
                  {CATEGORY_LABELS[cat]}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

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
                    <div
                      key={fg.id}
                      className="rounded-xl border border-gray-200 bg-white overflow-hidden"
                    >
                      <div className="flex items-center gap-3 px-5 py-3.5 bg-gradient-to-r from-brand-50 to-white border-b border-gray-100">
                        <div className="h-8 w-8 rounded-lg bg-brand-100 flex items-center justify-center">
                          <Layers className="h-4 w-4 text-brand-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">
                            {fg.quickbooks_name}
                          </p>
                          <p className="text-xs text-gray-500">
                            {fg.sku || "No SKU"} &middot; {components.length} component{components.length !== 1 ? "s" : ""}
                          </p>
                        </div>
                        {renderCategoryDropdown(fg)}
                      </div>
                      {components.length > 0 && (
                        <div>
                          <div className="px-5 py-1.5 bg-gray-50 border-b border-gray-100">
                            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Bill of Materials</p>
                          </div>
                          <div className="divide-y divide-gray-50">
                            {components.map((comp) => (
                              <div
                                key={comp.id}
                                className="flex items-center gap-3 px-5 py-2.5 pl-16"
                              >
                                <div className="h-1.5 w-1.5 rounded-full bg-gray-300 flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm text-gray-700 truncate">
                                    {comp.quickbooks_name}
                                  </p>
                                </div>
                                <span className="text-xs text-gray-400 font-mono">
                                  {comp.sku || "—"}
                                </span>
                                <span className="text-xs text-gray-500 w-12 text-right">
                                  &times;{comp.bundle_quantity || 1}
                                </span>
                                {renderCategoryDropdown(comp)}
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

          {/* Standalone Finished Goods (no BOM) */}
          {standaloneFinished.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                Finished Goods — No BOM ({standaloneFinished.length})
              </h2>
              <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="px-4 py-3 text-left font-medium text-gray-500">Name</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-500">SKU</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-500">Unit Cost</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-500">Type</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {standaloneFinished.map((p) => (
                      <tr key={p.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-900">{p.quickbooks_name}</td>
                        <td className="px-4 py-3 text-gray-500 font-mono text-xs">{p.sku || "—"}</td>
                        <td className="px-4 py-3 text-right text-gray-700">
                          {p.unit_cost ? `$${Number(p.unit_cost).toFixed(2)}` : "—"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {renderCategoryDropdown(p)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Components / Raw Materials */}
          {rawMaterials.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                Components / Raw Materials ({rawMaterials.length})
              </h2>
              <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="px-4 py-3 text-left font-medium text-gray-500">Name</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-500">SKU</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-500">Used In</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-500">Type</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {rawMaterials.map((p) => {
                      const usedIn = finishedGoods.filter((fg) =>
                        (componentMap.get(fg.id) || []).some((c) => c.id === p.id)
                      );
                      return (
                        <tr key={p.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium text-gray-900">{p.quickbooks_name}</td>
                          <td className="px-4 py-3 text-gray-500 font-mono text-xs">{p.sku || "—"}</td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-1">
                              {usedIn.map((fg) => (
                                <span
                                  key={fg.id}
                                  className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600"
                                >
                                  {fg.quickbooks_name}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right">
                            {renderCategoryDropdown(p)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Click-away overlay */}
      {editingId && (
        <div
          className="fixed inset-0 z-0"
          onClick={() => setEditingId(null)}
        />
      )}
    </div>
  );
}
