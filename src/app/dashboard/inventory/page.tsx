"use client";

import { useEffect, useState } from "react";
import { RefreshCw, Plus, X, Search, MapPin, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";

interface BomItem {
  product_id: string; name: string; sku: string | null; image_url: string | null;
  bom_quantity: number; implied_units: number;
  standalone_fba: number; standalone_tpl: number; standalone_manual: number;
  standalone_total: number; total_inventory: number; qb_starting: number;
}

interface FGWithBOM {
  product_id: string; name: string; sku: string | null; image_url: string | null;
  fba: number; tpl: number; manual: number; finished_good_units: number;
  qb_starting: number; amazon_sold: number; shopify_sold: number;
  total_sold: number; expected_remaining: number; variance: number;
  bom_items: BomItem[];
}

interface StandaloneItem {
  product_id: string; name: string; sku: string | null; image_url: string | null;
  fba: number; tpl: number; manual: number; total: number;
  qb_starting: number; amazon_sold: number; shopify_sold: number;
  total_sold: number; expected_remaining: number; variance: number;
}

interface UnattachedItem {
  product_id: string; name: string; sku: string | null; image_url: string | null;
  fba: number; tpl: number; manual: number; total: number;
}

interface ProductOption { id: string; quickbooks_name: string; sku: string | null; image_url: string | null; }

function VarianceIcon({ v }: { v: number }) {
  if (v === 0) return <CheckCircle2 className="h-4 w-4 text-green-500 inline" />;
  if (Math.abs(v) <= 5) return <AlertTriangle className="h-4 w-4 text-amber-500 inline" />;
  return <XCircle className="h-4 w-4 text-red-500 inline" />;
}

export default function InventoryPage() {
  const [data, setData] = useState<{
    finished_goods_with_bom: FGWithBOM[];
    standalone_finished_goods: StandaloneItem[];
    unattached_components: UnattachedItem[];
    meta: { qb_snapshot_date: string | null; sales_since: string; fba_snapshot_date: string | null; tpl_snapshot_date: string | null };
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [location, setLocation] = useState("");
  const [note, setNote] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [saving, setSaving] = useState(false);

  const loadData = () => {
    setLoading(true);
    fetch("/api/inventory-audit").then((r) => r.json()).then((d) => { setData(d); setLoading(false); }).catch(() => setLoading(false));
  };
  useEffect(() => { loadData(); }, []);

  const openModal = () => {
    setModalOpen(true); setSelectedProductId(""); setQuantity(""); setLocation(""); setNote(""); setProductSearch("");
    fetch("/api/products/list").then((r) => r.json()).then((d) => { if (Array.isArray(d)) setProducts(d); });
  };

  const handleAdd = async () => {
    if (!selectedProductId || !quantity || !location) return;
    setSaving(true);
    const res = await fetch("/api/manual-inventory", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ product_id: selectedProductId, quantity: parseInt(quantity), location, note: note || null }) });
    if (res.ok) { setModalOpen(false); loadData(); }
    setSaving(false);
  };

  const filteredProducts = products.filter((p) => {
    if (!productSearch) return true;
    const q = productSearch.toLowerCase();
    return p.quickbooks_name.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q);
  });

  if (loading) return <div className="flex items-center justify-center py-20 text-gray-400"><RefreshCw className="h-5 w-5 animate-spin mr-2" /> Loading inventory...</div>;
  if (!data) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Inventory</h1>
          <p className="text-sm text-gray-500 mt-1">
            QB: {data.meta.qb_snapshot_date || "—"} · Sales since: {data.meta.sales_since} · FBA: {data.meta.fba_snapshot_date || "—"} · 3PL: {data.meta.tpl_snapshot_date || "—"}
          </p>
        </div>
        <button onClick={openModal} className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 transition-colors">
          <Plus className="h-4 w-4" /> Add Manual Inventory
        </button>
      </div>

      {/* Finished Goods with BOM */}
      {data.finished_goods_with_bom.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Finished Goods with BOM</h2>
          <div className="rounded-xl border border-gray-200 bg-white">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="px-3 py-3 text-left font-medium text-gray-500 w-10"></th>
                    <th className="px-3 py-3 text-left font-medium text-gray-500">Product / Component</th>
                    <th className="px-3 py-3 text-right font-medium text-gray-500">QB Start</th>
                    <th className="px-3 py-3 text-right font-medium text-amber-600">AMZ Sold</th>
                    <th className="px-3 py-3 text-right font-medium text-emerald-600">Shop Sold</th>
                    <th className="px-3 py-3 text-right font-medium text-gray-500">Expected</th>
                    <th className="px-3 py-3 text-right font-medium text-amber-600">FBA</th>
                    <th className="px-3 py-3 text-right font-medium text-purple-600">3PL</th>
                    <th className="px-3 py-3 text-right font-medium text-teal-600">Manual</th>
                    <th className="px-3 py-3 text-right font-medium text-gray-500">Actual</th>
                    <th className="px-3 py-3 text-right font-medium text-gray-500">Variance</th>
                    <th className="px-3 py-3 w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {data.finished_goods_with_bom.map((fg) => (
                    <>{/* eslint-disable-next-line react/jsx-key */}
                      {/* Parent row */}
                      <tr key={fg.product_id} className="border-b border-gray-200 bg-brand-50/50">
                        <td className="px-3 py-2.5">
                          {fg.image_url ? <img src={fg.image_url} alt="" className="h-8 w-8 rounded-md object-contain bg-white border border-gray-100" /> : <div className="h-8 w-8 rounded-md bg-brand-100" />}
                        </td>
                        <td className="px-3 py-2.5">
                          <p className="font-semibold text-gray-900">{fg.name}</p>
                          <p className="text-xs text-gray-400">{fg.sku || "—"} · Finished Good</p>
                        </td>
                        <td className="px-3 py-2.5 text-right font-medium text-gray-900">{fg.qb_starting || "—"}</td>
                        <td className="px-3 py-2.5 text-right text-amber-700">{fg.amazon_sold > 0 ? `-${fg.amazon_sold}` : "—"}</td>
                        <td className="px-3 py-2.5 text-right text-emerald-700">{fg.shopify_sold > 0 ? `-${fg.shopify_sold}` : "—"}</td>
                        <td className="px-3 py-2.5 text-right font-medium text-gray-700">{fg.expected_remaining}</td>
                        <td className="px-3 py-2.5 text-right text-amber-600">{fg.fba || "—"}</td>
                        <td className="px-3 py-2.5 text-right text-purple-600">{fg.tpl || "—"}</td>
                        <td className="px-3 py-2.5 text-right text-teal-600">{fg.manual || "—"}</td>
                        <td className="px-3 py-2.5 text-right font-semibold text-gray-900">{fg.finished_good_units}</td>
                        <td className={`px-3 py-2.5 text-right font-semibold ${fg.variance === 0 ? "text-green-600" : fg.variance > 0 ? "text-blue-600" : "text-red-600"}`}>
                          {fg.variance > 0 ? "+" : ""}{fg.variance}
                        </td>
                        <td className="px-3 py-2.5"><VarianceIcon v={fg.variance} /></td>
                      </tr>
                      {/* BOM component rows */}
                      {fg.bom_items.map((comp) => (
                        <tr key={comp.product_id} className="border-b border-gray-50 bg-white">
                          <td className="px-3 py-1.5"></td>
                          <td className="px-3 py-1.5 pl-12">
                            <div className="flex items-center gap-2">
                              <div className="h-1.5 w-1.5 rounded-full bg-gray-300" />
                              <span className="text-gray-600 text-xs">{comp.name}</span>
                              <span className="text-xs text-gray-400">×{comp.bom_quantity}</span>
                            </div>
                          </td>
                          <td className="px-3 py-1.5 text-right text-xs text-gray-400">{comp.qb_starting || "—"}</td>
                          <td className="px-3 py-1.5"></td>
                          <td className="px-3 py-1.5"></td>
                          <td className="px-3 py-1.5 text-right text-xs text-brand-600">{comp.implied_units} in FG</td>
                          <td className="px-3 py-1.5 text-right text-xs text-amber-500">{comp.standalone_fba || "—"}</td>
                          <td className="px-3 py-1.5 text-right text-xs text-purple-500">{comp.standalone_tpl || "—"}</td>
                          <td className="px-3 py-1.5 text-right text-xs text-teal-500">{comp.standalone_manual || "—"}</td>
                          <td className="px-3 py-1.5 text-right text-xs font-medium text-gray-700">{comp.total_inventory}</td>
                          <td className="px-3 py-1.5"></td>
                          <td className="px-3 py-1.5"></td>
                        </tr>
                      ))}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Standalone Finished Goods */}
      {data.standalone_finished_goods.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Finished Goods — No BOM</h2>
          <div className="rounded-xl border border-gray-200 bg-white">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="px-3 py-3 text-left font-medium text-gray-500 w-10"></th>
                    <th className="px-3 py-3 text-left font-medium text-gray-500">Product</th>
                    <th className="px-3 py-3 text-right font-medium text-gray-500">QB Start</th>
                    <th className="px-3 py-3 text-right font-medium text-amber-600">AMZ Sold</th>
                    <th className="px-3 py-3 text-right font-medium text-emerald-600">Shop Sold</th>
                    <th className="px-3 py-3 text-right font-medium text-gray-500">Expected</th>
                    <th className="px-3 py-3 text-right font-medium text-amber-600">FBA</th>
                    <th className="px-3 py-3 text-right font-medium text-purple-600">3PL</th>
                    <th className="px-3 py-3 text-right font-medium text-teal-600">Manual</th>
                    <th className="px-3 py-3 text-right font-medium text-gray-500">Actual</th>
                    <th className="px-3 py-3 text-right font-medium text-gray-500">Variance</th>
                    <th className="px-3 py-3 w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.standalone_finished_goods.map((item) => (
                    <tr key={item.product_id} className="hover:bg-gray-50">
                      <td className="px-3 py-2.5">
                        {item.image_url ? <img src={item.image_url} alt="" className="h-8 w-8 rounded-md object-contain bg-white border border-gray-100" /> : <div className="h-8 w-8 rounded-md bg-gray-100" />}
                      </td>
                      <td className="px-3 py-2.5">
                        <p className="font-medium text-gray-900 truncate max-w-xs">{item.name}</p>
                        {item.sku && <p className="text-xs text-gray-400">{item.sku}</p>}
                      </td>
                      <td className="px-3 py-2.5 text-right font-medium text-gray-900">{item.qb_starting || "—"}</td>
                      <td className="px-3 py-2.5 text-right text-amber-700">{item.amazon_sold > 0 ? `-${item.amazon_sold}` : "—"}</td>
                      <td className="px-3 py-2.5 text-right text-emerald-700">{item.shopify_sold > 0 ? `-${item.shopify_sold}` : "—"}</td>
                      <td className="px-3 py-2.5 text-right font-medium text-gray-700">{item.expected_remaining}</td>
                      <td className="px-3 py-2.5 text-right text-amber-600">{item.fba || "—"}</td>
                      <td className="px-3 py-2.5 text-right text-purple-600">{item.tpl || "—"}</td>
                      <td className="px-3 py-2.5 text-right text-teal-600">{item.manual || "—"}</td>
                      <td className="px-3 py-2.5 text-right font-semibold text-gray-900">{item.total}</td>
                      <td className={`px-3 py-2.5 text-right font-semibold ${item.variance === 0 ? "text-green-600" : item.variance > 0 ? "text-blue-600" : "text-red-600"}`}>
                        {item.variance > 0 ? "+" : ""}{item.variance}
                      </td>
                      <td className="px-3 py-2.5"><VarianceIcon v={item.variance} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Unattached Components */}
      {data.unattached_components.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Unattached Components</h2>
          <div className="rounded-xl border border-gray-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-4 py-3 text-left font-medium text-gray-500 w-10"></th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Component</th>
                  <th className="px-4 py-3 text-right font-medium text-amber-600">FBA</th>
                  <th className="px-4 py-3 text-right font-medium text-purple-600">3PL</th>
                  <th className="px-4 py-3 text-right font-medium text-teal-600">Manual</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.unattached_components.map((item) => (
                  <tr key={item.product_id} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5">
                      {item.image_url ? <img src={item.image_url} alt="" className="h-8 w-8 rounded-md object-contain bg-white border border-gray-100" /> : <div className="h-8 w-8 rounded-md bg-gray-100" />}
                    </td>
                    <td className="px-4 py-2.5">
                      <p className="font-medium text-gray-900 truncate max-w-xs">{item.name}</p>
                      {item.sku && <p className="text-xs text-gray-400">{item.sku}</p>}
                    </td>
                    <td className="px-4 py-2.5 text-right text-amber-600">{item.fba || "—"}</td>
                    <td className="px-4 py-2.5 text-right text-purple-600">{item.tpl || "—"}</td>
                    <td className="px-4 py-2.5 text-right text-teal-600">{item.manual || "—"}</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-gray-900">{item.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Manual Inventory Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-teal-600" />
                <h2 className="text-lg font-semibold text-gray-900">Add Manual Inventory</h2>
              </div>
              <button onClick={() => setModalOpen(false)} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100"><X className="h-5 w-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Product</label>
                <div className="relative mb-1">
                  <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                  <input type="text" placeholder="Search products..." value={productSearch} onChange={(e) => setProductSearch(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 pl-9 pr-3 py-2 text-sm placeholder-gray-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
                </div>
                <div className="max-h-40 overflow-y-auto rounded-lg border border-gray-200">
                  {filteredProducts.map((p) => (
                    <button key={p.id} onClick={() => { setSelectedProductId(p.id); setProductSearch(""); }}
                      className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 border-b border-gray-50 last:border-0 ${selectedProductId === p.id ? "bg-brand-50 text-brand-700" : "hover:bg-gray-50"}`}>
                      {p.image_url ? <img src={p.image_url} alt="" className="h-6 w-6 rounded object-contain border border-gray-100 flex-shrink-0" /> : <div className="h-6 w-6 rounded bg-gray-100 flex-shrink-0" />}
                      <span className="truncate">{p.quickbooks_name}</span>
                      {p.sku && <span className="text-xs text-gray-400 ml-auto">{p.sku}</span>}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
                <input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="e.g., 3200"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g., Gemini, Co-manufacturer"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Note <span className="text-gray-400">(optional)</span></label>
                <input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g., Gusset bags for next production run"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
              <button onClick={() => setModalOpen(false)} className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
              <button onClick={handleAdd} disabled={saving || !selectedProductId || !quantity || !location}
                className="flex-1 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">
                {saving ? "Adding..." : "Add Inventory"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
