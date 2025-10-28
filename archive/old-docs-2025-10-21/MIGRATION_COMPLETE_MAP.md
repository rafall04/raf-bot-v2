# ✅ Command Migration - Complete Mapping

**Date:** 2025-10-20  
**Status:** Database Migration Complete  
**Next Step:** Clean up raf.js  

---

## 📊 MIGRATION SUMMARY

### **BEFORE Migration:**
- **Customizable:** 14 commands (26%)
- **Hardcoded:** 40+ commands (74%)
- **Total cases in raf.js:** ~800 lines

### **AFTER Migration:**
- **Customizable:** 49 commands (100%)
- **Hardcoded:** 0 commands (0%)
- **Total templates in DB:** 49
- **Categories:** 11

**Code Reduction Target:** -600 lines from raf.js (75%)

---

## 🎯 ALL 49 COMMANDS NOW IN DATABASE

### **WiFi Management (7 commands):**
1. ✅ HISTORY_WIFI - 12 keywords
2. ✅ INFO_WIFI - 9 keywords
3. ✅ GANTI_SANDI_WIFI - 29 keywords
4. ✅ GANTI_NAMA_WIFI - 16 keywords
5. ✅ CEK_WIFI - 13 keywords
6. ✅ REBOOT_MODEM - 5 keywords
7. ✅ GANTI_POWER_WIFI - 5 keywords ← **NEW**

### **Customer Service (6 commands):**
8. ✅ CEK_TAGIHAN - 7 keywords
9. ✅ TANYA_PAKET_BULANAN - 7 keywords
10. ✅ UBAH_PAKET - 6 keywords
11. ✅ CEK_PAKET - 4 keywords ← **NEW**
12. ✅ KELUHAN_SARAN - 4 keywords ← **NEW**
13. ✅ INFO_LAYANAN - 3 keywords ← **NEW**

### **Support & Laporan (4 commands):**
14. ✅ LAPOR_GANGGUAN (mati) - 10 keywords
15. ✅ LAPOR_GANGGUAN (lemot) - 7 keywords
16. ✅ CEK_TIKET - 4 keywords ← **NEW**
17. ✅ BATALKAN_TIKET - 4 keywords ← **NEW**

### **Saldo & Payment (5 commands):**
18. ✅ CEK_SALDO - 9 keywords (merged)
19. ✅ TOPUP_SALDO - 5 keywords ← **NEW**
20. ✅ BATAL_TOPUP - 3 keywords ← **NEW**
21. ✅ TRANSFER_SALDO - 1 keyword ← **NEW**
22. ✅ TANYA_HARGA_VOUCHER - 5 keywords

### **Voucher (1 command):**
23. ✅ BELI_VOUCHER - 4 keywords ← **NEW**

### **Agent/Outlet (12 commands):**
24. ✅ LIST_AGENT - 5 keywords ← **NEW**
25. ✅ LAYANAN_AGENT - 4 keywords ← **NEW**
26. ✅ CARI_AGENT - 3 keywords ← **NEW**
27. ✅ KONFIRMASI_AGENT - 3 keywords ← **NEW**
28. ✅ TRANSAKSI_HARI_INI - 4 keywords ← **NEW**
29. ✅ GANTI_PIN_AGENT - 1 keyword ← **NEW**
30. ✅ UPDATE_ALAMAT_AGENT - 1 keyword ← **NEW**
31. ✅ UPDATE_JAM_AGENT - 1 keyword ← **NEW**
32. ✅ UPDATE_PHONE_AGENT - 2 keywords ← **NEW**
33. ✅ TUTUP_SEMENTARA_AGENT - 2 keywords ← **NEW**
34. ✅ BUKA_KEMBALI_AGENT - 2 keywords ← **NEW**
35. ✅ PROFIL_AGENT - 3 keywords ← **NEW**

### **Admin/Teknisi (6 commands):**
36. ✅ STATUS_PPP - 1 keyword ← **NEW**
37. ✅ STATUS_HOTSPOT - 1 keyword ← **NEW**
38. ✅ STATUS_AP - 1 keyword ← **NEW**
39. ✅ ALL_USER - 1 keyword ← **NEW**
40. ✅ SELESAIKAN_TIKET - 2 keywords ← **NEW**
41. ✅ CLEAR_SPEED_BOOST - 1 keyword ← **NEW**

### **Menu (4 commands):**
42. ✅ MENU_UTAMA - 3 keywords ← **NEW**
43. ✅ MENU_PELANGGAN - 1 keyword ← **NEW**
44. ✅ MENU_TEKNISI - 1 keyword ← **NEW**
45. ✅ MENU_OWNER - 1 keyword ← **NEW**

### **Speed Boost (2 commands):**
46. ✅ STATUS_SPEED - 3 keywords ← **NEW**
47. ✅ REQUEST_SPEED_BOOST - 3 keywords ← **NEW**

### **Help (1 command):**
48. ✅ BANTUAN - 7 keywords

### **Greeting (1 command):**
49. ✅ SAPAAN_UMUM - 23 keywords

**Total:** 49 commands, 11 categories, 200+ keyword variations

---

## 📋 CLEANUP TARGETS IN RAF.JS

### **Cases to REMOVE (will be handled by DB):**

