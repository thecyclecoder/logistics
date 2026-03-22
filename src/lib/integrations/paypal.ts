import { getCredentials } from "@/lib/credentials";

async function getPayPalToken(): Promise<{ token: string; baseUrl: string }> {
  const creds = await getCredentials("paypal");
  const baseUrl = creds.environment === "sandbox"
    ? "https://api-m.sandbox.paypal.com"
    : "https://api-m.paypal.com";

  const basicAuth = Buffer.from(`${creds.client_id}:${creds.client_secret}`).toString("base64");
  const res = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  const data = await res.json();
  if (!data.access_token) throw new Error("PayPal token refresh failed");
  return { token: data.access_token, baseUrl };
}

export interface PayPalSummary {
  gross_sales: number;
  processing_fees: number;
  refunds: number;
  chargebacks: number;
  dispute_fees: number;
  net_deposits: number;
  transaction_count: number;
}

export async function aggregatePayPalTransactions(month: string): Promise<PayPalSummary> {
  const { token, baseUrl } = await getPayPalToken();
  const [year, mon] = month.split("-").map(Number);
  const lastDay = new Date(year, mon, 0).getDate();
  const startDate = `${month}-01T00:00:00-0000`;
  const endDate = `${month}-${String(lastDay).padStart(2, "0")}T23:59:59-0000`;

  // Fetch all pages
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let allTxns: any[] = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages) {
    const res = await fetch(
      `${baseUrl}/v1/reporting/transactions?start_date=${startDate}&end_date=${endDate}&fields=all&page_size=500&page=${page}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) throw new Error(`PayPal API error: ${res.status}`);
    const data = await res.json();
    totalPages = data.total_pages || 1;
    allTxns = allTxns.concat(data.transaction_details || []);
    page++;
  }

  let grossSales = 0;
  let txnFees = 0;
  let refunds = 0;
  let chargebacks = 0;
  let disputeFees = 0;
  let withdrawals = 0;
  let salesCount = 0;

  for (const t of allTxns) {
    const code = t.transaction_info?.transaction_event_code || "";
    const amt = Number(t.transaction_info?.transaction_amount?.value || 0);
    const fee = Number(t.transaction_info?.fee_amount?.value || 0);

    switch (code) {
      case "T0003": // Website payment
      case "T0006": // Recurring payment
        grossSales += amt;
        txnFees += fee; // negative
        salesCount++;
        break;
      case "T0114": // Dispute fee
        disputeFees += Math.abs(amt);
        break;
      case "T1106": // Payment reversal (chargeback-related)
      case "T1201": // Chargeback
        chargebacks += Math.abs(amt);
        break;
      case "T1107": // Payment refund
        refunds += Math.abs(amt);
        break;
      case "T0401": // Bank withdrawal
        withdrawals += Math.abs(amt);
        break;
    }
  }

  return {
    gross_sales: grossSales,
    processing_fees: Math.abs(txnFees) + disputeFees,
    refunds,
    chargebacks,
    dispute_fees: disputeFees,
    net_deposits: withdrawals,
    transaction_count: salesCount,
  };
}
