self.addEventListener("push", function (event) {
  if (!event.data) return;

  const data = event.data.json();

  const options = {
    body: data.body || "",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag: data.type || "general",
    data: {
      type: data.type || "general",
      timestamp: data.timestamp,
    },
    renotify: true,
  };

  event.waitUntil(
    self.registration.showNotification(data.title || "Shoptics", options)
  );
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();

  const type = event.notification.data?.type || "general";
  let url = "/dashboard";

  switch (type) {
    case "low_stock":
      url = "/dashboard";
      break;
    case "replenishment":
      url = "/dashboard";
      break;
    case "month_end":
      url = "/dashboard";
      break;
    case "variance":
      url = "/dashboard/inventory";
      break;
    case "unmapped":
      url = "/dashboard/mapping";
      break;
    case "snapshot_missing":
      url = "/dashboard/sync";
      break;
    default:
      url = "/dashboard";
  }

  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then(function (clientList) {
      for (var i = 0; i < clientList.length; i++) {
        var client = clientList[i];
        if (client.url.includes(url) && "focus" in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(url);
      }
    })
  );
});

self.addEventListener("install", function () {
  self.skipWaiting();
});

self.addEventListener("activate", function (event) {
  event.waitUntil(self.clients.claim());
});
