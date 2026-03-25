"use client";

import { useState, useEffect } from "react";
import { Users, UserPlus, Copy, CheckCircle2, XCircle, Shield, Eye, Truck, RefreshCw } from "lucide-react";

interface TeamMember {
  id: string;
  email: string;
  role: string;
  status: string;
  invited_by: string | null;
  accepted_at: string | null;
  created_at: string;
  invite_url?: string;
}

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  logistics: "Logistics",
  view_only: "View Only",
};

const ROLE_STYLES: Record<string, string> = {
  admin: "bg-purple-50 text-purple-700",
  logistics: "bg-blue-50 text-blue-700",
  view_only: "bg-gray-100 text-gray-600",
};

const ROLE_ICONS: Record<string, typeof Shield> = {
  admin: Shield,
  logistics: Truck,
  view_only: Eye,
};

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700",
  accepted: "bg-green-50 text-green-700",
  revoked: "bg-red-50 text-red-700",
};

export default function TeamPage() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("view_only");
  const [inviting, setInviting] = useState(false);
  const [inviteResult, setInviteResult] = useState<{ ok: boolean; message: string; url?: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const loadMembers = () => {
    fetch("/api/team")
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d)) setMembers(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(loadMembers, []);

  const handleInvite = async () => {
    if (!inviteEmail) return;
    setInviting(true);
    setInviteResult(null);
    setCopied(false);
    try {
      const res = await fetch("/api/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });
      const data = await res.json();
      if (res.ok) {
        setInviteResult({ ok: true, message: `Invite created for ${inviteEmail}`, url: data.invite_url });
        setInviteEmail("");
        loadMembers();
      } else {
        setInviteResult({ ok: false, message: data.error || "Failed to create invite" });
      }
    } catch {
      setInviteResult({ ok: false, message: "Request failed" });
    } finally {
      setInviting(false);
    }
  };

  const handleRoleChange = async (id: string, role: string) => {
    await fetch("/api/team", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, role }),
    });
    loadMembers();
  };

  const handleRemove = async (id: string) => {
    if (!confirm("Remove this team member? They will lose all access.")) return;
    await fetch("/api/team", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    loadMembers();
  };

  const copyInviteLink = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Team</h1>
        <p className="text-sm text-gray-500 mt-1">Invite team members and manage access levels.</p>
      </div>

      {/* Invite Form */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="flex items-center gap-2 mb-4">
          <UserPlus className="h-5 w-5 text-gray-600" />
          <h2 className="text-base font-semibold text-gray-900">Invite Team Member</h2>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="team@example.com"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm placeholder-gray-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              <option value="view_only">View Only</option>
              <option value="logistics">Logistics</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <button
            onClick={handleInvite}
            disabled={inviting || !inviteEmail}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50 transition-colors"
          >
            {inviting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
            {inviting ? "Inviting..." : "Create Invite"}
          </button>
        </div>

        {inviteResult && (
          <div className="mt-3">
            <div className={`flex items-center gap-1.5 text-sm ${inviteResult.ok ? "text-green-700" : "text-red-700"}`}>
              {inviteResult.ok ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
              {inviteResult.message}
            </div>
            {inviteResult.url && (
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={inviteResult.url}
                  className="flex-1 rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-xs font-mono text-gray-700"
                />
                <button
                  onClick={() => copyInviteLink(inviteResult.url!)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
                >
                  {copied ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Team Members List */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="flex items-center gap-2 mb-4">
          <Users className="h-5 w-5 text-gray-600" />
          <h2 className="text-base font-semibold text-gray-900">Team Members ({members.length})</h2>
        </div>

        {loading ? (
          <p className="text-sm text-gray-400">Loading...</p>
        ) : members.length === 0 ? (
          <p className="text-sm text-gray-400">No team members yet. Create an invite above.</p>
        ) : (
          <div className="space-y-3">
            {members.map((m) => {
              const RoleIcon = ROLE_ICONS[m.role] || Eye;
              return (
                <div key={m.id} className="flex items-center justify-between rounded-lg bg-gray-50 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-200">
                      <RoleIcon className="h-4 w-4 text-gray-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{m.email}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_STYLES[m.role]}`}>
                          {ROLE_LABELS[m.role]}
                        </span>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[m.status]}`}>
                          {m.status}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={m.role}
                      onChange={(e) => handleRoleChange(m.id, e.target.value)}
                      className="rounded-lg border border-gray-300 px-2 py-1 text-xs focus:border-brand-500 focus:outline-none"
                    >
                      <option value="view_only">View Only</option>
                      <option value="logistics">Logistics</option>
                      <option value="admin">Admin</option>
                    </select>
                    <button
                      onClick={() => handleRemove(m.id)}
                      className="rounded-lg border border-red-200 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Role Descriptions */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Role Permissions</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-lg bg-purple-50 px-4 py-3">
            <p className="text-sm font-semibold text-purple-800">Admin</p>
            <p className="text-xs text-purple-600 mt-1">Full access: connections, month-end closing, journal entries, team management</p>
          </div>
          <div className="rounded-lg bg-blue-50 px-4 py-3">
            <p className="text-sm font-semibold text-blue-800">Logistics</p>
            <p className="text-xs text-blue-600 mt-1">Run syncs, edit mappings/products, view all data. No month-end or connections</p>
          </div>
          <div className="rounded-lg bg-gray-100 px-4 py-3">
            <p className="text-sm font-semibold text-gray-700">View Only</p>
            <p className="text-xs text-gray-500 mt-1">Read-only access to all dashboards and data. No changes allowed</p>
          </div>
        </div>
      </div>
    </div>
  );
}
