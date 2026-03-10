const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();
const messaging = admin.messaging();

// ==========================================
// TIMEZONE UTILITIES (GMT to IST)
// ==========================================
const getISTTime = (date = new Date()) => {
  const utcTime = date.getTime() + (date.getTimezoneOffset() * 60 * 1000);
  const istTime = new Date(utcTime + (5.5 * 60 * 60 * 1000));
  return istTime;
};

const getTodayStrIST = () => {
  const istDate = getISTTime();
  return istDate.toISOString().split('T')[0];
};

// ==========================================
// NOTIFICATION CONSTANTS
// ==========================================
const MORNING_QUOTES = [
  "🌅 Your competitors woke up 2 hours ago. Where are YOU?",
  "☀️ Sun is up. Your brain? Still sleeping. GET UP!",
  "⏰ 24 hours. That's all you have TODAY. Make it COUNT!",
  "🔥 Toppers don't snooze. They STRIKE. Be a TOPPER!",
  "💪 Morning is PRIME TIME for studying. Don't waste it!",
  "🧠 Fresh mind = Maximum retention. Study NOW!",
  "🎯 One more day closer to JEE. One day WASTED if you don't study!",
  "⚡ Your energy is highest now. UTILISE IT!",
  "🚀 While you sleep, someone solves 50 more problems. CATCH UP!",
  "💎 These morning hours are GOLD. Don't throw them away!"
];

const NIGHT_QUOTES = [
  "🌙 Did you earn your sleep or just BORROW it?",
  "😴 Tomorrow your competitors will have studied more than you. Fix that TODAY!",
  "⏳ One day gone. How many problems did YOU solve?",
  "🔥 Sleep with PURPOSE. Tomorrow is GRIND DAY!",
  "💭 Reflect: Did you give your 100%? If not, DO BETTER tomorrow!",
  "🌟 Rest well. But remember: They're studying WHILE you sleep!",
  "⚠️ Night is the time to REFLECT and plan. Don't just sleep!",
  "🎯 Another day survived. But SURVIVED ≠ THRIVED. Be better tomorrow!",
  "💪 Tomorrow is a new chance. Don't waste it like today!",
  "🏆 Champions sleep to RECOVER and COMEBACK stronger!"
];

// ==========================================
// 1. BATTLE COMPLETION NOTIFICATION
// ==========================================
exports.onBattleSubmitted = functions.firestore
  .document('jeeWarriors/{userId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    const userId = context.params.userId;

    // Check if lastBattleTime was updated (indicates new battle submission)
    if (before.lastBattleTime !== after.lastBattleTime && after.lastBattleTime) {
      try {
        const userDoc = await db.collection('users').doc(userId).get();
        if (!userDoc.exists) return;

        const fcmToken = userDoc.data().fcmToken;
        if (!fcmToken) return;

        const todayStr = getTodayStrIST();
        const todayBattle = after.history?.[todayStr];

        if (todayBattle) {
          const title = todayBattle.result === 'win' 
            ? '🎉 VICTORY STRIKE! You dominated the bot!'
            : '⚔️ Battle Lost! But the war continues...';

          const studyTime = (todayBattle.physics || 0) + (todayBattle.chemistry || 0) + (todayBattle.maths || 0);
          const screenTime = todayBattle.userScreen || 0;

          const message = {
            notification: {
              title: title,
              body: `Study: ${studyTime.toFixed(2)}h | Screen: ${screenTime.toFixed(2)}h | Rank: ${todayBattle.rank || 'N/A'}`,
              tag: 'battle-result',
              requireInteraction: 'true'
            },
            tokens: [fcmToken],
            data: {
              battleResult: todayBattle.result,
              timestamp: new Date().toISOString()
            }
          };

          await messaging.sendMulticast(message);
          console.log(`✅ Battle notification sent to ${userId}`);
        }
      } catch (err) {
        console.error(`❌ Error sending battle notification: ${err}`);
      }
    }
  });

