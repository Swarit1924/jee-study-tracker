# Push Notifications Setup Guide - Firebase Cloud Messaging

## 🎯 Goal
Enable **true push notifications** like WhatsApp - app receives notifications even when closed, on phone and PC.

---

## 📋 Complete Setup Steps

### **Step 1: Get Firebase Web Push Certificate (VAPID Key)**

#### Option A: Via Firebase Console UI (Easiest)
1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project
3. Go to **Project Settings** (⚙️ gear icon)
4. Click **Cloud Messaging** tab
5. Under **Web Configuration**, find **Web Push certificates**
6. Click **Generate Key Pair**
7. Copy the **Server API Key** (this is your VAPID key)

#### Option B: Via Firebase CLI
```bash
# If Firebase CLI not installed:
npm install -g firebase-tools

# Login to Firebase
firebase login

# Initialize Firebase (if not done)
firebase init

# Get config info
firebase setup:web
```

---

### **Step 2: Add VAPID Key to Your Environment**

1. Open `.env` file in your project root
2. Add this line:
```
VITE_FIREBASE_VAPID_KEY=YOUR_VAPID_KEY_HERE
```
3. Replace `YOUR_VAPID_KEY_HERE` with the key from Step 1
4. **DO NOT commit this to git** (should be in .gitignore already)

**Example:**
```env
VITE_FIREBASE_API_KEY=AIzaSyDx...
VITE_FIREBASE_VAPID_KEY=BPxyz...4567890abcdef
```

---

### **Step 3: Deploy Cloud Functions**

These functions send automated push notifications at scheduled times.

#### Prerequisites:
- Firebase CLI installed: `npm install -g firebase-tools`
- Node.js 20+ installed

#### Deploy:
```bash
# Navigate to project root
cd "C:\Users\Apnuswaru\OneDrive\Desktop\Swarit\JEE Preparation App"

# Deploy Cloud Functions
firebase deploy --only functions
```

**What this does:**
- ✅ Deploys `sendMorningNotification` - Sends at **6 AM IST daily**
- ✅ Deploys `sendNightNotification` - Sends at **10 PM IST daily**
- ✅ Deploys `sendCustomNotification` - API for manual notifications
- ✅ Deploys `cleanupInvalidTokens` - Cleans expired tokens weekly

#### Check deployment status:
```bash
# View logs
firebase functions:list

# View recent logs
firebase functions:log
```

---

### **Step 4: Enable Firebase Cloud Messaging API**

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Select your project
3. Search for **"Cloud Messaging API"**
4. Click **Enable** if not already enabled

---

### **Step 5: Test on Your Device**

#### On Phone:
1. Open your app in phone browser (Chrome, Firefox, Safari)
2. Click 🔔 **Bell Icon** → **"Enable Notifications"**
3. Grant notification permission
4. You should see test notification instantly
5. Close the app completely
6. Wait for **6 AM or 10 PM** (or test with Cloud Functions)
7. Push notification should appear in notification center

#### On Desktop:
1. Same steps as phone
2. Close browser completely (not just the tab)
3. Desktop notification will appear at scheduled time
4. **You don't need to keep the browser open**

---

## 🔧 How It Works

### Architecture:
```
┌─────────────────────┐
│   Your Phone/PC     │
│  ┌───────────────┐  │
│  │  App (Closed) │  │
│  └───────────────┘  │
└──────────┬──────────┘
           │ (Device Token)
           │
     ┌─────▼──────────────┐
     │  Firebase Cloud    │
     │    Messaging       │
     │   (FCM Service)    │
     └─────▲──────────────┘
           │ (Sends Notification)
           │
    ┌──────┴──────────┐
    │   Cloud         │
    │   Functions     │ (Runs at 6 AM, 10 PM)
    │   (Scheduler)   │
    └─────────────────┘
```

### Flow:
1. **User registers** app → Device gets unique FCM token
2. **Token saved** to Firestore database
3. **Cloud Function triggers** at scheduled time (6 AM, 10 PM)
4. **Function queries** all users with notifications enabled
5. **FCM sends** notification to each device via token
6. **Device receives** notification even if app is closed

---

## ✅ Verification Checklist

