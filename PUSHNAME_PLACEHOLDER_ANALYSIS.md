# 🔍 **PUSHNAME PLACEHOLDER ANALYSIS - CRITICAL ISSUE**

**Date:** 8 November 2025  
**Status:** 🚨 **CRITICAL BUG FOUND**  
**Issue:** ${pushname} placeholder tidak bekerja di menu templates

---

## 🐛 **PROBLEM IDENTIFIED**

### **User Report:**
"Saya coba pakai pushname untuk get nama tapi kenapa tidak terdeteksi? Placeholder tidak konsisten dan tidak ada standarisasi."

### **Test Result:**
```
Template: "Terima kasih telah menggunakan layanan ${pushname}!"
Output: "Terima kasih telah menggunakan layanan ${pushname}!"  ❌
Expected: "Terima kasih telah menggunakan layanan Budi!"  ✅
```

---

## 🔍 **ROOT CAUSE ANALYSIS**

### **1. DATA FLOW BROKEN**

**Current Flow:**
```javascript
// 1. raf.js - pushname AVAILABLE ✅
const pushname = msg.pushName  // e.g., "Budi"

// 2. Call menu handler - pushname NOT PASSED ❌
handleMenuUtama(global.config, reply);
// Missing: pushname parameter!

// 3. menu-handler.js - pushname NOT RECEIVED ❌
function handleMenuUtama(config, reply) {
    reply(wifimenu(config.nama, config.namabot));
    // Missing: pushname parameter!
}

// 4. wifi.js - pushname NOT AVAILABLE ❌
exports.wifimenu = (nama, namabot) => {
    return formatTemplate(template, { 
        nama: nama,
        namabot: namabot
        // Missing: pushname!
    });
}

// 5. Template - ${pushname} FAILS ❌
"Terima kasih ${pushname}!" → "Terima kasih ${pushname}!"
```

### **2. INCONSISTENT IMPLEMENTATION**

**Some handlers RECEIVE pushname:**
```javascript
// ✅ CORRECT - utility-handler.js
function handleSapaanUmum(pushname, reply) {
    // Can use pushname
}

// ✅ CORRECT - smart-report handlers
const result = await startReportFlow({
    sender,
    pushname,  // Passed correctly
    reply
});
```

**But menu handlers DON'T:**
```javascript
// ❌ WRONG - menu-handler.js
function handleMenuUtama(config, reply) {
    // No pushname parameter!
}

function handleMenuPelanggan(config, reply) {
    // No pushname parameter!
}

function handleMenuTeknisi(config, reply) {
    // No pushname parameter!
}
```

---

## 📊 **IMPACT ANALYSIS**

### **Affected Templates (wifi_menu_templates.json):**
1. ❌ wifimenu - Cannot use ${pushname}
2. ❌ customermenu - Cannot use ${pushname}
3. ❌ technicianmenu - Cannot use ${pushname}
4. ❌ menubelivoucher - Cannot use ${pushname}
5. ❌ menuvoucher - Cannot use ${pushname}
6. ❌ menupasang - Cannot use ${pushname}
7. ❌ menupaket - Cannot use ${pushname}
8. ❌ menuowner - Cannot use ${pushname}

### **Working Placeholders:**
- ✅ ${nama} / ${nama_wifi} - WiFi provider name
- ✅ ${namabot} / ${nama_bot} - Bot name
- ❌ ${pushname} - WhatsApp display name
- ❌ ${sender} - Sender phone number
- ❌ Any user-specific data

---

## ✅ **SOLUTION REQUIRED**

### **Fix Implementation - 3 Steps:**

#### **Step 1: Update raf.js calls**
```javascript
// BEFORE:
handleMenuUtama(global.config, reply);

// AFTER:
handleMenuUtama(global.config, reply, pushname, sender);
```

#### **Step 2: Update menu-handler.js**
```javascript
// BEFORE:
function handleMenuUtama(config, reply) {
    reply(wifimenu(config.nama, config.namabot));
}

// AFTER:
function handleMenuUtama(config, reply, pushname, sender) {
    reply(wifimenu(config.nama, config.namabot, pushname, sender));
}
```

