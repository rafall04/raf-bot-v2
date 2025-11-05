# 🔒 MASS FIX: Fetch API Authentication Issues

**Date:** November 5, 2025  
**Issue:** Multiple PHP files have Fetch API calls without `credentials: 'include'`  
**Impact:** Potential 401 errors across multiple admin features  
**Status:** ⏳ NEEDS ATTENTION

---

## 📊 **SCAN RESULTS** ✅ COMPLETED

**Scan Date:** November 5, 2025, 11:22 PM  
**Status:** 🔴 CRITICAL - Action Required

### **Summary:**
```
Total Fetch Calls Found: 113 in 24 files
Authentication Issues: 97 in 22 files
Severity: HIGH (all authenticated endpoints)

Fixed: 1 file (broadcast.php) ✅
Pending: 22 files ⏳
Success Rate: 4.3% (1/23 files)
```

### **Top 10 Critical Files:**
```
1. users.php - 17 issues 🔴 CRITICAL
2. teknisi-map-viewer.php - 12 issues 🔴 CRITICAL
3. map-viewer.php - 11 issues 🟠 HIGH
4. teknisi-pelanggan.php - 9 issues 🔴 CRITICAL
5. config.php - 7 issues 🔴 CRITICAL
6. parameter-management.php - 6 issues 🟠 HIGH
7. wifi-templates.php - 5 issues 🟠 HIGH
8. kompensasi.php - 5 issues 🟡 MEDIUM
9. teknisi-tiket.php - 4 issues 🔴 CRITICAL
10. pembayaran/teknisi.php - 4 issues 🟡 MEDIUM

... and 12 more files
```

**📋 Full Report:** See `SCAN_RESULTS_FETCH_AUTH.md`

---

## 🛠️ **AUTOMATED TOOLS PROVIDED**

### **1. Scanner Script** (Check Only)

**Purpose:** Scan all PHP files and identify fetch calls missing credentials

**Usage:**
```bash
node scripts/check-fetch-credentials.js
```

**Output Example:**
```
🔍 Scanning PHP files for Fetch API authentication issues...

❌ Found 45 potential issues in 18 files:

📄 views/sb-admin/users.php
   Line 234: [HIGH] /api/users
   → Missing credentials: 'include' for authenticated endpoint
   Line 389: [HIGH] /api/users/123/update
   → Missing credentials: 'include' for authenticated endpoint

...

📊 SUMMARY:
   Files with issues: 18
   Total issues: 45
```

### **2. Auto-Fix Script** (Modify Files)

**Purpose:** Automatically add `credentials: 'include'` to all fetch calls

**⚠️ WARNING:** This modifies files! Commit your changes first.

**Usage:**
```bash
# Step 1: Commit current changes
git add -A
git commit -m "Before mass fetch credentials fix"

# Step 2: Run auto-fix
node scripts/fix-fetch-credentials.js

# Step 3: Review changes
git diff

# Step 4: Test affected pages
# (See testing section below)

# Step 5: Commit if OK
git add -A
git commit -m "Fix: Add credentials to all fetch API calls"
```

**What it does:**
- Scans all PHP files in `views/sb-admin/`
- Identifies fetch calls to `/api/*` endpoints
- Adds `credentials: 'include'` after headers
- Skips public endpoints (login, otp, etc.)
- Adds comment: `// ✅ Fixed by script`

---

## 🧪 **TESTING PLAN**

### **Priority 1: Critical Features** (Test First)

1. **Users Management** (`users.php`)
   - [ ] Add new user
   - [ ] Edit user
   - [ ] Delete user
   - [ ] Update credentials

2. **Broadcast** (`broadcast.php`)
   - [x] Send broadcast ✅ (Already fixed)
   - [x] Load user list ✅ (Already fixed)

3. **Config Management** (`config.php`)
   - [ ] Update configuration
   - [ ] Save changes

4. **WiFi Templates** (`wifi-templates.php`)
   - [ ] Create template
   - [ ] Edit template
   - [ ] Delete template

### **Priority 2: Technician Features**

5. **Teknisi Map** (`teknisi-map-viewer.php`)
   - [ ] View customer locations
   - [ ] Filter by area

6. **Teknisi Pelanggan** (`teknisi-pelanggan.php`)
   - [ ] View customer list
   - [ ] Customer details

7. **Teknisi Tiket** (`teknisi-tiket.php`)
   - [ ] View tickets
   - [ ] Process ticket
   - [ ] Update status

### **Priority 3: Other Features**

