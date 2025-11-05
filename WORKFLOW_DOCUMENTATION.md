# 📚 RAF BOT V2 - COMPLETE WORKFLOW DOCUMENTATION

## 📊 REFACTORING SUMMARY
- **Original File**: 3,093 lines
- **Current File**: 1,866 lines  
- **Reduction**: 1,227 lines (39.7%)
- **Total Handlers**: 36 files
- **State Handlers**: 4 files
- **Last Updated**: November 3, 2025

---

## 🗂️ FILE STRUCTURE

```
raf-bot-v2/
├── message/
│   ├── raf.js (Main Router - 1,866 lines)
│   └── handlers/
│       ├── Core Features/
│       │   ├── menu-handler.js
│       │   ├── utility-handler.js
│       │   └── monitoring-handler.js
│       │
│       ├── WiFi Management/
│       │   ├── wifi-management-handler.js
│       │   ├── wifi-check-handler.js
│       │   ├── wifi-power-handler.js
│       │   └── reboot-modem-handler.js
│       │
│       ├── Financial/
│       │   ├── balance-management-handler.js
│       │   ├── billing-management-handler.js
│       │   ├── payment-processor-handler.js
│       │   ├── saldo-voucher-handler.js
│       │   └── topup-handler.js
│       │
│       ├── Package & Voucher/
│       │   ├── package-management-handler.js
│       │   ├── voucher-management-handler.js
│       │   └── speed-boost-handler.js
│       │
│       ├── Network Admin/
│       │   ├── network-management-handler.js
│       │   └── access-management-handler.js
│       │
│       ├── Ticketing System/
│       │   ├── ticket-creation-handler.js
│       │   ├── ticket-process-handler.js
│       │   ├── smart-report-handler.js
│       │   ├── smart-report-text-menu.js
│       │   └── smart-report-hybrid.js
│       │
│       ├── Teknisi Workflow/
│       │   ├── teknisi-workflow-handler.js
│       │   ├── teknisi-photo-handler-v3.js
│       │   ├── simple-location-handler.js
│       │   └── photo-workflow-handler.js
│       │
│       ├── Conversation States/
│       │   ├── conversation-state-handler.js (Main)
│       │   └── states/
│       │       ├── wifi-name-state-handler.js
│       │       ├── wifi-password-state-handler.js
│       │       ├── report-state-handler.js
│       │       └── other-state-handler.js
│       │
│       └── Utilities/
│           └── utils.js
```

---

## 🔄 COMPLETE WORKFLOW MAPPING

### 1️⃣ **MENU COMMANDS**

| Command | Handler | Function | Flow |
|---------|---------|----------|------|
| `menu` | menu-handler.js | `handleMenu()` | Display main menu |
| `menupelanggan` | menu-handler.js | `handleMenuPelanggan()` | Customer menu |
| `menucs` | menu-handler.js | `handleMenuCs()` | CS menu |
| `menuteknisi` | menu-handler.js | `handleMenuTeknisi()` | Technician menu |

### 2️⃣ **WIFI MANAGEMENT**

#### **2.1 Check WiFi Status**
```
Command: cekwifi / cek wifi
Flow: raf.js → wifi-check-handler.js → handleCekWifi()
Process:
1. Validate user registration
2. Check device_id exists
3. Call GenieACS API
4. Parse WiFi info
5. Return formatted status
```

#### **2.2 Change WiFi Name**
```
Command: ganti nama wifi [name]
Flow: raf.js → wifi-management-handler.js → handleGantiNamaWifi()

IF no name provided:
  → Set temp state 'SELECT_CHANGE_MODE'
  → conversation-state-handler.js
  → wifi-name-state-handler.js
  → Step-by-step flow:
     1. SELECT_CHANGE_MODE (single/bulk)
     2. SELECT_SSID_TO_CHANGE
     3. ASK_NEW_NAME_FOR_SINGLE
     4. CONFIRM_GANTI_NAMA
     5. Execute change via API
```

#### **2.3 Change WiFi Password**
```
Command: ganti password / ganti sandi wifi
Flow: raf.js → wifi-management-handler.js → handleGantiSandiWifi()

IF no password provided:
  → Set temp state 'SELECT_PASSWORD_MODE'
  → conversation-state-handler.js
  → wifi-password-state-handler.js
  → Steps:
     1. SELECT_PASSWORD_MODE
     2. SELECT_SSID_PASSWORD
     3. ASK_NEW_PASSWORD
     4. CONFIRM_GANTI_SANDI
     5. Execute via API
```

