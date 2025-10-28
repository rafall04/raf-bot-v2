# ✅ Test Checklist: Fitur Reboot Modem

**Date:** 22 Oktober 2025  
**Tester:** _____________  
**Bot Version:** 2.0.0  

---

## 📋 PRE-TEST CHECKLIST

- [ ] Bot sudah di-restart setelah update code
- [ ] GenieACS server running
- [ ] Database users memiliki minimal 2 user dengan device_id
- [ ] Minimal 1 user dengan device online
- [ ] Minimal 1 user dengan device offline
- [ ] Tester punya akses sebagai owner/admin/teknisi
- [ ] Tester punya akses sebagai regular user

---

## 🧪 TEST SCENARIOS

### **TEST 1: Regular User - Device Online**

**Objective:** Test normal reboot flow untuk user biasa dengan device online

**Steps:**
1. Login sebagai regular user (customer)
2. Ketik: `reboot`
3. Tunggu bot check device
4. Verifikasi bot tampilkan konfirmasi
5. Balas: `ya`
6. Tunggu bot send command
7. Verifikasi success message

**Expected Result:**
```
User: reboot
Bot: ⏳ Memeriksa status perangkat...
Bot: ⚠️ Konfirmasi Reboot Modem
     
     Anda akan me-reboot modem untuk [User Name].
     Perhatian: ...
     Balas 'ya' untuk melanjutkan atau 'tidak' untuk membatalkan.

User: ya
Bot: ⏳ Sedang mengirim perintah reboot...
Bot: ✅ Permintaan Diterima
     
     Perintah reboot modem sedang diproses.
     Perhatian:
     • Modem akan mati dalam 10-30 detik
     ...
```

**Actual Result:**
```
[Paste actual bot responses here]
```

**Status:** [ ] Pass [ ] Fail

**Notes:**
_______________________________________________________________________

---

### **TEST 2: Regular User - Device Offline**

**Objective:** Test behavior ketika user coba reboot device yang offline

**Steps:**
1. Login sebagai regular user dengan device offline
2. Ketik: `reboot`
3. Tunggu bot check device
4. Verifikasi bot tampilkan offline error

**Expected Result:**
```
User: reboot
Bot: ⏳ Memeriksa status perangkat...
Bot: ❌ Perangkat Offline
     
     Maaf Kak [User Name], perangkat Anda sedang tidak terhubung ke sistem.
     
     📅 Terakhir Online: X menit yang lalu
     
     Kemungkinan Penyebab:
     ├ Modem mati/tidak ada listrik
     ├ Kabel power lepas
     ├ Gangguan jaringan
     └ Isolir karena tunggakan
     
     Solusi: ...
     
     💡 Catatan: Reboot hanya bisa dilakukan jika modem online...
```

**Actual Result:**
```
[Paste actual bot responses here]
```

**Status:** [ ] Pass [ ] Fail

**Notes:**
_______________________________________________________________________

---

### **TEST 3: Admin Reboot by ID - Device Online**

**Objective:** Test admin bisa reboot device pelanggan lain by ID

**Steps:**
1. Login sebagai admin/teknisi/owner
2. Ketik: `reboot 1` (ganti 1 dengan ID user yang device online)
3. Tunggu bot check device
4. Verifikasi bot tampilkan konfirmasi dengan nama pelanggan
5. Balas: `ya`
6. Verifikasi success message

**Expected Result:**
```
Admin: reboot 1
Bot: ⏳ Memeriksa status perangkat...
Bot: ⚠️ Konfirmasi Reboot Modem
     
     Anda akan me-reboot modem untuk [Customer Name].
     ...

Admin: ya
Bot: ⏳ Sedang mengirim perintah reboot...
Bot: ✅ Permintaan Diterima
     ...
```

**Actual Result:**
```
[Paste actual bot responses here]
```

**Status:** [ ] Pass [ ] Fail

**Notes:**
_______________________________________________________________________

---

### **TEST 4: Admin Reboot by ID - Device Offline**

