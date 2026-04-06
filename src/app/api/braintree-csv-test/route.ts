import { NextResponse } from "next/server";
import { getCredentials } from "@/lib/credentials";
import https from "https";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const creds = await getCredentials("braintree");
    const authStr = Buffer.from(`${creds.public_key}:${creds.private_key}`).toString("base64");

    const result = await new Promise<{ data?: { report?: { transactionLevelFees?: { url?: string } } }; errors?: unknown[] }>((resolve, reject) => {
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
      req.write(JSON.stringify({ query: `{ report { transactionLevelFees(date: "2026-03-10") { url } } }` }));
      req.end();
    });

    const url = result.data?.report?.transactionLevelFees?.url;
    if (!url) {
      return NextResponse.json({ error: "No report URL returned", graphql_response: result });
    }

    const csvRes = await fetch(url);
    const csv = await csvRes.text();
    const lines = csv.split("\n").filter((l) => l.trim());

    return NextResponse.json({
      headers: lines[0],
      sample_row: lines[1] || null,
      total_rows: lines.length - 1,
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
