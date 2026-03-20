const API_URL = process.env.AMPLIFIER_API_URL || "https://app.amplifier.com/api";
const API_KEY = process.env.AMPLIFIER_API_KEY || "";

function headers() {
  return {
    Authorization: `Bearer ${API_KEY}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

export interface AmplifierInventoryItem {
  sku: string;
  quantity: number;
  warehouse?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

export async function fetchInventory(): Promise<AmplifierInventoryItem[]> {
  const res = await fetch(`${API_URL}/inventory`, {
    headers: headers(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Amplifier inventory fetch failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  return Array.isArray(data) ? data : data.inventory || data.items || [];
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
  const res = await fetch(`${API_URL}/orders`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Amplifier create order failed: ${res.status} ${text}`);
  }

  return res.json();
}
