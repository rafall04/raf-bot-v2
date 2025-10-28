# 🚀 QUICK START - Upload ke GitHub

## ✅ Yang Sudah Dilakukan:
1. ✅ Git repository sudah diinisialisasi
2. ✅ `.gitignore` sudah dikonfigurasi (data sensitif tidak akan terupload)
3. ✅ Initial commit sudah dibuat
4. ✅ Auto-commit system sudah disiapkan

## 📤 Langkah Upload ke GitHub:

### 1️⃣ Buat Repository di GitHub
- Buka https://github.com/new
- Nama: `raf-bot-v2`
- Set sebagai **Private**
- **JANGAN** centang apapun (README, .gitignore, license)

### 2️⃣ Upload Code (Pilih salah satu):

#### **Option A - Menggunakan Script (MUDAH)**
```bash
setup-github.bat
```
Ikuti petunjuk di layar.

#### **Option B - Manual Command**
```bash
git remote add origin https://github.com/USERNAME/raf-bot-v2.git
git push -u origin main
```

### 3️⃣ Setup Auto-Commit (OPTIONAL)

#### **Start Auto-Commit Service:**
```bash
start-auto-commit.bat
```

Atau jalankan manual:
```bash
npm run auto-commit
```

## 📋 File Penting:

| File | Fungsi |
|------|--------|
| `setup-github.bat` | Script upload ke GitHub (interactive) |
| `start-auto-commit.bat` | Jalankan auto-commit service |
| `auto-commit.js` | Auto-commit engine (Node.js) |
| `auto-commit.bat` | Auto-commit simple (Windows) |
| `config.example.json` | Template config tanpa data sensitif |
| `.gitignore` | Daftar file yang tidak diupload |

## ⚠️ PENTING:

### Data yang TIDAK terupload (aman):
- ✅ `config.json` (berisi API keys)
- ✅ Database files (data pelanggan)
- ✅ Session files (WhatsApp auth)
- ✅ Upload files (foto/dokumen user)

### Yang AKAN terupload:
- ✅ Source code
- ✅ Documentation
- ✅ Static files
- ✅ Views/templates
- ✅ config.example.json (template only)

## 🔑 GitHub Authentication:

Saat push pertama kali, GitHub akan minta:
- **Username:** Username GitHub Anda
- **Password:** Gunakan Personal Access Token (BUKAN password)

### Cara buat token:
1. https://github.com/settings/tokens
2. Generate new token (classic)
3. Check `repo` permission
4. Copy token dan gunakan sebagai password

## 💡 Tips:

1. **Test auto-commit dulu:**
   ```bash
   # Edit file apapun, lalu tunggu 10 detik
   # Auto-commit akan jalan otomatis
   ```

2. **Lihat status:**
   ```bash
   git status
   git log --oneline -5
   ```

3. **Jika ada error push:**
   - Cek internet connection
   - Cek GitHub token/credentials
   - Pastikan repository sudah dibuat

---

**Support:** Lihat `GITHUB_SETUP.md` untuk panduan lengkap.
