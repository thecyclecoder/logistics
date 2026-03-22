import { createServiceClient } from "@/lib/supabase/server";
import PayPalConnectionClient from "./paypal-connection-client";

export const revalidate = 0;

export default async function PayPalConnectionPage() {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("integration_credentials")
    .select("credentials")
    .eq("id", "paypal")
    .single();

  const creds = (data?.credentials || {}) as Record<string, string>;
  const connected = !!(creds.client_id && creds.client_secret);

  return (
    <PayPalConnectionClient
      initialConnected={connected}
      initialClientId={creds.client_id || ""}
      initialEnvironment={creds.environment || "production"}
    />
  );
}
