"use client";

import { useState } from "react";
import { RefreshCw, BookOpen } from "lucide-react";

export default function SyncButton() {
  const [loading, setLoading] = useState(false);
  const [qbLoading, setQbLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const handleSync = async () => {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/sync/all", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        const successes = data.results.filter(
          (r: { status: string }) => r.status === "success"
        ).length;
        setResult(`Sync complete: ${successes}/${data.results.length} jobs succeeded`);
      } else {
        setResult(`Error: ${data.error}`);
      }
    } catch {
      setResult("Sync request failed");
    } finally {
      setLoading(false);
    }
  };

  const handleQBSync = async () => {
    setQbLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/sync/quickbooks", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        const r = data.results[0];
        setResult(
          r.status === "success"
            ? `QuickBooks synced: ${r.records} products updated`
            : `QB sync error: ${r.error}`
        );
      } else {
        setResult(`Error: ${data.error}`);
      }
    } catch {
      setResult("QB sync request failed");
    } finally {
      setQbLoading(false);
    }
  };

  const anyLoading = loading || qbLoading;

  return (
    <div>
      <div className="flex items-center gap-2">
        <button
          onClick={handleSync}
          disabled={anyLoading}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50 transition-colors"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          {loading ? "Syncing..." : "Sync Now"}
        </button>
        <button
          onClick={handleQBSync}
          disabled={anyLoading}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
        >
          <BookOpen className={`h-4 w-4 ${qbLoading ? "animate-spin" : ""}`} />
          {qbLoading ? "Syncing QB..." : "Sync QuickBooks"}
        </button>
      </div>
      {result && (
        <p className="mt-2 text-sm text-gray-600">{result}</p>
      )}
    </div>
  );
}
