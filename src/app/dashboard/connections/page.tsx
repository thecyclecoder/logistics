import { createServiceClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Plug, CheckCircle2, XCircle } from "lucide-react";

export const revalidate = 0;

interface ConnectionCard {
  name: string;
  slug: string;
  description: string;
  connected: boolean;
}

export default async function ConnectionsPage() {
  const supabase = createServiceClient();

  // Check all credentials from DB
  const { data: allCreds } = await supabase
    .from("integration_credentials")
    .select("id, credentials");

  const credsMap = new Map<string, Record<string, string>>();
  for (const row of allCreds || []) {
    credsMap.set(row.id, row.credentials as Record<string, string>);
  }

  // Check QuickBooks OAuth tokens
  const { data: qbTokens } = await supabase
    .from("qb_tokens")
    .select("id")
    .limit(1);
  const qbHasTokens = (qbTokens && qbTokens.length > 0) || false;

  // Check Shopify OAuth tokens
  const { data: shopifyTokens } = await supabase
    .from("shopify_tokens")
    .select("id")
    .limit(1);
  const shopifyHasTokens = (shopifyTokens && shopifyTokens.length > 0) || false;

  const connections: ConnectionCard[] = [
    {
      name: "Amplifier",
      slug: "amplifier",
      description: "3PL fulfillment and inventory management",
      connected: !!credsMap.get("amplifier")?.api_key,
    },
    {
      name: "Amazon",
      slug: "amazon",
      description: "Amazon Seller Central via SP-API",
      connected: !!credsMap.get("amazon")?.client_id,
    },
    {
      name: "QuickBooks",
      slug: "quickbooks",
      description: "Accounting, products, and sales data",
      connected: !!credsMap.get("quickbooks")?.client_id && qbHasTokens,
    },
    {
      name: "Shopify",
      slug: "shopify",
      description: "Storefront and order management",
      connected: !!credsMap.get("shopify")?.client_id && shopifyHasTokens,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Connections</h1>
        <p className="text-sm text-gray-500 mt-1">
          Manage integrations and sync data from connected services.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {connections.map((conn) => (
          <Link
            key={conn.slug}
            href={`/dashboard/connections/${conn.slug}`}
            className="rounded-xl border border-gray-200 bg-white p-5 hover:border-gray-300 hover:shadow-sm transition-all"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100">
                  <Plug className="h-5 w-5 text-gray-600" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">
                    {conn.name}
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {conn.description}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                {conn.connected ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span className="text-xs font-medium text-green-700">
                      Connected
                    </span>
                  </>
                ) : (
                  <>
                    <XCircle className="h-4 w-4 text-gray-300" />
                    <span className="text-xs font-medium text-gray-400">
                      Not connected
                    </span>
                  </>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
