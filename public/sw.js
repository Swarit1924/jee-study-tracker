// ============================================================
// sw.js  —  JEE GOD MODE  |  Main Service Worker
// Place this file in your project's  public/  directory.
// ============================================================

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyCYKXhLxMU_5HiqPKXd4XVDRcAgKrBm9fU",
  authDomain: "jee-study-tracker-61d42.firebaseapp.com",
  projectId: "jee-study-tracker-61d42",
  storageBucket: "jee-study-tracker-61d42.appspot.com",
  messagingSenderId: "26358272592",
  appId: "1:26358272592:web:412185ba3cce36191f3755",
};

const VAPID_KEY =
  "BND-Oa36a-OiuvJ0HeGEpxPwGYzetldtWGADTqVlapJZy-n6_rQDKDz4uh644_pID4YsQc4tZPQjFcAfes6lB9E";

const CACHE_NAME = "jee-god-mode-v1";
const ASSETS_TO_CACHE = ["/", "/index.html"];

// ── 1. Firebase Messaging (compat SDK) ───────────────────────────────────────
let firebaseMessagingReady = false;
try {
  importScripts(
    "https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js",
  );
  importScripts(
    "https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js",
  );

  if (!self.__fbApp) {
    self.__fbApp = firebase.initializeApp(FIREBASE_CONFIG);
  }
  const messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    console.log("📬 [sw.js] Background FCM message:", payload);

    const title =
      payload.notification?.title || payload.data?.title || "JEE GOD MODE 🎯";
    const body =
      payload.notification?.body || payload.data?.body || "Time to grind! ⚔️";

    self.registration.showNotification(title, {
      body,
      icon: "/vite.svg",
      badge: "/vite.svg",
      tag: payload.data?.tag || "jee-push",
      requireInteraction: payload.data?.requireInteraction === "true",
      vibrate: [200, 100, 200],
      data: payload.data || {},
    });
  });

  firebaseMessagingReady = true;
  console.log("[sw.js] ✅ Firebase Messaging ready");
} catch (err) {
  console.warn(
    "[sw.js] ⚠️ Firebase SDK failed, native push active:",
    err.message,
  );
}

// ── 2. Native Web-Push fallback ──────────────────────────────────────────────
self.addEventListener("push", (event) => {
  if (firebaseMessagingReady) return;

  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (_) {
    data = { body: event.data?.text() || "Time to study!" };
  }

  const title = data.notification?.title || data.title || "JEE GOD MODE 🎯";
  const options = {
    body: data.notification?.body || data.body || "Don't stop grinding! ⚔️",
    icon: "/vite.svg",
    badge: "/vite.svg",
    tag: data.tag || "jee-push-native",
    requireInteraction: !!data.requireInteraction,
    vibrate: [200, 100, 200],
    data: data.data || {},
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// ── 3. Notification click ────────────────────────────────────────────────────
self.addEventListener("notificationclick", (event) => {
  console.log("👆 [sw.js] Notification clicked");
  event.notification.close();

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if ("focus" in client) return client.focus();
        }
        return clients.openWindow("/");
      }),
  );
});

// ── 4. Notification dismissed ───────────────────────────────────────────────
self.addEventListener("notificationclose", (event) => {
  console.log("❌ [sw.js] Notification dismissed:", event.notification.tag);
});

// ── 5. Install ───────────────────────────────────────────────────────────────
self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS_TO_CACHE))
      .catch((err) =>
        console.warn("[sw.js] Cache pre-fetch failed (non-fatal):", err),
      ),
  );
});

// ── 6. Activate ──────────────────────────────────────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

// ── 7. Fetch — network-first with cache fallback ─────────────────────────────
self.addEventListener("fetch", (event) => {
  if (
    event.request.method !== "GET" ||
    !event.request.url.startsWith(self.location.origin)
  )
    return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches
            .open(CACHE_NAME)
            .then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() =>
        caches.match(event.request).then(
          (cached) =>
            cached ||
            new Response("Offline — open the app while online first.", {
              status: 503,
              headers: { "Content-Type": "text/plain" },
            }),
        ),
      ),
  );
});
