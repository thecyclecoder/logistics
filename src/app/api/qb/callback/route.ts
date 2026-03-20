import { NextRequest, NextResponse } from "next/server";

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

  // Display tokens for initial setup — in production you'd store these securely
  return new NextResponse(
    `<html><body style="font-family:sans-serif;padding:40px;max-width:600px;margin:0 auto">
      <h2>QuickBooks Connected!</h2>
      <p><strong>Realm ID:</strong> ${realmId}</p>
      <p><strong>Refresh Token:</strong></p>
      <textarea readonly style="width:100%;height:80px;font-size:12px">${tokens.refresh_token}</textarea>
      <p style="color:#666;font-size:13px">Add these to your .env.local as QB_REALM_ID and QB_REFRESH_TOKEN, then redeploy.</p>
      <a href="/dashboard">Go to Dashboard</a>
    </body></html>`,
    { headers: { "Content-Type": "text/html" } }
  );
}
