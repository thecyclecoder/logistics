import { createServiceClient } from "@/lib/supabase/server";
import ShopifyConnectionClient from "./shopify-connection-client";

export const revalidate = 0;

export default async function ShopifyConnectionPage() {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("shopify_tokens")
    .select("shop_domain, updated_at")
    .eq("id", "current")
    .single();

  const connected = !!data;
  const storeDomain = data?.shop_domain || null;
  const lastRefresh = data?.updated_at || null;

  return (
    <ShopifyConnectionClient
      initialConnected={connected}
      storeDomain={storeDomain}
      lastRefresh={lastRefresh}
    />
  );
}
