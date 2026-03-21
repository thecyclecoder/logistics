import { createServiceClient } from "@/lib/supabase/server";
import AmazonConnectionClient from "./amazon-connection-client";

export const revalidate = 0;

export default async function AmazonConnectionPage() {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("integration_credentials")
    .select("credentials")
    .eq("id", "amazon")
    .single();

  const connected = !!(data?.credentials as Record<string, string> | null)?.client_id;

  return <AmazonConnectionClient initialConnected={connected} />;
}
