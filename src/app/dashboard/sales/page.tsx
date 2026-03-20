import { createClient } from "@/lib/supabase/server";
import StatCard from "@/components/stat-card";
import SalesClient from "./sales-client";
import { DollarSign, ShoppingCart, RotateCcw, Receipt } from "lucide-react";
import type { MonthlySalesSummary } from "@/lib/types/database";

export const revalidate = 60;

function formatCurrency(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

export default async function SalesPage() {
  const supabase = createClient();

  const { data: months } = await supabase
    .from("monthly_sales_summary")
    .select("period_month")
    .order("period_month", { ascending: false });

  const uniqueMonths = Array.from(
    new Set((months || []).map((m: { period_month: string }) => m.period_month))
  );

  const { data: allSales } = await supabase
    .from("monthly_sales_summary")
    .select("*")
    .order("period_month", { ascending: false });

  const salesData = (allSales || []) as MonthlySalesSummary[];

  return (
    <SalesClient
      months={uniqueMonths}
      salesData={salesData}
      formatCurrency={formatCurrency}
      StatCard={StatCard}
      icons={{ DollarSign, ShoppingCart, RotateCcw, Receipt }}
    />
  );
}
