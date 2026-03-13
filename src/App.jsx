import React, { useState, useEffect, useCallback } from "react";
import { initializeApp } from "firebase/app";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  GoogleAuthProvider,
  signInWithPopup,
  sendPasswordResetEmail,
} from "firebase/auth";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  orderBy,
  limit,
  getDocs,
  enableIndexedDbPersistence,
  onSnapshot,
} from "firebase/firestore";
import { getMessaging, getToken } from "firebase/messaging";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  Flame,
  Zap,
  Skull,
  Shield,
  Crosshair,
  Calendar as CalendarIcon,
  Copy,
  Download,
  Trophy,
  AlertTriangle,
  X,
  Bell,
  Star,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Eye,
  EyeOff,
} from "lucide-react";

// ==========================================
// FIREBASE CONFIGURATION
// ==========================================
const envConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

let app, auth, db, messaging;
let firebaseAvailable = true;
const _missingKey =
  !envConfig.apiKey ||
  envConfig.apiKey.includes("YOUR") ||
  envConfig.apiKey.length < 20;
if (_missingKey) {
  console.error(
    "Firebase API key missing or invalid. Set VITE_FIREBASE_API_KEY in your .env file or replace the config in src/App.jsx",
  );
  firebaseAvailable = false;
} else {
  app = initializeApp(envConfig);
  auth = getAuth(app);
  db = getFirestore(app);

  enableIndexedDbPersistence(db).catch((err) => {
    if (err.code === "failed-precondition") {
      console.warn("⚠️ Offline persistence requires single tab");
    } else if (err.code === "unimplemented") {
      console.warn("⚠️ Browser does not support offline persistence");
    }
  });

  try {
    messaging = getMessaging(app);
    console.log("✅ Firebase Messaging initialized");
  } catch (err) {
    console.warn("⚠️ Firebase Messaging not available:", err.message);
  }
}

// ==========================================
// TIMEZONE UTILITIES (GMT to IST)
// ==========================================
const getISTTime = (date = new Date()) => {
  const utcTime = date.getTime() + date.getTimezoneOffset() * 60 * 1000;
  const istTime = new Date(utcTime + 5.5 * 60 * 60 * 1000);
  return istTime;
};

const getTodayStrIST = () => {
  const istDate = getISTTime();
  return istDate.toISOString().split("T")[0];
};

