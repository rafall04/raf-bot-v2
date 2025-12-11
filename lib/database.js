const fs = require("fs");
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const lockfile = require('proper-lockfile');

const dbBasePath = path.join(__dirname, '..', 'database');
const reportsDbPath = path.join(dbBasePath, 'reports.json');
const speedRequestsDbPath = path.join(dbBasePath, 'speed_requests.json');
const networkAssetsDbPath = path.join(dbBasePath, 'network_assets.json');
const compensationsDbPath = path.join(dbBasePath, 'compensations.json');

function loadJSON(filePath) {
    const fullPath = path.join(dbBasePath, filePath.replace('database/', ''));
    try {
        if (fs.existsSync(fullPath)) {
            const fileData = fs.readFileSync(fullPath, 'utf8');
            if (fileData.trim() === '') {
                return filePath.endsWith('.json') && !filePath.includes('config') ? [] : {};
            }
            return JSON.parse(fileData);
        }
        console.warn(`[JSON_LOAD_WARN] File tidak ditemukan: ${fullPath}, membuat file baru.`);
        const emptyState = filePath.endsWith('.json') && !filePath.includes('config') ? [] : {};
        fs.writeFileSync(fullPath, JSON.stringify(emptyState, null, 2), 'utf8');
        return emptyState;
    } catch (error) {
        console.error(`[JSON_LOAD_ERROR] Gagal memuat atau parse JSON dari ${fullPath}:`, error);
        return filePath.endsWith('.json') && !filePath.includes('config') ? [] : {};
    }
}

/**
 * Initialize connection_waypoints table
 */
function initializeConnectionWaypointsTable() {
    return new Promise((resolve, reject) => {
        const dbPath = path.join(dbBasePath, 'users.sqlite');
        const db = new sqlite3.Database(dbPath, (err) => {
            if (err) {
                console.error('[WAYPOINTS_DB] Error opening database:', err.message);
                return reject(err);
            }
            
            const createTableSql = `
                CREATE TABLE IF NOT EXISTS connection_waypoints (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    connection_type TEXT NOT NULL,
                    source_id TEXT NOT NULL,
                    target_id TEXT NOT NULL,
                    waypoints TEXT NOT NULL,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
                    created_by TEXT,
                    updated_by TEXT,
                    UNIQUE(connection_type, source_id, target_id)
                )
            `;
            
            const createIndexesSql = [
                "CREATE INDEX IF NOT EXISTS idx_waypoints_connection ON connection_waypoints(connection_type, source_id, target_id)",
                "CREATE INDEX IF NOT EXISTS idx_waypoints_source ON connection_waypoints(source_id)",
                "CREATE INDEX IF NOT EXISTS idx_waypoints_target ON connection_waypoints(target_id)"
            ];
            
            db.serialize(() => {
                db.run(createTableSql, (err) => {
                    if (err) {
                        console.error('[WAYPOINTS_DB] Error creating table:', err.message);
                        db.close();
                        return reject(err);
                    }
                    
                    let indexCount = 0;
                    createIndexesSql.forEach((sql) => {
                        db.run(sql, (err) => {
                            if (err) {
                                console.warn('[WAYPOINTS_DB] Error creating index:', err.message);
                            }
                            indexCount++;
                            if (indexCount === createIndexesSql.length) {
                                db.close();
                                resolve();
                            }
                        });
                    });
                });
            });
        });
    });
}

/**
 * Get waypoints for a connection
 * @param {string} connectionType - 'odc-odp' atau 'customer-odp'
 * @param {string} sourceId - ID ODC atau Customer
 * @param {string} targetId - ID ODP
 * @returns {Promise<Array<Array<number>>|null>} Array of [lat, lng] coordinates atau null jika tidak ada
 */
