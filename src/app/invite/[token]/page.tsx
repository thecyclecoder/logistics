import { createServiceClient } from "@/lib/supabase/server";
import InviteClient from "./invite-client";

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = createServiceClient();

  const { data: invite } = await supabase
    .from("team_members")
    .select("id, email, role, status")
    .eq("invite_token", token)
    .single();

  if (!invite) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center max-w-md">
          <h1 className="text-xl font-semibold text-gray-900">Invalid Invite</h1>
          <p className="text-sm text-gray-500 mt-2">This invite link is invalid or has expired.</p>
        </div>
      </div>
    );
  }

  if (invite.status === "accepted") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center max-w-md">
          <h1 className="text-xl font-semibold text-gray-900">Already Accepted</h1>
          <p className="text-sm text-gray-500 mt-2">This invite has already been accepted.</p>
          <a href="/dashboard" className="inline-block mt-4 rounded-lg bg-brand-600 px-6 py-2 text-sm font-medium text-white hover:bg-brand-700">
            Go to Dashboard
          </a>
        </div>
      </div>
    );
  }

  if (invite.status === "revoked") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center max-w-md">
          <h1 className="text-xl font-semibold text-gray-900">Invite Revoked</h1>
          <p className="text-sm text-gray-500 mt-2">This invite has been revoked. Contact the admin.</p>
        </div>
      </div>
    );
  }

  return <InviteClient token={token} email={invite.email} role={invite.role} />;
}
