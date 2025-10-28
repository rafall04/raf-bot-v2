# 🔍 Handler Analysis - Customizable Commands

**Date:** 2025-10-20  
**Purpose:** Analisis semua handler untuk memastikan command utama bisa dikustomisasi via database  

---

## 📊 CURRENT STATUS

### **✅ ALREADY CUSTOMIZABLE (via wifi_templates.json)**

Commands yang sudah bisa dikustomisasi di database:

| Intent | Category | Aliases (di DB) | Handler |
|--------|----------|-----------------|---------|
| **HISTORY_WIFI** | wifi | 12 keywords | handleWifiHistory |
| **INFO_WIFI** | wifi | 9 keywords | handleQuickWifiInfo |
| **GANTI_SANDI_WIFI** | wifi | 29 keywords | handleWifiPasswordChange |
| **GANTI_NAMA_WIFI** | wifi | 16 keywords | handleWifiNameChange |
| **CEK_WIFI** | wifi | 13 keywords | handleWifiInfoCheck |
| **REBOOT_MODEM** | wifi | 5 keywords | handleRouterReboot |
| **LAPOR_GANGGUAN** | support | 17 keywords | handleReportCreation |
| **CEK_TAGIHAN** | customer | 7 keywords | handleCheckBill |
| **TANYA_PAKET_BULANAN** | customer | 7 keywords | handleServiceInfo |
| **CEK_SALDO** | saldo | 5 keywords | handleCekSaldo |
| **TANYA_HARGA_VOUCHER** | voucher | 5 keywords | handleServiceInfo |
| **UBAH_PAKET** | customer | 6 keywords | - |
| **BANTUAN** | help | 7 keywords | - |
| **SAPAAN_UMUM** | greeting | 18 keywords | - |

**Total:** 14 commands customizable ✅

---

### **❌ NOT CUSTOMIZABLE (Hardcoded in raf.js)**

Commands yang masih hardcoded dan **PERLU** ditambahkan ke database:

#### **Admin/Teknisi Commands:**

| Hardcoded Case | Current Aliases | Category | Handler | Priority |
|----------------|-----------------|----------|---------|----------|
| `statusppp` | statusppp | admin | handlePppStats | HIGH |
| `statushotspot` | statushotspot | admin | handleHotspotStats | HIGH |
| `statusap` | statusap | admin | handleApStats | HIGH |
| `alluser` | alluser | admin | inline | MEDIUM |
| `tiketdone` | tiketdone | admin | handleTicketCompletion | HIGH |

#### **Customer Commands:**

| Hardcoded Case | Current Aliases | Category | Handler | Priority |
|----------------|-----------------|----------|---------|----------|
| `CEK_SALDO` | saldo, ceksaldo, cek saldo, infosaldo | saldo | handleCekSaldo | **CRITICAL** |
| `TOPUP_SALDO` | topup, top up, isi saldo, tambah saldo | saldo | handleTopupInit | **CRITICAL** |
| `topup saldo` | topup saldo | saldo | handleTopupInit | **CRITICAL** |
| `batal topup` | batal topup, cancel topup | saldo | handleCancelTopup | HIGH |
| `beli voucher` | beli voucher, belivoucher, buy voucher | voucher | handleBeliVoucher | HIGH |
| `transfer` | transfer [nomor] [jumlah] | saldo | handleTransferSaldo | HIGH |
| `CEK_TIKET` | cektiket [ID] | support | handleTicketStatus | **CRITICAL** |
| `BATALKAN_TIKET` | bataltiket [ID] | support | handleTicketCancellation | HIGH |
| `CEK_PAKET` | - | customer | handleCheckPackage | **CRITICAL** |
| `KELUHAN_SARAN` | - | customer | handleComplaint | HIGH |
| `INFO_LAYANAN` | - | customer | handleServiceInfo | MEDIUM |

#### **Agent Commands:**

