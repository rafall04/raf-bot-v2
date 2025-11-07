# 📖 TEKNISI MAP VIEWER - PANDUAN PENGGUNA

**Versi:** 1.0  
**Tanggal:** 2025-11-07  
**Untuk:** Teknisi dan Staff

---

## 📌 **PENDAHULUAN**

Selamat datang di Peta Jaringan Teknisi yang telah ditingkatkan! Panduan ini akan membantu Anda memahami dan menggunakan fitur-fitur baru yang telah ditambahkan untuk meningkatkan pengalaman monitoring jaringan Anda.

### **Fitur Baru:**
✨ **Auto-Refresh** - Pembaruan data otomatis setiap 30 detik  
✨ **Garis Koneksi Animasi** - Visualisasi topologi jaringan berwarna  
✨ **Tombol Toggle Koneksi** - Tampilkan/sembunyikan garis sesuai kebutuhan  
✨ **Mode Fullscreen** - Popup dan modal tetap terlihat

---

## 🗺️ **TAMPILAN UTAMA PETA**

### **Lokasi:** `/admin/map-viewer-tech`

### **Elemen UI:**
```
┌──────────────────────────────────────────────────────────────┐
│ Peta Jaringan                                                │
│                                                               │
│ Petunjuk: Klik marker untuk info...                          │
│                                                               │
│ [Filter Kustom]  [Refresh Data]  ☑Auto Refresh  [● Koneksi] │
└──────────────────────────────────────────────────────────────┘
│                                                               │
│                    [Peta Interaktif]                          │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

---

## 🔄 **FITUR 1: AUTO-REFRESH**

### **Apa itu Auto-Refresh?**
Fitur yang secara otomatis memperbarui data peta setiap 30 detik tanpa perlu klik tombol "Refresh Data" secara manual.

### **Cara Menggunakan:**

#### **Mengaktifkan Auto-Refresh:**
1. Cari checkbox **"Auto Refresh (30s)"** di sebelah tombol "Refresh Data"
2. ✅ **Centang** checkbox tersebut
3. Anda akan melihat notifikasi: **"Auto refresh diaktifkan. Data akan diperbarui setiap 30 detik."**
4. Data akan langsung di-refresh sekali
5. Kemudian, setiap 30 detik data akan otomatis di-refresh

#### **Menonaktifkan Auto-Refresh:**
1. ☐ **Hapus centang** pada checkbox
2. Anda akan melihat notifikasi: **"Auto refresh dinonaktifkan."**
3. Auto-refresh berhenti, kembali ke mode manual

### **Kapan Menggunakan:**
✅ **Gunakan saat:** Monitoring jaringan real-time  
✅ **Gunakan saat:** Menunggu perubahan status customer  
✅ **Gunakan saat:** Troubleshooting masalah koneksi  
❌ **Jangan gunakan saat:** Ingin menghemat bandwidth  
❌ **Jangan gunakan saat:** Sedang membaca detail marker

### **Tips:**
💡 Auto-refresh **tidak akan mengganggu** jika Anda sedang klik refresh manual  
💡 Auto-refresh **berhenti otomatis** jika Anda tutup atau refresh halaman  
💡 Checkbox akan **kembali tidak tercentang** saat buka halaman baru

---

## 🌐 **FITUR 2: GARIS KONEKSI ANIMASI**

### **Apa itu Garis Koneksi?**
Garis animasi berwarna yang menghubungkan ODC → ODP → Customer, menunjukkan topologi jaringan dan status koneksi secara visual.

### **Warna Garis dan Artinya:**

#### **🟢 HIJAU (Garis Tebal, Animasi Cepat)**
- **Arti:** Customer **ONLINE** ✅
- **Koneksi:** Customer → ODP
- **Animasi:** Cepat (1 detik per cycle)
- **Ketebalan:** Tebal (6px)
- **Artinya:** Koneksi sehat, customer aktif

#### **🔴 MERAH (Garis Tipis, Animasi Lambat)**
- **Arti:** Customer **OFFLINE** ❌
- **Koneksi:** Customer → ODP
- **Animasi:** Lambat (3 detik per cycle)
- **Ketebalan:** Tipis (4px)
- **Artinya:** Perlu perhatian! Customer bermasalah

#### **⚪ ABU-ABU (Garis Sedang, Animasi Sedang)**
- **Arti:** Status customer **TIDAK DIKETAHUI** ❓
- **Koneksi:** Customer → ODP
- **Animasi:** Sedang (2.5 detik per cycle)
- **Ketebalan:** Sedang (3px)
- **Artinya:** Data PPPoE tidak tersedia

#### **🟠 ORANYE (Garis Tipis, Animasi Sedang)**
- **Arti:** **BACKBONE** infrastruktur 🏗️
- **Koneksi:** ODP → ODC (parent)
- **Animasi:** Sedang (2 detik per cycle)
- **Ketebalan:** Tipis (2px)
- **Artinya:** Koneksi infrastruktur jaringan

### **Visual Contoh:**
```
        ODC (Icon Biru)
         ↓↓↓ (Garis oranye animasi - backbone)
        ODP (Icon Kuning)
         ↓↓↓ (Garis hijau animasi - customer online)
     Customer Online (Marker Hijau)

        ODP (Icon Kuning)
         ↓↓↓ (Garis merah animasi - customer offline)
     Customer Offline (Marker Merah)