#### **Step 3: Update wifi.js**
```javascript
// BEFORE:
exports.wifimenu = (nama, namabot) => {
    return formatTemplate(template, { 
        nama: nama,
        nama_wifi: nama,
        namabot: namabot,
        nama_bot: namabot
    });
};

// AFTER:
exports.wifimenu = (nama, namabot, pushname, sender) => {
    return formatTemplate(template, { 
        nama: nama,
        nama_wifi: nama,
        namabot: namabot,
        nama_bot: namabot,
        pushname: pushname || 'Kak',  // Fallback if undefined
        sender: sender,
        phone: sender?.replace('@s.whatsapp.net', '')
    });
};
```

---

## 📊 **COMPLETE PLACEHOLDER MAPPING NEEDED**

### **User Context Placeholders (Currently Missing):**
```javascript
{
    // User identification
    pushname: msg.pushName,           // WhatsApp display name
    sender: msg.key.remoteJid,        // Full sender ID
    phone: plainSenderNumber,         // Clean phone number
    
    // User data (if registered)
    nama_pelanggan: user?.name,       // Customer name from DB
    id_pelanggan: user?.id,           // Customer ID
    alamat: user?.address,            // Customer address
    paket: user?.subscription,        // Current package
    
    // Context
    waktu: new Date().toLocaleTimeString(),
    tanggal: new Date().toLocaleDateString(),
    greeting: getGreeting()           // Pagi/Siang/Malam
}
```

---

## 🎯 **EXPECTED OUTCOME AFTER FIX**

### **Before Fix:**
```
Input: "Halo ${pushname}, selamat datang di ${nama_wifi}!"
Output: "Halo ${pushname}, selamat datang di RAF Net!"  ❌
```

### **After Fix:**
```
Input: "Halo ${pushname}, selamat datang di ${nama_wifi}!"
Output: "Halo Budi, selamat datang di RAF Net!"  ✅
```

---

## 🚨 **SEVERITY: CRITICAL**

### **Why Critical:**
1. **User Experience:** Cannot personalize messages
2. **Professional Image:** Looks unprofessional with ${pushname} shown
3. **Functionality:** Many templates rely on user context
4. **Consistency:** Other parts of system use pushname correctly

### **Affected Users:**
- ✅ All users seeing menu messages
- ✅ Template editors confused why placeholders don't work
- ✅ Admins unable to create personalized templates

---

## 📋 **STANDARDIZATION NEEDED**

### **Proposed Standard Handler Signature:**
```javascript
// All handlers should receive consistent parameters:
function handleAnyMenu(config, reply, context) {
    // context object contains:
    // - pushname
    // - sender
    // - isOwner
    // - isTeknisi
    // - user (if found)
    // - etc.
}
```

### **Proposed Template Function Signature:**
```javascript
exports.anyMenu = (config, context) => {
    // Merge all data for template
    const templateData = {
        ...config,        // nama, namabot, etc.
        ...context,       // pushname, sender, etc.
        // Computed values
        greeting: getGreeting(context.pushname),
        formatted_phone: formatPhone(context.sender)
    };
    
    return formatTemplate(template, templateData);
};
```

---

## ⚠️ **CURRENT WORKAROUNDS**

### **For Users:**
1. Don't use ${pushname} in menu templates (won't work)
2. Use generic greetings like "Kak" or "Pelanggan"
3. Wait for fix to be implemented

### **For Developers:**
1. Be aware menu handlers lack user context
2. Only config data is available in menu templates
3. Non-menu handlers may have different behavior

---

## 📝 **CONCLUSION**

The placeholder system has a **CRITICAL DESIGN FLAW** where user context (pushname, sender, etc.) is not passed through the menu handler chain. This makes it impossible to use user-specific placeholders in menu templates.

**Immediate Action Required:** Implement the 3-step fix to pass user context through the entire chain.

**Long-term:** Standardize all handler signatures to ensure consistent data availability.
