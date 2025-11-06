# 📋 TEKNISI DASHBOARD WORKFLOW IMPLEMENTATION PLAN

## 🎯 OBJECTIVE
Update teknisi-tiket.php dashboard to match the complete step-by-step workflow that exists in WhatsApp bot.

---

## 📊 CURRENT STATE ANALYSIS

### WhatsApp Bot Workflow (✅ PERFECT - REFERENCE)
```
1. LIST TIKET       → Display available tickets
2. PROSES [ID]      → Generate OTP, notify customers, set status='process'
3. OTW [ID]         → Request location, update status='otw', show OTP to customer
4. SHARE LOCATION   → Send live location, track teknisi
5. SAMPAI [ID]      → Arrived, show OTP in box format to customer
6. VERIFIKASI [ID] [OTP] → Validate OTP, status='working'
7. UPLOAD PHOTOS    → Queue-based photo upload (min 2 required)
8. DONE/LANJUT/NEXT → Mark photos complete, move to notes
9. TEXT MESSAGE     → Resolution notes
10. COMPLETE        → Finalize ticket, status='resolved'
```

### Current Dashboard (❌ INCOMPLETE)
```
✅ Load tickets with status "baru" or "diproses teknisi"
✅ Process ticket button (but no OTP generation)
❌ No OTW step
❌ No location sharing
❌ No OTP verification
❌ No photo upload
❌ Simple "Tandai Selesai" form (doesn't follow workflow)
```

---

## 🛠️ REQUIRED CHANGES

### 1. API ENDPOINTS (routes/tickets.js)

#### 1.1 Update Existing Endpoint
**POST /api/ticket/process**
- ✅ Current: Update status to "diproses teknisi"
- ❌ Missing: Generate OTP
- ❌ Missing: Send OTP to ALL customer numbers
- ❌ Missing: Use teknisi.name (not username)

**Action:** Replace with logic from `teknisi-workflow-handler.js → handleProsesTicket()`

#### 1.2 New Endpoints Needed

**POST /api/ticket/otw**
```javascript
// Based on: teknisi-workflow-handler.js → handleOTW()
Request: { ticketId }
Process:
- Validate teknisi is assigned to ticket
- Update status to 'otw'
- Send notification to ALL customer numbers
- Include OTP in notification
- Request location sharing
Response: { success, message }
```

**POST /api/ticket/arrived**
```javascript
// Based on: teknisi-workflow-handler.js → handleSampaiLokasi()
Request: { ticketId }
Process:
- Validate teknisi
- Update status to 'arrived'
- Send OTP in box format to ALL customer numbers
- Include teknisi contact info
Response: { success, message, otp }
```

**POST /api/ticket/verify-otp**
```javascript
// Based on: teknisi-workflow-handler.js → handleVerifikasiOTP()
Request: { ticketId, otp }
Process:
- Validate OTP
- Update status to 'working'
- Record work start time
- Notify customers work started
Response: { success, message }
```

**POST /api/ticket/upload-photo**
```javascript
// Based on: teknisi-photo-handler-v3.js → handleTeknisiPhotoUploadBatch()
Request: FormData with photo file
Process:
- Upload photo to public/uploads
- Add to ticket.photos array
- Track photo count
Response: { success, photoCount, totalPhotos }
```

**POST /api/ticket/complete**
```javascript
// Based on: teknisi-workflow-handler.js → handleCompleteTicket()
Request: { ticketId, resolutionNotes }
Process:
- Validate minimum 2 photos uploaded
- Update status to 'resolved'
- Save resolution notes
- Calculate duration
- Notify ALL customers of completion
Response: { success, message }
```

---

### 2. DATABASE SCHEMA UPDATES

