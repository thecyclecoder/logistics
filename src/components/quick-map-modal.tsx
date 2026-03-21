"use client";

import { useState, useEffect, useMemo } from "react";
import { Search, X } from "lucide-react";

interface Product {
  id: string;
  quickbooks_name: string;
  sku: string | null;
  image_url: string | null;
  item_type: string;
  product_category: string | null;
  bundle_id: string | null;
}

interface QuickMapModalProps {
  externalId: string;
  source: string;
  label: string | null;
  title: string | null;
  onMapped: (productName: string) => void;
  onClose: () => void;
}

export default function QuickMapModal({
  externalId,
  source,
  label,
  title,
  onMapped,
  onClose,
}: QuickMapModalProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [multiplier, setMultiplier] = useState(1);

  useEffect(() => {
    fetch("/api/products/list")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setProducts(data);
      });
  }, []);

  const filtered = useMemo(() => {
    let list = products;

    // Amazon and Shopify can only map to finished goods, not components
    if (source === "amazon" || source === "shopify") {
      list = list.filter((p) => {
        // Exclude items explicitly categorized as components
        if (p.product_category === "component") return false;
        // Exclude items that are children of a bundle (BOM components)
        if (p.bundle_id) return false;
        return true;
      });
    }

    if (!search) return list;
    const q = search.toLowerCase();
    return list.filter(
      (p) =>
        p.quickbooks_name.toLowerCase().includes(q) ||
        p.sku?.toLowerCase().includes(q)
    );
  }, [products, search]);

  const handleMap = async (productId: string) => {
    setSaving(true);
    try {
      const res = await fetch("/api/mappings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_id: productId,
          external_id: externalId,
          source,
          unit_multiplier: multiplier,
        }),
      });
      if (res.ok) {
        const product = products.find((p) => p.id === productId);
        onMapped(product?.quickbooks_name || "");
      } else {
        const err = await res.json();
        alert(typeof err.error === "string" ? err.error : "Failed to create mapping");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h3 className="text-base font-semibold text-gray-900">Map to QB Product</h3>
            <p className="text-xs text-gray-500 mt-0.5 truncate max-w-xs">
              {title || label || externalId}
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-5 py-3 border-b border-gray-50">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search QB products..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
              className="w-full rounded-lg border border-gray-300 bg-white pl-9 pr-3 py-2 text-sm placeholder-gray-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
          <div className="flex items-center gap-2 mt-2">
            <label className="text-xs text-gray-500">Units per SKU:</label>
            <input
              type="number"
              min={1}
              value={multiplier}
              onChange={(e) => setMultiplier(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-14 rounded border border-gray-300 px-2 py-1 text-xs text-center focus:border-brand-500 focus:outline-none"
            />
            {multiplier > 1 && <span className="text-xs text-blue-600">({multiplier}-pack)</span>}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-gray-400">
              {products.length === 0 ? "Loading products..." : "No matches"}
            </div>
          ) : (
            filtered.map((p) => (
              <button
                key={p.id}
                onClick={() => handleMap(p.id)}
                disabled={saving}
                className="w-full text-left px-5 py-2.5 flex items-center gap-3 hover:bg-brand-50 border-b border-gray-50 last:border-0 disabled:opacity-50"
              >
                {p.image_url ? (
                  <img src={p.image_url} alt="" className="h-8 w-8 rounded-md object-contain bg-white border border-gray-100 flex-shrink-0" />
                ) : (
                  <div className="h-8 w-8 rounded-md bg-gray-100 flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{p.quickbooks_name}</p>
                  {p.sku && <p className="text-xs text-gray-400">{p.sku}</p>}
                </div>
              </button>
            ))
          )}
        </div>

        <div className="px-5 py-3 border-t border-gray-100">
          <button
            onClick={onClose}
            className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
