import { createServiceClient } from "@/lib/supabase/server";
import AmplifierConnectionClient from "./amplifier-connection-client";

export const revalidate = 0;

export default async function AmplifierConnectionPage() {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("integration_credentials")
    .select("credentials")
    .eq("id", "amplifier")
    .single();

  const connected = !!(data?.credentials as Record<string, string> | null)?.api_key;

  return <AmplifierConnectionClient initialConnected={connected} />;
}
