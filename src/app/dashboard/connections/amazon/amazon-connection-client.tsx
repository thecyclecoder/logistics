"use client";

import { useState } from "react";
import {
  CheckCircle2,
  XCircle,
  RefreshCw,
  AlertTriangle,
  Plug,
} from "lucide-react";
import AmazonReviewClient from "@/components/amazon-review-client";

export default function AmazonConnectionClient({
  initialConnected,
}: {
  initialConnected: boolean;
}) {
  const [testing, setTesting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncingSales, setSyncingSales] = useState(false);
  const [syncVersion, setSyncVersion] = useState(0);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);
  const [syncResult, setSyncResult] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/connections/test/amazon");
      const data = await res.json();
      if (res.ok && data.connected) {
        setTestResult({ ok: true, message: "Amazon SP-API connected" });
      } else {
        setTestResult({
          ok: false,
          message: data.error || "Connection test failed",
        });
      }
    } catch {
      setTestResult({ ok: false, message: "Request failed" });
    } finally {
      setTesting(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch("/api/sync/amazon-inventory", { method: "POST" });
      const data = await res.json();
      if (res.ok && data.status === "success") {
        setSyncResult({
          ok: true,
          message: `Synced ${data.records} inventory records`,
        });
      } else {
        setSyncResult({
          ok: false,
          message: data.error || "Sync failed",
        });
      }
    } catch {
      setSyncResult({ ok: false, message: "Sync request failed" });
    } finally {
      setSyncing(false);
      setSyncVersion((v) => v + 1);
    }
  };

  const handleSyncSales = async () => {
    setSyncingSales(true);
    setSyncResult(null);
    try {
      const res = await fetch("/api/sync/amazon-sales", { method: "POST" });
      const data = await res.json();
      if (res.ok && data.status === "success") {
        setSyncResult({
          ok: true,
          message: `Sales snapshot: ${data.records} ASIN-days captured`,
        });
      } else {
        setSyncResult({
          ok: false,
          message: data.error || "Sales sync failed",
        });
      }
    } catch {
      setSyncResult({ ok: false, message: "Sales sync request failed" });
    } finally {
      setSyncingSales(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Connection Status */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100">
              <Plug className="h-5 w-5 text-gray-600" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Amazon</h1>
              <p className="text-sm text-gray-500 mt-0.5">
                Amazon Seller Central via SP-API
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

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            onClick={handleTest}
            disabled={testing}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            <RefreshCw
              className={`h-4 w-4 ${testing ? "animate-spin" : ""}`}
            />
            {testing ? "Testing..." : "Test Connection"}
          </button>
          <button
            onClick={handleSync}
            disabled={syncing || !initialConnected}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50 transition-colors"
          >
            <RefreshCw
              className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`}
            />
            {syncing ? "Syncing..." : "Sync Amazon Inventory"}
          </button>
          <button
            onClick={handleSyncSales}
            disabled={syncingSales || !initialConnected}
            className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50 transition-colors"
          >
            <RefreshCw
              className={`h-4 w-4 ${syncingSales ? "animate-spin" : ""}`}
            />
            {syncingSales ? "Syncing..." : "Sync Sales (Last 7 Days)"}
          </button>
        </div>

        {testResult && (
          <div
            className={`mt-3 flex items-center gap-1.5 text-sm ${
              testResult.ok ? "text-green-700" : "text-red-700"
            }`}
          >
            {testResult.ok ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <AlertTriangle className="h-4 w-4" />
            )}
            {testResult.message}
          </div>
        )}

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

      {/* Amazon Review Table */}
      <AmazonReviewClient key={syncVersion} />
    </div>
  );
}
