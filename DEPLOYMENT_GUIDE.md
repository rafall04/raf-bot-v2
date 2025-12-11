# Deployment Guide - Database Migration & Version Control

## 📋 Overview

Guide ini menjelaskan strategi deployment yang aman untuk project RAF Bot V2 dengan fokus pada:
1. **Database Protection** - Database tidak akan hilang saat push ke GitHub
2. **Auto Migration** - Database otomatis update saat ada schema changes
3. **Version Control** - Track schema version untuk setiap database
4. **Safe Updates** - Update kode tidak mengganggu database yang sudah jalan

---

## 🔒 1. Database Protection (GitHub)

### ✅ Database Files TIDAK akan di-commit ke GitHub

Semua file database sudah di-exclude di `.gitignore`:
- `database/*.sqlite`
- `database/*.sqlite3`
- `database/*.db`
- `backups/`

**Hasil:** Database production Anda **AMAN** dan tidak akan ter-overwrite oleh code dari GitHub.

---

## 🔄 2. Auto Migration System

### Cara Kerja:

1. **Schema Version Tracking**
   - Setiap database memiliki `schema_version` table
   - Track version number untuk setiap migration
   - Record timestamp dan description untuk setiap migration

2. **Auto-Migration on Startup**
   - Aplikasi otomatis check schema version saat startup
   - Jika version berbeda, auto-migrate ke version terbaru
   - Create backup otomatis sebelum migration

3. **Migration Steps**
   - Setiap version memiliki migration step yang jelas
   - Migration hanya menambah kolom/index, tidak menghapus data
   - Rollback support dengan backup

### Setup Auto-Migration:

**Option 1: Auto-migrate saat startup (Recommended)**

Tambahkan di `index.js` setelah `initializeDatabase()`:

```javascript
// Auto-migrate databases on startup
const { runAutoMigration } = require('./scripts/auto-migrate-on-startup');
runAutoMigration().catch(err => {
    console.error('[STARTUP] Auto-migration failed:', err);
    // Continue startup even if migration fails (for manual fix)
});
```

**Option 2: Manual migration sebelum deploy**

```bash
node scripts/auto-migrate-on-startup.js
```

---

## 📝 3. Menambah Schema Changes Baru

### Step-by-Step:

#### Step 1: Update Expected Version

Edit `lib/database-migration-manager.js`:

```javascript
getExpectedVersion() {
    return 3; // Update dari 2 ke 3
}
```

#### Step 2: Tambahkan Migration Step

Di `runMigrationStep()`, tambahkan migration untuk version baru:

```javascript
3: async (dbPath) => {
    // Migration untuk version 3: Add new column
    await this.addColumn(dbPath, 'users', 'new_field', 'TEXT', 'NULL');
    
    return { description: 'Add new_field column' };
}
```

#### Step 3: Test Migration

```bash
# Test di development
NODE_ENV=development node scripts/auto-migrate-on-startup.js

# Verify database
sqlite3 database/users_test.sqlite "PRAGMA table_info(users);"
```

#### Step 4: Commit & Deploy

```bash
git add lib/database-migration-manager.js
git commit -m "feat: add new_field column (migration v3)"
git push
```

#### Step 5: Deploy ke Production

Saat aplikasi start di production, migration akan otomatis jalan.

---

## 🚀 4. Deployment Workflow

### Pre-Deployment Checklist:

1. ✅ **Backup Database** (otomatis oleh migration system)
2. ✅ **Test Migration** di development environment
3. ✅ **Verify Schema Changes** tidak breaking
4. ✅ **Update Migration Version** di code

### Deployment Steps:

```bash
# 1. Pull latest code
git pull origin main

# 2. Install dependencies (jika ada)
npm install

# 3. Run migration (otomatis saat startup, atau manual):
node scripts/auto-migrate-on-startup.js

# 4. Restart aplikasi
npm restart
# atau
pm2 restart raf-bot
```

### Post-Deployment Verification:

```bash
# Check migration status
sqlite3 database/users.sqlite "SELECT * FROM schema_version ORDER BY version DESC LIMIT 5;"

# Verify schema
sqlite3 database/users.sqlite "PRAGMA table_info(users);"
```

---

## 🔧 5. Manual Migration (Jika Diperlukan)

### Rollback Migration:

