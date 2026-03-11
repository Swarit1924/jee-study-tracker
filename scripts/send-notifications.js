// =============================================================================
// scripts/send-notifications.js
// ALL notifications — conditions checked per-user from Firestore
// Duplicate prevention via Firestore — users never get same notif twice/day
// =============================================================================

const admin = require("firebase-admin");

// ── ICON — uses your actual app icon (PNG, not SVG) ───────────────────────────
const APP_ICON = "/icons/icon-192x192.png";
const APP_BADGE = "/icons/icon-192x192.png";

// ── Quotes — identical to App.jsx ─────────────────────────────────────────────
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

const EGO_INSULTS = [
  "Your parents are telling neighbors you're studying. Stop making them LIARS.",
  "40,000 students just finished a mock test. You? Sleeping.",
  "Average effort = Average life. Enjoy your local college.",
  "Tera competition padh raha, tu so gaya? PATHETIC.",
  "NTA doesn't care about your 'rest.' They're waiting for your FAILURE.",
  "Every second you wasted yesterday, a topper solved 3 problems.",
  "Lakhs spent on coaching. You? SKIPPED a day like a zombie.",
  "Mom tells relatives you're preparing hard. She's LYING to save face.",
];

const MILESTONE_MESSAGES = {
  7: "7-day streak champion! You're on fire! 🔥",
  21: "21-day warrior! Consistency is key! 💪",
  30: "30-day legend! You're unstoppable! 👑",
  60: "60-day god mode activated! ⚡",
  90: "90-day elite! This is excellence! 🌟",
  365: "365-day immortal! You're a legend! 🎊",
};

const MILESTONE_DAYS = [7, 21, 30, 60, 90, 365];

