import { NextResponse } from "next/server";
import { getCredentials } from "@/lib/credentials";
import https from "https";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET() {
  try {
    const creds = await getCredentials("braintree");
    const authStr = Buffer.from(`${creds.public_key}:${creds.private_key}`).toString("base64");
    const month = "2026-03";

    const postGQL = (query: string) =>
      new Promise<{ data?: { report?: { transactionLevelFees?: { url?: string } } } }>((resolve, reject) => {
        const req = https.request({
          hostname: "payments.braintree-api.com",
          path: "/graphql",
          method: "POST",
          headers: {
            Authorization: `Basic ${authStr}`,
            "Content-Type": "application/json",
            "Braintree-Version": "2024-08-01",
          },
        }, (res) => {
          let data = "";
          res.on("data", (chunk) => (data += chunk));
          res.on("end", () => { try { resolve(JSON.parse(data)); } catch { resolve({}); } });
        });
        req.on("error", reject);
        req.write(JSON.stringify({ query }));
        req.end();
      });

    // Fetch all days of March + first 5 days of April
    const dates: string[] = [];
    for (let d = 1; d <= 31; d++) dates.push(`${month}-${String(d).padStart(2, "0")}`);
    for (let d = 1; d <= 5; d++) dates.push(`2026-04-${String(d).padStart(2, "0")}`);

    let headers: string | null = null;
    let braintreeTotal = 0;
    let interchangeTotal = 0;
    let estTotalFee = 0;
    let rowCount = 0;
    let daysWithData = 0;

    for (const date of dates) {
      try {
        const result = await postGQL(`{ report { transactionLevelFees(date: "${date}") { url } } }`);
        const url = result.data?.report?.transactionLevelFees?.url;
        if (!url) continue;

        const csvRes = await fetch(url);
        const csv = await csvRes.text();
        const lines = csv.split("\n").filter((l) => l.trim());
        if (lines.length < 2) continue;

        if (!headers) headers = lines[0];

        const hdrs = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/"/g, ""));
        const settDateIdx = hdrs.findIndex((h) => h.includes("settlement") && h.includes("date") && !h.includes("currency"));
        const icIdx = hdrs.findIndex((h) => h.includes("interchange total amount"));
        const btIdx = hdrs.findIndex((h) => h.includes("braintree total amount"));
        const totalIdx = hdrs.findIndex((h) => h.includes("est. total fee amount"));

        let dayRows = 0;
        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(",").map((c) => c.trim().replace(/"/g, ""));
          const settDate = cols[settDateIdx >= 0 ? settDateIdx : 7];
          if (!settDate || !settDate.startsWith(month)) continue;

          dayRows++;
          if (btIdx >= 0) braintreeTotal += Number(cols[btIdx]) || 0;
          if (icIdx >= 0) interchangeTotal += Number(cols[icIdx]) || 0;
          if (totalIdx >= 0) estTotalFee += Number(cols[totalIdx]) || 0;
        }
        if (dayRows > 0) daysWithData++;
        rowCount += dayRows;
      } catch {
        // skip
      }
    }

    return NextResponse.json({
      month,
      headers,
      days_with_data: daysWithData,
      total_transactions: rowCount,
      fees: {
        braintree_markup: Math.round(braintreeTotal * 100) / 100,
        interchange: Math.round(interchangeTotal * 100) / 100,
        est_total_fee: Math.round(estTotalFee * 100) / 100,
        sum_of_parts: Math.round((braintreeTotal + interchangeTotal) * 100) / 100,
      },
      statement_comparison: {
        statement_braintree_fees: 537.06,
        statement_passthrough_fees: 380.03,
        statement_total_fees: 917.09,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
