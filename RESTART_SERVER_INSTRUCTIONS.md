# 🔄 RESTART SERVER - CRITICAL FOR PHP FILE CHANGES

## 🚨 **WHY RESTART IS NEEDED**

PHP servers cache compiled files using **OpCache** or similar mechanisms. When you modify `.php` files, the server may continue serving the OLD cached version until:

1. OpCache expires (could be hours/days)
2. Server is restarted
3. OpCache is manually cleared

**Your situation:**
- ✅ Code is correct in Git repository
- ✅ Files are updated on disk
- ❌ Server is serving OLD cached version
- ❌ Browser gets old JavaScript with syntax errors

---

## 📋 **RESTART INSTRUCTIONS**

### **Method 1: Restart Node.js Server** (RECOMMENDED)

If you're running the server manually:

```bash
# Stop the server
# Press Ctrl+C in the terminal where server is running

# Then restart
npm start
# or
node index.js
# or
npm run dev
```

### **Method 2: Restart via PM2** (if using PM2)

```bash
# List running processes
pm2 list

# Restart the app (replace 'app-name' with actual name)
pm2 restart app-name

# Or restart all
pm2 restart all

# Check logs
pm2 logs
```

### **Method 3: Restart via systemd** (if running as service)

```bash
# Restart the service (replace 'service-name' with actual name)
sudo systemctl restart raf-bot

# Check status
sudo systemctl status raf-bot
```

### **Method 4: Clear PHP OpCache** (if applicable)

If you have PHP running separately:

```bash
# Restart PHP-FPM (Ubuntu/Debian)
sudo systemctl restart php-fpm

# Or for specific PHP version
sudo systemctl restart php8.1-fpm

# Apache users
sudo systemctl restart apache2
```

---

## ✅ **VERIFICATION STEPS**

After restarting:

### **Step 1: Check Server Logs**
```bash
# Look for startup messages
# Should show: "Server listening on port 3100" or similar
```

### **Step 2: Clear Browser Cache (AGAIN!)**
```
Ctrl+Shift+Delete
→ Clear everything
→ Close ALL tabs
→ Restart browser
```

### **Step 3: Hard Refresh**
```
Open map-viewer page
Press: Ctrl+F5 (NOT just F5!)
Or: Ctrl+Shift+R
```

### **Step 4: Verify in DevTools**
```
F12 → Sources tab
Find: map-viewer in file list
Check line 1247: Should be just "}"
Check lines 1151-1159: Should have commented fullscreenControl
```

### **Step 5: Check Console**
```
F12 → Console tab
Should see: "[InitializeMap] Objek peta berhasil dibuat."
Should NOT see: "SyntaxError" at line 1247
```

---

## 🎯 **EXPECTED RESULTS**

### **After Server Restart + Browser Cache Clear:**

✅ **Console (F12):**
```
[InitializeMap] Memulai inisialisasi peta...
[InitializeMap] Objek peta berhasil dibuat.
[LoadData] Memuat data dari server...
```

✅ **Visual:**
- Map tiles load (satellite view)
- Markers appear (ODC, ODP, Customer)
- No blank page
- No errors

✅ **No Errors:**
- NO "SyntaxError: Unexpected token '}'"
- NO "isFullscreen is not a function"
- NO blank map

---

## 🔧 **TROUBLESHOOTING**

### **If Still Not Working After Restart:**

**1. Check if server actually restarted:**
```bash
# Check process
ps aux | grep node

# Check port
netstat -tlnp | grep 3100
```

**2. Check if new code is loaded:**
```
F12 → Sources tab → map-viewer
Look at lines 1151-1159
Should see comments starting with "// fullscreenControl disabled"
```

**3. Try incognito mode:**
```
Ctrl+Shift+N (Chrome/Edge)
Open map-viewer in incognito
Should work if server restart worked
```

**4. Check server logs for errors:**
```bash
# If using PM2
pm2 logs

# If running manually
# Look at terminal output
```

**5. Force reload without cache:**
```
F12 → Network tab
Check "Disable cache" ✓
Refresh page
All files should load fresh (not from cache)
```

---

## 📊 **DEBUGGING CHECKLIST**

```
Server Side:
[ ] Server restarted
[ ] No errors in server logs
[ ] Server accessible (port 3100)
[ ] New code loaded (check file timestamps)

Client Side:
[ ] Browser cache cleared
[ ] Hard refresh performed (Ctrl+F5)
[ ] DevTools Sources shows new code
[ ] No syntax errors in console
[ ] Map tiles loading
[ ] Markers appearing

If ALL checked ✓ and still broken:
[ ] Try different browser
[ ] Check firewall/antivirus
[ ] Check network issues
[ ] Report with screenshots
```

---

## 🚀 **QUICK FIX SUMMARY**

```bash
# 1. RESTART SERVER
pm2 restart all
# or
Ctrl+C then npm start

# 2. CLEAR BROWSER CACHE
Ctrl+Shift+Delete → Clear all

# 3. HARD REFRESH
Ctrl+F5 on map-viewer page

# 4. VERIFY
F12 → Console → No errors
F12 → Elements → Map div has content
```

---

## ⚠️ **IMPORTANT NOTES**

1. **ALWAYS restart server after modifying PHP files**
2. **ALWAYS clear browser cache after code changes**
3. **ALWAYS hard refresh (Ctrl+F5) not regular refresh**
4. **Check BOTH server and browser for issues**

---

## 📞 **IF STILL BROKEN**

Provide these details:

1. **Server status:**
   - Running? (yes/no)
   - Logs show errors? (paste here)
   
2. **Browser console:**
   - Screenshot of errors
   - Exact error messages

3. **Network tab:**
   - Screenshot showing map-viewer file loading
   - Check response (should be 200 OK)

4. **Sources tab:**
   - Screenshot of lines 1240-1260
   - Verify code matches expectation

---

**CRITICAL: Restart server first, THEN test!**
