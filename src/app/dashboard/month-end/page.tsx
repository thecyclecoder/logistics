"use client";

import { useState, useEffect } from "react";
import { CheckCircle2, XCircle, Loader2, AlertTriangle, Lock, SkipForward } from "lucide-react";

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
