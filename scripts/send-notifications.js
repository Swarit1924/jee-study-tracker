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

const JEE_TIPS = {
  7: "✅ Solve 50-70 problems daily\n✅ Sleep 11 PM - 6 AM\n✅ 10-min breaks every hour\n✅ Drink water, eat healthy\n✅ Exercise 30 mins daily",
  21: "✅ Solve 100-150 problems daily\n✅ Morning (5-8 AM): Maths\n✅ Afternoon (2-5 PM): Physics\n✅ Evening (7-10 PM): Chemistry\n✅ Weak topics: Extra 1 hour daily",
  30: "✅ 2-3 full mock tests per week\n✅ Analyze mistakes 1 hour daily\n✅ Revise previous day's concepts\n✅ Meditation: 10 mins daily\n✅ Track weak areas + 2 extra hours",
  60: "✅ 5 full-length mocks per week\n✅ Speed: 30 problems in 30 mins\n✅ Accuracy focus on easy problems\n✅ Weak areas: Extra 2 hours daily\n✅ Sleep 8 hours — SUPERPOWER!",
  90: "✅ Target: 95+ percentile\n✅ Standard + Advanced problems\n✅ Conceptual clarity > Speed\n✅ Mock tests: Analyze every detail\n✅ Meditation: 20 mins daily",
  365: "✅ You've mastered consistency\n✅ Teach others — cement learning\n✅ Share your journey\n✅ Master all approaches\n✅ IIT/NIT is YOURS!",
};

const MILESTONE_MESSAGES = {
  7: "7-day streak champion! You're on fire! 🔥",
  21: "21-day warrior! Consistency is key! 💪",
  30: "30-day legend! You're unstoppable! 👑",
  60: "60-day god mode activated! ⚡",
  90: "90-day elite! This is excellence! 🌟",
  365: "365-day immortal! You're a legend! 🎊",
};

