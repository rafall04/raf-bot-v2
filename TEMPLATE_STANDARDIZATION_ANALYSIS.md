# 📋 **TEMPLATE STANDARDIZATION ANALYSIS**

**Date:** 8 November 2025  
**Status:** 🚨 **CRITICAL ISSUES FOUND**  
**Issue:** Many messages are hardcoded, not in templates system

---

## 🔍 **PROBLEM IDENTIFIED**

### **User Report:**
"Tidak semua command ada di halaman templates. Ketika saya ketik menu dan bantuan, pesannya tidak ada di menu templates."

### **Current Situation:**
- 378 reply() calls across 30 handler files
- Many messages hardcoded in handler files
- No centralized template management
- Inconsistent message formatting

---

## 📊 **AUDIT RESULTS**

### **1. Messages IN Templates (✅):**
```
wifi_menu_templates.json:
- wifimenu (Menu Utama)
- technicianmenu
- customermenu  
- menubelivoucher
- menuvoucher
- menupasang
- menupaket
- menuowner

message_templates.json:
- speed_on_demand_applied
- unpaid_reminder
- tagihan_lunas/belum_lunas
- sudah_bayar_notification
- compensation_applied/reverted
- customer_welcome
- redaman_alert
```

### **2. Messages HARDCODED (❌):**

#### **utility-handler.js:**
```javascript
// BANTUAN - Hardcoded (lines 16-47)
const bantuanText = `Hai ${pushname} 👋
*PANDUAN BANTUAN ${namaLayanan.toUpperCase()}*
━━━━━━━━━━━━━━━━━━━
...`;

// SAPAAN_UMUM - Hardcoded (lines 53-68)
reply(`${greeting} ${pushname} 👋\n\nAda yang bisa saya bantu?...`);

// CEK_TIKET - Hardcoded (lines 73-176)
const replyMessage = `📋 *INFORMASI TIKET GANGGUAN*...`;
```

#### **menu-handler.js:**
```javascript
// handleMenuPelanggan - Hardcoded (lines 54-93)
const menuText = `📱 *MENU PELANGGAN ${namaLayanan.toUpperCase()}*
━━━━━━━━━━━━━━━━━━━
📋 *LAYANAN GANGGUAN*...`;
```

#### **saldo-voucher-handler.js:**
```javascript
// handleCekSaldo - Hardcoded
reply(`Halo Kak ${pushname}, saldo Anda saat ini adalah...`);

// handleTanyaHargaVoucher - Hardcoded  
reply(`Halo Kak ${pushname}, berikut daftar harga voucher...`);
```

#### **wifi-management-handler.js (46 hardcoded messages!):**
```javascript
// Error messages, confirmations, success messages all hardcoded
reply(`Maaf Kak ${pushname}, pelanggan dengan ID...`);
reply(`✅ WiFi berhasil diganti nama...`);
reply(`❌ Gagal mengganti nama WiFi...`);
// ... 43 more
```

#### **network-management-handler.js (28 hardcoded):**
```javascript
// PPPoE, binding, profile messages all hardcoded
```

#### **And Many More...**
- states/wifi-password-state-handler.js (31 hardcoded)
- states/wifi-name-state-handler.js (26 hardcoded)
- states/other-state-handler.js (20 hardcoded)
- saldo-handler.js (19 hardcoded)
- monitoring-handler.js (16 hardcoded)
- voucher-management-handler.js (16 hardcoded)
- package-management-handler.js (13 hardcoded)
- billing-management-handler.js (10 hardcoded)

---

## 🎯 **SOLUTION: COMPREHENSIVE TEMPLATE SYSTEM**

### **Phase 1: Create Template Files**

