import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getCredentials } from "@/lib/credentials";

export const dynamic = "force-dynamic";

const QB_TOKEN_URL = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";

// Define which QB entity types to fetch for each mapping key
const MAPPING_DEFINITIONS: Record<string, {
  label: string;
  description: string;
  entityType: "account" | "customer";
  accountFilter?: string; // QB AccountType filter
  group?: string; // UI grouping
}> = {
  // --- Month-End Closing ---
  shrinkage_account: {
    label: "Shrinkage Account",
    description: "Expense account for inventory adjustments (shrinkage)",
    entityType: "account",
    accountFilter: "Expense",
    group: "Month-End Closing",
  },
  amazon_customer: {
    label: "Amazon Customer",
    description: "QB Customer for Amazon sales receipts",
    entityType: "customer",
    group: "Month-End Closing",
  },
  shopify_customer: {
    label: "Shopify Customer",
    description: "QB Customer for Shopify sales receipts",
    entityType: "customer",
    group: "Month-End Closing",
  },
  amazon_deposit_account: {
    label: "Amazon Deposit Account",
    description: "Clearing account for Amazon sales receipts",
    entityType: "account",
    accountFilter: "Other Current Asset",
    group: "Month-End Closing",
  },
  shopify_deposit_account: {
    label: "Shopify Deposit Account",
    description: "Clearing account for Shopify sales receipts",
    entityType: "account",
    accountFilter: "Other Current Asset",
    group: "Month-End Closing",
  },
  // --- Journal Entry: Revenue & Contra ---
  discounts_account: {
    label: "Discounts & Coupons",
    description: "Contra income account for discounts",
    entityType: "account",
    accountFilter: "Income",
    group: "Journal Entry",
  },
  sales_tax_payable: {
    label: "Sales Tax Payable",
    description: "Liability account for collected sales tax",
    entityType: "account",
    accountFilter: "Other Current Liability",
    group: "Journal Entry",
  },
  shipping_income: {
    label: "Shipping Income",
    description: "Income account for shipping revenue",
    entityType: "account",
    accountFilter: "Income",
    group: "Journal Entry",
  },
  chargebacks_account: {
    label: "Chargebacks",
    description: "Contra income account for chargebacks",
    entityType: "account",
    accountFilter: "Income",
    group: "Journal Entry",
  },
  refunds_account: {
    label: "Refunds",
    description: "Contra income account for refunds",
    entityType: "account",
    accountFilter: "Income",
    group: "Journal Entry",
  },
  // --- Journal Entry: Processor Clearing & Fees ---
  shopify_clearing: {
    label: "Shopify Payments Clearing",
    description: "Clearing account for Shopify Payments deposits",
    entityType: "account",
    accountFilter: "Other Current Asset",
    group: "Payment Processors",
  },
  shopify_txn_fees: {
    label: "Shopify Transaction Fees",
    description: "Expense account for Shopify Payments processing fees",
    entityType: "account",
    accountFilter: "Expense",
    group: "Payment Processors",
  },
  paypal_clearing: {
    label: "PayPal Clearing",
    description: "Clearing account for PayPal deposits",
    entityType: "account",
    accountFilter: "Other Current Asset",
    group: "Payment Processors",
  },
  paypal_txn_fees: {
    label: "PayPal Transaction Fees",
    description: "Expense account for PayPal processing fees",
    entityType: "account",
    accountFilter: "Expense",
    group: "Payment Processors",
  },
  braintree_clearing: {
    label: "Braintree Clearing",
    description: "Clearing account for Braintree deposits",
    entityType: "account",
    accountFilter: "Other Current Asset",
    group: "Payment Processors",
  },
  braintree_txn_fees: {
    label: "Braintree Transaction Fees",
    description: "Expense account for Braintree processing fees",
    entityType: "account",
    accountFilter: "Expense",
    group: "Payment Processors",
  },
  walmart_clearing: {
    label: "Walmart Clearing",
    description: "Clearing account for Walmart carried balances",
    entityType: "account",
    accountFilter: "Other Current Asset",
    group: "Payment Processors",
  },
  // --- Journal Entry: Other ---
  gift_card_liability: {
    label: "Gift Card Liability",
    description: "Liability account for gift card balances",
    entityType: "account",
    accountFilter: "Other Current Liability",
    group: "Journal Entry",
  },
  shopify_other_adjustments: {
    label: "Shopify Other Adjustments",
    description: "Account for Shopify miscellaneous adjustments",
    entityType: "account",
    accountFilter: "Expense",
    group: "Journal Entry",
  },
};

