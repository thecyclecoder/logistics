"use client";

import { useEffect, useState } from "react";
import { RefreshCw, Layers, Package, Boxes, Plus, X, Search, MapPin } from "lucide-react";

interface BomItem {
  product_id: string;
  name: string;
  sku: string | null;
  image_url: string | null;
  bom_quantity: number;
  implied_units: number;
  standalone_fba: number;
  standalone_tpl: number;
  standalone_manual: number;
  standalone_total: number;
  total_inventory: number;
}

interface FinishedGoodBOM {
  product_id: string;
  name: string;
  sku: string | null;
  image_url: string | null;
  fba: number;
  tpl: number;
  manual: number;
  finished_good_units: number;
  bom_items: BomItem[];
}

interface InventoryItem {
  id: string;
  name: string;
  sku: string | null;
  image_url: string | null;
  fba: number;
  tpl: number;
  manual: number;
  total: number;
}

interface ProductOption {
  id: string;
  quickbooks_name: string;
  sku: string | null;
  image_url: string | null;
}

export default function InventoryPage() {
  const [data, setData] = useState<{
    finished_goods_with_bom: FinishedGoodBOM[];
    standalone_finished_goods: InventoryItem[];
    unattached_components: InventoryItem[];
    meta: { fba_snapshot_date: string | null; tpl_snapshot_date: string | null };
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
    fetch("/api/inventory-audit")
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, []);

  const openModal = () => {
    setModalOpen(true);
    setSelectedProductId("");
    setQuantity("");
    setLocation("");
    setNote("");
    setProductSearch("");
    fetch("/api/products/list")
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d)) setProducts(d); });
  };

  const handleAdd = async () => {
    if (!selectedProductId || !quantity || !location) return;
    setSaving(true);
    const res = await fetch("/api/manual-inventory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        product_id: selectedProductId,
        quantity: parseInt(quantity),
        location,
        note: note || null,
      }),
    });
    if (res.ok) {
      setModalOpen(false);
      loadData();
    }
    setSaving(false);
  };

  const filteredProducts = products.filter((p) => {
    if (!productSearch) return true;
    const q = productSearch.toLowerCase();
    return p.quickbooks_name.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q);
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-400">
        <RefreshCw className="h-5 w-5 animate-spin mr-2" /> Loading inventory...
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Inventory</h1>
          <p className="text-sm text-gray-500 mt-1">
            FBA: {data.meta.fba_snapshot_date || "—"} · 3PL: {data.meta.tpl_snapshot_date || "—"}
          </p>
        </div>
        <button onClick={openModal}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 transition-colors">
          <Plus className="h-4 w-4" /> Add Manual Inventory
        </button>
      </div>

      {/* Finished Goods with BOM */}
      {data.finished_goods_with_bom.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Layers className="h-4 w-4" /> Finished Goods with BOM
          </h2>
          <div className="space-y-3">
            {data.finished_goods_with_bom.map((fg) => (
              <div key={fg.product_id} className="rounded-xl border border-gray-200 bg-white">
                <div className="flex items-center gap-3 px-5 py-3.5 bg-gradient-to-r from-brand-50 to-white border-b border-gray-100 rounded-t-xl">
                  {fg.image_url ? (
                    <img src={fg.image_url} alt="" className="h-10 w-10 rounded-lg object-contain bg-white border border-gray-100 flex-shrink-0" />
                  ) : (
                    <div className="h-10 w-10 rounded-lg bg-brand-100 flex items-center justify-center flex-shrink-0">
                      <Layers className="h-4 w-4 text-brand-600" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900">{fg.name}</p>
                    <p className="text-xs text-gray-500">{fg.sku || "—"}</p>
                  </div>
                  <div className="flex items-center gap-4 text-xs">
                    <div className="text-center">
                      <p className="font-medium text-amber-600">{fg.fba}</p>
                      <p className="text-gray-400">FBA</p>
                    </div>
                    <div className="text-center">
                      <p className="font-medium text-purple-600">{fg.tpl}</p>
                      <p className="text-gray-400">3PL</p>
                    </div>
                    {fg.manual > 0 && (
                      <div className="text-center">
                        <p className="font-medium text-teal-600">{fg.manual}</p>
                        <p className="text-gray-400">Manual</p>
                      </div>
                    )}
                    <div className="text-center border-l border-gray-200 pl-4">
                      <p className="font-semibold text-gray-900 text-base">{fg.finished_good_units}</p>
                      <p className="text-gray-400">Total FG</p>
                    </div>
                  </div>
                </div>
                <div>
                  <div className="px-5 py-1.5 bg-gray-50 border-b border-gray-100">
                    <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">BOM Component Inventory</p>
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-gray-400 border-b border-gray-50">
                        <th className="px-5 py-2 text-left font-medium pl-16">Component</th>
                        <th className="px-3 py-2 text-right font-medium">×BOM</th>
                        <th className="px-3 py-2 text-right font-medium">In FG</th>
                        <th className="px-3 py-2 text-right font-medium">FBA</th>
                        <th className="px-3 py-2 text-right font-medium">3PL</th>
                        <th className="px-3 py-2 text-right font-medium">Manual</th>
                        <th className="px-3 py-2 text-right font-medium">Standalone</th>
                        <th className="px-3 py-2 text-right font-medium">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {fg.bom_items.map((comp) => (
                        <tr key={comp.product_id}>
                          <td className="px-5 py-2 pl-16">
                            <div className="flex items-center gap-2">
                              <div className="h-1.5 w-1.5 rounded-full bg-gray-300" />
                              <span className="text-gray-700 truncate max-w-[200px]">{comp.name}</span>
                              <span className="text-xs text-gray-400 font-mono">{comp.sku || ""}</span>
                            </div>
                          </td>
                          <td className="px-3 py-2 text-right text-gray-500">×{comp.bom_quantity}</td>
                          <td className="px-3 py-2 text-right text-brand-600 font-medium">{comp.implied_units}</td>
                          <td className="px-3 py-2 text-right text-amber-600">{comp.standalone_fba || "—"}</td>
                          <td className="px-3 py-2 text-right text-purple-600">{comp.standalone_tpl || "—"}</td>
                          <td className="px-3 py-2 text-right text-teal-600">{comp.standalone_manual || "—"}</td>
                          <td className="px-3 py-2 text-right text-gray-700">{comp.standalone_total || "—"}</td>
                          <td className="px-3 py-2 text-right font-semibold text-gray-900">{comp.total_inventory}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Standalone Finished Goods */}
      {data.standalone_finished_goods.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Package className="h-4 w-4" /> Finished Goods — No BOM
          </h2>
          <div className="rounded-xl border border-gray-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-4 py-3 text-left font-medium text-gray-500 w-10"></th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Product</th>
                  <th className="px-4 py-3 text-right font-medium text-amber-600">FBA</th>
                  <th className="px-4 py-3 text-right font-medium text-purple-600">3PL</th>
                  <th className="px-4 py-3 text-right font-medium text-teal-600">Manual</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.standalone_finished_goods.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5">
                      {item.image_url ? (
                        <img src={item.image_url} alt="" className="h-8 w-8 rounded-md object-contain bg-white border border-gray-100" />
                      ) : <div className="h-8 w-8 rounded-md bg-gray-100" />}
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

      {/* Unattached Components */}
      {data.unattached_components.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Boxes className="h-4 w-4" /> Unattached Components
          </h2>
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
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5">
                      {item.image_url ? (
                        <img src={item.image_url} alt="" className="h-8 w-8 rounded-md object-contain bg-white border border-gray-100" />
                      ) : <div className="h-8 w-8 rounded-md bg-gray-100" />}
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
              <button onClick={() => setModalOpen(false)} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100">
                <X className="h-5 w-5" />
              </button>
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
                      {p.image_url ? (
                        <img src={p.image_url} alt="" className="h-6 w-6 rounded object-contain border border-gray-100 flex-shrink-0" />
                      ) : <div className="h-6 w-6 rounded bg-gray-100 flex-shrink-0" />}
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
              <button onClick={() => setModalOpen(false)}
                className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
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
