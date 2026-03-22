import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import crypto from "crypto";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ subscribed: false });
    }

    const serviceClient = createServiceClient();
    const perDevice = request.nextUrl.searchParams.get("per_device") === "true";

    if (perDevice) {
      // Check for this specific device (user_id + device_id derived from user-agent)
      const userAgent = request.headers.get("user-agent") || "unknown";
      const deviceId = crypto.createHash("sha256").update(userAgent).digest("hex").substring(0, 16);

      const { data } = await serviceClient
        .from("push_subscriptions")
        .select("id")
        .eq("user_id", user.id)
        .eq("device_id", deviceId)
        .limit(1);

      return NextResponse.json({ subscribed: (data?.length || 0) > 0 });
    }

    // Default: check if user has any subscription
    const { data } = await serviceClient
      .from("push_subscriptions")
      .select("id")
      .eq("user_id", user.id)
      .limit(1);

    return NextResponse.json({ subscribed: (data?.length || 0) > 0 });
  } catch {
    return NextResponse.json({ subscribed: false });
  }
}
