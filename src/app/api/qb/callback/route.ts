import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

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

  const basicAuth = Buffer.from(
    `${process.env.QB_CLIENT_ID}:${process.env.QB_CLIENT_SECRET}`
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
      redirect_uri: `${process.env.NEXT_PUBLIC_SITE_URL}/api/qb/callback`,
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

  // Store refresh token in Supabase so it auto-rotates
  const supabase = createServiceClient();
  await supabase.from("qb_tokens").upsert({
    id: "current",
    refresh_token: tokens.refresh_token,
    realm_id: realmId,
    updated_at: new Date().toISOString(),
  });

  const { origin } = new URL(request.url);
  return NextResponse.redirect(`${origin}/dashboard`);
}
