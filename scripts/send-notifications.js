// =============================================================================
// scripts/send-notifications.js
// Runs via GitHub Actions cron — sends FCM push to all opted-in users
// =============================================================================

const admin = require("firebase-admin");

// ── Quotes (match exactly what App.jsx shows in-app) ─────────────────────────
const MORNING_QUOTES = [
  "Every morning is a chance to grind harder than yesterday! 🌅",
  "The early bird catches the success. Start studying now! 📚",
  "Your future self will thank you for studying right now! 💪",
  "Morning discipline = Evening success. Let's go! 🚀",
  "IIT dreams are built on morning consistency! Rise and grind! 🔥",
  "5 AM grinders beat midnight scrollers. You know what to do! 💯",
  "Today is day 1 of your new streak. Make it count! ✨",
  "Coffee + Books > Coffee + Phone. Choose wisely! ☕📖",
  "Your competitors are already studying. Don't fall behind! ⚡",
  "Nothing beats the feeling of productive mornings! Let's crush it! 🎯",
];

const NIGHT_QUOTES = [
  "Review what you learned today. Sleep is for the successful! 😴",
  "Another day closer to your dream college. Sleep well! 🎓",
  "Tonight's sleep = Tomorrow's energy for studying. Rest well! 🌙",
  "Reflect on your study session today. You did great! 👏",
  "Tomorrow's battles are won by today's preparation. Sleep tight! ⭐",
  "You crushed today's goals. Recover and come back stronger! 💪",
  "Even legends need rest. Sleep now, study tomorrow! 😴✨",
  "Your brain needs sleep to retain what you learned. Goodnight! 🧠💤",
  "Consistency beats intensity. Today was consistent. Well done! 🌟",
  "Dream about success, wake up and chase it! Goodnight, warrior! 🌙🔥",
];

// ── Validate environment ──────────────────────────────────────────────────────
const RAW_SA = process.env.FIREBASE_SERVICE_ACCOUNT;
const NOTIFICATION_TYPE = process.env.NOTIFICATION_TYPE || "morning";

if (!RAW_SA) {
  console.error(
    "❌ FIREBASE_SERVICE_ACCOUNT secret is missing.\n" +
    "   Add it in GitHub → Settings → Secrets and variables → Actions."
  );
  process.exit(1);
}

if (!["morning", "night"].includes(NOTIFICATION_TYPE)) {
  console.error(`❌ Unknown NOTIFICATION_TYPE: "${NOTIFICATION_TYPE}". Must be morning or night.`);
  process.exit(1);
}

// ── Parse service account JSON ────────────────────────────────────────────────
let serviceAccount;
try {
  serviceAccount = JSON.parse(RAW_SA);
} catch (err) {
  console.error(
    "❌ Failed to parse FIREBASE_SERVICE_ACCOUNT as JSON.\n" +
    "   Make sure you copied the entire JSON file content (including { and }).\n",
    err.message
  );
  process.exit(1);
}

// ── Initialize Firebase Admin ─────────────────────────────────────────────────
try {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
  console.log("✅ Firebase Admin initialized");
} catch (err) {
  console.error("❌ Firebase Admin init failed:", err.message);
  process.exit(1);
}

const db = admin.firestore();
const messaging = admin.messaging();