function getConnectionWaypoints(connectionType, sourceId, targetId) {
    return new Promise((resolve, reject) => {
        const dbPath = path.join(dbBasePath, 'users.sqlite');
        const db = new sqlite3.Database(dbPath, (err) => {
            if (err) {
                console.error('[WAYPOINTS_DB] Error opening database:', err.message);
                return reject(err);
            }
            
            db.get(
                'SELECT waypoints FROM connection_waypoints WHERE connection_type = ? AND source_id = ? AND target_id = ?',
                [connectionType, String(sourceId), String(targetId)],
                (err, row) => {
                    db.close();
                    if (err) {
                        console.error('[WAYPOINTS_DB] Error getting waypoints:', err.message);
                        return reject(err);
                    }
                    
                    if (!row || !row.waypoints) {
                        return resolve(null);
                    }
                    
                    try {
                        const waypoints = JSON.parse(row.waypoints);
                        return resolve(Array.isArray(waypoints) ? waypoints : null);
                    } catch (parseError) {
                        console.error('[WAYPOINTS_DB] Error parsing waypoints JSON:', parseError);
                        return resolve(null);
                    }
                }
            );
        });
    });
}

/**
 * Save waypoints for a connection
 * @param {string} connectionType - 'odc-odp' atau 'customer-odp'
 * @param {string} sourceId - ID ODC atau Customer
 * @param {string} targetId - ID ODP
 * @param {Array<Array<number>>} waypoints - Array of [lat, lng] coordinates
 * @param {string} userId - User ID yang melakukan update
 * @returns {Promise<boolean>} True jika berhasil
 */
function saveConnectionWaypoints(connectionType, sourceId, targetId, waypoints, userId = null) {
    return new Promise((resolve, reject) => {
        const dbPath = path.join(dbBasePath, 'users.sqlite');
        const db = new sqlite3.Database(dbPath, (err) => {
            if (err) {
                console.error('[WAYPOINTS_DB] Error opening database:', err.message);
                return reject(err);
            }
            
            const waypointsJson = JSON.stringify(waypoints);
            
            db.run(
                `INSERT OR REPLACE INTO connection_waypoints 
                (connection_type, source_id, target_id, waypoints, updated_at, updated_by) 
                VALUES (?, ?, ?, ?, datetime('now'), ?)`,
                [connectionType, String(sourceId), String(targetId), waypointsJson, userId],
                function(err) {
                    db.close();
                    if (err) {
                        console.error('[WAYPOINTS_DB] Error saving waypoints:', err.message);
                        return reject(err);
                    }
                    resolve(true);
                }
            );
        });
    });
}

/**
 * Delete waypoints for a connection
 * @param {string} connectionType - 'odc-odp' atau 'customer-odp'
 * @param {string} sourceId - ID ODC atau Customer
 * @param {string} targetId - ID ODP
 * @returns {Promise<boolean>} True jika berhasil
 */
function deleteConnectionWaypoints(connectionType, sourceId, targetId) {
    return new Promise((resolve, reject) => {
        const dbPath = path.join(dbBasePath, 'users.sqlite');
        const db = new sqlite3.Database(dbPath, (err) => {
            if (err) {
                console.error('[WAYPOINTS_DB] Error opening database:', err.message);
                return reject(err);
            }
            
            db.run(
                'DELETE FROM connection_waypoints WHERE connection_type = ? AND source_id = ? AND target_id = ?',
                [connectionType, String(sourceId), String(targetId)],
                function(err) {
                    db.close();
                    if (err) {
                        console.error('[WAYPOINTS_DB] Error deleting waypoints:', err.message);
                        return reject(err);
                    }
                    resolve(true);
                }
            );
        });
    });
}

/**
 * Get all waypoints (for admin panel)
 * @returns {Promise<Array>} Array of waypoint records
 */
function getAllConnectionWaypoints() {
    return new Promise((resolve, reject) => {
        const dbPath = path.join(dbBasePath, 'users.sqlite');
        const db = new sqlite3.Database(dbPath, (err) => {
            if (err) {
                console.error('[WAYPOINTS_DB] Error opening database:', err.message);
                return reject(err);
            }
            
            db.all(
                'SELECT * FROM connection_waypoints ORDER BY updated_at DESC',
                [],
                (err, rows) => {
                    db.close();
                    if (err) {
                        console.error('[WAYPOINTS_DB] Error getting all waypoints:', err.message);
                        return reject(err);
                    }
                    
                    const waypoints = rows.map(row => {
                        try {
                            return {
                                ...row,
                                waypoints: JSON.parse(row.waypoints)
                            };
                        } catch (parseError) {
                            console.error('[WAYPOINTS_DB] Error parsing waypoints JSON:', parseError);
                            return {
                                ...row,
                                waypoints: []
                            };
                        }
                    });
                    
                    resolve(waypoints);
                }
            );
        });
    });
}

