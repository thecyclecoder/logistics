import { createServiceClient } from "@/lib/supabase/server";
import BraintreeConnectionClient from "./braintree-connection-client";

export const revalidate = 0;

export default async function BraintreeConnectionPage() {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("integration_credentials")
    .select("credentials")
    .eq("id", "braintree")
    .single();

  const creds = (data?.credentials || {}) as Record<string, string>;
  const connected = !!(creds.merchant_id && creds.public_key && creds.private_key);

  return (
    <BraintreeConnectionClient
      initialConnected={connected}
      initialMerchantId={creds.merchant_id || ""}
      initialEnvironment={creds.environment || "production"}
    />
  );
}
