"use client";

import { Activity } from "lucide-react";

export default function ReplenishmentStatusPage() {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-12 text-center">
      <Activity className="mx-auto h-10 w-10 text-gray-300 mb-3" />
      <p className="text-gray-500 font-medium">Active Shipments</p>
      <p className="text-sm text-gray-400 mt-1">
        Track in-progress replenishment orders — coming soon
      </p>
    </div>
  );
}