#### Ticket Object Fields (global.reports)
```javascript
{
    // Existing fields
    id: string,
    ticketId: string,
    user_id: number,
    description: string,
    created_at: string,
    
    // Fields to add/update
    status: 'baru' | 'process' | 'otw' | 'arrived' | 'working' | 'resolved',
    
    // Teknisi info
    teknisiId: string,              // WhatsApp JID
    teknisiName: string,            // Name from accounts.json
    teknisiPhone: string,           // For customer contact
    
    // OTP
    otp: string,                    // 6 digit OTP
    otpVerified: boolean,
    otpVerifiedAt: string,
    
    // Timestamps
    processedAt: string,
    otwAt: string,
    arrivedAt: string,
    workStartedAt: string,
    resolvedAt: string,
    
    // Photos
    photos: [
        {
            path: string,
            uploadedAt: string
        }
    ],
    
    // Resolution
    resolutionNotes: string,
    duration_minutes: number,
    
    // Customer contact (for multi-phone notification)
    pelangganId: string,            // Main WhatsApp JID
    pelangganPhone: string,         // All numbers separated by |
    pelangganName: string
}
```

---

### 3. FRONTEND UI UPDATES (teknisi-tiket.php)

#### 3.1 Ticket Table Enhancements
**Current Columns:**
- Pelanggan (WA)
- Detail Pelanggan (Sistem)
- Isi Laporan
- Status
- Tgl Dibuat
- Diproses Oleh
- Aksi

**Add Column:**
- **Progress** - Visual workflow stepper showing current step

#### 3.2 Action Buttons by Status

**Status: 'baru'**
```html
<button class="btn btn-primary btn-sm" onclick="prosesTicket(ticketId)">
    <i class="fas fa-play"></i> Proses
</button>
```

**Status: 'process'**
```html
<button class="btn btn-info btn-sm" onclick="otwTicket(ticketId)">
    <i class="fas fa-car"></i> OTW
</button>
<button class="btn btn-secondary btn-sm" onclick="showOTP(ticketId)">
    <i class="fas fa-key"></i> Lihat OTP
</button>
```

**Status: 'otw'**
```html
<button class="btn btn-success btn-sm" onclick="sampaiTicket(ticketId)">
    <i class="fas fa-map-marker-alt"></i> Sampai
</button>
<button class="btn btn-secondary btn-sm" onclick="showOTP(ticketId)">
    <i class="fas fa-key"></i> Lihat OTP
</button>
```

**Status: 'arrived'**
```html
<button class="btn btn-warning btn-sm" onclick="verifyOTPModal(ticketId)">
    <i class="fas fa-check"></i> Verifikasi OTP
</button>
<button class="btn btn-secondary btn-sm" onclick="showOTP(ticketId)">
    <i class="fas fa-key"></i> Lihat OTP
</button>
```

**Status: 'working'**
```html
<button class="btn btn-primary btn-sm" onclick="uploadPhotosModal(ticketId)">
    <i class="fas fa-camera"></i> Upload Foto (<span id="photoCount-{id}">0</span>)
</button>
<button class="btn btn-success btn-sm" onclick="completeModal(ticketId)" 
        id="completeBtn-{id}" disabled>
    <i class="fas fa-check-circle"></i> Selesai
</button>
```

#### 3.3 Modals Required

**1. OTP Display Modal**
```html
<div id="otpModal">
    <!-- Show OTP in box format like WhatsApp -->
    ╔════════════════╗
    ║  *123456*      ║
    ╚════════════════╝
</div>
```

**2. OTP Verification Modal**
```html
<div id="verifyOTPModal">
    <input type="text" id="otpInput" placeholder="Masukkan 6 digit OTP">
    <button>Verifikasi</button>
</div>
```

**3. Photo Upload Modal**
```html
<div id="uploadPhotosModal">
    <input type="file" accept="image/*" multiple>
    <div id="photoPreview"></div>
    <p>Minimal 2 foto diperlukan</p>
    <button id="markPhotoDone" disabled>Selesai Upload</button>
</div>
```

**4. Complete Ticket Modal**
```html
<div id="completeModal">
    <textarea id="resolutionNotes" placeholder="Catatan penyelesaian..."></textarea>
    <div id="uploadedPhotos">
        <!-- Show all uploaded photos -->
    </div>
    <button>Tandai Selesai</button>
</div>
```

---

### 4. JAVASCRIPT STATE MANAGEMENT

#### 4.1 Ticket State Tracking
```javascript
const ticketStates = {
    'TICKET123': {
        currentStatus: 'working',
        otp: '123456',
        photosUploaded: 2,
        canComplete: true
    }
};
```

