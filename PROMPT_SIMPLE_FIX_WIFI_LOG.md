# 🎯 SIMPLE PROMPT - FIX WIFI LOG ISSUES

## COPY PASTE INI KE AI:

---

Fix WiFi log showing "[object Object]" and wrong reboot message.

**PROBLEMS:**
1. Log shows: `oldSsidName: "[object Object],[object Object]"` instead of actual name
2. Success message says "Modem akan restart otomatis" for name change (wrong - only password change restarts)
3. Log doesn't show which specific SSID was changed

**FIXES NEEDED:**

### 1. wifi-name-state-handler.js Line 116-125:
```javascript
// REPLACE the fetch old name section with:
let oldName = 'Previous';
try {
    const oldInfo = await getSSIDInfo(userState.targetUser.device_id);
    if (oldInfo && oldInfo.ssid && Array.isArray(oldInfo.ssid)) {
        const targetSsidId = ssidsToChange[0] || '1';
        const targetSsid = oldInfo.ssid.find(s => String(s.id) === String(targetSsidId));
        if (targetSsid && targetSsid.name) {
            oldName = targetSsid.name;
        }
    }
} catch (fetchErr) {
    console.log('[WIFI_NAME] Could not fetch old name:', fetchErr.message);
}
```

### 2. wifi-name-state-handler.js Line 161:
Change success message - REMOVE "Modem akan restart otomatis", REPLACE with:
```
• WiFi dengan nama lama akan terputus
• Silakan cari WiFi dengan nama baru di perangkat Anda
• Gunakan password yang sama untuk menyambung
```

### 3. wifi-name-state-handler.js Line 145-146:
Update log to show specific SSID:
```javascript
reason: `WiFi name change via WhatsApp Bot (SSID ${ssidsToChange[0] || '1'})`,
notes: `Changed SSID ${ssidsToChange[0] || '1'} only`
```

### 4. Also fix handleConfirmGantiNamaBulk (Line 280) - same getSSIDInfo issue

**TEST:** Run "ganti nama TestWiFi" - should show actual old name in log, not [object Object]

**UNTUK DETAIL LENGKAP:** Lihat file `PROMPT_FIX_WIFI_LOG_ISSUES.md`

---
