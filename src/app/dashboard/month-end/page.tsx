"use client";

import { useState, useEffect } from "react";
import { CheckCircle2, XCircle, Loader2, AlertTriangle, Lock, SkipForward, FileText, RefreshCw, Save, ChevronDown, ChevronUp } from "lucide-react";

interface StepResult {
  step: number;
  name: string;
  status: "success" | "error" | "skipped";
  message: string;
  details?: unknown;
}

interface Closing {
  id: string;
  closing_month: string;
  status: string;
  completed_at: string | null;
  shopify_journal_entry_id?: string | null;
  shopify_journal_entry_doc?: string | null;
}

interface JELine {
  postingType: "Debit" | "Credit";
  accountName: string;
  amount: number;
  description: string;
}

interface JEPreview {
  month: string;
  lines: JELine[];
  warnings: string[];
  summary: {
    order_count: number;
    unmapped_revenue: number;
    total_debits: number;
    total_credits: number;
    processors: Record<string, { gross: number; fees: number; refunds: number; chargebacks: number }>;
  };
}

const STEPS = [
  "QB Inventory Snapshot (Pre-Closing)",
  "Inventory Adjustment",
  "Amazon Sales Receipt",
  "Shopify Sales Receipt",
  "QB Inventory Snapshot (Post-Closing)",
  "Variance Check",
  "Shopify Journal Entry",
];

