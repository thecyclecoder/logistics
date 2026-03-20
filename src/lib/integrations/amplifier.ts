const API_BASE = "https://api.amplifier.com";
const API_KEY = process.env.AMPLIFIER_API_KEY || "";

function getHeaders(): Record<string, string> {
  // HTTP Basic Auth: API key as username, no password
  const basicAuth = Buffer.from(`${API_KEY}:`).toString("base64");
  return {
    Authorization: `Basic ${basicAuth}`,
    "Content-Type": "application/json",
  };
}

export interface AmplifierInventoryItem {
  sku: string;
  quantity_available: number;
  quantity_on_hand: number;
  quantity_committed: number;
  quantity_expected: number;
  safety_stock: number;
  made_to_order: boolean;
}

export async function fetchInventory(): Promise<AmplifierInventoryItem[]> {
  const res: Response = await fetch(`${API_BASE}/reports/inventory/current`, {
    headers: getHeaders(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Amplifier inventory fetch failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  return data.inventory || [];
}

export interface AmplifierOrderPayload {
  order_number: string;
  shipping_method: string;
  ship_to: {
    name: string;
    address1: string;
    address2?: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  };
  items: Array<{
    sku: string;
    quantity: number;
  }>;
}

export async function createOrder(
  payload: AmplifierOrderPayload
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
  const res: Response = await fetch(`${API_BASE}/orders`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Amplifier create order failed: ${res.status} ${text}`);
  }

  return res.json();
}
