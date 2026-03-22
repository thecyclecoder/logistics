import { createServiceClient } from "@/lib/supabase/server";
import type { Product, SkuMapping } from "@/lib/types/database";
import ProductsClient from "./products-client";

export const revalidate = 0;

export default async function ProductsPage() {
  const supabase = createServiceClient();

  const [productsRes, mappingsRes, bomRes] = await Promise.all([
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
    supabase
      .from("product_bom")
      .select("parent_id, component_id, quantity"),
  ]);

  const products = (productsRes.data || []) as Product[];
  const mappings = (mappingsRes.data || []) as SkuMapping[];
  const bomRows = (bomRes.data || []) as Array<{ parent_id: string; component_id: string; quantity: number }>;

  return <ProductsClient initialProducts={products} initialMappings={mappings} bomRows={bomRows} />;
}
