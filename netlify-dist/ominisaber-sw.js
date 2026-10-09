self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data?.json() || {};
  } catch {
    data = { body: event.data?.text() || "Você recebeu uma nova atualização." };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "OminiSaber", {
      body: data.body || "Há uma novidade esperando por você.",
      tag: data.tag || "ominisaber-notification",
      renotify: Boolean(data.renotify),
      data: {
        url: data.url || "/frontend/aluno/notificacoes/index.html",
        notificationId: data.notificationId || null,
      },
      actions: [{ action: "open", title: "Abrir no OminiSaber" }],
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(
    event.notification.data?.url || "/frontend/aluno/notificacoes/index.html",
    self.location.origin,
  ).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((client) => client.url === target);
      if (existing) return existing.focus();
      return self.clients.openWindow(target);
    }),
  );
});
