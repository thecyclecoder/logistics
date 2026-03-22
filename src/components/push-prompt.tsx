"use client";

import { useEffect, useState } from "react";
import { Bell, X } from "lucide-react";

export default function PushPrompt() {
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Register service worker
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    // Check if this specific device is subscribed in the DB (userid + deviceid)
    // Server derives device_id from user-agent header automatically
    fetch("/api/push/check?per_device=true", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (data.subscribed) {
          // Already subscribed — re-subscribe silently to keep endpoint fresh
          if ("Notification" in window && Notification.permission === "granted") {
            import("@/lib/push").then(({ subscribeToPush }) => {
              subscribeToPush().catch(() => {});
            });
          }
        } else {
          setShowPrompt(true);
        }
      })
      .catch(() => setShowPrompt(true));
  }, []);

  const handleEnable = async () => {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      alert("To enable notifications, add this app to your Home Screen first (Share → Add to Home Screen), then open it from there and tap Enable again.");
      return;
    }
    // Ensure service worker is registered first
    try {
      await navigator.serviceWorker.register("/sw.js");
    } catch {
      // may already be registered
    }
    const { subscribeToPush } = await import("@/lib/push");
    const result = await subscribeToPush();
    if (result.success) {
      setShowPrompt(false);
    } else if (result.reason === "denied") {
      alert("Notifications were denied. Please enable them in your device settings for this app.");
    }
  };

  if (!showPrompt) return null;

  return (
    <div className="mb-4 flex items-center justify-between rounded-lg border border-brand-200 bg-brand-50 px-4 py-2.5">
      <div className="flex items-center gap-2">
        <Bell className="h-4 w-4 text-brand-600" />
        <span className="text-sm text-brand-800">Enable push notifications for stock alerts and reminders</span>
      </div>
      <div className="flex items-center gap-2">
        <button onClick={handleEnable} className="rounded-lg bg-brand-600 px-3 py-1 text-xs font-medium text-white hover:bg-brand-700">Enable</button>
        <button onClick={() => setShowPrompt(false)} className="rounded p-1 text-brand-400 hover:text-brand-600"><X className="h-3.5 w-3.5" /></button>
      </div>
    </div>
  );
}
