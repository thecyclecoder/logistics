"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  LayoutDashboard,
  Package,
  Layers,
  DollarSign,
  Link2,
  RefreshCw,
  LogOut,
  Package as LogoIcon,
} from "lucide-react";

const navItems = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/products", label: "Products", icon: Layers },
  { href: "/dashboard/inventory", label: "Inventory", icon: Package },
  { href: "/dashboard/sales", label: "Sales", icon: DollarSign },
  { href: "/dashboard/mapping", label: "SKU Mapping", icon: Link2 },
  { href: "/dashboard/sync", label: "Sync Status", icon: RefreshCw },
];

export default function Sidebar({ email }: { email: string }) {
  const pathname = usePathname();

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  return (
    <aside className="flex h-full w-64 flex-col border-r border-gray-200 bg-white">
      <div className="flex items-center gap-2.5 px-6 py-5 border-b border-gray-100">
        <div className="h-8 w-8 bg-brand-600 rounded-lg flex items-center justify-center">
          <LogoIcon className="h-4.5 w-4.5 text-white" />
        </div>
        <span className="text-lg font-semibold text-gray-900">Logistics</span>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const isActive =
            item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-brand-50 text-brand-700"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              }`}
            >
              <Icon className="h-4.5 w-4.5 flex-shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-gray-100 px-3 py-4">
        <div className="px-3 mb-2">
          <p className="text-xs text-gray-500 truncate">{email}</p>
        </div>
        <button
          onClick={handleSignOut}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
        >
          <LogOut className="h-4.5 w-4.5 flex-shrink-0" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