export async function GET() {
  try {
    const supabase = createServiceClient();
    const qbCreds = await getCredentials("quickbooks");

    // Get QB tokens
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

    const qbQuery = async (query: string) => {
      const res = await fetch(
        `https://quickbooks.api.intuit.com/v3/company/${qbTokens.realm_id}/query?query=${encodeURIComponent(query)}`,
        { headers: { Authorization: `Bearer ${td.access_token}`, Accept: "application/json" } }
      );
      return res.json();
    };

    // Fetch all account types we need
    const [expenseData, assetData, incomeData, liabilityData, customerData] = await Promise.all([
      qbQuery("SELECT Id, Name, FullyQualifiedName, AccountType FROM Account WHERE AccountType IN ('Expense', 'Cost of Goods Sold') MAXRESULTS 200"),
      qbQuery("SELECT Id, Name, FullyQualifiedName, AccountType FROM Account WHERE AccountType IN ('Other Current Asset', 'Bank') MAXRESULTS 200"),
      qbQuery("SELECT Id, Name, FullyQualifiedName, AccountType FROM Account WHERE AccountType IN ('Income', 'Other Income') MAXRESULTS 200"),
      qbQuery("SELECT Id, Name, FullyQualifiedName, AccountType FROM Account WHERE AccountType IN ('Other Current Liability') MAXRESULTS 200"),
      qbQuery("SELECT Id, DisplayName FROM Customer MAXRESULTS 200"),
    ]);

    const mapAccounts = (data: { QueryResponse?: { Account?: Array<{ Id: string; FullyQualifiedName: string; AccountType: string }> } }) =>
      (data.QueryResponse?.Account || []).map((a) => ({ id: a.Id, name: a.FullyQualifiedName, type: a.AccountType }));

    const expenseAccounts = mapAccounts(expenseData);
    const assetAccounts = mapAccounts(assetData);
    const incomeAccounts = mapAccounts(incomeData);
    const liabilityAccounts = mapAccounts(liabilityData);
    const customers = (customerData.QueryResponse?.Customer || []).map(
      (c: { Id: string; DisplayName: string }) => ({ id: c.Id, name: c.DisplayName })
    );

    // Get current mappings
    const { data: currentMappings } = await supabase
      .from("qb_account_mappings")
      .select("*");

    const mappingsMap: Record<string, { qb_id: string; qb_name: string }> = {};
    for (const m of currentMappings || []) {
      mappingsMap[m.key] = { qb_id: m.qb_id, qb_name: m.qb_name };
    }

    return NextResponse.json({
      definitions: MAPPING_DEFINITIONS,
      options: {
        expense_accounts: expenseAccounts,
        asset_accounts: assetAccounts,
        income_accounts: incomeAccounts,
        liability_accounts: liabilityAccounts,
        customers,
      },
      current: mappingsMap,
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const body = await request.json();
    const { key, qb_id, qb_name } = body as { key: string; qb_id: string; qb_name: string };

    if (!key || !qb_id || !qb_name) {
      return NextResponse.json({ error: "key, qb_id, and qb_name required" }, { status: 400 });
    }

    if (!MAPPING_DEFINITIONS[key]) {
      return NextResponse.json({ error: "Invalid mapping key" }, { status: 400 });
    }

    const { error } = await supabase.from("qb_account_mappings").upsert({
      key,
      qb_id,
      qb_name,
      updated_at: new Date().toISOString(),
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
