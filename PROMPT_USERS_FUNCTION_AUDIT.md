# 🔍 PROMPT: AUDIT LENGKAP FUNGSI HALAMAN USERS

## 📋 KONTEKS
Halaman users.php memiliki berbagai fungsi yang perlu diverifikasi apakah sudah berjalan dengan baik atau perlu diperbaiki. Audit ini mencakup fungsi CRUD users, integrasi WiFi management, dan fitur-fitur lainnya.

## 🎯 TUJUAN AUDIT
1. Verifikasi semua fungsi di halaman users berjalan dengan benar
2. Identifikasi fungsi yang error atau tidak optimal
3. Test integrasi dengan WhatsApp bot
4. Pastikan data tersimpan dengan benar di SQLite
5. Check UI/UX responsiveness

## ✅ CHECKLIST FUNGSI YANG PERLU DIAUDIT

### 1. USER CRUD OPERATIONS

#### A. CREATE USER
- [ ] Button "Tambah Pelanggan" muncul dan clickable
- [ ] Modal form create user terbuka dengan benar
- [ ] Field yang harus ada:
  - [ ] Nama (required)
  - [ ] Username (auto-generate atau manual)
  - [ ] Password (auto-generate atau manual)  
  - [ ] Phone Number (format 62xxx)
  - [ ] Address
  - [ ] Subscription/Package
  - [ ] Device ID
  - [ ] ODP Connection
  - [ ] Coordinates (map picker)
- [ ] Validation:
  - [ ] Phone number format check
  - [ ] Username uniqueness check
  - [ ] Required fields validation
- [ ] Save to SQLite database
- [ ] Auto send credentials via WhatsApp
- [ ] Refresh table after create
- [ ] Success/error notification

#### B. EDIT USER  
- [ ] Edit button per row functional
- [ ] Modal pre-filled with existing data
- [ ] All fields editable kecuali ID
- [ ] Username/password can be regenerated
- [ ] Update saves to SQLite
- [ ] Table refresh after update
- [ ] Success/error notification

#### C. DELETE USER
- [ ] Delete button per row functional
- [ ] Confirmation dialog appears
- [ ] Soft delete atau hard delete?
- [ ] Remove from SQLite
- [ ] Table refresh after delete
- [ ] Success/error notification

#### D. VIEW/LIST USERS
- [ ] DataTable loads all users from SQLite
- [ ] Pagination works
- [ ] Search/filter functional
- [ ] Sort by columns works
- [ ] Export to Excel/PDF (if available)
- [ ] Status badges (Active/Inactive)
- [ ] Payment status indicators

### 2. WIFI MANAGEMENT INTEGRATION

#### A. CEK WIFI STATUS
- [ ] Button/link "Cek WiFi" per user
- [ ] Calls GenieACS API correctly
- [ ] Shows device online/offline status
- [ ] Display WiFi name (SSID)
- [ ] Display signal strength
- [ ] Display connected devices count
- [ ] Error handling if device unreachable

#### B. GANTI NAMA WIFI
- [ ] Button/modal untuk ganti nama WiFi
- [ ] Input validation (length, special chars)
- [ ] API call to GenieACS
- [ ] Update device configuration
- [ ] Send notification to customer via WhatsApp
- [ ] Log change in system
- [ ] Success/error feedback

#### C. GANTI PASSWORD WIFI
- [ ] Button/modal untuk ganti password
- [ ] Password strength indicator
- [ ] Generate random password option
- [ ] API call to GenieACS
- [ ] Update device configuration
- [ ] Send new password to customer via WhatsApp
- [ ] Log change in system
- [ ] Success/error feedback

### 3. ADDITIONAL FEATURES

#### A. CREDENTIAL MANAGEMENT
- [ ] Generate/regenerate username & password
- [ ] Send credentials button
- [ ] WhatsApp notification with credentials
- [ ] Copy to clipboard functionality
- [ ] Password visibility toggle

#### B. PAYMENT MANAGEMENT
- [ ] Update payment status (Paid/Unpaid)
- [ ] Payment history link/modal
- [ ] Auto-isolir for unpaid (if configured)
- [ ] Payment reminder scheduling

#### C. NETWORK MANAGEMENT
- [ ] PPPoE status check
- [ ] IP address display
- [ ] Bandwidth usage (if available)
- [ ] Connection quality metrics
- [ ] ODP/ODC assignment

#### D. MAP INTEGRATION
- [ ] Map shows user location
- [ ] Edit location via map
- [ ] Cluster view for multiple users
- [ ] Filter by area/ODP

#### E. BULK OPERATIONS
- [ ] Select multiple users
- [ ] Bulk delete
- [ ] Bulk status update
- [ ] Bulk message sending
- [ ] Export selected users

### 4. WHATSAPP BOT INTEGRATION

#### A. COMMAND TRIGGERS
- [ ] User can check WiFi via WhatsApp
- [ ] User can request password reset
- [ ] Admin notifications for changes
- [ ] Auto-reply for common queries

#### B. NOTIFICATIONS
- [ ] New user welcome message
- [ ] Password change notification
- [ ] Payment reminders
- [ ] Service announcements

### 5. TECHNICAL CHECKS

#### A. PERFORMANCE
- [ ] Page load time < 3 seconds
- [ ] DataTable renders smoothly
- [ ] No memory leaks
- [ ] Efficient database queries

