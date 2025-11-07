# 📖 **PLACEHOLDER DOCUMENTATION**

**Version:** 2.0  
**Date:** 8 November 2025  
**Status:** ✅ **STANDARDIZED**

---

## 📋 **STANDARDIZED PLACEHOLDER NAMING CONVENTION**

All placeholders follow a clear, consistent naming pattern to avoid confusion.

---

## 🏢 **PROVIDER/COMPANY INFORMATION**

| Placeholder | Description | Example Value | Source |
|-------------|-------------|---------------|--------|
| `${nama_wifi}` | WiFi provider/company name | "RAF Net" | `config.nama` |
| `${nama_bot}` | Bot assistant name | "RAF Bot" | `config.namabot` |
| `${nama_layanan}` | Service name | "Layanan WiFi Premium" | `config.nama` |
| `${telfon}` | Company phone number | "089685645956" | `config.telfon` |
| `${rekening}` | Bank account info | "BCA: 1234567890" | `config.rekening` |

---

## 👤 **CUSTOMER INFORMATION**

| Placeholder | Description | Example Value | Source |
|-------------|-------------|---------------|--------|
| `${nama_pelanggan}` | Customer full name | "Budi Santoso" | `user.name` |
| `${nama}` | Customer name (short) | "Budi" | `user.name` |
| `${pushname}` | WhatsApp display name | "Budi" | WhatsApp |
| `${phone_pelanggan}` | Customer phone | "6285233047094" | `user.phone_number` |
| `${id_pelanggan}` | Customer ID | "123" | `user.id` |
| `${alamat}` | Customer address | "Jl. Merdeka No. 10" | `user.address` |

---

## 📦 **PACKAGE INFORMATION**

| Placeholder | Description | Example Value | Source |
|-------------|-------------|---------------|--------|
| `${nama_paket}` | Package name | "Paket 10Mbps" | `user.subscription` |
| `${paket}` | Package name (short) | "10Mbps" | `user.subscription` |
| `${harga_paket}` | Package price | "Rp 150.000" | Formatted |
| `${harga}` | Price (auto-formatted) | "Rp 150.000" | `convertRupiah()` |
| `${speed_paket}` | Package speed | "10 Mbps" | Package data |
| `${periode}` | Billing period | "Januari 2025" | Current period |

---

## 🎫 **TICKET & TECHNICAL**

| Placeholder | Description | Example Value | Source |
|-------------|-------------|---------------|--------|
| `${ticketId}` | Ticket ID | "ABC123XYZ" | Generated |
| `${ticket_id}` | Ticket ID (alt) | "ABC123XYZ" | Generated |
| `${otp}` | OTP verification code | "123456" | Generated |
| `${device_id}` | Device/Modem ID | "00259E-HG8145V5" | `user.device_id` |
| `${pppoe}` | PPPoE username | "user123@rafnet" | `user.pppoe_username` |
| `${username}` | Login username | "budi123" | `user.username` |
| `${password}` | Login password | "********" | `user.password` |
| `${redaman}` | Signal attenuation | "-25 dBm" | Device data |

---

## 📅 **DATE & TIME**

| Placeholder | Description | Example Value | Format |
|-------------|-------------|---------------|--------|
| `${tanggal}` | Current date | "8 November 2025" | DD MMMM YYYY |
| `${waktu}` | Current time | "14:30" | HH:mm |
| `${jatuh_tempo}` | Due date | "10 November 2025" | DD MMMM YYYY |
| `${tanggal_akhir}` | End date | "30 November 2025" | DD MMMM YYYY |
| `${durasiLengkap}` | Full duration | "3 Hari" | Text |
| `${expirationDate}` | Expiry date | "15/11/2025" | DD/MM/YYYY |

---

## 💰 **FINANCIAL**

| Placeholder | Description | Example Value | Format |
|-------------|-------------|---------------|--------|
| `${saldo}` | Account balance | "50000" | Number |
| `${formattedSaldo}` | Formatted balance | "Rp 50.000" | Currency |
| `${totalRevenue}` | Total revenue | "Rp 15.000.000" | Currency |
| `${nominal}` | Transaction amount | "100000" | Number |
| `${sisa_saldo}` | Remaining balance | "Rp 25.000" | Currency |

---