function saveJSON(filePath, data) {
    const fullPath = path.join(dbBasePath, filePath.replace('database/', ''));
    try {
        fs.writeFileSync(fullPath, JSON.stringify(data, null, 2), 'utf8');
    } catch (error) {
        console.error(`[JSON_SAVE_ERROR] Gagal menyimpan data ke ${fullPath}:`, error);
    }
}

function loadReports() {
    try {
        if (fs.existsSync(reportsDbPath)) {
            const reportsData = fs.readFileSync(reportsDbPath, 'utf8');
            global.reports = reportsData ? JSON.parse(reportsData) : [];
        } else {
            fs.writeFileSync(reportsDbPath, JSON.stringify([], null, 2), 'utf8');
            global.reports = [];
            console.log('[DB_INIT] File database/reports.json dibuat.');
        }
    } catch (error) {
        console.error('[DB_LOAD_ERROR] Gagal memuat atau membuat database/reports.json:', error);
        global.reports = [];
    }
}

function loadSpeedRequests() {
    try {
        if (fs.existsSync(speedRequestsDbPath)) {
            const speedRequestsData = fs.readFileSync(speedRequestsDbPath, 'utf8');
            const parsedData = speedRequestsData ? JSON.parse(speedRequestsData) : [];
            global.speed_requests = Array.isArray(parsedData) ? parsedData : [];
        } else {
            fs.writeFileSync(speedRequestsDbPath, JSON.stringify([], null, 2), 'utf8');
            global.speed_requests = [];
            console.log('[DB_INIT] File database/speed_requests.json dibuat.');
        }
    } catch (error) {
        console.error('[DB_LOAD_ERROR] Gagal memuat atau membuat database/speed_requests.json:', error);
        global.speed_requests = [];
    }
}

function loadCompensations() {
    try {
        if (fs.existsSync(compensationsDbPath)) {
            const compensationsData = fs.readFileSync(compensationsDbPath, 'utf8');
            global.compensations = compensationsData ? JSON.parse(compensationsData) : [];
        } else {
            fs.writeFileSync(compensationsDbPath, JSON.stringify([], null, 2), 'utf8');
            global.compensations = [];
            console.log('[DB_INIT] File database/compensations.json dibuat.');
        }
    } catch (error) {
        console.error('[DB_LOAD_ERROR] Gagal memuat atau membuat database/compensations.json:', error);
        global.compensations = [];
    }
}

function loadNetworkAssets() {
    try {
        if (fs.existsSync(networkAssetsDbPath)) {
            const fileContent = fs.readFileSync(networkAssetsDbPath, 'utf-8');
            if (fileContent.trim() === '') {
                return [];
            }
            const jsonData = JSON.parse(fileContent);
            if (!Array.isArray(jsonData)) {
                console.error("[ASSET_LOAD_ERROR] Data di network_assets.json bukan array. Membuat backup dan file baru.");
                fs.copyFileSync(networkAssetsDbPath, `${networkAssetsDbPath}.corrupted.${Date.now()}.bak`);
                fs.writeFileSync(networkAssetsDbPath, JSON.stringify([], null, 2), 'utf-8');
                return [];
            }
            return jsonData;
        } else {
            fs.writeFileSync(networkAssetsDbPath, JSON.stringify([], null, 2), 'utf-8');
            return [];
        }
    } catch (error) {
        console.error("[ASSET_LOAD_FATAL_ERROR] Gagal menangani file network_assets.json:", error);
        return [];
    }
}

function saveReports() {
    saveJSON('reports.json', global.reports);
}

function saveSpeedRequests() {
    saveJSON('speed_requests.json', global.speed_requests);
}

function saveCompensations() {
    saveJSON('compensations.json', global.compensations);
}

