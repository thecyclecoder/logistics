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

  return new NextResponse(
    `<html><body style="font-family:sans-serif;padding:40px;max-width:600px;margin:0 auto">
      <h2>QuickBooks Connected!</h2>
      <p style="color:green">Refresh token stored in database — it will auto-rotate on each use.</p>
      <p><strong>Realm ID:</strong></p>
      <textarea readonly style="width:100%;height:40px;font-size:14px">${realmId}</textarea>
      <p style="color:#666;font-size:13px">Add this as QB_REALM_ID in your env vars, then you're all set.</p>
      <a href="/dashboard" style="display:inline-block;margin-top:16px;padding:8px 20px;background:#0c8de6;color:white;text-decoration:none;border-radius:8px">Go to Dashboard</a>
    </body></html>`,
    { headers: { "Content-Type": "text/html" } }
  );
}
