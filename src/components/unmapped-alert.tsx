"use client";

import { useEffect, useState } from "react";
import { AlertOctagon, X } from "lucide-react";
import Link from "next/link";

interface UnmappedSku {
  id: string;
  external_id: string;
  source: string;
  last_seen_at: string;
}

export default function UnmappedAlert() {
  const [skus, setSkus] = useState<UnmappedSku[]>([]);

  useEffect(() => {
    fetch("/api/unmapped-skus")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setSkus(data);
      })
      .catch(() => {});
  }, []);

  const dismiss = async (id: string) => {
    await fetch(`/api/unmapped-skus/${id}`, { method: "DELETE" });
    setSkus((prev) => prev.filter((s) => s.id !== id));
  };

  if (skus.length === 0) return null;

  const bySrc: Record<string, UnmappedSku[]> = {};
  for (const s of skus) {
    bySrc[s.source] = bySrc[s.source] || [];
    bySrc[s.source].push(s);
  }

  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-4">
      <div className="flex items-start gap-3">
        <AlertOctagon className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-red-800">
            {skus.length} unmapped SKU{skus.length !== 1 ? "s" : ""} detected
          </h3>
          <p className="text-sm text-red-700 mt-1">
            These ASINs/SKUs were seen during sync but couldn&apos;t be matched to a product.
            Sales and inventory for these items are not being tracked.{" "}
            <Link href="/dashboard/mapping" className="font-medium underline">
              Fix in SKU Mapping
            </Link>
          </p>
          <div className="mt-3 space-y-2">
            {Object.entries(bySrc).map(([source, items]) => (
              <div key={source}>
                <p className="text-xs font-medium text-red-600 uppercase mb-1">
                  {source === "3pl" ? "3PL" : source}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {items.map((s) => (
                    <span
                      key={s.id}
                      className="inline-flex items-center gap-1 rounded bg-red-100 px-2 py-0.5 text-xs font-mono text-red-800"
                    >
                      {s.external_id}
                      <button
                        onClick={() => dismiss(s.id)}
                        className="ml-0.5 rounded-full hover:bg-red-200 p-0.5"
                        title="Dismiss"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
