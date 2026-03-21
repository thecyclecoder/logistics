"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  LayoutDashboard,
  Package,
  Layers,
  DollarSign,
  LogOut,
  Package as LogoIcon,
  Plug,
  Menu,
  X,
} from "lucide-react";

const navItems = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/products", label: "Products", icon: Layers },
  { href: "/dashboard/inventory", label: "Inventory", icon: Package },
  { href: "/dashboard/sales", label: "Sales", icon: DollarSign },
  { href: "/dashboard/connections", label: "Connections", icon: Plug },
];

export default function Sidebar({ email }: { email: string }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  const navContent = (
    <>
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
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
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-brand-50 text-brand-700"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              }`}
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
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
          <LogOut className="h-4 w-4 flex-shrink-0" />
          Sign out
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-30 flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 bg-brand-600 rounded-lg flex items-center justify-center">
            <LogoIcon className="h-4 w-4 text-white" />
          </div>
          <span className="text-lg font-semibold text-gray-900">Logistics</span>
        </div>
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="rounded-lg p-2 text-gray-600 hover:bg-gray-100"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-30 bg-black/40"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <div
        className={`lg:hidden fixed top-0 left-0 z-40 h-full w-72 bg-white border-r border-gray-200 transform transition-transform duration-200 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        } flex flex-col`}
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 bg-brand-600 rounded-lg flex items-center justify-center">
              <LogoIcon className="h-4 w-4 text-white" />
            </div>
            <span className="text-lg font-semibold text-gray-900">Logistics</span>
          </div>
          <button
            onClick={() => setMobileOpen(false)}
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {navContent}
      </div>

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex h-full w-64 flex-col border-r border-gray-200 bg-white flex-shrink-0">
        <div className="flex items-center gap-2.5 px-6 py-5 border-b border-gray-100">
          <div className="h-8 w-8 bg-brand-600 rounded-lg flex items-center justify-center">
            <LogoIcon className="h-4 w-4 text-white" />
          </div>
          <span className="text-lg font-semibold text-gray-900">Logistics</span>
        </div>
        {navContent}
      </aside>
    </>
  );
}
