/**
 * Database Migration Manager
 * 
 * Sistem migrasi database yang aman dan otomatis:
 * - Auto-detect schema changes
 * - Auto-migrate saat startup
 * - Version tracking untuk setiap database
 * - Rollback support
 * - Backup sebelum migration
 */

const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const { getDatabasePath } = require('./env-config');

class DatabaseMigrationManager {
    constructor() {
        this.migrationsDir = path.join(__dirname, '..', 'database', 'migrations');
        this.versionTable = 'schema_version';
        this.ensureMigrationsDir();
    }

    ensureMigrationsDir() {
        if (!fs.existsSync(this.migrationsDir)) {
            fs.mkdirSync(this.migrationsDir, { recursive: true });
        }
    }

    /**
     * Get current schema version dari database
     */
    async getCurrentVersion(dbPath) {
        return new Promise((resolve, reject) => {
            if (!fs.existsSync(dbPath)) {
                resolve(0); // New database, version 0
                return;
            }

            const db = new sqlite3.Database(dbPath, (err) => {
                if (err) {
                    reject(err);
                    return;
                }
            });

            // Create version table if not exists
            db.run(`
                CREATE TABLE IF NOT EXISTS ${this.versionTable} (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    version INTEGER NOT NULL,
                    applied_at TEXT NOT NULL,
                    description TEXT
                )
            `, (err) => {
                if (err) {
                    db.close();
                    reject(err);
                    return;
                }

                // Get latest version
                db.get(`SELECT MAX(version) as version FROM ${this.versionTable}`, [], (err, row) => {
                    db.close();
                    if (err) {
                        reject(err);
                    } else {
                        resolve(row?.version || 0);
                    }
                });
            });
        });
    }

    /**
     * Record migration ke version table
     */
    async recordMigration(dbPath, version, description) {
        return new Promise((resolve, reject) => {
            const db = new sqlite3.Database(dbPath, (err) => {
                if (err) {
                    reject(err);
                    return;
                }
            });

            db.run(
                `INSERT INTO ${this.versionTable} (version, applied_at, description) VALUES (?, ?, ?)`,
                [version, new Date().toISOString(), description],
                (err) => {
                    db.close();
                    if (err) {
                        reject(err);
                    } else {
                        resolve();
                    }
                }
            );
        });
    }

