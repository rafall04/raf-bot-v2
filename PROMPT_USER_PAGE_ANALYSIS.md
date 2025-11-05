# 🔍 PROMPT: ANALISIS LENGKAP HALAMAN USER

## 📋 KONTEKS
Saya perlu menganalisis halaman user (users.php) untuk memastikan semua fungsionalitas berjalan dengan baik, data tampil dengan benar, dan tidak ada error atau bug.

## 🎯 TUJUAN ANALISIS
1. Identifikasi semua fitur yang ada di halaman user
2. Check apakah data dari database SQLite tampil dengan benar
3. Verifikasi semua field dan kolom terisi dengan data yang sesuai
4. Temukan potential bugs atau improvements
5. Pastikan konsistensi dengan halaman lain

## 🔍 YANG PERLU DIANALISIS

### 1. DATA DISPLAY
- [ ] Apakah semua kolom di tabel terisi dengan benar?
- [ ] Field yang harus ada: ID, Name, Username, Phone Number, Address, Package, Status
- [ ] Apakah ada field yang kosong/undefined padahal di database ada?
- [ ] Format data (tanggal, nomor telepon, dll) sudah benar?

### 2. HEADER & NAVIGATION
- [ ] Nama user login tampil di header? (bukan generic "Admin")
- [ ] Foto profil tampil dengan benar?
- [ ] Menu navigation active state benar?
- [ ] Logout button berfungsi?

### 3. CRUD OPERATIONS
- [ ] CREATE: Form tambah user berfungsi?
- [ ] READ: Data load dari database SQLite (bukan JSON)?
- [ ] UPDATE: Edit user data tersimpan ke database?
- [ ] DELETE: Hapus user berfungsi dengan konfirmasi?

### 4. API ENDPOINTS
- [ ] GET /api/users - Return data dari SQLite
- [ ] POST /api/users - Create user baru ke SQLite
- [ ] PUT /api/users/:id - Update user di SQLite
- [ ] DELETE /api/users/:id - Delete user dari SQLite

### 5. DATABASE STRUCTURE
```sql
-- Expected SQLite users table structure:
CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    name TEXT,
    username TEXT,
    phone_number TEXT,
    address TEXT,
    subscription TEXT,
    device_id TEXT,
    status TEXT,
    -- other fields as needed
);
```

## 📂 FILE YANG PERLU DIPERIKSA

### Frontend:
1. `views/sb-admin/users.php` - Main page
2. `views/sb-admin/_navbar.php` - Sidebar navigation
3. `static/js/` - JavaScript files for DataTable

### Backend:
1. `routes/users.js` - User API routes
2. `routes/api.js` - General API routes (if user endpoints here)
3. `lib/database.js` - Database initialization and helpers
4. `index.js` - Authentication middleware

### Database:
1. `database.sqlite` - SQLite database file
2. Check: Users data loaded to `global.users` on startup

## ❓ PERTANYAAN INVESTIGASI

1. **Data Loading:**
   - Apakah users di-load dari SQLite atau masih dari JSON?
   - Command: `SELECT * FROM users` berjalan saat startup?
   - Global.users di-populate dengan benar?

2. **Display Issues:**
   - Ada field yang namanya berbeda? (name vs full_name)?
   - Phone number format konsisten? (62xxx)
   - Status badge tampil dengan warna yang benar?

3. **Authentication:**
   - JWT token include user data lengkap?
   - Session/cookie menyimpan data yang diperlukan?
   - Middleware pass data ke views dengan benar?

4. **Error Handling:**
   - Ada error di console browser?
   - Ada error di server logs?
   - Network request gagal?

## 🔧 EXPECTED FIXES

### If nama/foto tidak muncul di header:
```javascript
// Check JWT payload includes:
{
  id: user.id,
  name: user.name,        // NOT full_name
  username: user.username,
  photo: user.photo,      // With fallback
  role: user.role
}
```

### If data tidak tampil di tabel:
```javascript
// Check DataTable initialization:
$('#dataTable').DataTable({
  ajax: '/api/users',     // Correct endpoint
  columns: [
    { data: 'id' },
    { data: 'name' },     // NOT full_name
    { data: 'username' },
    { data: 'phone_number' },
    { data: 'address' },
    { data: 'subscription' },
    { data: 'status' }
  ]
});
```

### If API tidak return data:
```javascript
// Check routes/users.js atau routes/api.js:
router.get('/api/users', (req, res) => {
  // Should query from SQLite, NOT read JSON
  db.all('SELECT * FROM users', (err, users) => {
    res.json({
      data: users  // DataTable expects 'data' key
    });
  });
});
```

## 📊 CHECKLIST VERIFIKASI

### Pre-Check:
- [ ] Login sebagai admin
- [ ] Browser console terbuka (F12)
- [ ] Network tab aktif untuk monitor requests

### Main Checks:
- [ ] Halaman users load tanpa error
- [ ] Tabel menampilkan data users
- [ ] Semua kolom terisi dengan benar
- [ ] Pagination berfungsi
- [ ] Search/filter berfungsi
- [ ] Add user button ada dan berfungsi
- [ ] Edit button per row berfungsi
- [ ] Delete button per row berfungsi
- [ ] Header shows correct admin name
- [ ] No console errors
- [ ] No failed network requests

### Post-Check:
- [ ] Test add new user
- [ ] Test edit existing user
- [ ] Test delete user
- [ ] Verify changes persist after refresh

## 🚨 CRITICAL POINTS

### JANGAN UBAH:
1. Database structure SQLite yang sudah ada
2. Authentication flow yang sudah jalan
3. Global.users loading mechanism
4. Existing API contracts dengan WhatsApp bot

### HARUS MAINTAIN:
1. Backward compatibility dengan bot commands
2. Phone number format (62xxx)
3. User status values (active/inactive/suspended)
4. Package/subscription references

## 📋 OUTPUT YANG DIHARAPKAN

### Setelah analisis, berikan:
1. **Summary of Issues Found:**
   - List semua masalah yang ditemukan
   - Prioritas: HIGH/MEDIUM/LOW

2. **Root Cause Analysis:**
   - Kenapa masalah terjadi
   - File mana yang bermasalah
   - Line number spesifik

3. **Fix Implementation:**
   - Code changes dengan before/after
   - File path lengkap
   - Test steps

4. **Verification:**
   - Cara test fix sudah berhasil
   - Expected vs actual result

## 🎯 CONTOH PERINTAH

### Untuk execute prompt ini:
```
Tolong analisis halaman users.php sesuai checklist di PROMPT_USER_PAGE_ANALYSIS.md. Fokus pada:
1. Kenapa data tidak tampil/kosong
2. Fix header nama dan foto
3. Pastikan CRUD operations work
4. Verify SQLite integration

Output: Issue list + fixes + test verification
```

### Quick version:
```
Check halaman users.php - fix semua yang blank/error, pastikan pakai SQLite bukan JSON
```

## 📝 NOTES

- Users sekarang di SQLite, BUKAN di users.json
- Global.users di-load saat startup dari SQLite
- Authentication pakai JWT token
- DataTable untuk display data
- SweetAlert untuk confirmations
- Bootstrap untuk UI

---

**END OF PROMPT TEMPLATE**
