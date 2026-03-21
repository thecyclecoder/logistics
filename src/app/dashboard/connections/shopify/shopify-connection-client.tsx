"use client";

import {
  CheckCircle2,
  XCircle,
  Plug,
  ShoppingBag,
} from "lucide-react";

export default function ShopifyConnectionClient({
  initialConnected,
  storeDomain,
}: {
  initialConnected: boolean;
  storeDomain: string | null;
}) {
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
          <div className="mt-4 rounded-lg bg-gray-50 px-4 py-3">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-gray-500">Store domain:</span>
              <span className="font-mono text-gray-700">{storeDomain}</span>
            </div>
          </div>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-3">
          {!initialConnected && (
            <a
              href="/api/shopify/connect"
              className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 transition-colors"
            >
              <Plug className="h-4 w-4" />
              Connect Shopify
            </a>
          )}
        </div>

        {/* Placeholder for future Shopify review table */}
        {initialConnected && (
          <div className="mt-6 rounded-lg border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
            <p className="text-sm text-gray-400">
              Shopify review table coming soon
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
