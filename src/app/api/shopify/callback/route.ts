import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const shop = searchParams.get("shop"); // This is the REAL domain (e.g., 2a0f99ea-c.myshopify.com)

  if (!code || !shop) {
    return NextResponse.json(
      { error: "Missing code or shop parameter" },
      { status: 400 }
    );
  }

  const res = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.SHOPIFY_CLIENT_ID!,
      client_secret: process.env.SHOPIFY_CLIENT_SECRET!,
      code,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json(
      { error: "Token exchange failed", details: text },
      { status: 500 }
    );
  }

  const data = await res.json();

  // Display the actual shop domain and access token for env setup
  return new NextResponse(
    `<html><body style="font-family:sans-serif;padding:40px;max-width:600px;margin:0 auto">
      <h2>Shopify Connected!</h2>
      <p><strong>Shop Domain (use this one for API calls):</strong></p>
      <textarea readonly style="width:100%;height:40px;font-size:14px">${shop}</textarea>
      <p><strong>Access Token:</strong></p>
      <textarea readonly style="width:100%;height:40px;font-size:12px">${data.access_token}</textarea>
      <p style="color:#666;font-size:13px">
        Add these to your .env.local:<br>
        <code>SHOPIFY_STORE_DOMAIN=${shop}</code><br>
        <code>SHOPIFY_ACCESS_TOKEN=${data.access_token}</code><br><br>
        Important: Use <strong>${shop}</strong> (not superfoodsco.myshopify.com) for all API calls.
      </p>
      <a href="/dashboard">Go to Dashboard</a>
    </body></html>`,
    { headers: { "Content-Type": "text/html" } }
  );
}
