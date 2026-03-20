import { createClient } from "@/lib/supabase/server";
import MappingClient from "./mapping-client";
import type { Product, SkuMapping } from "@/lib/types/database";

export const revalidate = 0;

export default async function MappingPage() {
  const supabase = createClient();

  const [mappingsRes, productsRes, unmappedRes] = await Promise.all([
    supabase
      .from("sku_mappings")
      .select("*, products(quickbooks_name, sku)")
      .eq("active", true)
      .order("created_at", { ascending: false }),
    supabase
      .from("products")
      .select("id, quickbooks_name, sku")
      .eq("active", true)
      .order("quickbooks_name"),
    // Products with zero active mappings
    supabase.rpc("get_unmapped_products"),
  ]);

  const mappings = (mappingsRes.data || []) as SkuMapping[];
  const products = (productsRes.data || []) as Pick<
    Product,
    "id" | "quickbooks_name" | "sku"
  >[];

  // Fallback for unmapped: filter client-side if RPC doesn't exist yet
  let unmappedProducts: typeof products;
  if (unmappedRes.error) {
    const mappedIds = new Set(mappings.map((m) => m.product_id));
    unmappedProducts = products.filter((p) => !mappedIds.has(p.id));
  } else {
    unmappedProducts = unmappedRes.data || [];
  }

  return (
    <MappingClient
      initialMappings={mappings}
      products={products}
      unmappedProducts={unmappedProducts}
    />
  );
}
