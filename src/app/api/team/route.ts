import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// GET: list team members
export async function GET() {
  try {
    const supabase = createServiceClient();
    const { data } = await supabase
      .from("team_members")
      .select("id, email, role, status, invited_by, accepted_at, created_at")
      .order("created_at", { ascending: false });

    return NextResponse.json(data || []);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

// POST: create invite
export async function POST(request: NextRequest) {
  try {
    const { email, role } = await request.json();

    if (!email) {
      return NextResponse.json({ error: "email required" }, { status: 400 });
    }

    const validRoles = ["admin", "logistics", "view_only"];
    if (role && !validRoles.includes(role)) {
      return NextResponse.json({ error: "Invalid role. Use: admin, logistics, view_only" }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Check if already exists
    const { data: existing } = await supabase
      .from("team_members")
      .select("id, status")
      .eq("email", email.toLowerCase().trim())
      .single();

    if (existing && existing.status !== "revoked") {
      return NextResponse.json({ error: "Team member already exists" }, { status: 400 });
    }

    if (existing && existing.status === "revoked") {
      // Re-invite revoked member
      const { data: updated, error } = await supabase
        .from("team_members")
        .update({
          role: role || "view_only",
          status: "pending",
          invite_token: crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, ""),
          accepted_at: null,
        })
        .eq("id", existing.id)
        .select("id, email, role, status, invite_token")
        .single();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      const inviteUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/invite/${updated!.invite_token}`;
      return NextResponse.json({ ...updated, invite_url: inviteUrl });
    }

    const { data: member, error } = await supabase
      .from("team_members")
      .insert({
        email: email.toLowerCase().trim(),
        role: role || "view_only",
      })
      .select("id, email, role, status, invite_token")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const inviteUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/invite/${member!.invite_token}`;
    return NextResponse.json({ ...member, invite_url: inviteUrl });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

// PATCH: update role or revoke
export async function PATCH(request: NextRequest) {
  try {
    const { id, role, status } = await request.json();
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    const supabase = createServiceClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updates: any = {};
    if (role) updates.role = role;
    if (status) updates.status = status;

    const { data, error } = await supabase
      .from("team_members")
      .update(updates)
      .eq("id", id)
      .select("id, email, role, status")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

// DELETE: remove team member
export async function DELETE(request: NextRequest) {
  try {
    const { id } = await request.json();
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    const supabase = createServiceClient();
    const { error } = await supabase
      .from("team_members")
      .delete()
      .eq("id", id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
