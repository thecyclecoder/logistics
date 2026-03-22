import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getCredentials } from "@/lib/credentials";

export const dynamic = "force-dynamic";

const QB_TOKEN_URL = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";

export async function GET() {
  try {
    const supabase = createServiceClient();
    const qbCreds = await getCredentials("quickbooks");

    // Get QB tokens via direct REST
    const qbTokensRes = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/qb_tokens?id=eq.current&select=refresh_token,realm_id`,
      {
        headers: {
          apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
        },
        cache: "no-store",
      }
    );
    const qbTokensArr = await qbTokensRes.json();
    const qbTokens = qbTokensArr?.[0];
    if (!qbTokens) {
      return NextResponse.json({ error: "QB not connected" }, { status: 400 });
    }

    const basicAuth = Buffer.from(`${qbCreds.client_id}:${qbCreds.client_secret}`).toString("base64");
    const tokenRes = await fetch(QB_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: `Basic ${basicAuth}` },
      body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: qbTokens.refresh_token }),
    });
    const td = await tokenRes.json();

    // Store rotated token
    await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/qb_tokens?id=eq.current`, {
      method: "PATCH",
      headers: {
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ refresh_token: td.refresh_token, updated_at: new Date().toISOString() }),
    });

    // Query income accounts
    const query = encodeURIComponent(
      "SELECT Id, Name, AccountType, AccountSubType FROM Account WHERE AccountType = 'Income' MAXRESULTS 100"
    );
    const res = await fetch(
      `https://quickbooks.api.intuit.com/v3/company/${qbTokens.realm_id}/query?query=${query}`,
      { headers: { Authorization: `Bearer ${td.access_token}`, Accept: "application/json" } }
    );
    const data = await res.json();

    // Also get current product mappings
    const { data: products } = await supabase
      .from("products")
      .select("id, quickbooks_name, revenue_account_id, revenue_account_name, item_type, product_category, bundle_id")
      .eq("active", true);

    const accounts = (data.QueryResponse?.Account || [])
      .filter((a: { AccountSubType: string }) =>
        a.AccountSubType === "SalesOfProductIncome" || a.AccountSubType === "OtherPrimaryIncome"
      )
      .map((a: { Id: string; Name: string; AccountSubType: string }) => ({
        id: a.Id,
        name: a.Name,
        subtype: a.AccountSubType,
      }));

    return NextResponse.json({ accounts, products });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
