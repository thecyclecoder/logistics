import { createClient } from "@/lib/supabase/server";
import { RefreshCw, CheckCircle2, XCircle, Clock, Loader2 } from "lucide-react";
import type { CronLog } from "@/lib/types/database";

export const revalidate = 60;

const JOB_NAMES = [
  "syncQBProducts",
  "syncAmazonInventory",
  "sync3PLInventory",
  "syncAmazonSales",
  "syncShopifySales",
];

function formatDuration(start: string, end: string | null): string {
  if (!end) return "—";
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatTime(date: string): string {
  return new Date(date).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function SyncPage() {
  const supabase = createClient();

  const { data: allLogs } = await supabase
    .from("cron_logs")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(50);

  const logs = (allLogs || []) as CronLog[];

  // Latest log per job
  const latestByJob: Record<string, CronLog> = {};
  for (const log of logs) {
    if (!latestByJob[log.job_name]) {
      latestByJob[log.job_name] = log;
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-gray-900">Sync Status</h1>

      {/* Per-job status cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {JOB_NAMES.map((jobName) => {
          const log = latestByJob[jobName];
          const StatusIcon = log
            ? log.status === "success"
              ? CheckCircle2
              : log.status === "error"
                ? XCircle
                : Loader2
            : Clock;
          const statusColor = log
            ? log.status === "success"
              ? "text-green-500"
              : log.status === "error"
                ? "text-red-500"
                : "text-blue-500"
            : "text-gray-300";

          return (
            <div
              key={jobName}
              className="rounded-xl border border-gray-200 bg-white p-5"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <RefreshCw className="h-4 w-4 text-gray-400" />
                  <h3 className="text-sm font-semibold text-gray-900">{jobName}</h3>
                </div>
                <StatusIcon className={`h-5 w-5 ${statusColor}`} />
              </div>
              {log ? (
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Last run</span>
                    <span className="text-gray-700">{formatTime(log.started_at)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Records</span>
                    <span className="text-gray-700">{log.records_processed ?? "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Duration</span>
                    <span className="text-gray-700">
                      {formatDuration(log.started_at, log.finished_at)}
                    </span>
                  </div>
                  {log.error_message && (
                    <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
                      {log.error_message}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-400">Never run</p>
              )}
            </div>
          );
        })}
      </div>

      {/* Full history table */}
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Sync History</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-3 text-left font-medium text-gray-500">Job</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">Records</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Started</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">Duration</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Error</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                    No sync history yet
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{log.job_name}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          log.status === "success"
                            ? "bg-green-50 text-green-700"
                            : log.status === "error"
                              ? "bg-red-50 text-red-700"
                              : "bg-blue-50 text-blue-700"
                        }`}
                      >
                        {log.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-500">
                      {log.records_processed ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {formatTime(log.started_at)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-500">
                      {formatDuration(log.started_at, log.finished_at)}
                    </td>
                    <td className="px-4 py-3 text-xs text-red-600 max-w-xs truncate">
                      {log.error_message || "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
