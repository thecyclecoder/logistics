"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Map, PackageSearch, Activity, History } from "lucide-react";

const subNavItems = [
  { href: "/dashboard/replenishment", label: "Inventory", icon: PackageSearch, exact: true },
  { href: "/dashboard/replenishment/mapping", label: "Mapping", icon: Map },
  { href: "/dashboard/replenishment/status", label: "Status", icon: Activity },
  { href: "/dashboard/replenishment/history", label: "History", icon: History },
];

export default function ReplenishmentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">FBA Replenishment</h1>
        <p className="text-sm text-gray-500 mt-1">
          Manage Amazon FBA inventory replenishment from Amplifier 3PL
        </p>
      </div>

      {/* Sub-navigation */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-6" aria-label="Replenishment">
          {subNavItems.map((item) => {
            const isActive = item.exact
              ? pathname === item.href
              : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2 border-b-2 px-1 py-3 text-sm font-medium transition-colors ${
                  isActive
                    ? "border-brand-600 text-brand-700"
                    : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      {children}
    </div>
  );
}