// 100 daily JEE tips — short version sent in notification, detailed shown in app
const DAILY_TIPS = [
  "Solve 20 PYQ questions every day without fail.",
  "After a wrong answer, understand why — don't just see the solution.",
  "Solve problems without knowing the chapter first.",
  "Time yourself on every problem set you solve.",
  "One wrong problem understood deeply beats ten easy ones.",
  "Eliminate options strategically — never guess completely randomly.",
  "Solve the same problem 3 different ways — then you own it.",
  "Mark difficult problems and return after 24 hours.",
  "Keep a mistakes notebook and review it every Sunday.",
  "Solve 5 problems purely in your head — no pen.",
  "Learn to sanity-check answers in 30 seconds without resolving.",
  "3 hard problems daily beats 30 easy ones.",
  "Derive every formula once from scratch — then you never forget it.",
  "Full-length mocks must be under real exam conditions every week.",
  "Analyse your mock before you see the solutions.",
  "Plan tomorrow's study schedule every night before sleeping.",
  "Use your first 2 morning hours for Maths — your sharpest time.",
  "Study in 50-minute blocks with strict 10-minute breaks.",
  "Never study the same subject for more than 3 hours straight.",
  "Protect your first 30 study minutes from phone — no exceptions.",
  "Track actual study hours — not time sitting at your desk.",
  "Batch your doubts — don't interrupt study flow to look things up.",
  "Schedule your hardest topic first every single day.",
  "Saturday: mock tests. Sunday: deep error analysis. Every week.",
  "Use commute and waiting time for theory revision, not scrolling.",
  "Never skip sleep to study — it destroys the next 2 days.",
  "Revise a topic within 24 hours of learning it — this is critical.",
  "Set a hard stop time for studying and respect it — it builds urgency.",
  "Review today's key points in 5 minutes before sleeping.",
  "Take one complete rest day per week — burnout kills streaks.",
  "Every Physics problem starts with a free body diagram.",
  "Understand the Physics concept before memorising the formula.",
  "Dimensional analysis catches 80% of formula errors instantly.",
  "Draw energy diagrams for every mechanics problem.",
  "Electrostatics: superposition is your most powerful tool.",
  "Waves: always separate what is oscillating from what is propagating.",
  "Modern Physics is formula-heavy but concept-light — master it quickly.",
  "Thermodynamics: draw the PV diagram before calculating anything.",
  "Electricity circuits: redraw in simplest form before applying equations.",
  "Rotational Motion: always choose the axis that eliminates unknown torques.",
  "Organic Chemistry reactions follow patterns — learn the mechanism.",
  "Periodic table trends are the backbone of Inorganic Chemistry.",
  "Physical Chemistry is applied Maths — treat it exactly like one.",
  "Balance redox equations using oxidation state method, not trial and error.",
  "Draw all structural isomers methodically — never by intuition.",
  "Memorise Chemistry exceptions — they are the most tested.",
  "Use IUPAC naming on every single practice problem.",
  "p-block: know the oxides and hydrides of each group cold.",
  "The Nernst equation appears in JEE almost every single year.",
  "Use curved arrows for reaction mechanisms — never memorise without them.",
  "Calculus: understand the definition of derivative before the rules.",
  "The unit circle is more powerful than any trig formula sheet.",
  "Coordinate Geometry: verify your equation by substituting a known point.",
  "Probability: always define the sample space before anything else.",
  "Matrices: learn the cofactor method for inverse — it's faster for 3x3.",
  "Vectors: resolve every 3D problem into components immediately.",
  "Integration: recognise the type before choosing the technique.",
  "AP, GP, HP sum formulas must be completely automatic.",
  "Complex numbers: draw the Argand plane — most problems become visual.",
  "P&C: always ask 'is order important?' before writing any formula.",
  "Drink 3 litres of water daily — dehydration kills focus.",
  "Eat light at lunch — heavy meals crash your afternoon energy.",
  "30 minutes of walking daily is brain maintenance, not optional.",
  "Follow the 20-20-20 rule for eyes every study session.",
  "A 20-minute nap restores focus without causing grogginess.",
  "Never study past midnight — retention is minimal after then.",
  "Eat a banana or nuts before a study session for sustained energy.",
  "Same sleep and wake time every day — consistency is everything.",
  "5-minute stretch every hour — your spine and focus will thank you.",
  "Never study with lyrics on — they use the same memory buffer as reading.",
  "Comparison with others is the fastest way to destroy your focus.",
  "Boredom during study is the signal you are doing the right work.",
  "Your rank is determined by your worst subject, not your best.",
  "Eliminate the option of quitting before you even start.",
  "Fear of failure is not your enemy — complacency is.",
  "Celebrate small wins — they compound into massive momentum.",
  "Visualise your exam day success every night before sleeping.",
  "Discomfort is temporary. The regret of not trying is permanent.",
  "Identify your peak focus hours and protect them ruthlessly.",
  "The consistent student beats the brilliant one who doesn't show up.",
  "Read the entire paper for 5 minutes before solving anything.",
  "Start with your strongest subject to build confidence and bank marks.",
  "Never spend more than 4 minutes on one stuck question.",
  "Negative marking: only guess when you can eliminate at least 2 options.",
  "JEE Mains: perfect accuracy on easy questions beats racing to hard ones.",
  "Keep rough work neat and systematic — toppers have immaculate rough work.",
  "Don't change your first answer unless you found a specific error.",
  "Physics then Chemistry then Maths — test this order in every mock.",
  "Integer-type questions have no negative marking — always attempt all.",
  "Eat light and sleep 8 hours the night before the exam — not study.",
  "Active recall beats re-reading by 3x for long-term retention.",
  "Revise on days 1, 3, 7, 14, and 30 after learning — this is the spaced schedule.",
  "Create a one-page summary of each chapter after completing it.",
  "Teach a concept to an imaginary student — gaps reveal themselves.",
  "Revise formulas every morning for 10 minutes — just formulas.",
  "Interleaved revision beats blocked revision for exam performance.",
  "Before a new chapter, write what you already know — this primes learning.",
  "Test yourself every 20 minutes — never revise for longer without recall.",
  "Review your last mock's error analysis before your next mock.",
  "Last month before JEE: revise and practice only — no new chapters.",
];

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
  if (process.env.DRY_RUN === "true") {
    console.log(
      `  🔇 DRY RUN — skipping send for [${type}] (${targets.length} targets). Schedule activated.`,
    );
    return;
  }

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
    const shortMsg = MILESTONE_MESSAGES[l5Streak] || "";
    const tipsMsg = JEE_TIPS[l5Streak] || "";
    const fullBody = tipsMsg ? `${shortMsg}\n\n${tipsMsg}` : shortMsg;
    await sendToTargets(
      messaging,
      db,
      [{ uid: doc.id, token: d.fcmToken }],
      {
        title: `🏆 ${l5Streak}-DAY MILESTONE UNLOCKED!`,
        body: fullBody,
        tag: "milestone",
      },
      "milestone",
      today,
    );
  }
}

