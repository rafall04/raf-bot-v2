# 🐛 BUG: Bot Says "Success" When Device is Offline

## ❌ MASALAH

```
Scenario:
1. Device/alat pelanggan MATI/OFFLINE
2. User ketik: "ganti nama WiFi"
3. Bot respons: "✅ Berhasil mengubah nama WiFi!"
4. SALAH! Harusnya ERROR karena device offline
```

## 🔍 ROOT CAUSE ANALYSIS

### **Penyebab Utama:**

File: `message/handlers/steps/wifi-steps-bulk.js` (line 70-86)

```javascript
const response = await axios.post(
    `${global.config.genieacsBaseUrl}/devices/${deviceId}/tasks?connection_request`,
    {
        name: 'setParameterValues',
        parameterValues: parameterValues
    }
);

if (response.status === 200 || response.status === 202) {
    // ❌ LANGSUNG BILANG "BERHASIL"
    return {
        success: true,
        message: `✅ *Berhasil!*\n\nSandi WiFi telah diubah...`
    };
}
```

### **Mengapa Ini Salah:**

1. **GenieACS Return 200/202 = Task CREATED, NOT Task COMPLETED**
   - Status 200/202 hanya berarti task berhasil DIANTREKAN
   - Bukan berarti task sudah SELESAI dieksekusi

2. **Device Offline = Task Queued Forever**
   - Jika device offline, task tetap di-queue
   - GenieACS tetap return 200/202
   - Task tidak pernah execute sampai device online
   - Bot bilang "Berhasil" padahal tidak ada yang berubah

3. **No Device Status Check**
   - Tidak ada pengecekan apakah device online
   - Tidak ada pengecekan lastInform timestamp
   - Tidak ada verifikasi task completion

### **Impact:**

- ❌ User dibohongi dengan pesan "Berhasil"
- ❌ User bingung kenapa WiFi tidak berubah
- ❌ Loss of trust ke bot/system
- ❌ Support ticket meningkat

## ✅ SOLUTION

### **Option 1: Check Device Online Status (RECOMMENDED)**

Add device status check BEFORE creating task:

```javascript
// Check if device is online
async function isDeviceOnline(deviceId) {
    try {
        const response = await axios.get(
            `${global.config.genieacsBaseUrl}/devices/?query={"_id":"${deviceId}"}&projection=_lastInform`
        );
        
        if (response.data && response.data[0]) {
            const lastInform = new Date(response.data[0]._lastInform);
            const now = new Date();
            const diffMinutes = (now - lastInform) / 1000 / 60;
            
            // Device considered online if last inform < 5 minutes ago
            return diffMinutes < 5;
        }
        
        return false;
    } catch (error) {
        console.error('[isDeviceOnline] Error:', error);
        return false;
    }
}

// Before executing task
const deviceOnline = await isDeviceOnline(targetUser.device_id);

if (!deviceOnline) {
    return {
        success: false,
        message: `❌ *Perangkat Offline*\n\nPerangkat Anda sedang tidak terhubung ke sistem.\n\n*Solusi:*\n• Pastikan modem menyala\n• Tunggu beberapa menit\n• Coba lagi\n\nJika masih bermasalah, hubungi teknisi.`
    };
}

// Then create task...
```

### **Option 2: Change Message to Be Honest**

Don't claim "Success", say "Task Created":

```javascript
if (response.status === 200 || response.status === 202) {
    deleteUserState(sender);
    return {
        success: true,
        message: `⏳ *Permintaan Diterima*\n\nPerubahan WiFi sedang diproses. Tunggu 1-2 menit.\n\n*Catatan:*\n• Pastikan modem menyala\n• Perangkat akan restart otomatis\n• WiFi akan berubah setelah restart selesai\n\n_Jika tidak berubah setelah 5 menit, hubungi teknisi._`
    };
}
```

### **Option 3: Wait and Verify Task Completion**

Wait for task to complete and verify:

```javascript
// Create task
const taskResponse = await axios.post(...);

// Wait for task completion (with timeout)
const maxWait = 30000; // 30 seconds
const startTime = Date.now();

while (Date.now() - startTime < maxWait) {
    const taskStatus = await axios.get(
        `${global.config.genieacsBaseUrl}/tasks?query={"device":"${deviceId}"}`
    );
    
    // Check if task completed
    const completedTask = taskStatus.data.find(t => 
        t.name === 'setParameterValues' && t.status === 'done'
    );
    
    if (completedTask) {
        return {
            success: true,
            message: `✅ *Berhasil!*\n\nWiFi telah diubah.`
        };
    }
    
    await sleep(2000); // Wait 2 seconds before retry
}

// Timeout
return {
    success: false,
    message: `⏳ *Timeout*\n\nPerubahan membutuhkan waktu lebih lama. Tunggu 5 menit atau hubungi teknisi.`
};
```

## 🎯 RECOMMENDED IMPLEMENTATION

Combine Option 1 & 2:

```javascript
// 1. Check device online FIRST
const deviceOnline = await isDeviceOnline(targetUser.device_id);

if (!deviceOnline) {
    return {
        success: false,
        message: `❌ *Perangkat Offline*\n\nPerangkat Anda tidak terhubung.\n\nPastikan modem menyala dan coba lagi.`
    };
}

// 2. Create task
const response = await axios.post(...);

if (response.status === 200 || response.status === 202) {
    deleteUserState(sender);
    return {
        success: true,
        message: `⏳ *Sedang Diproses*\n\nPerubahan WiFi sedang dilakukan. Tunggu 1-2 menit.\n\n_Modem akan restart otomatis._`
    };
}
```