8. **Announcements** (`announcements.php`)
9. **News** (`news.php`)
10. **Compensation** (`kompensasi.php`)
11. **Package Requests** (`package-requests.php`)
12. **Speed Requests** (`speed-requests.php`)

### **Testing Checklist Per Page:**

For each page:
- [ ] Load page successfully
- [ ] No 401 errors in console
- [ ] All AJAX requests work
- [ ] Data loads correctly
- [ ] Form submissions work
- [ ] Authentication maintained

---

## 📝 **MANUAL FIX TEMPLATE**

If you prefer to fix manually or auto-fix fails:

### **Before:**
```javascript
fetch('/api/endpoint', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
})
```

### **After:**
```javascript
fetch('/api/endpoint', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
    },
    credentials: 'include', // ✅ Add this line
    body: JSON.stringify(data),
})
```

### **Common Patterns:**

**Pattern 1: Simple POST**
```javascript
fetch('/api/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include', // ← Add here
    body: JSON.stringify(userData)
})
```

**Pattern 2: GET Request**
```javascript
fetch('/api/tickets', {
    credentials: 'include' // ← Add here (only parameter for GET)
})
```

**Pattern 3: DELETE Request**
```javascript
fetch(`/api/users/${id}`, {
    method: 'DELETE',
    credentials: 'include', // ← Add here
})
```

---

## 🚨 **TROUBLESHOOTING**

### **Issue: Script doesn't fix some files**

**Cause:** Complex fetch patterns that script can't parse

**Solution:**
1. Run scanner to identify remaining issues
2. Fix those files manually
3. Rerun scanner to verify

### **Issue: Page still returns 401 after fix**

**Possible causes:**
1. Browser cached old JavaScript
   - Solution: Hard refresh (Ctrl+Shift+R)
   
2. JWT token expired
   - Solution: Logout and login again
   
3. Cookie not being set
   - Solution: Check browser devtools → Application → Cookies

### **Issue: Auto-fix breaks JavaScript syntax**

**Cause:** Script inserted credentials in wrong location

**Solution:**
1. Git reset the file: `git checkout -- path/to/file.php`
2. Fix manually
3. Report the pattern to improve script

---

## 📋 **DEPLOYMENT STRATEGY**

### **Option A: Mass Fix (Recommended)**

**Pros:**
- Fixes all issues at once
- Consistent across all pages
- Faster overall

**Cons:**
- Requires extensive testing
- Higher risk if issues occur

**Steps:**
1. Commit current code
2. Run auto-fix script
3. Test all Priority 1 features
4. Test Priority 2 features
5. Deploy if all tests pass

### **Option B: Incremental Fix**

**Pros:**
- Lower risk per deployment
- Easier to identify issues
- Can prioritize critical features

**Cons:**
- Takes longer overall
- More commits/deployments

**Steps:**
1. Week 1: Fix Priority 1 (broadcast, users, config)
2. Week 2: Fix Priority 2 (teknisi features)
3. Week 3: Fix Priority 3 (remaining features)

---

## 📊 **PROGRESS TRACKING**

### **Files Fixed:**

- [x] broadcast.php ✅ (Manual fix - Nov 5)
- [ ] users.php
- [ ] teknisi-map-viewer.php
- [ ] map-viewer.php
- [ ] teknisi-pelanggan.php
- [ ] config.php
- [ ] parameter-management.php
- [ ] kompensasi.php
- [ ] wifi-templates.php
- [ ] pembayaran/teknisi.php
- [ ] teknisi-tiket.php
- [ ] tiket.php
- [ ] announcements.php
- [ ] index.php
- [ ] news.php
- [ ] teknisi-working-hours.php
- [ ] templates.php
- [ ] cron.php
- [ ] migrate.php
- [ ] view-invoice.php
- [ ] package-requests.php
- [ ] speed-requests.php
- [ ] teknisi-request-paket.php

**Progress:** 1/24 (4.2%)

---

## 🎯 **SUCCESS CRITERIA**

All done when:
- [x] Scanner script created ✅
- [x] Auto-fix script created ✅
- [ ] All Priority 1 pages tested
- [ ] No 401 errors in production
- [ ] All features working normally
- [ ] Documentation updated

---

## 📚 **REFERENCES**

- **Bug Report:** `BUGFIX_BROADCAST_AUTH.md`
- **Scanner:** `scripts/check-fetch-credentials.js`
- **Auto-Fix:** `scripts/fix-fetch-credentials.js`
- **Routes Docs:** `routes/README.md`

---

**Created:** November 5, 2025  
**Status:** TODO - Awaiting mass fix  
**Priority:** HIGH  
**Estimated Time:** 4-6 hours (testing included)
