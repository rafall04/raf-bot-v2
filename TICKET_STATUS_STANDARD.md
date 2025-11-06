# TICKET STATUS STANDARD - SISTEM RAF BOT V2

## ⚠️ CRITICAL: Status HARUS KONSISTEN di SEMUA TEMPAT!

Dokumen ini mendefinisikan **STATUS GLOBAL** yang HARUS digunakan di seluruh sistem tanpa exception.

---

## 📊 **WORKFLOW STATUS (KONSISTEN & WAJIB)**

### **1. BARU** - Ticket Baru Dibuat
- **Keyword:** `"baru"`
- **Deskripsi:** Ticket baru dibuat, menunggu teknisi memproses
- **Digunakan di:**
  - Ticket creation (semua handlers)
  - Dashboard filter untuk ticket baru
  - Badge display
- **Next Status:** `"process"`

### **2. PROCESS** - Sedang Diproses Teknisi
- **Keyword:** `"process"` 
- **Alias:** `"diproses teknisi"` (untuk backward compatibility)
- **Deskripsi:** Teknisi mulai memproses ticket, OTP sudah digenerate
- **Digunakan di:**
  - API /api/ticket/process (set status ke "process")
  - Dashboard filter untuk ticket aktif
  - Badge display
- **Next Status:** `"otw"`

### **3. OTW** - Teknisi Dalam Perjalanan
- **Keyword:** `"otw"`
- **Deskripsi:** Teknisi sudah berangkat menuju lokasi
- **Digunakan di:**
  - API /api/ticket/otw
  - Dashboard filter untuk tracking
  - Badge display
- **Next Status:** `"arrived"`

### **4. ARRIVED** - Teknisi Sudah Sampai
- **Keyword:** `"arrived"`
- **Deskripsi:** Teknisi sudah tiba di lokasi, menunggu OTP dari customer
- **Digunakan di:**
  - API /api/ticket/arrived
  - Dashboard filter untuk tracking
  - Badge display
- **Next Status:** `"working"`

### **5. WORKING** - Sedang Mengerjakan
- **Keyword:** `"working"`
- **Deskripsi:** OTP verified, teknisi sedang bekerja
- **Digunakan di:**
  - API /api/ticket/verify-otp
  - Dashboard filter untuk tracking
  - Badge display
- **Next Status:** `"resolved"`

### **6. RESOLVED** - Ticket Selesai
- **Keyword:** `"resolved"`
- **Alias:** `"selesai"`, `"completed"` (untuk backward compatibility)
- **Deskripsi:** Pekerjaan selesai, ticket closed
- **Digunakan di:**
  - API /api/ticket/complete
  - Dashboard filter untuk history
  - Badge display
- **Next Status:** N/A (final state)

### **7. DIBATALKAN** - Ticket Dibatalkan
- **Keyword:** `"dibatalkan"`
- **Alias:** `"cancelled"`, `"cancelled_by_pelanggan"`
- **Deskripsi:** Ticket dibatalkan oleh pelanggan atau admin
- **Digunakan di:**
  - API /api/ticket/cancel
  - Dashboard filter untuk history
- **Next Status:** N/A (final state)

---

## 🚫 **DEPRECATED STATUS (DO NOT USE!)**

Status berikut **TIDAK BOLEH DIGUNAKAN** lagi:

- ~~`"pending"`~~ → Use `"baru"` instead
- ~~`"on_location"`~~ → Use `"arrived"` instead
- ~~`"in_progress"`~~ → Use `"working"` instead
- ~~`"completed"`~~ → Use `"resolved"` instead

---

## ✅ **IMPLEMENTATION CHECKLIST**

### **Backend (API Routes)**
- [ ] routes/tickets.js - ALL endpoints use correct status
- [ ] message/handlers/teknisi-workflow-handler.js - WhatsApp bot uses same status
- [ ] Validation checks support all status variations

### **Frontend (Dashboard)**
- [ ] teknisi-tiket.php - Filter includes ALL active statuses
- [ ] Badge map includes ALL status keywords
- [ ] Workflow stepper uses correct status mapping
- [ ] Action buttons check correct status

### **Handlers (Ticket Creation)**
- [ ] smart-report-handler.js - Creates tickets with "baru"
- [ ] smart-report-text-menu.js - Creates tickets with "baru"
- [ ] smart-report-hybrid.js - Creates tickets with "baru"
- [ ] ticket-creation-handler.js - Creates tickets with "baru"

---

## 📝 **USAGE EXAMPLES**

### **Correct ✅**
```javascript
// Ticket creation
ticket.status = 'baru';

// Process ticket
ticket.status = 'process';

// Dashboard filter
const statusParam = 'baru,process,otw,arrived,working';
```

### **Wrong ❌**
```javascript
// DO NOT USE!
ticket.status = 'pending';          // ❌
ticket.status = 'diproses teknisi'; // ❌ Use 'process'
ticket.status = 'completed';        // ❌ Use 'resolved'
```

---

## 🔄 **STATUS TRANSITION FLOW**

```
baru → process → otw → arrived → working → resolved
  ↓                                           ↓
dibatalkan ←─────────────────────────────── selesai
```

**Rules:**
1. Status can only move FORWARD (no backward)
2. Can skip steps ONLY in emergency (e.g., baru → resolved)
3. Final states: `resolved`, `dibatalkan`

---

## 🎯 **BACKWARD COMPATIBILITY**

For old tickets, support these aliases:

| Old Status | New Status | Action |
|-----------|-----------|--------|
| `pending` | `baru` | Include in filter |
| `diproses teknisi` | `process` | Include in filter |
| `completed` | `resolved` | Include in filter |
| `selesai` | `resolved` | Include in filter |

---

## 📌 **CRITICAL NOTES**

1. **KONSISTENSI adalah KUNCI!**
   - Semua tempat harus pakai status yang sama
   - Tidak boleh ada variasi atau typo

2. **Dashboard Filter HARUS LENGKAP!**
   - Include semua active status: `baru,process,otw,arrived,working`
   - Plus backward compat: `pending,diproses teknisi`

3. **Badge Display HARUS SUPPORT SEMUA!**
   - Map semua status ke badge yang sesuai
   - Include aliases untuk backward compatibility

4. **API Validation HARUS AKURAT!**
   - Check status dengan benar sebelum transition
   - Reject invalid status transitions

---

**Last Updated:** 2025-11-06
**Version:** 1.0.0
**Author:** System Standardization