function saveNetworkAssets(assets) {
    if (!Array.isArray(assets)) {
        throw new Error("Data aset yang akan disimpan harus berupa array.");
    }
    try {
        fs.writeFileSync(networkAssetsDbPath, JSON.stringify(assets, null, 2), 'utf-8');
        global.networkAssets = assets;
    } catch (error) {
        console.error("[ASSET_SAVE_ERROR] Gagal menyimpan data aset jaringan:", error);
        throw new Error(`Gagal menyimpan data aset jaringan ke file: ${error.message}`);
    }
}

async function updateNetworkAssetsWithLock(updateFunction) {
    let release = null;
    try {
        if (!fs.existsSync(networkAssetsDbPath)) {
            fs.writeFileSync(networkAssetsDbPath, JSON.stringify([], null, 2), 'utf-8');
        }
        
        release = await lockfile.lock(networkAssetsDbPath, {
            retries: {
                retries: 10,
                minTimeout: 100,
                maxTimeout: 1000
            },
            stale: 5000
        });
        
        const assets = loadNetworkAssets();
        const result = await updateFunction(assets);
        saveNetworkAssets(assets);
        
        return result;
    } catch (error) {
        console.error("[LOCK_ERROR] Failed to update network assets with lock:", error);
        throw error;
    } finally {
        if (release) {
            try {
                await release();
            } catch (releaseError) {
                console.error("[LOCK_RELEASE_ERROR]", releaseError);
            }
        }
    }
}

function savePackage() {
    saveJSON('packages.json', global.packages);
}
function saveAccounts() {
    saveJSON('accounts.json', global.accounts);
}
function saveStatik() {
    saveJSON('statik.json', global.statik);
}
function saveVoucher() {
    saveJSON('voucher.json', global.voucher);
}
function saveAtm() {
    saveJSON('user/atm.json', global.atm);
}
function savePayment() {
    saveJSON('payment.json', global.payment);
}
function savePaymentMethod() {
    saveJSON('payment-method.json', global.paymentMethod);
}
function saveRequests(){
    saveJSON('requests.json', global.requests);
}

function savePackageChangeRequests() {
    saveJSON('package_change_requests.json', global.packageChangeRequests);
}

/**
 * Setup file watchers untuk announcements dan news agar auto-reload ketika file berubah
 * Mengikuti logika yang sama seperti template pesan di lib/templating.js
 * 
 * PERBAIKAN: Tambahkan delay dan retry mechanism untuk memastikan file sudah selesai ditulis
 * sebelum reload, karena fs.watchFile() di Windows mungkin tidak reliable
 */