#### 4.2 Key Functions

```javascript
async function prosesTicket(ticketId) {
    // Call POST /api/ticket/process
    // Show success message with OTP
    // Refresh table
}

async function otwTicket(ticketId) {
    // Call POST /api/ticket/otw
    // Show instructions for location sharing
    // Update button state
}

async function sampaiTicket(ticketId) {
    // Call POST /api/ticket/arrived
    // Show OTP modal
    // Enable verify OTP button
}

async function verifyOTP(ticketId, otp) {
    // Call POST /api/ticket/verify-otp
    // On success, enable photo upload
    // Update status display
}

async function uploadPhoto(ticketId, file) {
    // Call POST /api/ticket/upload-photo
    // Update photo count
    // Enable complete button if >= 2 photos
}

async function completeTicket(ticketId, notes) {
    // Validate >= 2 photos
    // Call POST /api/ticket/complete
    // Show success message
    // Refresh table
}
```

---

### 5. NOTIFICATION PATTERNS

#### 5.1 Multi-Phone Notification
**ALL handlers MUST send to ALL registered numbers:**

```javascript
// 1. Send to main customer
await global.raf.sendMessage(ticket.pelangganId, { text: message });

// 2. Send to ALL additional numbers
if (ticket.pelangganPhone) {
    const phones = ticket.pelangganPhone.split('|').map(p => p.trim()).filter(p => p);
    for (const phone of phones) {
        let phoneJid = normalizePhone(phone);
        if (phoneJid !== ticket.pelangganId) {
            await global.raf.sendMessage(phoneJid, { text: message });
        }
    }
}
```

#### 5.2 Message Templates

**Proses Ticket:**
```
🔧 TEKNISI MEMPROSES LAPORAN

━━━━━━━━━━━━━━━━
📋 ID Tiket: TICKET123
🔧 Teknisi: DAPINN
📱 Kontak: wa.me/6289685645956
━━━━━━━━━━━━━━━━

🔐 KODE VERIFIKASI:
╔════════════════╗
║  *123456*      ║
╚════════════════╝

Simpan kode ini untuk diberikan saat teknisi tiba.
```

**OTW:**
```
🚗 TEKNISI BERANGKAT

━━━━━━━━━━━━━━━━
📋 ID Tiket: TICKET123
🔧 Teknisi: DAPINN
📱 Kontak: wa.me/6289685645956
━━━━━━━━━━━━━━━━

Teknisi sedang menuju lokasi Anda.

⏱️ Estimasi Tiba: 30-60 menit

🔐 KODE VERIFIKASI:
╔════════════════╗
║  *123456*      ║
╚════════════════╝
```

**Arrived:**
```
📍 TEKNISI TELAH TIBA

━━━━━━━━━━━━━━━━
📋 ID Tiket: TICKET123
🔧 Teknisi: DAPINN
📱 Kontak: wa.me/6289685645956
━━━━━━━━━━━━━━━━

Teknisi telah sampai di lokasi.

🔐 BERIKAN KODE INI:
╔════════════════╗
║  *123456*      ║
╚════════════════╝
```

**OTP Verified:**
```
✅ PEKERJAAN DIMULAI

━━━━━━━━━━━━━━━━
📋 ID Tiket: TICKET123
🔧 Teknisi: DAPINN
━━━━━━━━━━━━━━━━

Teknisi sedang bekerja menangani masalah Anda.
```

**Completed:**
```
✅ LAPORAN SELESAI

━━━━━━━━━━━━━━━━
📋 ID Tiket: TICKET123
🔧 Teknisi: DAPINN
⏱️ Durasi: 45 menit
━━━━━━━━━━━━━━━━

Penyelesaian:
[Resolution notes...]

Terima kasih telah menggunakan layanan kami! 🙏
```

---

### 6. WORKFLOW VISUAL INDICATOR

Add progress stepper to show current step:

