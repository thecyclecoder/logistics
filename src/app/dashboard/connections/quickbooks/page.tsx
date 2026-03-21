import { createServiceClient } from "@/lib/supabase/server";
import QuickBooksConnectionClient from "./quickbooks-connection-client";

export const revalidate = 0;

export default async function QuickBooksConnectionPage() {
  const supabase = createServiceClient();

  const { data: qbTokens } = await supabase
    .from("qb_tokens")
    .select("*")
    .limit(1)
    .single();

  const connected = !!qbTokens;
  const realmId = qbTokens?.realm_id ?? null;
  const lastRefresh = qbTokens?.updated_at ?? null;

  return (
    <QuickBooksConnectionClient
      initialConnected={connected}
      realmId={realmId}
      lastRefresh={lastRefresh}
    />
  );
}
