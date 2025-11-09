# Database Migration Guide for RAF-BOT V2

## Overview
This guide explains how to migrate old SQLite databases to be compatible with the current RAF-BOT V2 schema.

## Problem
When replacing `database.sqlite` with an old backup, you may encounter errors like:
- **400 Bad Request** - Missing required fields
- **500 Internal Server Error** - Database schema mismatch
- **"no column named latitude"** - Missing columns in old database

## Solution: Smart Migration System

### Features
✅ **Automatic Detection** - Identifies all missing columns  
✅ **Safe Migration** - Creates backup before any changes  
✅ **Preserves Data** - All existing data remains intact  
✅ **Smart Defaults** - Adds columns with appropriate default values  
✅ **Index Creation** - Ensures optimal performance  
✅ **Auto-Reload** - No restart needed after migration/upload  
✅ **Zero Downtime** - Application keeps running normally  

### Quick Start

#### Method 1: Upload Database File (NEW - Easiest!)
1. Login to admin panel
2. Go to **System > Migrasi Database**
3. Use **"Upload Database Lama"** section
4. Click **"Pilih file database"** and select your old .sqlite file
5. Keep **"Jalankan migrasi otomatis"** checked
6. Click **"Upload & Replace Database"**
7. System will automatically:
   - Validate the database file
   - Create backup of current database
   - Replace with uploaded database
   - Run migration automatically
   - **Auto-reload to memory (NO RESTART NEEDED!)**
   - Show results

#### Method 2: Web Interface (Manual Migration)
1. Login to admin panel
2. Navigate to **System > Migrasi Database** or click **Migrasi DB** button in Users page
3. Click **"Cek Skema Database"** to check for missing columns
4. Click **"Mulai Migrasi Database"** to run migration
5. View and manage backups from the interface

#### Method 3: Using Batch File
```batch
migrate-database.bat
```

#### Method 4: Direct Command
```bash
node tools/smart-migrate-database.js
```

### What It Does

1. **Creates Backup**
   - Saves current database in `backups/` folder
   - Filename: `database.backup.[timestamp].sqlite`
   - Can be restored if needed

2. **Analyzes Schema**
   - Detects existing columns
   - Identifies missing columns
   - Compares with expected schema

3. **Adds Missing Columns**
   The tool will add any missing columns from this list:
   - Geographic: `latitude`, `longitude`
   - Billing: `paid`, `send_invoice`
   - Network: `connected_odp_id`, `pppoe_username`, `pppoe_password`
   - Corporate: `is_corporate`, `corporate_name`, `corporate_address`, etc.
   - System: `status`, `created_at`, `updated_at`
   - Authentication: `otp`, `otpTimestamp`
   - Others: `address`, `bulk`

4. **Creates Indexes**
   - `idx_users_phone` - Fast phone lookups
   - `idx_users_device` - Fast device queries
   - `idx_users_username` - Fast username searches
   - `idx_users_pppoe` - Fast PPPoE lookups

### Web Interface Features

The migration page (`/migrate`) provides:

1. **Upload Database (NEW)**
   - Upload old database files (.sqlite, .db, .sqlite3)
   - Maximum file size: 50MB
   - Automatic SQLite validation
   - Checks for users table existence
   - Optional auto-migration after upload
   - Shows migration results

2. **Database Information Panel**
   - Current database size
   - Total users count
   - Total columns count
   - Last modified date

3. **Schema Check Tool**
   - One-click schema validation
   - Lists all missing columns
   - Shows current columns
   - Migration recommendation

4. **Migration Tool**
   - Automatic backup creation
   - Safe column addition
   - Progress reporting
   - Success/error feedback

5. **Backup Management**
   - List all backups with timestamps
   - View backup sizes
   - One-click restore from any backup
   - Automatic refresh

### Testing

#### Verify Schema
```bash
node tools/test-database-schema.js
```

This will:
- Show current database schema
- Check for missing required columns
- Test insert capability
- Report migration status

#### Test API Endpoints
```bash
node test/test-database-api.js
```

This will:
- Verify migration script exists
- Check database status
- List available backups
- Test API endpoints

### Troubleshooting

#### Error: "Database not found"
- Ensure `database.sqlite` exists in root directory
- Check file permissions

#### Error: "Failed to create backup"
- Check disk space
- Ensure write permissions in directory

#### Error: "Migration failed"
- Check console output for specific error
- Restore from backup if needed:
  ```batch
  copy database.backup.[timestamp].sqlite database.sqlite
  ```

### Manual Restoration

If migration causes issues, restore your backup:

1. **Stop the application**
   ```batch
   Ctrl+C or close terminal
   ```

2. **Find backup file**
   Look in `backups/` folder for `database.backup.[timestamp].sqlite`

3. **Restore backup**
   ```batch
   copy backups\database.backup.1234567890.sqlite database.sqlite
   ```

4. **Restart application**
   ```batch
   npm start
   ```

### Expected Column Schema

The complete expected schema includes:

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| id | INTEGER | AUTO | Primary key |
| name | TEXT | 'User' | User's display name |
| username | TEXT | NULL | Login username |
| password | TEXT | NULL | Hashed password |
| phone_number | TEXT | NULL | Phone (can be multiple, pipe-separated) |
| address | TEXT | NULL | Physical address |
| latitude | REAL | NULL | GPS latitude |
| longitude | REAL | NULL | GPS longitude |
| subscription | TEXT | NULL | Package/subscription type |
| device_id | TEXT | NULL | GenieACS device ID |
| status | TEXT | 'active' | Account status |
| paid | INTEGER | 0 | Payment status (0/1) |
| send_invoice | INTEGER | 1 | Invoice preference (0/1) |
| is_corporate | INTEGER | 0 | Corporate account flag |
| corporate_* | TEXT | NULL | Corporate account fields |
| pppoe_username | TEXT | NULL | PPPoE username |
| pppoe_password | TEXT | NULL | PPPoE password |
| connected_odp_id | INTEGER | NULL | Connected ODP reference |
| bulk | TEXT | NULL | JSON array for bulk data |
| created_at | TEXT | CURRENT_TIMESTAMP | Creation timestamp |
| updated_at | TEXT | CURRENT_TIMESTAMP | Last update timestamp |

### Best Practices

1. **Always backup first** - The tool does this automatically
2. **Test after migration** - Use test-database-schema.js
3. **Keep backups** - Store backups for at least 7 days
4. **Document changes** - Note when migrations are run

### Support

If issues persist after migration:

1. Check error logs in `/logs` directory
2. Run schema test: `node tools/test-database-schema.js`
3. Review this guide for troubleshooting steps
4. Restore from backup if needed

### Version History

- **v1.0.0** - Initial smart migration tool
- Supports automatic schema detection
- Handles all current RAF-BOT V2 fields
- Creates performance indexes

---

*Last Updated: November 2024*
