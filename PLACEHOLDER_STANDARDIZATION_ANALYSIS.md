# 📋 **PLACEHOLDER STANDARDIZATION ANALYSIS**

**Date:** 8 November 2025  
**Status:** 🔍 **ANALYSIS COMPLETE**  
**Issue:** Placeholder inconsistency and lack of standardization

---

## 🐛 **PROBLEM IDENTIFIED**

### **User Report:**
"Di ${nama} bukan nama pelanggan tapi nama wifi. Sepertinya placeholder tidak konsisten dan tidak standarisasi."

### **Current Behavior:**
In WiFi menu templates, `${nama}` shows the WiFi provider name instead of customer name, causing confusion.

---

## 🔍 **ROOT CAUSE ANALYSIS**

### **1. Inconsistent Placeholder Naming**

**Current System:**
```javascript
// message/wifi.js - All menu functions use:
wifimenu(nama, namabot) {
    // nama = config.nama = WiFi Provider Name
    // namabot = config.namabot = Bot Name
    return formatTemplate(template, { nama, namabot });
}
```

**Templates Using:**
```
"Selamat Datang di ${nama}!"  // Shows: WiFi Provider Name
"Terima kasih telah menggunakan layanan ${nama}!"  // Shows: WiFi Provider Name
```

### **2. Multiple Placeholder Systems**

**System 1: message/wifi.js**
- Uses simple `formatTemplate()` function
- Only replaces `${nama}` and `${namabot}`
- Direct string replacement

**System 2: lib/templating.js**
- Uses `renderTemplate()` function  
- Has proper placeholder mapping:
  - `nama` → Customer name (from data)
  - `nama_wifi` → WiFi Provider name (config.nama)
  - `nama_bot` → Bot name (config.namabot)
- More sophisticated with fallbacks

---

## 📊 **PLACEHOLDER USAGE ANALYSIS**

### **Current Placeholder Mapping:**

| Template Placeholder | Current Value | Expected Value | Status |
|---------------------|---------------|----------------|---------|
| `${nama}` in menus | WiFi Provider | Should be consistent | ❌ Confusing |
| `${namabot}` | Bot Name | Bot Name | ✅ Correct |
| `${nama_wifi}` | WiFi Provider | WiFi Provider | ✅ Clear |
| `${nama_bot}` | Bot Name | Bot Name | ✅ Clear |

### **Template Analysis:**

#### **1. wifimenu Template**
```
"Selamat Datang di ${nama}!" 
```
- **Current:** Shows WiFi provider name
- **Issue:** Ambiguous - could mean customer or provider
- **Recommendation:** Use `${nama_wifi}` for clarity

#### **2. customermenu Template**
```
"MENU PELANGGAN ${nama}"
```
- **Current:** Shows WiFi provider name
- **Issue:** Should show customer name or provider name?
- **Recommendation:** Use `${nama_wifi}` for provider

#### **3. technicianmenu Template**
```
"MENU TEKNISI ${nama}"
```
- **Current:** Shows WiFi provider name
- **Issue:** Same ambiguity
- **Recommendation:** Use `${nama_wifi}`

---

## ✅ **STANDARDIZATION RECOMMENDATIONS**

### **1. Clear Placeholder Naming Convention**

```javascript
// STANDARD PLACEHOLDERS:

// Customer Information
${nama_pelanggan}    // Customer name
${phone_pelanggan}   // Customer phone
${id_pelanggan}      // Customer ID

// Provider Information  
${nama_wifi}         // WiFi provider/company name
${nama_bot}          // Bot name
${nama_layanan}      // Service name

// Package Information
${nama_paket}        // Package name
${harga_paket}       // Package price
${speed_paket}       // Package speed

// System Information
${tanggal}           // Current date
${waktu}             // Current time
${ticket_id}         // Ticket ID
```

### **2. Template Updates Needed**

**BEFORE:**
```json
"wifimenu": "👋 *Selamat Datang di ${nama}!*"
```