```html
<div class="workflow-stepper">
    <div class="step completed">
        <i class="fas fa-check"></i>
        <span>Proses</span>
    </div>
    <div class="step active">
        <i class="fas fa-car"></i>
        <span>OTW</span>
    </div>
    <div class="step">
        <i class="fas fa-map-marker-alt"></i>
        <span>Tiba</span>
    </div>
    <div class="step">
        <i class="fas fa-key"></i>
        <span>Verifikasi</span>
    </div>
    <div class="step">
        <i class="fas fa-camera"></i>
        <span>Foto</span>
    </div>
    <div class="step">
        <i class="fas fa-check-circle"></i>
        <span>Selesai</span>
    </div>
</div>
```

---

## 📝 IMPLEMENTATION CHECKLIST

### Phase 1: Backend API (routes/tickets.js)
- [ ] Update POST /api/ticket/process (add OTP generation)
- [ ] Create POST /api/ticket/otw
- [ ] Create POST /api/ticket/arrived
- [ ] Create POST /api/ticket/verify-otp
- [ ] Create POST /api/ticket/upload-photo
- [ ] Create POST /api/ticket/complete
- [ ] Test all endpoints with Postman/Thunder Client

### Phase 2: Frontend UI (teknisi-tiket.php)
- [ ] Add workflow progress stepper
- [ ] Update action buttons based on status
- [ ] Create OTP display modal
- [ ] Create OTP verification modal
- [ ] Create photo upload modal
- [ ] Create complete ticket modal
- [ ] Add CSS for workflow stepper

### Phase 3: JavaScript Logic
- [ ] Implement prosesTicket()
- [ ] Implement otwTicket()
- [ ] Implement sampaiTicket()
- [ ] Implement verifyOTP()
- [ ] Implement uploadPhoto()
- [ ] Implement completeTicket()
- [ ] Add photo count tracking
- [ ] Add button state management

### Phase 4: Testing
- [ ] Test full workflow from proses to complete
- [ ] Test OTP validation
- [ ] Test photo upload (min 2 photos)
- [ ] Test multi-phone notifications
- [ ] Test error handling
- [ ] Test concurrent ticket handling

---

## 🎯 SUCCESS CRITERIA

✅ Dashboard workflow matches WhatsApp bot workflow exactly
✅ All 9 steps implemented and working
✅ OTP generation and validation working
✅ Photo upload with minimum 2 photos enforced
✅ Multi-phone notifications working
✅ Visual progress indicator showing current step
✅ Proper error handling for each step
✅ No steps can be skipped (workflow enforcement)

---

## 📚 REFERENCE FILES

### WhatsApp Bot Handlers (REFERENCE - DO NOT MODIFY)
- `message/handlers/teknisi-workflow-handler.js`
- `message/handlers/teknisi-photo-handler-v3.js`
- `message/handlers/simple-location-handler.js`

### Files to Modify
- `routes/tickets.js` - API endpoints
- `views/sb-admin/teknisi-tiket.php` - Frontend UI
- `database/reports.json` - Data structure

### Documentation
- `WORKFLOW_DOCUMENTATION.md` - Complete workflow reference
- `AI_REFACTORING_RULES.md` - Coding patterns

---

## ⚠️ CRITICAL NOTES

1. **ALWAYS use teknisi.name (not username)**
   - Example: "DAPINN" not "teknisi"

2. **ALWAYS notify ALL customer numbers**
   - Main number + all numbers in pelangganPhone (separated by |)

3. **OTP Format**
   - 6 digits
   - Display in box format:
   ```
   ╔════════════════╗
   ║  *123456*      ║
   ╚════════════════╝
   ```

4. **Photo Minimum**
   - MUST enforce minimum 2 photos
   - Complete button disabled until >= 2 photos

5. **Status Flow (STRICT)**
   ```
   baru → process → otw → arrived → working → resolved
   ```
   Cannot skip steps!

6. **Field Names Compatibility**
   - Support both old and new field names
   - teknisiId / processedByTeknisiId / processedByTeknisi
   - teknisiName / processedByTeknisiName

---

## 🚀 DEPLOYMENT NOTES

1. Backup current teknisi-tiket.php before changes
2. Test all APIs individually before integration
3. Test complete workflow end-to-end
4. Monitor console for errors during testing
5. Verify WhatsApp notifications are sent correctly
6. Check database/reports.json structure after completion

---

**Last Updated:** November 6, 2025
**Status:** Ready for Implementation
**Priority:** HIGH - Core Feature
