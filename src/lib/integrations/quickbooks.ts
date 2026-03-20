import { createServiceClient } from "@/lib/supabase/server";

const QB_TOKEN_URL = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";
const QB_TOKENS_TABLE = "qb_tokens";

let cachedToken: { access_token: string; expires_at: number } | null = null;

async function getStoredTokens(): Promise<{
  refresh_token: string | null;
  realm_id: string | null;
}> {
  try {
    const supabase = createServiceClient();
    const { data } = await supabase
      .from(QB_TOKENS_TABLE)
      .select("refresh_token, realm_id")
      .eq("id", "current")
      .single();
    return {
      refresh_token: data?.refresh_token || null,
      realm_id: data?.realm_id || null,
    };
  } catch {
    return { refresh_token: null, realm_id: null };
  }
}

async function storeRefreshToken(refreshToken: string): Promise<void> {
  try {
    const supabase = createServiceClient();
    await supabase
      .from(QB_TOKENS_TABLE)
      .upsert({
        id: "current",
        refresh_token: refreshToken,
        updated_at: new Date().toISOString(),
      });
  } catch (err) {
    console.error("Failed to store QB refresh token:", err);
  }
}

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expires_at - 60_000) {
    return cachedToken.access_token;
  }

  // Try DB-stored token first, fall back to env var
  const stored = await getStoredTokens();
  const refreshToken = stored.refresh_token || process.env.QB_REFRESH_TOKEN;

  if (!refreshToken) {
    throw new Error(
      "No QB refresh token available. Connect QuickBooks at /api/qb/connect"
    );
  }

  const basicAuth = Buffer.from(
    `${process.env.QB_CLIENT_ID}:${process.env.QB_CLIENT_SECRET}`
  ).toString("base64");

  const res = await fetch(QB_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basicAuth}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `QB token refresh failed (${res.status}): ${text}. Re-authorize at /api/qb/connect`
    );
  }

  const data = await res.json();
  cachedToken = {
    access_token: data.access_token,
    expires_at: Date.now() + data.expires_in * 1000,
  };

  // QB issues a new refresh token on every refresh — store it
  if (data.refresh_token) {
    await storeRefreshToken(data.refresh_token);
  }

  return data.access_token;
}

function baseUrl(): string {
  return process.env.QB_ENVIRONMENT === "production"
    ? "https://quickbooks.api.intuit.com"
    : "https://sandbox-quickbooks.api.intuit.com";
}

export interface QBItem {
  Id: string;
  Name: string;
  Sku?: string;
  Type: string;
  QtyOnHand?: number;
  UnitPrice?: number;
  Active: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

export async function fetchInventoryItems(): Promise<QBItem[]> {
  const token = await getAccessToken();
  const stored = await getStoredTokens();
  const realmId = stored.realm_id || process.env.QB_REALM_ID;
  if (!realmId) {
    throw new Error("No QB Realm ID. Connect QuickBooks at /api/qb/connect");
  }
  const items: QBItem[] = [];
  let startPosition = 1;
  const maxResults = 1000;

  while (true) {
    const query = encodeURIComponent(
      `SELECT * FROM Item WHERE Type = 'Inventory' STARTPOSITION ${startPosition} MAXRESULTS ${maxResults}`
    );

    const res = await fetch(
      `${baseUrl()}/v3/company/${realmId}/query?query=${query}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      }
    );

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`QB query failed: ${res.status} ${text}`);
    }

    const data = await res.json();
    const queryResponse = data.QueryResponse;
    const batch: QBItem[] = queryResponse?.Item || [];
    items.push(...batch);

    if (batch.length < maxResults) break;
    startPosition += maxResults;
  }

  return items;
}