const getLocalDateStr = () => {
  const localDate = new Date();
  const year = localDate.getFullYear();
  const month = String(localDate.getMonth() + 1).padStart(2, "0");
  const day = String(localDate.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getTimeUntilMidnight = () => {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  return midnight.getTime() - now.getTime();
};

const getWeekNumber = (dateStr) => {
  const date = new Date(dateStr + "T00:00:00");
  const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
  const dayOfMonth = date.getDate();
  const weekOfMonth = Math.ceil((dayOfMonth + firstDay.getDay()) / 7);
  return weekOfMonth;
};

const getCurrentWeekDates = () => {
  const today = new Date();
  const currentDate = new Date(today);
  const first = currentDate.getDate() - currentDate.getDay();

  const sundayDate = new Date(currentDate.setDate(first));
  const saturdayDate = new Date(currentDate.setDate(first + 6));

  return {
    sunday: sundayDate.toISOString().split("T")[0],
    saturday: saturdayDate.toISOString().split("T")[0],
  };
};

// ==========================================
// SERVER-TIME VALIDATION
// ==========================================
const getServerTime = async () => {
  try {
    if (!firebaseAvailable) return Date.now();
    const docRef = doc(db, "serverTime", "current");
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data().timestamp || Date.now();
    }
    return Date.now();
  } catch (err) {
    console.error("❌ Error getting server time:", err);
    return Date.now();
  }
};

const checkTimeDeviation = (serverTime) => {
  const deviation = Math.abs(Date.now() - serverTime) / 1000 / 60;
  if (deviation > 5) {
    return { valid: false, deviation };
  }
  return { valid: true, deviation };
};

// ==========================================
// EGO INSULTS & PUNISHMENTS
// ==========================================
const EGO_INSULTS = [
  "Your parents are telling neighbors you're studying. Stop making them LIARS.",
  "40,000 students just finished a mock test. You? Looking for lo-fi playlists.",
  "Average effort = Average life. Enjoy your local college.",
  "Your crush chose someone who actually STUDIES. Just saying.",
  "Tera competition padh raha, tu scroll kar? PATHETIC.",
  "NTA doesn't care about your 'burnout.' They're waiting for your FAILURE.",
  "Board exam: Struggle. JEE: Impossible. Your future: Already LOST.",
  "Tere se NEET waale better padh rahe! Let that sink in.",
  "Lakhs spent on coaching. You? SCROLLING like a zombie.",
  "Mom tells relatives you're preparing. She's LYING to save face.",
  "Your siblings got better marks. They're in 7TH GRADE.",
  "Cutoff score is 250. Your brain? ROTTING from endless scrolling.",
  "Haryana has 5 IITs. You'll get into ZERO.",
  "Teri schedule: Alarm → Sleep → Repeat. CONSISTENTLY LAZY.",
  "Phone battery increasing. Teri padhai? DECREASING.",
  "Test failed, Tinder failed, LIFE failed. Perfect combo!",
  "Motivation = 0. Procrastination = 100. You're the FORMULA for FAILURE.",
  "Teri rank after exam? NEGATIVE from crying so hard.",
  "Study table = Decoration. Phone = Your ACTUAL love.",
  "Topper: 16 hours. You: 16 hours SCROLLING. GUESS who wins?",
  "Your dream college just DELETED your application.",
  "NEET students are studying harder than you. Let THAT hurt.",
  "In 2 years you'll REGRET every single moment wasted.",
  "Your parents' disappointment? Coming soon. Reserve your tears.",
  "IIT/NIT looking for WARRIORS. You're a SCROLLER.",
  "Every second you waste, a topper solves 3 more problems. YOU'RE BEHIND.",
  "Future you is CRYING because of present you. STOP IT.",
  "Rank list: MILLIONS take JEE. You? INVISIBLE on the list.",
  "Your competitive spirit? DEAD. Buried under Netflix tabs.",
  "Tinder is waiting for you after JEE failure. Prepare yourself.",
  "Tera score: Negative marks se bhi LOWER jayega!",
  "Mom's WhatsApp status: 'Beta is preparing hard.' FICTION.",
  "Coaching fee wasted. Potential WASTED. Future WASTED.",
  "Scroll faster. You're falling behind in the FAILURE race!",
  "Even your phone is EMBARRASSED by your screen time.",
  "Competitive exam = Your kryptonite. You're WEAK.",
  "Dream college: REJECTING you before you even apply.",
  "Last-minute studying? TOO LATE. You're COOKED.",
  "Your brain on scrolling = MASHED POTATOES at this point.",
  "Selection probability: ZERO. Confidence level: ALSO ZERO.",
];

const DETAILED_PUNISHMENTS = [
  "💀 24-HOUR DIGITAL DETOX: No social media. No phone entertainment. Only study!",
  "⏰ WAKE UP AT 5 AM: 7 days straight. Your alarm DOESN'T care about excuses!",
  "📖 SOLVE 20 PYQ's: No breaks. No scrolling. Pure problems ONLY!",
  "🧠 REVISE A CONCEPT: Weakest topic. 3+ hours MINIMUM. FOCUS!",
  "🏃 1-HOUR INTENSE WORKOUT: Gym/cardio/running. Sweat your regrets OUT!",
  "📱 PHONE JAIL 12 HOURS: Lock it away. Study zone ONLY!",
  "✍️ REWRITE NOTES BY HAND: 2 hours. No typing. HANDWRITE everything!",
  "🧘 MEDITATION CHALLENGE: 30 mins daily for 7 days. DEVELOP FOCUS!",
  "📝 WRITE 1000-WORD ESSAY: Topic: 'Why I'm wasting my life'",
  "🎯 DOUBLE GRIND TOMORROW: Study 2x your normal hours. CATCH UP!",
  "📚 READ 50 TEXTBOOK PAGES: No shortcuts. Pure FOCUS!",
  "🔬 SOLVE 50 HARD PROBLEMS: From weakest chapter ONLY!",
  "💻 24-HOUR OFFLINE MODE: No internet. Books and notes ONLY!",
  "👥 ISOLATION CHALLENGE: 2 days ONLY studying. Zero social life!",
  "⚠️ PUBLIC ACCOUNTABILITY: Post your failure on status with #IFailed",
  "📊 CREATE 16-HOUR SCHEDULE: Detailed plan for NEXT WEEK!",
  "🚫 SKIP ONE MEAL: Fast + study. FEEL your hunger for success!",
  "📋 3 FULL MOCK TESTS: Back-to-back. NO breaks!",
  "🔔 10 DAILY FAILURE REMINDERS: Accept reality. CHANGE IT!",
  "💪 FIND ACCOUNTABILITY PARTNER: Study 12 hours TOGETHER daily!",
];

const BRUTAL_PUNISHMENTS = [
  "💀 HUMILIATED! You lost to a BOT! Your competitors are LAUGHING at you!",
  "🔥 PATHETIC! Hours wasted scrolling and you FAILED! Family EMBARRASSED!",
  "😤 WORTHLESS! Toppers solved 200+ problems while you SCROLLED. FALLING BEHIND!",
  "💥 FAILURE ALERT! Couldn't even beat a COMPUTER! Real exam? COLLAPSE!",
  "🚨 YOU'RE A JOKE! Lakhs spent. Zero discipline. TOTAL WASTE!",
  "☠️ DESTROYED! One job: study more than scroll. You FAILED spectacularly!",
  "🎯 ZERO DISCIPLINE! Every second scrolling = Someone else getting CLOSER to IIT!",
  "💔 YOUR DREAMS ARE DYING! While you scroll, 1000s work 16 hours! Don't DESERVE success!",
  "🔔 WAKE UP! Exam coming! You're heading STRAIGHT to FAILURE!",
  "😈 BRUTAL TRUTH: You'll NEVER crack JEE! Not SERIOUS enough!",
  "🌪️ DESTROYED AND HUMILIATED! No game, NO discipline, NO future!",
  "💀 ABSOLUTE DISASTER! Competitors CRUSHING it. You? On REELS! PATHETIC!",
  "🔥 YOU'RE FINISHED! Can't beat BOT? Real exam? HUMILIATION INCOMING!",
  "😤 EPIC FAILURE! Brain ROTTING from scrolling! Getting DUMBER daily!",
  "⚡ REALITY CHECK: You DON'T have guts for IIT! TOO WEAK, LAZY, DISTRACTED!",
  "💥 CRUSHED! Lost to COMPUTER! Compete with LAKHS? IMPOSSIBLE!",
  "🎭 FAKE AMBITION! Talk IIT but scroll like ZOMBIE! Which is REAL?",
  "🌑 DARKNESS AHEAD! Keep scrolling! Dreams turn to ASH! No one remembers LOSERS!",
  "🚀 LEFT BEHIND! 100 students PASSED you TODAY! LOSING the RACE!",
  "💎 WORTHLESS! WASTING best years! In 2 years: REGRET EVERYTHING!",
];

const REWARDS_LOW_SCROLL = [
  "🎁 EXCELLENT DISCIPLINE! You've earned 1 free hour of scroll time!",
  "🎖️ OUTSTANDING! Minimal scrolling! Reward: Guilt-free 1 hour scroll!",
  "⭐ WOW! You barely scrolled! Reward: 1 hour free scroll tomorrow!",
  "🏆 CHAMPION LEVEL! Extra scroll time earned: 1 hour!",
];

const REWARDS_HIGH_STUDY = [
  "🎖️ GREAT BALANCE! You've earned a break:\n✓ Go for a walk (20 mins)\n✓ Listen to favorite songs (30 mins)\n✓ Follow a hobby (1 hour)\n✓ Chat with friends (15 mins)",
  "⭐ WELL-STUDIED! Time to relax:\n✓ Outdoor activity (30 mins)\n✓ Music session (45 mins)\n✓ Hobby time (1 hour)\n✓ Social time (20 mins)",
  "🎁 BALANCED STUDY! Enjoy your break:\n✓ Walk/Exercise (25 mins)\n✓ Entertainment (1 hour)\n✓ Creative hobby (30 mins)\n✓ Friend time (20 mins)",
];

const DAILY_TIPS_APP = [
  {
    short: "Solve 20 PYQ questions every day without fail.",
    detailed:
      "Previous Year Questions are the most reliable predictor of what JEE will ask. Solve at least 20 PYQs daily — not for speed, but to understand the examiner's pattern. After each PYQ, ask: why did they ask this, and what concept does it test?",
  },
  {
    short:
      "After a wrong answer, understand why — don't just see the solution.",
    detailed:
      "Most students glance at the solution and move on. Real learning happens when you sit with the error — write down exactly where your reasoning broke, then redo the problem from scratch without looking. This forces genuine understanding.",
  },
  {
    short: "Solve problems without knowing the chapter first.",
    detailed:
      "Real JEE questions don't come labelled by topic. Practice solving problems without knowing which chapter they're from. This trains your brain to identify the concept first — exactly what the exam demands.",
  },
  {
    short: "Time yourself on every problem set you solve.",
    detailed:
      "JEE is not just about knowing the answer — it's about getting it in under 3 minutes. Set a timer for every practice set. If you exceed the time, mark the problem and return later. Speed is a skill built through deliberate timed practice.",
  },
  {
    short: "One wrong problem understood deeply beats ten easy ones.",
    detailed:
      "Spending 30 minutes on one problem you got wrong teaches you more than solving 10 easy problems quickly. Identify the error type: concept gap, calculation mistake, or misread question. Fix the root cause, not the symptom.",
  },
  {
    short: "Eliminate options strategically — never guess completely randomly.",
    detailed:
      "In JEE, educated elimination is a legitimate skill. Even when unsure, eliminate clearly wrong options based on units, magnitudes, or extreme cases. Reducing 4 options to 2 gives you positive expected value even with negative marking.",
  },
  {
    short: "Solve the same problem 3 different ways — then you own it.",
    detailed:
      "If you can solve a problem three different ways, you truly own that concept. This prevents getting stuck when the standard method doesn't come to mind under exam pressure. Try algebraic, graphical, and intuitive approaches.",
  },
  {
    short: "Mark difficult problems and return after 24 hours.",
    detailed:
      "When a problem completely stumps you, leave it and return after 24 hours. Your subconscious continues processing it. Often the solution becomes clearer after sleep — and this habit also trains you not to waste exam time on stuck questions.",
  },
  {
    short: "Keep a mistakes notebook and review it every Sunday.",
    detailed:
      "Record every wrong answer, categorised by topic and error type, and review it every Sunday. Patterns will emerge — you'll realise you always make the same arithmetic mistake, or miss the same concept. Fix patterns, not individual errors.",
  },
  {
    short: "Solve 5 problems purely in your head — no pen.",
    detailed:
      "Mental calculation is undervalued in JEE prep. 10 minutes daily solving simple problems in your head builds number sense and speeds up rough work in the exam. Physics unit analysis and quick Chemistry balancing can all be done mentally.",
  },
  {
    short: "Learn to sanity-check answers in 30 seconds without resolving.",
    detailed:
      "Develop quick checks: does the unit match? Is the magnitude sensible? Does it reduce to a known result at extreme values? These 30-second checks catch 70% of silly mistakes without re-solving the whole problem.",
  },
  {
    short: "3 hard problems daily beats 30 easy ones.",
    detailed:
      "Three hard problems that stretch your understanding are worth more than thirty easy ones that give false confidence. Deliberately choose problems rated above your current level. Struggle is the signal that learning is happening.",
  },
  {
    short: "Derive every formula once from scratch — then you never forget it.",
    detailed:
      "Deriving a formula makes it impossible to forget. You can reconstruct it in 2 minutes during the exam if memory blanks. Derivation also reveals which parts can be modified for trickier questions — pure memorisation never gives you this.",
  },
  {
    short: "Full-length mocks must be under real exam conditions every week.",
    detailed:
      "Sit for 3 hours with no phone, no breaks, in silence. Exam stamina is physical — your brain tires after extended focus. Regular full-length mocks condition you to maintain sharpness all 3 hours. One mock per week from month 3 onwards.",
  },
  {
    short: "Analyse your mock before you see the solutions.",
    detailed:
      "Before reading the answer key, reattempt every question you marked uncertain. This dual-pass approach trains you to catch errors under pressure and makes you independent of the answer key for self-correction.",
  },
  {
    short: "Plan tomorrow's study schedule every night before sleeping.",
    detailed:
      "Spend 5 minutes every night planning exactly what you will study tomorrow — subject, topic, page numbers. A specific plan removes decision-making cost in the morning. Vague plans like 'study Physics' consistently fail; specific ones don't.",
  },
  {
    short: "Use your first 2 morning hours for Maths — your sharpest time.",
    detailed:
      "Cognitive sharpness peaks in the first 2 hours after waking. Reserve this time exclusively for Maths, which demands the most logical working memory. Save reading-heavy Chemistry theory for evening when your brain is more receptive to retention.",
  },
  {
    short: "Study in 50-minute blocks with strict 10-minute breaks.",
    detailed:
      "50 minutes of focused study followed by a mandatory 10-minute break where you move away from your desk. After 4 blocks, take a 30-minute break. This prevents mental fatigue accumulation and maintains quality throughout the day.",
  },
  {
    short: "Never study the same subject for more than 3 hours straight.",
    detailed:
      "Beyond 3 consecutive hours on one subject, retention drops sharply even if you feel focused. Switch subjects every 2-3 hours. Interleaved studying also forces your brain to retrieve knowledge from different memory stores, strengthening long-term retention.",
  },
  {
    short: "Protect your first 30 study minutes from phone — no exceptions.",
    detailed:
      "The first 30 minutes of your study session sets the tone for the next 3 hours. Checking your phone in this window spikes dopamine and makes sustained focus nearly impossible. Put the phone in another room before you open your books.",
  },
  {
    short: "Track actual study hours — not time sitting at your desk.",
    detailed:
      "Sitting at a desk for 8 hours is not 8 hours of study. Track only minutes of active, focused engagement. Most students discover their actual study time is 40-50% of their desk time. Honesty about this is the first step to improvement.",
  },
  {
    short: "Batch your doubts — don't interrupt study flow to look things up.",
    detailed:
      "When a doubt arises, write it in a doubt list and keep studying. Resolve the entire batch at the end of the session. This maintains flow, and you'll often find the doubt resolves itself as you study further.",
  },
  {
    short: "Schedule your hardest topic first every single day.",
    detailed:
      "Willpower is highest at the start of your study session. Put your weakest subject or most difficult chapter first — before you're tired, before you have excuses. Easy topics done first create a false sense of productivity while the hard work remains undone.",
  },
  {
    short: "Saturday: mock tests. Sunday: deep error analysis. Every week.",
    detailed:
      "Build a weekly rhythm: Saturday mock under exam conditions, Sunday full analysis of every error without time pressure. This weekly cycle ensures you're both practicing under pressure and deeply learning from mistakes — the two activities most students neglect.",
  },
  {
    short: "Use commute and waiting time for theory revision, not scrolling.",
    detailed:
      "Any waiting time is ideal for low-intensity revision: reading a summary sheet, recalling formulas mentally, reviewing your mistakes notebook. Protect desk time for active problem solving. Use in-between time for passive review.",
  },
  {
    short: "Never skip sleep to study — it destroys the next 2 days.",
    detailed:
      "Sleeping fewer than 6 hours kills memory consolidation, slows reaction time, and impairs logical reasoning — exactly the skills JEE tests. One all-nighter costs you 2 full days of degraded performance. 10 hours of quality study beats 14 hours of sleep-deprived study.",
  },
  {
    short: "Revise a topic within 24 hours of learning it — this is critical.",
    detailed:
      "The forgetting curve drops 70% within 24 hours without review. Revise any new topic within 24 hours using active recall: close the book and write everything you remember. A 15-minute review in 24 hours locks in what would take hours to re-learn days later.",
  },
  {
    short:
      "Set a hard stop time for studying and respect it — it builds urgency.",
    detailed:
      "Decide in advance when your study session ends and stop at that time regardless. This trains you to work with urgency during study hours rather than leisurely assuming you'll study more later. Work expands to fill available time — constrain it.",
  },
  {
    short: "Review today's key points in 5 minutes before sleeping.",
    detailed:
      "Before bed, spend 5 minutes reviewing the main concepts from today's study session — just key points, no new material. This primes memory consolidation during sleep. Learning reviewed before sleep is retained significantly better than learning reviewed in the morning.",
  },
  {
    short: "Take one complete rest day per week — burnout kills streaks.",
    detailed:
      "Full mental recovery requires periodic disengagement. Take one relaxed day per week — light revision only, some physical activity. Students who rest strategically consistently outperform those who study 7 days with declining quality. Recovery is part of preparation.",
  },
  {
    short: "Every Physics problem starts with a free body diagram.",
    detailed:
      "Before writing any equation, draw the free body diagram. Every force on every object, clearly labelled with direction. This single habit prevents the majority of Physics errors — wrong sign, missing force, wrong direction. It takes 20 seconds and saves 5 minutes.",
  },
  {
    short: "Understand the Physics concept before memorising the formula.",
    detailed:
      "If you understand why F=ma, you can reconstruct it. If you only memorised it, one moment of exam stress wipes it out. For every Physics formula, understand what it physically means — what changing each variable does to the system.",
  },
  {
    short: "Dimensional analysis catches 80% of formula errors instantly.",
    detailed:
      "Before substituting numbers, verify your equation is dimensionally consistent. Both sides must have identical SI units. This catches transposed formulas, missing factors of 2 or π, and wrong variable substitutions — all common errors even when your Physics understanding is correct.",
  },
  {
    short: "Draw energy diagrams for every mechanics problem.",
    detailed:
      "Potential energy vs position diagrams reveal equilibrium points, stability, turning points, and motion direction without solving differential equations. Sketching U(x) graphs for springs, pendulums, and gravitational wells makes complex mechanics problems visually obvious.",
  },
  {
    short: "Electrostatics: superposition is your most powerful tool.",
    detailed:
      "Every complex electrostatics problem reduces to superposition of simple configurations. Decompose the charge distribution into point charges, rings, discs, or shells — each with a known field. Add vectors carefully. This solves problems that seem impossibly complex.",
  },
  {
    short:
      "Waves: always separate what is oscillating from what is propagating.",
    detailed:
      "In any wave problem, distinguish the medium particles (which oscillate) from the wave (which propagates). The wave transfers energy but not matter. This clears up standing waves, superposition, and intensity problems that confuse students who blur the two concepts.",
  },
  {
    short:
      "Modern Physics is formula-heavy but concept-light — master it quickly.",
    detailed:
      "Modern Physics (photoelectric effect, Bohr model, radioactivity, nuclear physics) requires fewer deep concepts than Mechanics but precise formula use. Compile all formulas in one sheet, memorise the constants, and solve 100 numericals. This chapter is a reliable mark scorer.",
  },
  {
    short: "Thermodynamics: draw the PV diagram before calculating anything.",
    detailed:
      "The PV diagram is to Thermodynamics what the free body diagram is to Mechanics. Draw it first — identify the process, mark start and end states, and read off work done from the area under the curve. This prevents the most common Thermodynamics errors.",
  },
  {
    short:
      "Electricity circuits: redraw in simplest form before applying equations.",
    detailed:
      "Most complex circuit problems have symmetry or reducible series/parallel combinations hiding in plain sight. Spend 30 seconds redrawing the circuit in its simplest equivalent form before applying Kirchhoff. Rushing straight to equations wastes time on unnecessarily complex systems.",
  },
  {
    short:
      "Rotational Motion: always choose the axis that eliminates unknown torques.",
    detailed:
      "The choice of axis for torque calculations is strategic, not arbitrary. Choose an axis that passes through the point of application of unknown forces to eliminate them from your equation. This reduces unknowns and simplifies solutions dramatically — most students choose randomly and end up with harder algebra.",
  },
  {
    short: "Organic Chemistry reactions follow patterns — learn the mechanism.",
    detailed:
      "Every Organic reaction follows a mechanical electron-flow pattern. Learn why nucleophiles attack electrophilic carbons, not just what the product is. Once you understand the mechanism, you can predict any reaction outcome rather than memorising 200 separate reactions.",
  },
  {
    short: "Periodic table trends are the backbone of Inorganic Chemistry.",
    detailed:
      "Electronegativity, ionisation energy, atomic radius, electron affinity — all trend predictably across periods and down groups. Before memorising exceptions, understand core trends perfectly. At least 40% of Inorganic Chemistry questions are answered directly by knowing these trends and their reasons.",
  },
  {
    short: "Physical Chemistry is applied Maths — treat it exactly like one.",
    detailed:
      "Chemical Kinetics, Thermodynamics, Electrochemistry, and Solutions are mathematics with chemical context. Use the same systematic approach: derive the formula, understand the variable relationships, solve numericals. Students who treat Physical Chemistry as memorisation consistently underperform.",
  },
  {
    short:
      "Balance redox equations using oxidation state method, not trial and error.",
    detailed:
      "The oxidation number method for balancing redox equations is systematic and works every time: calculate oxidation state change for each element, equalise electron transfer, balance atoms, then balance charge with H+ or OH-. Practice until it is automatic.",
  },
  {
    short: "Draw all structural isomers methodically — never by intuition.",
    detailed:
      "When identifying isomers, draw systematically: start with the longest carbon chain, reduce by one carbon each time adding branches, then change functional group positions. Random intuitive drawing always misses isomers. A systematic 3-step process finds them all.",
  },
  {
    short: "Memorise Chemistry exceptions — they are the most tested.",
    detailed:
      "JEE loves asking about anomalous behaviour: water's anomalous expansion, Fluorine without d-orbitals, the diagonal relationship in the periodic table, anomalous configurations of Cr and Cu. Compile 20 key exceptions and their reasons. These appear disproportionately in JEE questions.",
  },
  {
    short: "Use IUPAC naming on every single practice problem.",
    detailed:
      "Naming seems tedious but IUPAC questions appear every year. More importantly, the naming exercise forces you to read structural formulas carefully, helping you correctly identify compounds in every reaction question. Make IUPAC naming automatic — it transfers to all other skills.",
  },
  {
    short: "p-block: know the oxides and hydrides of each group cold.",
    detailed:
      "For each p-block group (13-18), know the nature of oxides (acidic/basic/amphoteric), the nature of hydrides (reducing/non-reducing), and the anomalous behaviour of the first element. This covers 70% of p-block questions with systematic knowledge rather than random memorisation.",
  },
  {
    short: "The Nernst equation appears in JEE almost every single year.",
    detailed:
      "Master the Nernst equation: E = E° - (RT/nF)lnQ. Know how to calculate cell potential at non-standard conditions, how concentration affects EMF, and how to relate E to ΔG and equilibrium constant K. One problem from this area appears almost guaranteed in every paper.",
  },
  {
    short:
      "Use curved arrows for reaction mechanisms — never memorise without them.",
    detailed:
      "Arrow-pushing notation forces you to track electron flow, which is the actual chemistry. Drawing curved arrows from nucleophile to electrophile, from bond to leaving group — this process tells you what product forms. Students who memorise outcomes without mechanism fail on modified versions of standard reactions.",
  },
  {
    short:
      "Calculus: understand the definition of derivative before the rules.",
    detailed:
      "The derivative is the instantaneous rate of change — this single understanding unlocks all of Calculus. Before applying differentiation rules mechanically, understand what you are calculating: the limit of Δy/Δx as Δx→0. This handles unusual functions and applied problems that formula-only students cannot.",
  },
  {
    short: "The unit circle is more powerful than any trig formula sheet.",
    detailed:
      "All trigonometric values, signs, and identities follow from the unit circle. Spend 2 hours deeply understanding it and you'll never need to memorise ASTC, sign charts, or most trig identities — they become visually obvious. This is one of the highest-ROI hours in JEE Maths prep.",
  },
  {
    short:
      "Coordinate Geometry: verify your equation by substituting a known point.",
    detailed:
      "After deriving the equation of a line, circle, parabola, or ellipse, substitute one point you know is on the curve and verify it satisfies your equation. This 10-second check catches algebraic errors before they propagate into wrong final answers.",
  },
  {
    short: "Probability: always define the sample space before anything else.",
    detailed:
      "Every Probability error starts with an incorrectly defined sample space. Before calculating anything, write out all possible outcomes and verify they are mutually exclusive and exhaustive. A correctly defined sample space makes probability calculations almost automatic.",
  },
  {
    short:
      "Matrices: learn the cofactor method for inverse — it's faster for 3x3.",
    detailed:
      "For JEE, cofactor method is faster than row reduction for 3×3 matrices. Find the cofactor matrix, transpose it to get the adjugate, divide by the determinant. Practice until this takes under 4 minutes. Determinant and inverse calculations appear in almost every JEE paper.",
  },
  {
    short: "Vectors: resolve every 3D problem into components immediately.",
    detailed:
      "3D geometry and vector problems become mechanical once you resolve all vectors into î, ĵ, k̂ components. The dot product, cross product, and angle between vectors become arithmetic. Students who work with magnitude-and-angle form in 3D make errors that component form prevents.",
  },
  {
    short: "Integration: recognise the type before choosing the technique.",
    detailed:
      "Before integrating, classify: standard form, substitution, by parts, partial fractions, or trigonometric substitution? Spending 5 seconds recognising the type saves 5 minutes of wrong attempts. Build a decision tree: check if it's a derivative of the denominator, then try substitution, then parts.",
  },
  {
    short: "AP, GP, HP sum formulas must be completely automatic.",
    detailed:
      "Sum of AP, GP, HP, sum of squares, sum of cubes — these must be instantly accessible. For AGP (Arithmetic-Geometric Progression), practice the multiply-and-subtract method specifically. These topics appear in JEE almost every year and reward thorough practice over intuition.",
  },
  {
    short:
      "Complex numbers: draw the Argand plane — most problems become visual.",
    detailed:
      "Most complex number problems that seem algebraic are actually geometric — rotation, distance, locus. Draw the Argand plane immediately. Multiplication by i is a 90° rotation; |z1-z2| is the distance between two points. Seeing the geometry reduces complex algebra to simple diagrams.",
  },
  {
    short: "P&C: always ask 'is order important?' before writing any formula.",
    detailed:
      "The single question separating Permutation from Combination: does order matter? Then ask: are objects distinct or identical? Are repetitions allowed? These three questions cover 95% of P&C problem types. Answer them first, choose the formula second.",
  },
  {
    short: "Drink 3 litres of water daily — dehydration kills focus.",
    detailed:
      "Even mild dehydration (1-2% of body weight) measurably impairs cognitive performance, memory, and concentration. Keep a 1-litre bottle on your desk and finish 3 refills by end of day. The habit takes 2 days to form and pays dividends every study hour.",
  },
  {
    short: "Eat light at lunch — heavy meals crash your afternoon energy.",
    detailed:
      "High-carbohydrate, heavy lunches trigger a post-meal insulin response that produces significant drowsiness 30-60 minutes later. Eat light, protein-rich lunches — dal, curd, eggs — and save heavier meals for dinner after your session. Afternoon productivity will visibly improve.",
  },
  {
    short: "30 minutes of walking daily is brain maintenance, not optional.",
    detailed:
      "Aerobic exercise increases BDNF (Brain-Derived Neurotrophic Factor), which directly supports memory consolidation. A 30-minute walk is not time lost to studying — it is maintenance that makes the other 10 hours more effective. Students who exercise consistently outperform those who don't.",
  },
  {
    short: "Follow the 20-20-20 rule for eyes every study session.",
    detailed:
      "Every 20 minutes, look at something 20 feet away for 20 seconds. This resets the ciliary muscle of your eye, preventing strain that leads to headaches and concentration drops. Studying with persistent eye strain means operating at 60% capacity.",
  },
  {
    short: "A 20-minute nap restores focus without causing grogginess.",
    detailed:
      "A 20-minute nap (set a strict alarm) improves alertness for the next 2-3 hours. Going beyond 20 minutes enters deep sleep and causes post-nap grogginess lasting 30+ minutes. The 20-minute nap is well-studied and highly effective — use it after lunch if needed.",
  },
  {
    short: "Never study past midnight — retention is minimal after then.",
    detailed:
      "After midnight, your brain's ability to encode new memories drops sharply due to circadian rhythm effects. Studying from 11 PM to 1 AM produces minimal retention while destroying sleep quality. Those 2 hours are better spent sleeping and starting fresh at 5 AM.",
  },
  {
    short: "Eat a banana or nuts before a study session for sustained energy.",
    detailed:
      "Bananas provide quick-release glucose and potassium; nuts provide slow-release energy and healthy fats that support brain function. Eating either 15 minutes before a study session prevents energy dips mid-session better than caffeine, without the crash.",
  },
  {
    short: "Same sleep and wake time every day — consistency is everything.",
    detailed:
      "Irregular sleep times disrupt the circadian rhythm and degrade sleep quality even when total hours are the same. Consistent sleep and wake times (weekends included) produce deeper, more restorative sleep with no extra cost. Rhythm is the foundation.",
  },
  {
    short: "5-minute stretch every hour — your spine and focus will thank you.",
    detailed:
      "Sustained sitting compresses spinal discs and reduces blood flow, creating physical discomfort that accumulates into significant distraction. A 5-minute standing stretch every hour — neck rolls, shoulder rolls, back extension — resets physical comfort and gives your attention a genuine reset.",
  },
  {
    short:
      "Never study with lyrics on — they use the same memory buffer as reading.",
    detailed:
      "Language — spoken or sung — occupies the same working memory buffer that reading and problem solving use. Studying with lyrical music or TV on forces split attention, reducing comprehension and retention by 20-40% compared to silence. Silence or instrumental music only.",
  },
  {
    short: "Comparison with others is the fastest way to destroy your focus.",
    detailed:
      "Your preparation timeline, pace, and method are unique to your starting point. Comparing your Day 45 to someone else's Day 200 is meaningless and corrosive. Measure progress against your own previous performance only. The question is not 'am I better than them?' but 'am I better than yesterday?'",
  },
  {
    short: "Boredom during study is the signal you are doing the right work.",
    detailed:
      "Deep, sustained study of difficult concepts feels boring — not exciting. The exciting feeling comes from easy work that creates no new neural pathways. When you feel bored by a chapter, you are doing real work. Embrace it. Difficulty is the sensation of your brain growing.",
  },
  {
    short: "Your rank is determined by your worst subject, not your best.",
    detailed:
      "JEE cutoffs require minimum performance across all three subjects. Being exceptional in Maths while weak in Chemistry is a strategy that fails. Identify your weakest subject every week and give it disproportionate time. One strong weak-subject performance lifts your rank more than marginal gains in your strong subject.",
  },
  {
    short: "Eliminate the option of quitting before you even start.",
    detailed:
      "The option to quit is a cognitive tax on every difficult session. Remove it by committing to a specific number of days where quitting is simply not a choice you will entertain. This single mental shift removes the daily decision cost and produces extraordinary consistency.",
  },
  {
    short: "Fear of failure is not your enemy — complacency is.",
    detailed:
      "Some anxiety about the exam is productive — it signals stakes and drives effort. The real enemy is complacency: believing your current effort level is sufficient. Check honestly every week: if the exam were tomorrow, would you feel prepared? If not, adjust today.",
  },
  {
    short: "Celebrate small wins — they compound into massive momentum.",
    detailed:
      "Completing a difficult chapter, getting a hard problem right, maintaining your streak — acknowledge these explicitly. Small wins activate the reward system and make you more likely to repeat the behaviour. Students who track small progress maintain motivation far longer than those who only focus on the end goal.",
  },
  {
    short: "Visualise your exam day success every night before sleeping.",
    detailed:
      "5 minutes of vivid positive visualisation before sleep programmes your brain for confidence and reduces exam anxiety over time. Don't visualise the result — visualise the process: sitting calmly, reading methodically, solving problems you know. Mental rehearsal makes the actual experience feel familiar.",
  },
  {
    short: "Discomfort is temporary. The regret of not trying is permanent.",
    detailed:
      "Every hard morning, boring chapter, and frustrating problem session ends. The discomfort is finite. The clarity of having given your best effort — regardless of outcome — lasts far longer. Make decisions based on who you want to be in 5 years, not how you feel right now.",
  },
  {
    short: "Identify your peak focus hours and protect them ruthlessly.",
    detailed:
      "Every person has 4-6 hours of peak cognitive performance per day. Identify your personal window — morning for most, late evening for some. Guard this window exclusively for your most demanding work. Filling it with easy tasks is a permanent, unrecoverable loss.",
  },
  {
    short:
      "The consistent student beats the brilliant one who doesn't show up.",
    detailed:
      "Consistency over 12 months compounds to an enormous advantage. A student studying 6 focused hours daily for 300 days accumulates 1800 hours — more than any cramming strategy can produce. You don't need to be the smartest in the room. You need to be the most consistent.",
  },
  {
    short: "Read the entire paper for 5 minutes before solving anything.",
    detailed:
      "Spend the first 5 minutes reading every question without attempting any. This activates background processing — your brain begins working on all questions simultaneously. Questions that seemed hard often become clearer mid-paper due to this early activation.",
  },
  {
    short:
      "Start with your strongest subject to build confidence and bank marks.",
    detailed:
      "Starting with the subject you're most confident in banks those marks early, reduces anxiety, and frees cognitive load for harder subjects. A confident mindset going into your weaker subjects outperforms an anxious one by a measurable margin in actual performance.",
  },
  {
    short: "Never spend more than 4 minutes on one stuck question.",
    detailed:
      "More than 3-4 minutes on one stuck question is never the right decision in JEE. Mark it clearly, move on, and return after completing the rest. Returning with fresh eyes after other questions often produces the insight that was missing the first time.",
  },
  {
    short:
      "Negative marking: only guess when you can eliminate at least 2 options.",
    detailed:
      "Random guessing in JEE Advanced produces negative expected value. Only attempt uncertain questions when you can confidently eliminate at least 2 of 4 options, giving positive expected value even with negative marking. Skipping is worth more than random guessing.",
  },
  {
    short:
      "JEE Mains: perfect accuracy on easy questions beats racing to hard ones.",
    detailed:
      "In JEE Mains, 60-70% of questions are straightforward standard applications. Perfect accuracy here gets you a strong score. Racing through them to attempt hard questions — and making avoidable errors — is the mistake that separates strong students from toppers.",
  },
  {
    short:
      "Keep rough work neat and systematic — toppers have immaculate rough work.",
    detailed:
      "Sloppy rough work leads to misread signs, lost intermediate results, and repeated calculations. Keep rough work organised in columns — one problem per section. The 5 extra seconds of organised writing saves 2 minutes of retracing steps. This is a genuine differentiator.",
  },
  {
    short: "Don't change your first answer unless you found a specific error.",
    detailed:
      "Research consistently shows first instincts are more often correct than second-guessing. Change an answer only if you find a specific, identifiable error in your original solution — not because you 'feel' uncertain. Doubt-based changes more often go from right to wrong.",
  },
  {
    short: "Physics then Chemistry then Maths — test this order in every mock.",
    detailed:
      "Physics and Chemistry questions generally take less time than Maths problems. Completing them first banks marks efficiently and leaves maximum time for Maths, where investment yields higher returns. Test this order in every mock and adjust based on your personal speed.",
  },
  {
    short:
      "Integer-type questions have no negative marking — always attempt all.",
    detailed:
      "JEE Advanced integer-type questions (0-9 answer) carry no negative marking. Every one must be attempted — never skipped. Even a rough estimate or dimensional analysis can produce the correct integer. These have the highest expected value per minute of any question type.",
  },
  {
    short: "Eat light and sleep 8 hours the night before the exam — not study.",
    detailed:
      "The night before JEE is for physical preparation, not last-minute study. Eat a light, familiar meal. Sleep at your normal time. Lay out everything for tomorrow. A rested, calm brain on exam day outperforms a stressed, sleep-deprived one that studied until 2 AM.",
  },
  {
    short: "Active recall beats re-reading by 3x for long-term retention.",
    detailed:
      "Re-reading notes feels productive but produces minimal retention because it is passive. Instead, close the book, write or say everything you remember about a topic, then check what you missed. This retrieval practice is 3x more effective at building long-term memory.",
  },
  {
    short:
      "Revise on days 1, 3, 7, 14, and 30 after learning — this is the spaced schedule.",
    detailed:
      "The forgetting curve is predictable — and beatable. Review new material on day 1, day 3, day 7, day 14, and day 30. Each review requires progressively less time while strengthening the memory trace. This gives near-permanent retention with total revision time under 2 hours per chapter.",
  },
  {
    short: "Create a one-page summary of each chapter after completing it.",
    detailed:
      "After finishing a chapter, compress everything important onto one A4 page: key formulas, common tricks, frequent error types, 3 representative problems. This summary sheet is your revision tool for the next 12 months. Creating it is itself a powerful consolidation exercise.",
  },
  {
    short: "Teach a concept to an imaginary student — gaps reveal themselves.",
    detailed:
      "The Feynman Technique: explain a concept as if teaching a 10-year-old, then identify where your explanation becomes vague or requires jargon. Vagueness signals a gap. Go back to the source, fill the gap, then explain again. This converts surface familiarity into deep understanding.",
  },
  {
    short: "Revise formulas every morning for 10 minutes — just formulas.",
    detailed:
      "Keep a formula sheet for all three subjects. Spend 10 minutes every morning reading through it — not studying, just reading. This daily low-intensity exposure prevents formula blanks under exam stress. Formulas forgotten in the exam are almost always ones never regularly reviewed.",
  },
  {
    short: "Interleaved revision beats blocked revision for exam performance.",
    detailed:
      "Instead of revising all of Physics, then all of Chemistry, then all of Maths in blocks — mix questions from different topics in the same session. It feels harder but produces dramatically better performance on mixed exams like JEE. Difficulty during revision is the signal of effective revision.",
  },
  {
    short:
      "Before a new chapter, write what you already know — this primes learning.",
    detailed:
      "Spending 5 minutes before a new chapter writing down everything you already know activates prior knowledge and creates hooks for the new information. This pre-activation means new concepts connect to existing ones immediately, improving comprehension speed and retention depth.",
  },
  {
    short:
      "Test yourself every 20 minutes — never revise for longer without recall.",
    detailed:
      "Long uninterrupted revision blocks create an illusion of learning. The information feels familiar during processing but the memory trace is weak. Every 20 minutes, close the material and test yourself. This self-testing, even if imperfect, massively strengthens retention compared to unbroken reading.",
  },
  {
    short: "Review your last mock's error analysis before your next mock.",
    detailed:
      "Before sitting your next mock, spend 15 minutes reviewing error categories from the previous one. This ensures you're testing whether you've fixed specific weaknesses, not just practicing in a vacuum. Performance improvement requires targeted correction, not repeated exposure.",
  },
  {
    short: "Last month before JEE: revise and practice only — no new chapters.",
    detailed:
      "In the final month, stop starting new chapters. Every hour of new content displaces an hour of revision of already-learned material. Your score is built on strong retrieval of known content, not weak familiarity with new content. Revise relentlessly, attempt daily mocks, and trust the work you've done.",
  },
];

const JEE_TIPS = {
  7: "🎓 7-DAY WARRIOR! You're building momentum!\n\n✅ Solve 50-70 problems daily\n✅ Sleep: 11 PM - 6 AM (7-8 hours)\n✅ Wake up: 5-6 AM\n✅ 10-min breaks every hour\n✅ Drink water, eat healthy snacks\n✅ Exercise 30 mins daily\n\nYour consistency is POWER! 💪",

  21: "🎓 21-DAY MASTER! You're a warrior!\n\n✅ Solve 100-150 problems daily\n✅ Morning (5-8 AM): Maths\n✅ Afternoon (2-5 PM): Physics\n✅ Evening (7-10 PM): Chemistry\n✅ Sleep by 10 PM (no negotiations!)\n✅ Weak topics: Extra 1 hour daily\n\nYou're unstoppable! 🔥",

  30: "🎓 30-DAY LEGEND! You're elite now!\n\n✅ 2-3 full mock tests per week\n✅ Analyze mistakes 1 hour daily\n✅ Join study group once a week\n✅ Revise previous day's concepts\n✅ Meditation: 10 mins daily\n✅ Track weak areas + 2 extra hours\n\nYou're ELITE! 👑",

  60: "⚡ 60-DAY GOD MODE! You're a machine!\n\n✅ 5 full-length mocks per week\n✅ Speed: 30 problems in 30 mins\n✅ Accuracy focus on easy problems\n✅ Weak areas: Extra 2 hours daily\n✅ 3 mins per problem (average)\n✅ Sleep 8 hours (SUPERPOWER!)\n\nYou're HIGH LEVEL! ⚡",

  90: "🌟 90-DAY ELITE! Approaching mastery!\n\n✅ Target: 95+ percentile\n✅ Standard + Advanced problems\n✅ Conceptual clarity > Speed\n✅ 3 mins per problem\n✅ Mock tests: Analyze details\n✅ Meditation: 20 mins daily\n\nYou're EXCELLENT! 🌟",

  365: "🎊 365-DAY IMMORTAL! You've WON!\n\n✅ You've mastered consistency\n✅ Dedication is unmatched\n✅ Master all approaches\n✅ Teach others - cement learning\n✅ Share your journey\n✅ IIT/NIT is YOURS!\n\n🏆 THIS IS EXCELLENCE! 🏆",
};

const MILESTONE_MESSAGES = {
  7: "7-day streak champion! You're on fire! 🔥",
  21: "21-day warrior! Consistency is key! 💪",
  30: "30-day legend! You're unstoppable! 👑",
  60: "60-day god mode activated! ⚡",
  90: "90-day elite! This is excellence! 🌟",
  365: "365-day immortal! You're a legend! 🎊",
};

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

// ==========================================
// MOTIVATIONAL HINGLISH LINES (Change 7)
// ==========================================
const MOTIVATIONAL_HINGLISH = [
  "Kar le re bhai, teri mehnat rang laayegi! 🔥",
  "Aaj jeet gaya, kal IIT ka gate tera hoga! 👑",
  "Haar ke nahi, jeet ke dikha — ye teri kahani hai! ⚡",
  "Toofan se ladna seekh le, IIT tera intezaar kar raha hai! 🚀",
  "Zindagi mein mushkilein aayengi, par tu IITian bann ke dikhayega! 💪",
  "Aaj ka effort, kal ki takdeer — bas chalte reh! 🏆",
  "Tu hi warrior hai, tu hi legend — ruk mat kabhi! 🔥",
  "Duniya dekhti rahegi, tu padh ke unhe jawab dega! ⚔️",
];

const RANK_TIERS = {
  0: { name: "SCROLLER", color: "text-red-500", symbol: "☠️" },
  1: { name: "MORTAL", color: "text-zinc-400", symbol: "💀" },
  2: { name: "NEAR JEE ASPIRANT", color: "text-yellow-400", symbol: "⚡" },
  3: { name: "PURE JEE ASPIRANT", color: "text-green-400", symbol: "🔥" },
  4: { name: "MAYBE NITIAN", color: "text-blue-400", symbol: "🎯" },
  5: { name: "LIKELY IITIAN", color: "text-purple-400", symbol: "👑" },
};

const STREAK_TIERS = (streak) => {
  if (streak >= 30) return { tier: "GOD MODE", color: "text-purple-600" };
  if (streak >= 14) return { tier: "IITIAN-TIER", color: "text-cyan-500" };
  if (streak >= 7) return { tier: "NITIAN-TIER", color: "text-blue-500" };
  if (streak >= 1) return { tier: "MORTAL", color: "text-yellow-500" };
  return { tier: "SCROLLER", color: "text-red-500" };
};

// ==========================================
// SIMULATED LEADERBOARD COMPETITORS
// ==========================================
const FAKE_COMPETITOR_NAMES = [
  "PhysicsSlayer",
  "IITDreamer",
  "PCMWarrior",
  "RankHunter",
  "NightCoder",
  "QuantumKid",
  "LimitBreaker",
  "VectorMaster",
];

// Deterministic seeded random — same date = same values for all users
const seededRand = (dateStr, index) => {
  const dateSeed = parseInt(dateStr.replace(/-/g, ""), 10);
  const x = Math.sin(dateSeed * 9301 + index * 49297 + 233) * 10000;
  return x - Math.floor(x);
};

// ==========================================
// MAIN COMPONENT
// ==========================================
export default function JeeGodModeTracker() {
  const [authState, setAuthState] = useState("loading");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [user, setUser] = useState(null);
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [resetFlowStep, setResetFlowStep] = useState("login"); // 'login', 'forgot', 'success', 'register'
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMessage, setResetMessage] = useState("");

  const [streak, setStreak] = useState(0);
  const [l5Streak, setL5Streak] = useState(0);
  const [history, setHistory] = useState({});
  const [lastBattleTime, setLastBattleTime] = useState(0);
  const [botTodayTarget, setBotTodayTarget] = useState(6);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [lastNotificationDate, setLastNotificationDate] = useState(null);
  const [hasSubmittedData, sethasSubmittedData] = useState(true);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [tipStartDate, setTipStartDate] = useState(null);
  const [lastTipShownDate, setLastTipShownDate] = useState(null);

  const [grindHours, setGrindHours] = useState(1);
  const [doomHours, setDoomHours] = useState(0);
  const [physicsHours, setPhysicsHours] = useState(0.33);
  const [chemistryHours, setChemistryHours] = useState(0.33);
  const [mathsHours, setMathsHours] = useState(0.34);
  const [modal, setModal] = useState(null);
  const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth());
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());
  const [botMsg, setBotMsg] = useState("Awaiting your performance strike...");
  const [todayBattle, setTodayBattle] = useState(null);
  const [currentEgoQuote, setCurrentEgoQuote] = useState(EGO_INSULTS[0]);
  const [sevenDayData, setSevenDayData] = useState([]);
  const [leaderboardUsers, setLeaderboardUsers] = useState([]);
  const [leaderboardDate, setLeaderboardDate] = useState(null);
  const [showGraphModal, setShowGraphModal] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showPieChart, setShowPieChart] = useState(false);
  const [selectedPieData, setSelectedPieData] = useState(null);
  const [serverTimeDeviation, setServerTimeDeviation] = useState(null);
  const [isTimeValid, setIsTimeValid] = useState(true);
  const [currentLevel, setCurrentLevel] = useState(0);
  const [isButtonDisabled, setIsButtonDisabled] = useState(false);
  const [timeUntilMidnight, setTimeUntilMidnight] = useState(null);
  const [lastBattleDate, setLastBattleDate] = useState(null);
  const [graphCalendarData, setGraphCalendarData] = useState(null);
  const [expandedGraphMonth, setExpandedGraphMonth] = useState(null);
  const [showGraphCalendar, setShowGraphCalendar] = useState(false);
  const [selectedWeekData, setSelectedWeekData] = useState(null);
  // Exit-animation state: 'main' | 'leaderboard' | 'graph' | 'pie' | null
  const [closingModal, setClosingModal] = useState(null);
  // Auth slide-transition state for login ↔ register
  const [authOutClass, setAuthOutClass] = useState("");

  const evaluatePerformance = (h, s) => {
    const hours = parseFloat(h);
    const scroll = parseFloat(s);

    if (scroll > 4) {
      return { lv: 0, rank: "Scroller", color: "text-red-500" };
    }

    if (hours >= 11 && scroll <= 1) {
      return { lv: 5, rank: "Likely IITian", color: "text-purple-400" };
    }

    if (hours >= 9 && scroll <= 2) {
      return { lv: 4, rank: "Maybe NITian", color: "text-blue-400" };
    }

    if (hours >= 7 && scroll <= 3) {
      return { lv: 3, rank: "Pure JEE Aspirant", color: "text-green-400" };
    }

    if (hours >= 4 && scroll <= 4) {
      return { lv: 2, rank: "Near JEE Aspirant", color: "text-yellow-400" };
    }

    if (hours < 4 && scroll <= 1) {
      return { lv: 1, rank: "Mortal", color: "text-zinc-400" };
    }

    return { lv: 0, rank: "Scroller", color: "text-red-500" };
  };

  const getTodayStr = () => getTodayStrIST();

  // ── Simulated competitors (display-only, never written to Firestore) ──
  const getDailyFakeCompetitors = (dateStr) => {
    // Reference date: app launch. Days elapsed drives streak increment.
    const REF_DATE = new Date("2026-03-11T00:00:00");
    const parts = dateStr.split("-");
    const thisDate = new Date(
      parseInt(parts[0]),
      parseInt(parts[1]) - 1,
      parseInt(parts[2]),
    );
    const daysElapsed = Math.max(
      0,
      Math.round((thisDate - REF_DATE) / 86400000),
    );

    return FAKE_COMPETITOR_NAMES.map((name, i) => {
      // ── Study: 2–7h in 0.25 steps ──
      const rawStudy = 2 + seededRand(dateStr, i * 3) * 5;
      const studyHrs = Math.round(rawStudy * 4) / 4; // snapped to 0.25

      // ── Screen: 1–5h in 0.5 steps ──
      const rawScreen = 1 + seededRand(dateStr, i * 7 + 1) * 4;
      const screenHrs = Math.round(rawScreen * 2) / 2; // snapped to 0.5

      // ── PCM split: must sum exactly to studyHrs, each in 0.25 steps ──
      const units = Math.round(studyHrs * 4); // total 0.25-units
      const pUnits =
        Math.floor(seededRand(dateStr, i * 13 + 5) * (units - 2)) + 1;
      const cUnits =
        Math.floor(seededRand(dateStr, i * 17 + 6) * (units - pUnits - 1)) + 1;
      const mUnits = units - pUnits - cUnits;
      const physicsH = pUnits * 0.25;
      const chemistryH = cUnits * 0.25;
      const mathsH = mUnits * 0.25;

      // ── Streak: base (seeded per bot) + 1 per day elapsed ──
      // Use fixed numeric seed 99991 for base streak (avoids NaN from string seed)
      const baseStreak = Math.floor(seededRand("99991", i * 11 + 2) * 10); // 0–9 base
      const streakVal = baseStreak + daysElapsed;

      const perf = evaluatePerformance(studyHrs, screenHrs);
      return {
        uid: `bot_${name}`,
        id: `bot_${name}`,
        streak: streakVal,
        level: perf.lv,
        levelRank: perf.rank,
        levelColor: perf.color,
        avgStudyTime: studyHrs,
        avgScrollTime: screenHrs,
        physics: physicsH,
        chemistry: chemistryH,
        maths: mathsH,
        latestBattleDate: dateStr,
        hasData: true,
        isBot: true,
        anonymousId: null,
        rankNum: 0,
        isCurrentUser: false,
      };
    });
  };

  // ── Close-with-exit-animation helper ──
  const closeAnyModal = useCallback((type) => {
    setClosingModal(type);
    setTimeout(() => {
      setClosingModal(null);
      if (type === "main") setModal(null);
      else if (type === "leaderboard") {
        setShowLeaderboard(false);
        setLeaderboardDate(null);
      } else if (type === "graph") setShowGraphModal(false);
      else if (type === "pie") setShowPieChart(false);
    }, 260);
  }, []);

  // ── Auth slide helpers — CSS transition on combined panel handles the animation ──
  const goToRegister = () => {
    setAuthState("register");
    setAuthError("");
  };
  const goToLoginFromRegister = () => {
    setAuthState("login");
    setResetFlowStep("login");
    setAuthError("");
  };

  const generateGraphCalendarData = (historyData) => {
    const calendarStructure = [];

    for (let year = 2026; year <= 2030; year++) {
      for (let month = 0; month < 12; month++) {
        let monthDate = new Date(year, month, 1);
        const monthNum = month + 1;

        const monthLabel = monthDate.toLocaleString("default", {
          month: "long",
          year: "numeric",
        });

        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const firstDayOfWeek = new Date(year, month, 1).getDay();

        const weeks = [];
        let currentWeek = [];

        for (let j = 0; j < firstDayOfWeek; j++) {
          currentWeek.push({ day: null, dateStr: null, data: null });
        }

        for (let day = 1; day <= daysInMonth; day++) {
          const dateStr = `${year}-${String(monthNum).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const battleData = historyData[dateStr];

          currentWeek.push({
            day,
            dateStr,
            data: battleData || null,
          });

          if (currentWeek.length === 7) {
            weeks.push(currentWeek);
            currentWeek = [];
          }
        }

        if (currentWeek.length > 0) {
          while (currentWeek.length < 7) {
            currentWeek.push({ day: null, dateStr: null, data: null });
          }
          weeks.push(currentWeek);
        }

        calendarStructure.push({
          monthLabel,
          year,
          month: monthNum,
          monthKey: `${year}-${String(monthNum).padStart(2, "0")}`,
          weeks,
        });
      }
    }

    return calendarStructure;
  };

  const generateWeekGraphData = (entries) => {
    if (!entries || entries.length === 0) return [];

    const days = [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ];

    const dateStrParts = entries[0].dateStr.split("-");
    const entryYear = parseInt(dateStrParts[0]);
    const entryMonth = parseInt(dateStrParts[1]) - 1;
    const entryDay = parseInt(dateStrParts[2]);

    const firstDate = new Date(entryYear, entryMonth, entryDay);
    const dayOffset = firstDate.getDay();

    const sundayYear = firstDate.getFullYear();
    const sundayMonth = firstDate.getMonth();
    const sundayDay = firstDate.getDate() - dayOffset;

    const weekData = [];

    for (let i = 0; i < 7; i++) {
      const date = new Date(sundayYear, sundayMonth, sundayDay + i);
      const dateYear = date.getFullYear();
      const dateMonth = String(date.getMonth() + 1).padStart(2, "0");
      const dateDay = String(date.getDate()).padStart(2, "0");
      const dateStr = `${dateYear}-${dateMonth}-${dateDay}`;

      const dayData = Object.fromEntries(
        entries
          .filter((e) => e.dateStr === dateStr)
          .map((e) => [e.dateStr, e.battleData]),
      );
      const battleData = dayData[dateStr];

      weekData.push({
        date: `${days[i]}\n${dateDay}`,
        grind: battleData ? battleData.userStudy : 0,
        doom: battleData ? battleData.userScreen : 0,
        bot: battleData ? battleData.botStudy : 6,
      });
    }

    return weekData;
  };

  useEffect(() => {
    const updateEgoQuote = () => {
      const randomIndex = Math.floor(Math.random() * EGO_INSULTS.length);
      setCurrentEgoQuote(EGO_INSULTS[randomIndex]);
    };

    updateEgoQuote();
    const interval = setInterval(updateEgoQuote, 3600000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!firebaseAvailable) {
      setAuthState("login");
      return;
    }

    const setupTimeAntiCheat = async () => {
      const serverTime = await getServerTime();
      const { valid, deviation } = checkTimeDeviation(serverTime);
      setIsTimeValid(valid);
      setServerTimeDeviation(deviation);

      if (!valid) {
        setModal({
          type: "alert",
          msg: `⚠️ LOCKDOWN MODE\n\nTime Deviation: ${deviation.toFixed(0)} minutes\n\nCorrect your system clock!`,
          severity: "error",
        });
      }
    };

    setupTimeAntiCheat();
    const timeInterval = setInterval(setupTimeAntiCheat, 60000);

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        setAuthState("tracker");
        await loadUserData(currentUser.uid);
      } else {
        setAuthState("login");
        setUser(null);
      }
    });

    return () => {
      unsubscribe();
      clearInterval(timeInterval);
    };
  }, []);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then(() => console.log("✅ Service Worker registered"))
        .catch((err) =>
          console.warn("⚠️ Service Worker registration failed:", err),
        );
    }
  }, []);

  useEffect(() => {
    const checkMidnight = () => {
      const now = new Date();
      const currentDateStr = getLocalDateStr();

      const hasTodayBattle = history[currentDateStr];

      if (hasTodayBattle) {
        setIsButtonDisabled(true);
        setLastBattleDate(currentDateStr);

        const midnight = new Date(now);
        midnight.setHours(0, 0, 0, 0);
        midnight.setDate(midnight.getDate() + 1);

        const timeMs = midnight.getTime() - now.getTime();
        const h = Math.floor(timeMs / 3600000);
        const m = Math.floor((timeMs % 3600000) / 60000);
        const s = Math.floor((timeMs % 60000) / 1000);
        setTimeUntilMidnight(`${h}h ${m}m ${s}s until strike available`);
      } else {
        setIsButtonDisabled(false);
        setLastBattleDate(null);
        setTimeUntilMidnight(null);
      }
    };

    checkMidnight();
    const interval = setInterval(checkMidnight, 1000);
    return () => clearInterval(interval);
  }, [history]);

  useEffect(() => {
    if (history && Object.keys(history).length > 0) {
      generateSevenDayData(history);
    }
  }, [history]);

  useEffect(() => {
    if (!user || !firebaseAvailable) return;

    const scheduleLeaderboardUpdate = () => {
      const now = new Date();
      const nextTenPM = new Date(now);
      nextTenPM.setHours(22, 0, 0, 0);

      if (now >= nextTenPM) {
        nextTenPM.setDate(nextTenPM.getDate() + 1);
      }

      const timeUntilTenPM = nextTenPM.getTime() - now.getTime();

      const timeout = setTimeout(async () => {
        await loadLeaderboard();

        const today = new Date();
        if (today.getDay() === 0) {
          await showNotification("📊 Your 7-Day War Graph is Ready!", {
            body: "Check your weekly battle summary now!",
            tag: "weekly-ready",
            requireInteraction: true,
          });
        }

        scheduleLeaderboardUpdate();
      }, timeUntilTenPM);

      return () => clearTimeout(timeout);
    };

    return scheduleLeaderboardUpdate();
  }, [user]);

  const loadUserData = async (userId) => {
    if (!firebaseAvailable) return;
    try {
      console.log("📲 Loading user data for:", userId);
      const docSnap = await getDoc(doc(db, "jeeWarriors", userId));
      if (docSnap.exists()) {
        const d = docSnap.data();
        console.log("✅ User data found:", {
          streak: d.streak,
          hasSubmittedData: d.hasSubmittedData,
          historyCount: Object.keys(d.history || {}).length,
          offline: !navigator.onLine,
        });

        setStreak(d.streak || 0);
        setL5Streak(d.l5Streak || 0);
        setHistory(d.history || {});
        setLastBattleTime(d.lastBattleTime || 0);
        setBotTodayTarget(d.botTodayTarget || 6);
        setNotificationsEnabled(d.notificationsEnabled || false);
        setCurrentLevel(d.currentLevel || 0);
        setTipStartDate(d.tipStartDate || null);

        const todayStr = getLocalDateStr();
        if (d.history && d.history[todayStr]) {
          setTodayBattle(d.history[todayStr]);
          if (d.history[todayStr].level !== undefined) {
            setCurrentLevel(d.history[todayStr].level);
          }
        }

        generateSevenDayData(d.history || {});
        const graphData = generateGraphCalendarData(d.history || {});
        setGraphCalendarData(graphData);
        setDataLoaded(true);

        // Change 5: cache user doc locally for offline fallback
        try {
          localStorage.setItem(`jee_cache_user_${userId}`, JSON.stringify(d));
        } catch (_) {}
      } else {
        console.log("📝 New user - creating document");
        await setDoc(doc(db, "jeeWarriors", userId), {
          streak: 0,
          l5Streak: 0,
          history: {},
          lastBattleTime: 0,
          botTodayTarget: 6,
          notificationsEnabled: false,
          lastNotificationDate: null,
          hasSubmittedData: true,
          currentLevel: 0,
        });
        // FIX 1: Initialize graphCalendarData for new users
        setGraphCalendarData(generateGraphCalendarData({}));
        setDataLoaded(true);
      }

      const token = await registerForPushNotifications();
      if (token) {
        await saveFCMToken(userId, token);
      }

      await loadLeaderboard();
    } catch (err) {
      console.error("❌ Error loading user data:", err);
      if (!navigator.onLine) {
        console.log("📱 App is offline - using cached data");
      }
      // Change 5: fallback to locally cached user doc on Firestore failure
      try {
        const cachedRaw = localStorage.getItem(`jee_cache_user_${userId}`);
        if (cachedRaw) {
          const d = JSON.parse(cachedRaw);
          console.log("📦 Using cached user data as fallback");
          setStreak(d.streak || 0);
          setL5Streak(d.l5Streak || 0);
          setHistory(d.history || {});
          setLastBattleTime(d.lastBattleTime || 0);
          setBotTodayTarget(d.botTodayTarget || 6);
          setNotificationsEnabled(d.notificationsEnabled || false);
          setCurrentLevel(d.currentLevel || 0);
          setTipStartDate(d.tipStartDate || null);
          const todayStrFb = getLocalDateStr();
          if (d.history && d.history[todayStrFb]) {
            setTodayBattle(d.history[todayStrFb]);
            if (d.history[todayStrFb].level !== undefined) {
              setCurrentLevel(d.history[todayStrFb].level);
            }
          }
          generateSevenDayData(d.history || {});
          setGraphCalendarData(generateGraphCalendarData(d.history || {}));
          setDataLoaded(true);
        }
      } catch (_) {}
    }
  };

  const generateSevenDayData = (historyData) => {
    const data = [];

    const now = new Date();
    const todayYear = now.getFullYear();
    const todayMonth = now.getMonth();
    const todayDate = now.getDate();
    const todayDay = now.getDay();

    const daysToSubtract = todayDay === 0 ? 0 : todayDay;

    const days = [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ];

    for (let i = 0; i < 7; i++) {
      const date = new Date(
        todayYear,
        todayMonth,
        todayDate - daysToSubtract + i,
      );
      const dateYear = date.getFullYear();
      const dateMonth = String(date.getMonth() + 1).padStart(2, "0");
      const dateDay = String(date.getDate()).padStart(2, "0");
      const dateStr = `${dateYear}-${dateMonth}-${dateDay}`;

      const dayData = historyData[dateStr];

      data.push({
        date: `${days[i]}\n${dateDay}`,
        grind: dayData ? dayData.userStudy : 0,
        doom: dayData ? dayData.userScreen : 0,
        bot: dayData ? dayData.botStudy : 6,
      });
    }

    setSevenDayData(data);
  };

  const loadLeaderboard = async () => {
    if (!user || !firebaseAvailable) return;

    try {
      const today = getLocalDateStr();
      console.log("🏆 Loading leaderboard for date:", today);

      const currentUserDoc = await getDoc(doc(db, "jeeWarriors", user.uid));
      const currentUserData = currentUserDoc.data() || {};
      const currentUserHasSubmitted =
        currentUserData.hasSubmittedData === true || hasSubmittedData;

      console.log(
        "📊 Current user has submitted:",
        currentUserHasSubmitted,
        "Firebase:",
        currentUserData.hasSubmittedData,
        "Local:",
        hasSubmittedData,
      );

      if (!currentUserHasSubmitted) {
        console.log("🔒 Leaderboard locked - user has never submitted data");
        return;
      }

      const q = query(collection(db, "jeeWarriors"), limit(100));
      const querySnapshot = await getDocs(q);
      const users = [];

      querySnapshot.forEach((doc) => {
        const userData = doc.data();
        const hist = userData.history || {};
        const todayData = hist[today];

        // Only show users who submitted TODAY
        if (todayData) {
          const studyTime =
            (todayData.physics || 0) +
            (todayData.chemistry || 0) +
            (todayData.maths || 0);
          const scrollTime = todayData.userScreen || 0;
          const performance = evaluatePerformance(studyTime, scrollTime);

          users.push({
            uid: doc.id,
            id: doc.id,
            streak: userData.streak || 0,
            level: performance.lv,
            levelRank: performance.rank,
            levelColor: performance.color,
            latestPCM: userData.latestPCM || {
              physics: 0,
              chemistry: 0,
              maths: 0,
            },
            avgStudyTime: studyTime,
            avgScrollTime: scrollTime,
            latestBattleDate: today,
            hasData: true,
          });
        }
      });

      console.log(`📈 Found ${users.length} real users for today`);

      users.sort((a, b) => {
        if (b.level !== a.level) return b.level - a.level;
        if (b.avgStudyTime !== a.avgStudyTime)
          return b.avgStudyTime - a.avgStudyTime;
        if (b.streak !== a.streak) return b.streak - a.streak;
        return a.avgScrollTime - b.avgScrollTime;
      });

      const anonymousUsers = users.map((u, idx) => ({
        ...u,
        rankNum: idx + 1,
        anonymousId: `Warrior_${idx + 1}`,
        isCurrentUser: u.uid === user.uid,
      }));

      // Merge simulated competitors into the leaderboard display
      const today2 = getLocalDateStr();
      const bots = getDailyFakeCompetitors(today2);
      const merged = [...anonymousUsers, ...bots]
        .sort((a, b) => {
          if (b.level !== a.level) return b.level - a.level;
          if (b.avgStudyTime !== a.avgStudyTime)
            return b.avgStudyTime - a.avgStudyTime;
          if (b.streak !== a.streak) return b.streak - a.streak;
          return a.avgScrollTime - b.avgScrollTime;
        })
        .map((u, idx) => ({
          ...u,
          rankNum: idx + 1,
          anonymousId: u.isCurrentUser ? "YOU" : `Warrior_${idx + 1}`,
        }));

      setLeaderboardUsers(merged);
      console.log("✅ Leaderboard loaded successfully");
    } catch (err) {
      console.error("❌ Error loading leaderboard:", err);
    }
  };

  // Change 4: per-date leaderboard with localStorage cache/fallback + bot merge + last-place notification
  const openLeaderboardForDate = async (dateStr) => {
    if (!user || !firebaseAvailable) return;
    const cacheKey = `jee_cache_lb_${dateStr}`;

    const buildUsers = (querySnapshot) => {
      const realUsers = [];
      querySnapshot.forEach((docSnap) => {
        const userData = docSnap.data();
        const hist = userData.history || {};
        const dayData = hist[dateStr];
        if (dayData) {
          const studyTime =
            (dayData.physics || 0) +
            (dayData.chemistry || 0) +
            (dayData.maths || 0);
          const scrollTime = dayData.userScreen || 0;
          const performance = evaluatePerformance(studyTime, scrollTime);
          realUsers.push({
            uid: docSnap.id,
            id: docSnap.id,
            streak: userData.streak || 0,
            level: performance.lv,
            levelRank: performance.rank,
            levelColor: performance.color,
            latestPCM: userData.latestPCM || {
              physics: 0,
              chemistry: 0,
              maths: 0,
            },
            avgStudyTime: studyTime,
            avgScrollTime: scrollTime,
            latestBattleDate: dateStr,
            hasData: true,
            isBot: false,
          });
        }
      });

      // Merge simulated bots (display-only)
      const bots = getDailyFakeCompetitors(dateStr);
      const combined = [...realUsers, ...bots];
      combined.sort((a, b) => {
        if (b.level !== a.level) return b.level - a.level;
        if (b.avgStudyTime !== a.avgStudyTime)
          return b.avgStudyTime - a.avgStudyTime;
        if (b.streak !== a.streak) return b.streak - a.streak;
        return a.avgScrollTime - b.avgScrollTime;
      });
      return combined.map((u, idx) => {
        const isMine = !u.isBot && u.uid === user.uid;
        return {
          ...u,
          rankNum: idx + 1,
          anonymousId: `Warrior_${idx + 1}`,
          isCurrentUser: isMine,
          // strip isBot flag from display so all look identical
        };
      });
    };

    const checkLastPlace = (finalList) => {
      if (!notificationsEnabled) return;
      const myEntry = finalList.find((u) => u.isCurrentUser);
      if (!myEntry) return;
      const total = finalList.length;
      if (myEntry.rankNum === total && total > 1) {
        const key = `lastPlace_${dateStr}`;
        if (!localStorage.getItem(key)) {
          showNotification("😤 LAST PLACE!", {
            body: `You're ranked #${total} of ${total} on the leaderboard today! Time to grind harder! 🔥`,
            tag: "last-place",
            requireInteraction: true,
          });
          localStorage.setItem(key, "1");
        }
      }
    };

    try {
      const q = query(collection(db, "jeeWarriors"), limit(100));
      const querySnapshot = await getDocs(q);
      const finalList = buildUsers(querySnapshot);
      // Cache only real-user portion for offline fallback
      try {
        localStorage.setItem(cacheKey, JSON.stringify(finalList));
      } catch (_) {}
      setLeaderboardUsers(finalList);
      checkLastPlace(finalList);
      setLeaderboardDate(dateStr);
      setShowLeaderboard(true);
    } catch (err) {
      console.error("❌ Error loading leaderboard for date:", dateStr, err);
      // Fallback to localStorage cache
      try {
        const cached = localStorage.getItem(cacheKey);
        const fallback = cached ? JSON.parse(cached) : [];
        setLeaderboardUsers(fallback);
        checkLastPlace(fallback);
      } catch (_) {
        setLeaderboardUsers([]);
      }
      setLeaderboardDate(dateStr);
      setShowLeaderboard(true);
    }
  };

  const saveUserData = async (payload) => {
    if (!firebaseAvailable || !user) return;
    try {
      await setDoc(doc(db, "jeeWarriors", user.uid), payload, { merge: true });
    } catch (err) {
      console.error("❌ Error saving user data:", err);
    }
  };

  useEffect(() => {
    if (!firebaseAvailable || !user || !dataLoaded) return;
    const payload = {
      streak,
      l5Streak,
      history,
      lastBattleTime,
      botTodayTarget,
      notificationsEnabled,
      lastNotificationDate,
      hasSubmittedData,
      currentLevel,
      tipStartDate,
    };
    const t = setTimeout(() => saveUserData(payload), 1500);
    return () => clearTimeout(t);
  }, [
    user,
    dataLoaded,
    streak,
    l5Streak,
    history,
    lastBattleTime,
    botTodayTarget,
    notificationsEnabled,
    lastNotificationDate,
    hasSubmittedData,
    currentLevel,
    tipStartDate,
  ]);

  const handleSignup = async (e) => {
    e.preventDefault();

    if (!firebaseAvailable) {
      setAuthError(
        "Firebase is not properly configured. Check your environment variables and Firebase console.",
      );
      return;
    }

    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPassword = password.trim();

    if (!trimmedEmail || !trimmedPassword) {
      setAuthError("Please enter both email and password");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      setAuthError("Please enter a valid email address");
      return;
    }

    if (trimmedPassword.length < 6) {
      setAuthError("Password must be at least 6 characters");
      return;
    }

    setAuthLoading(true);
    setAuthError("");
    try {
      console.log("Creating user with email:", trimmedEmail);
      const response = await createUserWithEmailAndPassword(
        auth,
        trimmedEmail,
        trimmedPassword,
      );
      console.log("Signup successful:", response.user.email);
      setAuthOutClass("animate-slideOutUp");
      setTimeout(async () => {
        setUser(response.user);
        setAuthState("tracker");
        setEmail("");
        setPassword("");
        setShowPassword(false);
        await loadUserData(response.user.uid);
      }, 380);
    } catch (error) {
      console.error("Signup Error Code:", error.code);
      console.error("Signup Error Message:", error.message);
      console.error("Full Error:", error);

      if (error.code === "auth/email-already-in-use") {
        setAuthError("This email is already registered. Please login instead.");
      } else if (error.code === "auth/invalid-email") {
        setAuthError("Please enter a valid email address.");
      } else if (error.code === "auth/weak-password") {
        setAuthError("Password is too weak. Use at least 6 characters.");
      } else if (error.code === "auth/operation-not-allowed") {
        setAuthError(
          "Email/password accounts are not enabled. Check your Firebase console Settings > Authentication > Sign-in method. Enable Email/Password provider.",
        );
      } else {
        setAuthError(error.message || "Signup failed. Please try again.");
      }
    }
    setAuthLoading(false);
  };

  const handleGoogleSignIn = async () => {
    if (!firebaseAvailable) {
      setAuthError("Firebase not available");
      return;
    }
    setAuthError("");
    setAuthLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const res = await signInWithPopup(auth, provider);
      setAuthOutClass("animate-slideOutUp");
      setTimeout(async () => {
        setUser(res.user);
        setAuthState("tracker");
        setEmail("");
        setPassword("");
        await loadUserData(res.user.uid);
      }, 380);
    } catch (err) {
      if (err.code === "auth/popup-blocked") {
        setAuthError("Popup was blocked. Please allow popups for this site.");
      } else if (err.code === "auth/popup-closed-by-user") {
        setAuthError("Sign-in cancelled.");
      } else {
        setAuthError(err.message);
      }
    }
    setAuthLoading(false);
  };

  const handleLogin = async (e) => {
    e.preventDefault();

    if (!firebaseAvailable) {
      setAuthError(
        "Firebase is not properly configured. Check your environment variables and Firebase console.",
      );
      return;
    }

    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPassword = password.trim();

    if (!trimmedEmail || !trimmedPassword) {
      setAuthError("Please enter both email and password");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      setAuthError("Please enter a valid email address");
      return;
    }

    setAuthError("");
    setAuthLoading(true);

    try {
      console.log("Attempting login with email:", trimmedEmail);
      const response = await signInWithEmailAndPassword(
        auth,
        trimmedEmail,
        trimmedPassword,
      );
      console.log("Login successful:", response.user.email);
      setAuthOutClass("animate-slideOutUp");
      setTimeout(async () => {
        setUser(response.user);
        setAuthState("tracker");
        setEmail("");
        setPassword("");
        setShowPassword(false);
        await loadUserData(response.user.uid);
      }, 380);
    } catch (error) {
      console.error("Auth Error Code:", error.code);
      console.error("Auth Error Message:", error.message);
      console.error("Full Error:", error);

      if (error.code === "auth/user-not-found") {
        setAuthError("No account found with this email. Please sign up first.");
      } else if (error.code === "auth/invalid-password") {
        setAuthError("Incorrect password. Please try again.");
      } else if (error.code === "auth/invalid-credential") {
        setAuthError(
          "Invalid email or password combination. Please verify and try again.",
        );
      } else if (error.code === "auth/wrong-password") {
        setAuthError("Incorrect password. Please try again.");
      } else if (error.code === "auth/invalid-email") {
        setAuthError("Please enter a valid email address.");
      } else if (error.code === "auth/user-disabled") {
        setAuthError("This account has been disabled.");
      } else if (error.code === "auth/too-many-requests") {
        setAuthError(
          "Too many login attempts. Please try again in a few minutes.",
        );
      } else if (error.code === "auth/operation-not-allowed") {
        setAuthError(
          "Email/password login is not enabled. Check your Firebase console Settings > Authentication > Sign-in method. Enable Email/Password provider.",
        );
      } else {
        setAuthError(error.message || "Login failed. Please try again.");
      }
    }
    setAuthLoading(false);
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();

    if (!firebaseAvailable) {
      setAuthError("Firebase is not properly configured.");
      return;
    }

    const trimmedEmail = resetEmail.trim().toLowerCase();

    if (!trimmedEmail) {
      setAuthError("Please enter your email address");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      setAuthError("Please enter a valid email address");
      return;
    }

    setResetLoading(true);
    setAuthError("");

    try {
      await sendPasswordResetEmail(auth, trimmedEmail);
      setResetFlowStep("success");
      setResetMessage(
        `Password reset link sent to ${trimmedEmail}. Check your email to continue.`,
      );
      setResetEmail("");
    } catch (error) {
      console.error("Reset Error Code:", error.code);
      console.error("Reset Error Message:", error.message);

      if (error.code === "auth/user-not-found") {
        setAuthError("No account found with this email.");
      } else if (error.code === "auth/invalid-email") {
        setAuthError("Please enter a valid email address.");
      } else if (error.code === "auth/too-many-requests") {
        setAuthError("Too many reset attempts. Please try again later.");
      } else {
        setAuthError(
          error.message || "Failed to send reset email. Please try again.",
        );
      }
    }
    setResetLoading(false);
  };

  const handleLogout = async () => {
    await signOut(auth);
    setUser(null);
    setAuthState("login");
    setStreak(0);
    setL5Streak(0);
    setHistory({});
    setDataLoaded(false);
    setTipStartDate(null);
    setLastTipShownDate(null);
    setTodayBattle(null);
    setLastBattleTime(0);
    setBotTodayTarget(6);
    setNotificationsEnabled(false);
    setDoomHours(0);
    setBotMsg("Awaiting your performance strike...");
    setEmail("");
    setPassword("");
    setHasSubmittedData(true);
    setCurrentLevel(0);
  };

  const registerForPushNotifications = async () => {
    try {
      if (!("serviceWorker" in navigator) || !messaging) return null;

      const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
      if (!vapidKey) return null;

      // Change 6: try /sw.js first, fall back to /firebase-messaging-sw.js
      let swReg = null;
      try {
        swReg = await navigator.serviceWorker.register("/sw.js");
      } catch (_) {
        try {
          swReg = await navigator.serviceWorker.register(
            "/firebase-messaging-sw.js",
          );
        } catch (_2) {
          swReg = await navigator.serviceWorker.ready;
        }
      }

      const token = await getToken(messaging, {
        vapidKey: vapidKey,
        serviceWorkerRegistration: swReg,
      });

      return token || null;
    } catch (err) {
      console.warn("⚠️ Push registration failed (non-blocking):", err.message);
      return null;
    }
  };

  const saveFCMToken = async (userId, token) => {
    if (!firebaseAvailable || !token || !userId) return;
    try {
      await updateDoc(doc(db, "jeeWarriors", userId), {
        fcmToken: token,
        deviceName: navigator.userAgent,
        lastTokenUpdate: new Date().toISOString(),
      });
    } catch (err) {
      console.error("❌ Error saving FCM token:", err);
    }
  };

  const showNotification = async (title, options = {}) => {
    try {
      if ("serviceWorker" in navigator) {
        const registration = await navigator.serviceWorker.ready;
        registration.showNotification(title, {
          icon: "🎯",
          badge: "🎯",
          ...options,
        });
        return;
      }

      if ("Notification" in window && Notification.permission === "granted") {
        new Notification(title, { icon: "🎯", ...options });
      }
    } catch (err) {
      console.error("❌ Error showing notification:", err);
    }
  };

  const activateNotifs = async () => {
    if (!firebaseAvailable || !user) return;

    if (!("Notification" in window)) {
      setModal({
        type: "alert",
        msg: "❌ Your browser does not support notifications.",
        severity: "error",
      });
      return;
    }

    try {
      if (Notification.permission === "granted") {
        setNotificationsEnabled(true);
        await showNotification("🔔 Notifications Activated!", {
          body: "You will now receive daily motivation! 🔥",
          tag: "activation",
          requireInteraction: true,
        });

        await updateDoc(doc(db, "jeeWarriors", user.uid), {
          notificationsEnabled: true,
          lastNotificationDate: getTodayStr(),
        });
        setModal({
          type: "alert",
          msg: "✅ Notifications Ready!\n\n📱 Daily Strikes:\n• 7:00 AM IST\n• 10:00 PM IST\n\nWarrior mode ON! 🎯",
          severity: "success",
        });
        return;
      }

      const permission = await Notification.requestPermission();

      if (permission === "granted") {
        setNotificationsEnabled(true);
        const token = await registerForPushNotifications();

        await showNotification("🔔 Notifications Activated!", {
          body: "Daily motivation incoming! 🔥",
          tag: "activation",
          requireInteraction: true,
        });

        const updateData = {
          notificationsEnabled: true,
          lastNotificationDate: getTodayStr(),
        };

        if (token) {
          updateData.fcmToken = token;
          updateData.deviceName = navigator.userAgent;
          updateData.lastTokenUpdate = new Date().toISOString();
        }

        await updateDoc(doc(db, "jeeWarriors", user.uid), updateData);

        setModal({
          type: "alert",
          msg: "✅ War Room Activated!\n\n✅ Combat Sensors: Local reminders active\n⚠️ Global Uplink: Remote alerts enabled\n\n🎯 Strikes:\n• 7 AM - Morning surge\n• 10 PM - Night review\n• 23-Hour Panic (near reset)\n\n🚀 Works Offline!",
          severity: "success",
        });
      } else if (permission === "denied") {
        setModal({
          type: "alert",
          msg: "❌ Notifications Blocked!\n\n1. Click 🔒 lock\n2. Find Notifications\n3. Change to Allow\n4. Refresh",
          severity: "error",
        });
      }
    } catch (err) {
      console.error("❌ Notification error:", err);
      setModal({
        type: "alert",
        msg: `❌ Error: ${err.message}`,
        severity: "error",
      });
    }
  };

  // Foreground onMessage intentionally removed.
  // The service worker handles ALL notifications (foreground + background).
  // Having both caused duplicate notifications when the app was open.

  const checkMilestones = async (newStreak, newL5) => {
    if ([7, 21, 30, 60, 90, 365].includes(newL5)) {
      const milestone = MILESTONE_MESSAGES[newL5];
      const tips = JEE_TIPS[newL5];
      const fullMessage = milestone + "\n\n" + tips;

      setModal({ type: "alert", msg: fullMessage, severity: "milestone" });
      if (notificationsEnabled) {
        await showNotification("🏆 MILESTONE!", {
          body: fullMessage,
          tag: "milestone",
          requireInteraction: true,
        });
      }
    }
  };

  const executeBattle = async () => {
    if (!firebaseAvailable || !user) return;

    const now = Date.now();
    const totalStudyHours =
      parseFloat(physicsHours) +
      parseFloat(chemistryHours) +
      parseFloat(mathsHours);
    const perf = evaluatePerformance(totalStudyHours, doomHours);
    const todayStr = getLocalDateStr();

    if (todayBattle) {
      setModal({
        type: "alert",
        msg: "You have already fought today. Come back tomorrow!",
        severity: "warning",
      });
      return;
    }

    let isWin = totalStudyHours >= botTodayTarget && doomHours <= 4;

    if (totalStudyHours < botTodayTarget || doomHours > 4) {
      isWin = false;
    }

    let newStreak = isWin ? streak + 1 : 0;
    let newL5 = isWin && perf.lv === 5 ? l5Streak + 1 : 0;

    let rewardOrPunishment = "";
    let rewardType = "";
    let pcmData = null;

    if (isWin) {
      if (doomHours <= 3 && doomHours > 0) {
        const reward =
          REWARDS_LOW_SCROLL[
            Math.floor(Math.random() * REWARDS_LOW_SCROLL.length)
          ];
        rewardOrPunishment = reward;
        rewardType = "reward_scroll";
      } else if (doomHours > 3) {
        const reward =
          REWARDS_HIGH_STUDY[
            Math.floor(Math.random() * REWARDS_HIGH_STUDY.length)
          ];
        rewardOrPunishment = reward;
        rewardType = "reward_hobby";
      }

      pcmData = [
        { name: "Physics", value: parseFloat(physicsHours), color: "#06b6d4" },
        {
          name: "Chemistry",
          value: parseFloat(chemistryHours),
          color: "#22c55e",
        },
        { name: "Maths", value: parseFloat(mathsHours), color: "#ef4444" },
      ];
    } else {
      const brutalTalk =
        BRUTAL_PUNISHMENTS[
          Math.floor(Math.random() * BRUTAL_PUNISHMENTS.length)
        ];
      const detailedPunishment =
        DETAILED_PUNISHMENTS[
          Math.floor(Math.random() * DETAILED_PUNISHMENTS.length)
        ];
      rewardOrPunishment = brutalTalk + "\n\n" + "🔥 " + detailedPunishment;
      rewardType = "punishment";
    }

    const resultMsg = isWin
      ? `VICTORY. You beat the bot with a Rank: ${perf.rank}!`
      : `DEFEAT. The bot crushed you. ${currentEgoQuote}`;

    const newHistory = {
      ...history,
      [todayStr]: {
        userStudy: totalStudyHours,
        userScreen: parseFloat(doomHours),
        botStudy: botTodayTarget,
        result: isWin ? "win" : "lose",
        level: perf.lv,
        rank: perf.rank,
        physics: parseFloat(physicsHours),
        chemistry: parseFloat(chemistryHours),
        maths: parseFloat(mathsHours),
        timestamp: now,
      },
    };

    setTodayBattle(newHistory[todayStr]);
    setStreak(newStreak);
    setL5Streak(newL5);
    setHistory(newHistory);
    setLastBattleTime(now);
    // Change 7: use Hinglish motivational line as botMsg on win
    if (isWin) {
      const hinglishLine =
        MOTIVATIONAL_HINGLISH[
          Math.floor(Math.random() * MOTIVATIONAL_HINGLISH.length)
        ];
      setBotMsg(hinglishLine);
    } else {
      setBotMsg(resultMsg);
    }
    setCurrentLevel(perf.lv);

    // Change 1: capture study/screen totals into local vars BEFORE resetting sliders
    const capturedTotal = totalStudyHours;
    const capturedScreen = parseFloat(doomHours);

    setGrindHours(1);
    setDoomHours(0);
    setPhysicsHours(0.33);
    setChemistryHours(0.33);
    setMathsHours(0.34);

    // FIX 2: Update graph state immediately, before the try block,
    // so the graph is always visible regardless of Firebase save result.
    generateSevenDayData(newHistory);
    const graphData = generateGraphCalendarData(newHistory);
    setGraphCalendarData(graphData);

    setModal({
      type: "result",
      msg: resultMsg,
      isWin,
      perf,
      reward: rewardOrPunishment,
      rewardType: rewardType,
      pcmData: pcmData,
      total: capturedTotal, // Change 1: saved before slider reset
      screen: capturedScreen, // Change 1: saved before slider reset
    });

    const randomBonus = Math.random() * 1.5 - 0.5;
    const newBotTarget = Math.max(
      6,
      Math.min(12, 6 + newStreak * 0.2 + randomBonus),
    );
    try {
      console.log("💾 Saving battle data to Firebase:", {
        date: todayStr, // FIX 3: was `dateKey` (undefined) — now correctly uses `todayStr`
        physics: parseFloat(physicsHours),
        chemistry: parseFloat(chemistryHours),
        maths: parseFloat(mathsHours),
        screenTime: doomHours,
        streak: newStreak,
        offline: !navigator.onLine,
      });

      await updateDoc(doc(db, "jeeWarriors", user.uid), {
        streak: newStreak,
        l5Streak: newL5,
        history: newHistory,
        lastBattleTime: now,
        botTodayTarget: newBotTarget,
        currentLevel: perf.lv,
        latestPCM: {
          physics: parseFloat(physicsHours),
          chemistry: parseFloat(chemistryHours),
          maths: parseFloat(mathsHours),
          timestamp: now,
        },
        hasSubmittedData: true,
      });

      console.log("✅ Battle data saved to Firebase successfully");
      setBotTodayTarget(newBotTarget);
      setHasSubmittedData(true);
      await loadLeaderboard();
      await checkMilestones(newStreak, newL5);

      // ── Record tipStartDate the first time streak hits 7 ──
      if (newStreak >= 7 && !tipStartDate) {
        setTipStartDate(todayStr);
        try {
          await updateDoc(doc(db, "jeeWarriors", user.uid), {
            tipStartDate: todayStr,
          });
        } catch (_) {}
      }
    } catch (err) {
      console.error("❌ Error saving battle:", err);
      if (!navigator.onLine) {
        console.log("📱 App is offline - data will sync when online");
      }
    }
  };

  // ── Show daily tip once per day on app open — resets naturally at midnight ──
  useEffect(() => {
    if (!dataLoaded || !user) return;
    const streak_ = streak;
    const ts = tipStartDate;
    if (streak_ < 7 || !ts) return;

    const todayIST = getTodayStrIST();
    if (lastTipShownDate === todayIST) return; // already shown today — skip

    const startParts = ts.split("-");
    const startDate = new Date(
      parseInt(startParts[0]),
      parseInt(startParts[1]) - 1,
      parseInt(startParts[2]),
    );
    const todayParts = todayIST.split("-");
    const todayDate = new Date(
      parseInt(todayParts[0]),
      parseInt(todayParts[1]) - 1,
      parseInt(todayParts[2]),
    );
    const rawIdx = Math.round((todayDate - startDate) / 86400000);
    if (rawIdx < 0) return;
    const tipIdx = rawIdx % DAILY_TIPS_APP.length; // cycles after 100
    const tip = DAILY_TIPS_APP[tipIdx];

    const t = setTimeout(() => {
      setLastTipShownDate(todayIST);
      setModal({
        type: "alert",
        msg: `💡 Tip ${tipIdx + 1} of ${DAILY_TIPS_APP.length}\n\n${tip.detailed}`,
        severity: "tip",
      });
    }, 1500);
    return () => clearTimeout(t);
  }, [dataLoaded, user, streak, tipStartDate, lastTipShownDate]);

  useEffect(() => {
    const checkTimers = async () => {
      if (!lastBattleTime) return;

      // Calendar-day check using IST dates to avoid timezone edge cases at midnight
      const lastDateIST = getISTTime(new Date(lastBattleTime));
      const lYear = lastDateIST.getFullYear();
      const lMonth = String(lastDateIST.getMonth() + 1).padStart(2, "0");
      const lDay = String(lastDateIST.getDate()).padStart(2, "0");
      const lastBattleDateStr = `${lYear}-${lMonth}-${lDay}`;

      const yesterdayIST = getISTTime(
        new Date(Date.now() - 24 * 60 * 60 * 1000),
      );
      const yYear = yesterdayIST.getFullYear();
      const yMonth = String(yesterdayIST.getMonth() + 1).padStart(2, "0");
      const yDay = String(yesterdayIST.getDate()).padStart(2, "0");
      const yesterdayStr = `${yYear}-${yMonth}-${yDay}`;

      // Reset only if last battle is strictly before yesterday (missed full day)
      if (lastBattleDateStr < yesterdayStr && streak > 0) {
        setStreak(0);
        setL5Streak(0);
        setBotMsg("Bot wins — you skipped a day. Streak Terminated.");

        if (user) {
          updateDoc(doc(db, "jeeWarriors", user.uid), {
            streak: 0,
            l5Streak: 0,
          });
        }
      }
    };

    checkTimers();
    const interval = setInterval(checkTimers, 60000);
    return () => clearInterval(interval);
  }, [lastBattleTime, streak, notificationsEnabled, user]);

  useEffect(() => {
    if (!showLeaderboard || !user || !firebaseAvailable) return;
    // Don't override past-date leaderboard with today's live data
    if (leaderboardDate && leaderboardDate !== getLocalDateStr()) return;

    console.log("🔴 Setting up real-time leaderboard listener");

    const today = getLocalDateStr();
    const q = query(collection(db, "jeeWarriors"), limit(100));

    const unsubscribe = onSnapshot(
      q,
      (querySnapshot) => {
        try {
          console.log("🔄 Leaderboard update received");
          const users = [];

          querySnapshot.forEach((doc) => {
            try {
              const userData = doc.data();
              const history = userData.history || {};

              const todayData = history[today];

              if (todayData) {
                const studyTime =
                  (todayData.physics || 0) +
                  (todayData.chemistry || 0) +
                  (todayData.maths || 0);
                const scrollTime = todayData.userScreen || 0;

                let performance;
                try {
                  performance = evaluatePerformance(studyTime, scrollTime);
                } catch (perfErr) {
                  console.error("❌ Error calculating performance:", perfErr);
                  return;
                }

                users.push({
                  uid: doc.id,
                  id: doc.id,
                  streak: userData.streak || 0,
                  level: performance.lv,
                  levelRank: performance.rank,
                  levelColor: performance.color,
                  latestPCM: userData.latestPCM || {
                    physics: 0,
                    chemistry: 0,
                    maths: 0,
                  },
                  avgStudyTime: studyTime,
                  avgScrollTime: scrollTime,
                  latestBattleDate: today,
                  hasData: true,
                });
              }
            } catch (docErr) {
              console.error("❌ Error processing user document:", docErr);
            }
          });

          users.sort((a, b) => {
            if (b.level !== a.level) return b.level - a.level;
            if (b.avgStudyTime !== a.avgStudyTime)
              return b.avgStudyTime - a.avgStudyTime;
            if (b.streak !== a.streak) return b.streak - a.streak;
            return a.avgScrollTime - b.avgScrollTime;
          });

          console.log(
            `📈 Sorted ${users.length} users by level/study/streak/screen`,
          );

          const anonymousUsers = users.map((u, idx) => ({
            ...u,
            rankNum: idx + 1,
            anonymousId: `Warrior_${idx + 1}`,
            isCurrentUser: u.uid === user.uid,
          }));

          setLeaderboardUsers(anonymousUsers);
          console.log(
            `✅ Real-time leaderboard updated: ${anonymousUsers.length} users`,
          );
        } catch (err) {
          console.error("❌ Error in real-time leaderboard listener:", err);
        }
      },
      (error) => {
        console.error("❌ Leaderboard listener error:", error);
      },
    );

    const interval = setInterval(() => {
      console.log("🔃 Periodic leaderboard refresh");
      loadLeaderboard();
    }, 10000);

    return () => {
      console.log("🟠 Unsubscribing from real-time leaderboard");
      unsubscribe();
      clearInterval(interval);
    };
  }, [showLeaderboard, leaderboardDate, user, firebaseAvailable]);

  const goToPreviousMonth = () => {
    if (calendarMonth === 0) {
      setCalendarMonth(11);
      setCalendarYear(calendarYear - 1);
    } else {
      setCalendarMonth(calendarMonth - 1);
    }
  };

  const goToNextMonth = () => {
    if (calendarMonth === 11) {
      setCalendarMonth(0);
      setCalendarYear(calendarYear + 1);
    } else {
      setCalendarMonth(calendarMonth + 1);
    }
  };

  const getMonthLabel = () => {
    const months = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];
    return `${months[calendarMonth]} ${calendarYear}`;
  };

  const getDaysInMonth = (month, year) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const daysInMonth = getDaysInMonth(calendarMonth, calendarYear);

  const handleDayClick = (day) => {
    const selectedDate = new Date(calendarYear, calendarMonth, day);
    const istToday = getISTTime();
    const istHour = istToday.getHours();

    if (istHour >= 12) {
      istToday.setDate(istToday.getDate() + 1);
    }

    istToday.setHours(0, 0, 0, 0);
    selectedDate.setHours(0, 0, 0, 0);
    const dateStr = `${calendarYear}-${String(calendarMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const data = history[dateStr];

    if (data) {
      setModal({ type: "dayInfo", data: { date: dateStr, ...data } });
    } else if (selectedDate > istToday) {
      setModal({
        type: "alert",
        msg: "FUTURE DATE: This battlefield has not arrived yet.",
        severity: "info",
      });
    } else {
      setModal({
        type: "alert",
        msg: "NO DATA: You were absent from the battlefield on this day.",
        severity: "info",
      });
    }
  };

  const sendTestNotification = async () => {
    if (!user) {
      alert("Please log in first");
      return;
    }

    try {
      await showNotification("✅ STRIKE TEST", {
        body: "Notifications active! 🔥",
        tag: "test-notification",
        requireInteraction: true,
      });

      setModal({
        type: "alert",
        msg: "✅ Sensors Online!\n\n🎯 Offline capable\n📱 Local & Remote alerts active\n🚀 Even when app is closed!\n\n💪 Add to home screen for best experience",
        severity: "success",
      });
    } catch (err) {
      console.error("❌ Error:", err);
      setModal({
        type: "alert",
        msg: `❌ Error: ${err.message}`,
        severity: "error",
      });
    }
  };

  if (authState === "loading") {
    return (
      <div className="min-h-screen bg-[#030303] flex items-center justify-center">
        <div className="text-cyan-400 text-xl font-bold animate-pulse">
          Loading...
        </div>
      </div>
    );
  }

  if (authState === "login" || authState === "register") {
    const isRegister = authState === "register";
    return (
      <div
        className={`min-h-screen bg-[#030303] text-white font-sans p-6 flex items-center justify-center ${authOutClass || "animate-slideInUp"}`}
      >
        <div className="w-full max-w-md" style={{ overflow: "hidden" }}>
          {/* ── Sliding two-panel container ── */}
          <div
            style={{
              display: "flex",
              width: "200%",
              transform: isRegister ? "translateX(-50%)" : "translateX(0)",
              transition: "transform 0.38s cubic-bezier(0.4, 0, 0.2, 1)",
            }}
          >
            {/* ══ PANEL 1: LOGIN ══ */}
            <div style={{ width: "50%", paddingRight: "6px" }}>
              <div
                className="bg-zinc-900/50 border border-cyan-500/30 p-8 rounded-[32px] backdrop-blur-xl relative overflow-hidden"
                style={{ minHeight: "500px" }}
              >
                {resetFlowStep === "login" && (
                  <div>
                    <h1 className="text-4xl font-black italic tracking-tighter text-cyan-500 text-center mb-8">
                      JEE Study Tracker
                    </h1>

                    <form onSubmit={handleLogin} className="space-y-4">
                      <div>
                        <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest block mb-2">
                          Email
                        </label>
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="you@example.com"
                          className="w-full bg-black border border-cyan-500/30 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 transition-all focus:shadow-lg focus:shadow-cyan-500/50"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest block mb-2">
                          Password
                        </label>
                        <div className="relative">
                          <input
                            type={showPassword ? "text" : "password"}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            className="w-full bg-black border border-cyan-500/30 rounded-xl px-4 py-3 pr-12 text-white placeholder-white/30 focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 transition-all focus:shadow-lg focus:shadow-cyan-500/50"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-cyan-400 hover:text-cyan-300 transition-colors"
                          >
                            {showPassword ? (
                              <EyeOff size={18} />
                            ) : (
                              <Eye size={18} />
                            )}
                          </button>
                        </div>
                      </div>
                      {authError && (
                        <p className="text-red-400 text-sm text-center">
                          {authError}
                        </p>
                      )}
                      <button
                        type="submit"
                        disabled={authLoading}
                        className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 py-3 rounded-2xl font-black uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-cyan-900/50 disabled:opacity-50 hover:shadow-cyan-600/50 hover:shadow-2xl mt-6"
                      >
                        {authLoading ? "..." : "Login"}
                      </button>
                    </form>

                    <button
                      onClick={handleGoogleSignIn}
                      disabled={authLoading}
                      className="w-full mt-4 bg-white hover:bg-gray-100 text-black py-3 rounded-2xl font-bold uppercase tracking-widest transition-all active:scale-95 shadow-lg disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      🔍 Sign In with Google
                    </button>

                    <div className="flex gap-2 mt-4">
                      <button
                        onClick={goToRegister}
                        className="flex-1 text-cyan-400 text-sm hover:text-cyan-300 transition-colors"
                      >
                        Sign Up
                      </button>
                      <span className="text-white/30">|</span>
                      <button
                        onClick={() => {
                          setResetFlowStep("forgot");
                          setAuthError("");
                          setResetEmail("");
                        }}
                        className="flex-1 text-cyan-400 text-sm hover:text-cyan-300 transition-colors"
                      >
                        Forgot Password?
                      </button>
                    </div>
                  </div>
                )}

                {resetFlowStep === "forgot" && (
                  <div className="animate-slideInLeft">
                    <h1 className="text-3xl font-black italic tracking-tighter text-cyan-500 text-center mb-8">
                      Reset Password
                    </h1>
                    <p className="text-white/60 text-center text-sm mb-6">
                      Enter your email to receive a password reset link
                    </p>
                    <form onSubmit={handleForgotPassword} className="space-y-4">
                      <div>
                        <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest block mb-2">
                          Email
                        </label>
                        <input
                          type="email"
                          value={resetEmail}
                          onChange={(e) => setResetEmail(e.target.value)}
                          placeholder="you@example.com"
                          className="w-full bg-black border border-cyan-500/30 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 transition-all focus:shadow-lg focus:shadow-cyan-500/50"
                        />
                      </div>
                      {authError && (
                        <p className="text-red-400 text-sm text-center">
                          {authError}
                        </p>
                      )}
                      <button
                        type="submit"
                        disabled={resetLoading}
                        className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 py-3 rounded-2xl font-black uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-cyan-900/50 disabled:opacity-50 hover:shadow-cyan-600/50 hover:shadow-2xl mt-6"
                      >
                        {resetLoading ? "..." : "Send Reset Link"}
                      </button>
                    </form>
                    <button
                      onClick={() => {
                        setResetFlowStep("login");
                        setAuthError("");
                        setResetEmail("");
                      }}
                      className="w-full mt-4 text-cyan-400 text-sm hover:text-cyan-300 transition-colors"
                    >
                      Back to Login
                    </button>
                  </div>
                )}

                {resetFlowStep === "success" && (
                  <div className="animate-slideInUp flex flex-col items-center justify-center text-center space-y-6">
                    <div className="text-5xl">📧</div>
                    <h2 className="text-2xl font-black text-cyan-400">
                      Check Your Email
                    </h2>
                    <p className="text-white/70 text-sm">{resetMessage}</p>
                    <div className="bg-cyan-500/10 border border-cyan-500/30 p-4 rounded-lg text-xs text-cyan-300">
                      📌 Click the link in your email to reset your password
                      securely
                    </div>
                    <button
                      onClick={() => {
                        setResetFlowStep("login");
                        setResetMessage("");
                      }}
                      className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 py-3 rounded-2xl font-black uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-cyan-900/50 hover:shadow-cyan-600/50 hover:shadow-2xl mt-6"
                    >
                      Back to Login
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* ══ PANEL 2: REGISTER ══ */}
            <div style={{ width: "50%", paddingLeft: "6px" }}>
              <div
                className="bg-zinc-900/50 border border-cyan-500/30 p-8 rounded-[32px] backdrop-blur-xl"
                style={{ minHeight: "500px" }}
              >
                <h1 className="text-4xl font-black italic tracking-tighter text-cyan-500 text-center mb-8">
                  JEE Study Tracker
                </h1>

                <form onSubmit={handleSignup} className="space-y-4">
                  <div>
                    <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest block mb-2">
                      Email
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full bg-black border border-cyan-500/30 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 transition-all"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest block mb-2">
                      Password (min 6 chars)
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full bg-black border border-cyan-500/30 rounded-xl px-4 py-3 pr-12 text-white placeholder-white/30 focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-cyan-400 hover:text-cyan-300 transition-colors"
                      >
                        {showPassword ? (
                          <EyeOff size={18} />
                        ) : (
                          <Eye size={18} />
                        )}
                      </button>
                    </div>
                  </div>
                  {authError && (
                    <p className="text-red-400 text-sm text-center">
                      {authError}
                    </p>
                  )}
                  <button
                    type="submit"
                    disabled={authLoading}
                    className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 py-3 rounded-2xl font-black uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-cyan-900/50 disabled:opacity-50 hover:shadow-cyan-600/50 mt-6"
                  >
                    {authLoading ? "..." : "Register"}
                  </button>
                </form>

                <button
                  onClick={handleGoogleSignIn}
                  disabled={authLoading}
                  className="w-full mt-4 bg-white hover:bg-gray-100 text-black py-3 rounded-2xl font-bold uppercase tracking-widest transition-all active:scale-95 shadow-lg disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  🔍 Sign In with Google
                </button>

                <button
                  onClick={goToLoginFromRegister}
                  className="w-full mt-4 text-cyan-400 text-sm hover:text-cyan-300 transition-colors"
                >
                  Already have account? Login
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- MAIN TRACKER ---
  return (
    <div className="min-h-screen bg-[#030303] text-white font-sans p-4 sm:p-6 animate-overlayFadeIn">
      <div className="max-w-6xl mx-auto">
        {/* HEADER */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 sm:mb-10 gap-4 animate-slideInDown">
          <div>
            <h1
              className="text-3xl sm:text-4xl font-black italic tracking-tighter text-cyan-500"
              style={{ filter: "drop-shadow(0 1px 2px rgba(124,58,237,0.01))" }}
            >
              JEE Study Tracker
            </h1>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <button
              onClick={() => {
                setShowGraphModal(true);
                setShowGraphCalendar(false);
              }}
              className="p-2 sm:p-3 bg-zinc-900 rounded-full border border-cyan-500/50 hover:border-cyan-400 hover:shadow-lg hover:shadow-cyan-500/50 transition-all duration-300"
              title="View 7-day graph"
            >
              <Flame size={18} className="sm:w-5 sm:h-5 text-cyan-400" />
            </button>
            <button
              onClick={() => {
                const localToday = getLocalDateStr();
                const todayData = history[localToday];

                if (todayData) {
                  const pieData = [
                    {
                      name: "Physics",
                      value: todayData.physics || 0,
                      color: "#06b6d4",
                    },
                    {
                      name: "Chemistry",
                      value: todayData.chemistry || 0,
                      color: "#22c55e",
                    },
                    {
                      name: "Maths",
                      value: todayData.maths || 0,
                      color: "#ef4444",
                    },
                  ];
                  setSelectedPieData(pieData);
                } else {
                  setSelectedPieData(null);
                }
                setShowPieChart(true);
              }}
              className="p-2 sm:p-3 bg-zinc-900 rounded-full border border-purple-500/50 hover:border-purple-400 hover:shadow-lg hover:shadow-purple-500/50 transition-all duration-300"
              title="View today's PCM breakdown"
            >
              <Zap size={18} className="sm:w-5 sm:h-5 text-purple-400" />
            </button>
            <button
              onClick={() => {
                if (!hasSubmittedData) {
                  alert(
                    "🔒 Leaderboard is locked until you submit your first battle data!",
                  );
                  return;
                }
                setLeaderboardDate(null);
                loadLeaderboard();
                setShowLeaderboard(true);
              }}
              className={`p-2 sm:p-3 bg-zinc-900 rounded-full border transition-all duration-300 ${
                hasSubmittedData
                  ? "border-yellow-500/50 hover:border-yellow-400 hover:shadow-lg hover:shadow-yellow-500/50 cursor-pointer"
                  : "border-yellow-500/20 opacity-50 cursor-not-allowed"
              }`}
              title={
                hasSubmittedData
                  ? "View leaderboard"
                  : "Submit your first battle to unlock leaderboard"
              }
              disabled={!hasSubmittedData}
            >
              <Trophy
                size={18}
                className={`sm:w-5 sm:h-5 ${hasSubmittedData ? "text-yellow-400" : "text-yellow-600"}`}
              />
            </button>
            {!notificationsEnabled && (
              <button
                onClick={activateNotifs}
                className="p-2 sm:p-3 bg-zinc-900 rounded-full border border-cyan-500/50 hover:border-cyan-400 hover:shadow-lg hover:shadow-cyan-500/50 transition-all duration-300"
                title="Enable notifications"
              >
                <Bell size={18} className="sm:w-5 sm:h-5 text-cyan-400" />
              </button>
            )}
            {notificationsEnabled && (
              <button
                onClick={sendTestNotification}
                className="p-2 sm:p-3 bg-zinc-900 rounded-full border border-green-500/50 hover:border-green-400 hover:shadow-lg hover:shadow-green-500/50 transition-all duration-300"
                title="Test notifications"
              >
                <Bell size={18} className="sm:w-5 sm:h-5 text-green-400" />
              </button>
            )}
            <button
              onClick={handleLogout}
              className="p-2 sm:p-3 bg-zinc-900 rounded-full border border-red-500/50 hover:border-red-400 hover:shadow-lg hover:shadow-red-500/50 transition-all duration-300"
              title="Logout"
            >
              <LogOut size={18} className="sm:w-5 sm:h-5 text-red-400" />
            </button>
          </div>
        </div>

        {/* STATS DISPLAY */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-8 sm:mb-10 animate-slideInUp">
          <div className="bg-zinc-900/50 border border-cyan-500/20 p-3 sm:p-4 rounded-xl sm:rounded-2xl transition-all duration-300">
            <p className="text-[8px] sm:text-[10px] text-white/40 uppercase font-bold tracking-widest">
              Streak
            </p>
            <p className="text-2xl sm:text-3xl font-black text-cyan-400 mt-1">
              {streak}
            </p>
          </div>
          <div className="bg-zinc-900/50 border border-purple-500/20 p-3 sm:p-4 rounded-xl sm:rounded-2xl transition-all duration-300">
            <p className="text-[8px] sm:text-[10px] text-white/40 uppercase font-bold tracking-widest">
              Level 5 Streak
            </p>
            <p className="text-2xl sm:text-3xl font-black text-purple-400 mt-1">
              {l5Streak}
            </p>
          </div>
          <div className="bg-zinc-900/50 border border-yellow-500/20 p-3 sm:p-4 rounded-xl sm:rounded-2xl transition-all duration-300">
            <p className="text-[8px] sm:text-[10px] text-white/40 uppercase font-bold tracking-widest">
              Bot Target
            </p>
            <p className="text-2xl sm:text-3xl font-black text-yellow-400 mt-1">
              {botTodayTarget.toFixed(1)}h
            </p>
          </div>
          <div
            className={`bg-zinc-900/50 border p-3 sm:p-4 rounded-xl sm:rounded-2xl transition-all duration-500 ${
              !todayBattle
                ? "border-gray-500/20"
                : todayBattle.result === "win"
                  ? "border-green-500/50"
                  : "border-red-500/50"
            }`}
          >
            <p className="text-[8px] sm:text-[10px] text-white/40 uppercase font-bold tracking-widest">
              Today Status
            </p>
            <p className="text-2xl sm:text-3xl font-black mt-1">
              {todayBattle ? (
                <span
                  className={
                    todayBattle.result === "win"
                      ? "text-green-400"
                      : "text-red-400"
                  }
                >
                  {todayBattle.result === "win" ? "✓ WIN" : "✗ LOSE"}
                </span>
              ) : (
                <span className="text-gray-400">-</span>
              )}
            </p>
          </div>
        </div>

        {/* BATTLEFIELD */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 animate-slideInUp">
          <div className="lg:col-span-7 bg-[#0a0a0a] border border-cyan-500/20 p-4 sm:p-8 rounded-2xl sm:rounded-[40px] shadow-2xl transition-all duration-500 animate-slideInLeft">
            <div className="flex flex-col sm:flex-row justify-between mb-4 sm:mb-6 gap-2">
              <span className="text-xs font-black text-red-500 uppercase flex items-center gap-2">
                <Skull size={16} /> Bot Target: {botTodayTarget.toFixed(1)}h
              </span>
              <span
                className={`text-xs font-black uppercase tracking-widest ${evaluatePerformance(parseFloat(physicsHours) + parseFloat(chemistryHours) + parseFloat(mathsHours), doomHours).color}`}
              >
                Rank:{" "}
                {
                  evaluatePerformance(
                    parseFloat(physicsHours) +
                      parseFloat(chemistryHours) +
                      parseFloat(mathsHours),
                    doomHours,
                  ).rank
                }{" "}
                | Level{" "}
                {
                  evaluatePerformance(
                    parseFloat(physicsHours) +
                      parseFloat(chemistryHours) +
                      parseFloat(mathsHours),
                    doomHours,
                  ).lv
                }
              </span>
            </div>

            <p className="text-base sm:text-xl font-bold italic text-white/70 mb-6 sm:mb-10 min-h-[60px] bg-black/30 p-4 rounded-xl border border-white/5">
              "{currentEgoQuote}"
            </p>

            <div className="space-y-6 sm:space-y-8">
              <div>
                <div className="flex justify-between text-[10px] font-black uppercase mb-3">
                  <span>
                    Total Study Hours:{" "}
                    {(
                      parseFloat(physicsHours) +
                      parseFloat(chemistryHours) +
                      parseFloat(mathsHours)
                    ).toFixed(2)}
                    h
                  </span>
                  <span className="text-cyan-400">Sum of PCM</span>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-[10px] font-black uppercase mb-3">
                  <span>Physics: {parseFloat(physicsHours).toFixed(2)}h</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="8"
                  step="0.25"
                  value={physicsHours}
                  onChange={(e) => setPhysicsHours(e.target.value)}
                  className="w-full h-2 bg-zinc-800 rounded-lg appearance-none accent-cyan-500 slider-smooth"
                  style={{
                    background: `linear-gradient(to right, rgb(24,24,27) 0%, rgba(6, 182, 212, 0.3) ${(physicsHours / 8) * 100}%, rgb(24,24,27) ${(physicsHours / 8) * 100}%, rgb(24,24,27) 100%)`,
                  }}
                />
              </div>

              <div>
                <div className="flex justify-between text-[10px] font-black uppercase mb-3">
                  <span>
                    Chemistry: {parseFloat(chemistryHours).toFixed(2)}h
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="8"
                  step="0.25"
                  value={chemistryHours}
                  onChange={(e) => setChemistryHours(e.target.value)}
                  className="w-full h-2 bg-zinc-800 rounded-lg appearance-none accent-green-500 slider-smooth"
                  style={{
                    background: `linear-gradient(to right, rgb(24,24,27) 0%, rgba(34, 197, 94, 0.3) ${(chemistryHours / 8) * 100}%, rgb(24,24,27) ${(chemistryHours / 8) * 100}%, rgb(24,24,27) 100%)`,
                  }}
                />
              </div>

              <div>
                <div className="flex justify-between text-[10px] font-black uppercase mb-3">
                  <span>Maths: {parseFloat(mathsHours).toFixed(2)}h</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="8"
                  step="0.25"
                  value={mathsHours}
                  onChange={(e) => setMathsHours(e.target.value)}
                  className="w-full h-2 bg-zinc-800 rounded-lg appearance-none accent-red-500 slider-smooth"
                  style={{
                    background: `linear-gradient(to right, rgb(24,24,27) 0%, rgba(239, 68, 68, 0.3) ${(mathsHours / 8) * 100}%, rgb(24,24,27) ${(mathsHours / 8) * 100}%, rgb(24,24,27) 100%)`,
                  }}
                />
              </div>

              <div>
                <div className="flex justify-between text-[10px] font-black uppercase mb-3">
                  <span>Doom Scroll: {parseFloat(doomHours).toFixed(1)}h</span>
                  <span className="text-yellow-500">Limit 10h</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="10"
                  step="0.5"
                  value={doomHours}
                  onChange={(e) => setDoomHours(e.target.value)}
                  className="w-full h-2 bg-zinc-800 rounded-lg appearance-none accent-yellow-500 slider-smooth doom-slider"
                  style={{
                    background: `linear-gradient(to right, rgb(24,24,27) 0%, rgba(234, 179, 8, 0.3) ${(doomHours / 10) * 100}%, rgb(24,24,27) ${(doomHours / 10) * 100}%, rgb(24,24,27) 100%)`,
                  }}
                />
              </div>

              {isButtonDisabled ? (
                <div className="w-full py-5 bg-zinc-900/50 rounded-2xl border border-cyan-500/30 text-center font-mono text-cyan-400 text-sm shadow-lg shadow-cyan-500/20">
                  ⏱️ {timeUntilMidnight}
                </div>
              ) : (
                <button
                  onClick={executeBattle}
                  disabled={!isTimeValid}
                  className="group w-full bg-gradient-to-r from-cyan-600 to-blue-600 py-6 rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-3 transition-all active:scale-95 shadow-lg shadow-cyan-900/50 hover:shadow-cyan-700/80 disabled:opacity-50 disabled:cursor-not-allowed hover:from-cyan-500 hover:to-blue-500 animate-slideInUp"
                >
                  <Crosshair
                    className="group-hover:rotate-180 transition-transform duration-500"
                    size={24}
                  />
                  {!isTimeValid ? "LOCKDOWN MODE" : "EXECUTE STRIKE"}
                </button>
              )}
            </div>
          </div>

          {/* CALENDAR */}
          <div className="lg:col-span-5 bg-[#0a0a0a] border border-cyan-500/20 p-8 rounded-[40px] transition-all duration-500 animate-slideInRight">
            <div className="flex items-center justify-between mb-6">
              <button
                onClick={goToPreviousMonth}
                className="p-2 hover:bg-zinc-800 rounded-lg transition-all text-cyan-400 hover:scale-110 duration-300"
              >
                <ChevronLeft size={20} />
              </button>
              <h3 className="font-bold flex items-center gap-2 text-cyan-400 flex-1 justify-center">
                <CalendarIcon size={18} />
                {getMonthLabel()}
              </h3>
              <button
                onClick={goToNextMonth}
                className="p-2 hover:bg-zinc-800 rounded-lg transition-all text-cyan-400 hover:scale-110 duration-300"
              >
                <ChevronRight size={20} />
              </button>
            </div>
            <div className="grid grid-cols-7 gap-2">
              {[...Array(getDaysInMonth(calendarMonth, calendarYear))].map(
                (_, i) => {
                  const day = i + 1;
                  const dateStr = `${calendarYear}-${String(calendarMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                  const hasData = history[dateStr];
                  const isWin = hasData?.result === "win";
                  const isToday = dateStr === getLocalDateStr();

                  return (
                    <button
                      key={i}
                      onClick={() => handleDayClick(day)}
                      className={`aspect-square rounded-lg flex items-center justify-center text-[10px] font-bold border transition-all duration-300 hover:scale-110 transform ${
                        hasData
                          ? isWin
                            ? `bg-green-500/20 border-green-500 text-green-400 shadow-lg shadow-green-500/30 hover:shadow-green-500/50 ${isToday ? "ring-2 ring-cyan-400 ring-offset-2 ring-offset-zinc-900" : ""}`
                            : `bg-red-500/20 border-red-500 text-red-400 shadow-lg shadow-red-500/30 hover:shadow-red-500/50 ${isToday ? "ring-2 ring-cyan-400 ring-offset-2 ring-offset-zinc-900" : ""}`
                          : `bg-zinc-900 border-white/5 text-white/20 hover:border-white/10 ${isToday ? "ring-2 ring-cyan-500 border-cyan-500 text-cyan-400" : ""}`
                      }`}
                    >
                      {day}
                    </button>
                  );
                },
              )}
            </div>
          </div>
        </div>

        {/* FOOTER CREDIT */}
        <div
          style={{
            fontSize: "15px",
            textAlign: "center",
            color: "rgba(255, 255, 255, 0.4)",
            marginTop: "48px",
            fontWeight: "400",
            letterSpacing: "0.5px",
          }}
          className="animate-fadeIn"
        >
          Made by Swarit
        </div>
      </div>

      {/* MODALS */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-xl p-4 animate-overlayFadeIn">
          {modal.type === "result" ? (
            <div
              className={`${
                modal.isWin
                  ? "bg-gradient-to-br from-green-900/40 to-blue-900/40 border-green-500/60 shadow-2xl shadow-green-500/50"
                  : "bg-gradient-to-br from-red-900/40 to-orange-900/40 border-red-500/60 shadow-2xl shadow-red-500/50"
              } border p-6 sm:p-10 lg:p-12 rounded-2xl sm:rounded-3xl lg:rounded-[40px] max-w-xs sm:max-w-lg lg:max-w-2xl w-full relative backdrop-blur-xl max-h-[90vh] overflow-y-auto ${closingModal === "main" ? "animate-modalClose" : "animate-modalPop"}`}
            >
              <button
                onClick={() => closeAnyModal("main")}
                className="absolute top-4 right-4 text-white/40 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>

              <div className="text-center space-y-4 sm:space-y-6">
                <div
                  className={`text-4xl sm:text-5xl lg:text-6xl font-black ${modal.isWin ? "text-green-400" : "text-red-400"} animate-bounce`}
                >
                  {modal.isWin ? "⚔️" : "💀"}
                </div>

                <div>
                  <p
                    className={`text-xl sm:text-2xl font-black mb-2 ${modal.isWin ? "text-green-400" : "text-red-400"}`}
                  >
                    {modal.isWin ? "VICTORY" : "DEFEAT"}
                  </p>
                  <p className="text-xs sm:text-sm italic text-white/70">
                    {modal.msg}
                  </p>
                </div>

                {modal.pcmData && (
                  <button
                    onClick={() => {
                      setSelectedPieData(modal.pcmData);
                      setShowPieChart(true);
                    }}
                    className="bg-gradient-to-r from-cyan-500 to-purple-500 px-3 sm:px-4 py-2 rounded-lg text-[9px] sm:text-xs font-bold uppercase flex items-center justify-center gap-2 hover:shadow-lg hover:shadow-cyan-500/40 transition-all mx-auto animate-slideInUp"
                  >
                    📊 View PCM Breakdown
                  </button>
                )}

                {/* Change 2: Show Leaderboard button (today) */}
                <button
                  onClick={() => {
                    setModal(null);
                    openLeaderboardForDate(getLocalDateStr());
                  }}
                  className="bg-gradient-to-r from-yellow-600 to-orange-500 px-3 sm:px-4 py-2 rounded-lg text-[9px] sm:text-xs font-bold uppercase flex items-center justify-center gap-2 hover:shadow-lg hover:shadow-yellow-500/40 transition-all mx-auto animate-slideInUp"
                >
                  🏆 Show Leaderboard
                </button>

                {modal.reward && (
                  <div
                    className={`space-y-2 sm:space-y-3 bg-black/40 p-3 sm:p-6 rounded-lg sm:rounded-2xl border ${
                      modal.rewardType === "punishment"
                        ? "border-red-500/50"
                        : "border-yellow-500/50"
                    }`}
                  >
                    <p
                      className={`font-bold text-center text-xs sm:text-sm ${
                        modal.rewardType === "punishment"
                          ? "text-red-400"
                          : "text-yellow-400"
                      }`}
                    >
                      {modal.rewardType === "punishment"
                        ? "⚡ PUNISHMENT ⚡"
                        : "🎁 REWARD 🎁"}
                    </p>
                    <p className="text-white/80 text-center whitespace-pre-wrap text-xs sm:text-sm">
                      {modal.reward}
                    </p>
                  </div>
                )}

                <div className="space-y-2 sm:space-y-3 bg-black/40 p-4 sm:p-6 rounded-lg sm:rounded-2xl border border-white/10">
                  <div className="flex justify-between text-xs sm:text-sm">
                    <span className="text-white/60">Study Time:</span>{" "}
                    <span className="text-cyan-400 font-bold">
                      {(modal.total !== undefined
                        ? modal.total
                        : parseFloat(physicsHours) +
                          parseFloat(chemistryHours) +
                          parseFloat(mathsHours)
                      ).toFixed(2)}
                      h
                    </span>
                  </div>
                  <div className="flex justify-between text-xs sm:text-sm">
                    <span className="text-white/60">Screen Time:</span>{" "}
                    <span className="text-red-400 font-bold">
                      {modal.screen !== undefined ? modal.screen : doomHours}h
                    </span>
                  </div>
                  <div className="border-t border-white/10 pt-2 sm:pt-3 flex justify-between text-xs sm:text-sm">
                    <span className="text-white/60">Level:</span>{" "}
                    <span className={`font-bold ${modal.perf.color}`}>
                      {modal.perf.lv}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs sm:text-sm">
                    <span className="text-white/60">Rank:</span>{" "}
                    <span className={`font-bold ${modal.perf.color}`}>
                      {modal.perf.rank}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => closeAnyModal("main")}
                  className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 py-2 sm:py-3 rounded-lg sm:rounded-xl font-bold uppercase text-[9px] sm:text-[10px] tracking-widest transition-all hover:shadow-lg hover:shadow-cyan-500/40 active:scale-95 animate-slideInUp"
                >
                  Close
                </button>
              </div>
            </div>
          ) : modal.type === "dayInfo" ? (
            <div
              className={`bg-zinc-900 border border-cyan-500/50 rounded-2xl sm:rounded-[32px] w-[95vw] max-w-sm shadow-2xl shadow-cyan-500/30 backdrop-blur-xl max-h-[90vh] overflow-y-auto flex flex-col ${closingModal === "main" ? "animate-modalClose" : "animate-modalPop"}`}
              style={{ gap: "0px" }}
            >
              {/* TOP NAV DIV — X button ONLY, pushed to right. Higher z-index sky-box. */}
              <div
                className="flex justify-end px-4 pt-4 pb-0 flex-shrink-0"
                style={{ zIndex: 10, position: "relative", minHeight: "44px" }}
              >
                <button
                  onClick={() => closeAnyModal("main")}
                  className="text-white/40 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/10"
                >
                  <X size={20} />
                </button>
              </div>
              {/* CONTENT DIV — sits below Top Nav with 10px top buffer. */}
              <div
                className="px-6 pb-6 flex flex-col"
                style={{
                  paddingTop: "10px",
                  gap: "20px",
                  position: "relative",
                  zIndex: 1,
                }}
              >
                <h2 className="text-lg sm:text-xl font-black text-cyan-400 uppercase">
                  📅 {modal.data.date}
                </h2>
                <div className="space-y-3 sm:space-y-4">
                  <div className="flex justify-between border-b border-white/10 pb-2 sm:pb-3 text-white/70 text-xs sm:text-sm">
                    <span>📚 Grind:</span>
                    <span className="text-cyan-400 font-bold">
                      {modal.data.userStudy}h
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-white/10 pb-2 sm:pb-3 text-white/70 text-xs sm:text-sm">
                    <span>📱 Scroll:</span>
                    <span className="text-red-400 font-bold">
                      {modal.data.userScreen}h
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-white/10 pb-2 sm:pb-3 text-white/70 text-xs sm:text-sm">
                    <span>🎯 Target:</span>
                    <span className="text-yellow-400 font-bold">
                      {modal.data.botStudy}h
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-white/10 pb-2 sm:pb-3 text-white/70 text-xs sm:text-sm">
                    <span>⚔️ Result:</span>
                    <span
                      className={`font-bold ${modal.data.result === "win" ? "text-green-400" : "text-red-400"}`}
                    >
                      {modal.data.result.toUpperCase()}
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-white/10 pb-2 sm:pb-3 text-white/70 text-xs sm:text-sm">
                    <span>📊 Level:</span>
                    <span className="text-blue-400 font-bold">
                      {modal.data.level}
                    </span>
                  </div>
                  <div className="flex justify-between text-white/70 text-xs sm:text-sm">
                    <span>🏅 Rank:</span>
                    <span className="text-purple-400 font-bold">
                      {modal.data.rank}
                    </span>
                  </div>
                </div>
                {(modal.data.physics ||
                  modal.data.chemistry ||
                  modal.data.maths) && (
                  <button
                    onClick={() => {
                      const pieData = [
                        {
                          name: "Physics",
                          value: parseFloat(modal.data.physics || 0),
                          color: "#06b6d4",
                        },
                        {
                          name: "Chemistry",
                          value: parseFloat(modal.data.chemistry || 0),
                          color: "#22c55e",
                        },
                        {
                          name: "Maths",
                          value: parseFloat(modal.data.maths || 0),
                          color: "#ef4444",
                        },
                      ];
                      setSelectedPieData(pieData);
                      setShowPieChart(true);
                    }}
                    className="w-full bg-gradient-to-r from-cyan-600 to-purple-600 py-2 sm:py-3 rounded-lg text-[9px] sm:text-xs font-bold uppercase flex items-center justify-center gap-2 hover:shadow-lg hover:shadow-cyan-500/40 transition-all animate-slideInUp"
                  >
                    📊 View PCM Breakdown
                  </button>
                )}

                {/* Change 3: Show Leaderboard button for this calendar day */}
                <button
                  onClick={() => {
                    const d = modal.data.date;
                    setModal(null);
                    openLeaderboardForDate(d);
                  }}
                  className="w-full bg-gradient-to-r from-yellow-600 to-orange-500 py-2 sm:py-3 rounded-lg text-[9px] sm:text-xs font-bold uppercase flex items-center justify-center gap-2 hover:shadow-lg hover:shadow-yellow-500/40 transition-all animate-slideInUp"
                >
                  🏆 Show Leaderboard
                </button>
                <button
                  onClick={() => closeAnyModal("main")}
                  className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 py-3 rounded-xl font-bold uppercase text-[10px] tracking-widest hover:shadow-lg hover:shadow-cyan-500/40 transition-all animate-slideInUp"
                >
                  Close
                </button>
              </div>
            </div>
          ) : (
            <div
              className={`${
                modal.severity === "success"
                  ? "bg-gradient-to-br from-green-900/40 to-zinc-900 border-green-500/50 shadow-2xl shadow-green-500/30"
                  : modal.severity === "error"
                    ? "bg-gradient-to-br from-red-900/40 to-zinc-900 border-red-500/50 shadow-2xl shadow-red-500/30"
                    : modal.severity === "milestone"
                      ? "bg-gradient-to-br from-purple-900/40 to-zinc-900 border-purple-500/50 shadow-2xl shadow-purple-500/30"
                      : "bg-zinc-900 border-cyan-500/50 shadow-2xl shadow-cyan-500/30"
              } border rounded-[32px] w-[95vw] max-w-sm backdrop-blur-xl flex flex-col ${closingModal === "main" ? "animate-modalClose" : "animate-modalPop"}`}
            >
              {/* TOP NAV DIV — X button ONLY, pushed to right. Higher z-index sky-box. */}
              <div
                className="flex justify-end px-4 pt-4 pb-0 flex-shrink-0"
                style={{ zIndex: 10, position: "relative", minHeight: "44px" }}
              >
                <button
                  onClick={() => closeAnyModal("main")}
                  className="text-white/40 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/10"
                >
                  <X size={20} />
                </button>
              </div>
              {/* CONTENT DIV — sits below Top Nav with 10px top buffer. */}
              <div
                className="px-8 pb-8 flex flex-col"
                style={{
                  paddingTop: "10px",
                  gap: "20px",
                  position: "relative",
                  zIndex: 1,
                }}
              >
                <p className="text-white/80 font-bold text-center text-lg whitespace-pre-wrap">
                  {modal.msg}
                </p>
                <button
                  onClick={() => closeAnyModal("main")}
                  className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 py-3 rounded-xl font-bold uppercase text-[10px] tracking-widest hover:shadow-lg hover:shadow-cyan-500/40 transition-all animate-slideInUp"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 7-DAY GRAPH MODAL */}
      {showGraphModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-xl p-2 sm:p-4 animate-overlayFadeIn">
          <div
            className={`bg-zinc-900 border border-cyan-500/50 rounded-lg sm:rounded-2xl lg:rounded-[32px] w-[90vw] sm:max-w-2xl lg:max-w-4xl shadow-2xl shadow-cyan-500/30 backdrop-blur-xl max-h-[90vh] overflow-y-auto flex flex-col ${closingModal === "graph" ? "animate-modalClose" : "animate-modalPop"}`}
          >
            {/* ROW 1 — TOP NAV: X button ONLY, pushed right. Higher z-index sky-box. */}
            <div
              className="flex justify-end px-4 pt-4 pb-0 flex-shrink-0"
              style={{ zIndex: 10, position: "relative", minHeight: "44px" }}
            >
              <button
                onClick={() => closeAnyModal("graph")}
                className="text-white/40 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/10"
              >
                <X size={20} />
              </button>
            </div>

            {/* ROW 2 — ACTION ROW: Title + View Calendar button on its own line. */}
            <div
              className="flex items-center justify-between px-4 sm:px-6 py-2 flex-shrink-0"
              style={{ zIndex: 5, position: "relative" }}
            >
              <h2 className="text-base sm:text-lg lg:text-xl font-black text-cyan-400 uppercase">
                📊 7-Day War History
              </h2>
              <button
                onClick={() => setShowGraphCalendar(!showGraphCalendar)}
                className="p-2 bg-cyan-600 hover:bg-cyan-500 rounded-lg text-[9px] sm:text-[10px] font-bold uppercase transition-all"
              >
                📅 {showGraphCalendar ? "Hide" : "View"} Calendar
              </button>
            </div>

            {/* ROW 3 — DATA ROW: Graph content + Close button. Padding-top buffer. */}
            <div
              className="px-4 sm:px-6 lg:px-8 pb-5 sm:pb-7 flex flex-col"
              style={{
                paddingTop: "10px",
                gap: "16px",
                position: "relative",
                zIndex: 1,
              }}
            >
              {!graphCalendarData || graphCalendarData.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 sm:py-12">
                  <div className="text-4xl sm:text-5xl mb-3 sm:mb-4">📊</div>
                  <p className="text-white/60 mb-2 text-sm">No Data Yet</p>
                  <p className="text-xs sm:text-sm text-white/40 text-center">
                    Execute your first strike to unlock the 7-day war graph
                    history!
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Calendar View - Hidden by default */}
                  {showGraphCalendar && (
                    <div className="bg-black/30 p-4 sm:p-6 rounded-lg border border-cyan-500/20 space-y-4 sm:space-y-6 max-h-[50vh] overflow-y-auto">
                      <h3 className="text-xs sm:text-sm font-bold text-cyan-400 uppercase sticky top-0 bg-black/30">
                        Select Week to View
                      </h3>
                      {graphCalendarData.map((monthData) => {
                        const today = new Date();
                        const currentMonth = String(
                          today.getMonth() + 1,
                        ).padStart(2, "0");
                        const currentYear = today.getFullYear();
                        const isCurrentMonth =
                          monthData.monthKey ===
                          `${currentYear}-${currentMonth}`;

                        return (
                          <div
                            key={monthData.monthKey}
                            className="space-y-1 sm:space-y-2"
                          >
                            <h4
                              className={`text-[10px] sm:text-xs font-bold uppercase ${isCurrentMonth ? "text-cyan-300" : "text-white/50"}`}
                            >
                              {monthData.monthLabel}{" "}
                              {isCurrentMonth && "(Current)"}
                            </h4>
                            <div className="space-y-1 ml-2">
                              {monthData.weeks.map((week, weekIdx) => {
                                const weekNumber = weekIdx + 1;
                                const daysWithData = week.filter(
                                  (d) => d.data !== null,
                                );
                                const hasWins = daysWithData.some(
                                  (d) => d.data.result === "win",
                                );
                                const hasLosses = daysWithData.some(
                                  (d) => d.data.result === "lose",
                                );
                                const datesInWeek = week
                                  .filter((d) => d.dateStr !== null)
                                  .map((d) => d.dateStr.split("-")[2])
                                  .join("-");

                                const todayStr = getLocalDateStr();
                                const isCurrentWeek =
                                  isCurrentMonth &&
                                  week.some((d) => d.dateStr === todayStr);

                                return (
                                  <button
                                    key={`${monthData.monthKey}-week-${weekIdx}`}
                                    onClick={() => {
                                      const weekData = week
                                        .filter((d) => d.dateStr !== null)
                                        .map((d) => ({
                                          dateStr: d.dateStr,
                                          battleData: d.data,
                                        }));
                                      const graphData =
                                        generateWeekGraphData(weekData);
                                      setSevenDayData(graphData);
                                      setShowGraphCalendar(false);
                                    }}
                                    className={`w-full text-left p-2 sm:p-3 border rounded hover:border-cyan-500/50 transition-all text-[9px] sm:text-[10px] ${
                                      isCurrentWeek
                                        ? "bg-cyan-500/30 border-cyan-500/60 text-cyan-300"
                                        : "bg-zinc-800/50 border-white/10 hover:bg-cyan-500/20"
                                    }`}
                                  >
                                    <div className="flex justify-between items-center">
                                      <span className="font-bold text-wrap">
                                        Week {weekNumber} ({datesInWeek}){" "}
                                        {isCurrentWeek && "(Now)"}
                                      </span>
                                      <span className="text-[8px] sm:text-[9px] flex-shrink-0 ml-2">
                                        {daysWithData.length > 0 ? (
                                          <>
                                            {hasWins && (
                                              <span className="text-green-400 mr-1">
                                                ✓
                                                {
                                                  daysWithData.filter(
                                                    (d) =>
                                                      d.data.result === "win",
                                                  ).length
                                                }
                                              </span>
                                            )}
                                            {hasLosses && (
                                              <span className="text-red-400">
                                                ✗
                                                {
                                                  daysWithData.filter(
                                                    (d) =>
                                                      d.data.result === "lose",
                                                  ).length
                                                }
                                              </span>
                                            )}
                                          </>
                                        ) : (
                                          <span className="text-white/30">
                                            No data
                                          </span>
                                        )}
                                      </span>
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Graph display - shown by default */}
                  {sevenDayData && sevenDayData.length > 0 && (
                    <div className="space-y-4 w-full">
                      <h3 className="text-sm font-bold text-cyan-400 uppercase">
                        📈 Weekly Graph
                      </h3>
                      <div
                        className="graph-scroll-container"
                        style={{
                          overflowX: "auto",
                          overflowY: "hidden",
                          WebkitOverflowScrolling: "touch",
                        }}
                      >
                        <div style={{ minWidth: "800px", width: "100%" }}>
                          <ResponsiveContainer width="100%" height={300}>
                            <LineChart
                              data={sevenDayData}
                              margin={{ top: 5, right: 50, left: 0, bottom: 5 }}
                            >
                              <CartesianGrid
                                strokeDasharray="3 3"
                                stroke="rgba(255,255,255,0.1)"
                              />
                              <XAxis
                                dataKey="date"
                                stroke="rgba(255,255,255,0.5)"
                                style={{ fontSize: "12px" }}
                                interval={0}
                              />
                              <YAxis stroke="rgba(255,255,255,0.5)" />
                              <Tooltip
                                contentStyle={{
                                  backgroundColor: "#1a1a1a",
                                  border: "1px solid #22c55e",
                                }}
                              />
                              <Line
                                type="monotone"
                                dataKey="grind"
                                stroke="#06b6d4"
                                strokeWidth={3}
                                name="Study (Grind)"
                              />
                              <Line
                                type="monotone"
                                dataKey="doom"
                                stroke="#ef4444"
                                strokeWidth={3}
                                name="Scroll (Doom)"
                              />
                              <Line
                                type="monotone"
                                dataKey="bot"
                                stroke="#eab308"
                                strokeWidth={2}
                                strokeDasharray="5 5"
                                name="Bot Target"
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <button
                onClick={() => closeAnyModal("graph")}
                className="w-full mt-4 sm:mt-6 bg-gradient-to-r from-cyan-600 to-blue-600 py-2 sm:py-3 rounded-lg sm:rounded-xl font-bold uppercase text-[9px] sm:text-[10px] tracking-widest hover:shadow-lg hover:shadow-cyan-500/40 transition-all animate-slideInUp"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LEADERBOARD MODAL */}
      {showLeaderboard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-xl p-2 sm:p-4 animate-overlayFadeIn">
          <div
            className={`bg-zinc-900 border border-yellow-500/50 p-4 sm:p-6 lg:p-8 rounded-lg sm:rounded-2xl lg:rounded-[32px] w-full max-w-sm sm:max-w-md relative shadow-2xl shadow-yellow-500/30 backdrop-blur-xl max-h-[90vh] overflow-y-auto ${closingModal === "leaderboard" ? "animate-modalClose" : "animate-modalPop"}`}
          >
            <button
              onClick={() => closeAnyModal("leaderboard")}
              className="absolute top-4 right-4 text-white/40 hover:text-white"
            >
              <X size={20} />
            </button>
            <h2 className="text-base sm:text-lg lg:text-xl font-black text-yellow-400 mb-1 sm:mb-2 uppercase flex items-center gap-2 text-wrap">
              <Trophy size={18} /> Top Warriors
            </h2>
            <p className="text-[9px] sm:text-[10px] text-white/50 mb-4 sm:mb-6 text-center">
              Rankings based on Streak • Study Time • Screen Time
            </p>

            {!history || Object.keys(history).length === 0 ? (
              <div className="text-center py-8 sm:py-12">
                <div className="text-4xl sm:text-5xl mb-3 sm:mb-4">🔒</div>
                <p className="text-white/60 text-sm">Leaderboard Locked</p>
                <p className="text-xs text-white/40 mt-2">
                  Execute your first strike to unlock the leaderboard!
                </p>
              </div>
            ) : (
              <div className="space-y-2 sm:space-y-3 max-h-[60vh] overflow-y-auto">
                {leaderboardUsers && leaderboardUsers.length > 0 ? (
                  leaderboardUsers.slice(0, 10).map((u, idx) => {
                    const medals = ["🥇", "🥈", "🥉"];
                    const auraClass =
                      idx === 0
                        ? "bg-gradient-to-r from-yellow-500/20 to-amber-500/10 border-yellow-400/60 shadow-lg shadow-yellow-400/50"
                        : idx === 1
                          ? "bg-gradient-to-r from-gray-400/20 to-slate-500/10 border-gray-300/50 shadow-lg shadow-gray-300/40"
                          : idx === 2
                            ? "bg-gradient-to-r from-orange-600/20 to-amber-700/10 border-orange-500/60 shadow-lg shadow-orange-500/40"
                            : "bg-black/40 border-white/10";

                    return (
                      <div
                        key={u.uid}
                        className={`p-3 sm:p-4 rounded-lg border transition-all ${auraClass} animate-slideInLeft`}
                      >
                        <div className="flex items-center justify-between mb-2 sm:mb-3">
                          <div className="flex items-center gap-2">
                            {idx < 3 && (
                              <span className="text-xl">{medals[idx]}</span>
                            )}
                            <span className="text-xs sm:text-sm font-bold text-white/70">
                              {u.anonymousId || `#${u.rankNum}`}
                            </span>
                            {u.isCurrentUser && (
                              <span className="text-[8px] sm:text-xs bg-purple-600 px-2 py-1 rounded font-bold">
                                YOU
                              </span>
                            )}
                          </div>
                          <span
                            className={`font-bold text-xs sm:text-sm ${u.levelColor}`}
                          >
                            {u.levelRank}
                          </span>
                        </div>
                        <div className="space-y-1 text-[9px] sm:text-xs border-b border-white/10 pb-2 sm:pb-3 mb-2 sm:mb-3">
                          <div className="flex justify-between text-white/70">
                            <span>Streak:</span>
                            <span className="text-cyan-400 font-bold">
                              {u.streak}
                            </span>
                          </div>
                          <div className="flex justify-between text-white/70">
                            <span>Study Time:</span>
                            <span className="text-green-400 font-bold">
                              {u.avgStudyTime.toFixed(2)}h
                            </span>
                          </div>
                          <div className="flex justify-between text-white/70">
                            <span>Screen Time:</span>
                            <span className="text-red-400 font-bold">
                              {u.avgScrollTime.toFixed(2)}h
                            </span>
                          </div>
                        </div>
                        <div className="flex justify-between items-center text-[8px] sm:text-[9px]">
                          <span className="text-white/50">Level:</span>
                          <span className={`font-bold ${u.levelColor}`}>
                            Lvl {u.level}
                          </span>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-8 sm:py-12">
                    <div className="text-3xl sm:text-4xl mb-3 sm:mb-4">🏜️</div>
                    <p className="text-white/60 text-sm">
                      The battleground awaits warriors...
                    </p>
                    <p className="text-xs text-white/40 mt-2">
                      Warriors needed to appear on the leaderboard!
                    </p>
                  </div>
                )}
              </div>
            )}
            <button
              onClick={() => closeAnyModal("leaderboard")}
              className="w-full mt-4 sm:mt-6 bg-gradient-to-r from-yellow-600 to-orange-600 py-2 sm:py-3 rounded-lg sm:rounded-xl font-bold uppercase text-[9px] sm:text-[10px] tracking-widest hover:shadow-lg hover:shadow-yellow-500/40 transition-all animate-slideInUp"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* PIE CHART MODAL */}
      {showPieChart && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-xl p-2 sm:p-4 animate-overlayFadeIn">
          <div
            className={`bg-zinc-900 border border-purple-500/50 p-4 sm:p-6 lg:p-8 rounded-lg sm:rounded-2xl lg:rounded-[32px] w-full max-w-md sm:max-w-lg relative shadow-2xl shadow-purple-500/40 backdrop-blur-xl max-h-[90vh] overflow-y-auto ${closingModal === "pie" ? "animate-modalClose" : "animate-modalPop"}`}
          >
            <button
              onClick={() => closeAnyModal("pie")}
              className="absolute top-4 right-4 text-white/40 hover:text-white"
            >
              <X size={20} />
            </button>
            <h2 className="text-lg sm:text-xl font-black text-purple-400 mb-6 uppercase text-center">
              📊 PCM Breakdown 3D
            </h2>

            {!selectedPieData ? (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="text-5xl mb-4">📊</div>
                <p className="text-white/60 mb-2">No Data</p>
                <p className="text-sm text-white/40 text-center">
                  Execute a strike today to see your PCM breakdown.
                </p>
                <button
                  onClick={() => closeAnyModal("pie")}
                  className="mt-6 bg-gradient-to-r from-purple-600 to-pink-600 px-4 py-2 rounded-lg font-bold text-xs uppercase hover:shadow-lg hover:shadow-purple-500/40 transition-all animate-slideInUp"
                >
                  Return
                </button>
              </div>
            ) : (
              <>
                <div className="flex justify-center relative mb-4 sm:mb-6 w-full">
                  <div
                    className="relative w-full h-56 sm:h-64 lg:h-80 max-w-xs neon-glow-container"
                    style={{
                      perspective: "1200px",
                    }}
                  >
                    <ResponsiveContainer
                      width="100%"
                      height="100%"
                      minWidth={250}
                    >
                      <PieChart>
                        <Pie
                          data={selectedPieData}
                          cx="50%"
                          cy="50%"
                          outerRadius={90}
                          dataKey="value"
                          fill="#8884d8"
                          animationBegin={-5000}
                          animationDuration={2000}
                          animationEasing="ease-out"
                        >
                          {selectedPieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value) => `${value.toFixed(2)}h`}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2">
                  {selectedPieData.map((item, idx) => (
                    <div
                      key={idx}
                      className="bg-black/40 p-2 sm:p-3 rounded-lg border border-white/10 text-center"
                    >
                      <div
                        className="text-[10px] sm:text-xs font-bold mb-1"
                        style={{ color: item.color }}
                      >
                        {item.name}
                      </div>
                      <div
                        className="text-sm sm:text-lg font-black"
                        style={{ color: item.color }}
                      >
                        {item.value.toFixed(2)}h
                      </div>
                    </div>
                  ))}
                </div>
                {selectedPieData.some((d) => d.value === 0) && (
                  <div className="mt-3 sm:mt-4 bg-red-500/10 border border-red-500/30 p-2 sm:p-3 rounded-lg text-[9px] sm:text-xs text-red-300 text-center font-bold animate-pulse">
                    ⚠️ WEAKNESS ALERT - Missing subject(s):{" "}
                    {selectedPieData
                      .filter((d) => d.value === 0)
                      .map((d) => d.name)
                      .join(", ")}
                  </div>
                )}
              </>
            )}
            <button
              onClick={() => closeAnyModal("pie")}
              className="w-full mt-4 sm:mt-6 bg-gradient-to-r from-purple-600 to-pink-600 py-2 sm:py-3 rounded-lg sm:rounded-xl font-bold uppercase text-[9px] sm:text-[10px] tracking-widest hover:shadow-lg hover:shadow-purple-500/40 transition-all animate-slideInUp"
            >
              Close
            </button>
          </div>
        </div>
      )}

      <style>{`
        /* ── Graph horizontal scroll – subtle scrollbar ── */
        .graph-scroll-container::-webkit-scrollbar {
          height: 4px;
        }
        .graph-scroll-container::-webkit-scrollbar-track {
          background: transparent;
        }
        .graph-scroll-container::-webkit-scrollbar-thumb {
          background: rgba(113, 113, 122, 0.55);
          border-radius: 2px;
        }
        .graph-scroll-container {
          scrollbar-width: thin;
          scrollbar-color: rgba(113,113,122,0.55) transparent;
        }

        /* ── Portrait: stack vertically ── */
        @media (orientation: portrait) and (max-width: 768px) {
          .battlefield-layout {
            flex-direction: column !important;
            display: flex;
          }
        }

        /* ── Landscape (phone horizontal): 2-column layout ── */
        @media (orientation: landscape) and (max-height: 600px) {
          .battlefield-layout {
            display: grid !important;
            grid-template-columns: 1fr 1fr !important;
            gap: 12px !important;
          }
          .battlefield-layout > * {
            min-height: fit-content;
          }
        }

        /* Change 8: Landscape responsive – prevent broken scaling on rotation */
        @media (orientation: landscape) and (max-height: 500px) {
          .lg\\:col-span-7, .lg\\:col-span-5 {
            padding: 12px !important;
            border-radius: 16px !important;
          }
          .max-w-6xl {
            padding-left: 8px !important;
            padding-right: 8px !important;
          }
          [class*="grid-cols-12"] {
            grid-template-columns: 1fr 1fr !important;
          }
          input[type="range"] {
            height: 6px;
          }
          button[class*="py-6"] {
            padding-top: 8px !important;
            padding-bottom: 8px !important;
          }
        }

        /* ── Button touch targets – minimum 44px ── */
        @media (max-width: 768px) {
          button {
            min-height: 44px;
          }
          .fixed.inset-0 button[class*="py-2"],
          .fixed.inset-0 button[class*="py-3"] {
            min-height: 44px;
            padding-top: 10px;
            padding-bottom: 10px;
          }
        }

        /* ── Card containment: prevent button/text overlap ── */
        .lg\\:col-span-7,
        .lg\\:col-span-5 {
          min-height: fit-content;
        }

        input[type="range"] {
          -webkit-appearance: none;
          appearance: none;
          cursor: pointer;
          transition: all 0.3s ease;
        }
        
        input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background: white;
          cursor: pointer;
          box-shadow: 0 0 8px rgba(34, 211, 238, 0.2);
          transition: background 0.2s ease;
          border: 2px solid rgba(34, 211, 238, 0.8);
        }

        input[type="range"]::-webkit-slider-thumb:hover {
          box-shadow: 0 0 8px rgba(34, 211, 238, 0.2);
        }

        input[type="range"]::-webkit-slider-thumb:active {
          transform: scale(1.05);
        }

        input[type="range"]::-moz-range-thumb {
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background: white;
          cursor: pointer;
          box-shadow: 0 0 8px rgba(34, 211, 238, 0.2);
          transition: background 0.2s ease;
          border: 2px solid rgba(34, 211, 238, 0.8);
        }

        input[type="range"]::-moz-range-thumb:hover {
          box-shadow: 0 0 8px rgba(34, 211, 238, 0.2);
        }

        input[type="range"].doom-slider::-webkit-slider-thumb {
          box-shadow: 0 0 8px rgba(234, 179, 8, 0.2);
          border: 2px solid rgba(234, 179, 8, 0.9);
        }

        input[type="range"].doom-slider::-webkit-slider-thumb:hover {
          box-shadow: 0 0 8px rgba(234, 179, 8, 0.2);
        }

        input[type="range"].doom-slider::-moz-range-thumb {
          box-shadow: 0 0 8px rgba(234, 179, 8, 0.2);
          border: 2px solid rgba(234, 179, 8, 0.9);
        }

        input[type="range"].doom-slider::-moz-range-thumb:hover {
          box-shadow: 0 0 8px rgba(234, 179, 8, 0.2);
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        @keyframes slideInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes slideInDown {
          from { opacity: 0; transform: translateY(-20px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes slideInLeft {
          from { opacity: 0; transform: translateX(-20px); }
          to { opacity: 1; transform: translateX(0); }
        }

        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(20px); }
          to { opacity: 1; transform: translateX(0); }
        }

        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.9); }
          to { opacity: 1; transform: scale(1); }
        }

        /* Change 9: one-time modal open pop animation (300ms, plays once on mount) */
        @keyframes modalPop {
          0%   { opacity: 0; transform: scale(0.82) translateY(8px); }
          70%  { opacity: 1; transform: scale(1.03) translateY(-2px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        .animate-modalPop { animation: modalPop 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }

        /* Modal EXIT animation — reverse of modalPop */
        @keyframes modalClose {
          0%   { opacity: 1; transform: scale(1) translateY(0); }
          100% { opacity: 0; transform: scale(0.82) translateY(10px); }
        }
        .animate-modalClose { animation: modalClose 0.25s cubic-bezier(0.4, 0, 1, 1) forwards; }

        /* Auth card slide-out animations (Login ↔ Register transitions) */
        @keyframes slideOutLeft {
          from { opacity: 1; transform: translateX(0); }
          to   { opacity: 0; transform: translateX(-60px); }
        }
        @keyframes slideOutRight {
          from { opacity: 1; transform: translateX(0); }
          to   { opacity: 0; transform: translateX(60px); }
        }
        @keyframes slideOutUp {
          from { opacity: 1; transform: translateY(0) scale(1); }
          to   { opacity: 0; transform: translateY(-60px) scale(0.95); }
        }
        .animate-slideOutLeft  { animation: slideOutLeft  0.3s cubic-bezier(0.4, 0, 1, 1) forwards; }
        .animate-slideOutRight { animation: slideOutRight 0.3s cubic-bezier(0.4, 0, 1, 1) forwards; }
        .animate-slideOutUp    { animation: slideOutUp    0.35s cubic-bezier(0.4, 0, 1, 1) forwards; }

        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }

        @keyframes cyberpulse {
          0%, 100% { opacity: 0.6; filter: drop-shadow(0 0 8px rgba(239, 68, 68, 0.3)); }
          50%       { opacity: 1;   filter: drop-shadow(0 0 16px rgba(239, 68, 68, 0.5)); }
        }

        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-8px); }
        }

        @keyframes glowPulse {
          0%, 100% { box-shadow: 0 0 10px rgba(34, 211, 238, 0.3); }
          50%       { box-shadow: 0 0 20px rgba(34, 211, 238, 0.5); }
        }

        .animate-fadeIn { animation: fadeIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }

        /* ── Overlay backdrop: opacity-only fade, NO translate (keeps popup truly fixed) ── */
        @keyframes overlayFadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        .animate-overlayFadeIn { animation: overlayFadeIn 0.2s ease forwards; }
        
        .neon-glow-container { filter: drop-shadow(0 0 15px rgba(168, 85, 247, 0.5)); }
        .slider-smooth { transition: all 0.2s ease !important; }

        /* ── One-time entry animations: play once, stay in final state ── */
        .animate-slideInUp    { animation: slideInUp    0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
        .animate-slideInDown  { animation: slideInDown  0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
        .animate-slideInLeft  { animation: slideInLeft  0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
        .animate-slideInRight { animation: slideInRight 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
        .animate-scaleIn      { animation: scaleIn      0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }

        /* ── Continuous motion: disabled on main app blocks (only entry plays) ── */
        .animate-bounce    { animation: bounce    0.5s ease forwards; }
        .animate-float     { animation: none; }
        .animate-glowPulse { animation: none; }

        h1 {
          background: linear-gradient(90deg,#06b6d4,#7c3aed,#f472b6);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
        }

        @media (max-width: 640px) {
          h1 { 
            font-size: 1.5rem; 
            line-height: 1.2;
          }

          button[class*="aspect-square"] {
            min-height: 32px;
            padding: 4px;
          }

          button[class*="rounded-full"] {
            min-width: 40px !important;
            min-height: 40px !important;
            display: flex;
            align-items: center;
            justify-content: center;
          }

          .fixed.inset-0 .rounded-2xl,
          .fixed.inset-0 [class*="rounded-"] {
            max-width: calc(100vw - 32px);
            border-radius: 16px;
          }

          [class*="text-xs"] {
            font-size: 0.7rem;
          }

          [class*="text-sm"] {
            font-size: 0.8rem;
          }

          button[class*="py-6"],
          button[class*="py-5"],
          button[class*="py-4"] {
            padding-top: 1rem;
            padding-bottom: 1rem;
          }

          [class*="grid-cols-7"] {
            gap: 4px;
          }

          input[type="range"] {
            height: 8px;
            margin: 8px 0;
          }

          input[type="range"]::-webkit-slider-thumb {
            width: 26px;
            height: 26px;
          }

          input[type="range"]::-moz-range-thumb {
            width: 26px;
            height: 26px;
          }

          [class*="grid-cols-2"] {
            gap: 12px;
          }

          .max-w-4xl,
          .max-w-2xl,
          .max-w-lg,
          .max-w-sm {
            max-width: calc(100vw - 32px) !important;
          }

          [class*="flex-col sm:flex-row"] {
            flex-direction: column;
            gap: 12px;
          }

          [class*="text-[8px]"],
          [class*="text-[10px]"],
          [class*="text-[11px]"] {
            word-break: break-word;
            line-height: 1.3;
          }

          [class*="italic"][class*="text-white/70"] {
            min-height: auto;
            max-height: none;
          }

          [class*="max-h-[60vh"],
          [class*="max-h-[90vh"] {
            max-height: 60vh;
            overflow-y: auto;
            -webkit-overflow-scrolling: touch;
          }
        }

        @media (max-width: 480px) {
          h1 {
            font-size: 1.25rem;
          }

          button[class*="rounded-full"] {
            min-width: 36px !important;
            min-height: 36px !important;
          }

          input[type="range"]::-webkit-slider-thumb {
            width: 24px;
            height: 24px;
          }

          input[type="range"]::-moz-range-thumb {
            width: 24px;
            height: 24px;
          }

          [class*="grid-cols-2"] {
            grid-template-columns: repeat(2, 1fr);
          }

          [class*="p-8"] {
            padding: 16px;
          }

          [class*="p-4"] {
            padding: 12px;
          }
        }

        @media (max-height: 500px) and (max-width: 900px) {
          [class*="max-h-[90vh"] {
            max-height: 70vh;
          }

          [class*="p-6"][class*="p-8"] {
            padding: 12px !important;
          }

          h1 {
            font-size: 1.25rem !important;
            margin-bottom: 8px;
          }

          h2 {
            font-size: 0.95rem !important;
          }

          [class*="space-y-6"] {
            gap: 8px !important;
          }

          [class*="space-y-4"] {
            gap: 6px !important;
          }

          [class*="mb-6"] {
            margin-bottom: 8px !important;
          }

          [class*="mb-8"] {
            margin-bottom: 12px !important;
          }

          [class*="ResponsiveContainer"] {
            height: auto !important;
          }

          [class*="grid-cols-3"],
          [class*="grid-cols-2"] {
            gap: 6px !important;
          }

          [class*="max-h-[60vh"],
          [class*="overflow-y-auto"] {
            max-height: 50vh;
          }

          button {
            font-size: 0.7rem !important;
            padding: 6px 12px !important;
          }

          [class*="text-sm"] {
            font-size: 0.75rem !important;
          }

          [class*="text-xs"] {
            font-size: 0.65rem !important;
          }

          [class*="rounded-[32px"] {
            border-radius: 16px !important;
          }

          [class*="rounded-2xl"] {
            border-radius: 12px !important;
          }
        }

        @media (max-height: 400px) {
          [class*="max-h-[90vh"] {
            max-height: 55vh;
          }

          [class*="p-8"] {
            padding: 8px !important;
          }

          [class*="py-12"],
          [class*="py-8"] {
            padding-top: 8px !important;
            padding-bottom: 8px !important;
          }

          [class*="gap-"] {
            gap: 4px !important;
          }
        }

        @media (min-height: 500px) and (min-width: 768px) and (max-height: 900px) {
          [class*="h-64"],
          [class*="h-80"] {
            height: 220px !important;
          }
        }
      `}</style>
    </div>
  );
}