function setupAnnouncementsAndNewsWatchers() {
    // Skip watching in test environment to prevent stuck processes
    if (process.env.NODE_ENV === 'test' || process.env.DISABLE_FILE_WATCHERS === 'true') {
        return;
    }

    const announcementsPath = path.join(dbBasePath, 'announcements.json');
    const newsPath = path.join(dbBasePath, 'news.json');

    /**
     * Reload file dengan retry mechanism untuk handle file yang masih dalam proses write
     * @param {string} filePath - Path ke file yang akan di-reload
     * @param {string} globalVarName - Nama global variable (untuk logging)
     * @param {number} retries - Jumlah retry yang tersisa
     * @param {number} delay - Delay dalam milliseconds sebelum retry
     */
    function reloadFileWithRetry(filePath, globalVarName, retries = 3, delay = 100) {
        setTimeout(() => {
            try {
                const data = loadJSON(filePath);
                
                // Update global variable berdasarkan nama
                if (globalVarName === 'announcements') {
                    global.announcements = data;
                    console.log(`[Database] ✅ Reloaded ${Array.isArray(data) ? data.length : 0} announcements.`);
                } else if (globalVarName === 'news') {
                    global.news = data;
                    console.log(`[Database] ✅ Reloaded ${Array.isArray(data) ? data.length : 0} news items.`);
                }
            } catch (error) {
                // Jika error dan masih ada retry, coba lagi
                if (retries > 0) {
                    console.warn(`[Database] ⚠️ Error reloading ${globalVarName}.json (retry ${4 - retries}/3):`, error.message);
                    reloadFileWithRetry(filePath, globalVarName, retries - 1, delay * 2); // Exponential backoff
                } else {
                    console.error(`[Database] ❌ Error reloading ${globalVarName}.json after 3 retries:`, error.message);
                }
            }
        }, delay);
    }

    // Watch announcements.json and news.json
    let dbWatchersCount = 0;
    
    if (fs.existsSync(announcementsPath)) {
        let lastMtime = fs.statSync(announcementsPath).mtime.getTime();
        
        fs.watchFile(announcementsPath, { interval: 1000 }, (curr, prev) => {
            const currMtime = curr.mtime ? curr.mtime.getTime() : 0;
            const prevMtime = prev.mtime ? prev.mtime.getTime() : 0;
            
            if (currMtime !== prevMtime && currMtime !== lastMtime) {
                lastMtime = currMtime;
                console.log('[Database] 🔄 announcements.json changed');
                reloadFileWithRetry('announcements.json', 'announcements', 3, 200);
            }
        });
        dbWatchersCount++;
    }

    if (fs.existsSync(newsPath)) {
        let lastMtime = fs.statSync(newsPath).mtime.getTime();
        
        fs.watchFile(newsPath, { interval: 1000 }, (curr, prev) => {
            const currMtime = curr.mtime ? curr.mtime.getTime() : 0;
            const prevMtime = prev.mtime ? prev.mtime.getTime() : 0;
            
            if (currMtime !== prevMtime && currMtime !== lastMtime) {
                lastMtime = currMtime;
                console.log('[Database] 🔄 news.json changed');
                reloadFileWithRetry('news.json', 'news', 3, 200);
            }
        });
        dbWatchersCount++;
    }
    
    // Single summary log
    if (dbWatchersCount > 0) {
        console.log(`[Database] ✅ ${dbWatchersCount} file watcher(s) aktif`);
    }
}