```

### **Cara Membaca Peta:**
1. **Lihat warna marker** - Status customer (hijau/merah/abu-abu)
2. **Lihat warna garis** - Konfirmasi status koneksi
3. **Perhatikan animasi** - Cepat = bagus, Lambat = masalah
4. **Ikuti jalur** - ODC → ODP → Customer (topologi lengkap)

### **Tips Troubleshooting:**
🔴 **Banyak garis merah?** → Kemungkinan masalah di ODP atau ODC  
🟠 **Garis oranye putus?** → Masalah koneksi ODP ke ODC  
⚪ **Banyak garis abu-abu?** → Data PPPoE tidak ter-update

---

## 🔘 **FITUR 3: TOMBOL TOGGLE KONEKSI**

### **Apa itu Tombol Toggle?**
Tombol **"Koneksi"** yang memungkinkan Anda menampilkan atau menyembunyikan semua garis koneksi dengan satu klik.

### **Lokasi:**
Di sebelah kanan checkbox "Auto Refresh", ada tombol dengan icon jaringan (📊).

### **Status Tombol:**

#### **Garis TAMPIL (Default):**
```
┌──────────────┐
│ ● Koneksi    │  ← Tombol hijau solid
└──────────────┘
```
- Warna: **Hijau solid**
- Tooltip: "Sembunyikan Garis Koneksi Jaringan"
- Status: Semua garis koneksi **TERLIHAT**
- Animasi: **Berjalan**

#### **Garis SEMBUNYI:**
```
┌──────────────┐
│ ○ Koneksi    │  ← Tombol hijau outline
└──────────────┘
```
- Warna: **Hijau outline** (tidak solid)
- Tooltip: "Tampilkan Garis Koneksi Jaringan"
- Status: Semua garis koneksi **TERSEMBUNYI**
- Animasi: **Berhenti**

### **Cara Menggunakan:**

#### **Menyembunyikan Garis:**
1. Klik tombol **"● Koneksi"** (hijau solid)
2. Tombol berubah jadi **"○ Koneksi"** (outline)
3. Notifikasi: **"Garis koneksi jaringan disembunyikan."**
4. Semua garis hilang, hanya marker yang terlihat
5. Peta jadi lebih bersih dan ringan

#### **Menampilkan Garis Lagi:**
1. Klik tombol **"○ Koneksi"** (outline)
2. Tombol berubah jadi **"● Koneksi"** (solid)
3. Notifikasi: **"Garis koneksi jaringan ditampilkan."**
4. Semua garis muncul kembali dengan animasi
5. Topologi jaringan terlihat lengkap

### **Kapan Menggunakan:**

#### **SEMBUNYIKAN Garis Saat:**
✅ Ingin screenshot peta yang bersih  
✅ Fokus pada lokasi marker saja  
✅ Device lemah, butuh performa lebih baik  
✅ Terlalu banyak garis, bikin bingung  
✅ Presentasi, butuh tampilan simple

#### **TAMPILKAN Garis Saat:**
✅ Monitoring status jaringan real-time  
✅ Troubleshooting koneksi customer  
✅ Analisis topologi jaringan  
✅ Ingin lihat jalur ODC → ODP → Customer  
✅ Perlu tahu customer mana yang offline

### **Manfaat:**
⚡ **Performa:** CPU usage turun 50% saat garis disembunyikan  
📸 **Screenshot:** Peta lebih bersih untuk dokumentasi  
👁️ **Fokus:** Lebih mudah lihat detail marker  
🎯 **Kontrol:** Anda yang tentukan kapan perlu lihat garis

---

## 📱 **MODE FULLSCREEN**

### **Cara Masuk Fullscreen:**
1. Klik tombol **expand** (⛶) di pojok kanan atas peta
2. Peta akan memenuhi seluruh layar
3. Semua fitur tetap berfungsi normal

### **Fitur yang Tetap Bekerja:**
✅ Popup marker tetap terlihat  
✅ Modal (Info WiFi, Kelola WiFi, Redaman) tetap terlihat  
✅ Auto-refresh tetap berjalan  
✅ Garis koneksi tetap tampil  
✅ Tombol toggle tetap berfungsi  
✅ Filter tetap bisa digunakan

### **Cara Keluar Fullscreen:**
1. Klik tombol **minimize** (⛶) di pojok kanan atas
2. Atau tekan tombol **ESC** di keyboard
3. Peta kembali ke ukuran normal

### **Tips Fullscreen:**
💡 Gunakan fullscreen untuk monitoring jangka panjang  
💡 Fullscreen bagus untuk presentasi  
💡 Popup dan modal sekarang 100% terlihat (masalah sudah diperbaiki!)

---

## 🎯 **WORKFLOW REKOMENDASI**

### **Monitoring Harian:**
```
1. Buka peta teknisi
2. ✅ Aktifkan auto-refresh
3. ● Pastikan garis koneksi tampil (tombol hijau solid)
4. 🔍 Cek garis merah (customer offline)
5. 🖱️ Klik marker customer offline
6. 📞 Hubungi atau troubleshoot
7. ⏱️ Tunggu auto-refresh untuk update status
```

### **Troubleshooting Customer:**
```
1. 🔍 Cari customer di peta (gunakan filter jika perlu)
2. 🖱️ Klik marker customer
3. 📊 Lihat status PPPoE (online/offline)
4. 🟢/🔴 Lihat warna garis ke ODP
5. 🟠 Cek garis oranye ODP ke ODC (ada masalah?)
6. 📱 Klik [Info WiFi] untuk cek modem
7. 📡 Klik [Redaman] untuk cek signal
8. 🔄 Klik [Reboot Router] jika perlu
```

### **Dokumentasi/Screenshot:**
```
1. 🗺️ Atur zoom dan posisi peta sesuai kebutuhan
2. 🔘 Klik toggle untuk sembunyikan garis (peta lebih bersih)
3. 📷 Screenshot peta
4. 🔘 Klik toggle lagi untuk tampilkan garis
5. 📷 Screenshot dengan topologi lengkap
6. 📄 Gunakan untuk laporan atau dokumentasi
```

### **Presentasi/Meeting:**
```
1. ⛶ Masuk mode fullscreen
2. ✅ Aktifkan auto-refresh (data selalu update)
3. ● Tampilkan garis koneksi
4. 🎨 Jelaskan warna: Hijau=bagus, Merah=masalah
5. 🖱️ Klik marker untuk show detail
6. 💬 Modal tetap terlihat saat fullscreen!
```

---

## ⚡ **TIPS & TRIK**

### **Performa Optimal:**
💡 **CPU tinggi?** → Sembunyikan garis koneksi (50% lebih ringan)  
💡 **Banyak customer?** → Gunakan filter untuk fokus area tertentu  
💡 **Device lemah?** → Matikan auto-refresh saat tidak perlu  
💡 **Animasi lag?** → Sembunyikan garis sementara

### **Monitoring Efisien:**
💡 **Garis merah = prioritas** → Troubleshoot customer offline dulu  
💡 **Auto-refresh + fullscreen** → Setup monitoring 24/7  
💡 **Filter area** → Fokus satu ODC atau ODP saja  
💡 **Toggle garis** → On saat monitoring, Off saat cari marker

### **Troubleshooting Cepat:**
💡 **Banyak merah?** → Cek ODC/ODP (mungkin masalah upstream)  
💡 **Garis oranye putus?** → ODP tidak terhubung ke ODC  
💡 **Semua abu-abu?** → Refresh data PPPoE (klik Refresh Data)  
💡 **Popup tidak muncul?** → Pastikan tidak sedang loading

---

## 🆘 **TROUBLESHOOTING**

### **Problem 1: Auto-refresh tidak jalan**
**Gejala:** Checkbox tercentang tapi data tidak refresh  
**Solusi:**
1. Buka Console (F12) → cek error
2. Uncheck dan check lagi checkbox
3. Refresh halaman (F5)
4. Pastikan koneksi internet stabil

### **Problem 2: Garis koneksi tidak muncul**
**Gejala:** Peta tampil tapi tidak ada garis  
**Solusi:**
1. Pastikan tombol "Koneksi" **HIJAU SOLID** (bukan outline)
2. Klik tombol toggle untuk aktifkan
3. Cek filter - pastikan ODC, ODP, Customer tercentang
4. Refresh halaman

### **Problem 3: Popup tidak terlihat di fullscreen**
**Gejala:** Masuk fullscreen, popup hilang  
**Solusi:**
- ✅ Masalah ini **SUDAH DIPERBAIKI**
- Jika masih terjadi, refresh halaman (Ctrl+F5)
- Update browser ke versi terbaru

### **Problem 4: Animasi lag/patah-patah**
**Gejala:** Garis koneksi animasinya tidak smooth  
**Solusi:**
1. Sembunyikan garis untuk kurangi load
2. Tutup tab browser lain
3. Cek CPU usage di Task Manager
4. Gunakan filter untuk kurangi jumlah marker

### **Problem 5: Tombol toggle tidak respon**
**Gejala:** Klik tombol tapi garis tidak hilang/muncul  
**Solusi:**
1. Tunggu sampai loading selesai
2. Pastikan peta sudah fully loaded
3. Refresh halaman
4. Cek Console (F12) untuk error

---

## ❓ **FAQ (Frequently Asked Questions)**

### **Q: Berapa detik interval auto-refresh?**
**A:** 30 detik. Tidak bisa diubah (sudah optimal untuk performa).

### **Q: Apakah auto-refresh akan bentrok dengan refresh manual?**
**A:** Tidak! Sistem sudah pintar. Jika Anda klik refresh manual, auto-refresh akan skip cycle tersebut.

### **Q: Apakah garis koneksi memberatkan?**
**A:** Tidak untuk jumlah normal (<100 customer). Jika terasa berat, gunakan tombol toggle untuk sembunyikan.

### **Q: Kenapa ada garis abu-abu?**
**A:** Karena data PPPoE tidak tersedia atau gagal diambil. Customer mungkin offline atau tidak pakai PPPoE.

### **Q: Apakah auto-refresh akan jalan terus setelah saya tutup halaman?**
**A:** Tidak. Auto-refresh otomatis berhenti saat halaman ditutup atau di-refresh.

### **Q: Berapa lama animasi garis berjalan?**
**A:** Hijau (online) = 1 detik, Merah (offline) = 3 detik, Abu-abu = 2.5 detik, Oranye = 2 detik.

### **Q: Apakah fitur ini work di mobile?**
**A:** Ya! Semua fitur responsive dan touch-friendly untuk mobile.

### **Q: Bagaimana cara screenshot peta yang bersih?**
**A:** Klik tombol "Koneksi" untuk sembunyikan garis, lalu screenshot.

### **Q: Apakah popup tetap terlihat di fullscreen?**
**A:** Ya! Masalah ini sudah diperbaiki. Popup dan modal 100% terlihat di fullscreen.

### **Q: Berapa batas maksimal customer di peta?**
**A:** Tidak ada batas hard limit, tapi optimal di bawah 100-200 customer untuk performa terbaik.

---

## 📞 **DUKUNGAN**

### **Jika Menemukan Bug:**
1. Catat apa yang Anda lakukan sebelum bug terjadi
2. Screenshot error (jika ada)
3. Buka Console (F12) → screenshot error message
4. Laporkan ke admin/IT support

### **Request Fitur Baru:**
Silakan ajukan request fitur ke tim development dengan detail:
- Apa yang ingin ditambahkan
- Kenapa fitur tersebut berguna
- Bagaimana cara kerjanya (jika ada ide)

---

## 🎉 **PENUTUP**

Selamat menggunakan Peta Jaringan Teknisi yang telah ditingkatkan! Fitur-fitur baru ini dirancang untuk membuat pekerjaan Anda lebih efisien dan monitoring jaringan lebih mudah.

### **Ringkasan Fitur:**
✨ **Auto-Refresh** → Data selalu up-to-date  
✨ **Garis Koneksi** → Visualisasi topologi jelas  
✨ **Tombol Toggle** → Kontrol penuh atas tampilan  
✨ **Fullscreen** → Popup tetap terlihat

### **Tips Terakhir:**
💡 Eksplorasi fitur-fitur baru  
💡 Berikan feedback jika ada yang bisa diperbaiki  
💡 Manfaatkan auto-refresh untuk monitoring real-time  
💡 Gunakan warna garis sebagai indikator cepat status

**Selamat bekerja! 🚀**

---

**Panduan Pengguna v1.0**  
**Terakhir diperbarui:** 2025-11-07  
**Untuk pertanyaan lebih lanjut, hubungi tim IT support.**