#### B. ERROR HANDLING
- [ ] Network failure graceful handling
- [ ] Database connection errors
- [ ] API timeout handling
- [ ] User-friendly error messages

#### C. SECURITY
- [ ] SQL injection prevention
- [ ] XSS protection
- [ ] Password hashing
- [ ] Session management
- [ ] Role-based access control

#### D. RESPONSIVENESS
- [ ] Mobile view functional
- [ ] Tablet view functional
- [ ] Touch-friendly controls
- [ ] Modal sizing appropriate

## 🔧 TESTING SCENARIOS

### Scenario 1: Create New User Flow
```
1. Click "Tambah Pelanggan"
2. Fill all required fields
3. Set location on map
4. Generate credentials
5. Save user
6. Verify in database
7. Check WhatsApp notification sent
8. Verify user appears in table
```

### Scenario 2: WiFi Management Flow
```
1. Select existing user
2. Click "Cek WiFi"
3. View current status
4. Click "Ganti Password WiFi"
5. Generate new password
6. Apply changes
7. Verify in GenieACS
8. Check WhatsApp notification
9. Test WiFi connection with new password
```

### Scenario 3: Edit User Flow
```
1. Click Edit on existing user
2. Change phone number
3. Update address
4. Change subscription package
5. Save changes
6. Verify in database
7. Check table updated
8. Verify old data replaced
```

### Scenario 4: Delete User Flow
```
1. Click Delete on user
2. Confirm deletion
3. Check user removed from table
4. Verify in database
5. Check related data cleanup
6. Ensure no orphaned records
```

## 🐛 COMMON ISSUES TO CHECK

### Frontend Issues:
- [ ] Modal not closing after save
- [ ] DataTable not refreshing
- [ ] Validation messages not showing
- [ ] Loading spinner stuck
- [ ] Buttons not responding
- [ ] Map not loading
- [ ] Form data not clearing

### Backend Issues:
- [ ] API endpoints returning 404
- [ ] Database save failures
- [ ] WhatsApp message not sending
- [ ] GenieACS connection timeout
- [ ] Session expiry handling
- [ ] Concurrent update conflicts

### Integration Issues:
- [ ] WiFi changes not applying to device
- [ ] WhatsApp bot not responding
- [ ] Credentials not matching
- [ ] Status sync delays
- [ ] Cache invalidation problems

## 📊 EXPECTED OUTPUTS

### After Audit, Provide:

#### 1. FUNCTIONALITY MATRIX
```
Function          | Status  | Issues | Priority
------------------|---------|--------|----------
Create User       | ✅/❌   | ...    | HIGH/MED/LOW
Edit User         | ✅/❌   | ...    | HIGH/MED/LOW
Delete User       | ✅/❌   | ...    | HIGH/MED/LOW
Check WiFi        | ✅/❌   | ...    | HIGH/MED/LOW
Change WiFi Name  | ✅/❌   | ...    | HIGH/MED/LOW
Change WiFi Pass  | ✅/❌   | ...    | HIGH/MED/LOW
```

#### 2. ISSUE LIST
```
CRITICAL:
- Issue 1: [Description] → [File:Line] → [Fix needed]
- Issue 2: [Description] → [File:Line] → [Fix needed]

HIGH:
- Issue 3: [Description] → [File:Line] → [Fix needed]

MEDIUM:
- Issue 4: [Description] → [File:Line] → [Fix needed]

LOW:
- Issue 5: [Description] → [File:Line] → [Fix needed]
```

#### 3. FIX IMPLEMENTATION
For each issue found:
```javascript
// FILE: path/to/file.js
// ISSUE: Description of problem
// BEFORE:
[old code]

// AFTER:
[fixed code]

// TEST:
[how to verify fix works]
```

## 🚀 EXECUTION COMMAND

### Full Audit:
```
Lakukan audit lengkap halaman users.php sesuai checklist di PROMPT_USERS_FUNCTION_AUDIT.md. Test semua fungsi CRUD, WiFi management, dan integrasi WhatsApp. Output: functionality matrix + issue list + fixes.
```

### Quick Check:
```
Quick check halaman users:
1. Test create user → save to SQLite
2. Test edit/delete user
3. Test WiFi functions (cek, ganti nama, ganti password)
4. Check WhatsApp integration
Output: working/broken list + critical fixes only
```

### Specific Function:
```
Test fungsi [nama fungsi] di halaman users:
- Input test data
- Execute function
- Check database changes
- Verify WhatsApp notification
- Report issues + fix
```

## 📝 NOTES

### System Architecture:
- Frontend: users.php (PHP + JavaScript)
- Backend: routes/users.js, routes/api.js
- Database: SQLite (users table)
- WhatsApp: Global.raf instance
- WiFi: GenieACS integration

### Critical Dependencies:
- jQuery DataTables
- Bootstrap modals
- Leaflet maps
- SweetAlert2
- Select2 dropdowns
- WhatsApp Baileys
- SQLite3

### Key Files:
```
views/sb-admin/users.php     → Main page
routes/users.js               → User API endpoints
routes/api.js                 → General API
lib/database.js               → Database operations
message/handlers/wifi-*.js   → WiFi handlers
message/raf.js                → WhatsApp bot
```

---

**END OF AUDIT PROMPT**