async function sendDailyTip(db, messaging, today) {
  console.log("\n💡 DAILY TIP — 10:00 AM IST — streak >= 7, same tip as app");
  const snapshot = await db.collection("jeeWarriors").get();
  for (const docSnap of snapshot.docs) {
    const d = docSnap.data();
    if (!d.notificationsEnabled || !d.fcmToken) continue;
    if ((d.streak || 0) < 7) continue;
    if (!d.tipStartDate) continue;

    // Calculate tip index from tipStartDate stored in Firestore
    const startParts = d.tipStartDate.split("-");
    const startDate = new Date(
      parseInt(startParts[0]),
      parseInt(startParts[1]) - 1,
      parseInt(startParts[2]),
    );
    const todayParts = today.split("-");
    const todayDate = new Date(
      parseInt(todayParts[0]),
      parseInt(todayParts[1]) - 1,
      parseInt(todayParts[2]),
    );
    const tipIdx = Math.round((todayDate - startDate) / 86400000);

    if (tipIdx < 0) continue;
    const cycledIdx = tipIdx % DAILY_TIPS.length; // cycles back to start after 100

    if (await wasAlreadySent(db, docSnap.id, today, "daily_tip")) continue;

    const tip = DAILY_TIPS[cycledIdx];
    await sendToTargets(
      messaging,
      db,
      [{ uid: docSnap.id, token: d.fcmToken }],
      {
        title: `💡 JEE Study Tracker — Tip ${cycledIdx + 1}/100`,
        body: tip,
        tag: "daily-tip",
      },
      "daily_tip",
      today,
    );
  }
}

async function sendWeeklyGraph(db, messaging, today) {
  console.log("\n📊 WEEKLY GRAPH — Saturday 10:30 PM IST");
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
    "\n💀 STREAK RESET — 12:00 AM IST — missed 2 days ago AND had streak > 0",
  );
  // Use 2 days ago instead of yesterday to account for GitHub Actions delay
  // (workflow can fire at 12:55 AM IST, at which point "yesterday" is the current day)
  const twoDaysAgo = getISTDateStr(
    new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
  );
  const yesterday = getYesterdayIST();
  const snapshot = await db.collection("jeeWarriors").get();
  const targets = [];
  for (const doc of snapshot.docs) {
    const d = doc.data();
    if (!d.notificationsEnabled || !d.fcmToken) continue;
    if ((d.streak || 0) === 0) continue;
    // Only reset if missed BOTH yesterday AND two days ago
    const hist = d.history || {};
    if (hist[yesterday] || hist[twoDaysAgo]) continue; // submitted recently — safe
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
  console.log("─".repeat(50));

  if (TYPE === "morning") {
    await sendMorning(db, messaging, today);
  } else if (TYPE === "night") {
    await sendNight(db, messaging, today);
    await sendMilestone(db, messaging, today);
  } else if (TYPE === "reminder") {
    await sendReminder(db, messaging, today);
    await sendStreakPanic(db, messaging, today);
  } else if (TYPE === "streak_reset") {
    await sendStreakReset(db, messaging, today);
  } else if (TYPE === "milestone") {
    await sendMilestone(db, messaging, today);
  } else if (TYPE === "weekly") {
    await sendWeeklyGraph(db, messaging, today);
  } else if (TYPE === "daily_tip") {
    await sendDailyTip(db, messaging, today);
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
