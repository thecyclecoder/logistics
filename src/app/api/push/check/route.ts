import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ subscribed: false });
    }

    // Use service client to bypass RLS
    const serviceClient = createServiceClient();
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
