import { NextResponse } from "next/server";

const QB_REVOKE_URL = "https://developer.api.intuit.com/v2/oauth2/tokens/revoke";

export async function GET() {
  if (!process.env.QB_REFRESH_TOKEN) {
    return NextResponse.json({ status: "no token to revoke" });
  }

  const basicAuth = Buffer.from(
    `${process.env.QB_CLIENT_ID}:${process.env.QB_CLIENT_SECRET}`
  ).toString("base64");

  const res = await fetch(QB_REVOKE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basicAuth}`,
    },
    body: new URLSearchParams({
      token: process.env.QB_REFRESH_TOKEN,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json(
      { error: "Revoke failed", details: text },
      { status: 500 }
    );
  }

  return NextResponse.json({ status: "disconnected" });
}
