import { NextResponse } from "next/server";
import { getCredentials } from "@/lib/credentials";

export const dynamic = "force-dynamic";

const QB_AUTH_URL = "https://appcenter.intuit.com/connect/oauth2";

export async function GET() {
  const creds = await getCredentials("quickbooks");
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://shoptics.ai";

  const params = new URLSearchParams({
    client_id: creds.client_id,
    response_type: "code",
    scope: "com.intuit.quickbooks.accounting",
    redirect_uri: `${baseUrl}/api/qb/callback`,
    state: crypto.randomUUID(),
  });

  return NextResponse.redirect(`${QB_AUTH_URL}?${params}`);
}
