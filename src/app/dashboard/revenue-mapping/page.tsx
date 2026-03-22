"use client";

import { useEffect, useState, useMemo } from "react";
import { RefreshCw, Search, CheckCircle2, AlertCircle } from "lucide-react";
import SearchableSelect from "@/components/searchable-select";

interface Account {
  id: string;
  name: string;
  subtype: string;
}

interface Product {
  id: string;
  quickbooks_name: string;
  revenue_account_id: string | null;
  revenue_account_name: string | null;
  item_type: string;
  product_category: string | null;
  bundle_id: string | null;
}

export default function RevenueMappingPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/qb/revenue-accounts")
      .then((r) => r.json())
      .then((data) => {
        if (data.accounts) setAccounts(data.accounts);
        if (data.products) setProducts(data.products);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Only show FG products (bundles + standalone FG, not components)
  const finishedGoods = useMemo(() => {
    return products.filter((p) => {
      if (p.product_category === "component") return false;
      if (p.bundle_id && p.item_type === "inventory") return false; // BOM child
      return true;
    });
  }, [products]);

  const filtered = useMemo(() => {
    if (!search) return finishedGoods;
    const q = search.toLowerCase();
    return finishedGoods.filter((p) => p.quickbooks_name.toLowerCase().includes(q));
  }, [finishedGoods, search]);

  const mappedCount = finishedGoods.filter((p) => p.revenue_account_id).length;
  const unmappedCount = finishedGoods.length - mappedCount;

  const handleAssign = async (productId: string, accountId: string) => {
    const account = accounts.find((a) => a.id === accountId);
    if (!account) return;

    setSaving(productId);
    const res = await fetch(`/api/products/${productId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        revenue_account_id: accountId,
        revenue_account_name: account.name,
      }),
    });
    if (res.ok) {
      setProducts((prev) =>
        prev.map((p) =>
          p.id === productId
            ? { ...p, revenue_account_id: accountId, revenue_account_name: account.name }
            : p
        )
      );
    }
    setSaving(null);
  };

  const handleClear = async (productId: string) => {
    setSaving(productId);
    const res = await fetch(`/api/products/${productId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ revenue_account_id: null, revenue_account_name: null }),
    });
    if (res.ok) {
      setProducts((prev) =>
        prev.map((p) =>
          p.id === productId ? { ...p, revenue_account_id: null, revenue_account_name: null } : p
        )
      );
    }
    setSaving(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-400">
        <RefreshCw className="h-5 w-5 animate-spin mr-2" /> Loading revenue accounts...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Revenue Mapping</h1>
        <p className="text-sm text-gray-500 mt-1">
          Assign QuickBooks revenue accounts to finished goods for journal entries.
        </p>
      </div>

      {/* Summary */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5 text-sm">
          <CheckCircle2 className="h-4 w-4 text-green-500" />
          <span className="text-green-700 font-medium">{mappedCount} mapped</span>
        </div>
        {unmappedCount > 0 && (
          <div className="flex items-center gap-1.5 text-sm">
            <AlertCircle className="h-4 w-4 text-amber-500" />
            <span className="text-amber-700 font-medium">{unmappedCount} unmapped</span>
          </div>
        )}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Filter products..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border border-gray-300 bg-white pl-9 pr-3 py-2 text-sm placeholder-gray-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
      </div>

      {/* Table */}
      <div className="rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-gray-50 shadow-sm">
            <tr className="border-b border-gray-200">
              <th className="px-4 py-3 text-left font-medium text-gray-500">Product</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Type</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Revenue Account</th>
              <th className="px-4 py-3 w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map((product) => (
              <tr key={product.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-900">{product.quickbooks_name}</p>
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    product.item_type === "bundle" ? "bg-brand-50 text-brand-700" : "bg-emerald-50 text-emerald-700"
                  }`}>
                    {product.item_type === "bundle" ? "FG with BOM" : "FG no BOM"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <SearchableSelect
                    options={accounts.map((a) => ({ id: a.id, name: a.name }))}
                    value={product.revenue_account_id || ""}
                    onChange={(id) => {
                      if (id) {
                        handleAssign(product.id, id);
                      } else {
                        handleClear(product.id);
                      }
                    }}
                    placeholder="— Select revenue account —"
                    disabled={saving === product.id}
                  />
                </td>
                <td className="px-4 py-3">
                  {product.revenue_account_id ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-amber-400" />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