#### **2.4 Change WiFi Power**
```
Command: gantipower [20/40/60/80/100]
Flow: raf.js → wifi-power-handler.js → handleGantiPowerWifi()
Process:
1. Validate power value
2. Call GenieACS API
3. Update transmit power
```

#### **2.5 Reboot Modem**
```
Command: reboot / restart modem
Flow: raf.js → reboot-modem-handler.js → handleRebootModem()

IF customer:
  → Set temp state 'CONFIRM_REBOOT'
  → conversation-state-handler.js
  → other-state-handler.js → handleConfirmReboot()
```

### 3️⃣ **FINANCIAL OPERATIONS**

#### **3.1 Balance Management**
```
Commands:
- ceksaldo → saldo-voucher-handler.js → handleCekSaldo()
- <topup [number]|[amount] → balance-management-handler.js → handleTopup()
- <delsaldo [number] → balance-management-handler.js → handleDelSaldo()
- transfer [number]|[amount] → balance-management-handler.js → handleTransfer()
```

#### **3.2 Voucher Purchase**
```
Command: beli voucher / voucher
Flow: raf.js → saldo-voucher-handler.js → handleVoucher()
  → Set temp state 'ASK_VOUCHER_CHOICE'
  → payment-processor-handler.js → processVoucherPurchase()
```

#### **3.3 Billing Check**
```
Command: cek tagihan
Flow: raf.js → billing-management-handler.js → handleCekTagihan()
Process:
1. Find user by phone
2. Check subscription type
3. Get package info
4. Check paid status
5. Return formatted bill
```

### 4️⃣ **PACKAGE MANAGEMENT**

#### **4.1 Change Package**
```
Command: ubah paket
Flow: raf.js → package-management-handler.js → handleUbahPaket()
  → Set temp state 'ASK_PACKAGE_CHOICE'
  → conversation-state-handler.js
  → other-state-handler.js → handleAskPackageChoice()
```

#### **4.2 Speed Boost (SOD)**
```
Command: sod / speed boost
Flow: raf.js → package-management-handler.js → handleRequestSpeedBoost()
  → Set temp state 'SELECT_SOD_CHOICE'
  → conversation-state-handler.js
  → other-state-handler.js → handleSelectSodChoice()
```

### 5️⃣ **TICKETING SYSTEM**

#### **5.1 Create Report**
```
Command: lapor / lapor gangguan
Flow: 
1. raf.js → smart-report-handler.js → handleSmartReport()
2. Check device status via API
3. Determine issue type (MATI/LEMOT)
4. IF MATI & device offline:
   → Set state 'GANGGUAN_MATI_DEVICE_OFFLINE'
   → Ask troubleshooting steps
5. Create ticket → ticket-creation-handler.js → buatLaporanGangguan()
```

#### **5.2 Report Menu Flow**
```
Command: lapor → shows menu
Flow: raf.js → smart-report-text-menu.js → handleLaporMenu()
  → Set state 'REPORT_MENU'
  
Options:
1. WiFi Mati → handleInternetMati()
2. WiFi Lemot → handleInternetLemot()
3. Lainnya → handleLaporanLainnya()
```

### 6️⃣ **TEKNISI WORKFLOW**

#### **Complete Workflow**
```
1. LIST TICKETS
   Command: list tiket
   Flow: raf.js → LIST_TIKET case (inline display logic)

2. PROCESS TICKET
   Command: proses [ID]
   Flow: raf.js → teknisi-workflow-handler.js → handleProsesTicket()
   - Updates ticket status to 'process'
   - Sends OTP to ALL customer numbers
   - Sets teknisi state

3. ON THE WAY
   Command: otw [ID] / mulai perjalanan [ID]
   Flow: raf.js → teknisi-workflow-handler.js → handleOTW()
   - Updates status to 'otw'
   - Notifies ALL customer numbers
   - Requests location sharing

4. SHARE LOCATION
   Type: Location message
   Flow: raf.js → simple-location-handler.js → handleTeknisiShareLocation()
   - Updates ticket location
   - Sends to ALL customer numbers
   - Shows "sampai [ID]" instruction

5. ARRIVED AT LOCATION
   Command: sampai [ID] / sampai lokasi [ID]
   Flow: raf.js → teknisi-workflow-handler.js → handleSampaiLokasi()
   - Updates status to 'arrived'
   - Shows OTP in box format
   - Notifies ALL customers

6. VERIFY OTP
   Command: verifikasi [ID] [OTP]
   Flow: raf.js → teknisi-workflow-handler.js → handleVerifikasiOTP()
   - Validates OTP
   - Updates status to 'working'
   - Starts work session

7. UPLOAD PHOTOS
   Type: Image message
   Flow: raf.js → teknisi-photo-handler-v3.js → handleTeknisiPhotoUploadBatch()
   - Queue-based upload
   - Prevents race conditions
   - Batch response after 2 seconds

8. MARK PHOTOS DONE
   Command: done / lanjut / next
   Flow: raf.js → DONE_UPLOAD_PHOTOS case
   - Validates minimum 2 photos
   - Moves to notes step

9. RESOLUTION NOTES
   Type: Text message
   Flow: raf.js → SELESAI_DENGAN_CATATAN case
   - Records resolution notes
   - Updates status to 'resolved'
   - Sends completion to ALL numbers
```

