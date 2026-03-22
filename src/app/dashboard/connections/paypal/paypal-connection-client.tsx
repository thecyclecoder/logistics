"use client";

import { useState } from "react";
import {
  CheckCircle2,
  XCircle,
  RefreshCw,
  AlertTriangle,
  Wallet,
  Save,
} from "lucide-react";

export default function PayPalConnectionClient({
  initialConnected,
  initialClientId,
  initialEnvironment,
}: {
  initialConnected: boolean;
  initialClientId: string;
  initialEnvironment: string;
}) {
  const [connected, setConnected] = useState(initialConnected);
  const [clientId, setClientId] = useState(initialClientId);
  const [clientSecret, setClientSecret] = useState("");
  const [environment, setEnvironment] = useState(initialEnvironment);
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<{ ok: boolean; message: string } | null>(null);

  const handleSave = async () => {
    if (!clientId || !clientSecret) {
      setSaveResult({ ok: false, message: "Client ID and Secret are required" });
      return;
    }
    setSaving(true);
    setSaveResult(null);
    try {
      const res = await fetch("/api/connections/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          integration: "paypal",
          credentials: { client_id: clientId, client_secret: clientSecret, environment },
        }),
      });
      if (res.ok) {
        setSaveResult({ ok: true, message: "PayPal credentials saved" });
        setConnected(true);
        setClientSecret("");
      } else {
        const data = await res.json();
        setSaveResult({ ok: false, message: data.error || "Failed to save" });
      }
    } catch {
      setSaveResult({ ok: false, message: "Request failed" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100">
              <Wallet className="h-5 w-5 text-gray-600" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">PayPal</h1>
              <p className="text-sm text-gray-500 mt-0.5">Payment processing — transactions, fees, refunds</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {connected ? (
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

        {connected && (
          <div className="mt-4 rounded-lg bg-gray-50 px-4 py-3">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-gray-500">Client ID:</span>
              <span className="font-mono text-gray-700 text-xs">{clientId.substring(0, 20)}...</span>
            </div>
          </div>
        )}

        <div className="mt-6 space-y-4 max-w-md">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Client ID</label>
            <input
              type="text"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              placeholder="PayPal REST API Client ID"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm placeholder-gray-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Client Secret</label>
            <input
              type="password"
              value={clientSecret}
              onChange={(e) => setClientSecret(e.target.value)}
              placeholder={connected ? "••••••••" : "PayPal REST API Secret"}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm placeholder-gray-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Environment</label>
            <select
              value={environment}
              onChange={(e) => setEnvironment(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              <option value="production">Production</option>
              <option value="sandbox">Sandbox</option>
            </select>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50 transition-colors"
          >
            {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? "Saving..." : "Save Credentials"}
          </button>
        </div>

        {saveResult && (
          <div className={`mt-3 flex items-center gap-1.5 text-sm ${saveResult.ok ? "text-green-700" : "text-red-700"}`}>
            {saveResult.ok ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
            {saveResult.message}
          </div>
        )}
      </div>
    </div>
  );
}