| Hardcoded Case | Current Aliases | Category | Handler | Priority |
|----------------|-----------------|----------|---------|----------|
| `agent` | agent, agen, outlet, daftar agent, list agent | agent | handleListAgents | **CRITICAL** |
| `layanan agent` | layanan agent, agent service, layanan | agent | handleAgentServices | HIGH |
| `cari agent` | cari agent, search agent, cari agen | agent | handleSearchAgent | HIGH |
| `konfirmasi` | konfirmasi, confirm, konfirmasi topup | agent | handleAgentConfirmation | **CRITICAL** |
| `transaksi hari ini` | transaksi hari ini, transaksi hariini, today transactions, transaksi | agent | handleAgentTodayTransactions | HIGH |
| `ganti pin` | ganti pin | agent | handleAgentPinChange | MEDIUM |
| `update alamat` | update alamat | agent | handleAgentProfileUpdate | MEDIUM |
| `update jam` | update jam | agent | handleAgentProfileUpdate | MEDIUM |
| `update phone` | update phone, update telepon | agent | handleAgentProfileUpdate | MEDIUM |
| `tutup sementara` | tutup sementara, close temporarily | agent | handleAgentStatusToggle | MEDIUM |
| `buka kembali` | buka kembali, open again | agent | handleAgentStatusToggle | MEDIUM |
| `profil agent` | profil agent, info agent, agent info | agent | handleAgentSelfProfile | MEDIUM |

#### **Menu Commands:**

| Hardcoded Case | Current Aliases | Category | Handler | Priority |
|----------------|-----------------|----------|---------|----------|
| `MENU_UTAMA` | help, menu wifi, menuwifi | menu | wifimenu | HIGH |
| `MENU_PELANGGAN` | menupelanggan | menu | customermenu | MEDIUM |
| `MENU_TEKNISI` | - | menu | techinisionmenu | MEDIUM |
| `MENU_OWNER` | - | menu | menuowner | LOW |

#### **Speed Boost Commands:**

| Hardcoded Case | Current Aliases | Category | Handler | Priority |
|----------------|-----------------|----------|---------|----------|
| `STATUS_SPEED` | cekspeed, statusboost, statusspeed | speedboost | handleSpeedRequestStatus | HIGH |
| `REQUEST_SPEED_BOOST` | speedboost, requestspeed, requestboost | speedboost | handleSpeedBoostRequest | HIGH |
| `CLEAR_SPEED_BOOST` | - | admin | clearSpeedBoostStatus | LOW |

#### **Power WiFi:**

| Hardcoded Case | Current Aliases | Category | Handler | Priority |
|----------------|-----------------|----------|---------|----------|
| `GANTI_POWER_WIFI` | ganti power wifi, ubah kekuatan wifi | wifi | handleWifiPowerChange | MEDIUM |

#### **Others:**

| Hardcoded Case | Current Aliases | Category | Handler | Priority |
|----------------|-----------------|----------|---------|----------|
| `MULAI_BERTANYA` | - | conversation | - | LOW |
| `TANYA_JAWAB_UMUM` | - | conversation | getConversationalResponse | LOW |

**Total Hardcoded:** ~40+ commands ❌

---

## 🎯 RECOMMENDATION

### **Priority 1: CRITICAL (Must Add to Database)**

These commands are frequently used and should be customizable:

1. **CEK_SALDO** - Already has multiple aliases in code
2. **TOPUP_SALDO** - Core saldo feature
3. **CEK_TIKET** - Core support feature
4. **CEK_PAKET** - Core customer feature
5. **agent/agen/outlet** - Core agent feature
6. **konfirmasi** - Critical for agent transactions

### **Priority 2: HIGH (Should Add to Database)**

7. **statusppp** - Admin feature
8. **statushotspot** - Admin feature
9. **statusap** - Admin feature
10. **tiketdone** - Admin feature
11. **BATALKAN_TIKET** - Support feature
12. **batal topup** - Saldo feature
13. **beli voucher** - Voucher feature
14. **transfer** - Saldo feature
15. All other agent commands (layanan agent, cari agent, dll)

### **Priority 3: MEDIUM (Nice to Have)**

16. Menu commands
17. Agent profile management
18. Speed boost commands

---

## 📋 MIGRATION PLAN

### **Step 1: Add Missing Commands to wifi_templates.json**

Add ~40 new template entries with categories:

```json
[
  {
    "keywords": ["cek saldo", "saldo", "ceksaldo", "cek saldo", "infosaldo", "info saldo", "saldo saya"],
    "intent": "CEK_SALDO",
    "category": "saldo",
    "description": "Cek saldo akun",
    "icon": "💳"
  },
  {
    "keywords": ["topup", "top up", "isi saldo", "tambah saldo", "topup saldo"],
    "intent": "TOPUP_SALDO",
    "category": "saldo",
    "description": "Topup/isi saldo akun",
    "icon": "💰"
  },
  {
    "keywords": ["cek tiket", "cektiket", "status tiket", "tiket saya"],
    "intent": "CEK_TIKET",
    "category": "support",
    "description": "Cek status tiket laporan",
    "icon": "🎫"
  },
  {
    "keywords": ["agent", "agen", "outlet", "daftar agent", "list agent"],
    "intent": "LIST_AGENT",
    "category": "agent",
    "description": "Lihat daftar agent/outlet",
    "icon": "🏪"
  },
  // ... dan seterusnya untuk semua command
]
```

