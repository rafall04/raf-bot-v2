const fs = require("fs");
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const lockfile = require('proper-lockfile');

// --- Path Definitions ---
const dbBasePath = path.join(__dirname, '..', 'database');
const reportsDbPath = path.join(dbBasePath, 'reports.json');
const speedRequestsDbPath = path.join(dbBasePath, 'speed_requests.json');
const networkAssetsDbPath = path.join(dbBasePath, 'network_assets.json');
const compensationsDbPath = path.join(dbBasePath, 'compensations.json');

// --- Generic JSON Helpers ---
function loadJSON(filePath) {
    const fullPath = path.join(dbBasePath, filePath.replace('database/', ''));
    try {
        if (fs.existsSync(fullPath)) {
            const fileData = fs.readFileSync(fullPath, 'utf8');
            if (fileData.trim() === '') return Array.isArray(JSON.parse('[]')) ? [] : {}; // Handle empty files
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

function saveJSON(filePath, data) {
    const fullPath = path.join(dbBasePath, filePath.replace('database/', ''));
    try {
        fs.writeFileSync(fullPath, JSON.stringify(data, null, 2), 'utf8');
    } catch (error) {
        console.error(`[JSON_SAVE_ERROR] Gagal menyimpan data ke ${fullPath}:`, error);
    }
}

// --- Specific Data Loaders ---
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

// --- Specific Data Savers ---
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
        // Update global variable after successful save
        global.networkAssets = assets;
    } catch (error) {
        console.error("[ASSET_SAVE_ERROR] Gagal menyimpan data aset jaringan:", error);
        throw new Error(`Gagal menyimpan data aset jaringan ke file: ${error.message}`);
    }
}

// Function to safely update network assets with file locking
async function updateNetworkAssetsWithLock(updateFunction) {
    let release = null;
    try {
        // Ensure file exists before locking
        if (!fs.existsSync(networkAssetsDbPath)) {
            fs.writeFileSync(networkAssetsDbPath, JSON.stringify([], null, 2), 'utf-8');
        }
        
        // Acquire lock with retries
        release = await lockfile.lock(networkAssetsDbPath, {
            retries: {
                retries: 10,
                minTimeout: 100,
                maxTimeout: 1000
            },
            stale: 5000 // Consider lock stale after 5 seconds
        });
        
        // Load current assets
        const assets = loadNetworkAssets();
        
        // Apply the update function
        const result = await updateFunction(assets);
        
        // Save updated assets
        saveNetworkAssets(assets);
        
        return result;
    } catch (error) {
        console.error("[LOCK_ERROR] Failed to update network assets with lock:", error);
        throw error;
    } finally {
        // Always release the lock
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

// --- Main Initializer ---
function initializeDatabase() {
    return new Promise((resolve, reject) => {
        // Load all JSON files into globals
        console.log("[DB_INIT] Loading JSON databases...");
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

        // Load complex JSON files that have their own loader functions
        loadReports();
        loadSpeedRequests();
        loadCompensations();
        global.networkAssets = loadNetworkAssets(); // Load network assets
        console.log("[DB_INIT] JSON databases loaded.");

        // Initialize SQLite
        console.log("[DB_INIT] Connecting to SQLite database...");
        const dbPath = path.join(dbBasePath, 'database.sqlite');
        const db = new sqlite3.Database(dbPath, (err) => {
            if (err) {
                console.error('Error opening database', err.message);
                return reject(err);
            }

            console.log('Connected to the SQLite database.');
            db.serialize(() => {
                db.run(`CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY, name TEXT, phone_number TEXT, address TEXT,
                    subscription TEXT, pppoe_username TEXT, device_id TEXT, paid INTEGER,
                    username TEXT, password TEXT, otp TEXT, otpTimestamp INTEGER,
                    bulk TEXT, connected_odp_id TEXT, latitude REAL,
                    longitude REAL, pppoe_password TEXT, send_invoice INTEGER DEFAULT 0,
                    is_corporate INTEGER DEFAULT 0, corporate_name TEXT, corporate_address TEXT,
                    corporate_npwp TEXT, corporate_pic_name TEXT, corporate_pic_phone TEXT,
                    corporate_pic_email TEXT
                )`, (err) => {
                    if (err) {
                        console.error('Error creating users table', err.message);
                        return reject(err);
                    }

                    db.all('SELECT * FROM users', [], (err, rows) => {
                        if (err) {
                            console.error('Error loading users from database', err.message);
                            return reject(err);
                        }
                        // Transform the data to the format expected by the application
                        global.users = rows.map(user => ({
                            ...user,
                            paid: user.paid === 1, // Convert integer (0/1) to boolean
                            send_invoice: user.send_invoice === 1, // Convert integer (0/1) to boolean
                            is_corporate: user.is_corporate === 1, // Convert integer (0/1) to boolean
                            bulk: (() => {
                                try {
                                    if (!user.bulk) return [];
                                    if (typeof user.bulk === 'string') {
                                        return JSON.parse(user.bulk);
                                    }
                                    return user.bulk;
                                } catch (e) {
                                    console.error(`[DB_WARNING] Failed to parse bulk for user ${user.id}:`, e.message);
                                    return [];
                                }
                            })(),
                            connected_odp_id: user.connected_odp_id || null // Ensure field exists even if null
                        }));
                        console.log(`[DB_SUCCESS] Successfully loaded and transformed ${global.users.length} users into memory.`);
                        global.db = db;

                        // Optimized port usage calculation using Maps for O(1) lookup
                        const odpUsageMap = new Map();
                        const odcChildrenMap = new Map();
                        
                        // Reset all ports_used
                        global.networkAssets.forEach(asset => {
                            if (asset.type === 'ODP' || asset.type === 'ODC') {
                                asset.ports_used = 0;
                            }
                        });
                        
                        // Count users per ODP (O(n) where n = number of users)
                        global.users.forEach(user => {
                            if (user.connected_odp_id) {
                                odpUsageMap.set(user.connected_odp_id, 
                                    (odpUsageMap.get(user.connected_odp_id) || 0) + 1
                                );
                            }
                        });
                        
                        // Build ODC children map and update ODP ports_used (O(m) where m = number of assets)
                        global.networkAssets.forEach(asset => {
                            if (asset.type === 'ODP') {
                                // Update ODP ports_used from the map
                                asset.ports_used = odpUsageMap.get(asset.id) || 0;
                                
                                // Track ODP children for each ODC
                                if (asset.parent_odc_id) {
                                    if (!odcChildrenMap.has(asset.parent_odc_id)) {
                                        odcChildrenMap.set(asset.parent_odc_id, []);
                                    }
                                    odcChildrenMap.get(asset.parent_odc_id).push(asset);
                                }
                            }
                        });
                        
                        // Update ODC ports_used based on child ODPs (O(m))
                        global.networkAssets.forEach(asset => {
                            if (asset.type === 'ODC') {
                                const children = odcChildrenMap.get(asset.id) || [];
                                asset.ports_used = children.length;
                            }
                        });
                        
                        console.log(`[DB_OPTIMIZE] Port usage recalculated: ${odpUsageMap.size} ODPs with users, ${odcChildrenMap.size} ODCs with children`);

                        // Save the updated network assets
                        saveNetworkAssets(global.networkAssets);

                        resolve(db);
                    });
                });
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
    loadNetworkAssets,
    saveNetworkAssets,
    updateNetworkAssetsWithLock,
    updateOdpPortUsage,
    updateOdcPortUsage,
    saveReports,
    saveSpeedRequests,
    saveCompensations,
    savePackage,
    saveAccounts,
    saveStatik,
    saveVoucher,
    saveAtm,
    savePayment,
    savePaymentMethod,
    saveRequests,
    savePackageChangeRequests
};