## 📡 **WIFI MANAGEMENT**

| Placeholder | Description | Example Value | Source |
|-------------|-------------|---------------|--------|
| `${nama_wifi_baru}` | New WiFi name | "MyHomeWiFi" | User input |
| `${ssidName}` | SSID name | "RAF_NET_5G" | Device |
| `${selectedSsidId}` | Selected SSID ID | "ssid-1" | Selection |
| `${ssidList}` | SSID list | "1. Main\n2. Guest" | Generated |
| `${newPassword}` | New password | "********" | User input |

---

## 🚀 **SPEED & COMPENSATION**

| Placeholder | Description | Example Value | Source |
|-------------|-------------|---------------|--------|
| `${originalPackageName}` | Original package | "10Mbps" | Before change |
| `${requestedPackageName}` | Requested package | "20Mbps" | User request |
| `${profileBaru}` | New profile | "Profile-20M" | New setting |
| `${profileAsli}` | Original profile | "Profile-10M" | Original |
| `${tanggalRevert}` | Revert date | "15/11/2025" | Scheduled |

---

## 📋 **DYNAMIC LISTS & MISC**

| Placeholder | Description | Example Value | Usage |
|-------------|-------------|---------------|--------|
| `${list}` | Dynamic list | "• Item 1\n• Item 2" | Various |
| `${menu}` | Menu content | Full menu text | Menus |
| `${pesan}` | Custom message | User message | Messages |
| `${alasan}` | Reason text | "Internet lambat" | Reports |
| `${targetUserName}` | Target user | "Ahmad" | Admin ops |

---

## ⚠️ **BACKWARD COMPATIBILITY**

For backward compatibility, the following mappings are maintained:

| Old Placeholder | Maps To | Recommended |
|-----------------|---------|-------------|
| `${nama}` in menus | `${nama_wifi}` | Use `${nama_wifi}` |
| `${namabot}` | `${nama_bot}` | Use `${nama_bot}` |

---

## 🔧 **USAGE EXAMPLES**

### **Welcome Message:**
```
WRONG: "Selamat datang di ${nama}!"  // Ambiguous
RIGHT: "Selamat datang di ${nama_wifi}!"  // Clear
```

### **Personal Greeting:**
```
RIGHT: "Halo ${nama_pelanggan}, tagihan Anda bulan ini..."
```

### **Mixed Usage:**
```
"Terima kasih ${nama_pelanggan} telah menggunakan layanan ${nama_wifi}. 
Untuk bantuan, hubungi ${nama_bot} di ${telfon}."
```

---

## 📝 **BEST PRACTICES**

1. **Be Specific:** Use descriptive placeholder names
   - ✅ `${nama_pelanggan}` instead of ❌ `${nama}`
   - ✅ `${nama_wifi}` instead of ❌ `${nama}`

2. **Consistency:** Same placeholder = same meaning everywhere

3. **Documentation:** Always document new placeholders

4. **Validation:** Check for unmatched placeholders in logs

5. **Testing:** Test templates with real data

---

## 🎯 **IMPLEMENTATION STATUS**

| Component | Status | Notes |
|-----------|--------|-------|
| message/wifi.js | ✅ Updated | Supports both old & new |
| lib/templating.js | ✅ Compatible | Has validation |
| wifi_menu_templates.json | ⚠️ Needs update | Use new placeholders |
| message_templates.json | ⚠️ Check needed | Verify consistency |
| response_templates.json | ⚠️ Check needed | Verify consistency |

---

## 📚 **FOR DEVELOPERS**

When adding new placeholders:

1. Follow naming convention: `${category_description}`
2. Add to this documentation
3. Update templates.php UI
4. Test with actual data
5. Check for warnings in console

Example categories:
- `nama_*` for names
- `tanggal_*` for dates
- `harga_*` for prices
- `status_*` for statuses
- `total_*` for totals

---

## 🔍 **TROUBLESHOOTING**

**Placeholder not replaced?**
1. Check console for warnings
2. Verify data is provided
3. Check placeholder spelling
4. Ensure proper escaping in regex

**Wrong value shown?**
1. Check data source
2. Verify mapping in code
3. Check for overrides

---

**This documentation is the authoritative reference for all placeholder usage in RAF Bot v2.**
