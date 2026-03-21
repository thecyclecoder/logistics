import { createServiceClient } from "@/lib/supabase/server";

type IntegrationId = "amazon" | "quickbooks" | "shopify" | "amplifier";

const cache = new Map<string, { data: Record<string, string>; expiresAt: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function getCredentials(
  integration: IntegrationId
): Promise<Record<string, string>> {
  const cached = cache.get(integration);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.data;
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("integration_credentials")
    .select("credentials")
    .eq("id", integration)
    .single();

  if (error || !data) {
    throw new Error(
      `No credentials found for ${integration}. Configure in Connections.`
    );
  }

  const creds = data.credentials as Record<string, string>;
  cache.set(integration, { data: creds, expiresAt: Date.now() + CACHE_TTL });
  return creds;
}

export async function setCredentials(
  integration: IntegrationId,
  credentials: Record<string, string>
): Promise<void> {
  const supabase = createServiceClient();
  await supabase.from("integration_credentials").upsert({
    id: integration,
    credentials,
    updated_at: new Date().toISOString(),
  });
  cache.delete(integration);
}

export async function updateCredentials(
  integration: IntegrationId,
  updates: Record<string, string>
): Promise<void> {
  const current = await getCredentials(integration).catch(() => ({}));
  await setCredentials(integration, { ...current, ...updates });
}