```bash
# 1. Stop aplikasi
pm2 stop raf-bot

# 2. Restore dari backup
cp backups/users_backup_YYYY-MM-DD_HH-MM-SS.sqlite database/users.sqlite

# 3. Start aplikasi
pm2 start raf-bot
```

### Force Migration:

```bash
# Jika auto-migration gagal, jalankan manual:
node scripts/auto-migrate-on-startup.js
```

---

## 📊 6. Database Version Management

### Check Current Version:

```javascript
const DatabaseMigrationManager = require('./lib/database-migration-manager');
const manager = new DatabaseMigrationManager();

const version = await manager.getCurrentVersion('database/users.sqlite');
console.log('Current version:', version);
```

### Migration History:

```sql
-- Check migration history
SELECT * FROM schema_version ORDER BY version DESC;
```

---

## ⚠️ 7. Best Practices

### ✅ DO:

1. **Selalu backup sebelum migration** (otomatis)
2. **Test migration di development** sebelum production
3. **Update version number** setiap schema change
4. **Document migration** dengan description yang jelas
5. **Incremental changes** - jangan ubah banyak sekaligus

### ❌ DON'T:

1. **Jangan hapus kolom** - hanya tambah kolom baru
2. **Jangan ubah tipe data** existing kolom tanpa data migration
3. **Jangan skip version** - selalu increment 1 per 1
4. **Jangan commit database files** ke GitHub
5. **Jangan migrate tanpa backup**

---

## 🛡️ 8. Safety Features

### Automatic Backup:

- Backup otomatis dibuat sebelum setiap migration
- Backup disimpan di `backups/` dengan timestamp
- Format: `{dbname}_backup_YYYY-MM-DD_HH-MM-SS.sqlite`

### Error Handling:

- Migration gagal → aplikasi tetap start (untuk manual fix)
- Backup selalu dibuat sebelum migration
- Rollback support dengan restore backup

### Version Tracking:

- Setiap migration di-record di `schema_version` table
- Track version, timestamp, dan description
- Easy to audit migration history

---

## 📝 9. Example: Menambah Kolom Baru

### Scenario: Menambah kolom `email_verified` ke table `users`

#### Step 1: Update Code

```javascript
// lib/database-migration-manager.js
getExpectedVersion() {
    return 3; // Update dari 2 ke 3
}

// Tambahkan migration step:
3: async (dbPath) => {
    await this.addColumn(dbPath, 'users', 'email_verified', 'INTEGER', '0');
    return { description: 'Add email_verified column' };
}
```

#### Step 2: Test

```bash
# Test di development
NODE_ENV=development node scripts/auto-migrate-on-startup.js
```

#### Step 3: Deploy

```bash
git add lib/database-migration-manager.js
git commit -m "feat: add email_verified column (migration v3)"
git push
```

#### Step 4: Production

Saat aplikasi restart, migration otomatis jalan:
- Backup dibuat
- Kolom `email_verified` ditambahkan
- Version updated ke 3
- Aplikasi start normal

---

## 🎯 10. Summary

### ✅ Keuntungan Sistem Ini:

1. **Database Aman** - Tidak akan hilang atau ter-overwrite
2. **Auto Migration** - Tidak perlu manual migration setiap update
3. **Version Tracking** - Mudah track schema changes
4. **Rollback Support** - Bisa rollback jika ada masalah
5. **Zero Downtime** - Migration tidak mengganggu aplikasi yang jalan

### 📋 Workflow:

```
Developer → Update Code → Test Migration → Commit → Push → Deploy
                                                              ↓
                                                    Auto-Migration on Startup
                                                              ↓
                                                    Database Updated ✅
```

---

## 🆘 Troubleshooting

### Migration Gagal:

1. Check backup di `backups/`
2. Restore dari backup jika perlu
3. Fix migration code
4. Test lagi di development
5. Deploy ulang

### Version Mismatch:

1. Check `schema_version` table
2. Manual update version jika perlu
3. Re-run migration

### Database Corrupt:

1. Stop aplikasi
2. Restore dari backup terbaru
3. Check migration logs
4. Fix issue
5. Re-run migration

---

**Dengan sistem ini, Anda bisa update kode dengan aman tanpa khawatir database hilang atau corrupt!** 🚀