- [ ] VAPID key added to `.env`
- [ ] Cloud Functions deployed (`firebase deploy --only functions`)
- [ ] Cloud Messaging API enabled in Google Cloud
- [ ] App loads without FCM errors in console
- [ ] Can enable notifications in app
- [ ] Test notification shows when enabling
- [ ] FCM token visible in browser console (check `[SW] FCM Token received`)
- [ ] Token saved to Firestore (check Firebase Console → Firestore → jeeWarriors collection)
- [ ] Received notification at 6 AM IST
- [ ] Received notification at 10 PM IST

---

## 🐛 Troubleshooting

### Issue: "VAPID key not set" error

**Solution:**
1. Check `.env` file has `VITE_FIREBASE_VAPID_KEY=...`
2. Restart dev server: `npm run dev`
3. Hard refresh browser: `Ctrl+Shift+R`

### Issue: "Cloud Messaging API not enabled"

**Solution:**
1. Go to Google Cloud Console
2. Search "Cloud Messaging"
3. Click "Enable"
4. Wait 1-2 minutes
5. Redeploy: `firebase deploy --only functions`

### Issue: Token not saved to Firestore

**Solution:**
1. Open browser console (F12)
2. Look for `✅ FCM Token received`
3. If not there, check:
   - VAPID key is correct
   - Service Worker is running (F12 → Application → Service Workers)
   - User is logged in

### Issue: Notifications not received at 6 AM / 10 PM

**Solution:**
1. Check Cloud Function logs: `firebase functions:log`
2. Ensure `notificationsEnabled: true` in Firestore
3. Ensure `fcmToken` is stored for user
4. Test manually with `sendCustomNotification` API
5. Verify timezone is IST in Cloud Function

### Issue: "No users to notify" in logs

**Solution:**
- Users haven't enabled notifications yet
- OR FCM tokens weren't saved
- Test by enabling notifications on one device and waiting for next scheduled time

### Issue: Browser console shows warnings

**Check:**
1. **"Service Worker failed"** → Clear browser cache, re-register
2. **"Notification permission denied"** → Check browser settings
3. **"HTTPS required"** → Production must be HTTPS (localhost OK)

---

## 📱 Testing Manually

### Send test notification via Firebase Console:

1. Firebase Console → Cloud Messaging
2. Click **"New Campaign"**
3. Enter title and message
4. Select **"Target"** → Condition →  Add a condition
5. Filter by `notificationsEnabled = true`
6. Click **"Review"** → **"Publish"**

### Send via Cloud Function API:

```bash
# Use curl or Postman
curl -X POST https://YOUR_PROJECT.cloudfunctions.net/sendCustomNotification \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Notification",
    "body": "This is a test push notification",
    "requireInteraction": true
  }'
```

---

## 📊 Monitoring

### View notification statistics:

```bash
# Check logs
firebase functions:log --limit 100

# Filter by function
firebase functions:log | grep "sendMorning"
```

### Check user tokens:

Firebase Console → Firestore → jeeWarriors collection → Click user → See `fcmToken` field

---

## 🚀 Advanced: Custom Notifications

### Send notification to specific users:

Modify `functions/index.js`:
```javascript
const usersSnapshot = await db
  .collection('jeeWarriors')
  .where('notificationsEnabled', '==', true)
  .where('level', '>=', 3)  // Only to advanced users
  .get();
```

### Add action buttons to notifications:

```javascript
webpush: {
  notification: {
    actions: [
      { action: 'open', title: 'Open App' },
      { action: 'close', title: 'Dismiss' }
    ]
  }
}
```

---

## 📝 Summary

**You now have:**
- ✅ Automatic daily notifications at 6 AM & 10 PM
- ✅ Notifications work even when app is closed
- ✅ Works on iOS, Android, Windows, Mac
- ✅ Device tokens safely stored
- ✅ Invalid tokens auto-cleaned
- ✅ Custom notification API available

**Next:** Deploy to production with HTTPS!

---

## ❓ Need Help?

Check:
1. Browser console (F12) for errors
2. Cloud Function logs: `firebase functions:log`
3. Firestore database for token storage
4. Firebase Cloud Messaging settings
