const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Default values as fallback
const DEFAULTS: Record<string, { qb_id: string; qb_name: string }> = {
  shrinkage_account: { qb_id: "175", qb_name: "Product Costs:Inventory Shrinkage" },
  amazon_customer: { qb_id: "40", qb_name: "Amazon" },
  shopify_customer: { qb_id: "30410", qb_name: "Shopify" },
  amazon_deposit_account: { qb_id: "117", qb_name: "Amazon Carried Balances" },
  shopify_deposit_account: { qb_id: "589", qb_name: "Shopify" },
};

export async function getQBMapping(key: string): Promise<{ qb_id: string; qb_name: string }> {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/qb_account_mappings?key=eq.${encodeURIComponent(key)}&select=qb_id,qb_name`,
      {
        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
        },
        cache: "no-store",
      }
    );
    const rows = await res.json();
    if (rows?.[0]) {
      return { qb_id: rows[0].qb_id, qb_name: rows[0].qb_name };
    }
  } catch {
    // Fall through to default
  }
  return DEFAULTS[key] || { qb_id: "", qb_name: "" };
}

export async function getQBMappings(keys: string[]): Promise<Record<string, { qb_id: string; qb_name: string }>> {
  const result: Record<string, { qb_id: string; qb_name: string }> = {};
  // Fetch all at once
  try {
    const keyList = keys.map((k) => `"${k}"`).join(",");
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/qb_account_mappings?key=in.(${keyList})&select=key,qb_id,qb_name`,
      {
        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
        },
        cache: "no-store",
      }
    );
    const rows = await res.json();
    for (const row of rows || []) {
      result[row.key] = { qb_id: row.qb_id, qb_name: row.qb_name };
    }
  } catch {
    // Fall through to defaults
  }
  // Fill in defaults for missing keys
  for (const key of keys) {
    if (!result[key] && DEFAULTS[key]) {
      result[key] = DEFAULTS[key];
    }
  }
  return result;
}
