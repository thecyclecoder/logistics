import { createClient } from "@/lib/supabase/server";
import { Package, Layers, Boxes } from "lucide-react";
import type { Product } from "@/lib/types/database";

export const revalidate = 60;

export default async function ProductsPage() {
  const supabase = createClient();

  const { data } = await supabase
    .from("products")
    .select("*")
    .eq("active", true)
    .order("quickbooks_name");

  const products = (data || []) as Product[];

  // Finished goods with BOM (QB Groups)
  const finishedGoodsWithBOM = products.filter((p) => p.item_type === "bundle");

  // Build component map: bundle_id → components
  const componentMap = new Map<string, Product[]>();
  const componentIds = new Set<string>();
  for (const p of products) {
    if (p.bundle_id) {
      const list = componentMap.get(p.bundle_id) || [];
      list.push(p);
      componentMap.set(p.bundle_id, list);
      componentIds.add(p.id);
    }
  }

  // Standalone finished goods: inventory items not used as a component in any bundle
  const standaloneFinishedGoods = products.filter(
    (p) => p.item_type === "inventory" && !componentIds.has(p.id)
  );

  // Raw materials / components: inventory items that ARE components of a bundle
  const rawMaterials = products.filter(
    (p) => p.item_type === "inventory" && componentIds.has(p.id)
  );

  const totalFinishedGoods = finishedGoodsWithBOM.length + standaloneFinishedGoods.length;

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
          {finishedGoodsWithBOM.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                Finished Goods ({finishedGoodsWithBOM.length})
              </h2>
              <div className="space-y-3">
                {finishedGoodsWithBOM.map((fg) => {
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
                        <span className="rounded-full bg-brand-100 px-2.5 py-0.5 text-xs font-medium text-brand-700">
                          Finished Good
                        </span>
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
          {standaloneFinishedGoods.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                Finished Goods — No BOM ({standaloneFinishedGoods.length})
              </h2>
              <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="px-4 py-3 text-left font-medium text-gray-500">Name</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-500">SKU</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-500">Unit Cost</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {standaloneFinishedGoods.map((p) => (
                      <tr key={p.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-900">{p.quickbooks_name}</span>
                            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                              Finished Good
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-500 font-mono text-xs">{p.sku || "—"}</td>
                        <td className="px-4 py-3 text-right text-gray-700">
                          {p.unit_cost ? `$${Number(p.unit_cost).toFixed(2)}` : "—"}
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
                      <th className="px-4 py-3 text-right font-medium text-gray-500">Unit Cost</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {rawMaterials.map((p) => {
                      const usedIn = finishedGoodsWithBOM.filter((fg) =>
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
                          <td className="px-4 py-3 text-right text-gray-700">
                            {p.unit_cost ? `$${Number(p.unit_cost).toFixed(2)}` : "—"}
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
    </div>
  );
}