function initializeDatabase() {
    return new Promise((resolve, reject) => {
        global.paymentMethod = loadJSON("payment-method.json");
        global.accounts = loadJSON("accounts.json");
        global.packages = loadJSON("packages.json");
        global.statik = loadJSON("statik.json");
        global.voucher = loadJSON("voucher.json");
        global.atm = loadJSON("user/atm.json");
        global.payment = loadJSON("payment.json");
        global.cronConfig = loadJSON("cron.json");
        global.requests = loadJSON('requests.json');
        global.packageChangeRequests = loadJSON('package_change_requests.json');
        global.announcements = loadJSON('announcements.json');
        global.news = loadJSON('news.json');

        // Setup file watchers untuk auto-reload announcements dan news (seperti template pesan)
        setupAnnouncementsAndNewsWatchers();

        loadReports();
        loadSpeedRequests();
        loadCompensations();
        global.networkAssets = loadNetworkAssets();
        
        let dbPath;
        try {
            const { getDatabasePath } = require('./env-config');
            dbPath = getDatabasePath('users.sqlite');
        } catch (e) {
            // Fallback to default if env-config not available
            const dbDir = path.join(__dirname, '..', 'database');
            dbPath = path.join(dbDir, 'users.sqlite');
        }
        
        // Check if old database.sqlite exists and needs migration
        const oldDbPath = dbPath.replace('users.sqlite', 'database.sqlite');
        if (fs.existsSync(oldDbPath) && !fs.existsSync(dbPath)) {
            console.warn('[DB_INIT] Old database.sqlite found. Please run migration script to migrate to users.sqlite');
            console.warn(`[DB_INIT] Old path: ${oldDbPath}`);
            console.warn(`[DB_INIT] New path: ${dbPath}`);
        }
        
        const dbDir = path.dirname(dbPath);
        if (!fs.existsSync(dbDir)) {
            fs.mkdirSync(dbDir, { recursive: true });
            console.log("[DB_INIT] Created database directory:", dbDir);
        }
        
        if (!dbPath.includes(path.sep + 'database' + path.sep) && !dbPath.includes('/database/')) {
            console.warn(`[DB_INIT] WARNING: Database path is not in database/ folder: ${dbPath}`);
        }
        
        const db = new sqlite3.Database(dbPath, (err) => {
            if (err) {
                console.error('Error opening database', err.message);
                return reject(err);
            }

            db.serialize(() => {
                db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='users'", (err, row) => {
                    if (err) {
                        console.error('Error checking users table', err.message);
                        return reject(err);
                    }
                    
                    if (!row) {
                        console.log('[DB] Creating users table...');
                        
                        const createTableSql = `
                            CREATE TABLE IF NOT EXISTS users (
                                id INTEGER PRIMARY KEY AUTOINCREMENT,
                                name TEXT,
                                username TEXT,
                                password TEXT,
                                phone_number TEXT,
                                address TEXT,
                                device_id TEXT,
                                status TEXT DEFAULT 'active',
                                latitude TEXT,
                                longitude TEXT,
                                subscription TEXT,
                                subscription_price INTEGER DEFAULT 0,
                                payment_due_date INTEGER DEFAULT 1,
                                paid INTEGER DEFAULT 0,
                                send_invoice INTEGER DEFAULT 0,
                                is_paid INTEGER DEFAULT 0,
                                auto_isolir INTEGER DEFAULT 1,
                                is_corporate INTEGER DEFAULT 0,
                                corporate_name TEXT,
                                corporate_address TEXT,
                                corporate_npwp TEXT,
                                corporate_pic_name TEXT,
                                corporate_pic_phone TEXT,
                                corporate_pic_email TEXT,
                                pppoe_username TEXT,
                                pppoe_password TEXT,
                                connected_odp_id TEXT,
                                bulk TEXT,
                                odc TEXT,
                                odp TEXT,
                                olt TEXT,
                                maps_url TEXT,
                                otp TEXT,
                                otpTimestamp INTEGER,
                                registration_date TEXT,
                                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                                updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
                                last_login TEXT,
                                last_payment_date TEXT,
                                reminder_sent INTEGER DEFAULT 0,
                                isolir_sent INTEGER DEFAULT 0,
                                compensation_minutes INTEGER DEFAULT 0,
                                email TEXT,
                                alternative_phone TEXT,
                                notes TEXT
                            )
                        `;
                        
                        const createIndexesSql = [
                            "CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone_number)",
                            "CREATE INDEX IF NOT EXISTS idx_users_device ON users(device_id)",
                            "CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)",
                            "CREATE INDEX IF NOT EXISTS idx_users_pppoe ON users(pppoe_username)"
                        ];
                        
                        db.run(createTableSql, (createErr) => {
                            if (createErr) {
                                console.error('[DB_ERROR] Gagal membuat tabel users:', createErr.message);
                                return reject(createErr);
                            }
                            
                            console.log('[DB_INIT] Tabel users berhasil dibuat.');
                            
                            let currentIndex = 0;
                            
                            function createNextIndex() {
                                if (currentIndex >= createIndexesSql.length) {
                                    console.log(`[DB_INIT] Semua index berhasil dibuat.`);
                                    loadUsersData();
                                    return;
                                }
                                
                                const indexSql = createIndexesSql[currentIndex];
                                db.run(indexSql, (indexErr) => {
                                    if (indexErr) {
                                        console.warn(`[DB_WARN] Gagal membuat index ${currentIndex + 1}:`, indexErr.message);
                                    } else {
                                        console.log(`[DB_INIT] Index ${currentIndex + 1}/${createIndexesSql.length} berhasil dibuat.`);
                                    }
                                    
                                    currentIndex++;
                                    createNextIndex();
                                });
                            }
                            
                            createNextIndex();
                        });
                        
                        return;
                    }
                    
                    loadUsersData();
                });
                
                function loadUsersData() {
                    db.all('SELECT * FROM users', [], (err, rows) => {
                        if (err) {
                            console.error('[DB_ERROR] Error loading users from database:', err.message);
                            console.error('[DB_ERROR] Error stack:', err.stack);
                            return reject(err);
                        }

                        const transformedUsers = [];
                        let transformErrorCount = 0;
                        
                        if (rows && rows.length > 0) {
                            rows.forEach((user, index) => {
                                try {
                                    const transformed = {
                                        ...user,
                                        paid: user.paid === 1 || user.paid === '1',
                                        send_invoice: user.send_invoice === 1 || user.send_invoice === '1',
                                        is_corporate: user.is_corporate === 1 || user.is_corporate === '1',
                                        bulk: (() => {
                                            try {
                                                if (!user.bulk) return [];
                                                if (typeof user.bulk === 'string') {
                                                    const trimmed = user.bulk.trim();
                                                    if (trimmed === '' || trimmed === '[]' || trimmed === 'null') return [];
                                                    // Handle corrupted data: "[object Object]"
                                                    if (trimmed === '[object Object]' || trimmed.startsWith('[object')) {
                                                        console.warn(`[DB_WARNING] Corrupted bulk data for user ${user.id}: "${trimmed}", resetting to default`);
                                                        return [];
                                                    }
                                                    return JSON.parse(user.bulk);
                                                }
                                                // Jika sudah array, return langsung
                                                if (Array.isArray(user.bulk)) return user.bulk;
                                                return [];
                                            } catch (e) {
                                                console.warn(`[DB_WARNING] Failed to parse bulk for user ${user.id}:`, e.message);
                                                return [];
                                            }
                                        })(),
                                        connected_odp_id: user.connected_odp_id || null,
                                        phone: user.phone_number || user.phone || null,
                                        package: user.subscription || user.package || null
                                    };
                                    transformedUsers.push(transformed);
                                } catch (transformErr) {
                                    transformErrorCount++;
                                    console.error(`[DB_ERROR] Failed to transform user at index ${index} (ID: ${user.id}, Name: ${user.name}):`, transformErr.message);
                                    console.error(`[DB_ERROR] Raw user data:`, JSON.stringify(user, null, 2));
                                    try {
                                        transformedUsers.push({
                                            ...user,
                                            paid: user.paid === 1 || user.paid === '1',
                                            send_invoice: user.send_invoice === 1 || user.send_invoice === '1',
                                            is_corporate: user.is_corporate === 1 || user.is_corporate === '1',
                                            bulk: [],
                                            connected_odp_id: user.connected_odp_id || null,
                                            phone: user.phone_number || user.phone || null,
                                            package: user.subscription || user.package || null
                                        });
                                        console.log(`[DB_WARNING] Added user ${user.id} with minimal transformation after error`);
                                    } catch (minimalErr) {
                                        console.error(`[DB_ERROR] CRITICAL: Cannot add user ${user.id} even with minimal transformation:`, minimalErr.message);
                                    }
                                }
                            });
                        }
                        
                        global.users = transformedUsers;
                        
                        if (transformErrorCount > 0 || global.users.length !== (rows ? rows.length : 0)) {
                            console.log(`[DB] Loaded ${global.users.length} users (${transformErrorCount} errors)`);
                        }
                        
                        if (transformErrorCount > 0) {
                            console.warn(`[DB_WARNING] ${transformErrorCount} user(s) had transformation errors but were still added to memory`);
                        }
                        
                        if (global.users.length === 0 && rows && rows.length > 0) {
                            console.error('[DB_ERROR] CRITICAL: Rows found in database but transformation resulted in 0 users!');
                            console.error('[DB_ERROR] Sample row:', JSON.stringify(rows[0], null, 2));
                        }
                        
                        if (global.users.length < rows.length) {
                            const missingCount = rows.length - global.users.length;
                            console.error(`[DB_ERROR] CRITICAL: ${missingCount} user(s) from database were NOT transformed!`);
                            console.error(`[DB_ERROR] Database has ${rows.length} rows but only ${global.users.length} users in memory`);
                            const loadedIds = new Set(global.users.map(u => String(u.id)));
                            const missingUsers = rows.filter(u => !loadedIds.has(String(u.id)));
                            if (missingUsers.length > 0) {
                                console.error(`[DB_ERROR] Sample missing users:`, missingUsers.slice(0, 5).map(u => ({ id: u.id, name: u.name, phone_number: u.phone_number })));
                            }
                        }
                        
                        global.db = db;
                        
                        const { initializeActivityLogTables } = require('./activity-logger');
                        initializeActivityLogTables().catch(err => {
                            console.error('[DB] Activity logging init failed:', err.message);
                        });

                        const odpUsageMap = new Map();
                        const odcChildrenMap = new Map();
                        
                        global.networkAssets.forEach(asset => {
                            if (asset.type === 'ODP' || asset.type === 'ODC') {
                                asset.ports_used = 0;
                            }
                        });
                        
                        global.users.forEach(user => {
                            if (user.connected_odp_id) {
                                odpUsageMap.set(user.connected_odp_id, 
                                    (odpUsageMap.get(user.connected_odp_id) || 0) + 1
                                );
                            }
                        });
                        
                        global.networkAssets.forEach(asset => {
                            if (asset.type === 'ODP') {
                                asset.ports_used = odpUsageMap.get(asset.id) || 0;
                                
                                if (asset.parent_odc_id) {
                                    if (!odcChildrenMap.has(asset.parent_odc_id)) {
                                        odcChildrenMap.set(asset.parent_odc_id, []);
                                    }
                                    odcChildrenMap.get(asset.parent_odc_id).push(asset);
                                }
                            }
                        });
                        
                        global.networkAssets.forEach(asset => {
                            if (asset.type === 'ODC') {
                                const children = odcChildrenMap.get(asset.id) || [];
                                asset.ports_used = children.length;
                            }
                        });
                        
                        saveNetworkAssets(global.networkAssets);

                        const { initializePSBDatabase, loadPSBRecords } = require('./psb-database');
                        initializePSBDatabase()
                            .then(() => loadPSBRecords())
                            .then(() => {
                                return initializeConnectionWaypointsTable();
                            })
                            .then(() => {
                                resolve(db);
                            })
                            .catch(err => {
                                console.error("[DB] PSB/Waypoints init error:", err.message);
                                resolve(db);
                            });
                    });
                }
            });
        });
    });
}

