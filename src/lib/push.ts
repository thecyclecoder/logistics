export async function subscribeToPush(): Promise<{
  success: boolean;
  reason?: string;
}> {
  if (!("Notification" in window) || !("serviceWorker" in navigator)) {
    return { success: false, reason: "not_supported" };
  }
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return { success: false, reason: "denied" };

  const registration = await navigator.serviceWorker.ready;
  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!key) return { success: false, reason: "no_vapid_key" };

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(key) as BufferSource,
  });

  const resp = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(subscription),
  });
  return { success: resp.ok };
}

export async function checkSubscriptionExists(): Promise<boolean> {
  try {
    const resp = await fetch("/api/push/check", { cache: "no-store" });
    if (!resp.ok) return false;
    const data = await resp.json();
    return data.subscribed === true;
  } catch {
    return false;
  }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const arr = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) arr[i] = rawData.charCodeAt(i);
  return arr;
}