#### **1. Create command_templates.json:**
```json
{
  "bantuan": {
    "name": "Help/Bantuan Command",
    "template": "Hai ${pushname} 👋\n\n*PANDUAN BANTUAN ${nama_wifi}*\n━━━━━━━━━━━━━━━━━━━\n\n📌 *CARA MENGGUNAKAN BOT:*\n1. Ketik perintah yang diinginkan\n2. Ikuti instruksi yang diberikan\n3. Tunggu respon dari bot\n\n📋 *PERINTAH UTAMA:*\n• *menu* - Tampilkan menu utama\n• *lapor* - Laporkan gangguan\n• *ceksaldo* - Cek saldo Anda\n• *admin* - Hubungi admin\n\n🔧 *TIPS:*\n• Gunakan perintah dengan benar\n• Jangan spam perintah\n• Tunggu respon sebelum mengirim perintah baru\n\n📞 *BUTUH BANTUAN LEBIH?*\nHubungi admin dengan mengetik *admin*\n\n━━━━━━━━━━━━━━━━━━━\n_${nama_bot} - Siap membantu Anda 24/7_"
  },
  "sapaan_umum": {
    "name": "General Greeting",
    "template": "${greeting} ${pushname} 👋\n\nAda yang bisa saya bantu? Ketik *menu* untuk melihat daftar perintah yang tersedia."
  },
  "menu_pelanggan": {
    "name": "Customer Menu",
    "template": "📱 *MENU PELANGGAN ${nama_wifi}*\n━━━━━━━━━━━━━━━━━━━\n\n📋 *LAYANAN GANGGUAN*\n• *lapor* - Laporkan gangguan\n• *cektiket [ID]* - Cek status tiket\n• *batalkantiket [ID]* - Batalkan tiket\n\n🚀 *SPEED BOOST*\n• *speedboost* - Request speed boost\n• *cekspeed* - Cek status boost\n\n💳 *TAGIHAN & PAKET*\n• *cektagihan* - Cek status tagihan\n• *ubahpaket* - Ubah paket langganan\n\n🔧 *PENGATURAN WIFI*\n• *gantinama* - Ubah nama WiFi\n• *gantisandi* - Ubah password WiFi\n• *cekwifi* - Info WiFi Anda\n• *reboot* - Restart modem\n\n📞 *BANTUAN*\n• *admin* - Hubungi admin\n• *bantuan* - Panduan lengkap\n\n━━━━━━━━━━━━━━━━━━━\n_${nama_bot} - Siap membantu Anda 24/7_"
  }
}
```

#### **2. Create error_templates.json:**
```json
{
  "pelanggan_not_found": {
    "name": "Pelanggan Not Found",
    "template": "Maaf Kak ${pushname}, pelanggan dengan ID \"${id}\" tidak ditemukan."
  },
  "not_registered": {
    "name": "Not Registered",
    "template": "Maaf Kak ${pushname}, nomor Anda belum terdaftar sebagai pelanggan. Silakan hubungi admin untuk pendaftaran."
  },
  "feature_unavailable": {
    "name": "Feature Unavailable",
    "template": "Maaf Kak ${pushname}, fitur ${feature} saat ini hanya tersedia untuk ${requirement}."
  },
  "invalid_format": {
    "name": "Invalid Format",
    "template": "⚠️ Format salah!\n\nFormat yang benar:\n${format}\n\nContoh:\n${example}"
  },
  "permission_denied": {
    "name": "Permission Denied",  
    "template": "🚫 Maaf Kak ${pushname}, Anda tidak memiliki akses untuk menggunakan perintah ini."
  }
}
```

#### **3. Create success_templates.json:**
```json
{
  "wifi_name_changed": {
    "name": "WiFi Name Changed Success",
    "template": "✅ *BERHASIL MENGGANTI NAMA WIFI*\n\n📋 Detail:\n• Pelanggan: ${nama_pelanggan}\n• SSID: ${ssid_name}\n• Nama Lama: ${old_name}\n• Nama Baru: ${new_name}\n\n_Perubahan akan aktif dalam 1-2 menit._"
  },
  "wifi_password_changed": {
    "name": "WiFi Password Changed Success",
    "template": "✅ *BERHASIL MENGGANTI PASSWORD WIFI*\n\n📋 Detail:\n• Pelanggan: ${nama_pelanggan}\n• SSID: ${ssid_name}\n• Password Baru: ${new_password}\n\n⚠️ *PENTING:* Silakan reconnect semua perangkat dengan password baru."
  },
  "reboot_success": {
    "name": "Reboot Success",
    "template": "✅ *MODEM BERHASIL DI-RESTART*\n\n📋 Detail:\n• Pelanggan: ${nama_pelanggan}\n• Device: ${device_id}\n\nModem akan restart dalam 1-2 menit. Koneksi akan terputus sementara."
  }
}
```

#### **4. Create ticket_templates.json:**
```json
{
  "cek_tiket": {
    "name": "Check Ticket Status",
    "template": "📋 *INFORMASI TIKET GANGGUAN*\n\n━━━━━━━━━━━━━━━━\n🎫 *ID Tiket:* ${ticket_id}\n📅 *Tanggal:* ${tanggal}\n━━━━━━━━━━━━━━━━\n\n👤 *DATA PELANGGAN:*\n• Nama: ${nama_pelanggan}\n• Layanan: ${layanan}\n\n📝 *LAPORAN:*\n${laporan}\n\n📊 *STATUS SAAT INI:*\n${status_detail}\n\n💬 ${pesan_tambahan}\n\n━━━━━━━━━━━━━━━━\n_${nama_bot} - ${nama_wifi}_"
  },
  "tiket_not_found": {
    "name": "Ticket Not Found",
    "template": "🚫 Maaf Kak ${pushname}, tiket dengan ID \"*${ticket_id}*\" tidak ditemukan di sistem kami.\n\nPastikan ID Tiket yang Anda masukkan sudah benar, atau hubungi Admin jika Anda yakin tiket tersebut ada."
  }
}
```

