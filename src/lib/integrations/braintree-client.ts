import { getCredentials } from "@/lib/credentials";
import braintree from "braintree";
import https from "https";

async function getGateway(): Promise<{ gateway: braintree.BraintreeGateway; creds: Record<string, string> }> {
  const creds = await getCredentials("braintree");
  const env = creds.environment === "sandbox"
    ? braintree.Environment.Sandbox
    : braintree.Environment.Production;

  const gateway = new braintree.BraintreeGateway({
    environment: env,
    merchantId: creds.merchant_id,
    publicKey: creds.public_key,
    privateKey: creds.private_key,
  });

  return { gateway, creds };
}

export interface BraintreeSummary {
  gross_sales: number;
  estimated_fees: number;
  refunds: number;
  chargebacks: number;
  net_deposits: number;
  transaction_count: number;
}

export async function aggregateBraintreeTransactions(month: string): Promise<BraintreeSummary> {
  const { gateway, creds } = await getGateway();
  const [year, mon] = month.split("-").map(Number);
  const lastDay = new Date(year, mon, 0).getDate();
  const startDate = `${month}-01 00:00`;
  const endDate = `${month}-${String(lastDay).padStart(2, "0")} 23:59:59`;

  // Search all settled transactions
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stream = gateway.transaction.search((search: any) => {
    search.settledAt().between(startDate, endDate);
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const txns: any[] = [];
  await new Promise<void>((resolve, reject) => {
    stream.on("data", (txn: braintree.Transaction) => txns.push(txn));
    stream.on("end", resolve);
    stream.on("error", reject);
  });

  let grossSales = 0;
  let refunds = 0;
  let salesCount = 0;

  for (const t of txns) {
    const amt = Number(t.amount);
    if (t.type === "sale") {
      grossSales += amt;
      salesCount++;
    } else if (t.type === "credit") {
      refunds += amt;
    }
  }

  // Search disputes for chargebacks
  let chargebacks = 0;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const disputeStream = gateway.dispute.search((search: any) => {
      search.receivedDate().between(
        `${month}-01`,
        `${month}-${String(lastDay).padStart(2, "0")}`
      );
    });

    await new Promise<void>((resolve, reject) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      disputeStream.on("data", (dispute: any) => {
        if (dispute.status !== "won") {
          chargebacks += Number(dispute.amountDisputed || 0);
        }
      });
      disputeStream.on("end", resolve);
      disputeStream.on("error", reject);
    });
  } catch {
    // Dispute search may not be available
  }

  // Get estimated fees from GraphQL transaction-level fee reports
  const estimatedFees = await getEstimatedFees(month, creds);

  return {
    gross_sales: grossSales,
    estimated_fees: estimatedFees,
    refunds,
    chargebacks,
    net_deposits: grossSales - refunds - estimatedFees,
    transaction_count: salesCount,
  };
}

async function getEstimatedFees(month: string, creds: Record<string, string>): Promise<number> {
  const [year, mon] = month.split("-").map(Number);
  const lastDay = new Date(year, mon, 0).getDate();
  const authStr = Buffer.from(`${creds.public_key}:${creds.private_key}`).toString("base64");

  const postGQL = (query: string): Promise<{ data?: { report?: { transactionLevelFees?: { url?: string } } }; errors?: unknown[] }> =>
    new Promise((resolve, reject) => {
      const options: https.RequestOptions = {
        hostname: "payments.braintree-api.com",
        path: "/graphql",
        method: "POST",
        headers: {
          Authorization: `Basic ${authStr}`,
          "Content-Type": "application/json",
          "Braintree-Version": "2024-08-01",
        },
      };
      const req = https.request(options, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try { resolve(JSON.parse(data)); } catch { resolve({}); }
        });
      });
      req.on("error", reject);
      req.write(JSON.stringify({ query }));
      req.end();
    });

  let totalFees = 0;

  // Check each day for fee reports (they're keyed by disbursement date)
  // Also check first 5 days of next month for late disbursements
  const dates: string[] = [];
  for (let d = 1; d <= lastDay; d++) {
    dates.push(`${month}-${String(d).padStart(2, "0")}`);
  }
  const nextMonth = mon === 12 ? `${year + 1}-01` : `${year}-${String(mon + 1).padStart(2, "0")}`;
  for (let d = 1; d <= 5; d++) {
    dates.push(`${nextMonth}-${String(d).padStart(2, "0")}`);
  }

  for (const date of dates) {
    try {
      const result = await postGQL(`{ report { transactionLevelFees(date: "${date}") { url } } }`);
      const url = result.data?.report?.transactionLevelFees?.url;
      if (!url) continue;

      const csvRes = await fetch(url);
      const csv = await csvRes.text();
      const lines = csv.split("\n").filter((l) => l.trim());

      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(",");
        const settlementDate = cols[7]; // Settlement Date column
        if (settlementDate && settlementDate.startsWith(month)) {
          const fee = Number(cols[cols.length - 1]) || 0;
          totalFees += fee;
        }
      }
    } catch {
      // Skip days without reports
    }
  }

  return Math.round(totalFees * 100) / 100;
}
