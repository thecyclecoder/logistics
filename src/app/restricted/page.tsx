"use client";

import { createClient } from "@/lib/supabase/client";
import { Lock } from "lucide-react";
import { useEffect, useState } from "react";

export default function RestrictedPage() {
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email || null);
    });
  }, []);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8 text-center">
          <div className="mx-auto h-14 w-14 bg-red-100 rounded-xl flex items-center justify-center mb-4">
            <Lock className="h-7 w-7 text-red-600" />
          </div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">
            This area is restricted
          </h1>
          <p className="text-sm text-gray-500 mb-1">
            You do not have access to this application.
          </p>
          {email && (
            <p className="text-sm text-gray-400 mb-6">
              Signed in as {email}
            </p>
          )}
          <button
            onClick={handleSignOut}
            className="w-full rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-800 transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