// ── Date helpers ──────────────────────────────────────────────────────────────
function getISTDateStr(date) {
  const utc = date.getTime() + date.getTimezoneOffset() * 60000;
  const ist = new Date(utc + 5.5 * 3600000);
  const y = ist.getFullYear();
  const m = String(ist.getMonth() + 1).padStart(2, "0");
  const d = String(ist.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getTodayIST() {
  return getISTDateStr(new Date());
}
function getYesterdayIST() {
  const d = new Date();
  d.setTime(d.getTime() - 24 * 60 * 60 * 1000);
  return getISTDateStr(d);
}

function isSundayIST() {
  const utc = Date.now() + new Date().getTimezoneOffset() * 60000;
  return new Date(utc + 5.5 * 3600000).getDay() === 0;
}

function randomFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ── Duplicate prevention via Firestore ────────────────────────────────────────
// Stores: notifsSent.{ "2026-03-11": ["morning","night","reminder"] }
async function wasAlreadySent(db, uid, today, type) {
  try {
    const snap = await db.collection("jeeWarriors").doc(uid).get();
    const sent = ((snap.data() || {}).notifsSent || {})[today] || [];
    return sent.includes(type);
  } catch (_) {
    return false;
  }
}

async function markAsSent(db, uid, today, type) {
  try {
    await db
      .collection("jeeWarriors")
      .doc(uid)
      .update({
        [`notifsSent.${today}`]: admin.firestore.FieldValue.arrayUnion(type),
      });
  } catch (_) {}
}

// ── FCM batch sender ──────────────────────────────────────────────────────────
async function sendToTargets(
  messaging,
  db,
  targets,
  notification,
  type,
  today,
) {
  if (targets.length === 0) {
    console.log(`  ℹ️  No targets for [${type}]`);
    return;
  }

  const BATCH = 500;
  let totalSuccess = 0;
  let totalFailed = 0;
  const invalidUids = [];

  for (let i = 0; i < targets.length; i += BATCH) {
    const batch = targets.slice(i, i + BATCH);

    const message = {
      tokens: batch.map((t) => t.token),
      notification: {
        title: notification.title,
        body: notification.body,
      },
      webpush: {
        notification: {
          title: notification.title,
          body: notification.body,
          icon: APP_ICON, // ✅ PNG icon — shows app logo
          badge: APP_BADGE, // ✅ PNG badge
          tag: notification.tag,
          requireInteraction: true,
          vibrate: [200, 100, 200],
          renotify: true,
        },
        fcm_options: { link: "/" },
      },
      data: {
        tag: notification.tag,
        requireInteraction: "true",
        type,
      },
    };

    let response;
    try {
      response = await messaging.sendEachForMulticast(message);
    } catch (err) {
      console.error(`  ❌ Batch error:`, err.message);
      totalFailed += batch.length;
      continue;
    }

    totalSuccess += response.successCount;
    totalFailed += response.failureCount;

    // Mark as sent for successful deliveries
    const markPromises = [];
    response.responses.forEach((resp, idx) => {
      if (resp.success) {
        markPromises.push(markAsSent(db, batch[idx].uid, today, type));
      } else {
        const code = resp.error?.code || "";
        console.warn(`  ⚠️  [${batch[idx].uid}] ${code}`);
        if (
          code === "messaging/registration-token-not-registered" ||
          code === "messaging/invalid-registration-token" ||
          code === "messaging/invalid-argument"
        ) {
          invalidUids.push(batch[idx].uid);
        }
      }
    });
    await Promise.all(markPromises);
  }

  // Clean up invalid/expired tokens
  if (invalidUids.length > 0) {
    console.log(`  🧹 Cleaning ${invalidUids.length} invalid token(s)`);
    const cleanBatch = db.batch();
    invalidUids.forEach((uid) => {
      cleanBatch.update(db.collection("jeeWarriors").doc(uid), {
        fcmToken: admin.firestore.FieldValue.delete(),
        notificationsEnabled: false,
      });
    });
    try {
      await cleanBatch.commit();
    } catch (_) {}
  }

  console.log(`  ✅ [${type}] sent: ${totalSuccess}, failed: ${totalFailed}`);
}

// ── NOTIFICATION HANDLERS ─────────────────────────────────────────────────────

async function sendMorning(db, messaging, today) {
  console.log("\n🌅 MORNING — 7:00 AM IST — all opted-in users");
  const snapshot = await db.collection("jeeWarriors").get();
  const targets = [];
  for (const doc of snapshot.docs) {
    const d = doc.data();
    if (!d.notificationsEnabled || !d.fcmToken) continue;
    if (await wasAlreadySent(db, doc.id, today, "morning")) continue;
    targets.push({ uid: doc.id, token: d.fcmToken });
  }
  console.log(`  📱 Targets: ${targets.length}`);
  const quote = randomFrom(MORNING_QUOTES);
  await sendToTargets(
    messaging,
    db,
    targets,
    {
      title: "🌅 Morning Strike! Sun is up!",
      body: `Your competition has been studying for 2 hours. Get up, Mortal! 🚀\n\n${quote}`,
      tag: "morning-strike",
    },
    "morning",
    today,
  );
}

async function sendNight(db, messaging, today) {
  console.log("\n🌙 NIGHT — 10:00 PM IST — all opted-in users");
  const snapshot = await db.collection("jeeWarriors").get();
  const targets = [];
  for (const doc of snapshot.docs) {
    const d = doc.data();
    if (!d.notificationsEnabled || !d.fcmToken) continue;
    if (await wasAlreadySent(db, doc.id, today, "night")) continue;
    targets.push({ uid: doc.id, token: d.fcmToken });
  }
  console.log(`  📱 Targets: ${targets.length}`);
  const quote = randomFrom(NIGHT_QUOTES);
  await sendToTargets(
    messaging,
    db,
    targets,
    {
      title: "🌙 End-of-Day Review!",
      body: `Did you earn your sleep or just borrow it? 😴\n\n${quote}`,
      tag: "night-strike",
    },
    "night",
    today,
  );
}

async function sendMilestone(db, messaging, today) {
  console.log("\n🏆 MILESTONE CHECK — only users who hit milestone today");
  const snapshot = await db.collection("jeeWarriors").get();
  for (const doc of snapshot.docs) {
    const d = doc.data();
    if (!d.notificationsEnabled || !d.fcmToken) continue;
    const l5Streak = d.l5Streak || 0;
    if (!(d.history || {})[today]) continue;
    if (!MILESTONE_DAYS.includes(l5Streak)) continue;
    if (await wasAlreadySent(db, doc.id, today, "milestone")) continue;
    await sendToTargets(
      messaging,
      db,
      [{ uid: doc.id, token: d.fcmToken }],
      {
        title: "🏆 MILESTONE ACHIEVED!",
        body: MILESTONE_MESSAGES[l5Streak],
        tag: "milestone",
      },
      "milestone",
      today,
    );
  }
}

async function sendWeeklyGraph(db, messaging, today) {
  if (!isSundayIST()) {
    console.log("\n📊 WEEKLY GRAPH — not Sunday, skipping");
    return;
  }
  console.log("\n📊 WEEKLY GRAPH — Sunday only");
  const snapshot = await db.collection("jeeWarriors").get();
  const targets = [];
  for (const doc of snapshot.docs) {
    const d = doc.data();
    if (!d.notificationsEnabled || !d.fcmToken) continue;
    if (await wasAlreadySent(db, doc.id, today, "weekly")) continue;
    targets.push({ uid: doc.id, token: d.fcmToken });
  }
  console.log(`  📱 Targets: ${targets.length}`);
  await sendToTargets(
    messaging,
    db,
    targets,
    {
      title: "📊 Your 7-Day War Graph is Ready!",
      body: "Check your weekly battle summary now! 🔥",
      tag: "weekly-ready",
    },
    "weekly",
    today,
  );
}

async function sendReminder(db, messaging, today) {
  console.log(
    "\n🚨 BATTLE REMINDER — 11:00 PM IST — only if NOT submitted today",
  );
  const snapshot = await db.collection("jeeWarriors").get();
  const targets = [];
  for (const doc of snapshot.docs) {
    const d = doc.data();
    if (!d.notificationsEnabled || !d.fcmToken) continue;
    if ((d.history || {})[today]) continue; // submitted today — skip
    if (await wasAlreadySent(db, doc.id, today, "reminder")) continue;
    targets.push({ uid: doc.id, token: d.fcmToken });
  }
  console.log(`  📱 Targets (not submitted): ${targets.length}`);
  await sendToTargets(
    messaging,
    db,
    targets,
    {
      title: "🚨 STRIKE NOT EXECUTED!",
      body: "11 PM — You have NOT logged today's battle! 1 hour left before midnight. DO IT NOW! ⚔️🔥",
      tag: "strike-missing",
    },
    "reminder",
    today,
  );
}

async function sendStreakPanic(db, messaging, today) {
  console.log(
    "\n⚠️  STREAK PANIC — 11:00 PM IST — streak > 1, NOT submitted today",
  );
  const snapshot = await db.collection("jeeWarriors").get();
  const targets = [];
  for (const doc of snapshot.docs) {
    const d = doc.data();
    if (!d.notificationsEnabled || !d.fcmToken) continue;
    if ((d.history || {})[today]) continue; // submitted today — no panic
    if ((d.streak || 0) <= 1) continue; // streak must be > 1
    if (await wasAlreadySent(db, doc.id, today, "streak_panic")) continue;
    targets.push({ uid: doc.id, token: d.fcmToken });
  }
  console.log(`  📱 Targets: ${targets.length}`);
  await sendToTargets(
    messaging,
    db,
    targets,
    {
      title: "⚠️ STREAK CRITICAL!",
      body: "🔥 1 hour until TOTAL RESET! Don't be a coward. Strike NOW! ⚔️",
      tag: "streak-panic",
    },
    "streak_panic",
    today,
  );
}

async function sendStreakReset(db, messaging, today) {
  console.log(
    "\n💀 STREAK RESET — 12:00 AM IST — missed yesterday AND had streak > 0",
  );
  const yesterday = getYesterdayIST();
  const snapshot = await db.collection("jeeWarriors").get();
  const targets = [];
  for (const doc of snapshot.docs) {
    const d = doc.data();
    if (!d.notificationsEnabled || !d.fcmToken) continue;
    if ((d.streak || 0) === 0) continue; // already 0 — skip
    if ((d.history || {})[yesterday]) continue; // submitted yesterday — no reset
    if (await wasAlreadySent(db, doc.id, today, "streak_reset")) continue;
    targets.push({ uid: doc.id, token: d.fcmToken });
  }
  console.log(`  📱 Targets (missed yesterday): ${targets.length}`);
  if (targets.length === 0) {
    console.log("  All users submitted yesterday ✅");
    return;
  }
  for (const target of targets) {
    const insult = randomFrom(EGO_INSULTS);
    await sendToTargets(
      messaging,
      db,
      [target],
      {
        title: "💀 BOT DEFEATED YOU!",
        body: `You skipped a day — the bot wins! Streak RESET to 0.\n\n${insult}`,
        tag: "streak-ended",
      },
      "streak_reset",
      today,
    );
  }
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
async function main() {
  const RAW_SA = process.env.FIREBASE_SERVICE_ACCOUNT;
  const TYPE = process.env.NOTIFICATION_TYPE || "morning";

  if (!RAW_SA) {
    console.error("❌ FIREBASE_SERVICE_ACCOUNT secret is missing.");
    process.exit(1);
  }

  let serviceAccount;
  try {
    serviceAccount = JSON.parse(RAW_SA);
  } catch (err) {
    console.error("❌ Failed to parse FIREBASE_SERVICE_ACCOUNT:", err.message);
    process.exit(1);
  }

  try {
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    console.log("✅ Firebase Admin initialized");
  } catch (err) {
    console.error("❌ Firebase Admin init failed:", err.message);
    process.exit(1);
  }

  const db = admin.firestore();
  const messaging = admin.messaging();
  const today = getTodayIST();

  console.log(`\n🚀 Type  : [${TYPE}]`);
  console.log(`📅 Today : ${today} (IST)`);
  console.log(`📅 Sunday: ${isSundayIST()}`);
  console.log("─".repeat(50));

  if (TYPE === "morning") {
    await sendMorning(db, messaging, today);
  } else if (TYPE === "night") {
    await sendNight(db, messaging, today);
    await sendMilestone(db, messaging, today);
    await sendWeeklyGraph(db, messaging, today);
  } else if (TYPE === "reminder") {
    await sendReminder(db, messaging, today);
    await sendStreakPanic(db, messaging, today);
  } else if (TYPE === "streak_reset") {
    await sendStreakReset(db, messaging, today);
  } else if (TYPE === "milestone") {
    await sendMilestone(db, messaging, today);
  } else if (TYPE === "weekly") {
    await sendWeeklyGraph(db, messaging, today);
  } else {
    console.error(`❌ Unknown type: "${TYPE}"`);
    process.exit(1);
  }

  console.log("\n" + "─".repeat(50));
  console.log("✅ Done!\n");
  process.exit(0);
}

main().catch((err) => {
  console.error("💥 Fatal error:", err);
  process.exit(1);
});
