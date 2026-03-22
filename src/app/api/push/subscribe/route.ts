import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server";
import crypto from "crypto";

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const subscription = await request.json();
    const userAgent = request.headers.get("user-agent") || "unknown";
    const deviceId = crypto.createHash("sha256").update(userAgent).digest("hex").substring(0, 16);

    // Use service client to bypass RLS for upsert
    const serviceClient = createServiceClient();
    const { error } = await serviceClient.from("push_subscriptions").upsert(
      {
        user_id: user.id,
        subscription,
        user_agent: userAgent,
        device_id: deviceId,
      },
      { onConflict: "user_id,device_id" }
    );

    if (error) {
      return NextResponse.json({ error: "Failed to save subscription" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