---

## 📋 **IMPLEMENTATION PLAN**

### **Phase 1: Create Template Infrastructure**

#### **1. Create Template Loader (lib/template-loader.js):**
```javascript
const fs = require('fs');
const path = require('path');

class TemplateManager {
    constructor() {
        this.templates = {};
        this.loadAllTemplates();
    }
    
    loadAllTemplates() {
        const templateFiles = [
            'message_templates.json',
            'wifi_menu_templates.json',
            'wifi_templates.json',
            'response_templates.json',
            'command_templates.json',    // NEW
            'error_templates.json',       // NEW
            'success_templates.json',     // NEW
            'ticket_templates.json'       // NEW
        ];
        
        templateFiles.forEach(file => {
            const filePath = path.join(__dirname, '..', 'database', file);
            if (fs.existsSync(filePath)) {
                const content = fs.readFileSync(filePath, 'utf8');
                const templates = JSON.parse(content);
                Object.assign(this.templates, templates);
            }
        });
    }
    
    getTemplate(key, data = {}) {
        const template = this.templates[key];
        if (!template) {
            console.warn(`Template '${key}' not found`);
            return null;
        }
        
        return this.renderTemplate(template.template || template, data);
    }
    
    renderTemplate(template, data) {
        // Add global data
        const fullData = {
            nama_wifi: global.config.nama,
            nama_bot: global.config.namabot,
            ...data
        };
        
        // Replace placeholders
        return template.replace(/\$\{([^}]+)\}/g, (match, key) => {
            return fullData[key] || match;
        });
    }
}

module.exports = new TemplateManager();
```

### **Phase 2: Update All Handlers**

#### **Example: Update utility-handler.js:**
```javascript
const templateManager = require('../../lib/template-loader');

function handleBantuan(pushname, config, reply) {
    const message = templateManager.getTemplate('bantuan', {
        pushname: pushname
    });
    reply(message);
}

function handleSapaanUmum(pushname, reply) {
    const hour = new Date().getHours();
    let greeting = "";
    
    if (hour >= 0 && hour < 12) {
        greeting = "Selamat pagi";
    } else if (hour >= 12 && hour < 15) {
        greeting = "Selamat siang";
    } else if (hour >= 15 && hour < 18) {
        greeting = "Selamat sore";
    } else {
        greeting = "Selamat malam";
    }
    
    const message = templateManager.getTemplate('sapaan_umum', {
        greeting: greeting,
        pushname: pushname
    });
    reply(message);
}
```

---

## 📊 **BENEFITS**

### **1. Centralized Management**
- All messages in database/*.json files
- Easy to edit without touching code
- Version control friendly

### **2. Consistency**
- Same formatting across all messages
- Consistent placeholder usage
- Standardized error/success patterns

### **3. Customization**
- Admin can edit via dashboard
- Real-time updates without restart
- Multi-language support possible

### **4. Maintainability**
- Less code duplication
- Easier to debug
- Clear separation of concerns

---

## 🚨 **PRIORITY ORDER**

### **HIGH Priority (Most Used):**
1. ✅ Menu commands
2. ❌ Bantuan/Help
3. ❌ Error messages
4. ❌ Success confirmations

### **MEDIUM Priority:**
5. ❌ Ticket status messages
6. ❌ WiFi management responses
7. ❌ Billing/payment messages

### **LOW Priority:**
8. ❌ Admin/teknisi specific messages
9. ❌ Debug/logging messages

---

## 📈 **METRICS**

### **Current State:**
- Templates: ~20 messages
- Hardcoded: ~350+ messages
- Coverage: ~5%

### **Target State:**
- Templates: 370+ messages
- Hardcoded: 0 (only dynamic)
- Coverage: 100%

---

## 🎯 **ACTION ITEMS**

1. **Immediate:**
   - Create 4 new template JSON files
   - Implement TemplateManager class
   - Update high-priority handlers

2. **Short-term:**
   - Migrate all handlers to use templates
   - Add template editing UI
   - Create template documentation

3. **Long-term:**
   - Multi-language support
   - Template versioning
   - A/B testing capabilities

---

## 📝 **CONCLUSION**

The current system has **95% of messages hardcoded**, making customization impossible without code changes. A comprehensive template system is urgently needed for consistency, maintainability, and user customization.
