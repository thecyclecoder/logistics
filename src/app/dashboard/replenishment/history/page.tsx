"use client";

import { History } from "lucide-react";

export default function ReplenishmentHistoryPage() {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-12 text-center">
      <History className="mx-auto h-10 w-10 text-gray-300 mb-3" />
      <p className="text-gray-500 font-medium">Replenishment History</p>
      <p className="text-sm text-gray-400 mt-1">
        Completed replenishment orders — coming soon
      </p>
    </div>
  );
}