export default function MonthEndPage() {
  const [month, setMonth] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [running, setRunning] = useState(false);
  const [steps, setSteps] = useState<StepResult[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pastClosings, setPastClosings] = useState<Closing[]>([]);
  const [isDebug, setIsDebug] = useState(false);
  const [jePreview, setJePreview] = useState<JEPreview | null>(null);
  const [jeLoading, setJeLoading] = useState(false);
  const [jeExpanded, setJeExpanded] = useState(false);
  const [btFeesOverride, setBtFeesOverride] = useState("");
  const [jeUpdating, setJeUpdating] = useState(false);
  const [jeUpdateResult, setJeUpdateResult] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    setIsDebug(window.location.search.includes("debug=true"));
    // Load past closings
    fetch("/api/qb/month-end-closing/history")
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d)) setPastClosings(d); })
      .catch(() => {});
  }, []);

  const canRun = () => {
    const [yr, mo] = month.split("-").map(Number);
    const nextMonth = new Date(yr, mo, 1);
    return isDebug || new Date() >= nextMonth;
  };

  const alreadyRun = pastClosings.some((c) => c.closing_month === month && c.status === "completed");

  const handleRun = async () => {
    if (!confirm(`Run month-end closing for ${month}? This will create entries in QuickBooks.`)) return;

    setRunning(true);
    setSteps([]);
    setCurrentStep(0);
    setError(null);

    // Show steps being processed
    const interval = setInterval(() => {
      setCurrentStep((prev) => Math.min(prev + 1, 7));
    }, 8000);

    try {
      const debugParam = isDebug ? "?debug=true" : "";
      const res = await fetch(`/api/qb/month-end-closing${debugParam}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month }),
      });
      const data = await res.json();

      clearInterval(interval);

      if (data.steps) {
        setSteps(data.steps);
        setCurrentStep(8);
      }
      if (data.error && !data.steps) {
        setError(data.error);
      }
    } catch {
      clearInterval(interval);
      setError("Request failed");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Month-End Closing</h1>
        <p className="text-sm text-gray-500 mt-1">
          Run the full closing sequence: snapshot → adjustment → sales receipts → verify → journal entry.
        </p>
      </div>

      {/* Month selector */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="flex items-end gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Closing Month</label>
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              disabled={running}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
          <button
            onClick={handleRun}
            disabled={running || (!canRun() && !isDebug) || alreadyRun}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-6 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50 transition-colors"
          >
            {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            {running ? "Running..." : "Run Month-End Closing"}
          </button>
        </div>

        {!canRun() && !isDebug && (
          <div className="mt-3 flex items-center gap-2 text-sm text-amber-700">
            <Lock className="h-4 w-4" />
            Available after the 1st of the following month
          </div>
        )}

        {alreadyRun && (
          <div className="mt-3 flex items-center gap-2 text-sm text-green-700">
            <CheckCircle2 className="h-4 w-4" />
            Closing already completed for {month}. Delete QB entries to re-run.
          </div>
        )}

        {isDebug && (
          <div className="mt-3 flex items-center gap-2 text-xs text-purple-600">
            <AlertTriangle className="h-3.5 w-3.5" />
            Debug mode — date restriction bypassed
          </div>
        )}

        {error && (
          <div className="mt-3 flex items-center gap-2 text-sm text-red-700">
            <XCircle className="h-4 w-4" />
            {error}
          </div>
        )}
      </div>

      {/* Checklist */}
      {(running || steps.length > 0) && (
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Closing Steps</h2>
          <div className="space-y-3">
            {STEPS.map((stepName, idx) => {
              const stepNum = idx + 1;
              const result = steps.find((s) => s.step === stepNum);
              const isActive = running && !result && currentStep >= idx;

              return (
                <div key={stepNum} className="flex items-start gap-3">
                  <div className="mt-0.5">
                    {result ? (
                      result.status === "success" ? (
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                      ) : result.status === "skipped" ? (
                        <SkipForward className="h-5 w-5 text-gray-400" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-500" />
                      )
                    ) : isActive ? (
                      <Loader2 className="h-5 w-5 text-brand-500 animate-spin" />
                    ) : (
                      <div className="h-5 w-5 rounded-full border-2 border-gray-200" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className={`text-sm font-medium ${
                      result
                        ? result.status === "success" ? "text-green-800"
                          : result.status === "skipped" ? "text-gray-500"
                            : "text-red-800"
                        : isActive ? "text-brand-700" : "text-gray-400"
                    }`}>
                      Step {stepNum}: {stepName}
                    </p>
                    {result && (
                      <p className={`text-xs mt-0.5 ${
                        result.status === "success" ? "text-green-600"
                          : result.status === "skipped" ? "text-gray-400"
                            : "text-red-600"
                      }`}>
                        {result.message}
                      </p>
                    )}
                    {isActive && !result && (
                      <p className="text-xs mt-0.5 text-brand-500">Processing...</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {steps.length > 0 && !running && (
            <div className={`mt-6 rounded-lg px-4 py-3 ${
              steps.every((s) => s.status === "success" || s.status === "skipped")
                ? "bg-green-50 border border-green-200"
                : "bg-amber-50 border border-amber-200"
            }`}>
              <p className={`text-sm font-medium ${
                steps.every((s) => s.status === "success" || s.status === "skipped")
                  ? "text-green-800" : "text-amber-800"
              }`}>
                {steps.every((s) => s.status === "success" || s.status === "skipped")
                  ? "Month-end closing completed successfully!"
                  : "Closing completed with some issues — review the steps above."}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Journal Entry Preview / Edit */}
      {(alreadyRun || steps.some((s) => s.step === 7)) && (
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-gray-600" />
              <h2 className="text-base font-semibold text-gray-900">Shopify Journal Entry</h2>
              {pastClosings.find((c) => c.closing_month === month)?.shopify_journal_entry_doc && (
                <span className="text-xs font-mono text-gray-500 bg-gray-100 rounded px-2 py-0.5">
                  {pastClosings.find((c) => c.closing_month === month)?.shopify_journal_entry_doc}
                </span>
              )}
            </div>
            <button
              onClick={async () => {
                setJeLoading(true);
                try {
                  const res = await fetch(`/api/qb/journal-entry?month=${month}`);
                  const data = await res.json();
                  if (res.ok) {
                    setJePreview(data);
                    // Pre-fill BT fees from current data
                    const btFees = data.summary?.processors?.braintree?.fees;
                    if (btFees) setBtFeesOverride(String(btFees));
                  }
                } catch {} finally { setJeLoading(false); }
              }}
              disabled={jeLoading}
              className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${jeLoading ? "animate-spin" : ""}`} />
              {jePreview ? "Refresh" : "Load Preview"}
            </button>
          </div>

          {jePreview && (
            <>
              {/* Warnings */}
              {jePreview.warnings.length > 0 && (
                <div className="mb-4 space-y-1">
                  {jePreview.warnings.map((w, i) => (
                    <div key={i} className="flex items-center gap-1.5 text-xs text-amber-700">
                      <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
                      {w}
                    </div>
                  ))}
                </div>
              )}

              {/* Summary */}
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="rounded-lg bg-gray-50 px-3 py-2">
                  <p className="text-xs text-gray-500">Orders</p>
                  <p className="text-sm font-semibold text-gray-900">{jePreview.summary.order_count}</p>
                </div>
                <div className="rounded-lg bg-green-50 px-3 py-2">
                  <p className="text-xs text-green-600">Total Credits</p>
                  <p className="text-sm font-semibold text-green-800">${jePreview.summary.total_credits.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                </div>
                <div className="rounded-lg bg-blue-50 px-3 py-2">
                  <p className="text-xs text-blue-600">Total Debits</p>
                  <p className="text-sm font-semibold text-blue-800">${jePreview.summary.total_debits.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                </div>
              </div>

              {/* Braintree Fees Override */}
              <div className="mb-4 flex items-end gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-amber-800 mb-1">
                    Braintree CC Fees (estimated — update with actual from statement)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={btFeesOverride}
                    onChange={(e) => setBtFeesOverride(e.target.value)}
                    className="w-40 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                </div>
                <button
                  onClick={async () => {
                    setJeUpdating(true);
                    setJeUpdateResult(null);
                    try {
                      const debugParam = isDebug;
                      const res = await fetch("/api/qb/journal-entry", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          month,
                          debug: debugParam,
                          overrides: btFeesOverride ? { braintree_fees: Number(btFeesOverride) } : undefined,
                        }),
                      });
                      const data = await res.json();
                      if (res.ok && data.success) {
                        setJeUpdateResult({ ok: true, message: `JE #${data.doc_number} ${data.updated ? "updated" : "created"} in QuickBooks` });
                        // Refresh preview
                        const previewRes = await fetch(`/api/qb/journal-entry?month=${month}`);
                        if (previewRes.ok) setJePreview(await previewRes.json());
                      } else {
                        setJeUpdateResult({ ok: false, message: data.error || "Failed" });
                      }
                    } catch {
                      setJeUpdateResult({ ok: false, message: "Request failed" });
                    } finally { setJeUpdating(false); }
                  }}
                  disabled={jeUpdating}
                  className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50 transition-colors"
                >
                  {jeUpdating ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {jeUpdating ? "Updating..." : "Update JE in QB"}
                </button>
              </div>

              {jeUpdateResult && (
                <div className={`mb-4 flex items-center gap-1.5 text-sm ${jeUpdateResult.ok ? "text-green-700" : "text-red-700"}`}>
                  {jeUpdateResult.ok ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                  {jeUpdateResult.message}
                </div>
              )}

              {/* Expandable line detail */}
              <button
                onClick={() => setJeExpanded(!jeExpanded)}
                className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 mb-2"
              >
                {jeExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                {jeExpanded ? "Hide" : "Show"} {jePreview.lines.length} line items
              </button>

              {jeExpanded && (
                <div className="rounded-lg border border-gray-200 overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50">
                      <tr className="border-b border-gray-200">
                        <th className="px-3 py-2 text-left font-medium text-gray-500">Account</th>
                        <th className="px-3 py-2 text-right font-medium text-gray-500 w-24">Debit</th>
                        <th className="px-3 py-2 text-right font-medium text-gray-500 w-24">Credit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {jePreview.lines.map((line, i) => (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="px-3 py-1.5 text-gray-700">{line.description}</td>
                          <td className="px-3 py-1.5 text-right font-mono text-gray-900">
                            {line.postingType === "Debit" ? `$${line.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : ""}
                          </td>
                          <td className="px-3 py-1.5 text-right font-mono text-gray-900">
                            {line.postingType === "Credit" ? `$${line.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : ""}
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-gray-50 font-semibold">
                        <td className="px-3 py-2 text-gray-900">Totals</td>
                        <td className="px-3 py-2 text-right font-mono text-gray-900">
                          ${jePreview.summary.total_debits.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-gray-900">
                          ${jePreview.summary.total_credits.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Past closings */}
      {pastClosings.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-3">Closing History</h2>
          <div className="space-y-2">
            {pastClosings.map((c) => (
              <div key={c.id} className="flex items-center justify-between rounded-lg bg-gray-50 px-4 py-2">
                <div className="flex items-center gap-2">
                  {c.status === "completed" ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  ) : c.status === "error" ? (
                    <XCircle className="h-4 w-4 text-red-500" />
                  ) : (
                    <Loader2 className="h-4 w-4 text-gray-400" />
                  )}
                  <span className="text-sm font-medium text-gray-900">{c.closing_month}</span>
                </div>
                <span className="text-xs text-gray-500">
                  {c.completed_at ? new Date(c.completed_at).toLocaleString() : c.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
