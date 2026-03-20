import { createClient } from "@/lib/supabase/server";
import StatCard from "@/components/stat-card";
import { Package, Box, Warehouse, BookOpen } from "lucide-react";
import type { CurrentInventory } from "@/lib/types/database";

export const revalidate = 60;

export default async function InventoryPage() {
  const supabase = createClient();
  const { data } = await supabase.from("current_inventory").select("*");
  const inventory = (data || []) as CurrentInventory[];

  const totalProducts = inventory.length;
  const fbaTotal = inventory.reduce((s, i) => s + i.amazon_fba, 0);
  const threePlTotal = inventory.reduce((s, i) => s + i.three_pl, 0);
  const qbTotal = inventory.reduce((s, i) => s + i.quickbooks, 0);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-gray-900">Inventory</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Products" value={totalProducts} icon={Package} />
        <StatCard title="Amazon FBA Total" value={fbaTotal.toLocaleString()} icon={Box} />
        <StatCard title="3PL Total" value={threePlTotal.toLocaleString()} icon={Warehouse} />
        <StatCard title="QB On-Hand Total" value={qbTotal.toLocaleString()} icon={BookOpen} />
      </div>

      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-3 text-left font-medium text-gray-500">Product</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">SKU</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">FBA</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">FBM</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">3PL</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">QB</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">Total</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">QB Delta</th>
                <th className="px-4 py-3 text-center font-medium text-gray-500">Status</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">Last Snapshot</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {inventory.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-gray-400">
                    No inventory data yet. Run a sync to populate.
                  </td>
                </tr>
              ) : (
                inventory.map((item) => {
                  const channelTotal = item.amazon_fba + item.amazon_fbm + item.three_pl;
                  const qbDelta = channelTotal - item.quickbooks;
                  const status =
                    item.total === 0 && item.reorder_point > 0
                      ? "out"
                      : item.reorder_point > 0 && item.total < item.reorder_point
                        ? "low"
                        : "ok";

                  return (
                    <tr key={item.product_id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {item.quickbooks_name}
                      </td>
                      <td className="px-4 py-3 text-gray-500">{item.sku || "—"}</td>
                      <td className="px-4 py-3 text-right text-gray-700">{item.amazon_fba}</td>
                      <td className="px-4 py-3 text-right text-gray-700">{item.amazon_fbm}</td>
                      <td className="px-4 py-3 text-right text-gray-700">{item.three_pl}</td>
                      <td className="px-4 py-3 text-right text-gray-700">{item.quickbooks}</td>
                      <td className="px-4 py-3 text-right font-medium text-gray-900">
                        {item.total}
                      </td>
                      <td
                        className={`px-4 py-3 text-right font-medium ${
                          qbDelta > 0
                            ? "text-green-600"
                            : qbDelta < 0
                              ? "text-red-600"
                              : "text-gray-400"
                        }`}
                      >
                        {qbDelta > 0 ? "+" : ""}
                        {qbDelta}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                            status === "out"
                              ? "bg-red-50 text-red-700"
                              : status === "low"
                                ? "bg-amber-50 text-amber-700"
                                : "bg-green-50 text-green-700"
                          }`}
                        >
                          {status === "out"
                            ? "Out of Stock"
                            : status === "low"
                              ? "Low Stock"
                              : "In Stock"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-gray-400">
                        {item.last_snapshot_at
                          ? new Date(item.last_snapshot_at).toLocaleString()
                          : "—"}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
