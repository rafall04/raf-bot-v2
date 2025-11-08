# 📋 **PLACEHOLDER STANDARDIZATION**

**Date:** 8 November 2025  
**Version:** 1.0  
**Status:** AUTHORITATIVE REFERENCE

---

## ⚠️ **CRITICAL: USE THESE EXACT PLACEHOLDER NAMES**

This document defines the OFFICIAL placeholder naming convention for all templates in the RAF Bot system. All templates MUST use these exact names for consistency.

---

## 📌 **PRIMARY PLACEHOLDERS**

### **1. IDENTITAS SISTEM**
| Placeholder | Description | Example | Usage |
|------------|-------------|---------|-------|
| `${nama_wifi}` | Nama provider WiFi | "RAF WiFi" | Semua referensi ke nama layanan |
| `${nama_bot}` | Nama bot WhatsApp | "RAF Bot" | Semua referensi ke nama bot |

### **2. IDENTITAS USER**
| Placeholder | Description | Example | Usage |
|------------|-------------|---------|-------|
| `${nama_pelanggan}` | Nama pelanggan dari database | "Andi Pratama" | Untuk menyebut nama pelanggan |
| `${pushname}` | WhatsApp display name | "Andi" | Untuk sapaan informal |
| `${username}` | Username sistem | "andi123" | Untuk login/kredensial |
| `${phone}` | Nomor telepon bersih | "6285233047094" | Nomor tanpa @s.whatsapp.net |
| `${sender}` | Full WhatsApp ID | "6285233047094@s.whatsapp.net" | ID lengkap WhatsApp |

### **3. PAKET & TAGIHAN**
| Placeholder | Description | Example | Usage |
|------------|-------------|---------|-------|
| `${nama_paket}` | Nama paket internet | "2 Mbps" | Untuk menyebut paket |
| `${harga}` | Harga raw | "150000" | Untuk kalkulasi |
| `${harga_formatted}` | Harga terformat | "Rp 150.000" | Untuk display |
| `${periode}` | Periode tagihan | "November 2025" | Untuk periode |
| `${jatuh_tempo}` | Tanggal jatuh tempo | "25 November 2025" | Untuk deadline |

### **4. TIKET & LAPORAN**
| Placeholder | Description | Example | Usage |
|------------|-------------|---------|-------|
| `${ticket_id}` | ID tiket | "TKT-2025-001" | Untuk referensi tiket |
| `${nama_teknisi}` | Nama teknisi | "Budi" | Untuk menyebut teknisi |
| `${status_tiket}` | Status tiket | "Diproses" | Untuk status |

### **5. WIFI & TEKNIS**
| Placeholder | Description | Example | Usage |
|------------|-------------|---------|-------|
| `${ssid}` | Nama WiFi (SSID) | "WiFi_Rumah" | Nama jaringan WiFi |
| `${password_wifi}` | Password WiFi | "Pass123" | Password WiFi |
| `${ip_address}` | Alamat IP | "192.168.1.10" | IP pelanggan |
| `${mac_address}` | MAC Address | "00:11:22:33:44:55" | MAC modem |

### **6. WAKTU & TANGGAL**
| Placeholder | Description | Example | Usage |
|------------|-------------|---------|-------|
| `${tanggal}` | Tanggal saat ini | "8 November 2025" | Tanggal umum |
| `${waktu}` | Waktu saat ini | "14:30 WIB" | Waktu umum |
| `${timestamp}` | Timestamp lengkap | "8 Nov 2025, 14:30:45" | Timestamp detail |

---

## ❌ **DEPRECATED PLACEHOLDERS - DO NOT USE**

| OLD | NEW | Reason |
|-----|-----|--------|
| `${nama}` | `${nama_pelanggan}` | Ambiguous - tidak jelas nama apa |
| `${namabot}` | `${nama_bot}` | Inconsistent naming |
| `${paket}` | `${nama_paket}` | More descriptive |
| `${telp}` | `${phone}` | Standardized to English |

---

## 🔄 **MIGRATION RULES**

When updating templates, replace:
1. `${nama}` → `${nama_pelanggan}` (untuk pelanggan)
2. `${nama}` → `${nama_wifi}` (untuk provider)
3. `${namabot}` → `${nama_bot}`
4. `${paket}` → `${nama_paket}`

---

## 📝 **USAGE EXAMPLES**

### ✅ **CORRECT:**
```
Halo ${pushname}, terima kasih telah menggunakan ${nama_wifi}!
Tagihan ${nama_pelanggan} untuk paket ${nama_paket} sebesar ${harga_formatted}.
${nama_bot} siap membantu Anda 24/7.
```

### ❌ **WRONG:**
```
Halo ${nama}, terima kasih telah menggunakan ${nama}!  // Ambiguous
Tagihan ${nama} untuk paket ${paket} sebesar ${harga}.  // Old placeholders
${namabot} siap membantu Anda 24/7.  // Inconsistent
```

---

## 🎯 **IMPLEMENTATION CHECKLIST**

### **Files to Update:**
- [ ] message_templates.json
- [ ] wifi_menu_templates.json  
- [ ] response_templates.json
- [ ] command_templates.json
- [ ] error_templates.json
- [ ] success_templates.json
- [ ] wifi_templates.json

### **Validation:**
- [ ] No more ${nama} alone (must specify what nama)
- [ ] All bot references use ${nama_bot}
- [ ] All WiFi service references use ${nama_wifi}
- [ ] All customer references use ${nama_pelanggan}
- [ ] Admin panel shows placeholder documentation

---

## 📚 **FOR ADMIN PANEL**

Add this documentation to templates.php so admins know which placeholders to use:

```html
<div class="placeholder-docs">
  <h5>Available Placeholders:</h5>
  <ul>
    <li><code>${nama_wifi}</code> - Nama layanan WiFi</li>
    <li><code>${nama_bot}</code> - Nama bot</li>
    <li><code>${nama_pelanggan}</code> - Nama pelanggan</li>
    <li><code>${pushname}</code> - Nama WhatsApp user</li>
    <li><code>${nama_paket}</code> - Nama paket internet</li>
    <li><code>${harga_formatted}</code> - Harga terformat</li>
    <!-- ... more placeholders ... -->
  </ul>
</div>
```

---

## ⚡ **QUICK REFERENCE**

```
System:     ${nama_wifi}, ${nama_bot}
User:       ${nama_pelanggan}, ${pushname}, ${username}
Billing:    ${nama_paket}, ${harga_formatted}, ${periode}
Ticket:     ${ticket_id}, ${nama_teknisi}, ${status_tiket}
WiFi:       ${ssid}, ${password_wifi}
Time:       ${tanggal}, ${waktu}, ${timestamp}
```

---

**REMEMBER:** Consistency is key! Always use the standardized placeholder names to avoid confusion.