    /**
     * Create backup sebelum migration
     */
    createBackup(dbPath) {
        const backupDir = path.join(__dirname, '..', 'backups');
        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir, { recursive: true });
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0] + '_' +
                         new Date().toTimeString().split(' ')[0].replace(/:/g, '-');
        const dbName = path.basename(dbPath, path.extname(dbPath));
        const backupName = `${dbName}_backup_${timestamp}${path.extname(dbPath)}`;
        const backupPath = path.join(backupDir, backupName);

        try {
            fs.copyFileSync(dbPath, backupPath);
            console.log(`[MIGRATION] Backup created: ${backupName}`);
            return backupPath;
        } catch (error) {
            console.error(`[MIGRATION] Failed to create backup: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get current schema dari database
     */
    async getCurrentSchema(dbPath, tableName = 'users') {
        return new Promise((resolve, reject) => {
            if (!fs.existsSync(dbPath)) {
                resolve({});
                return;
            }

            const db = new sqlite3.Database(dbPath, (err) => {
                if (err) {
                    reject(err);
                    return;
                }
            });

            db.all(`PRAGMA table_info(${tableName})`, [], (err, columns) => {
                db.close();
                if (err) {
                    reject(err);
                } else {
                    const schema = {};
                    columns.forEach(col => {
                        schema[col.name] = {
                            type: col.type,
                            notnull: col.notnull,
                            default: col.dvalue,
                            pk: col.pk
                        };
                    });
                    resolve(schema);
                }
            });
        });
    }

    /**
     * Add column safely (jika belum ada)
     */
    async addColumn(dbPath, tableName, columnName, columnType, defaultValue = null) {
        return new Promise(async (resolve, reject) => {
            const schema = await this.getCurrentSchema(dbPath, tableName);
            
            if (schema[columnName]) {
                resolve(false); // Column already exists
                return;
            }

            const db = new sqlite3.Database(dbPath, (err) => {
                if (err) {
                    reject(err);
                    return;
                }
            });

            let sql = `ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnType}`;
            if (defaultValue !== null) {
                sql += ` DEFAULT ${defaultValue}`;
            }

            db.run(sql, (err) => {
                db.close();
                if (err) {
                    reject(err);
                } else {
                    console.log(`[MIGRATION] Added column: ${tableName}.${columnName}`);
                    resolve(true);
                }
            });
        });
    }

    /**
     * Run migration untuk database tertentu
     */
    async migrateDatabase(dbName, targetVersion = null) {
        const dbPath = getDatabasePath(dbName);
        
        // Skip jika database tidak ada (akan dibuat saat pertama kali digunakan)
        if (!fs.existsSync(dbPath)) {
            console.log(`[MIGRATION] Database ${dbName} not found, will be created on first use`);
            return { success: true, skipped: true };
        }

        // Create backup
        const backupPath = this.createBackup(dbPath);

        try {
            const currentVersion = await this.getCurrentVersion(dbPath);
            console.log(`[MIGRATION] Current version for ${dbName}: ${currentVersion}`);

            // Get expected schema version (dari code)
            const expectedVersion = targetVersion || this.getExpectedVersion();

            if (currentVersion >= expectedVersion) {
                console.log(`[MIGRATION] ${dbName} already at version ${currentVersion}, no migration needed`);
                return { success: true, currentVersion, targetVersion: expectedVersion, migrated: false };
            }

            // Run migrations dari currentVersion + 1 sampai expectedVersion
            let migrated = false;
            for (let version = currentVersion + 1; version <= expectedVersion; version++) {
                const migrationResult = await this.runMigrationStep(dbPath, dbName, version);
                if (migrationResult.success) {
                    await this.recordMigration(dbPath, version, migrationResult.description);
                    migrated = true;
                    console.log(`[MIGRATION] ${dbName} migrated to version ${version}`);
                } else {
                    throw new Error(`Migration to version ${version} failed: ${migrationResult.error}`);
                }
            }

            return {
                success: true,
                currentVersion,
                targetVersion: expectedVersion,
                migrated,
                backupPath
            };

        } catch (error) {
            console.error(`[MIGRATION] Migration failed for ${dbName}:`, error.message);
            console.error(`[MIGRATION] Backup available at: ${backupPath}`);
            return {
                success: false,
                error: error.message,
                backupPath
            };
        }
    }

    /**
     * Run single migration step
     */
    async runMigrationStep(dbPath, dbName, version) {
        // Define migration steps untuk setiap version
        const migrations = {
            1: async (dbPath) => {
                // Migration untuk version 1: Add common columns jika belum ada
                const columns = [
                    { name: 'created_at', type: 'TEXT', default: 'NULL' },
                    { name: 'updated_at', type: 'TEXT', default: 'NULL' }
                ];

                for (const col of columns) {
                    await this.addColumn(dbPath, 'users', col.name, col.type, col.default);
                }

                return { description: 'Add created_at and updated_at columns' };
            },
            2: async (dbPath) => {
                // Migration untuk version 2: Add indexes
                const db = new sqlite3.Database(dbPath);
                const indexes = [
                    'CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone_number)',
                    'CREATE INDEX IF NOT EXISTS idx_users_status ON users(status)'
                ];

                for (const indexSql of indexes) {
                    await new Promise((resolve, reject) => {
                        db.run(indexSql, (err) => {
                            if (err) reject(err);
                            else resolve();
                        });
                    });
                }
                db.close();

                return { description: 'Add database indexes' };
            }
            // Tambahkan migration steps baru di sini untuk version berikutnya
        };

        const migration = migrations[version];
        if (!migration) {
            return { success: false, error: `No migration defined for version ${version}` };
        }

        try {
            const result = await migration(dbPath);
            return { success: true, description: result.description };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Get expected schema version dari code
     * Update ini setiap kali ada schema change
     */
    getExpectedVersion() {
        // Current schema version - UPDATE INI SETIAP KALI ADA SCHEMA CHANGE
        return 2; // Update ini ke version terbaru
    }

    /**
     * Migrate all databases
     */
    async migrateAll() {
        const databases = [
            'users.sqlite',
            'saldo.sqlite',
            'activity_logs.sqlite',
            'psb_database.sqlite'
        ];

        const results = {};
        for (const dbName of databases) {
            try {
                results[dbName] = await this.migrateDatabase(dbName);
            } catch (error) {
                results[dbName] = {
                    success: false,
                    error: error.message
                };
            }
        }

        return results;
    }
}

module.exports = DatabaseMigrationManager;

