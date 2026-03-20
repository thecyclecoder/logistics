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

interface AmplifierAddress {
  first_name: string;
  last_name: string;
  name: string;
  company_name?: string;
  address1: string;
  address2?: string;
  address3?: string;
  city: string;
  state: string;
  postal_code: string;
  country_code: string;
  phone?: string;
  email?: string;
  residential?: boolean;
}

export interface AmplifierOrderPayload {
  order_source_code?: string;
  order_id: string;
  order_date: string;
  order_type?: string;
  billing_info?: AmplifierAddress;
  shipping_info: AmplifierAddress;
  shipping_method: string;
  allow_partial_shipment?: boolean;
  packing_slip_message?: string;
  hold_until_date?: string;
  currency_code?: string;
  total_amount?: number;
  subtotal_amount?: number;
  discount_amount?: number;
  tax_amount?: number;
  shipping_amount?: number;
  line_items: Array<{
    reference_id?: string;
    sku: string;
    description?: string;
    quantity: number;
    unit_price?: number;
    assets?: Array<{ url: string }>;
  }>;
}

export async function createOrder(
  payload: AmplifierOrderPayload
): Promise<{ id: string }> {
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

export async function fetchItem(id: string): Promise<Record<string, unknown>> {
  const res: Response = await fetch(`${API_BASE}/items/${id}`, {
    headers: getHeaders(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Amplifier item fetch failed: ${res.status} ${text}`);
  }

  return res.json();
}

export interface AmplifierShipment {
  id: string;
  order_source_code: string;
  order_reference_id: string;
  tracking_number: string;
  shipping_method: string;
  ship_date: string;
  items: Array<{
    order_line_item_reference_id?: string;
    sku: string;
    quantity: number;
  }>;
}

export async function fetchShipmentsByDate(
  date: Date
): Promise<AmplifierShipment[]> {
  const dateStr = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("");

  const res: Response = await fetch(
    `${API_BASE}/reports/shipments/${dateStr}`,
    { headers: getHeaders() }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Amplifier shipments fetch failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  return data.shipments || [];
}
