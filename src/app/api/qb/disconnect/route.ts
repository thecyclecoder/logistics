import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getCredentials } from "@/lib/credentials";

const QB_REVOKE_URL = "https://developer.api.intuit.com/v2/oauth2/tokens/revoke";

export async function GET() {
  const supabase = createServiceClient();
  const { data: tokens } = await supabase
    .from("qb_tokens")
    .select("refresh_token")
    .eq("id", "current")
    .single();

  if (!tokens?.refresh_token) {
    return NextResponse.json({ status: "no token to revoke" });
  }

  const creds = await getCredentials("quickbooks");
  const basicAuth = Buffer.from(
    `${creds.client_id}:${creds.client_secret}`
  ).toString("base64");

  const res = await fetch(QB_REVOKE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basicAuth}`,
    },
    body: new URLSearchParams({
      token: tokens.refresh_token,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json(
      { error: "Revoke failed", details: text },
      { status: 500 }
    );
  }

  // Clean up tokens
  await supabase.from("qb_tokens").delete().eq("id", "current");

  return NextResponse.json({ status: "disconnected" });
}
