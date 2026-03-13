// ============================================================
// sw.js  —  JEE Study Tracker  |  Main Service Worker
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

const CACHE_NAME = "jee-tracker-v2";
const ASSETS_TO_CACHE = ["/", "/index.html"];

// ── 1. Firebase Messaging ─────────────────────────────────────────────────────
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

  // Handles ALL incoming FCM messages — both when app is open and when closed.
  // App.jsx does NOT have its own onMessage handler (removed to prevent duplicates).
  messaging.onBackgroundMessage((payload) => {
    console.log("[sw.js] 📬 FCM message received:", payload);

    const title = payload.notification?.title || "JEE Study Tracker 🎯";
    const body = payload.notification?.body || "Time to grind! ⚔️";
    const tag =
      payload.data?.tag || payload.notification?.tag || "jee-notification";

    // IMPORTANT: return the promise so Chrome never drops this notification
    return self.registration.showNotification(title, {
      body,
      icon: "/icons/icon-192x192.png",
      badge: "/icons/icon-192x192.png",
      tag,
      renotify: true,
      requireInteraction: false,
      vibrate: [200, 100, 200],
      data: payload.data || {},
    });
  });

  console.log("[sw.js] ✅ Firebase Messaging ready");
} catch (err) {
  console.warn("[sw.js] ⚠️ Firebase Messaging failed:", err.message);
}

// ── 2. Notification click ─────────────────────────────────────────────────────
self.addEventListener("notificationclick", (event) => {
  console.log("[sw.js] 👆 Notification clicked");
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

// ── 3. Install ────────────────────────────────────────────────────────────────
self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS_TO_CACHE))
      .catch((err) => console.warn("[sw.js] Cache pre-fetch failed:", err)),
  );
});

// ── 4. Activate ───────────────────────────────────────────────────────────────
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

// ── 5. Fetch — network-first with cache fallback ──────────────────────────────
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
