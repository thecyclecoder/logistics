import { NextRequest, NextResponse } from "next/server";
import { createServiceClient, createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json();
    if (!token) return NextResponse.json({ error: "token required" }, { status: 400 });

    // Verify user is authenticated
    const authClient = createClient();
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const supabase = createServiceClient();

    // Find the invite
    const { data: invite } = await supabase
      .from("team_members")
      .select("id, email, status")
      .eq("invite_token", token)
      .single();

    if (!invite) return NextResponse.json({ error: "Invalid invite token" }, { status: 404 });
    if (invite.status !== "pending") return NextResponse.json({ error: "Invite is no longer pending" }, { status: 400 });

    // Verify email matches
    if (user.email?.toLowerCase() !== invite.email.toLowerCase()) {
      return NextResponse.json({ error: `This invite is for ${invite.email}` }, { status: 403 });
    }

    // Accept
    const { error } = await supabase
      .from("team_members")
      .update({ status: "accepted", accepted_at: new Date().toISOString() })
      .eq("id", invite.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
