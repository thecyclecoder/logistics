"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { CheckCircle2, LogIn, Loader2 } from "lucide-react";

export default function InviteClient({
  token,
  email,
  role,
}: {
  token: string;
  email: string;
  role: string;
}) {
  const [accepting, setAccepting] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoAccepting, setAutoAccepting] = useState(true);

  // Auto-accept if user is already signed in with matching email
  useEffect(() => {
    const tryAutoAccept = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user && user.email?.toLowerCase() === email.toLowerCase()) {
        const res = await fetch("/api/team/accept", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        if (res.ok) {
          setAccepted(true);
        }
      }
      setAutoAccepting(false);
    };
    tryAutoAccept();
  }, [token, email]);

  const roleLabels: Record<string, string> = {
    admin: "Admin",
    logistics: "Logistics",
    view_only: "View Only",
  };

  const handleAccept = async () => {
    setAccepting(true);
    setError(null);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      // Redirect to Google OAuth, then back here
      await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(`/invite/${token}`)}` },
      });
      return;
    }

    // Check email matches
    if (user.email?.toLowerCase() !== email.toLowerCase()) {
      setError(`This invite is for ${email}. You're signed in as ${user.email}. Sign out and try again with the correct account.`);
      setAccepting(false);
      return;
    }

    // Accept the invite
    const res = await fetch("/api/team/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });

    if (res.ok) {
      setAccepted(true);
    } else {
      const data = await res.json();
      setError(data.error || "Failed to accept invite");
    }
    setAccepting(false);
  };

  if (autoAccepting) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center max-w-md">
          <Loader2 className="mx-auto h-8 w-8 text-brand-500 animate-spin mb-4" />
          <p className="text-sm text-gray-500">Setting up your access...</p>
        </div>
      </div>
    );
  }

  if (accepted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center max-w-md">
          <CheckCircle2 className="mx-auto h-12 w-12 text-green-500 mb-4" />
          <h1 className="text-xl font-semibold text-gray-900">Welcome to Shoptics!</h1>
          <p className="text-sm text-gray-500 mt-2">Your invite has been accepted. You have <strong>{roleLabels[role]}</strong> access.</p>
          <a href="/dashboard" className="inline-block mt-4 rounded-lg bg-brand-600 px-6 py-2 text-sm font-medium text-white hover:bg-brand-700">
            Go to Dashboard
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="rounded-xl border border-gray-200 bg-white p-8 text-center max-w-md">
        <h1 className="text-xl font-semibold text-gray-900">You&apos;re Invited to Shoptics</h1>
        <p className="text-sm text-gray-500 mt-2">
          You&apos;ve been invited as <strong>{roleLabels[role]}</strong> ({email})
        </p>

        {error && (
          <p className="text-sm text-red-600 mt-3 bg-red-50 rounded-lg px-4 py-2">{error}</p>
        )}

        <button
          onClick={handleAccept}
          disabled={accepting}
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-brand-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50 transition-colors"
        >
          <LogIn className="h-4 w-4" />
          {accepting ? "Accepting..." : "Sign in with Google & Accept"}
        </button>
      </div>
    </div>
  );
}
