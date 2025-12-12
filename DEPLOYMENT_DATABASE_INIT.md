# Mekanisme Database Initialization di Production

## 📋 Overview

Ketika pertama kali deploy di production, database SQLite **tidak ikut ter-push** ke GitHub (karena di `.gitignore`). Sistem memiliki mekanisme **auto-creation** dan **auto-migration** untuk handle database kosong.

---

## 🔄 Alur Startup (Urutan Eksekusi)

### 1. **Environment Validation** (`index.js`)
```javascript
validateEnvironment() // Cek config, path, dll
```

### 2. **Database Initialization** (`lib/database.js`)
```javascript
initializeDatabase() // Membuat users.sqlite + users table jika belum ada
```

**Yang terjadi:**
- ✅ Cek apakah `users.sqlite` ada
- ✅ Jika **TIDAK ADA**: Buat database baru + create `users` table dengan schema lengkap
- ✅ Load users ke `global.users`
- ✅ Setup file watchers untuk JSON files

### 3. **Auto-Migration** (`scripts/auto-migrate-on-startup.js`)
```javascript
runAutoMigration() // Run migration untuk semua databases
```

**Yang terjadi:**
- ✅ Cek version untuk setiap database
- ⚠️ Jika database **TIDAK ADA**: Skip dengan message "will be created on first use"
- ✅ Jika database **ADA**: Run migration steps

### 4. **Module-Specific Initialization** (Lazy Loading)

Database lain dibuat saat pertama kali digunakan:

- **`saldo.sqlite`**: Dibuat saat `initSaldoDatabase()` dipanggil
  - Location: `lib/saldo-manager.js`
  - Table: `user_saldo` (auto-created dengan `CREATE TABLE IF NOT EXISTS`)

- **`activity_logs.sqlite`**: Dibuat saat `initializeActivityLogTables()` dipanggil
  - Location: `lib/activity-logger.js`
  - Tables: `login_logs`, `activity_logs` (auto-created)

- **`psb_database.sqlite`**: Dibuat saat `initializePSBDatabase()` dipanggil
  - Location: `lib/psb-database.js`
  - Table: `psb_records` (auto-created)

---

## ⚠️ **Masalah Saat Ini**

### Gap antara Auto-Creation dan Migration

1. **Migration Manager Skip Database Baru**
   ```javascript
   // lib/database-migration-manager.js:214
   if (!fs.existsSync(dbPath)) {
       console.log(`[MIGRATION] Database ${dbName} not found, will be created on first use`);
       return { success: true, skipped: true }; // ❌ Skip migration
   }
   ```

2. **Database Dibuat oleh Module (Bukan Migration)**
   - `users.sqlite` → Dibuat oleh `initializeDatabase()` dengan schema lengkap
   - `saldo.sqlite` → Dibuat oleh `initSaldoDatabase()` dengan schema dasar
   - `activity_logs.sqlite` → Dibuat oleh `initializeActivityLogTables()` dengan schema lengkap
   - `psb_database.sqlite` → Dibuat oleh `initializePSBDatabase()` dengan schema lengkap

3. **Migration Tidak Jalan untuk Database Baru**
   - Migration hanya jalan jika database **sudah ada**
   - Database baru dibuat dengan schema dari module (bukan dari migration)
   - Migration steps (version 1, 2, dll) tidak ter-apply untuk database baru

---

## ✅ **Solusi yang Sudah Ada (Current Behavior)**

### Untuk `users.sqlite`:
- ✅ Dibuat dengan schema lengkap di `initializeDatabase()`
- ✅ Sudah include `created_at`, `updated_at` (version 1)
- ✅ Sudah include indexes (version 2)
- ✅ **Migration tidak perlu** karena schema sudah lengkap

### Untuk `saldo.sqlite`:
- ✅ Dibuat dengan schema dasar di `initSaldoDatabase()`
- ✅ Sudah include `created_at`, `updated_at` (version 1)
- ✅ Sudah include index `idx_user_saldo_user_id` (version 2)
- ✅ **Migration tidak perlu** karena schema sudah lengkap

### Untuk `activity_logs.sqlite`:
- ✅ Dibuat dengan schema lengkap di `initializeActivityLogTables()`
- ✅ Sudah include timestamp columns (version 1 - skip)
- ✅ Sudah include indexes (version 2 - skip)
- ✅ **Migration tidak perlu** karena schema sudah lengkap

### Untuk `psb_database.sqlite`:
- ✅ Dibuat dengan schema lengkap di `initializePSBDatabase()`
- ✅ Sudah include `created_at`, `updated_at` (version 1 - akan skip jika sudah ada)
- ⚠️ **Belum ada indexes** (perlu migration version 2 untuk add indexes)
- ✅ **Migration akan jalan** setelah database dibuat (tapi version 1 akan skip karena column sudah ada)

