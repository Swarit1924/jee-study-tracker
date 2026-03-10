// ============================================================
// firebase-messaging-sw.js  —  JEE GOD MODE
// Place this file in your project's  public/  directory.
// ============================================================

importScripts(
  "https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js",
);
importScripts(
  "https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js",
);

firebase.initializeApp({
  apiKey: "AIzaSyCYKXhLxMU_5HiqPKXd4XVDRcAgKrBm9fU",
  authDomain: "jee-study-tracker-61d42.firebaseapp.com",
  projectId: "jee-study-tracker-61d42",
  storageBucket: "jee-study-tracker-61d42.appspot.com",
  messagingSenderId: "26358272592",
  appId: "1:26358272592:web:412185ba3cce36191f3755",
});

const MORNING_QUOTES = [
  "Grind harder than yesterday! 🌅",
  "Early bird catches success! 📚",
  "Your future thanks you! 💪",
  "Discipline = Success! 🚀",
  "IIT built on morning grind! 🔥",
  "5AM grinders win! 💯",
  "Day 1 of streak! 💪",
  "Books > Phone! 📖",
  "Competitors studying! ⚡",
  "Productive mornings ROCK! 🎯",
];

const NIGHT_QUOTES = [
  "Review today, sleep well! 😴",
  "Closer to dream! 🎓",
  "Sleep = Energy! 🌙",
  "You crushed it! 👏",
  "Tomorrow won by today! ⭐",
  "Recover strong! 💪",
  "Legends rest! 😴✨",
  "Brain needs sleep! 🧠",
  "Consistent = Done! 🌟",
  "Dream success, Chase it! 🌙🔥",
];

const messaging = firebase.messaging();

// ✅ Handle FCM background messages
messaging.onBackgroundMessage((payload) => {
  console.log("📬 Background FCM message received:", payload);

  const notificationTitle = payload.notification?.title || "🌅 JEE God Mode";
  const notificationOptions = {
    body: payload.notification?.body || "Stay focused! 🎯",
    icon: "/vite.svg",
    badge: "/vite.svg",
    tag: payload.notification?.tag || "jee-notification",
    requireInteraction: true,
    vibrate: [200, 100, 200],
    data: payload.data || {},
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// ✅ Handle notification click
self.addEventListener("notificationclick", (event) => {
  console.log("👆 Notification clicked");
  event.notification.close();

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (let i = 0; i < clientList.length; i++) {
          const client = clientList[i];
          if ("focus" in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow("/");
        }
      }),
  );
});

// ✅ Log when notification is dismissed
self.addEventListener("notificationclose", (event) => {
  console.log("❌ Notification dismissed:", event.notification.tag);
});
