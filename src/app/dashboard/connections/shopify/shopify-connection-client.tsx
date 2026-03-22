"use client";

import { useState, useEffect } from "react";
import {
  CheckCircle2,
  XCircle,
  Plug,
  ShoppingBag,
  RefreshCw,
  CreditCard,
  Shield,
  Trash2,
} from "lucide-react";
import ShopifyReviewClient from "@/components/shopify-review-client";

interface GatewayMapping {
  gateway_name: string;
  processor: string;
}

interface ProcessorOption {
  value: string;
  label: string;
}

export default function ShopifyConnectionClient({
  initialConnected,
  storeDomain,
  lastRefresh,
}: {
  initialConnected: boolean;
  storeDomain: string | null;
  lastRefresh: string | null;
}) {
  const [syncing, setSyncing] = useState(false);
  const [syncVersion, setSyncVersion] = useState(0);
  const [syncResult, setSyncResult] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);
  const [gatewayMappings, setGatewayMappings] = useState<GatewayMapping[]>([]);
  const [processorOptions, setProcessorOptions] = useState<ProcessorOption[]>([]);
  const [savingGateway, setSavingGateway] = useState<string | null>(null);
  const [newGateway, setNewGateway] = useState("");
  const [shippingProducts, setShippingProducts] = useState<Array<{ shopify_product_id: string; title: string }>>([]);
  const [allShopifyProducts, setAllShopifyProducts] = useState<Array<{ id: string; title: string }>>([]);
  const [addingShipping, setAddingShipping] = useState(false);

  useEffect(() => {
    if (initialConnected) {
      fetch("/api/gateway-mappings")
        .then((r) => r.json())
        .then((data) => {
          if (data.mappings) setGatewayMappings(data.mappings);
          if (data.processor_options) setProcessorOptions(data.processor_options);
        })
        .catch(() => {});
      fetch("/api/shipping-protection")
        .then((r) => r.json())
        .then((data) => {
          if (data.flagged) setShippingProducts(data.flagged);
          if (data.shopify_products) setAllShopifyProducts(data.shopify_products);
        })
        .catch(() => {});
    }
  }, [initialConnected]);

  const handleGatewayChange = async (gatewayName: string, processor: string) => {
    setSavingGateway(gatewayName);
    try {
      const res = await fetch("/api/gateway-mappings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gateway_name: gatewayName, processor }),
      });
      if (res.ok) {
        setGatewayMappings((prev) =>
          prev.map((m) => m.gateway_name === gatewayName ? { ...m, processor } : m)
        );
      }
    } catch {} finally {
      setSavingGateway(null);
    }
  };

  const handleAddGateway = async (processor: string) => {
    if (!newGateway.trim()) return;
    setSavingGateway(newGateway);
    try {
      const res = await fetch("/api/gateway-mappings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gateway_name: newGateway.trim(), processor }),
      });
      if (res.ok) {
        setGatewayMappings((prev) => [...prev, { gateway_name: newGateway.trim(), processor }]);
        setNewGateway("");
      }
    } catch {} finally {
      setSavingGateway(null);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch("/api/sync/shopify-products", { method: "POST" });
      const data = await res.json();
      if (res.ok && data.status === "success") {
        setSyncResult({
          message: `Synced ${data.records} Shopify products`,
          type: "success",
        });
      } else {
        setSyncResult({
          message: data.error || "Sync failed",
          type: "error",
        });
      }
    } catch {
      setSyncResult({ message: "Sync request failed", type: "error" });
    } finally {
      setSyncing(false);
      setSyncVersion((v) => v + 1);
    }
  };

  return (
    <div className="space-y-8">
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100">
              <ShoppingBag className="h-5 w-5 text-gray-600" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Shopify</h1>
              <p className="text-sm text-gray-500 mt-0.5">
                Storefront and order management
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {initialConnected ? (
              <>
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span className="text-sm font-medium text-green-700">
                  Connected
                </span>
              </>
            ) : (
              <>
                <XCircle className="h-4 w-4 text-red-400" />
                <span className="text-sm font-medium text-red-600">
                  Not connected
                </span>
              </>
            )}
          </div>
        </div>

        {initialConnected && storeDomain && (
          <div className="mt-4 rounded-lg bg-gray-50 px-4 py-3 space-y-1">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-gray-500">Store domain:</span>
              <span className="font-mono text-gray-700">{storeDomain}</span>
            </div>
            {lastRefresh && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-500">Connected:</span>
                <span className="text-gray-700">
                  {new Date(lastRefresh).toLocaleString()}
                </span>
              </div>
            )}
          </div>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-3">
          {!initialConnected ? (
            <a
              href="/api/shopify/connect"
              className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 transition-colors"
            >
              <Plug className="h-4 w-4" />
              Connect Shopify
            </a>
          ) : (
            <>
              <button
                onClick={handleSync}
                disabled={syncing}
                className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50 transition-colors"
              >
                <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
                {syncing ? "Syncing..." : "Sync Products"}
              </button>
              <a
                href="/api/shopify/connect"
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Reconnect
              </a>
            </>
          )}
        </div>

        {syncResult && (
          <div className={`mt-3 flex items-center gap-1.5 text-sm ${
            syncResult.type === "success" ? "text-green-700" : "text-red-700"
          }`}>
            {syncResult.type === "success" ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <XCircle className="h-4 w-4" />
            )}
            {syncResult.message}
          </div>
        )}
      </div>

      {/* Shipping Protection Products */}
      {initialConnected && (
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="h-5 w-5 text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-900">Shipping Protection Products</h2>
          </div>
          <p className="text-sm text-gray-500 mb-4">
            Revenue from these Shopify products will be categorized as shipping income in journal entries.
          </p>

          <div className="space-y-2 mb-4">
            {shippingProducts.map((sp) => (
              <div key={sp.shopify_product_id} className="flex items-center justify-between rounded-lg bg-gray-50 px-4 py-2.5">
                <div>
                  <p className="text-sm font-medium text-gray-900">{sp.title}</p>
                  <p className="text-xs text-gray-400 font-mono">Product ID: {sp.shopify_product_id}</p>
                </div>
                <button
                  onClick={async () => {
                    await fetch("/api/shipping-protection", {
                      method: "DELETE",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ shopify_product_id: sp.shopify_product_id }),
                    });
                    setShippingProducts((prev) => prev.filter((p) => p.shopify_product_id !== sp.shopify_product_id));
                  }}
                  className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <select
              disabled={addingShipping}
              onChange={async (e) => {
                const productId = e.target.value;
                if (!productId) return;
                const product = allShopifyProducts.find((p) => p.id === productId);
                setAddingShipping(true);
                const res = await fetch("/api/shipping-protection", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ shopify_product_id: productId, title: product?.title || "Unknown" }),
                });
                if (res.ok) {
                  setShippingProducts((prev) => [...prev, { shopify_product_id: productId, title: product?.title || "Unknown" }]);
                }
                setAddingShipping(false);
                e.target.value = "";
              }}
              className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              <option value="">Add a product...</option>
              {allShopifyProducts
                .filter((p) => !shippingProducts.some((sp) => sp.shopify_product_id === p.id))
                .map((p) => (
                  <option key={p.id} value={p.id}>{p.title}</option>
                ))}
            </select>
          </div>
        </div>
      )}

      {/* Payment Gateway Mapping */}
      {initialConnected && gatewayMappings.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <div className="flex items-center gap-2 mb-2">
            <CreditCard className="h-5 w-5 text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-900">Payment Gateway Mapping</h2>
          </div>
          <p className="text-sm text-gray-500 mb-4">
            Map Shopify payment gateway names to processor categories for journal entries.
          </p>

          <div className="rounded-xl border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr className="border-b border-gray-200">
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Gateway Name</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Processor Category</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {gatewayMappings.map((m) => (
                  <tr key={m.gateway_name} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <span className="font-mono text-gray-900">{m.gateway_name}</span>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={m.processor}
                        onChange={(e) => handleGatewayChange(m.gateway_name, e.target.value)}
                        disabled={savingGateway === m.gateway_name}
                        className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                      >
                        {processorOptions.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
                <tr className="bg-gray-50">
                  <td className="px-4 py-3">
                    <input
                      type="text"
                      value={newGateway}
                      onChange={(e) => setNewGateway(e.target.value)}
                      placeholder="Add gateway name..."
                      className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-mono placeholder-gray-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 w-full"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <select
                      disabled={!newGateway.trim() || !!savingGateway}
                      onChange={(e) => { if (e.target.value) handleAddGateway(e.target.value); e.target.value = ""; }}
                      className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                    >
                      <option value="">— Add —</option>
                      {processorOptions.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {initialConnected && <ShopifyReviewClient key={syncVersion} />}
    </div>
  );
}
