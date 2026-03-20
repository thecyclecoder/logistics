import { createClient } from "@/lib/supabase/server";
import type { Product } from "@/lib/types/database";
import ProductsClient from "./products-client";

export const revalidate = 0;

export default async function ProductsPage() {
  const supabase = createClient();

  const { data } = await supabase
    .from("products")
    .select("*")
    .eq("active", true)
    .order("quickbooks_name");

  const products = (data || []) as Product[];

  return <ProductsClient initialProducts={products} />;
}