**AFTER:**
```json
"wifimenu": "👋 *Selamat Datang di ${nama_wifi}!*"
```

### **3. Code Updates Required**

**File: message/wifi.js**
```javascript
// CURRENT (Ambiguous)
exports.wifimenu = (nama, namabot) => {
    return formatTemplate(template, { nama, namabot });
};

// PROPOSED (Clear)
exports.wifimenu = (namaWifi, namaBot) => {
    return formatTemplate(template, { 
        nama_wifi: namaWifi, 
        nama_bot: namaBot 
    });
};
```

---

## 📋 **IMPLEMENTATION PLAN**

### **Phase 1: Update Templates**
1. ✅ Replace `${nama}` with `${nama_wifi}` in all WiFi menu templates
2. ✅ Replace `${namabot}` with `${nama_bot}` for consistency
3. ✅ Add `${nama_pelanggan}` where customer name is needed

### **Phase 2: Update Code**
1. ✅ Modify `message/wifi.js` to use clear placeholder names
2. ✅ Update all menu handlers to pass correct data
3. ✅ Ensure backward compatibility

### **Phase 3: Documentation**
1. ✅ Create placeholder documentation
2. ✅ Update templates.php to show all available placeholders
3. ✅ Add validation for missing placeholders

---

## 🎯 **EXPECTED OUTCOME**

### **Before:**
- Ambiguous `${nama}` causing confusion
- No clear distinction between customer/provider names
- Inconsistent placeholder usage

### **After:**
- Clear `${nama_wifi}` for provider name
- Clear `${nama_pelanggan}` for customer name  
- Consistent placeholder naming across all templates
- Better documentation for template editors

---

## 📊 **ALL TEMPLATES REQUIRING UPDATE**

### **wifi_menu_templates.json:**
1. **wifimenu** - 2 occurrences of `${nama}`
2. **customermenu** - 1 occurrence of `${nama}`
3. **technicianmenu** - 1 occurrence of `${nama}`, 1 of `${namabot}`
4. **menubelivoucher** - 1 occurrence of `${nama}`, 1 of `${namabot}`
5. **menuvoucher** - 1 occurrence of `${nama}`, 1 of `${namabot}`
6. **menupasang** - 2 occurrences of `${nama}`
7. **menupaket** - 2 occurrences of `${nama}`
8. **menuowner** - 1 occurrence of `${nama}`

### **message_templates.json:**
- Need to check for consistency with the new naming convention

### **response_templates.json:**
- Need to check for consistency with the new naming convention

---

## ✅ **BENEFITS OF STANDARDIZATION**

1. **Clarity:** No more confusion about what each placeholder represents
2. **Maintainability:** Easier to understand and modify templates
3. **Consistency:** Same placeholder always means the same thing
4. **Documentation:** Clear reference for template editors
5. **Future-proof:** Easy to add new placeholders following the convention

---

## 🔧 **QUICK FIX AVAILABLE**

To immediately fix the confusion while maintaining backward compatibility:

```javascript
// message/wifi.js - Add this mapping
exports.wifimenu = (nama, namabot) => {
    const template = templatesCache.wifiMenuTemplates?.wifimenu || '';
    return formatTemplate(template, { 
        nama: nama,           // Keep for backward compatibility
        nama_wifi: nama,      // New clear naming
        namabot: namabot,     // Keep for backward compatibility
        nama_bot: namabot     // New clear naming
    });
};
```

Then gradually update templates to use the new clear placeholders.

---

## 📝 **CONCLUSION**

The placeholder system needs standardization to avoid confusion. The main issue is using `${nama}` ambiguously - sometimes meaning WiFi provider name, sometimes expected to be customer name. 

**Immediate Action:** Update all templates to use clear, unambiguous placeholder names like `${nama_wifi}` and `${nama_pelanggan}`.

**Long-term:** Implement a consistent placeholder naming convention across the entire system.
