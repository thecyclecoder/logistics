"use client";

import { useState } from "react";
import { RefreshCw, CheckCircle2, AlertTriangle } from "lucide-react";

export default function SyncButton() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    message: string;
    type: "success" | "warning" | "error";
  } | null>(null);

  const handleSync = async () => {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/sync/all", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        // Check for unmapped SKUs
        const unmappedRes = await fetch("/api/unmapped-skus");
        const unmapped = await unmappedRes.json();
        const unmappedCount = Array.isArray(unmapped) ? unmapped.length : 0;

        if (unmappedCount > 0) {
          setResult({
            message: `Inventory synced — ${unmappedCount} unmapped SKU${unmappedCount !== 1 ? "s" : ""} found. Map them to track inventory.`,
            type: "warning",
          });
        } else {
          setResult({
            message: "Inventory synced — all products mapped",
            type: "success",
          });
        }
      } else {
        setResult({ message: `Error: ${data.error}`, type: "error" });
      }
    } catch {
      setResult({ message: "Sync request failed", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="flex items-center gap-2">
        <button
          onClick={handleSync}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50 transition-colors"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          {loading ? "Syncing..." : "Sync Inventory"}
        </button>
      </div>
      {result && (
        <div className={`mt-2 flex items-center gap-1.5 text-sm ${
          result.type === "success"
            ? "text-green-700"
            : result.type === "warning"
              ? "text-amber-700"
              : "text-red-700"
        }`}>
          {result.type === "success" ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <AlertTriangle className="h-4 w-4" />
          )}
          {result.message}
        </div>
      )}
    </div>
  );
}