// ==========================================
// 2. MILESTONE ACHIEVEMENT NOTIFICATION
// ==========================================
exports.onMilestoneAchieved = functions.firestore
  .document('jeeWarriors/{userId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    const userId = context.params.userId;

    // Check if l5Streak was updated to a milestone
    if (before.l5Streak !== after.l5Streak) {
      const milestones = {
        7: '🏆 7-DAY LEGEND! Consistency unlocked! 🔥',
        21: '👑 21-DAY WARRIOR! You\'re a FORCE now! ⚡',
        30: '💎 1-MONTH CHAMPION! That\'s INSANE dedication! 🌟',
        60: '🚀 2-MONTH DESTROYER! You\'re UNSTOPPABLE!',
        90: '⭐ 3-MONTH CONQUEROR! JEE better watch out!',
        365: '🌍 1-YEAR PHENOMENON! You\'re a LEGEND!'
      };

      if (milestones[after.l5Streak]) {
        try {
          const userDoc = await db.collection('users').doc(userId).get();
          if (!userDoc.exists) return;

          const fcmToken = userDoc.data().fcmToken;
          if (!fcmToken) return;

          const message = {
            notification: {
              title: '🎖️ MILESTONE ACHIEVED!',
              body: milestones[after.l5Streak],
              tag: 'milestone',
              requireInteraction: 'true'
            },
            tokens: [fcmToken],
            data: {
              milestone: after.l5Streak.toString(),
              timestamp: new Date().toISOString()
            }
          };

          await messaging.sendMulticast(message);
          console.log(`✅ Milestone notification sent to ${userId} for ${after.l5Streak} days`);
        } catch (err) {
          console.error(`❌ Error sending milestone notification: ${err}`);
        }
      }
    }
  });

// ==========================================
// 3. STREAK PANIC ALERT (within 1 hour of reset)
// ==========================================
exports.streakPanicAlert = functions.pubsub
  .schedule('every 15 minutes')
  .timeZone('Asia/Kolkata')
  .onRun(async (context) => {
    try {
      const usersSnapshot = await db.collection('jeeWarriors').get();

      for (const doc of usersSnapshot.docs) {
        const userData = doc.data();
        const userId = doc.id;
        const lastBattleTime = userData.lastBattleTime || 0;
        const streak = userData.streak || 0;

        if (lastBattleTime && streak > 0) {
          const timeSinceLastBattle = Date.now() - lastBattleTime;
          const hoursRemaining = (24 * 60 * 60 * 1000 - timeSinceLastBattle) / (60 * 60 * 1000);

          // Alert if less than 1 hour remaining and no battle today
          if (hoursRemaining > 0 && hoursRemaining <= 1) {
            const todayStr = getTodayStrIST();
            const history = userData.history || {};
            const todayBattle = history[todayStr];

            if (!todayBattle) {
              try {
                const userDoc = await db.collection('users').doc(userId).get();
                if (!userDoc.exists) continue;

                const fcmToken = userDoc.data().fcmToken;
                if (!fcmToken) continue;

                const message = {
                  notification: {
                    title: '🔥 STREAK CRITICAL!',
                    body: `⚠️ ${Math.floor(hoursRemaining * 60)} minutes until TOTAL RESET!\n\nStrike NOW! ⚔️`,
                    tag: 'streak-panic',
                    requireInteraction: 'true'
                  },
                  tokens: [fcmToken],
                  data: {
                    alert: 'streak-panic',
                    minutesRemaining: Math.floor(hoursRemaining * 60).toString(),
                    timestamp: new Date().toISOString()
                  }
                };

                await messaging.sendMulticast(message);
                console.log(`✅ Panic alert sent to ${userId} - ${Math.floor(hoursRemaining * 60)}min remaining`);
              } catch (err) {
                console.error(`❌ Error sending panic alert to ${userId}: ${err}`);
              }
            }
          }
        }
      }
    } catch (err) {
      console.error(`❌ Error in streakPanicAlert: ${err}`);
    }
  });

// ==========================================
// 4. MORNING MOTIVATION (7 AM IST)
// ==========================================
exports.morningMotivation = functions.pubsub
  .schedule('0 7 * * *')
  .timeZone('Asia/Kolkata')
  .onRun(async (context) => {
    try {
      const usersSnapshot = await db.collection('jeeWarriors').get();
      const quote = MORNING_QUOTES[Math.floor(Math.random() * MORNING_QUOTES.length)];

      for (const doc of usersSnapshot.docs) {
        const userId = doc.id;
        try {
          const userDoc = await db.collection('users').doc(userId).get();
          if (!userDoc.exists) continue;

          const fcmToken = userDoc.data().fcmToken;
          if (!fcmToken) continue;

          const message = {
            notification: {
              title: '🌅 Morning Strike! Sun is up!',
              body: `Your competition has been studying for 2 hours. Get up, Mortal! 🚀\n\n${quote}`,
              tag: 'morning-strike',
              requireInteraction: 'true'
            },
            tokens: [fcmToken],
            data: {
              motivationType: 'morning',
              timestamp: new Date().toISOString()
            }
          };

          await messaging.sendMulticast(message);
          console.log(`✅ Morning motivation sent to ${userId}`);
        } catch (err) {
          console.error(`❌ Error sending morning notification to ${userId}: ${err}`);
        }
      }
    } catch (err) {
      console.error(`❌ Error in morningMotivation: ${err}`);
    }
  });