**Objective:** Test admin tidak bisa reboot device offline

**Steps:**
1. Login sebagai admin
2. Ketik: `reboot X` (ganti X dengan ID user yang device offline)
3. Verifikasi bot tampilkan offline error

**Expected Result:**
```
Admin: reboot 2
Bot: ⏳ Memeriksa status perangkat...
Bot: ❌ Perangkat Offline
     
     Maaf Kak [Customer Name], perangkat Anda sedang tidak terhubung...
```

**Actual Result:**
```
[Paste actual bot responses here]
```

**Status:** [ ] Pass [ ] Fail

**Notes:**
_______________________________________________________________________

---

### **TEST 5: Admin Reboot by Invalid ID**

**Objective:** Test error handling untuk ID tidak valid

**Steps:**
1. Login sebagai admin
2. Ketik: `reboot 999999` (ID yang tidak exist)
3. Verifikasi bot tampilkan error

**Expected Result:**
```
Admin: reboot 999999
Bot: ❌ Pelanggan dengan ID "999999" tidak ditemukan.
```

**Actual Result:**
```
[Paste actual bot responses here]
```

**Status:** [ ] Pass [ ] Fail

**Notes:**
_______________________________________________________________________

---

### **TEST 6: User Cancel Reboot**

**Objective:** Test user bisa cancel reboot sebelum execute

**Steps:**
1. Login sebagai regular user
2. Ketik: `reboot`
3. Tunggu konfirmasi
4. Balas: `tidak`
5. Verifikasi bot cancel

**Expected Result:**
```
User: reboot
Bot: ⏳ Memeriksa status perangkat...
Bot: ⚠️ Konfirmasi Reboot Modem
     ...
     Balas 'ya' untuk melanjutkan atau 'tidak' untuk membatalkan.

User: tidak
Bot: ❌ Reboot modem dibatalkan.
```

**Actual Result:**
```
[Paste actual bot responses here]
```

**Status:** [ ] Pass [ ] Fail

**Notes:**
_______________________________________________________________________

---

### **TEST 7: Unregistered User**

**Objective:** Test error handling untuk user tidak terdaftar

**Steps:**
1. Gunakan nomor WhatsApp yang tidak terdaftar
2. Ketik: `reboot`
3. Verifikasi bot tampilkan error

**Expected Result:**
```
User: reboot
Bot: ❌ Maaf, nomor Anda belum terdaftar dalam sistem kami...
```

**Actual Result:**
```
[Paste actual bot responses here]
```

**Status:** [ ] Pass [ ] Fail

**Notes:**
_______________________________________________________________________

---

### **TEST 8: User Without Device ID**

**Objective:** Test error handling untuk user tanpa device_id

**Steps:**
1. Login sebagai user yang tidak punya device_id di database
2. Ketik: `reboot`
3. Verifikasi bot tampilkan error

**Expected Result:**
```
User: reboot
Bot: ❌ Maaf Kak [User Name], perangkat Anda belum terdaftar dalam sistem kami.
```

**Actual Result:**
```
[Paste actual bot responses here]
```

**Status:** [ ] Pass [ ] Fail

**Notes:**
_______________________________________________________________________

---

### **TEST 9: GenieACS Timeout**

**Objective:** Test error handling ketika GenieACS tidak merespons

**Preparation:**
- Stop GenieACS server sementara ATAU
- Set timeout sangat rendah untuk force timeout

**Steps:**
1. Login sebagai regular user
2. Ketik: `reboot`
3. Tunggu device check (akan timeout)
4. Balas: `ya` (jika sampai konfirmasi)
5. Verifikasi error message

**Expected Result:**
```
User: reboot
Bot: ⏳ Memeriksa status perangkat...
[Device check mungkin gagal tapi continue ke konfirmasi]

User: ya
Bot: ⏳ Sedang mengirim perintah reboot...
Bot: ❌ Gagal mengirim perintah reboot
     
     Alasan: Tidak dapat terhubung ke server. Silakan coba lagi.
```