### 7️⃣ **NETWORK ADMINISTRATION**

#### **7.1 IP Binding**
```
Command: addbinding [comment]|[ip]|[mac]|[profile]
Flow: raf.js → network-management-handler.js → handleAddBinding()
Process:
1. Validate static profile
2. Add IP binding
3. Add to queue
4. Return status
```

#### **7.2 PPPoE Management**
```
Command: addppp [user]|[password]|[profile]
Flow: raf.js → network-management-handler.js → handleAddPPP()
```

#### **7.3 Voucher Profiles**
```
Commands:
- addprofvoucher → voucher-management-handler.js → handleAddProfVoucher()
- delprofvoucher → voucher-management-handler.js → handleDelProfVoucher()
- addprofstatik → voucher-management-handler.js → handleAddProfStatik()
- delprofstatik → voucher-management-handler.js → handleDelProfStatik()
```

---

## 🔑 KEY PATTERNS

### **Multi-Phone Notification Pattern**
```javascript
// Always send to ALL registered numbers:
// 1. Main customer
await global.raf.sendMessage(customerJid, { text: message });

// 2. All additional numbers
if (ticket.pelangganPhone) {
    const phones = ticket.pelangganPhone.split('|');
    for (const phone of phones) {
        // Format and send...
    }
}
```

### **Conversation State Pattern**
```javascript
// Set state for multi-step flow
temp[sender] = {
    step: 'STATE_NAME',
    data: additionalData
};

// Handler picks up in conversation-state-handler.js
// Routes to appropriate sub-handler
```

### **User Lookup Pattern**
```javascript
// Find user by phone (handles multiple formats)
const user = global.users.find(u =>
    u.phone_number &&
    u.phone_number.split('|').some(num =>
        num.trim() === plainSenderNumber ||
        `62${num.trim().substring(1)}` === plainSenderNumber
    )
);
```

---

## 📝 MAINTENANCE GUIDE

### **Adding New Features**
1. Create new handler in appropriate directory
2. Export function from handler
3. Add case in raf.js with handler import
4. For multi-step: add states to conversation-state-handler.js

### **Modifying Existing Features**
1. Locate handler via this document
2. Edit handler file directly
3. No need to touch raf.js unless changing command

### **Debugging Flow**
1. Check raf.js for initial case
2. Follow to handler file
3. For multi-step: trace through conversation states
4. Check console.log statements in handlers

### **Common Issues**
- **Names show as "Customer"**: Check users database has data
- **OTP not showing**: Verify ticket.otp exists in handler
- **Notifications not sent to all**: Check multi-phone pattern implementation
- **State not working**: Ensure temp[sender] is set correctly

---

## 📊 HANDLER STATISTICS

| Category | Handlers | Lines Saved | Complexity |
|----------|----------|-------------|------------|
| WiFi Management | 4 | ~400 | High |
| Financial | 5 | ~300 | Medium |
| Ticketing | 5 | ~250 | High |
| Teknisi Workflow | 4 | ~150 | High |
| Network Admin | 2 | ~100 | Medium |
| Conversation States | 5 | ~900 | Very High |

---

## ✅ VERIFICATION CHECKLIST

- [x] All axios calls removed from raf.js
- [x] All database writes in handlers (except photos)
- [x] All business logic extracted
- [x] All handlers have proper exports
- [x] All states handled properly
- [x] Multi-phone notifications implemented
- [x] Syntax validation passes
- [x] No duplicate handlers
- [x] Clean file structure

---

*Last validated: November 3, 2025*
*Total reduction: 39.7%*
*Architecture: Modular Handler Pattern*