// ==========================================
// 5. NIGHT REVIEW (10 PM IST)
// ==========================================
exports.nightReview = functions.pubsub
  .schedule('0 22 * * *')
  .timeZone('Asia/Kolkata')
  .onRun(async (context) => {
    try {
      const usersSnapshot = await db.collection('jeeWarriors').get();
      const quote = NIGHT_QUOTES[Math.floor(Math.random() * NIGHT_QUOTES.length)];

      for (const doc of usersSnapshot.docs) {
        const userId = doc.id;
        try {
          const userDoc = await db.collection('users').doc(userId).get();
          if (!userDoc.exists) continue;

          const fcmToken = userDoc.data().fcmToken;
          if (!fcmToken) continue;

          const message = {
            notification: {
              title: '🌙 End-of-Day Review!',
              body: `Did you earn your sleep or just borrow it? 😴\n\n${quote}`,
              tag: 'night-strike',
              requireInteraction: 'true'
            },
            tokens: [fcmToken],
            data: {
              motivationType: 'night',
              timestamp: new Date().toISOString()
            }
          };

          await messaging.sendMulticast(message);
          console.log(`✅ Night review sent to ${userId}`);
        } catch (err) {
          console.error(`❌ Error sending night notification to ${userId}: ${err}`);
        }
      }
    } catch (err) {
      console.error(`❌ Error in nightReview: ${err}`);
    }
  });

// ==========================================
// 6. STREAK RESET NOTIFICATION (48+ hours)
// ==========================================
exports.streakResetCheck = functions.pubsub
  .schedule('every 60 minutes')
  .timeZone('Asia/Kolkata')
  .onRun(async (context) => {
    try {
      const usersSnapshot = await db.collection('jeeWarriors').get();

      for (const doc of usersSnapshot.docs) {
        const userData = doc.data();
        const userId = doc.id;
        const lastBattleTime = userData.lastBattleTime || 0;
        const streak = userData.streak || 0;

        if (lastBattleTime && streak > 0) {
          const timeSinceLastBattle = Date.now() - lastBattleTime;
          
          // If 48 hours passed and still haven't updated in Firestore
          if (timeSinceLastBattle > 48 * 60 * 60 * 1000) {
            try {
              const userDoc = await db.collection('users').doc(userId).get();
              if (!userDoc.exists) continue;

              const fcmToken = userDoc.data().fcmToken;
              if (!fcmToken) continue;

              // Send streak ended notification
              const message = {
                notification: {
                  title: '💀 STREAK ENDED!',
                  body: '48+ hours detected. Your streak is GONE. Start fresh! 🚀',
                  tag: 'streak-ended',
                  requireInteraction: 'true'
                },
                tokens: [fcmToken],
                data: {
                  alert: 'streak-reset',
                  timestamp: new Date().toISOString()
                }
              };

              await messaging.sendMulticast(message);
              
              // Update Firebase to reset streak
              await db.collection('jeeWarriors').doc(userId).update({
                streak: 0,
                l5Streak: 0,
                lastResetTime: Date.now()
              });

              console.log(`✅ Streak reset notification sent to ${userId}`);
            } catch (err) {
              console.error(`❌ Error in streak reset for ${userId}: ${err}`);
            }
          }
        }
      }
    } catch (err) {
      console.error(`❌ Error in streakResetCheck: ${err}`);
    }
  });

// ==========================================
// 7. FCM TOKEN UPDATE TRIGGER
// ==========================================
exports.updateUserFCMToken = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const userId = context.auth.uid;
  const { fcmToken } = data;

  if (!fcmToken) {
    throw new functions.https.HttpsError('invalid-argument', 'FCM token is required');
  }

  try {
    await db.collection('users').doc(userId).set(
      { fcmToken, updatedAt: admin.firestore.FieldValue.serverTimestamp() },
      { merge: true }
    );
    return { success: true, message: 'FCM token updated' };
  } catch (err) {
    console.error(`❌ Error updating FCM token: ${err}`);
    throw new functions.https.HttpsError('internal', 'Failed to update FCM token');
  }
});

console.log('✅ Firebase Cloud Functions initialized - Notifications running on cloud!');