### **Step 2: Remove Hardcoded Cases from raf.js**

Replace hardcoded multi-case blocks:

**BEFORE:**
```javascript
case 'saldo':
case 'ceksaldo':
case 'cek saldo':
case 'infosaldo':
case 'info saldo':
case 'saldo saya': {
    await handleCekSaldo(msg, sender, reply);
    break;
}
```

**AFTER:**
```javascript
case 'CEK_SALDO': {
    await handleCekSaldo(msg, sender, reply);
    break;
}
```

Aliases akan di-handle oleh wifi_template_handler.js yang sudah auto-reload.

### **Step 3: Update Categories**

Add new categories if needed:

```json
{
  "categories": [
    { "id": "admin", "name": "Admin/Teknisi", "icon": "👨‍💼" },
    { "id": "agent", "name": "Agent/Outlet", "icon": "🏪" },
    { "id": "speedboost", "name": "Speed Boost", "icon": "⚡" },
    { "id": "conversation", "name": "Conversation", "icon": "💬" }
  ]
}
```

---

## ✅ BENEFITS

### **After Migration:**

1. ✅ **All commands customizable** via web UI
2. ✅ **No code changes** untuk add/edit keywords
3. ✅ **Auto-reload** - changes instant
4. ✅ **Better organization** - all in one place
5. ✅ **Consistent** - same pattern for all commands
6. ✅ **Easier maintenance** - single source of truth

### **Current Issues with Hardcoding:**

1. ❌ **Need code edit** untuk add alias baru
2. ❌ **Need deployment** untuk changes
3. ❌ **Scattered logic** - hard to find
4. ❌ **Inconsistent** - some in DB, some in code
5. ❌ **Hard to manage** - 40+ hardcoded cases

---

## 📊 STATISTICS

**Current State:**
- ✅ Customizable: 14 commands (26%)
- ❌ Hardcoded: 40+ commands (74%)

**Target State:**
- ✅ Customizable: 54+ commands (100%)
- ❌ Hardcoded: 0 commands (0%)

**Effort Required:**
- Add ~40 entries to wifi_templates.json
- Clean up ~40 hardcoded case blocks in raf.js
- Estimated time: 2-3 hours

---

## 🚀 IMPLEMENTATION STEPS

### **Step 1: Backup Current State**
```bash
cp database/wifi_templates.json database/wifi_templates.json.backup
cp message/raf.js message/raf.js.backup
```

### **Step 2: Add All Missing Commands to Database**

Create complete wifi_templates.json with all ~54 commands organized by category:
- wifi (7 commands)
- customer (5 commands)
- support (3 commands)
- saldo (5 commands)
- voucher (2 commands)
- agent (12 commands)
- admin (5 commands)
- menu (4 commands)
- speedboost (3 commands)
- help (1 command)
- greeting (1 command)
- conversation (2 commands)

### **Step 3: Clean Up raf.js**

Remove all multi-case alias blocks, keep only main intent:
- From ~800 lines of cases
- To ~200 lines of cases
- 75% code reduction

### **Step 4: Test All Commands**

Test every command to ensure:
- ✅ Keywords recognized
- ✅ Handler called correctly
- ✅ Same functionality
- ✅ No breaking changes

### **Step 5: Update Documentation**

Update guides to reflect all commands now manageable via UI.

---

## 🎯 CONCLUSION

**Current Status:** ❌ **Only 26% customizable**

**Target Status:** ✅ **100% customizable**

**Recommendation:** 
Migrate ALL command keywords to wifi_templates.json for:
- Consistent management
- No code changes needed
- Better user experience
- Easier maintenance

**Next Action:**
Would you like me to:
1. ✅ Create complete wifi_templates.json with all 54 commands?
2. ✅ Clean up raf.js to remove hardcoded cases?
3. ✅ Test the migration?

---

**Created:** 2025-10-20  
**Priority:** HIGH  
**Impact:** Significant improvement in maintainability  
**Effort:** 2-3 hours  
**Risk:** Low (can rollback easily)
