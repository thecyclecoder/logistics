const QB_TOKEN_URL = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";

let cachedToken: { access_token: string; expires_at: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expires_at - 60_000) {
    return cachedToken.access_token;
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
      refresh_token: process.env.QB_REFRESH_TOKEN!,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`QB token refresh failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  cachedToken = {
    access_token: data.access_token,
    expires_at: Date.now() + data.expires_in * 1000,
  };
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
  const realmId = process.env.QB_REALM_ID!;
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
