import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

import webpush from "web-push";

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.PUSH_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { title, body, type, data, user_id } = await request.json();

    if (!title || !body) {
      return NextResponse.json({ error: "title and body required" }, { status: 400 });
    }

    const supabase = createServiceClient();
    const query = user_id
      ? supabase.from("push_subscriptions").select("id, subscription").eq("user_id", user_id)
      : supabase.from("push_subscriptions").select("id, subscription");

    const { data: subs } = await query;

    if (!subs?.length) {
      return NextResponse.json({ sent: 0, subs_found: 0 });
    }

    webpush.setVapidDetails(
      "mailto:dylan@superfoodscompany.com",
      process.env.VAPID_PUBLIC_KEY!,
      process.env.VAPID_PRIVATE_KEY!
    );

    const payload = JSON.stringify({ title, body, type: type || "general", tag: type || "general", data: data || {} });

    let sent = 0;
    const errors: string[] = [];

    const results = await Promise.allSettled(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      subs.map((sub: any) => webpush.sendNotification(sub.subscription, payload))
    );

    for (const r of results) {
      if (r.status === "fulfilled") {
        sent++;
      } else {
        errors.push(r.reason?.message || String(r.reason));
        // Clean up expired subscriptions
        if (r.reason?.statusCode === 404 || r.reason?.statusCode === 410) {
          const idx = results.indexOf(r);
          if (subs[idx]) {
            await supabase.from("push_subscriptions").delete().eq("id", subs[idx].id);
          }
        }
      }
    }

    return NextResponse.json({ sent, subs_found: subs.length, errors: errors.length ? errors : undefined });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
