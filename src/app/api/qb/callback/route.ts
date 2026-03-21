import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getCredentials } from "@/lib/credentials";

const QB_TOKEN_URL = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const realmId = searchParams.get("realmId");

  if (!code || !realmId) {
    return NextResponse.json(
      { error: "Missing code or realmId" },
      { status: 400 }
    );
  }

  const creds = await getCredentials("quickbooks");
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://logistics-beige-seven.vercel.app";
  const basicAuth = Buffer.from(
    `${creds.client_id}:${creds.client_secret}`
  ).toString("base64");

  const res = await fetch(QB_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basicAuth}`,
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: `${baseUrl}/api/qb/callback`,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json(
      { error: "Token exchange failed", details: text },
      { status: 500 }
    );
  }

  const tokens = await res.json();

  const supabase = createServiceClient();
  const { error: upsertError } = await supabase.from("qb_tokens").upsert({
    id: "current",
    refresh_token: tokens.refresh_token,
    realm_id: realmId,
    updated_at: new Date().toISOString(),
  });

  if (upsertError) {
    return NextResponse.json(
      { error: "Failed to store tokens", details: upsertError.message },
      { status: 500 }
    );
  }

  const { origin } = new URL(request.url);
  return NextResponse.redirect(`${origin}/dashboard/connections/quickbooks`);
}
