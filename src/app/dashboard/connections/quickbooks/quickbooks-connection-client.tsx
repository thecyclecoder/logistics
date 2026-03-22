"use client";

import { useState, useEffect } from "react";
import {
  CheckCircle2,
  XCircle,
  RefreshCw,
  AlertTriangle,
  BookOpen,
  Plug,
  ExternalLink,
  Unplug,
  Settings2,
} from "lucide-react";

interface QBOption {
  id: string;
  name: string;
  type?: string;
}

interface MappingDef {
  label: string;
  description: string;
  entityType: "account" | "customer";
  accountFilter?: string;
}

interface MappingState {
  definitions: Record<string, MappingDef>;
  options: {
    expense_accounts: QBOption[];
    asset_accounts: QBOption[];
    customers: QBOption[];
  };
  current: Record<string, { qb_id: string; qb_name: string }>;
}

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
  const [syncResult, setSyncResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [mappingData, setMappingData] = useState<MappingState | null>(null);
  const [mappingLoading, setMappingLoading] = useState(false);
  const [savingMapping, setSavingMapping] = useState<string | null>(null);

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch("/api/sync/quickbooks", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        const r = data.results[0];
        if (r.status === "success") {
          setSyncResult({ ok: true, message: `QuickBooks synced: ${r.records} products updated` });
        } else {
          setSyncResult({ ok: false, message: `QB sync error: ${r.error}` });
        }
      } else {
        setSyncResult({ ok: false, message: `Error: ${data.error}` });
      }
    } catch {
      setSyncResult({ ok: false, message: "QB sync request failed" });
    } finally {
      setSyncing(false);
    }
  };

  const loadMappings = async () => {
    setMappingLoading(true);
    try {
      const res = await fetch("/api/qb/account-mappings");
      const data = await res.json();
      if (res.ok) setMappingData(data);
    } catch {
      // ignore
    } finally {
      setMappingLoading(false);
    }
  };

  useEffect(() => {
    if (initialConnected) loadMappings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialConnected]);

  const getOptionsForKey = (key: string): QBOption[] => {
    if (!mappingData) return [];
    const def = mappingData.definitions[key];
    if (!def) return [];
    if (def.entityType === "customer") return mappingData.options.customers;
    if (def.accountFilter === "Expense") return mappingData.options.expense_accounts;
    return mappingData.options.asset_accounts;
  };

  const handleSaveMapping = async (key: string, qbId: string) => {
    const options = getOptionsForKey(key);
    const selected = options.find((o) => o.id === qbId);
    if (!selected) return;
    setSavingMapping(key);
    try {
      const res = await fetch("/api/qb/account-mappings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, qb_id: qbId, qb_name: selected.name }),
      });
      if (res.ok && mappingData) {
        setMappingData({
          ...mappingData,
          current: {
            ...mappingData.current,
            [key]: { qb_id: qbId, qb_name: selected.name },
          },
        });
      }
    } catch {
      // ignore
    } finally {
      setSavingMapping(null);
    }
  };

  return (
    <div className="space-y-8">
      {/* Connection Status */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100">
              <BookOpen className="h-5 w-5 text-gray-600" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">QuickBooks</h1>
              <p className="text-sm text-gray-500 mt-0.5">Accounting, products, and sales data</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {initialConnected ? (
              <>
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span className="text-sm font-medium text-green-700">Connected</span>
              </>
            ) : (
              <>
                <XCircle className="h-4 w-4 text-red-400" />
                <span className="text-sm font-medium text-red-600">Not connected</span>
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
                <span className="text-gray-700">{new Date(lastRefresh).toLocaleString()}</span>
              </div>
            )}
          </div>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-3">
          {!initialConnected ? (
            <a href="/api/qb/connect" className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 transition-colors">
              <Plug className="h-4 w-4" /> Connect QuickBooks
            </a>
          ) : (
            <>
              <button onClick={handleSync} disabled={syncing}
                className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50 transition-colors">
                <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
                {syncing ? "Syncing..." : "Sync QuickBooks"}
              </button>
              <a href="/api/qb/connect" className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                <ExternalLink className="h-4 w-4" /> Reconnect
              </a>
              <button
                onClick={async () => {
                  if (confirm("Disconnect QuickBooks? You will need to re-authorize.")) {
                    await fetch("/api/qb/disconnect", { method: "POST" });
                    window.location.reload();
                  }
                }}
                className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors">
                <Unplug className="h-4 w-4" /> Disconnect
              </button>
            </>
          )}
        </div>

        {syncResult && (
          <div className={`mt-3 flex items-center gap-1.5 text-sm ${syncResult.ok ? "text-green-700" : "text-red-700"}`}>
            {syncResult.ok ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
            {syncResult.message}
          </div>
        )}
      </div>

      {/* Account Mappings */}
      {initialConnected && (
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Settings2 className="h-5 w-5 text-gray-600" />
              <h2 className="text-lg font-semibold text-gray-900">Account Mappings</h2>
            </div>
            <button
              onClick={loadMappings}
              disabled={mappingLoading}
              className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${mappingLoading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
          <p className="text-sm text-gray-500 mb-5">
            Map QuickBooks accounts and customers used in month-end closing and sales receipts.
          </p>

          {mappingLoading && !mappingData ? (
            <div className="flex items-center gap-2 text-sm text-gray-400 py-4">
              <RefreshCw className="h-4 w-4 animate-spin" /> Loading QB accounts...
            </div>
          ) : mappingData ? (
            <div className="rounded-xl border border-gray-200 bg-white">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr className="border-b border-gray-200">
                    <th className="px-4 py-3 text-left font-medium text-gray-500">Setting</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">QuickBooks Account / Customer</th>
                    <th className="px-4 py-3 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {Object.entries(mappingData.definitions).map(([key, def]) => {
                    const current = mappingData.current[key];
                    const options = getOptionsForKey(key);

                    return (
                      <tr key={key} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900">{def.label}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{def.description}</p>
                        </td>
                        <td className="px-4 py-3">
                          <div className="relative">
                            <select
                              value={current?.qb_id || ""}
                              onChange={(e) => {
                                if (e.target.value) handleSaveMapping(key, e.target.value);
                              }}
                              disabled={savingMapping === key}
                              className={`w-full rounded-lg border px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 ${
                                current
                                  ? "border-green-300 bg-green-50 text-green-800"
                                  : "border-amber-300 bg-amber-50 text-amber-800"
                              }`}
                            >
                              <option value="">
                                {def.entityType === "customer" ? "— Select customer —" : "— Select account —"}
                              </option>
                              {options.map((o) => (
                                <option key={o.id} value={o.id}>
                                  {o.name}{o.type ? ` (${o.type})` : ""}
                                </option>
                              ))}
                            </select>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {current ? (
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                          ) : (
                            <AlertTriangle className="h-4 w-4 text-amber-400" />
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
