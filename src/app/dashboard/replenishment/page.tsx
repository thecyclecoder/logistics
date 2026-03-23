"use client";

import { PackageSearch } from "lucide-react";

export default function ReplenishmentInventoryPage() {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-12 text-center">
      <PackageSearch className="mx-auto h-10 w-10 text-gray-300 mb-3" />
      <p className="text-gray-500 font-medium">Replenishment Inventory</p>
      <p className="text-sm text-gray-400 mt-1">
        ASINs sorted by sales velocity with replenishment actions — coming soon
      </p>
    </div>
  );
}
