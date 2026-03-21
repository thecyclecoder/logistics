import { createServiceClient } from "@/lib/supabase/server";
import type { Product, SkuMapping } from "@/lib/types/database";
import ProductsClient from "./products-client";

export const revalidate = 0;

export default async function ProductsPage() {
  const supabase = createServiceClient();

  const [productsRes, mappingsRes] = await Promise.all([
    supabase
      .from("products")
      .select("*")
      .eq("active", true)
      .order("quickbooks_name"),
    supabase
      .from("sku_mappings")
      .select("*, products(quickbooks_name, sku)")
      .eq("active", true)
      .order("created_at", { ascending: false }),
  ]);

  const products = (productsRes.data || []) as Product[];
  const mappings = (mappingsRes.data || []) as SkuMapping[];

  return <ProductsClient initialProducts={products} initialMappings={mappings} />;
}
