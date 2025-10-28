# Perbaikan Multi-Word Keyword Parsing

## Masalah yang Diperbaiki

### 1. Multi-Word Keyword Parsing
**Masalah:** Ketika user mengetik "ganti sandi", kata "sandi" ikut masuk sebagai password
**Penyebab:** Handler tidak memperhitungkan jumlah kata dalam keyword
**Solusi:** Menggunakan `matchedKeywordLength` dari wifi_template_handler.js

### 2. Konfirmasi Ya/Tidak
**Masalah:** User tidak ingin konfirmasi ya/tidak
**Solusi:** Langsung eksekusi perubahan tanpa konfirmasi

## Perubahan yang Dilakukan

### 1. Di raf.js
```javascript
// Menambahkan matchedKeywordLength ke handler
case 'GANTI_SANDI_WIFI': {
    const result = await handleWifiPasswordChange({
        sender,
        pushname,
        entities,
        args,
        q,
        matchedKeywordLength,  // <-- Ditambahkan
        isOwner,
        isTeknisi,
        reply
    });
```

### 2. Di wifi-handler.js

#### handleWifiPasswordChange:
```javascript
// Sebelum (salah):
// args[0] selalu dianggap command
// args[1] selalu dianggap parameter pertama

// Sesudah (benar):
const keywordWordCount = matchedKeywordLength || 1;
// Jika "ganti sandi" = 2 kata
// Jika "gantisandi" = 1 kata

// Untuk admin dengan ID:
if ((isOwner || isTeknisi) && args.length > keywordWordCount && !isNaN(parseInt(args[keywordWordCount], 10))) {
    const targetId = args[keywordWordCount];  // ID di posisi setelah keyword
    newPassword = args.slice(keywordWordCount + 1).join(' ');  // Password setelah ID
}
// Untuk customer:
else {
    newPassword = args.slice(keywordWordCount).join(' ');  // Password setelah keyword
}
```

#### Langsung Eksekusi (Tanpa Konfirmasi):
```javascript
// Sebelum:
setUserState(sender, {
    step: 'CONFIRM_GANTI_SANDI',
    targetUser: user,
    sandi_wifi_baru: newPassword
});
return { message: 'Konfirmasi ya/tidak...' };

// Sesudah:
reply(`⏳ Sedang mengubah sandi WiFi untuk *${user.name}*...`);
const result = await changeWifiPassword(user.device_id, newPassword);
return { message: `✅ Berhasil! Sandi WiFi telah diubah menjadi: ${newPassword}` };
```

## Contoh Penggunaan

### Customer (Pelanggan Biasa):

#### Single-word keyword:
```
User: gantisandi halo1234
Bot: ⏳ Sedang mengubah sandi WiFi...
Bot: ✅ Berhasil! Sandi WiFi telah diubah menjadi: halo1234
```

#### Multi-word keyword:
```
User: ganti sandi halo1234
Bot: ⏳ Sedang mengubah sandi WiFi...
Bot: ✅ Berhasil! Sandi WiFi telah diubah menjadi: halo1234
```

```
User: ubah password Password123
Bot: ⏳ Sedang mengubah sandi WiFi...
Bot: ✅ Berhasil! Sandi WiFi telah diubah menjadi: Password123
```

### Admin/Teknisi:

#### Single-word keyword dengan ID:
```
Admin: gantisandi 1 halo1234
Bot: ⏳ Sedang mengubah sandi WiFi untuk Pak Budi...
Bot: ✅ Berhasil! Sandi WiFi telah diubah menjadi: halo1234
```

#### Multi-word keyword dengan ID:
```
Admin: ganti sandi 1 halo1234
Bot: ⏳ Sedang mengubah sandi WiFi untuk Pak Budi...
Bot: ✅ Berhasil! Sandi WiFi telah diubah menjadi: halo1234
```

### Tanpa Parameter (Meminta Input):
```
User: ganti sandi
Bot: 🔐 Silakan ketik sandi WiFi baru yang Anda inginkan.
User: halo1234
Bot: ⏳ Sedang mengubah sandi WiFi...
Bot: ✅ Berhasil! Sandi WiFi telah diubah menjadi: halo1234
```

## Keyword yang Didukung

### Ganti Sandi:
- `gantisandi` (1 kata)
- `ganti sandi` (2 kata)
- `ubah password` (2 kata)
- `ganti password` (2 kata)
- `reset sandi` (2 kata)
- `rubah sandi` (2 kata)
- `ubah sandi` (2 kata)
- `reset password` (2 kata)

### Ganti Nama:
- `gantinama` (1 kata)
- `ganti nama` (2 kata)
- `ubah ssid` (2 kata)
- `ganti ssid` (2 kata)
- `rubah nama` (2 kata)
- `ubah nama wifi` (3 kata)
- `ganti nama wifi` (3 kata)

## Testing

Test script tersedia di:
- `test-multiword-keywords.js` - Test parsing multi-word keywords
- `test-wifi-commands.js` - Test WiFi commands dengan parameter

## Status

✅ **FIXED** - Multi-word keyword parsing bekerja dengan benar
✅ **FIXED** - Tidak ada konfirmasi ya/tidak
✅ **TESTED** - Semua variasi keyword berfungsi
✅ **READY** - Siap digunakan di production

---

**Diperbaiki:** 15 Oktober 2024
**Oleh:** Cascade AI Assistant
**Versi:** 2.1