function updateOdpPortUsage(odpId, increment = true, assetsArray) {
    const odpIndex = assetsArray.findIndex(asset => String(asset.id) === String(odpId) && asset.type === 'ODP');
    if (odpIndex !== -1) {
        if (increment) {
            assetsArray[odpIndex].ports_used = (parseInt(assetsArray[odpIndex].ports_used) || 0) + 1;
        } else {
            assetsArray[odpIndex].ports_used = Math.max(0, (parseInt(assetsArray[odpIndex].ports_used) || 0) - 1);
        }
        return true;
    } else {
        console.warn(`[ODP_PORT_UPDATE_WARN] ODP ID ${odpId} tidak ditemukan untuk update port.`);
        return false;
    }
}

function updateOdcPortUsage(odcId, assetsArray) {
    const odcIndex = assetsArray.findIndex(asset => String(asset.id) === String(odcId) && asset.type === 'ODC');
    if (odcIndex !== -1) {
        const childOdps = assetsArray.filter(asset => asset.type === 'ODP' && String(asset.parent_odc_id) === String(odcId));
        const totalPortsUsed = childOdps.reduce((sum, odp) => sum + (parseInt(odp.ports_used) || 0), 0);
        assetsArray[odcIndex].ports_used = totalPortsUsed;
        return true;
    } else {
        console.warn(`[ODC_PORT_UPDATE_WARN] ODC ID ${odcId} tidak ditemukan untuk update port.`);
        return false;
    }
}

module.exports = {
    initializeDatabase,
    loadJSON,
    saveJSON,
    loadReports,
    saveReports,
    loadSpeedRequests,
    saveSpeedRequests,
    loadNetworkAssets,
    saveNetworkAssets,
    updateNetworkAssetsWithLock,
    loadCompensations,
    saveCompensations,
    updateOdpPortUsage,
    updateOdcPortUsage,
    savePackage,
    saveAccounts,
    saveStatik,
    saveVoucher,
    saveAtm,
    savePayment,
    savePaymentMethod,
    saveRequests,
    initializeConnectionWaypointsTable,
    getConnectionWaypoints,
    saveConnectionWaypoints,
    deleteConnectionWaypoints,
    getAllConnectionWaypoints,
    savePackageChangeRequests
};