---

## 🔧 **Rekomendasi Perbaikan**

### Opsi 1: **Migration Manager Create Database** (Recommended)

Update migration manager untuk create database + table jika belum ada:

```javascript
async migrateDatabase(dbName, targetVersion = null) {
    const dbPath = getDatabasePath(dbName);
    
    // Jika database tidak ada, create dengan schema dasar
    if (!fs.existsSync(dbPath)) {
        await this.createDatabaseWithBaseSchema(dbName, dbPath);
    }
    
    // Lanjutkan migration seperti biasa
    // ...
}
```

**Keuntungan:**
- ✅ Migration menjadi single source of truth untuk schema
- ✅ Semua database menggunakan migration system
- ✅ Konsisten untuk semua database

**Kekurangan:**
- ⚠️ Perlu refactor module initialization (jangan create table sendiri)

### Opsi 2: **Migration Manager Retry Setelah Database Dibuat**

Update migration manager untuk retry jika database baru dibuat:

```javascript
async migrateDatabase(dbName, targetVersion = null) {
    const dbPath = getDatabasePath(dbPath);
    
    if (!fs.existsSync(dbPath)) {
        // Wait for module to create database (max 5 seconds)
        await this.waitForDatabase(dbPath, 5000);
    }
    
    // Lanjutkan migration
    // ...
}
```

**Keuntungan:**
- ✅ Tidak perlu refactor module initialization
- ✅ Migration tetap jalan untuk database baru

**Kekurangan:**
- ⚠️ Race condition risk (module mungkin belum selesai create)
- ⚠️ Perlu polling/waiting mechanism

### Opsi 3: **Manual Migration Setelah First Use** (Current - Acceptable)

Biarkan seperti sekarang, tapi dokumentasikan:

1. Database dibuat oleh module dengan schema lengkap
2. Migration hanya untuk update schema yang sudah ada
3. Untuk database baru, schema sudah lengkap dari awal

**Keuntungan:**
- ✅ Tidak perlu perubahan code
- ✅ Database baru langsung siap pakai

**Kekurangan:**
- ⚠️ Schema di module dan migration bisa tidak sync
- ⚠️ Perlu maintain schema di 2 tempat (module + migration)

---

## 📝 **Kesimpulan & Rekomendasi**

### Untuk Production (First Time Deploy):

1. **Database akan dibuat otomatis** saat aplikasi start
2. **Schema sudah lengkap** dari module initialization
3. **Migration tidak perlu** untuk database baru (schema sudah sesuai)
4. **Migration hanya untuk update** database yang sudah ada

### Yang Perlu Diperhatikan:

1. ✅ **`users.sqlite`**: Schema lengkap, migration tidak perlu
2. ✅ **`saldo.sqlite`**: Schema lengkap, migration tidak perlu
3. ✅ **`activity_logs.sqlite`**: Schema lengkap, migration tidak perlu
4. ⚠️ **`psb_database.sqlite`**: Perlu cek apakah schema sudah include `created_at`, `updated_at`, dan indexes

### Action Items:

1. **Cek `lib/psb-database.js`**: Pastikan schema sudah include semua columns yang diperlukan
2. **Update migration manager** (opsional): Tambahkan logic untuk create database jika belum ada
3. **Dokumentasi**: Update `DEPLOYMENT_GUIDE.md` dengan mekanisme ini

---

## 🚀 **Deployment Checklist untuk Production Baru**

- [ ] Clone repository dari GitHub
- [ ] Install dependencies: `npm install`
- [ ] Setup `.env` dan `config.json`
- [ ] Start aplikasi: `npm start`
- [ ] Database akan dibuat otomatis:
  - [ ] `database/users.sqlite` (dengan `users` table)
  - [ ] `database/saldo.sqlite` (dengan `user_saldo` table)
  - [ ] `database/activity_logs.sqlite` (dengan `login_logs`, `activity_logs` tables)
  - [ ] `database/psb_database.sqlite` (dengan `psb_records` table)
- [ ] Migration akan jalan otomatis (jika database sudah ada)
- [ ] Aplikasi siap digunakan

---

## 📚 **Referensi**

- `lib/database.js` - Users database initialization
- `lib/saldo-manager.js` - Saldo database initialization
- `lib/activity-logger.js` - Activity logs database initialization
- `lib/psb-database.js` - PSB database initialization
- `lib/database-migration-manager.js` - Migration system
- `scripts/auto-migrate-on-startup.js` - Auto-migration on startup

