# 🔧 PROMPT LENGKAP PERBAIKAN WIFI COMPREHENSIVE

## 📋 IMPORTANT: READ FIRST
1. Baca `AI_MAINTENANCE_GUIDE.md` untuk memahami struktur
2. Baca `ANALISIS_LENGKAP_WIFI_LOG_PASSWORD.md` untuk detail masalah
3. Fix SEMUA issues sekaligus, jangan setengah-setengah

---

## 🔴 ISSUES TO FIX

### **1. SSID Lama Tidak Terdeteksi**
- getSSIDInfo dipanggil dengan parameter SALAH
- Parameter kedua adalah skipRefresh, BUKAN ssidId

### **2. Password Change Tidak Terlog**
- wifi-password-state-handler.js tidak ada logging
- User tidak bisa lihat history password

### **3. Password Disensor**
- Currently shows [PROTECTED]
- User wants actual password visible

### **4. History WiFi Belum Ada**
- Handler untuk HISTORY_WIFI belum dibuat

---

## ✅ COMPLETE FIX IMPLEMENTATION

### **STEP 1: Fix wifi-name-state-handler.js**

#### **Line 119: Fix getSSIDInfo Call**
```javascript
// CHANGE FROM:
const oldInfo = await getSSIDInfo(userState.targetUser.device_id, ssidsToChange[0] || '1');

// CHANGE TO:
const oldInfo = await getSSIDInfo(userState.targetUser.device_id);  // No second parameter!
```

#### **Line 282: Fix Bulk Handler Too**
```javascript
// CHANGE FROM:
const { ssid } = await getSSIDInfo(targetUser.device_id);

// KEEP AS IS (this one is already correct)
```

### **STEP 2: Fix wifi-password-state-handler.js**

#### **Add Import at Top (Line 2)**
```javascript
const { logWifiChange } = require('../../../lib/wifi-logger');
```

#### **Line 144: Add Logging After setPassword**
```javascript
// AFTER: await setPassword(userData.targetUser.device_id, userData.ssid_id || '1', newPassword);
// ADD THIS:

// Log the password change
await logWifiChange({
    userId: userData.targetUser.id,
    deviceId: userData.targetUser.device_id,
    changeType: 'password',
    changes: {
        oldPassword: '[Previous]',  // Can't fetch old password
        newPassword: newPassword,   // Show actual password
        ssidId: userData.ssid_id || '1'
    },
    changedBy: 'customer',
    changeSource: 'wa_bot',
    customerName: userData.targetUser.name || 'Customer',
    customerPhone: sender.replace('@s.whatsapp.net', ''),
    reason: `WiFi password change via WhatsApp Bot (SSID ${userData.ssid_id || '1'})`,
    notes: `Password changed for SSID ${userData.ssid_id || '1'}`,
    ipAddress: 'WhatsApp',
    userAgent: 'WhatsApp Bot'
});
console.log(`[WIFI_PASSWORD] Password changed for user ${userData.targetUser.id}, SSID ${userData.ssid_id || '1'}`);
```

#### **Line 195: Add Logging for Bulk (handleAskNewPasswordBulk)**
```javascript
// AFTER the for loop that sets passwords
// ADD THIS:

// Log the change
await logWifiChange({
    userId: userState.targetUser.id,
    deviceId: userState.targetUser.device_id,
    changeType: 'password',
    changes: {
        oldPassword: '[Previous]',
        newPassword: newPassword,   // Show actual password
        ssidIds: ssidsToChange.join(', ')
    },
    changedBy: 'customer',
    changeSource: 'wa_bot',
    customerName: userState.targetUser.name || 'Customer',
    customerPhone: sender.replace('@s.whatsapp.net', ''),
    reason: `WiFi password change via WhatsApp Bot (${ssidsToChange.length} SSIDs)`,
    notes: `Changed password for SSIDs: ${ssidsToChange.join(', ')}`,
    ipAddress: 'WhatsApp',
    userAgent: 'WhatsApp Bot'
});
```

#### **Line 272 (Existing logWifiChange): Update to Show Password**
```javascript
// FIND:
newPassword: '[PROTECTED]'

// CHANGE TO:
newPassword: newPassword  // Show actual password
```

### **STEP 3: Fix wifi-management-handler.js**

#### **Line 476: Show Actual Password**
```javascript
// CHANGE FROM:
newPassword: '[PROTECTED]'

// CHANGE TO:
newPassword: newPassword  // Show actual password as requested
```

### **STEP 4: Create History WiFi Handler**

