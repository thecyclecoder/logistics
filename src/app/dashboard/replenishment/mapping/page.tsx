"use client";

import { useState, useEffect, useRef } from "react";
import {
  Package,
  Search,
  Plus,
  Trash2,
  ChevronDown,
  ShieldCheck,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Link2,
} from "lucide-react";

interface AmazonProduct {
  asin: string;
  product_id: string;
  name: string;
  image_url: string | null;
  item_type: string | null;
  multiplier: number;
}

interface TplProduct {
  sku: string;
  product_id: string;
  name: string;
  image_url: string | null;
  label: string | null;
  multiplier: number;
}

interface FbaInventory {
  fulfillable: number;
  inbound: number;
}

interface TplInventory {
  available: number;
  on_hand: number;
}

interface KitMapping {
  id: string;
  asin: string;
  amplifier_kit_sku: string;
  transparency_enrolled: boolean;
  notes: string | null;
  active: boolean;
  created_at: string;
}

// Shared item shape for the searchable select
interface SelectItem {
  name: string;
  image_url: string | null;
  _value: string;
  _subtext: string;
}

// Searchable dropdown with product images
function ProductSelect({
  items,
  value,
  onChange,
  placeholder,
  excludeValues,
}: {
  items: SelectItem[];
  value: string;
  onChange: (val: string) => void;
  placeholder: string;
  excludeValues?: Set<string>;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = items.find((p) => p._value === value);
  const available = excludeValues
    ? items.filter((p) => !excludeValues.has(p._value) || p._value === value)
    : items;
  const filtered = search
    ? available.filter(
        (p) =>
          p.name.toLowerCase().includes(search.toLowerCase()) ||
          p._value.toLowerCase().includes(search.toLowerCase()) ||
          p._subtext.toLowerCase().includes(search.toLowerCase())
      )
    : available;

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen(!open);
          setSearch("");
        }}
        className={`w-full flex items-center gap-2 rounded-lg border px-3 py-2 text-sm text-left transition-colors ${
          value
            ? "border-green-300 bg-green-50"
            : "border-gray-300 bg-white hover:border-gray-400"
        }`}
      >
        {selected ? (
          <>
            {selected.image_url ? (
              <img
                src={selected.image_url}
                alt=""
                className="h-7 w-7 rounded object-contain border border-gray-100 flex-shrink-0"
              />
            ) : (
              <div className="h-7 w-7 rounded bg-gray-100 flex items-center justify-center flex-shrink-0">
                <Package className="h-3.5 w-3.5 text-gray-400" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="font-medium text-gray-900 truncate text-sm">{selected.name}</p>
              <p className="text-xs text-gray-400">{selected._subtext}</p>
            </div>
          </>
        ) : (
          <span className="text-gray-400">{placeholder}</span>
        )}
        <ChevronDown className="h-4 w-4 text-gray-400 flex-shrink-0 ml-auto" />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full max-h-80 rounded-lg border border-gray-200 bg-white shadow-xl flex flex-col">
          <div className="flex items-center border-b border-gray-100 px-3 py-2.5">
            <Search className="h-4 w-4 text-gray-400 mr-2 flex-shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              className="w-full text-sm outline-none placeholder-gray-400"
            />
          </div>
          <div className="overflow-y-auto flex-1">
            {filtered.length === 0 ? (
              <div className="px-3 py-6 text-sm text-gray-400 text-center">
                No matching products
              </div>
            ) : (
              filtered.map((p) => (
                  <button
                    key={p._value}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-brand-50 transition-colors ${
                      p._value === value ? "bg-green-50" : ""
                    }`}
                    onClick={() => {
                      onChange(p._value);
                      setOpen(false);
                      setSearch("");
                    }}
                  >
                    {p.image_url ? (
                      <img
                        src={p.image_url}
                        alt=""
                        className="h-8 w-8 rounded object-contain border border-gray-100 flex-shrink-0"
                      />
                    ) : (
                      <div className="h-8 w-8 rounded bg-gray-100 flex items-center justify-center flex-shrink-0">
                        <Package className="h-4 w-4 text-gray-400" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 truncate">{p.name}</p>
                      <p className="text-xs text-gray-400">{p._subtext}</p>
                    </div>
                    {p._value === value && (
                      <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                    )}
                  </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ReplenishmentMappingPage() {
  const [mappings, setMappings] = useState<KitMapping[]>([]);
  const [amazonProducts, setAmazonProducts] = useState<AmazonProduct[]>([]);
  const [tplProducts, setTplProducts] = useState<TplProduct[]>([]);
  const [fbaInventory, setFbaInventory] = useState<Record<string, FbaInventory>>({});
  const [tplInventory, setTplInventory] = useState<Record<string, TplInventory>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // New mapping form
  const [newAsin, setNewAsin] = useState("");
  const [newKitSku, setNewKitSku] = useState("");
  const [newTransparency, setNewTransparency] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  const loadData = async () => {
    try {
      const res = await fetch("/api/replenishment/kit-mappings", { cache: "no-store" });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setMappings(data.mappings || []);
      setAmazonProducts(data.amazon_products || []);
      setTplProducts(data.tpl_products || []);
      setFbaInventory(data.fba_inventory || {});
      setTplInventory(data.tpl_inventory || {});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load mappings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const mappedAsins = new Set(mappings.map((m) => m.asin));

  const handleAdd = async () => {
    if (!newAsin || !newKitSku) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/replenishment/kit-mappings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          asin: newAsin,
          amplifier_kit_sku: newKitSku,
          transparency_enrolled: newTransparency,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setMappings((prev) => [data, ...prev]);
      setNewAsin("");
      setNewKitSku("");
      setNewTransparency(false);
      setShowAddForm(false);
      setSuccess("Mapping created");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create mapping");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleTransparency = async (mapping: KitMapping) => {
    try {
      const res = await fetch("/api/replenishment/kit-mappings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: mapping.id,
          transparency_enrolled: !mapping.transparency_enrolled,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setMappings((prev) =>
        prev.map((m) => (m.id === mapping.id ? data : m))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Remove this mapping?")) return;
    try {
      const res = await fetch(`/api/replenishment/kit-mappings?id=${id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setMappings((prev) => prev.filter((m) => m.id !== id));
      setSuccess("Mapping removed");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    }
  };

  // Resolve friendly names for existing mappings
  const getProductForAsin = (asin: string) =>
    amazonProducts.find((p) => p.asin === asin);
  const getTplProduct = (sku: string) =>
    tplProducts.find((p) => p.sku === sku);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
        <span className="ml-2 text-sm text-gray-500">Loading mappings...</span>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header with add button */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">
            {mappings.length} mapping{mappings.length !== 1 ? "s" : ""} configured
            {amazonProducts.length > 0 && (
              <span className="text-gray-400">
                {" "}
                &middot; {amazonProducts.length - mappings.length} unmapped ASINs
              </span>
            )}
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add Mapping
        </button>
      </div>

      {/* Notifications */}
      {error && (
        <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 rounded-lg px-4 py-3">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">&times;</button>
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 rounded-lg px-4 py-3">
          <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
          {success}
        </div>
      )}

      {/* Add mapping form */}
      {showAddForm && (
        <div className="rounded-xl border-2 border-dashed border-brand-200 bg-brand-50/30 p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">New Kit Mapping</h3>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:items-end">
            {/* Amazon product select */}
            <div className="lg:col-span-5">
              <label className="block text-xs font-medium text-gray-600 mb-1.5">
                Amazon Product
              </label>
              <ProductSelect
                items={amazonProducts.map((p) => ({ ...p, _value: p.asin, _subtext: p.asin }))}
                value={newAsin}
                onChange={setNewAsin}
                placeholder="Search Amazon products..."
                excludeValues={mappedAsins}
              />
            </div>

            {/* Link icon */}
            <div className="hidden lg:flex lg:col-span-1 items-center justify-center pb-1">
              <Link2 className="h-5 w-5 text-gray-300" />
            </div>

            {/* 3PL kit select */}
            <div className="lg:col-span-4">
              <label className="block text-xs font-medium text-gray-600 mb-1.5">
                Amplifier Kit
              </label>
              <ProductSelect
                items={tplProducts.map((p) => ({ ...p, _value: p.sku, _subtext: p.sku }))}
                value={newKitSku}
                onChange={setNewKitSku}
                placeholder="Search 3PL kits..."
              />
            </div>

            {/* Actions */}
            <div className="lg:col-span-2 flex items-center gap-2">
              <label className="flex items-center gap-1.5 cursor-pointer" title="Transparency enrolled">
                <input
                  type="checkbox"
                  checked={newTransparency}
                  onChange={(e) => setNewTransparency(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                />
                <ShieldCheck className="h-4 w-4 text-gray-400" />
              </label>
              <button
                onClick={handleAdd}
                disabled={!newAsin || !newKitSku || saving}
                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Save"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Existing mappings */}
      {mappings.length > 0 ? (
        <div className="space-y-4">
          {mappings.map((mapping) => {
            const product = getProductForAsin(mapping.asin);
            const tplProduct = getTplProduct(mapping.amplifier_kit_sku);
            const fba = fbaInventory[mapping.asin];
            const tpl = tplInventory[mapping.amplifier_kit_sku];

            return (
              <div
                key={mapping.id}
                className="rounded-xl border border-gray-200 bg-white overflow-hidden hover:border-gray-300 transition-colors"
              >
                {/* Card header with actions */}
                <div className="flex items-center justify-between px-4 pt-3 pb-2">
                  <div className="flex items-center gap-2">
                    <Link2 className="h-4 w-4 text-brand-500" />
                    <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">Kit Mapping</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggleTransparency(mapping)}
                      className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                        mapping.transparency_enrolled
                          ? "bg-blue-50 text-blue-700 hover:bg-blue-100"
                          : "bg-gray-100 text-gray-400 hover:bg-gray-200"
                      }`}
                    >
                      <ShieldCheck className="h-3.5 w-3.5" />
                      {mapping.transparency_enrolled ? "Transparency" : "No Transparency"}
                    </button>
                    <button
                      onClick={() => handleDelete(mapping.id)}
                      className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Two product cards — stacked on mobile, side by side on desktop */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-px bg-gray-100">
                  {/* Amazon FBA side */}
                  <div className="bg-white p-4">
                    <p className="text-[10px] font-semibold text-orange-600 uppercase tracking-wider mb-2">Amazon FBA</p>
                    <div className="flex items-center gap-3">
                      {product?.image_url ? (
                        <img
                          src={product.image_url}
                          alt=""
                          className="h-14 w-14 rounded-lg object-contain border border-gray-100 flex-shrink-0"
                        />
                      ) : (
                        <div className="h-14 w-14 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                          <Package className="h-6 w-6 text-gray-400" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-gray-900 text-sm leading-tight">
                          {product?.name || mapping.asin}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">{mapping.asin}</p>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center gap-3 text-xs">
                      {product && product.multiplier > 1 && (
                        <span className="inline-flex items-center rounded-md bg-orange-50 px-2 py-0.5 font-medium text-orange-700 ring-1 ring-inset ring-orange-200">
                          {product.multiplier}-Pack
                        </span>
                      )}
                      {product && product.multiplier === 1 && (
                        <span className="inline-flex items-center rounded-md bg-gray-50 px-2 py-0.5 font-medium text-gray-600 ring-1 ring-inset ring-gray-200">
                          Single
                        </span>
                      )}
                      {fba ? (
                        <span className={`font-medium ${fba.fulfillable > 0 ? "text-green-600" : "text-red-500"}`}>
                          {fba.fulfillable} fulfillable
                          {fba.inbound > 0 && (
                            <span className="text-blue-500 ml-1">+{fba.inbound} inbound</span>
                          )}
                        </span>
                      ) : (
                        <span className="text-gray-300">No snapshot</span>
                      )}
                    </div>
                  </div>

                  {/* Amplifier 3PL side */}
                  <div className="bg-white p-4">
                    <p className="text-[10px] font-semibold text-purple-600 uppercase tracking-wider mb-2">Amplifier 3PL</p>
                    <div className="flex items-center gap-3">
                      {tplProduct?.image_url ? (
                        <img
                          src={tplProduct.image_url}
                          alt=""
                          className="h-14 w-14 rounded-lg object-contain border border-gray-100 flex-shrink-0"
                        />
                      ) : (
                        <div className="h-14 w-14 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                          <Package className="h-6 w-6 text-gray-400" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-gray-900 text-sm leading-tight">
                          {tplProduct?.name || mapping.amplifier_kit_sku}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">{mapping.amplifier_kit_sku}</p>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center gap-3 text-xs">
                      {tplProduct && tplProduct.multiplier > 1 && (
                        <span className="inline-flex items-center rounded-md bg-purple-50 px-2 py-0.5 font-medium text-purple-700 ring-1 ring-inset ring-purple-200">
                          {tplProduct.multiplier}-Pack
                        </span>
                      )}
                      {tplProduct && tplProduct.multiplier === 1 && (
                        <span className="inline-flex items-center rounded-md bg-gray-50 px-2 py-0.5 font-medium text-gray-600 ring-1 ring-inset ring-gray-200">
                          Single
                        </span>
                      )}
                      {tpl ? (
                        <span className={`font-medium ${tpl.available > 0 ? "text-green-600" : "text-red-500"}`}>
                          {tpl.available} available
                          {tpl.on_hand !== tpl.available && (
                            <span className="text-gray-400 ml-1">({tpl.on_hand} on hand)</span>
                          )}
                        </span>
                      ) : (
                        <span className="text-gray-300">No snapshot</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center">
          <Link2 className="mx-auto h-10 w-10 text-gray-300 mb-3" />
          <p className="text-gray-500 font-medium">No mappings yet</p>
          <p className="text-sm text-gray-400 mt-1">
            Map Amazon ASINs to Amplifier kit SKUs to enable replenishment
          </p>
          <button
            onClick={() => setShowAddForm(true)}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            <Plus className="h-4 w-4" />
            Add First Mapping
          </button>
        </div>
      )}
    </div>
  );
}
