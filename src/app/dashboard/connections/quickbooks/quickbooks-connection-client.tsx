"use client";

import { useState } from "react";
import {
  CheckCircle2,
  XCircle,
  RefreshCw,
  AlertTriangle,
  BookOpen,
  Plug,
  ExternalLink,
  Unplug,
} from "lucide-react";

export default function QuickBooksConnectionClient({
  initialConnected,
  realmId,
  lastRefresh,
}: {
  initialConnected: boolean;
  realmId: string | null;
  lastRefresh: string | null;
}) {
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch("/api/sync/quickbooks", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        const r = data.results[0];
        if (r.status === "success") {
          setSyncResult({
            ok: true,
            message: `QuickBooks synced: ${r.records} products updated`,
          });
        } else {
          setSyncResult({
            ok: false,
            message: `QB sync error: ${r.error}`,
          });
        }
      } else {
        setSyncResult({
          ok: false,
          message: `Error: ${data.error}`,
        });
      }
    } catch {
      setSyncResult({ ok: false, message: "QB sync request failed" });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100">
              <BookOpen className="h-5 w-5 text-gray-600" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">
                QuickBooks
              </h1>
              <p className="text-sm text-gray-500 mt-0.5">
                Accounting, products, and sales data
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

        {initialConnected && (
          <div className="mt-4 rounded-lg bg-gray-50 px-4 py-3 space-y-1.5">
            {realmId && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-500">Realm ID:</span>
                <span className="font-mono text-gray-700">{realmId}</span>
              </div>
            )}
            {lastRefresh && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-500">Last token refresh:</span>
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
              href="/api/qb/connect"
              className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 transition-colors"
            >
              <Plug className="h-4 w-4" />
              Connect QuickBooks
            </a>
          ) : (
            <>
              <button
                onClick={handleSync}
                disabled={syncing}
                className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50 transition-colors"
              >
                <RefreshCw
                  className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`}
                />
                {syncing ? "Syncing..." : "Sync QuickBooks"}
              </button>
              <a
                href="/api/qb/connect"
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <ExternalLink className="h-4 w-4" />
                Reconnect
              </a>
              <a
                href="/api/qb/disconnect"
                className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
              >
                <Unplug className="h-4 w-4" />
                Disconnect
              </a>
            </>
          )}
        </div>

        {syncResult && (
          <div
            className={`mt-3 flex items-center gap-1.5 text-sm ${
              syncResult.ok ? "text-green-700" : "text-red-700"
            }`}
          >
            {syncResult.ok ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <AlertTriangle className="h-4 w-4" />
            )}
            {syncResult.message}
          </div>
        )}
      </div>
    </div>
  );
}
