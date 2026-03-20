import { NextResponse } from "next/server";

const QB_AUTH_URL = "https://appcenter.intuit.com/connect/oauth2";

export async function GET() {
  const params = new URLSearchParams({
    client_id: process.env.QB_CLIENT_ID!,
    response_type: "code",
    scope: "com.intuit.quickbooks.accounting",
    redirect_uri: `${process.env.NEXT_PUBLIC_SITE_URL}/api/qb/callback`,
    state: crypto.randomUUID(),
  });

  return NextResponse.redirect(`${QB_AUTH_URL}?${params}`);
}