**Actual Result:**
```
[Paste actual bot responses here]
```

**Status:** [ ] Pass [ ] Fail

**Notes:**
_______________________________________________________________________

---

### **TEST 10: Multiple Command Formats**

**Objective:** Test berbagai format command yang valid

**Steps:**
Test each command:
1. `reboot`
2. `restart`
3. `reboot modem`
4. `restart modem`
5. `reboot router`

**Expected Result:**
All commands should work and trigger same flow

**Actual Result:**
- `reboot`: [ ] Pass [ ] Fail
- `restart`: [ ] Pass [ ] Fail
- `reboot modem`: [ ] Pass [ ] Fail
- `restart modem`: [ ] Pass [ ] Fail
- `reboot router`: [ ] Pass [ ] Fail

**Status:** [ ] Pass [ ] Fail

**Notes:**
_______________________________________________________________________

---

### **TEST 11: Admin Own Device Reboot**

**Objective:** Test admin bisa reboot device sendiri tanpa ID

**Steps:**
1. Login sebagai admin yang punya device_id
2. Ketik: `reboot` (tanpa ID)
3. Verifikasi bot reboot device admin sendiri

**Expected Result:**
```
Admin: reboot
Bot: ⏳ Memeriksa status perangkat...
Bot: ⚠️ Konfirmasi Reboot Modem
     
     Anda akan me-reboot modem untuk [Admin Name].
     ...
```

**Actual Result:**
```
[Paste actual bot responses here]
```

**Status:** [ ] Pass [ ] Fail

**Notes:**
_______________________________________________________________________

---

### **TEST 12: Logging Verification**

**Objective:** Verify logging di console

**Steps:**
1. Open bot console/terminal
2. Execute reboot command
3. Check for log entries

**Expected Logs:**
```
[DEBUG_REBOOT] Args: ["reboot"]
[DEBUG_REBOOT] isOwner: false, isTeknisi: false
[REBOOT_ROUTER] Sending reboot command to device: xxx-xxx-xxx
[REBOOT_ROUTER] Reboot command sent successfully to xxx-xxx-xxx
[REBOOT_SUCCESS] User: [Name] ([ID]), Rebooted by: [Name]
```

**Actual Logs:**
```
[Paste actual logs here]
```

**Status:** [ ] Pass [ ] Fail

**Notes:**
_______________________________________________________________________

---

## 📊 TEST SUMMARY

**Date Completed:** _____________  
**Total Tests:** 12  
**Passed:** _____ / 12  
**Failed:** _____ / 12  
**Pass Rate:** _____ %  

### **Critical Issues Found:**
1. _______________________________________________________________________
2. _______________________________________________________________________
3. _______________________________________________________________________

### **Minor Issues Found:**
1. _______________________________________________________________________
2. _______________________________________________________________________
3. _______________________________________________________________________

### **Recommendations:**
_______________________________________________________________________
_______________________________________________________________________
_______________________________________________________________________

---

## ✅ SIGN-OFF

**Tester Name:** _____________  
**Tester Role:** _____________  
**Date:** _____________  
**Signature:** _____________

**Approval:**
- [ ] All critical tests passed
- [ ] Minor issues documented
- [ ] Ready for production
- [ ] Documentation updated

**Approved by:** _____________  
**Date:** _____________  
**Signature:** _____________

---

## 📝 NOTES & OBSERVATIONS

_______________________________________________________________________
_______________________________________________________________________
_______________________________________________________________________
_______________________________________________________________________
_______________________________________________________________________

---

**Test Environment:**
- Bot Version: 2.0.0
- Node.js Version: _____________
- GenieACS Version: _____________
- Database: SQLite
- OS: Windows

**Test Data:**
- Total Users: _____________
- Users with device_id: _____________
- Online devices: _____________
- Offline devices: _____________

---

**Last Updated:** 22 Oktober 2025  
**Document Version:** 1.0