// ── Build notification content ────────────────────────────────────────────────
function buildNotification(type) {
  const quotes = type === "morning" ? MORNING_QUOTES : NIGHT_QUOTES;
  const quote = quotes[Math.floor(Math.random() * quotes.length)];

  if (type === "morning") {
    return {
      title: "🌅 Morning Strike! Sun is up!",
      body: `Your competition has been studying for 2 hours. Get up, Mortal! 🚀\n\n${quote}`,
      tag: "morning-strike",
    };
  } else {
    return {
      title: "🌙 End-of-Day Review!",
      body: `Did you earn your sleep or just borrow it? 😴\n\n${quote}`,
      tag: "night-strike",
    };
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n🚀 Sending [${NOTIFICATION_TYPE}] notifications — ${new Date().toISOString()}\n`);

  const { title, body, tag } = buildNotification(NOTIFICATION_TYPE);
  console.log(`📢 Title : ${title}`);
  console.log(`📝 Body  : ${body.slice(0, 80)}...`);

  // ── Step 1: Fetch all users ─────────────────────────────────────────────────
  // We fetch ALL docs and filter in JS — avoids needing a Firestore composite index
  let snapshot;
  try {
    snapshot = await db.collection("jeeWarriors").get();
    console.log(`\n📊 Total users in Firestore: ${snapshot.size}`);
  } catch (err) {
    console.error("❌ Firestore read failed:", err.message);
    process.exit(1);
  }

  // ── Step 2: Collect valid tokens ────────────────────────────────────────────
  const targets = []; // { uid, token }
  snapshot.forEach((doc) => {
    const data = doc.data();
    if (
      data.notificationsEnabled === true &&
      data.fcmToken &&
      typeof data.fcmToken === "string" &&
      data.fcmToken.length > 20
    ) {
      targets.push({ uid: doc.id, token: data.fcmToken });
    }
  });

  if (targets.length === 0) {
    console.log("ℹ️  No users with notifications enabled and a valid FCM token. Nothing to send.");
    process.exit(0);
  }

  console.log(`📱 Users to notify: ${targets.length}\n`);

  // ── Step 3: Send in batches of 500 (FCM multicast limit) ────────────────────
  const BATCH_SIZE = 500;
  const invalidUids = []; // tokens to clean up
  let totalSuccess = 0;
  let totalFailed = 0;

  for (let i = 0; i < targets.length; i += BATCH_SIZE) {
    const batch = targets.slice(i, i + BATCH_SIZE);
    const tokens = batch.map((t) => t.token);

    const message = {
      tokens,
      // notification block — shown by OS directly (works even on iOS/Android browsers)
      notification: {
        title,
        body,
      },
      // webpush block — overrides for web browsers (Chrome, Edge, Firefox)
      webpush: {
        notification: {
          title,
          body,
          icon: "/vite.svg",
          badge: "/vite.svg",
          tag,
          requireInteraction: true,
          vibrate: [200, 100, 200],
          renotify: true,
        },
        fcm_options: {
          link: "/",
        },
      },
      // data block — passed to firebase-messaging-sw.js onBackgroundMessage
      data: {
        type: NOTIFICATION_TYPE,
        tag,
        requireInteraction: "true",
      },
    };

    let response;
    try {
      response = await messaging.sendEachForMulticast(message);
    } catch (err) {
      console.error(`❌ Batch ${Math.floor(i / BATCH_SIZE) + 1} send error:`, err.message);
      totalFailed += batch.length;
      continue;
    }

    totalSuccess += response.successCount;
    totalFailed += response.failureCount;

    console.log(
      `  Batch ${Math.floor(i / BATCH_SIZE) + 1}: ` +
      `✅ ${response.successCount} sent, ❌ ${response.failureCount} failed`
    );

    // Collect invalid/expired tokens for cleanup
    response.responses.forEach((resp, idx) => {
      if (!resp.success) {
        const code = resp.error?.code || "";
        console.warn(`    ⚠️  [${batch[idx].uid}] ${code}`);
        if (
          code === "messaging/registration-token-not-registered" ||
          code === "messaging/invalid-registration-token" ||
          code === "messaging/invalid-argument" ||
          code === "messaging/mismatched-credential"
        ) {
          invalidUids.push(batch[idx].uid);
        }
      }
    });
  }

  // ── Step 4: Clean up expired/invalid tokens ──────────────────────────────────
  if (invalidUids.length > 0) {
    console.log(`\n🧹 Cleaning ${invalidUids.length} expired/invalid token(s) from Firestore...`);
    const firestoreBatch = db.batch();
    invalidUids.forEach((uid) => {
      firestoreBatch.update(db.collection("jeeWarriors").doc(uid), {
        fcmToken: admin.firestore.FieldValue.delete(),
        notificationsEnabled: false,
      });
    });
    try {
      await firestoreBatch.commit();
      console.log("✅ Cleanup done");
    } catch (err) {
      console.error("❌ Cleanup failed (non-fatal):", err.message);
    }
  }

  // ── Summary ──────────────────────────────────────────────────────────────────
  console.log(`\n${"─".repeat(50)}`);
  console.log(`✅ Success : ${totalSuccess}`);
  console.log(`❌ Failed  : ${totalFailed}`);
  console.log(`🧹 Cleaned : ${invalidUids.length}`);
  console.log(`${"─".repeat(50)}\n`);

  process.exit(0);
}

main().catch((err) => {
  console.error("💥 Fatal unhandled error:", err);
  process.exit(1);
});