```javascript
// ❌ REMOVE: Saldo aliases (lines 893-900)
case 'CEK_SALDO':
case 'saldo':
case 'ceksaldo':
case 'cek saldo':
case 'infosaldo':
case 'info saldo':
case 'saldo saya':

// ❌ REMOVE: Topup aliases (lines 905-911)
case 'TOPUP_SALDO':
case 'topup':
case 'top up':
case 'isi saldo':
case 'tambah saldo':
case 'topup saldo':

// ❌ REMOVE: Agent aliases (lines 943-947)
case 'agent':
case 'agen':
case 'outlet':
case 'daftar agent':
case 'list agent':

// ❌ REMOVE: Greeting aliases (lines 826-833)
case 'hallo':
case 'halo':
case 'hi':
case 'hai':
case 'min':
case 'kak':
case 'mas':

// ❌ REMOVE: Menu aliases (lines 797-800)
case 'help':
case 'menu wifi':
case 'menuwifi':

// ... and 35+ more hardcoded multi-case blocks
```

### **Cases to KEEP (single case for main intent):**

```javascript
// ✅ KEEP: Single case for intent
case 'CEK_SALDO': {
    await handleCekSaldo(msg, sender, reply);
    break;
}

// ✅ KEEP: Single case for intent
case 'TOPUP_SALDO': {
    await handleTopupInit(...);
    break;
}

// ... etc for all 49 commands
```

**Cleanup Result:**
- **Remove:** ~600 lines of alias cases
- **Keep:** ~200 lines of main cases
- **Reduction:** 75% ✅

---

## 🔄 INTENT MAPPING (raf.js → database)

### **Direct Mapping (no change):**

| raf.js Case | DB Intent | Status |
|-------------|-----------|--------|
| GANTI_NAMA_WIFI | GANTI_NAMA_WIFI | ✅ Same |
| GANTI_SANDI_WIFI | GANTI_SANDI_WIFI | ✅ Same |
| CEK_WIFI | CEK_WIFI | ✅ Same |
| REBOOT_MODEM | REBOOT_MODEM | ✅ Same |
| CEK_TAGIHAN | CEK_TAGIHAN | ✅ Same |
| LAPOR_GANGGUAN | LAPOR_GANGGUAN | ✅ Same |

### **Renamed/New Intents:**

| raf.js Case | DB Intent | Change |
|-------------|-----------|--------|
| statusppp | STATUS_PPP | ✅ Renamed |
| statushotspot | STATUS_HOTSPOT | ✅ Renamed |
| statusap | STATUS_AP | ✅ Renamed |
| alluser | ALL_USER | ✅ Renamed |
| tiketdone | SELESAIKAN_TIKET | ✅ Renamed |
| agent/agen/outlet | LIST_AGENT | ✅ Unified |
| konfirmasi | KONFIRMASI_AGENT | ✅ Renamed |
| profil agent | PROFIL_AGENT | ✅ Renamed |
| ganti pin | GANTI_PIN_AGENT | ✅ Renamed |
| update alamat | UPDATE_ALAMAT_AGENT | ✅ Renamed |
| update jam | UPDATE_JAM_AGENT | ✅ Renamed |
| update phone | UPDATE_PHONE_AGENT | ✅ Renamed |
| tutup sementara | TUTUP_SEMENTARA_AGENT | ✅ Renamed |
| buka kembali | BUKA_KEMBALI_AGENT | ✅ Renamed |
| speedboost | REQUEST_SPEED_BOOST | ✅ Renamed |
| cekspeed | STATUS_SPEED | ✅ Renamed |

---

## ⚠️ CRITICAL: Cases Requiring Handler Updates

Some cases in raf.js will need intent name updates to match DB:

```javascript
// BEFORE (raf.js)
case 'statusppp': {
    // ...
}

// AFTER (raf.js)
case 'STATUS_PPP': {
    // ... same handler
}

// BEFORE (raf.js)  
case 'agent':
case 'agen':
case 'outlet':
case 'daftar agent':
case 'list agent': {
    await handleListAgents(...);
}

// AFTER (raf.js)
case 'LIST_AGENT': {
    await handleListAgents(...);
}
```

**Total cases needing rename:** 15 cases

---

## ✅ VERIFICATION CHECKLIST

**Database:**
- [x] All 49 commands added to wifi_templates.json
- [x] All aliases from raf.js preserved
- [x] No duplicate intents
- [x] JSON syntax valid
- [x] 11 categories defined
- [x] All have icons & descriptions

**Ready for Cleanup:**
- [ ] Update case names in raf.js (15 cases)
- [ ] Remove all alias cases (~40 blocks)
- [ ] Test all commands still work
- [ ] Verify no breaking changes
- [ ] Update documentation

---

## 🚀 NEXT STEPS

### **Step 1: Update Case Names in raf.js**
Change 15 case names to match DB intents (e.g., statusppp → STATUS_PPP)

### **Step 2: Remove Alias Cases**
Remove ~40 multi-case alias blocks, keep only main intent cases

### **Step 3: Test All Commands**
Test every command to ensure it still works with new setup

### **Step 4: Final Verification**
- Check no breaking changes
- Verify all handlers called correctly
- Test edge cases

---

## 📊 EXPECTED RESULTS

**Before Cleanup:**
```javascript
// ~800 lines of cases
switch (intent) {
    case 'saldo':
    case 'ceksaldo':
    case 'cek saldo':
    case 'CEK_SALDO': {
        // handler
    }
    // ... 48 more blocks like this
}
```

**After Cleanup:**
```javascript
// ~200 lines of cases
switch (intent) {
    case 'CEK_SALDO': {
        // handler
    }
    // ... 48 more single cases
}
```

**Benefits:**
- ✅ -600 lines code (75% reduction)
- ✅ All keywords customizable via UI
- ✅ No code changes for new aliases
- ✅ Auto-reload when keywords change
- ✅ Consistent pattern throughout

---

**Created:** 2025-10-20  
**Status:** Database Migration Complete ✅  
**Next:** Clean up raf.js  
**Risk:** Low (can rollback easily with backup)