#### **Create New File: message/handlers/wifi-history-handler.js**
```javascript
const { getWifiChangeLogs } = require('../../lib/wifi-logger');

/**
 * Handle HISTORY_WIFI intent - Show WiFi change history
 */
async function handleHistoryWifi(sender, reply, global) {
    try {
        // Get user info
        const senderNumber = sender.replace('@s.whatsapp.net', '');
        const user = global.users.find(u => {
            if (!u.phone_number) return false;
            const phones = u.phone_number.split('|');
            return phones.some(phone => {
                const normalizedPhone = phone.replace(/\D/g, '');
                const normalizedSender = senderNumber.replace(/\D/g, '');
                return normalizedPhone === normalizedSender || 
                       normalizedPhone === '62' + normalizedSender ||
                       '62' + normalizedPhone === normalizedSender;
            });
        });
        
        if (!user) {
            return reply('❌ Maaf, nomor Anda tidak terdaftar sebagai pelanggan.');
        }
        
        // Get logs for this user
        const logs = await getWifiChangeLogs({
            userId: user.id,
            limit: 10
        });
        
        if (!logs || logs.length === 0) {
            return reply('📋 Tidak ada history perubahan WiFi untuk akun Anda.');
        }
        
        let message = '📋 *HISTORY PERUBAHAN WIFI*\n';
        message += `👤 *Pelanggan:* ${user.name}\n`;
        message += `📱 *Device:* ${user.device_id}\n`;
        message += '━━━━━━━━━━━━━━━━━━━━\n\n';
        
        logs.forEach((log, index) => {
            const date = new Date(log.timestamp);
            const dateStr = date.toLocaleDateString('id-ID');
            const timeStr = date.toLocaleTimeString('id-ID');
            
            message += `*${index + 1}. ${dateStr} - ${timeStr}*\n`;
            
            if (log.changeType === 'ssid_name') {
                message += `   📡 *Ganti Nama WiFi*\n`;
                message += `   Lama: _${log.changes.oldSsidName || 'Unknown'}_\n`;
                message += `   Baru: *${log.changes.newSsidName}*\n`;
                if (log.changes.ssidId) {
                    message += `   SSID: ${log.changes.ssidId}\n`;
                }
            } else if (log.changeType === 'password') {
                message += `   🔑 *Ganti Password WiFi*\n`;
                message += `   Password: *${log.changes.newPassword}*\n`;  // Show actual password
                if (log.changes.ssidId) {
                    message += `   SSID: ${log.changes.ssidId}\n`;
                } else if (log.changes.ssidIds) {
                    message += `   SSIDs: ${log.changes.ssidIds}\n`;
                }
            }
            
            message += `   Oleh: ${log.changedBy}\n`;
            if (log.notes) {
                message += `   Info: ${log.notes}\n`;
            }
            message += '\n';
        });
        
        message += '━━━━━━━━━━━━━━━━━━━━\n';
        message += '💡 _Menampilkan 10 perubahan terakhir_';
        
        reply(message);
        
    } catch (error) {
        console.error('[HISTORY_WIFI] Error:', error);
        reply('❌ Maaf, terjadi kesalahan saat mengambil history WiFi.');
    }
}

module.exports = {
    handleHistoryWifi
};
```

### **STEP 5: Add to raf.js Routing**

#### **Add Import (around Line 80)**
```javascript
const { handleHistoryWifi } = require('./handlers/wifi-history-handler');
```

#### **Add Case in Switch (around Line 1500)**
```javascript
case 'HISTORY_WIFI': {
    await handleHistoryWifi(sender, reply, global);
    break;
}
```

### **STEP 6: Update wifi_templates.json**

#### **Add History WiFi Keywords**
```json
{
    "keywords": [
        "history wifi",
        "riwayat wifi",
        "log wifi",
        "perubahan wifi",
        "cek history wifi",
        "lihat history wifi"
    ],
    "intent": "HISTORY_WIFI",
    "category": "wifi",
    "description": "Melihat riwayat perubahan WiFi",
    "icon": "📋"
}
```

### **STEP 7: Update AI_MAINTENANCE_GUIDE.md**

#### **Add to WiFi Data Structures Section (after Line 575):**
```markdown
### WiFi Password Logging:
```javascript
// Password should be visible in logs for monitoring
changes: {
    newPassword: actualPassword  // NOT '[PROTECTED]'
}
```

### WiFi History Feature:
- Command: "history wifi"
- Shows last 10 changes
- Displays both name and password changes
- Shows actual passwords for reference
```

#### **Update Common Issues (Line 507):**
```markdown
| Password not logged | wifi-password-state-handler.js | Add logWifiChange after setPassword |
| History WiFi not working | wifi-history-handler.js | Check getWifiChangeLogs function |
```

---

## 🧪 TESTING CHECKLIST

### **Test 1: Name Change**
```bash
# User: ganti nama TestWiFi
# Check log shows:
- oldSsidName: "ActualOldName" (not "1")
- newSsidName: "TestWiFi"
```

### **Test 2: Password Change**
```bash
# User: ganti password Test1234
# Check log shows:
- changeType: "password"
- newPassword: "Test1234" (not [PROTECTED])
```

### **Test 3: History WiFi**
```bash
# User: history wifi
# Should show formatted history with dates and actual passwords
```

---

## ⚠️ CRITICAL REMINDERS

1. **getSSIDInfo only takes (deviceId, skipRefresh)** - NO ssidId parameter
2. **Show actual passwords** - User specifically requested this
3. **Test ALL changes** - Don't leave any handler unfixed
4. **Update AI_MAINTENANCE_GUIDE.md** - Keep documentation current

---

## 📊 EXPECTED RESULTS

After all fixes:
1. ✅ SSID old name shows correctly (not "1")
2. ✅ Password changes are logged
3. ✅ Passwords visible in logs (not [PROTECTED])
4. ✅ History WiFi command works
5. ✅ All handlers consistent

---

**Use this comprehensive prompt to fix ALL WiFi issues at once.**
