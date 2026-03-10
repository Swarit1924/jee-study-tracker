# Notifications Setup Guide

## ✅ Quick Setup

### 1. **Enable Notifications in App**
   - Click the **🔔 Bell Icon** at the top right
   - Click "Enable Notifications"
   - Grant permission when browser asks

### 2. **Browser Permission Prompts**
   - **Chrome/Edge/Firefox**: See a permission popup at the top
   - **Safari**: Check system notification settings

---

## 🔧 Troubleshooting

### ❌ Not Receiving Notifications?

#### **Check 1: Browser Support**
- **Supported**: Chrome, Firefox, Edge, Safari, Opera
- **Not Supported**: Internet Explorer, older mobile browsers
- Check your browser is updated to latest version

#### **Check 2: Notification Permission**
**For All Browsers:**
1. Look for 🔒 **lock icon** in address bar
2. Click it
3. Find "Notifications" 
4. Select "Allow"
5. Refresh page

**Chrome/Edge (Windows):**
1. Settings → Privacy & Security → Site settings
2. Search "Notifications"
3. Find "jeeprep.app" or "localhost"
4. Toggle Allow

**Firefox:**
1. Preferences → Privacy → Permissions
2. Find "Notifications"
3. Allow for your site

**Safari (Mac):**
1. System Preferences → Notifications
2. Find "Safari" or your app
3. Select "Allow Notifications"

#### **Check 3: Test Notification**
1. Enable notifications (click bell icon → Enable)
2. You should see test notification immediately
3. Check:
   - Your notification center
   - Bottom-right corner
   - System tray

#### **Check 4: Daily Notifications**
- **Morning notifications**: 6:00 AM
- **Night notifications**: 10:00 PM
- Check device is awake during these times
- Browser tab doesn't need to be open (Service Worker handles it)

#### **Check 5: Service Worker Status**
1. Open Developer Tools (F12)
2. Go to **Application** tab
3. Look for **Service Workers**
4. Should show green "running" status
5. If error, clear browser cache and reload

---

## 🚀 Features

### Daily Motivation
- **6 AM**: Morning motivational quote
- **10 PM**: Night motivational quote

### Streak Milestones (when notifications ON)
- **7-day**: Motivation + study tips
- **21-day**: Advanced study tips  
- **30-day**: Elite-level guidance
- **60-day**: God Mode tips
- **90-day**: Mastery guidance
- **365-day**: Championship notification

### Test Notification
- Sent immediately when you enable notifications
- Confirms system is working

---

## ⚙️ Technical Details

### What's Happening
1. **Service Worker** (`/public/sw.js`): Handles notifications in background
2. **Notification API**: Modern web standard
3. **Firestore**: Syncs notification settings across devices

### Notification Types
- **Simple**: Shows text + icon when browser/tab is open
- **Persistent**: Shows even when app is closed (via Service Worker)
- **Rich**: Can include buttons and actions (coming soon)

### Why No Notifications?
1. **HTTPS Required**: Must be HTTPS in production (localhost OK for dev)
2. **Security**: Notification API is restricted for security
3. **Permissions**: User must explicitly allow
4. **Browser Limitations**: Some browsers/OS have restrictions

---

## 📱 Platform-Specific

### **Windows PC**
- ✅ Chrome: Full support
- ✅ Edge: Full support  
- ✅ Firefox: Full support
- ⚠️ Check Settings → System → Notifications & actions

### **macOS**
- ✅ Chrome: Full support
- ✅ Safari: Full support (requires app permission)
- ✅ Firefox: Full support
- ⚠️ Check System Preferences → Notifications

### **iPhone/iPad**
- ✅ Safari: Full support
- ✅ Chrome: Full support
- ⚠️ Must enable via Settings → Notifications

### **Android**
- ✅ Chrome: Full support
- ✅ Firefox: Full support
- ⚠️ Must enable via Android notification settings

---

## 🛠️ For Developers

### Enable Debug Logging
Open Developer Console (F12) to see:
- `✅ Service Worker registered`
- `🔔 Requesting notification permission`
- `📤 Sending notification...`
- `✅ Notification sent`

### View Service Worker Status
1. F12 → Application → Service Workers
2. Should show green "running" 
3. Click to see worker details

### Clear Service Worker
If notifications aren't working:
```
1. F12 → Application → Service Workers
2. Click "Unregister"
3. Reload page
4. Try enabling notifications again
```

---

## ❓ Still Not Working?

1. **Use Modern Browser**: Update to latest Chrome/Firefox/Edge
2. **Clear Cache**: Ctrl+Shift+Delete → Clear all
3. **Use HTTPS**: Make sure site is HTTPS (not HTTP)
4. **Check Firewall**: Antivirus might block notifications
5. **Open Console**: F12 → Console tab, look for errors
6. **Disable VPN**: VPN might interfere with notifications
7. **Try Different Browser**: Test on different browser

**Still stuck?** Check browser console (F12) for error messages.
