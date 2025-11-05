# 🎯 SIMPLE PROMPT - COPY PASTE INI KE AI

---

## PROMPT UNTUK AI:

Perbaiki bug state interception di WiFi features. Masalahnya: ketika user ketik "ganti nama" lalu ketik "hai", bot malah respon dengan sapaan umum, bukan menggunakan "hai" sebagai nama WiFi.

**ROOT CAUSE:**
WiFi states disimpan di `temp[sender]`, tapi protection hanya cek `smartReportState`. Juga, staticIntents dicek SEBELUM temp[sender] states.

**FIX YANG DIPERLUKAN di message/raf.js:**

1. **Update wifiInputStates check (sekitar line 278):**
   - Sekarang: Hanya cek `smartReportState`
   - Seharusnya: Cek KEDUA `smartReportState` DAN `temp[sender]`

2. **Pastikan order processing benar:**
   - Check WiFi input states DULU
   - Kalau user dalam WiFi input state DAN bukan ketik "batal", SKIP semua global command checks
   - Process sebagai input untuk state handler

3. **WiFi states yang harus diprotect:**
   - ASK_NEW_NAME_FOR_SINGLE
   - ASK_NEW_NAME_FOR_SINGLE_BULK
   - ASK_NEW_NAME_FOR_BULK
   - ASK_NEW_NAME_FOR_BULK_AUTO
   - ASK_NEW_PASSWORD
   - ASK_NEW_PASSWORD_BULK
   - ASK_NEW_PASSWORD_BULK_AUTO

**TEST CASES yang harus berhasil:**
- ganti nama → hai → Harus set nama jadi "hai" (BUKAN sapaan umum)
- ganti nama → menu → Harus set nama jadi "menu" (BUKAN tampilkan menu)
- ganti nama → p → Harus set nama jadi "p" (BUKAN sapaan umum)
- ganti nama → batal → Harus cancel operation

**CRITICAL:**
- Jangan remove staticIntents, masih diperlukan untuk flow normal
- Protection HANYA untuk WiFi input states
- Check BOTH smartReportState AND temp[sender]
- "batal" tetap harus bisa break out

Perbaiki dengan teliti dan test semua scenarios.

---

## ALTERNATIVE PROMPT (LEBIH SIMPLE):

Fix bug: When user types "ganti nama" then "hai", bot responds with greeting instead of using "hai" as WiFi name. 

The issue: WiFi states are in temp[sender] but protection only checks smartReportState. Also staticIntents are checked before state handlers.

Fix in raf.js:
1. Check BOTH smartReportState AND temp[sender] for WiFi input states
2. Process WiFi input states BEFORE staticIntents check
3. Only "batal" should break out of WiFi input states

Test: "ganti nama" → "hai" should set WiFi name to "hai", not trigger greeting.

---

## PROMPT BAHASA INDONESIA (PALING SIMPLE):

Di raf.js, WiFi input states (ASK_NEW_NAME_*, ASK_NEW_PASSWORD_*) harus diproteksi dari global commands. Masalahnya states ini ada di temp[sender] tapi protection cuma cek smartReportState. 

Perbaiki:
1. Cek KEDUA-DUANYA: smartReportState DAN temp[sender]
2. Kalau user dalam WiFi input state, SKIP staticIntents check
3. Hanya "batal" yang bisa break out

Test: ganti nama → hai → harus pakai "hai" sebagai nama WiFi, bukan trigger sapaan.

---

**PILIH SALAH SATU PROMPT DI ATAS, COPY-PASTE KE AI BARU**