## 📁 FILES TO MODIFY

All files with WiFi task execution:

1. ✅ `message/handlers/steps/wifi-steps-bulk.js`
   - Line ~70-93 (handleWifiPasswordSteps - bulk mode)
   - Line ~140-170 (handleWifiPasswordSteps - single SSID)
   - Line ~270-300 (handleWifiPasswordSteps - all SSIDs)
   - Line ~390-420 (handleWifiNameSteps - bulk mode)
   - Line ~470-500 (handleWifiNameSteps - single SSID)
   - Line ~530-560 (handleWifiNameSteps - all SSIDs)

2. ✅ `message/handlers/wifi-handler-fixed.js`
   - Line ~220-250 (handleWifiPasswordChange)
   - Line ~480-510 (handleWifiNameChange)

3. ✅ `message/handlers/wifi-handler-simple.js` (if still used)
   - Line ~50-95 (applyBulkWifiChanges)

## 🔧 IMPLEMENTATION STEPS

### **Step 1: Create Helper Function**

File: `lib/device-status.js` (NEW FILE)

```javascript
const axios = require('axios');

/**
 * Check if device is online
 * @param {string} deviceId - Device ID
 * @returns {Promise<boolean>} True if online
 */
async function isDeviceOnline(deviceId) {
    try {
        const response = await axios.get(
            `${global.config.genieacsBaseUrl}/devices/?query={"_id":"${deviceId}"}&projection=_lastInform`
        );
        
        if (response.data && response.data[0] && response.data[0]._lastInform) {
            const lastInform = new Date(response.data[0]._lastInform);
            const now = new Date();
            const diffMinutes = (now - lastInform) / 1000 / 60;
            
            // Device considered online if last inform < 5 minutes ago
            return diffMinutes < 5;
        }
        
        return false;
    } catch (error) {
        console.error('[isDeviceOnline] Error:', error.message);
        // If error, assume offline to be safe
        return false;
    }
}

/**
 * Get device last inform time
 * @param {string} deviceId - Device ID
 * @returns {Promise<Date|null>} Last inform date or null
 */
async function getDeviceLastInform(deviceId) {
    try {
        const response = await axios.get(
            `${global.config.genieacsBaseUrl}/devices/?query={"_id":"${deviceId}"}&projection=_lastInform`
        );
        
        if (response.data && response.data[0] && response.data[0]._lastInform) {
            return new Date(response.data[0]._lastInform);
        }
        
        return null;
    } catch (error) {
        console.error('[getDeviceLastInform] Error:', error.message);
        return null;
    }
}

module.exports = {
    isDeviceOnline,
    getDeviceLastInform
};
```

### **Step 2: Update WiFi Handlers**

Add device online check before task creation:

```javascript
const { isDeviceOnline } = require('../../../lib/device-status');

// Before creating task
reply(`⏳ Memeriksa status perangkat...`);

const deviceOnline = await isDeviceOnline(targetUser.device_id);

if (!deviceOnline) {
    deleteUserState(sender);
    return {
        success: false,
        message: `❌ *Perangkat Offline*\n\n` +
                 `Perangkat Anda sedang tidak terhubung ke sistem.\n\n` +
                 `*Kemungkinan Penyebab:*\n` +
                 `• Modem mati/tidak ada listrik\n` +
                 `• Kabel power lepas\n` +
                 `• Gangguan jaringan\n\n` +
                 `*Solusi:*\n` +
                 `• Pastikan modem menyala\n` +
                 `• Periksa kabel power\n` +
                 `• Tunggu 5 menit lalu coba lagi\n\n` +
                 `Jika masih bermasalah, hubungi teknisi.`
    };
}

reply(`⏳ Sedang mengubah WiFi...`);

// Then create task...
```

### **Step 3: Update Success Message**

Be honest about task status:

```javascript
if (response.status === 200 || response.status === 202) {
    deleteUserState(sender);
    return {
        success: true,
        message: `✅ *Permintaan Diterima*\n\n` +
                 `Perubahan WiFi sedang diproses.\n\n` +
                 `*Perhatian:*\n` +
                 `• Modem akan restart otomatis (1-2 menit)\n` +
                 `• Semua perangkat akan terputus\n` +
                 `• Gunakan password baru untuk reconnect\n\n` +
                 `_Jika tidak berubah setelah 5 menit, hubungi teknisi._`
    };
}
```

## ✅ TESTING CHECKLIST

Test dengan device offline:

- [ ] ❌ Matikan modem/device
- [ ] ❌ Ketik: "ganti sandi 12345678"
- [ ] ✅ Harus dapat error: "Perangkat Offline"
- [ ] ❌ Tidak boleh dapat: "Berhasil"

Test dengan device online:

- [ ] ✅ Pastikan modem online
- [ ] ✅ Ketik: "ganti sandi 12345678"
- [ ] ✅ Harus dapat: "Permintaan Diterima" atau "Sedang Diproses"
- [ ] ✅ WiFi berubah setelah 1-2 menit

## 📊 PRIORITY

**🔴 HIGH PRIORITY - CRITICAL BUG**

This is a critical UX issue:
- Users are being deceived with false success messages
- Causes confusion and support tickets
- Damages trust in the system

**Implement ASAP!**

---

**Status:** 📝 SPECIFICATION COMPLETE - READY FOR IMPLEMENTATION
**Estimated Time:** 2-3 hours
**Impact:** HIGH - Affects all WiFi operations
