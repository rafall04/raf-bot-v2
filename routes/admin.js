const express = require('express');
const axios = require('axios');
const fs = require("fs");
const path = require('path');
const { exec } = require('child_process');
const { faker } = require('@faker-js/faker');
const { comparePassword, hashPassword } = require('../lib/password');
const crypto = require('crypto');

const convertRupiah = require('rupiah-format');

// Local dependencies
const {
    saveReports, saveSpeedRequests, saveNetworkAssets, saveCompensations,
    savePackage, saveAccounts, saveStatik, saveVoucher, saveAtm,
    savePayment, savePaymentMethod, saveRequests, loadJSON, saveJSON,
    updateOdpPortUsage, updateOdcPortUsage, savePackageChangeRequests,
    initializeConnectionWaypointsTable, getConnectionWaypoints, saveConnectionWaypoints,
    deleteConnectionWaypoints, getAllConnectionWaypoints
} = require('../lib/database');
const {
    initializeAllCronTasks,
    isValidCron
} = require('../lib/cron');
const { getSSIDInfo, getCustomerRedaman, getDeviceCoreInfo, getMultipleDeviceMetrics, rebootRouter, updateWifiSettings } = require("../lib/wifi");
const { logWifiChange, getWifiChangeLogs, getWifiChangeStats } = require("../lib/wifi-logger");
const { getvoucher } = require("../lib/mikrotik");
const { updatePPPoEProfile, deleteActivePPPoEUser } = require('../lib/mikrotik');
const { addKoinUser, addATM, checkATMuser } = require('../lib/saldo');
const { updateStatusPayment, checkStatusPayment, delPayment, addPayBuy, addPayment, updateKetPayment } = require('../lib/payment');
const { isprofvc, checkprofvc, checkdurasivc, checkhargavc } = require('../lib/voucher');
const { renderTemplate, templatesCache } = require('../lib/templating');
const { getProfileBySubscription } = require('../lib/myfunc');
const { handlePaidStatusChange, sendTechnicianNotification } = require('../lib/approval-logic.js');
const { normalizePhoneNumber } = require('../lib/utils');
const agentVoucherManager = require('../lib/agent-voucher-manager');
const agentManager = require('../lib/agent-manager');
const { withLock } = require('../lib/request-lock');
const { rateLimit } = require('../lib/security');

const router = express.Router();
const { getLoginLogs, getActivityLogs, logActivity } = require('../lib/activity-logger');

// --- Helper Functions (moved from index.js) ---

function ensureAuthenticatedStaff(req, res, next) {
    // Debug logging untuk troubleshooting
    if (!req.user) {
        console.log(`[AUTH_DEBUG] ensureAuthenticatedStaff: req.user is null/undefined. Path: ${req.path}, Method: ${req.method}`);
        console.log(`[AUTH_DEBUG] Cookies:`, req.cookies);
        console.log(`[AUTH_DEBUG] Headers:`, req.headers.authorization ? 'Authorization header present' : 'No Authorization header');
        return res.status(403).json({ status: 403, message: "Akses ditolak. User tidak terautentikasi." });
    }
    
    if (!['admin', 'owner', 'superadmin', 'teknisi'].includes(req.user.role)) {
        console.log(`[AUTH_DEBUG] ensureAuthenticatedStaff: Invalid role. User: ${req.user.username}, Role: ${req.user.role}, Path: ${req.path}`);
        return res.status(403).json({ status: 403, message: "Akses ditolak. Role tidak diizinkan." });
    }
    
    next();
}

function generateAssetId(type, parentOdcId = null, existingAssets = [], assetName = "") {
    let prefix = "";
    let baseCode = "XXX";
    let sequenceNumber = 1;
    if (type === 'ODC') { prefix = "ODC"; } 
    else if (type === 'ODP') { prefix = "ODP"; } 
    else { return `ASSET-UNKNOWN-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`; }
    if (type === 'ODP' && parentOdcId) {
        const parentMatch = parentOdcId.match(/^ODC-([A-Z0-9]+(?:-[0-9]+)?)/i);
        if (parentMatch && parentMatch[1]) { baseCode = parentMatch[1].replace(/-/g, ""); }
        else if (parentOdcId.length >= 3) { baseCode = parentOdcId.substring(0, Math.min(parentOdcId.length, 7)).toUpperCase().replace(/[^A-Z0-9]/gi, ''); if (baseCode.length === 0) baseCode = "PARENT"; }
    } else if (assetName) {
        const nameParts = assetName.trim().toUpperCase().split(/\s+|_|-/);
        let generatedBase = "";
        if (nameParts.length > 1 && nameParts[0].length > 0 && nameParts[1].length > 0) {
            generatedBase = (nameParts[0].substring(0, Math.min(nameParts[0].length, 3)) + nameParts[1].substring(0, Math.min(nameParts[1].length, 2)));
        } else if (nameParts[0].length >= 3) {
            generatedBase = nameParts[0].substring(0, 3);
        } else if (nameParts[0].length > 0) {
            generatedBase = nameParts[0];
            while (generatedBase.length < 3 && generatedBase.length > 0) generatedBase += "X";
        }
        baseCode = generatedBase.substring(0, 7).replace(/[^A-Z0-9]/gi, '');
    }
    if (baseCode.length === 0) baseCode = "GEN";
    let relevantAssets;
    if (type === 'ODP' && parentOdcId) {
        relevantAssets = existingAssets.filter(asset => asset.type === 'ODP' && asset.parent_odc_id === parentOdcId);
    } else {
        relevantAssets = existingAssets.filter(asset => asset.type === type && asset.id.startsWith(`${prefix}-${baseCode}-`));
    }
    sequenceNumber = relevantAssets.length + 1;
    const formattedSequence = String(sequenceNumber).padStart(3, '0');
    let newPotentialId = `${prefix}-${baseCode}-${formattedSequence}`;
    let uniquenessCounter = 0;
    let finalId = newPotentialId;
    while (existingAssets.some(asset => asset.id === finalId)) {
        uniquenessCounter++;
        finalId = `${newPotentialId}_${uniquenessCounter}`;
        if (uniquenessCounter > 20) {
            finalId = `${newPotentialId}_${Math.random().toString(36).substring(2, 7)}`;
            if (existingAssets.some(asset => asset.id === finalId)) {
                finalId = `${newPotentialId}_${Date.now().toString().slice(-5)}`;
            }
            break;
        }
    }
    return finalId;
}

async function broadcast(text, users = global.users) {
    // Helper to format the message for a specific user
    const formatBroadcastMessage = (template, user) => {
        let message = template;
        const placeholders = {
            'nama': user.name || '',
            'paket': user.subscription || '',
            'alamat': user.address || '',
            'username_pppoe': user.pppoe_username || '',
            // Add other user-specific placeholders here as needed
        };

        for (const key in placeholders) {
            // Match ${key} pattern (e.g., ${nama}, ${paket})
            const regex = new RegExp(`\\$\\{${key}\\}`, 'g');
            message = message.replace(regex, placeholders[key]);
        }
        return message;
    };

    for (const user of users) {
        if (global.raf && user.phone_number) {
            const personalizedText = formatBroadcastMessage(text, user);
            const numbers = user.phone_number.split("|").map(n => normalizePhoneNumber(n)).filter(Boolean);

            // PENTING: Cek connection state dan gunakan error handling sesuai rules untuk multiple recipients
            for (const number of numbers) {
                const phoneJid = number + "@s.whatsapp.net";
                if (global.whatsappConnectionState === 'open' && global.raf && global.raf.sendMessage) {
                    try {
                        const { delay } = await import('@whiskeysockets/baileys');
                        await global.raf.sendMessage(phoneJid, { text: personalizedText });
                        console.log(`Broadcast sent to ${user.name} (${number})`);
                        await delay(1000); // Delay between sending to each number
                    } catch (e) {
                        console.error('[SEND_MESSAGE_ERROR]', {
                            phoneJid,
                            error: e.message
                        });
                        console.error(`Failed to send broadcast to ${number}:`, e);
                        // Continue to next number
                    }
                } else {
                    console.warn('[SEND_MESSAGE_SKIP] WhatsApp not connected, skipping send to', phoneJid);
                }
            }
        }
    }
}



// --- Admin API Routes ---

// All routes here are implicitly protected by the admin auth middleware in index.js

// API routes for populating form dropdowns
// Debug endpoint to inspect database (accessible via web interface)
router.get('/api/debug/database', ensureAuthenticatedStaff, async (req, res) => {
    if (!req.user || !['admin', 'owner', 'superadmin'].includes(req.user.role)) {
        return res.status(403).json({ status: 403, message: "Akses ditolak." });
    }

    try {
        const sqlite3 = require('sqlite3').verbose();
        const { getDatabasePath } = require('../lib/env-config');
        const dbPath = getDatabasePath('users.sqlite');
        
        const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY);

        const results = {};

        // Get all tables
        const tables = await new Promise((resolve, reject) => {
            db.all("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name", [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });

        results.tables = tables.map(t => t.name);

        // Get users count
        const userCount = await new Promise((resolve, reject) => {
            db.get("SELECT COUNT(*) as count FROM users", [], (err, row) => {
                if (err) reject(err);
                else resolve(row ? row.count : 0);
            });
        });

        results.usersCount = userCount;

        // Get users table structure
        const columns = await new Promise((resolve, reject) => {
            db.all("PRAGMA table_info(users)", [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });

        results.columns = columns;

        // Get sample users (first 10)
        const sampleUsers = await new Promise((resolve, reject) => {
            db.all("SELECT id, name, phone_number, subscription, status, paid FROM users ORDER BY id LIMIT 10", [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });

        results.sampleUsers = sampleUsers;

        // Get global.users count
        results.globalUsersCount = global.users ? global.users.length : 0;

        // Get users by status
        const usersByStatus = await new Promise((resolve, reject) => {
            db.all("SELECT status, COUNT(*) as count FROM users GROUP BY status", [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });

        results.usersByStatus = usersByStatus;

        db.close();

        res.json({
            status: 200,
            message: "Database inspection successful",
            database: {
                path: dbPath,
                exists: fs.existsSync(dbPath),
                fileSize: fs.existsSync(dbPath) ? fs.statSync(dbPath).size : 0
            },
            data: results
        });

    } catch (error) {
        console.error('[DEBUG_DB] Error inspecting database:', error);
        res.status(500).json({
            status: 500,
            message: "Gagal inspect database",
            error: error.message
        });
    }
});

// Note: Delete all users endpoint is available at /api/admin/delete-all-users
// This endpoint is already integrated with the users.php page (Delete All Users button)
// The endpoint includes: delete from DB, reset sequence, clear memory, verify deletion

// Reload users from database endpoint (via web interface)
router.post('/api/users/reload', ensureAuthenticatedStaff, async (req, res) => {
    if (!req.user || !['admin', 'owner', 'superadmin'].includes(req.user.role)) {
        return res.status(403).json({ status: 403, message: "Akses ditolak." });
    }

    try {
        console.log('[RELOAD_USERS] Starting user reload from database...');
        
        const sqlite3 = require('sqlite3').verbose();
        const { getDatabasePath } = require('../lib/env-config');
        const { transformUsersFromDb } = require('../lib/migration-helper');
        const dbPath = getDatabasePath('users.sqlite');
        
        const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY);
        
        // Get count from database
        const dbCountPromise = new Promise((resolve, reject) => {
            db.get("SELECT COUNT(*) as count FROM users", [], (err, row) => {
                if (err) reject(err);
                else resolve(row ? row.count : 0);
            });
        });
        
        const dbCount = await dbCountPromise;
        const memoryCountBefore = global.users ? global.users.length : 0;
        
        // Load all users from database
        const usersPromise = new Promise((resolve, reject) => {
            db.all('SELECT * FROM users ORDER BY id', [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });
        
        const rows = await usersPromise;
        db.close();
        
        console.log(`[RELOAD_USERS] Loaded ${rows.length} rows from database (DB count: ${dbCount})`);
        
        // Transform the data using migration-helper for consistent transformation
        // Handles boolean fields (paid, send_invoice, is_corporate, auto_isolir)
        // Parses bulk JSON correctly
        // Handles all new fields (Requirement 5.4)
        const { transformedUsers, errorCount: transformErrorCount } = transformUsersFromDb(rows);
        
        // Update global.users
        global.users = transformedUsers;
        const memoryCountAfter = global.users.length;
        
        console.log(`[RELOAD_USERS] Reload complete: ${memoryCountBefore} → ${memoryCountAfter} users (DB: ${dbCount})`);
        
        if (transformErrorCount > 0) {
            console.warn(`[RELOAD_USERS] ${transformErrorCount} users failed to transform`);
        }
        
        if (memoryCountAfter < rows.length) {
            const missingCount = rows.length - memoryCountAfter;
            console.error(`[RELOAD_USERS] WARNING: ${missingCount} user(s) were NOT loaded!`);
        }
        
        res.json({
            status: 200,
            message: `Users reloaded successfully. ${memoryCountAfter} users loaded from database.`,
            details: {
                databaseCount: dbCount,
                memoryCountBefore: memoryCountBefore,
                memoryCountAfter: memoryCountAfter,
                rowsLoaded: rows.length,
                transformErrors: transformErrorCount,
                missing: rows.length - memoryCountAfter
            }
        });
        
    } catch (error) {
        console.error('[RELOAD_USERS] Error:', error);
        res.status(500).json({
            status: 500,
            message: "Gagal reload users dari database.",
            error: error.message
        });
    }
});

router.get('/api/list/users', ensureAuthenticatedStaff, rateLimit('list-users', 30, 60000), (req, res) => {
    // Return a simplified list of users suitable for a dropdown
    const userList = global.users.map(u => ({
        id: u.id,
        name: u.name,
        pppoe_username: u.pppoe_username,
        subscription: u.subscription
    }));
    res.json({ status: 200, message: "User list fetched.", data: userList });
});

router.get('/api/list/packages', ensureAuthenticatedStaff, rateLimit('list-packages', 30, 60000), (req, res) => {
    // Return packages, ensuring price is a number
    const packageList = global.packages.map(p => ({
        ...p,
        price: Number(p.price) || 0
    }));
    res.json({ status: 200, message: "Package list fetched.", data: packageList });
});


const templatesDbPath = path.join(__dirname, '..', 'database', 'message_templates.json');
const wifiMenuTemplatesDbPath = path.join(__dirname, '..', 'database', 'wifi_menu_templates.json');
const responseTemplatesDbPath = path.join(__dirname, '..', 'database', 'response_templates.json');
const commandTemplatesDbPath = path.join(__dirname, '..', 'database', 'command_templates.json');
const errorTemplatesDbPath = path.join(__dirname, '..', 'database', 'error_templates.json');
const successTemplatesDbPath = path.join(__dirname, '..', 'database', 'success_templates.json');
const systemTemplatesDbPath = path.join(__dirname, '..', 'database', 'system_messages.json');
const menuTemplatesDbPath = path.join(__dirname, '..', 'database', 'menu_templates.json');
const reportTemplatesDbPath = path.join(__dirname, '..', 'database', 'report_templates.json');

router.get('/api/templates', ensureAuthenticatedStaff, (req, res) => {
    try {
        const { 
            notificationTemplates, 
            wifiMenuTemplates, 
            responseTemplates,
            commandTemplates,
            errorTemplates,
            successTemplates,
            systemTemplates,
            menuTemplates,
            reportTemplates 
        } = templatesCache;

        // For wifiMenuTemplates, the value is the template string directly.
        // We need to convert it to the { name, template } structure for the frontend.
        const formattedWifiTemplates = {};
        for (const key in wifiMenuTemplates) {
            formattedWifiTemplates[key] = {
                // A simple way to generate a name: "wifimenu" -> "Wifimenu"
                name: key.charAt(0).toUpperCase() + key.slice(1),
                template: wifiMenuTemplates[key]
            };
        }

        const responseData = {
            notificationTemplates: notificationTemplates,
            wifiMenuTemplates: formattedWifiTemplates,
            responseTemplates: responseTemplates,
            commandTemplates: commandTemplates,
            errorTemplates: errorTemplates,
            successTemplates: successTemplates,
            systemTemplates: systemTemplates,
            menuTemplates: menuTemplates,
            reportTemplates: reportTemplates
        };

        res.status(200).json({ status: 200, message: "Templates loaded successfully from cache.", data: responseData });
    } catch (error) {
        console.error("[API_TEMPLATES_GET_ERROR]", error);
        res.status(500).json({ status: 500, message: "Failed to process templates from cache." });
    }
});

router.post('/api/templates', ensureAuthenticatedStaff, (req, res) => {
    try {
        const { 
            notificationTemplates, 
            wifiMenuTemplates, 
            responseTemplates,
            commandTemplates,
            errorTemplates,
            successTemplates,
            systemTemplates,
            menuTemplates,
            reportTemplates
        } = req.body;

        // Validate required templates (original ones must exist)
        if (!notificationTemplates || typeof notificationTemplates !== 'object' ||
            !wifiMenuTemplates || typeof wifiMenuTemplates !== 'object' ||
            !responseTemplates || typeof responseTemplates !== 'object') {
            return res.status(400).json({ status: 400, message: "Invalid template data structure provided." });
        }

        // Save notification templates
        fs.writeFileSync(templatesDbPath, JSON.stringify(notificationTemplates, null, 2), 'utf8');

        // Save wifi menu templates
        fs.writeFileSync(wifiMenuTemplatesDbPath, JSON.stringify(wifiMenuTemplates, null, 2), 'utf8');

        // Save response templates
        fs.writeFileSync(responseTemplatesDbPath, JSON.stringify(responseTemplates, null, 2), 'utf8');

        // Save new template types if provided
        if (commandTemplates && typeof commandTemplates === 'object') {
            fs.writeFileSync(commandTemplatesDbPath, JSON.stringify(commandTemplates, null, 2), 'utf8');
        }

        if (errorTemplates && typeof errorTemplates === 'object') {
            fs.writeFileSync(errorTemplatesDbPath, JSON.stringify(errorTemplates, null, 2), 'utf8');
        }

        if (successTemplates && typeof successTemplates === 'object') {
            fs.writeFileSync(successTemplatesDbPath, JSON.stringify(successTemplates, null, 2), 'utf8');
        }

        if (systemTemplates && typeof systemTemplates === 'object') {
            fs.writeFileSync(systemTemplatesDbPath, JSON.stringify(systemTemplates, null, 2), 'utf8');
        }

        if (menuTemplates && typeof menuTemplates === 'object') {
            fs.writeFileSync(menuTemplatesDbPath, JSON.stringify(menuTemplates, null, 2), 'utf8');
        }

        if (reportTemplates && typeof reportTemplates === 'object') {
            fs.writeFileSync(reportTemplatesDbPath, JSON.stringify(reportTemplates, null, 2), 'utf8');
        }

        // The fs.watchFile in templating.js will handle reloading the cache automatically.
        // No manual reload call is needed here.
        console.log("[TEMPLATES] Templates saved. The cache will be reloaded automatically by the file watcher.");

        res.status(200).json({ status: 200, message: "All message templates saved successfully. Cache reloads automatically." });
    } catch (error) {
        console.error("[API_TEMPLATES_POST_ERROR]", error);
        res.status(500).json({ status: 500, message: "Failed to save one or more message template files." });
    }
});

// GET /api/config - Get combined config from config.json and cron.json
router.get('/api/config', ensureAuthenticatedStaff, (req, res) => {
    if (!req.user || !['admin', 'owner', 'superadmin'].includes(req.user.role)) {
        return res.status(403).json({ message: "Akses ditolak." });
    }

    try {
        const mainConfigPath = path.join(__dirname, '..', 'config.json');
        const cronConfigPath = path.join(__dirname, '..', 'database', 'cron.json');
        const speedBoostConfigPath = path.join(__dirname, '..', 'database', 'speed_boost_matrix.json');
        
        const mainConfig = JSON.parse(fs.readFileSync(mainConfigPath, 'utf8'));
        const cronConfig = JSON.parse(fs.readFileSync(cronConfigPath, 'utf8'));
        
        // Load speed boost config untuk get enabled status
        let speedOnDemandEnabled = true; // default
        try {
            if (fs.existsSync(speedBoostConfigPath)) {
                const speedBoostConfig = JSON.parse(fs.readFileSync(speedBoostConfigPath, 'utf8'));
                speedOnDemandEnabled = speedBoostConfig.enabled !== false;
            }
        } catch (err) {
            console.warn('[API_CONFIG_GET] Failed to load speed boost config:', err.message);
        }
        
        // Get payment status visibility config (default: true)
        const showPaymentStatus = mainConfig.showPaymentStatus !== false;
        const showDueDate = mainConfig.showDueDate !== false;

        // Combine both configs
        const combinedConfig = {
            ...mainConfig,
            ...cronConfig,
            speedOnDemandEnabled: speedOnDemandEnabled,
            showPaymentStatus: showPaymentStatus,
            showDueDate: showDueDate
        };
        
        res.status(200).json({
            status: 200,
            data: combinedConfig
        });
    } catch (error) {
        console.error('[API_CONFIG_GET_ERROR]', error);
        res.status(500).json({
            status: 500,
            message: 'Gagal mengambil konfigurasi.',
            error: error.message
        });
    }
});

router.post('/api/cron', ensureAuthenticatedStaff, (req, res) => {
    if (!req.user || !['admin', 'owner', 'superadmin'].includes(req.user.role)) {
        return res.status(403).json({ message: "Akses ditolak." });
    }

    const cronDbPath = path.join(__dirname, '..', 'database', 'cron.json');
    const newConfig = req.body;

    // Validate cron expressions - allow # for disabled schedules
    const cronFields = [
        'unpaid_schedule',
        'schedule',
        'schedule_unpaid_action',
        'schedule_isolir_notification',
        'schedule_compensation_revert',
        'check_schedule'  // Added redaman check schedule
    ];

    for (const field of cronFields) {
        if (newConfig[field]) {
            const value = newConfig[field].trim();
            
            // Allow # at beginning (disabled cron)
            if (value.startsWith('#')) {
                // It's disabled, keep as-is
                newConfig[field] = value;
            } else {
                // Validate as active cron expression
                if (!isValidCron(value)) {
                    return res.status(400).json({
                        message: `Jadwal cron tidak valid untuk kolom '${field}'. Gunakan format cron yang benar atau awali dengan # untuk menonaktifkan.`, 
                        field: field
                    });
                }
                newConfig[field] = value;
            }
        }
    }

    try {
        // Write the new config to the file
        fs.writeFileSync(cronDbPath, JSON.stringify(newConfig, null, 2), 'utf8');

        // Re-initialize all cron tasks with the new settings
        initializeAllCronTasks();

        res.status(200).json({ message: 'Konfigurasi cron berhasil diperbarui dan jadwal telah dimuat ulang.' });
    } catch (error) {
        console.error('[API_CRON_SAVE_ERROR]', error);
        res.status(500).json({ message: 'Gagal menyimpan konfigurasi cron.', error: error.message });
    }
});

router.post('/api/config', ensureAuthenticatedStaff, async (req, res) => {
    if (!req.user || !['admin', 'owner', 'superadmin'].includes(req.user.role)) {
        return res.status(403).json({ message: "Akses ditolak." });
    }

    const mainConfigPath = path.join(__dirname, '..', 'config.json');
    const cronConfigPath = path.join(__dirname, '..', 'database', 'cron.json');

    try {
        const receivedConfig = req.body;

        // Load current configs to get keys and preserve structure
        const currentMainConfig = JSON.parse(fs.readFileSync(mainConfigPath, 'utf8'));
        const currentCronConfig = JSON.parse(fs.readFileSync(cronConfigPath, 'utf8'));

        const newMainConfig = {};
        const newCronConfig = {};

        // Separate keys based on their existence in the current cron.json
        for (const key in receivedConfig) {
            if (Object.prototype.hasOwnProperty.call(receivedConfig, key)) {
                // A special case for ipaymuProduction which is "yes" or "no" from the form
                if (key === 'ipaymuProduction') {
                    newMainConfig[key] = receivedConfig[key] === 'yes';
                    continue;
                }

                // Handle the custom_wifi_modification boolean conversion
                if (key === 'custom_wifi_modification') {
                    newMainConfig[key] = receivedConfig[key] === 'true';
                    continue;
                }

                // Handle the sync_to_mikrotik boolean conversion
                if (key === 'sync_to_mikrotik') {
                    newMainConfig[key] = receivedConfig[key] === 'true';
                    continue;
                }

                // Handle speedOnDemandEnabled - update speed_boost_matrix.json
                if (key === 'speedOnDemandEnabled') {
                    const speedBoostConfigPath = path.join(__dirname, '..', 'database', 'speed_boost_matrix.json');
                    try {
                        let speedBoostConfig = { enabled: true };
                        if (fs.existsSync(speedBoostConfigPath)) {
                            speedBoostConfig = JSON.parse(fs.readFileSync(speedBoostConfigPath, 'utf8'));
                        }
                        speedBoostConfig.enabled = receivedConfig[key] === 'true';
                        speedBoostConfig.lastUpdated = new Date().toISOString();
                        fs.writeFileSync(speedBoostConfigPath, JSON.stringify(speedBoostConfig, null, 2), 'utf8');
                        
                        // Update global config if exists
                        if (global.speedBoostConfig) {
                            global.speedBoostConfig = speedBoostConfig;
                        }
                        
                        console.log('[CONFIG_SAVE] Speed On Demand updated:', speedBoostConfig.enabled);
                    } catch (err) {
                        console.error('[CONFIG_SAVE] Failed to update speed boost config:', err);
                    }
                    continue; // Don't add to mainConfig
                }

                // Handle showPaymentStatus and showDueDate - boolean conversion
                if (key === 'showPaymentStatus' || key === 'showDueDate') {
                    newMainConfig[key] = receivedConfig[key] === 'true';
                    continue;
                }

                // Handle welcomeMessage object
                if (key === 'welcomeMessageEnabled' || key === 'customerPortalUrl') {
                    // Initialize welcomeMessage object if not exists
                    if (!newMainConfig.welcomeMessage) {
                        newMainConfig.welcomeMessage = {};
                    }
                    if (key === 'welcomeMessageEnabled') {
                        newMainConfig.welcomeMessage.enabled = receivedConfig[key] === 'true';
                    } else if (key === 'customerPortalUrl') {
                        newMainConfig.welcomeMessage.customerPortalUrl = receivedConfig[key];
                    }
                    continue;
                }

                if (key in currentCronConfig) {
                    newCronConfig[key] = receivedConfig[key];
                } else {
                    newMainConfig[key] = receivedConfig[key];
                }
            }
        }

        // Merge the new data with the existing config to preserve any unsubmitted fields
        const finalMainConfig = { ...currentMainConfig, ...newMainConfig };
        const finalCronConfig = { ...currentCronConfig, ...newCronConfig };
        
        // Merge welcomeMessage object properly if it exists
        if (newMainConfig.welcomeMessage) {
            finalMainConfig.welcomeMessage = {
                ...(currentMainConfig.welcomeMessage || {}),
                ...newMainConfig.welcomeMessage
            };
        }

        // Write the updated configs back to their files
        fs.writeFileSync(mainConfigPath, JSON.stringify(finalMainConfig, null, 4), 'utf8');
        fs.writeFileSync(cronConfigPath, JSON.stringify(finalCronConfig, null, 2), 'utf8');

        // Update the global config objects in memory (BOTH main and cron)
        global.config = finalMainConfig;
        if (global.cronConfig) {
            global.cronConfig = finalCronConfig;
        }
        
        console.log('[CONFIG_SAVE] Config saved. accessLimit:', finalMainConfig.accessLimit || finalCronConfig.accessLimit || 'not set');

        // Log activity
        try {
            const changedKeys = Object.keys(newMainConfig).concat(Object.keys(newCronConfig));
            await logActivity({
                userId: req.user.id,
                username: req.user.username,
                role: req.user.role,
                actionType: 'UPDATE',
                resourceType: 'config',
                resourceId: 'system',
                resourceName: 'System Configuration',
                description: `Updated system configuration (${changedKeys.length} keys changed)`,
                oldValue: { ...currentMainConfig, ...currentCronConfig },
                newValue: { ...finalMainConfig, ...finalCronConfig },
                ipAddress: req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'],
                userAgent: req.headers['user-agent']
            });
        } catch (logErr) {
            console.error('[ACTIVITY_LOG_ERROR] Failed to log config change:', logErr);
        }

        // Re-initialize cron tasks with the new settings
        initializeAllCronTasks();

        res.status(200).json({ message: 'Konfigurasi berhasil disimpan dan diterapkan.' });

    } catch (error) {
        console.error('[API_CONFIG_SAVE_ERROR]', error);
        res.status(500).json({ message: 'Gagal memproses konfigurasi.', error: error.message });
    }
});

// --- Announcements CRUD ---
router.post('/api/announcements', ensureAuthenticatedStaff, (req, res) => {
    const { message } = req.body;
    if (!message || typeof message !== 'string' || message.trim() === '') {
        return res.status(400).json({ status: 400, message: "Pesan tidak boleh kosong." });
    }
    try {
        const newAnnouncement = {
            id: String(Date.now()),
            message: message.trim(),
            createdAt: new Date().toISOString()
        };
        global.announcements.push(newAnnouncement);
        saveJSON('announcements.json', global.announcements);
        res.status(201).json({ 
            status: 201, 
            message: "Pengumuman berhasil dibuat.", 
            data: newAnnouncement 
        });
    } catch (error) {
        console.error("[API_ANNOUNCEMENTS_POST_ERROR]", error);
        res.status(500).json({ status: 500, message: "Gagal membuat pengumuman." });
    }
});

router.post('/api/announcements/:id', ensureAuthenticatedStaff, (req, res) => {
    const { id } = req.params;
    const { message } = req.body;
    if (!message || typeof message !== 'string' || message.trim() === '') {
        return res.status(400).json({ status: 400, message: "Pesan tidak boleh kosong." });
    }
    try {
        const announcementIndex = global.announcements.findIndex(a => a.id === id);
        if (announcementIndex === -1) {
            return res.status(404).json({ status: 404, message: "Pengumuman tidak ditemukan." });
        }
        global.announcements[announcementIndex].message = message.trim();
        saveJSON('announcements.json', global.announcements);
        res.status(200).json({ 
            status: 200, 
            message: "Pengumuman berhasil diperbarui.", 
            data: global.announcements[announcementIndex] 
        });
    } catch (error) {
        console.error("[API_ANNOUNCEMENTS_UPDATE_ERROR]", error);
        res.status(500).json({ status: 500, message: "Gagal memperbarui pengumuman." });
    }
});

router.delete('/api/announcements/:id', ensureAuthenticatedStaff, (req, res) => {
    const { id } = req.params;
    try {
        const initialLength = global.announcements.length;
        global.announcements = global.announcements.filter(a => a.id !== id);
        if (global.announcements.length === initialLength) {
            return res.status(404).json({ status: 404, message: "Pengumuman tidak ditemukan." });
        }
        saveJSON('announcements.json', global.announcements);
        res.status(200).json({ status: 200, message: "Pengumuman berhasil dihapus." });
    } catch (error) {
        console.error("[API_ANNOUNCEMENTS_DELETE_ERROR]", error);
        res.status(500).json({ status: 500, message: "Gagal menghapus pengumuman." });
    }
});

// --- News CRUD ---
router.post('/api/news', ensureAuthenticatedStaff, (req, res) => {
    const { title, news_content } = req.body;
    if (!title || typeof title !== 'string' || title.trim() === '') {
        return res.status(400).json({ status: 400, message: "Judul tidak boleh kosong." });
    }
    if (!news_content || typeof news_content !== 'string' || news_content.trim() === '') {
        return res.status(400).json({ status: 400, message: "Konten tidak boleh kosong." });
    }
    try {
        const newItem = {
            id: `news_${Date.now()}`,
            title: title.trim(),
            content: news_content.trim(),
            createdAt: new Date().toISOString()
        };
        global.news.push(newItem);
        saveJSON('news.json', global.news);
        res.status(201).json({ 
            status: 201, 
            message: "Berita berhasil dibuat.", 
            data: newItem 
        });
    } catch (error) {
        console.error("[API_NEWS_POST_ERROR]", error);
        res.status(500).json({ status: 500, message: "Gagal membuat berita." });
    }
});

router.post('/api/news/:id', ensureAuthenticatedStaff, (req, res) => {
    const { id } = req.params;
    const { title, news_content } = req.body;
    if (!title || typeof title !== 'string' || title.trim() === '') {
        return res.status(400).json({ status: 400, message: "Judul tidak boleh kosong." });
    }
    if (!news_content || typeof news_content !== 'string' || news_content.trim() === '') {
        return res.status(400).json({ status: 400, message: "Konten tidak boleh kosong." });
    }
    try {
        const newsIndex = global.news.findIndex(item => item.id === id);
        if (newsIndex === -1) {
            return res.status(404).json({ status: 404, message: "Berita tidak ditemukan." });
        }
        global.news[newsIndex].title = title.trim();
        global.news[newsIndex].content = news_content.trim();
        saveJSON('news.json', global.news);
        res.status(200).json({ 
            status: 200, 
            message: "Berita berhasil diperbarui.", 
            data: global.news[newsIndex] 
        });
    } catch (error) {
        console.error("[API_NEWS_UPDATE_ERROR]", error);
        res.status(500).json({ status: 500, message: "Gagal memperbarui berita." });
    }
});

router.delete('/api/news/:id', ensureAuthenticatedStaff, (req, res) => {
    const { id } = req.params;
    try {
        const initialLength = global.news.length;
        global.news = global.news.filter(item => item.id !== id);
        if (global.news.length === initialLength) {
            return res.status(404).json({ status: 404, message: "Berita tidak ditemukan." });
        }
        saveJSON('news.json', global.news);
        res.status(200).json({ status: 200, message: "Berita berhasil dihapus." });
    } catch (error) {
        console.error("[API_NEWS_DELETE_ERROR]", error);
        res.status(500).json({ status: 500, message: "Gagal menghapus berita." });
    }
});


router.post('/api/requests/bulk-approve', async (req, res) => {
    if (!req.user || !['admin', 'owner', 'superadmin'].includes(req.user.role)) {
        return res.status(403).json({ message: "Akses ditolak." });
    }
    const { requestIds } = req.body;
    if (!requestIds || !Array.isArray(requestIds) || requestIds.length === 0) {
        return res.status(400).json({ message: "Array 'requestIds' diperlukan." });
    }
    let allRequests = loadJSON('database/requests.json');
    const results = { success: [], failed: [] };
    for (const reqId of requestIds) {
        const requestIndex = allRequests.findIndex(r => String(r.id) === String(reqId) && r.status === "pending");
        if (requestIndex === -1) {
            results.failed.push({ id: reqId, reason: "Permintaan tidak ditemukan atau status bukan 'pending'." });
            continue;
        }
        let requestToUpdate = allRequests[requestIndex];
        requestToUpdate.status = "approved";
        requestToUpdate.updated_at = new Date().toISOString();
        requestToUpdate.updated_by = req.user.id;
        const userToUpdate = global.users.find(u => String(u.id) === String(requestToUpdate.userId));
        if (!userToUpdate) {
            results.failed.push({ id: reqId, reason: `User dengan ID ${requestToUpdate.userId} tidak ditemukan.` });
            allRequests[requestIndex] = requestToUpdate;
            continue;
        }
        const newPaidStatus = requestToUpdate.newStatus === true ? 1 : 0;
        try {
            await new Promise((resolve, reject) => {
                db.run('UPDATE users SET paid = ? WHERE id = ?', [newPaidStatus, userToUpdate.id], function(err) {
                    if (err) {
                        console.error(`[BULK_APPROVE_DB_ERROR] Gagal update status paid untuk user ID ${userToUpdate.id}:`, err.message);
                        return reject(new Error(`Gagal memperbarui status paid di database untuk user ID ${userToUpdate.id}.`));
                    }
                    resolve();
                });
            });

            // DB update successful, now update cache and handle side effects
            const oldPaidStatus = userToUpdate.paid;
            userToUpdate.paid = (newPaidStatus === 1);
            
            // Log activity
            try {
                await logActivity({
                    userId: req.user.id,
                    username: req.user.username,
                    role: req.user.role,
                    actionType: 'UPDATE',
                    resourceType: 'payment',
                    resourceId: userToUpdate.id.toString(),
                    resourceName: userToUpdate.name,
                    description: `Approved payment request for user ${userToUpdate.name} (bulk approve)`,
                    oldValue: { paid: oldPaidStatus },
                    newValue: { paid: userToUpdate.paid },
                    ipAddress: req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'],
                    userAgent: req.headers['user-agent']
                });
            } catch (logErr) {
                console.error('[ACTIVITY_LOG_ERROR] Failed to log payment approval:', logErr);
            }
            
            if (userToUpdate.paid === true) {
                // Determine payment method:
                // 1. Use payment_method from original request (CASH for teknisi)
                // 2. If request is from teknisi and newStatus is true, default to CASH
                // 3. Fallback to TRANSFER_BANK for backward compatibility
                let paymentMethod = 'TRANSFER_BANK';
                if (requestToUpdate.payment_method) {
                    paymentMethod = requestToUpdate.payment_method;
                } else if (requestToUpdate.requested_by_teknisi_id && requestToUpdate.newStatus === true) {
                    // Old teknisi requests without payment_method field - default to CASH
                    paymentMethod = 'CASH';
                }
                
                // Store payment_method in request for history
                requestToUpdate.payment_method = paymentMethod;
                
                const paymentDetails = {
                    paidDate: new Date().toISOString(),
                    method: paymentMethod,
                    approvedBy: req.user.username || 'Admin',
                    notes: `Pembayaran disetujui melalui sistem approval (${paymentMethod === 'CASH' ? 'Tunai' : 'Transfer Bank'})`
                };
                await handlePaidStatusChange(userToUpdate, paymentDetails);
            }

            allRequests[requestIndex] = requestToUpdate;
            sendTechnicianNotification(true, requestToUpdate, userToUpdate);
            results.success.push(reqId);

        } catch (e) {
            console.error(`[ASYNC_BULK_APPROVE_ERROR] A post-approval operation failed for user ${userToUpdate.name}:`, e.message);
            results.failed.push({ id: reqId, reason: `Proses persetujuan gagal: ${e.message}` });
        }
    }
    saveJSON('database/requests.json', allRequests);
    return res.status(200).json({
        message: `Proses approve massal selesai. Berhasil: ${results.success.length}, Gagal: ${results.failed.length}`,
        results
    });
});

router.post('/api/request-package-change', ensureAuthenticatedStaff, rateLimit('request-package-change', 5, 60000), async (req, res) => {
    const { userId, newPackageName, notes } = req.body;
    const requester = req.user; // Can be admin or technician

    // Validasi input
    if (!userId || !newPackageName) {
        return res.status(400).json({ message: "Parameter 'userId' dan 'newPackageName' wajib diisi." });
    }

    // Use lock to prevent race condition when creating request for same user
    try {
        return await withLock(`create-pkg-request-${userId}`, async () => {
            // Validasi user exists
            const user = global.users.find(u => u.id == userId);
            if (!user) {
                console.error(`[API_REQUEST_PKG_CHANGE_ERROR] User ID ${userId} tidak ditemukan.`);
                return res.status(404).json({ message: `Pelanggan dengan ID ${userId} tidak ditemukan.` });
            }

            // Validasi package exists
            const requestedPackage = global.packages.find(p => p.name === newPackageName);
            if (!requestedPackage) {
                console.error(`[API_REQUEST_PKG_CHANGE_ERROR] Package '${newPackageName}' tidak ditemukan.`);
                return res.status(404).json({ message: `Paket '${newPackageName}' tidak ditemukan.` });
            }

            // Cek apakah user sudah menggunakan paket yang diminta
            if (user.subscription === newPackageName) {
                return res.status(400).json({ message: `Pelanggan sudah menggunakan paket '${newPackageName}'.` });
            }

            // Auto-cancel expired requests sebelum cek duplicate
            const sevenDaysInMs = 7 * 24 * 60 * 60 * 1000;
            const now = Date.now();
            let hasExpiredRequests = false;
            
            global.packageChangeRequests.forEach(request => {
                if (request.status === 'pending' && request.createdAt) {
                    try {
                        const requestAge = now - new Date(request.createdAt).getTime();
                        if (requestAge > sevenDaysInMs) {
                            request.status = 'cancelled_by_system';
                            request.updatedAt = new Date().toISOString();
                            request.notes = (request.notes || '') + ' [Auto-cancelled: Request expired >7 hari]';
                            hasExpiredRequests = true;
                            console.log(`[PKG_REQUEST_AUTO_CANCEL] Request ID ${request.id} auto-cancelled karena expired (>7 hari).`);
                        }
                    } catch (e) {
                        console.error(`[PKG_REQUEST_AUTO_CANCEL_ERROR] Error processing request ${request.id}:`, e.message);
                    }
                }
            });
            
            // Simpan jika ada expired requests yang di-cancel
            if (hasExpiredRequests) {
                savePackageChangeRequests();
            }

            // Cek apakah ada request pending untuk user ini (setelah auto-cancel)
            const existingPendingRequest = global.packageChangeRequests.find(
                r => r.userId === user.id && r.status === 'pending'
            );
            if (existingPendingRequest) {
                return res.status(400).json({ 
                    message: `Pelanggan ini sudah memiliki permintaan perubahan paket yang sedang menunggu persetujuan (Request ID: ${existingPendingRequest.id}).` 
                });
            }

            // Buat request baru
            const newRequest = {
                id: `req_pkg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
                userId: user.id,
                userName: user.name,
                userPhone: user.phone_number || 'N/A',
                currentPackageName: user.subscription || 'Belum berlangganan',
                requestedPackageName: newPackageName,
                requestedPackagePrice: requestedPackage.price || 0,
                requestedBy: requester.username,
                requestedByRole: requester.role,
                requestedById: requester.id,
                createdAt: new Date().toISOString(),
                updatedAt: null,
                approvedBy: null,
                status: 'pending',
                notes: notes || ''
            };

            // Simpan ke database
            global.packageChangeRequests.push(newRequest);
            savePackageChangeRequests();

            console.log(`[REQUEST_PKG_CHANGE_LOG] ${requester.role.toUpperCase()} ${requester.username} (ID: ${requester.id}) membuat permintaan perubahan paket untuk User ${user.name} (ID: ${user.id}). Paket: ${user.subscription} → ${newPackageName}`);

            // Kirim notifikasi WhatsApp ke admin/owner
            // PENTING: Gunakan connection state check yang benar
            if (global.whatsappConnectionState === 'open' && global.raf && global.raf.sendMessage && global.config.ownerNumber && Array.isArray(global.config.ownerNumber) && global.config.ownerNumber.length > 0) {
            const { delay } = await import('@whiskeysockets/baileys');
            
            // Format harga paket
            const formattedPrice = new Intl.NumberFormat('id-ID', { 
                style: 'currency', 
                currency: 'IDR', 
                minimumFractionDigits: 0 
            }).format(requestedPackage.price);

            // Buat pesan notifikasi
            const requesterName = requester.name || requester.username;
            const messageToOwner = `🔔 *Permintaan Perubahan Paket Baru* 🔔

${requester.role === 'teknisi' ? 'Teknisi' : 'Admin'} *${requesterName}* telah mengajukan permintaan perubahan paket untuk pelanggan:

👤 *Pelanggan:* ${user.name}
📱 *Telepon:* ${user.phone_number || 'Tidak ada'}

📦 *Perubahan Paket:*
• Paket Saat Ini: ${user.subscription || 'Belum berlangganan'}
• Paket Baru: *${newPackageName}*
• Harga: ${formattedPrice}

${notes ? `📝 *Catatan:*\n${notes}\n\n` : ''}🆔 *Request ID:* ${newRequest.id}
⏰ *Waktu:* ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}

_Mohon segera ditinjau dan diproses di panel admin._`;

            // Kirim ke semua owner number
            // PENTING: Cek connection state dan gunakan error handling sesuai rules untuk multiple recipients
            for (const ownerNum of global.config.ownerNumber) {
                const ownerNumberJid = ownerNum.endsWith('@s.whatsapp.net') ? ownerNum : `${ownerNum}@s.whatsapp.net`;
                if (global.whatsappConnectionState === 'open' && global.raf && global.raf.sendMessage) {
                    try {
                        await delay(1000); // Delay untuk menghindari spam
                        await global.raf.sendMessage(ownerNumberJid, { text: messageToOwner });
                        console.log(`[REQUEST_PKG_CHANGE_NOTIF] Notifikasi berhasil dikirim ke owner ${ownerNumberJid}`);
                    } catch (notifError) {
                        console.error('[SEND_MESSAGE_ERROR]', {
                            ownerNumberJid,
                            error: notifError.message
                        });
                        console.error(`[REQUEST_PKG_CHANGE_NOTIF_ERROR] Gagal kirim notif ke owner ${ownerNum}:`, notifError.message);
                        // Continue to next owner
                    }
                } else {
                    console.warn('[SEND_MESSAGE_SKIP] WhatsApp not connected, skipping send to owner', ownerNumberJid);
                }
            }
        } else {
            console.warn(`[REQUEST_PKG_CHANGE_NOTIF_WARN] WhatsApp tidak terhubung atau ownerNumber tidak dikonfigurasi. Notifikasi tidak dikirim.`);
        }

            return res.status(201).json({ 
                message: 'Permintaan perubahan paket berhasil dibuat dan akan ditinjau oleh admin.',
                data: {
                    requestId: newRequest.id,
                    status: newRequest.status
                }
            });
        });
    } catch (error) {
        console.error(`[API_REQUEST_PKG_CHANGE_ERROR] Gagal membuat permintaan:`, error);
        return res.status(500).json({ 
            message: error.message === `Could not acquire lock for create-pkg-request-${userId}`
                ? 'Request sedang diproses. Silakan coba lagi.'
                : (error.message || "Terjadi kesalahan internal server.")
        });
    }
});

router.post('/api/approve-package-change', ensureAuthenticatedStaff, async (req, res) => {
    if (!req.user || !['admin', 'owner', 'superadmin'].includes(req.user.role)) {
        return res.status(403).json({ message: "Akses ditolak." });
    }

    const { requestId, action, notes } = req.body; // action can be 'approve' or 'reject'

    if (!requestId || !action) {
        return res.status(400).json({ message: "Parameter 'requestId' dan 'action' wajib diisi." });
    }

    // Use lock to prevent race condition when approving same request
    try {
        return await withLock(`approve-pkg-${requestId}`, async () => {
            const requestIndex = global.packageChangeRequests.findIndex(r => r.id === requestId);

            if (requestIndex === -1) {
                return res.status(404).json({ message: "Permintaan perubahan paket tidak ditemukan." });
            }

            const request = global.packageChangeRequests[requestIndex];

            if (request.status !== 'pending') {
                return res.status(400).json({ message: `Permintaan ini sudah dalam status '${request.status}' dan tidak dapat diubah lagi.` });
            }

            const adminUser = req.user;
            let notificationMessage = "";

            try {
        if (action === 'approve') {
            const user = global.users.find(u => u.id === request.userId);
            if (!user) throw new Error(`User dengan ID ${request.userId} untuk permintaan ini tidak ditemukan.`);
            if (!user.pppoe_username) throw new Error(`User ${user.name} tidak memiliki username PPPoE.`);

            const requestedPackage = global.packages.find(p => p.name === request.requestedPackageName);
            if (!requestedPackage || !requestedPackage.profile) throw new Error(`Paket yang diminta (${request.requestedPackageName}) atau profil Mikrotik-nya tidak ditemukan.`);

            const newProfile = requestedPackage.profile;

            // Store old package for activity log (before any changes)
            const oldPackage = user.subscription;

            // Check if sync to MikroTik is enabled before syncing
            const syncToMikrotik = global.config.sync_to_mikrotik !== false; // Default to true if not set

            // PENTING: Update MikroTik FIRST, baru update database
            // Ini untuk mencegah inconsistent state jika MikroTik error
            if (syncToMikrotik) {
                // Update profile on Mikrotik FIRST
                try {
                    await updatePPPoEProfile(user.pppoe_username, newProfile);
                    console.log(`[PKG_CHANGE_MIKROTIK_SYNC] Successfully updated profile for ${user.pppoe_username} to ${newProfile}.`);
                } catch (mikrotikError) {
                    console.error(`[PKG_CHANGE_MIKROTIK_ERROR] Failed to update profile for ${user.pppoe_username}:`, mikrotikError.message);
                    // Jika MikroTik error, jangan update database - throw error untuk prevent inconsistent state
                    throw new Error(`Gagal mengupdate profil di MikroTik: ${mikrotikError.message}. Database tidak di-update untuk mencegah inconsistent state.`);
                }

                // Try to disconnect the user so the new profile takes effect
                // Ini tidak critical, jadi jika error tidak perlu throw
                try {
                    await deleteActivePPPoEUser(user.pppoe_username);
                    console.log(`[PKG_CHANGE_APPROVE] Successfully disconnected active session for ${user.pppoe_username}.`);
                } catch (e) {
                    console.warn(`[PKG_CHANGE_APPROVE_WARN] Gagal memutuskan sesi aktif untuk ${user.pppoe_username}, mungkin sedang tidak online. Melanjutkan proses. Error: ${e.message}`);
                    // Tidak throw error karena disconnect tidak critical
                }
            } else {
                console.log(`[PKG_CHANGE_MIKROTIK_SYNC] Sync to MikroTik is DISABLED - skipping profile update for ${user.pppoe_username}.`);
            }

            // Update user's subscription in the database
            // Hanya dilakukan jika MikroTik update berhasil (atau sync disabled)
            user.subscription = request.requestedPackageName;
            
            // Log activity
            try {
                await logActivity({
                    userId: req.user.id,
                    username: req.user.username,
                    role: req.user.role,
                    actionType: 'UPDATE',
                    resourceType: 'package',
                    resourceId: user.id.toString(),
                    resourceName: user.name,
                    description: `Approved package change for user ${user.name}: ${oldPackage} → ${request.requestedPackageName}`,
                    oldValue: { subscription: oldPackage },
                    newValue: { subscription: request.requestedPackageName },
                    ipAddress: req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'],
                    userAgent: req.headers['user-agent']
                });
            } catch (logErr) {
                console.error('[ACTIVITY_LOG_ERROR] Failed to log package change:', logErr);
            }
            
            // No need to call a separate saveUsers() function as global.users is manipulated directly
            // and will be persisted if the app restarts based on the SQLite DB.
            // We do need to update the SQLite DB, however.
            await new Promise((resolve, reject) => {
                global.db.run('UPDATE users SET subscription = ? WHERE id = ?', [request.requestedPackageName, user.id], function(err) {
                    if (err) {
                        console.error(`[PKG_CHANGE_APPROVE_DB_ERROR] Gagal update langganan untuk user ID ${user.id}:`, err.message);
                        return reject(new Error(`Gagal memperbarui langganan di database.`));
                    }
                    resolve();
                });
            });


            // Update request status
            request.status = 'approved';
            notificationMessage = `✅ *Permintaan Perubahan Paket Disetujui!*

Halo ${user.name},
Kabar baik! Permintaan Anda untuk mengubah layanan ke paket *${request.requestedPackageName}* telah disetujui dan sekarang aktif.

Terima kasih telah menggunakan layanan kami.`;

        } else if (action === 'reject') {
            request.status = 'rejected';
            const user = global.users.find(u => u.id === request.userId);
            notificationMessage = `❌ *Permintaan Perubahan Paket Ditolak*

Halo ${user.name},
Mohon maaf, permintaan Anda untuk mengubah layanan ke paket *${request.requestedPackageName}* saat ini belum dapat kami setujui.

Alasan: ${notes || 'Ditolak oleh admin.'}

Silakan hubungi admin untuk informasi lebih lanjut.`;
        } else {
            return res.status(400).json({ message: "Aksi tidak valid. Gunakan 'approve' atau 'reject'." });
        }

        request.updatedAt = new Date().toISOString();
        request.approvedBy = adminUser.username;
        request.notes = notes || "";

        global.packageChangeRequests[requestIndex] = request;
        savePackageChangeRequests();

        // Send notification to customer
        const user = global.users.find(u => u.id === request.userId);
        if (user && user.phone_number && global.raf) {
             const phoneNumbers = user.phone_number.split('|');
             // PENTING: Cek connection state dan gunakan error handling sesuai rules untuk multiple recipients
             for (let number of phoneNumbers) {
                let normalizedNumber = normalizePhoneNumber(number);
                if(normalizedNumber) {
                    const phoneJid = `${normalizedNumber}@s.whatsapp.net`;
                    if (global.whatsappConnectionState === 'open' && global.raf && global.raf.sendMessage) {
                        try {
                            await global.raf.sendMessage(phoneJid, { text: notificationMessage });
                        } catch (e) {
                            console.error('[SEND_MESSAGE_ERROR]', {
                                phoneJid,
                                error: e.message
                            });
                            console.error(`[PKG_CHANGE_ACTION_NOTIF_ERROR] Gagal kirim notif ke ${normalizedNumber}:`, e.message);
                            // Continue to next number
                        }
                    } else {
                        console.warn('[SEND_MESSAGE_SKIP] WhatsApp not connected, skipping send to', phoneJid);
                    }
                }
             }
        }

        // Send notification to teknisi who requested the change
        const teknisiAccount = global.accounts.find(acc => acc.id === request.requestedById);
        if (teknisiAccount && teknisiAccount.phone_number && global.raf) {
            const teknisiName = teknisiAccount.name || teknisiAccount.username;
            const statusEmoji = action === 'approve' ? '✅' : '❌';
            const statusText = action === 'approve' ? 'DISETUJUI' : 'DITOLAK';
            
            let teknisiMessage = `${statusEmoji} *Permintaan Perubahan Paket ${statusText}*

`;
            teknisiMessage += `Halo ${teknisiName},\n\n`;
            teknisiMessage += `Permintaan perubahan paket yang Anda ajukan telah *${statusText}* oleh admin.\n\n`;
            teknisiMessage += `📋 *Detail Permintaan:*\n`;
            teknisiMessage += `• Request ID: ${request.id}\n`;
            teknisiMessage += `• Pelanggan: ${user ? user.name : 'N/A'}\n`;
            teknisiMessage += `• Paket Lama: ${request.currentPackageName}\n`;
            teknisiMessage += `• Paket Baru: ${request.requestedPackageName}\n`;
            if (action === 'reject' && notes) {
                teknisiMessage += `\n❌ *Alasan Penolakan:*\n${notes}\n`;
            }
            teknisiMessage += `\n⏰ *Waktu Diproses:* ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}\n`;
            teknisiMessage += `👤 *Diproses Oleh:* ${adminUser.username}`;
            
            let teknisiPhone = teknisiAccount.phone_number.trim();
            if (!teknisiPhone.endsWith('@s.whatsapp.net')) {
                if (teknisiPhone.startsWith('0')) {
                    teknisiPhone = `62${teknisiPhone.substring(1)}@s.whatsapp.net`;
                } else if (teknisiPhone.startsWith('62')) {
                    teknisiPhone = `${teknisiPhone}@s.whatsapp.net`;
                } else {
                    teknisiPhone = `62${teknisiPhone}@s.whatsapp.net`;
                }
            }
            
            // PENTING: Cek connection state dan gunakan error handling sesuai rules
            if (global.whatsappConnectionState === 'open' && global.raf && global.raf.sendMessage) {
                try {
                    await global.raf.sendMessage(teknisiPhone, { text: teknisiMessage });
                    console.log(`[PKG_CHANGE_TEKNISI_NOTIF] Notifikasi berhasil dikirim ke teknisi ${teknisiName} (${teknisiPhone})`);
                } catch (e) {
                    console.error('[SEND_MESSAGE_ERROR]', {
                        teknisiPhone,
                        error: e.message
                    });
                    console.error(`[PKG_CHANGE_TEKNISI_NOTIF_ERROR] Gagal kirim notif ke teknisi ${teknisiPhone}:`, e.message);
                }
            } else {
                console.warn('[SEND_MESSAGE_SKIP] WhatsApp not connected, skipping send to teknisi', teknisiPhone);
            }
        }

            return res.status(200).json({ message: `Permintaan berhasil di-${action === 'approve' ? 'setujui' : 'tolak'}.` });
            } catch (error) {
                console.error(`[API_APPROVE_PKG_CHANGE_ERROR] Gagal memproses permintaan ${requestId}:`, error);
                throw error; // Re-throw untuk ditangani oleh outer catch
            }
        });
    } catch (error) {
        console.error(`[API_APPROVE_PKG_CHANGE_ERROR] Gagal memproses permintaan ${requestId}:`, error);
        return res.status(500).json({ 
            message: error.message === `Could not acquire lock for approve-pkg-${requestId}`
                ? 'Request sedang diproses. Silakan coba lagi.'
                : (error.message || "Terjadi kesalahan internal server.")
        });
    }
});


// ... (and so on for all other admin routes) ...
// This would be a very long file. To keep this concise, I will just include a few more examples.

router.get('/api/package-change-requests', ensureAuthenticatedStaff, (req, res) => {
    if (!req.user || !['admin', 'owner', 'superadmin'].includes(req.user.role)) {
        return res.status(403).json({ data: [], message: "Akses ditolak." });
    }
    // Sort by most recent first
    const sortedRequests = [...global.packageChangeRequests].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return res.json({ data: sortedRequests });
});

router.get('/api/status/genieacs', ensureAuthenticatedStaff, async (req, res) => {
    console.log(`[DIAGNOSTIC_LOG] Request received for /api/status/genieacs at ${new Date().toISOString()}`);
    try {
        const response = await axios.get(`${global.config.genieacsBaseUrl}/devices?projection=_id&limit=1`, { timeout: 5000 });
        if (response.status >= 200 && response.status < 300) {
            return res.status(200).json({ status: 200, message: "Connected to GenieACS", connected: true });
        } else {
            return res.status(response.status).json({ status: response.status, message: `GenieACS returned status ${response.status}`, connected: false });
        }
    } catch (error) {
        console.error(`[API_GENIEACS_STATUS_ERROR] Gagal koneksi ke GenieACS: ${error.message}`);
        let errorMessage = "Gagal koneksi ke GenieACS.";
        if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
            errorMessage = "Koneksi ke GenieACS timeout. Pastikan layanan berjalan dan URL benar.";
        } else if (error.response) {
            errorMessage = `GenieACS merespons dengan status error: ${error.response.status} - ${error.response.statusText}`;
        }
        return res.status(500).json({ status: 500, message: errorMessage, connected: false, error_detail: error.message });
    }
});

router.get('/api/get_ppp_stats', ensureAuthenticatedStaff, async (req, res) => {
    const phpScriptPath = path.join(__dirname, '..', 'views/get_ppp_stats.php');
    exec(`php ${phpScriptPath}`, (error, stdout, stderr) => {
        if (error) {
            console.error(`[API_PPP_STATS_ERROR] Error executing PHP script: ${error.message}`);
            return res.status(500).json({ status: 500, message: "Gagal mengambil statistik PPPoE.", error: stderr });
        }
        try {
            const pppStats = JSON.parse(stdout);
            res.status(200).json({ status: 200, message: "Statistik PPPoE berhasil diambil.", data: pppStats });
        } catch (parseError) {
            console.error(`[API_PPP_STATS_ERROR] Gagal parse JSON: ${parseError.message}`);
            res.status(500).json({ status: 500, message: "Format data statistik PPPoE tidak valid.", stdout: stdout });
        }
    });
});

router.get('/api/get_hotspot_stats', ensureAuthenticatedStaff, async (req, res) => {
    const phpScriptPath = path.join(__dirname, '..', 'views/get_hotspot_stats.php');
    exec(`php ${phpScriptPath}`, (error, stdout, stderr) => {
        if (error) {
            console.error(`[API_HOTSPOT_STATS_ERROR] Error executing PHP script: ${error.message}`);
            return res.status(500).json({ status: 500, message: "Gagal mengambil statistik Hotspot.", error: stderr });
        }
        try {
            const hotspotStats = JSON.parse(stdout);
            res.status(200).json({ status: 200, message: "Statistik Hotspot berhasil diambil.", data: hotspotStats });
        } catch (parseError) {
            console.error(`[API_HOTSPOT_STATS_ERROR] Gagal parse JSON: ${parseError.message}`);
            res.status(500).json({ status: 500, message: "Format data statistik Hotspot tidak valid.", stdout: stdout });
        }
    });
});

router.get('/api/status/mikrotik', ensureAuthenticatedStaff, async (req, res) => {
    const phpScriptPath = path.join(__dirname, '..', 'views/check_mikrotik_connection.php');
    exec(`php "${phpScriptPath}"`, (error, stdout, stderr) => {
        if (error) {
            return res.status(500).json({ status: 500, message: "Gagal mengeksekusi skrip pengecek koneksi Mikrotik.", connected: false, stderr });
        }
        try {
            const phpResponse = JSON.parse(stdout);
            res.status(phpResponse.status === 'success' ? 200 : 500).json(phpResponse);
        } catch (parseError) {
            res.status(500).json({ status: 500, message: "Format data status Mikrotik tidak valid.", connected: false, stdout });
        }
    });
});

router.get('/api/customer-wifi-info/:deviceId', ensureAuthenticatedStaff, async (req, res) => {
    const { deviceId } = req.params;
    const skipRefresh = req.query.skipRefresh === 'true'; // Allow optional skip for repeated requests
    
    if (!deviceId) {
        return res.status(400).json({ status: 400, message: "Device ID tidak boleh kosong." });
    }

    try {
        console.log(`[WIFI_INFO_API] Loading SSID info for web UI - device: ${deviceId}, skipRefresh: ${skipRefresh}`);
        
        // For "Lihat Perangkat Terhubung", we need REALTIME data like CEK_WIFI command
        if (!skipRefresh) {
            console.log(`[WIFI_INFO_API] Refreshing device ${deviceId} for realtime data...`);
            
            // Refresh device function (similar to CEK_WIFI handler)
            const refreshDevice = async (objectName) => {
                try {
                    const axios = require('axios');
                    const response = await axios.post(
                        `${global.config.genieacsBaseUrl}/devices/${encodeURIComponent(deviceId)}/tasks?connection_request`,
                        {
                            name: "refreshObject",
                            objectName: objectName
                        },
                        { timeout: 20000 }
                    );
                    console.log(`[WIFI_INFO_API] Refresh ${objectName} status: ${response.status}`);
                    return response.status >= 200 && response.status < 300;
                } catch (err) {
                    console.error(`[WIFI_INFO_API] Error refreshing ${objectName}:`, err.message);
                    return false;
                }
            };

            // Refresh both LAN and Virtual parameters like CEK_WIFI does
            const refreshLAN = refreshDevice("InternetGatewayDevice.LANDevice.1");
            const refreshVirtual = refreshDevice("VirtualParameters");
            
            // Wait for refreshes to complete
            await Promise.all([refreshLAN, refreshVirtual]);
            
            // Wait 3 seconds for data to update (shorter than CEK_WIFI's 10s for better UX)
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            console.log(`[WIFI_INFO_API] Refresh completed, fetching updated data...`);
        }
        
        // Get SSID info - no skip since we already refreshed if needed
        const wifiInfo = await getSSIDInfo(deviceId, skipRefresh);

        // Return the formatted response
        return res.status(200).json({
            status: 200,
            message: "Informasi WiFi berhasil diambil.",
            data: wifiInfo,
            refreshed: !skipRefresh // Let frontend know if data was refreshed
        });

    } catch (error) {
        console.error(`[WIFI_INFO_API_ERROR] Gagal mengambil info WiFi untuk ${deviceId}:`, error.message);
        const statusCode = error.response?.status || 500;
        const errorMessage = error.message || "Terjadi kesalahan internal server.";
        return res.status(statusCode).json({ status: statusCode, message: errorMessage });
    }
});

// Endpoint untuk update SSID dari halaman web admin/teknisi
router.post('/api/ssid/:deviceId', ensureAuthenticatedStaff, async (req, res) => {
    const { deviceId } = req.params;
    const payload = req.body;
    
    console.log(`[WIFI_UPDATE] Received payload for device ${deviceId}:`, JSON.stringify(payload, null, 2));

    if (!deviceId) {
        return res.status(400).json({ status: 400, message: "Device ID tidak boleh kosong." });
    }

    try {
        // Get current WiFi info before making changes for logging
        let currentWifiInfo = null;
        try {
            currentWifiInfo = await getSSIDInfo(deviceId);
            console.log(`[WIFI_LOGGING] Current WiFi info retrieved for ${deviceId}:`, currentWifiInfo);
        } catch (infoError) {
            console.warn(`[WIFI_LOGGING] Could not get current WiFi info for logging: ${infoError.message}`);
        }

        const result = await updateWifiSettings(deviceId, payload);
        
        // GenieACS task creation returns 200/201/202 for successful task submission
        // The actual task execution happens asynchronously
        if (result.status >= 200 && result.status < 300) {
            console.log(`[API_SSID_UPDATE_SUCCESS] Perubahan SSID untuk device ${deviceId} berhasil dikirim ke GenieACS.`);
            
            // Log the WiFi change
            try {
                // Find customer associated with this device - use global.users which is always up to date
                console.log(`[WIFI_LOGGING] Looking for customer with device_id: ${deviceId}`);
                console.log(`[WIFI_LOGGING] Total users in global.users: ${global.users ? global.users.length : 0}`);
                
                // Debug: Show all device_ids in the system
                if (global.users && global.users.length > 0) {
                    console.log(`[WIFI_LOGGING] Available device_ids in system:`);
                    global.users.forEach(u => {
                        console.log(`  - User: ${u.name} (ID: ${u.id}), device_id: ${u.device_id || 'NOT SET'}`);
                    });
                }
                
                let customer = global.users ? global.users.find(u => u.device_id === deviceId) : null;
                
                // Customer should be in global.users (loaded from users.sqlite)
                // No need to check file anymore since all data is in database
                if (!customer) {
                    console.log(`[WIFI_LOGGING] Customer not found in database for device ${deviceId}`);
                }
                
                // Get the admin/staff user who is making the change
                const adminUser = req.user;
                
                if (customer && adminUser) {
                    // Determine change type and prepare changes object
                    let changeType = 'unknown';
                    const changes = {};
                    
                    // Check what fields actually have values (not empty/null/undefined)
                    const hasSSIDChange = payload.ssid_name && payload.ssid_name.trim() !== '';
                    const hasPasswordChange = payload.password && payload.password.trim() !== '';
                    const hasTransmitPowerChange = payload.transmit_power && payload.transmit_power.trim() !== '';
                    
                    // Check for SSID fields with dynamic names (ssid_1, ssid_2, etc.) that actually changed
                    const ssidFields = Object.keys(payload).filter(key => {
                        // Check if it's an SSID field (not password) and has a value
                        if (!key.startsWith('ssid_') || key.includes('password')) {
                            return false;
                        }
                        
                        // Skip fields that match pattern but are not actual SSID fields
                        const ssidId = key.replace('ssid_', '');
                        if (isNaN(parseInt(ssidId))) {
                            return false; // Skip non-numeric SSID IDs
                        }
                        
                        // Check if the field has a non-empty value
                        const newValue = payload[key];
                        if (!newValue || newValue.trim() === '') {
                            return false;
                        }
                        
                        // If we couldn't get current WiFi info, check if value is different from empty
                        if (!currentWifiInfo || !currentWifiInfo.ssid || !Array.isArray(currentWifiInfo.ssid)) {
                            console.log(`[WIFI_LOGGING] No current info available for ${key}, checking if non-empty`);
                            // Only treat as change if the new value is not empty
                            return newValue.trim() !== '';
                        }
                        
                        // Check if this SSID actually changed
                        const currentSSID = currentWifiInfo.ssid.find(s => String(s.id) === String(ssidId));
                        const oldValue = currentSSID?.name || '';
                        
                        // Important: Compare trimmed values to avoid whitespace issues
                        const hasChanged = oldValue.trim() !== newValue.trim();
                        
                        console.log(`[WIFI_LOGGING] SSID ${ssidId} comparison - Old: "${oldValue}", New: "${newValue}", Changed: ${hasChanged}`);
                        return hasChanged;
                    });
                    
                    const passwordFields = Object.keys(payload).filter(key => key.startsWith('ssid_password_') && payload[key] && payload[key].trim() !== '');
                    
                    const hasMultipleSSIDChanges = ssidFields.length > 0;
                    const hasMultiplePasswordChanges = passwordFields.length > 0;
                    
                    // Build detailed change information
                    let ssidChangeDetails = [];
                    let passwordChangeDetails = [];
                    
                    // Handle single SSID change
                    if (hasSSIDChange) {
                        const oldValue = currentWifiInfo?.ssid_name || '';
                        // Only log if actually changed
                        if (oldValue !== payload.ssid_name) {
                            ssidChangeDetails.push(`"${oldValue || 'Unknown'}" → "${payload.ssid_name}"`);
                        }
                    }
                    
                    // Handle multiple SSID changes
                    if (hasMultipleSSIDChanges) {
                        ssidFields.forEach(fieldName => {
                            const ssidId = fieldName.replace('ssid_', '');
                            const newValue = payload[fieldName];
                            // Fix: Use 'ssid' (singular) not 'ssids' (plural)
                            const oldValue = currentWifiInfo?.ssid?.find(s => s.id == ssidId)?.name || 'Unknown';
                            
                            // Always add to details since we already filtered for changes above
                            ssidChangeDetails.push(`SSID ${ssidId}: "${oldValue}" → "${newValue}"`);
                        });
                    }
                    
                    // Handle password changes - Store actual passwords
                    let actualPasswords = [];
                    
                    if (hasPasswordChange) {
                        passwordChangeDetails.push(`Main password: "${payload.password}"`);
                        actualPasswords.push(payload.password);
                    }
                    
                    if (hasMultiplePasswordChanges) {
                        passwordFields.forEach(fieldName => {
                            const ssidId = fieldName.replace('ssid_password_', '');
                            const newPassword = payload[fieldName];
                            // Store both formatted and actual password
                            passwordChangeDetails.push(`SSID ${ssidId} password: "${newPassword}"`);
                            actualPasswords.push(newPassword);
                        });
                    }
                    
                    // Only log if there are actual changes
                    if (ssidChangeDetails.length > 0 && passwordChangeDetails.length > 0) {
                        changeType = 'both';
                        changes.oldSsidName = 'Multiple changes';
                        changes.newSsidName = ssidChangeDetails.join('; ');
                        changes.oldPassword = 'ada';
                        // Store actual password(s) for customer support
                        changes.newPassword = actualPasswords.length === 1 ? actualPasswords[0] : actualPasswords.join(', ');
                        changes.detailPassword = passwordChangeDetails.join('; '); // Keep detailed info
                    } else if (ssidChangeDetails.length > 0) {
                        changeType = 'ssid_name';
                        changes.oldSsidName = ssidChangeDetails.length === 1 ? 'Single SSID' : 'Multiple SSIDs';
                        changes.newSsidName = ssidChangeDetails.join('; ');
                    } else if (passwordChangeDetails.length > 0) {
                        changeType = 'password';
                        changes.oldPassword = 'ada';
                        // Store actual password(s) for customer support
                        changes.newPassword = actualPasswords.length === 1 ? actualPasswords[0] : actualPasswords.join(', ');
                        changes.detailPassword = passwordChangeDetails.join('; '); // Keep detailed info
                    } else if (hasTransmitPowerChange) {
                        changeType = 'transmit_power';
                        changes.oldTransmitPower = currentWifiInfo?.transmit_power || 'N/A';
                        changes.newTransmitPower = payload.transmit_power;
                    }

                    // Only create log if there are actual changes
                    if (changeType !== 'unknown' && (ssidChangeDetails.length > 0 || passwordChangeDetails.length > 0 || hasTransmitPowerChange)) {
                        const logData = {
                            userId: customer.id,
                            deviceId: deviceId,
                            changeType: changeType,
                            changes: changes,
                            changedBy: adminUser.username,
                            changeSource: adminUser.role === 'technician' ? 'web_technician' : 'web_admin',
                            customerName: customer.name,
                            customerPhone: customer.phone,
                            reason: payload.reason || 'Tidak ada keterangan',
                            ipAddress: req.ip,
                            userAgent: req.get('User-Agent')
                        };

                        // Log the change
                        await logWifiChange(logData);
                        console.log(`[WIFI_LOG] ${changeType} change logged for device ${deviceId}`);
                    }
                } else {
                    console.warn(`[WIFI_LOGGING] Customer not found for device ${deviceId} or admin user not authenticated`);
                    
                    // Log with minimal info if customer not found or admin not authenticated
                    if (req.user) {
                        // Determine what type of change this is
                        let changeType = 'unknown';
                        const changes = {};
                        
                        // Check for SSID changes
                        const ssidFields = Object.keys(payload).filter(key => 
                            key.startsWith('ssid_') && !key.includes('password') && payload[key] && payload[key].trim() !== ''
                        );
                        
                        // Check for password changes
                        const passwordFields = Object.keys(payload).filter(key => 
                            key.startsWith('ssid_password_') && payload[key] && payload[key].trim() !== ''
                        );
                        
                        // Collect actual passwords
                        let actualPasswords = [];
                        if (payload.password && payload.password.trim() !== '') {
                            actualPasswords.push(payload.password);
                        }
                        passwordFields.forEach(field => {
                            actualPasswords.push(payload[field]);
                        });
                        
                        // Determine change type and set changes
                        if (ssidFields.length > 0 && actualPasswords.length > 0) {
                            changeType = 'both';
                            changes.newSsidName = ssidFields.map(f => `${f}: ${payload[f]}`).join(', ');
                            changes.newPassword = actualPasswords.length === 1 ? actualPasswords[0] : actualPasswords.join(', ');
                        } else if (ssidFields.length > 0) {
                            changeType = 'ssid_name';
                            changes.newSsidName = ssidFields.map(f => `${f}: ${payload[f]}`).join(', ');
                        } else if (actualPasswords.length > 0) {
                            changeType = 'password';
                            changes.newPassword = actualPasswords.length === 1 ? actualPasswords[0] : actualPasswords.join(', ');
                        }
                        
                        const logData = {
                            userId: 'unknown',
                            deviceId: deviceId,
                            changeType: changeType,
                            changes: changes,
                            changedBy: req.user.username,
                            changeSource: req.user.role === 'technician' ? 'web_technician' : 'web_admin',
                            customerName: 'Unknown Customer',
                            customerPhone: 'N/A',
                            reason: payload.reason || 'Perubahan melalui web admin',
                            ipAddress: req.ip || 'N/A',
                            userAgent: req.get('User-Agent') || 'N/A'
                        };

                        await logWifiChange(logData);
                        console.log(`[WIFI_LOG] Fallback ${logData.changeType} change logged for device ${deviceId}`);
                    }
                }
            } catch (logError) {
                console.error(`[WIFI_LOGGING] ${logError.message}`);
                // Don't fail the request if logging fails
            }
            
            return res.status(200).json({
                status: 200, 
                message: `Perubahan SSID untuk device ${deviceId} berhasil dikirim ke perangkat. Perubahan akan diterapkan dalam beberapa saat.` 
            });
        } else {
            // This case handles non-2xx response codes
            console.warn(`[API_SSID_UPDATE_WARN] Operasi update SSID untuk device ${deviceId} mendapat response tidak standar:`, result.data || result);
            return res.status(result.status || 500).json({
                status: result.status || 500, 
                message: result.data?.message || 'Terjadi masalah saat mengirim perubahan ke perangkat.' 
            });
        }

    } catch (error) {
        console.error(`[API_SSID_UPDATE_ERROR] Gagal mengirim perubahan SSID untuk device ${deviceId}:`, error.response ? JSON.stringify(error.response.data, null, 2) : error.message);

        let errorMessage = `Gagal mengirim perubahan SSID untuk device ${deviceId}.`;
        let statusCode = 500;

        if (error.response) {
            // Error from the GenieACS API
            statusCode = error.response.status;
            if (error.response.data && typeof error.response.data === 'string' && error.response.data.toLowerCase().includes('404 not found')) {
                errorMessage = `Perangkat dengan ID ${deviceId} tidak ditemukan di server manajemen.`;
                statusCode = 404;
            } else if (error.response.data && error.response.data.fault) {
                 errorMessage = `Server manajemen perangkat melaporkan kesalahan: ${error.response.data.fault.faultString || 'Error tidak diketahui'}`;
            } else if (error.response.data) {
                errorMessage = `Server manajemen perangkat merespons dengan error: ${JSON.stringify(error.response.data)}`;
            } else {
                errorMessage = `Server manajemen perangkat merespons dengan error ${statusCode}.`;
            }
        } else if (error.request) {
            // The request was made but no response was received
            errorMessage = "Tidak ada respons dari server manajemen perangkat. Periksa konektivitas dan status server.";
        } else {
            // Something happened in setting up the request that triggered an Error
            errorMessage = error.message;
        }

        return res.status(statusCode).json({ status: statusCode, message: errorMessage });
    }
});

// Removed duplicate /api/me endpoint - already defined in routes/stats.js

router.post('/api/action', async (req, res) => {
    const { action, username, newProfile } = req.body;
    // The 'update-pppoe-profile' action has been removed as it is obsolete.
    // The profile is now managed by the subscription package.
    res.status(400).json({ message: "Invalid or obsolete action specified." });
});

router.post('/api/broadcast', ensureAuthenticatedStaff, async (req, res) => {
    if (!global.raf) {
        return res.status(500).json({
            status: 500,
            message: "The server is not connected to WhatsApp."
        });
    }
    try {
        const text = req.body.text;
        let targetUsers = [];

        if (req.body?.all === "on") {
            targetUsers = global.users;
        } else {
            const userIds = req.body.users || [];
            targetUsers = userIds.map(id => global.users.find(u => u.id == id)).filter(Boolean); // .filter(Boolean) removes any undefined users
        }

        if (targetUsers.length === 0) {
            return res.status(400).json({ status: 400, message: "No valid users selected for broadcast." });
        }

        // Call the broadcast function but don't wait for it to finish
        broadcast(text, targetUsers);

        res.status(202).json({ status: 202, message: `Broadcast has been initiated for ${targetUsers.length} user(s).` });
    } catch (e) {
        console.error("[BROADCAST_ERROR]", e);
        res.status(500).json({ status: 500, message: "Internal server error during broadcast." });
    }
});

router.delete('/api/:category/:id', async (req, res) => {
    const { category, id } = req.params;
    switch(category) {
        case 'users': {
            const userIndexToDelete = global.users.findIndex(user => String(user.id) === String(id));
            if (userIndexToDelete === -1) {
                return res.status(404).json({ status: 404, message: 'Pengguna tidak ditemukan' });
            }

            const userToDelete = global.users[userIndexToDelete];
            const connectedOdpId = userToDelete.connected_odp_id;
            
            // Log activity before deletion
            try {
                await logActivity({
                    userId: req.user.id,
                    username: req.user.username,
                    role: req.user.role,
                    actionType: 'DELETE',
                    resourceType: 'user',
                    resourceId: id.toString(),
                    resourceName: userToDelete.name,
                    description: `Deleted user ${userToDelete.name}`,
                    oldValue: {
                        name: userToDelete.name,
                        phone_number: userToDelete.phone_number,
                        subscription: userToDelete.subscription,
                        paid: userToDelete.paid,
                        pppoe_username: userToDelete.pppoe_username
                    },
                    newValue: null,
                    ipAddress: req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'],
                    userAgent: req.headers['user-agent']
                });
            } catch (logErr) {
                console.error('[ACTIVITY_LOG_ERROR] Failed to log user delete:', logErr);
            }

            global.db.run('DELETE FROM users WHERE id = ?', [id], function(err) {
                if (err) {
                    console.error("[DB_DELETE_USER_ERROR]", err.message);
                    return res.status(500).json({ status: 500, message: "Gagal menghapus pengguna dari database." });
                }

                global.users.splice(userIndexToDelete, 1);

                if (connectedOdpId) {
                    // Decrement ODP ports_used
                    updateOdpPortUsage(connectedOdpId, false, global.networkAssets);

                    // Find the ODP to get its parent ODC
                    const odp = global.networkAssets.find(asset => asset.id === connectedOdpId && asset.type === 'ODP');
                    if (odp && odp.parent_odc_id) {
                        // Decrement parent ODC ports_used
                        updateOdcPortUsage(odp.parent_odc_id, global.networkAssets);
                    }
                    saveNetworkAssets(global.networkAssets);
                }
                return res.json({ status: 200, message: 'Pengguna berhasil dihapus' });
            });
            return;
        }
        case 'accounts': {
            const initialLength = global.accounts.length;
            global.accounts = global.accounts.filter(a => String(a.id) !== String(id));
            if (global.accounts.length === initialLength) {
                return res.status(404).json({ message: "Account not found." });
            }
            saveAccounts();
            return res.json({ message: 'Successfully deleted'});
        }
        case 'payment':
            // Assuming delPayment handles non-existent IDs gracefully.
            // If not, it should be wrapped in a similar existence check.
            delPayment(id);
            return res.json({ message: 'Successfully deleted'});
        case 'packages': {
            const initialLength = global.packages.length;
            global.packages = global.packages.filter(p => String(p.id) !== String(id));
            if (global.packages.length === initialLength) {
                return res.status(404).json({ message: "Package not found." });
            }
            savePackage();
            return res.json({ message: 'Successfully deleted'});
        }
        case 'statik': {
            const initialLength = global.statik.length;
            global.statik = global.statik.filter(v => String(v.prof) !== String(id));
            if (global.statik.length === initialLength) {
                return res.status(404).json({ message: "Statik not found." });
            }
            saveStatik();
            return res.json({ message: 'Successfully deleted'});
        }
        case 'voucher': {
            const initialLength = global.voucher.length;
            global.voucher = global.voucher.filter(v => String(v.prof) !== String(id));
            if (global.voucher.length === initialLength) {
                return res.status(404).json({ message: "Voucher not found." });
            }
            saveVoucher();
            return res.json({ message: 'Successfully deleted'});
        }
        case 'atm': {
            const initialLength = global.atm.length;
            global.atm = global.atm.filter(v => String(v.id) !== String(id));
            if (global.atm.length === initialLength) {
                return res.status(404).json({ message: "ATM not found." });
            }
            saveAtm();
            return res.json({ message: 'Successfully deleted'});
        }
        case 'payment-method': {
            const initialLength = global.paymentMethod.length;
            global.paymentMethod = global.paymentMethod.filter(v => String(v.id) !== String(id));
            if (global.paymentMethod.length === initialLength) {
                return res.status(404).json({ message: "Payment method not found." });
            }
            savePaymentMethod();
            return res.json({ message: 'Successfully deleted'});
        }
        case 'mikrotik-devices': {
            try {
                let devices = readMikrotikDevices();
                const initialLength = devices.length;
                devices = devices.filter(d => d.id !== id);
                if (devices.length < initialLength) {
                    writeMikrotikDevices(devices);
                    return res.json({ message: 'Device deleted successfully' });
                } else {
                    return res.status(404).json({ message: 'Device not found' });
                }
            } catch (error) {
                return res.status(500).json({ message: "Failed to delete device." });
            }
        }
        default:
            return res.status(400).json({ message: 'Invalid category for deletion.' });
    }
});

router.get('/api/map/network-assets', ensureAuthenticatedStaff, (req, res) => {
    try {
        const assets = global.networkAssets;
        // The loadNetworkAssets function already handles empty/corrupt files by returning []
        res.status(200).json({
            status: 200,
            message: "Network assets loaded successfully.",
            data: assets
        });
    } catch (error) {
        console.error("[API_NETWORK_ASSETS_ERROR]", error);
        res.status(500).json({
            status: 500,
            message: `Failed to load network assets: ${error.message}`
        });
    }
});

// POST /api/map/route - Get route coordinates yang mengikuti jalan
router.post('/api/map/route', ensureAuthenticatedStaff, rateLimit('map-route', 30, 60000), async (req, res) => {
    try {
        const { startLat, startLng, endLat, endLng, profile } = req.body;
        
        // Validasi required fields
        if (startLat === undefined || startLng === undefined || endLat === undefined || endLng === undefined) {
            return res.status(400).json({
                status: 400,
                message: 'Koordinat awal dan akhir harus diisi (startLat, startLng, endLat, endLng)'
            });
        }
        
        // Validasi tipe data
        const parsedStartLat = parseFloat(startLat);
        const parsedStartLng = parseFloat(startLng);
        const parsedEndLat = parseFloat(endLat);
        const parsedEndLng = parseFloat(endLng);
        
        if (isNaN(parsedStartLat) || isNaN(parsedStartLng) || isNaN(parsedEndLat) || isNaN(parsedEndLng)) {
            return res.status(400).json({
                status: 400,
                message: 'Koordinat harus berupa angka yang valid'
            });
        }
        
        // Validasi range koordinat (valid lat: -90 to 90, valid lng: -180 to 180)
        if (parsedStartLat < -90 || parsedStartLat > 90 || parsedStartLng < -180 || parsedStartLng > 180 ||
            parsedEndLat < -90 || parsedEndLat > 90 || parsedEndLng < -180 || parsedEndLng > 180) {
            return res.status(400).json({
                status: 400,
                message: 'Koordinat di luar range yang valid (lat: -90 to 90, lng: -180 to 180)'
            });
        }
        
        // Validasi profile (optional, default dari config atau 'driving-car')
        const routingProfile = profile || (global.config?.openRouteService?.defaultProfile) || 'driving-car';
        
        // Validasi profile yang diizinkan
        const allowedProfiles = ['driving-car', 'driving-hgv', 'foot-walking', 'foot-hiking', 'cycling-regular', 'cycling-road', 'cycling-mountain', 'cycling-electric'];
        if (!allowedProfiles.includes(routingProfile)) {
            return res.status(400).json({
                status: 400,
                message: `Profile routing tidak valid. Profile yang diizinkan: ${allowedProfiles.join(', ')}`
            });
        }
        
        // Import routing service
        const routingService = require('../lib/routing-service');
        
        // Get route coordinates
        const coordinates = await routingService.getRoute(
            parsedStartLat,
            parsedStartLng,
            parsedEndLat,
            parsedEndLng,
            routingProfile
        );
        
        // Validasi hasil
        if (!Array.isArray(coordinates) || coordinates.length < 2) {
            return res.status(500).json({
                status: 500,
                message: 'Gagal mendapatkan route. Format koordinat tidak valid.'
            });
        }
        
        // Response success
        res.status(200).json({
            status: 200,
            message: 'Route berhasil didapatkan',
            data: {
                coordinates: coordinates,
                profile: routingProfile,
                pointCount: coordinates.length,
                enabled: routingService.isEnabled()
            }
        });
        
    } catch (error) {
        console.error('[API_MAP_ROUTE_ERROR]', error);
        res.status(500).json({
            status: 500,
            message: error.message || 'Gagal mendapatkan route'
        });
    }
});

router.post('/api/map/network-assets', ensureAuthenticatedStaff, async (req, res) => {
    if (!req.user || !['admin', 'owner', 'superadmin'].includes(req.user.role)) {
        return res.status(403).json({ message: "Akses ditolak." });
    }
    const { type, name, address, capacity_ports, latitude, longitude, notes, parent_odc_id } = req.body;

    if (!type || !name || !latitude || !longitude) {
        return res.status(400).json({ message: "Tipe, Nama, Latitude, dan Longitude wajib diisi." });
    }

    try {
        const { updateNetworkAssetsWithLock } = require('../lib/database');
        
        // Use file locking to prevent race conditions
        const result = await updateNetworkAssetsWithLock(async (assets) => {
            const newAssetId = generateAssetId(type, parent_odc_id, assets, name);
            const newAsset = {
                id: newAssetId,
                type,
                name,
                address: address || '',
                capacity_ports: parseInt(capacity_ports) || 0,
                latitude: parseFloat(latitude),
                longitude: parseFloat(longitude),
                notes: notes || '',
                parent_odc_id: parent_odc_id || null,
                ports_used: 0, // New assets start with 0 ports used
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            // --- VALIDATION AND UPDATE FOR ODC CAPACITY ON ODP CREATION ---
            if (newAsset.type === 'ODP' && newAsset.parent_odc_id) {
                const parentOdc = assets.find(asset => String(asset.id) === String(newAsset.parent_odc_id) && asset.type === 'ODC');
                if (parentOdc) {
                    const currentUsage = parseInt(parentOdc.ports_used) || 0;
                    const capacity = parseInt(parentOdc.capacity_ports) || 0;
                    
                    // Validate capacity before allowing ODP creation
                    if (capacity > 0 && currentUsage >= capacity) {
                        throw new Error(`ODC ${parentOdc.name} sudah penuh (${currentUsage}/${capacity}). Tidak dapat menambahkan ODP baru.`);
                    }
                    
                    // Update ports_used if validation passes
                    parentOdc.ports_used = currentUsage + 1;
                    console.log(`[ODC_CAPACITY_UPDATE] ODC ${parentOdc.id} ports_used incremented to ${parentOdc.ports_used} due to new ODP ${newAsset.id}.`);
                } else {
                    throw new Error(`Parent ODC dengan ID ${newAsset.parent_odc_id} tidak ditemukan.`);
                }
            }
            // --- END VALIDATION AND UPDATE ---

            assets.push(newAsset);
            return newAsset;
        });
        
        res.status(201).json({ status: 201, message: "Aset jaringan berhasil ditambahkan.", data: result });
    } catch (error) {
        console.error("[API_NETWORK_ASSETS_POST_ERROR]", error);
        res.status(500).json({ status: 500, message: `Gagal menambahkan aset jaringan: ${error.message}` });
    }
});

router.put('/api/map/network-assets/:id', ensureAuthenticatedStaff, (req, res) => {
    if (!req.user || !['admin', 'owner', 'superadmin'].includes(req.user.role)) {
        return res.status(403).json({ message: "Akses ditolak." });
    }
    const { id } = req.params;
    const { type, name, address, capacity_ports, latitude, longitude, notes, parent_odc_id } = req.body;

    if (!type || !name || !latitude || !longitude) {
        return res.status(400).json({ message: "Tipe, Nama, Latitude, dan Longitude wajib diisi." });
    }

    try {
        let existingAssets = global.networkAssets;
        const assetIndex = existingAssets.findIndex(asset => String(asset.id) === String(id));

        if (assetIndex === -1) {
            return res.status(404).json({ status: 404, message: "Aset jaringan tidak ditemukan." });
        }

        const oldAsset = { ...existingAssets[assetIndex] }; // Clone old asset for comparison
        const updatedAsset = {
            ...oldAsset, // Start with old asset data
            type,
            name,
            address: address || '',
            capacity_ports: parseInt(capacity_ports) || 0,
            latitude: parseFloat(latitude),
            longitude: parseFloat(longitude),
            notes: notes || '',
            parent_odc_id: parent_odc_id || null,
            updatedAt: new Date().toISOString()
        };

        // --- VALIDATION AND UPDATE FOR ODC CAPACITY ON ODP EDIT ---
        // Case 1: Asset was ODP, now it's not (e.g., changed to ODC, or parent_odc_id removed)
        if (oldAsset.type === 'ODP' && oldAsset.parent_odc_id && (updatedAsset.type !== 'ODP' || updatedAsset.parent_odc_id !== oldAsset.parent_odc_id)) {
            const oldParentOdc = existingAssets.find(asset => String(asset.id) === String(oldAsset.parent_odc_id) && asset.type === 'ODC');
            if (oldParentOdc) {
                oldParentOdc.ports_used = Math.max(0, (parseInt(oldParentOdc.ports_used) || 0) - 1);
                console.log(`[ODC_CAPACITY_UPDATE] Old ODC ${oldParentOdc.id} ports_used decremented to ${oldParentOdc.ports_used} due to ODP ${id} change.`);
            } else {
                console.warn(`[ODC_CAPACITY_WARN] Old parent ODC ${oldAsset.parent_odc_id} not found for ODP ${id} during decrement.`);
            }
        }

        // Case 2: Asset is now ODP and has a parent_odc_id (new ODP, or parent_odc_id changed)
        if (updatedAsset.type === 'ODP' && updatedAsset.parent_odc_id && (oldAsset.type !== 'ODP' || updatedAsset.parent_odc_id !== oldAsset.parent_odc_id)) {
            const newParentOdc = existingAssets.find(asset => String(asset.id) === String(updatedAsset.parent_odc_id) && asset.type === 'ODC');
            if (newParentOdc) {
                const currentUsage = parseInt(newParentOdc.ports_used) || 0;
                const capacity = parseInt(newParentOdc.capacity_ports) || 0;
                
                // Validate capacity before allowing ODP assignment
                if (capacity > 0 && currentUsage >= capacity) {
                    // Revert the old parent ODC decrement if we can't proceed
                    if (oldAsset.type === 'ODP' && oldAsset.parent_odc_id && oldAsset.parent_odc_id !== updatedAsset.parent_odc_id) {
                        const oldParentOdc = existingAssets.find(asset => String(asset.id) === String(oldAsset.parent_odc_id) && asset.type === 'ODC');
                        if (oldParentOdc) {
                            oldParentOdc.ports_used = (parseInt(oldParentOdc.ports_used) || 0) + 1;
                        }
                    }
                    return res.status(400).json({
                        status: 400,
                        message: `ODC ${newParentOdc.name} sudah penuh (${currentUsage}/${capacity}). Tidak dapat memindahkan ODP ke ODC ini.`
                    });
                }
                
                newParentOdc.ports_used = currentUsage + 1;
                console.log(`[ODC_CAPACITY_UPDATE] New ODC ${newParentOdc.id} ports_used incremented to ${newParentOdc.ports_used} due to ODP ${id} change.`);
            } else {
                // Revert the old parent ODC decrement if new parent not found
                if (oldAsset.type === 'ODP' && oldAsset.parent_odc_id) {
                    const oldParentOdc = existingAssets.find(asset => String(asset.id) === String(oldAsset.parent_odc_id) && asset.type === 'ODC');
                    if (oldParentOdc) {
                        oldParentOdc.ports_used = (parseInt(oldParentOdc.ports_used) || 0) + 1;
                    }
                }
                return res.status(400).json({
                    status: 400,
                    message: `Parent ODC dengan ID ${updatedAsset.parent_odc_id} tidak ditemukan.`
                });
            }
        }
        // --- END VALIDATION AND UPDATE ---

        existingAssets[assetIndex] = updatedAsset; // Update the asset in the array
        saveNetworkAssets(existingAssets);
        res.status(200).json({ status: 200, message: "Aset jaringan berhasil diperbarui.", data: updatedAsset });
    } catch (error) {
        console.error("[API_NETWORK_ASSETS_PUT_ERROR]", error);
        res.status(500).json({ status: 500, message: `Gagal memperbarui aset jaringan: ${error.message}` });
    }
});

router.delete('/api/map/network-assets/:id', ensureAuthenticatedStaff, async (req, res) => {
    if (!req.user || !['admin', 'owner', 'superadmin'].includes(req.user.role)) {
        return res.status(403).json({ message: "Akses ditolak." });
    }
    const { id } = req.params;

    try {
        const { updateNetworkAssetsWithLock } = require('../lib/database');
        
        const result = await updateNetworkAssetsWithLock(async (assets) => {
            const assetToDeleteIndex = assets.findIndex(asset => String(asset.id) === String(id));

            if (assetToDeleteIndex === -1) {
                throw new Error("Aset jaringan tidak ditemukan.");
            }

            const assetToDelete = assets[assetToDeleteIndex];

            // Check if this is an ODC with child ODPs
            if (assetToDelete.type === 'ODC') {
                const childOdps = assets.filter(asset => 
                    asset.type === 'ODP' && String(asset.parent_odc_id) === String(id)
                );
                
                if (childOdps.length > 0) {
                    // Option 1: Prevent deletion if ODC has child ODPs
                    throw new Error(`ODC ${assetToDelete.name} tidak dapat dihapus karena memiliki ${childOdps.length} ODP yang terhubung. Hapus atau pindahkan ODP terlebih dahulu.`);
                    
                    // Option 2 (Alternative): Clear parent_odc_id from child ODPs
                    // childOdps.forEach(odp => {
                    //     odp.parent_odc_id = null;
                    //     console.log(`[ODC_DELETE] ODP ${odp.id} orphaned due to ODC ${id} deletion.`);
                    // });
                }
            }

            // Handle ODP deletion - update parent ODC ports_used
            if (assetToDelete.type === 'ODP' && assetToDelete.parent_odc_id) {
                const parentOdc = assets.find(asset => String(asset.id) === String(assetToDelete.parent_odc_id) && asset.type === 'ODC');
                if (parentOdc) {
                    parentOdc.ports_used = Math.max(0, (parseInt(parentOdc.ports_used) || 0) - 1);
                    console.log(`[ODC_CAPACITY_UPDATE] ODC ${parentOdc.id} ports_used decremented to ${parentOdc.ports_used} due to ODP ${id} deletion.`);
                }
            }

            // Remove the asset
            assets.splice(assetToDeleteIndex, 1);
            return { deletedAsset: assetToDelete };
        });
        
        res.status(200).json({ status: 200, message: "Aset jaringan berhasil dihapus." });
    } catch (error) {
        console.error("[API_NETWORK_ASSETS_DELETE_ERROR]", error);
        res.status(500).json({ status: 500, message: `Gagal menghapus aset jaringan: ${error.message}` });
    }
});

router.get('/api/mikrotik/ppp-active-users', ensureAuthenticatedStaff, async (req, res) => {
    // Return immediately with empty data, then fetch in background
    const phpScriptPath = path.join(__dirname, '..', 'views', 'get_ppp_active_optimized.php');
    
    exec(`php "${phpScriptPath}"`, { timeout: 5000 }, (error, stdout, stderr) => {
        if (error) {
            console.error(`[API_PPP_ACTIVE_ERROR] Error executing PHP script: ${error.message}`);
            return res.status(200).json({ 
                status: 200, 
                message: "Data PPP tidak tersedia saat ini.", 
                data: [],
                error: true
            });
        }
        
        try {
            const response = JSON.parse(stdout);
            if (response.error) {
                return res.status(200).json({ 
                    status: 200, 
                    message: response.message || "Data PPP tidak tersedia.", 
                    data: [],
                    error: true
                });
            }
            
            res.status(200).json({ 
                status: 200, 
                message: "Data PPP aktif berhasil diambil.",
                data: response.data || [],
                error: false
            });
        } catch (parseError) {
            // Try to find JSON in output
            const jsonStartIndex = stdout.indexOf('[');
            if (jsonStartIndex !== -1) {
                try {
                    const jsonString = stdout.substring(jsonStartIndex);
                    const pppActive = JSON.parse(jsonString);
                    return res.status(200).json({ 
                        status: 200, 
                        message: "Data PPP aktif berhasil diambil.",
                        data: pppActive,
                        error: false
                    });
                } catch (jsonError) {
                    console.error(`[API_PPP_ACTIVE_ERROR] Failed to parse JSON: ${jsonError.message}`);
                }
            }
            
            res.status(200).json({ 
                status: 200, 
                message: "Format data PPP tidak valid.", 
                data: [],
                error: true
            });
        }
    });
});

// GET /api/mikrotik/ppp-profiles - Get all PPP profiles from MikroTik
router.get('/api/mikrotik/ppp-profiles', ensureAuthenticatedStaff, async (req, res) => {
    try {
        const { getPPPProfiles } = require('../lib/mikrotik');
        const result = await getPPPProfiles();
        
        // Parse result - getPPPProfiles returns newline-separated profile names from PHP
        let profiles = [];
        
        if (typeof result === 'string') {
            // Split by newline and filter empty lines
            const lines = result.split('\n').map(line => line.trim()).filter(line => line && line !== 'No PPPoE profiles found.');
            profiles = lines.map(name => ({ name }));
        } else if (Array.isArray(result)) {
            profiles = result;
        }
        
        res.status(200).json({
            status: 200,
            message: "Profil PPP berhasil diambil",
            data: profiles
        });
    } catch (error) {
        console.error('[API_PPP_PROFILES_ERROR]', error);
        res.status(500).json({
            status: 500,
            message: "Gagal mengambil profil PPP dari MikroTik",
            error: error.message
        });
    }
});

// WiFi Change Logs API endpoints
router.get('/api/wifi-logs', ensureAuthenticatedStaff, async (req, res) => {
    try {
        const filters = {
            userId: req.query.userId,
            deviceId: req.query.deviceId,
            changeType: req.query.changeType,
            changedBy: req.query.changedBy,
            changeSource: req.query.changeSource,
            dateFrom: req.query.dateFrom,
            dateTo: req.query.dateTo,
            limit: parseInt(req.query.limit) || 50,
            offset: parseInt(req.query.offset) || 0
        };

        const result = await getWifiChangeLogs(filters);
        
        res.status(200).json({
            status: 200,
            message: "WiFi change logs retrieved successfully",
            data: result
        });
    } catch (error) {
        console.error('[API_WIFI_LOGS_ERROR] Error retrieving WiFi logs:', error);
        res.status(500).json({
            status: 500,
            message: "Gagal mengambil log perubahan WiFi",
            error: error.message
        });
    }
});

router.get('/api/wifi-logs/stats', ensureAuthenticatedStaff, async (req, res) => {
    try {
        const stats = await getWifiChangeStats();
        
        res.status(200).json({
            status: 200,
            message: "WiFi change statistics retrieved successfully",
            data: stats
        });
    } catch (error) {
        console.error('[API_WIFI_STATS_ERROR] Error retrieving WiFi stats:', error);
        res.status(500).json({
            status: 500,
            message: "Gagal mengambil statistik perubahan WiFi",
            error: error.message
        });
    }
});


router.post('/api/migrate-users', ensureAuthenticatedStaff, async (req, res) => {
    if (!req.user || !['admin', 'owner', 'superadmin'].includes(req.user.role)) {
        return res.status(403).json({ status: 403, message: "Akses ditolak." });
    }

    console.log('[MIGRATE_USERS] Starting migration process...');

    // Import migration helper functions
    const { 
        prepareUserData, 
        getFieldNames, 
        getPlaceholders, 
        getValuesArray,
        transformUsersFromDb
    } = require('../lib/migration-helper');

    try {
        // Setup multer for file upload
        const multer = require('multer');
        const upload = multer({
            dest: path.join(__dirname, '..', 'temp'),
            limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
            fileFilter: (req, file, cb) => {
                const ext = path.extname(file.originalname).toLowerCase();
                if (ext === '.json') {
                    cb(null, true);
                } else {
                    cb(new Error('Invalid file type. Only JSON files are allowed.'));
                }
            }
        }).single('usersFile');

        // Process file upload
        await new Promise((resolve, reject) => {
            upload(req, res, (err) => {
                if (err) {
                    console.error('[MIGRATE_USERS] Upload error:', err.message);
                    return reject(err);
                }
                resolve();
            });
        });

        // Check if file was uploaded
        if (!req.file) {
            console.error('[MIGRATE_USERS] No file uploaded.');
            return res.status(400).json({ status: 400, message: 'File users.json harus diupload.' });
        }

        // Read uploaded file
        const uploadedFilePath = req.file.path;
        let usersData;
        
        try {
            const fileContent = fs.readFileSync(uploadedFilePath, 'utf8');
            usersData = JSON.parse(fileContent);
        } catch (parseError) {
            // Clean up uploaded file
            fs.unlinkSync(uploadedFilePath);
            console.error('[MIGRATE_USERS] Error parsing JSON file:', parseError.message);
            return res.status(400).json({ 
                status: 400, 
                message: 'File JSON tidak valid atau rusak. Pastikan file adalah JSON yang valid.' 
            });
        }

        // Validate data format
        if (!Array.isArray(usersData)) {
            // Clean up uploaded file
            fs.unlinkSync(uploadedFilePath);
            console.error('[MIGRATE_USERS] Format users.json tidak valid.');
            return res.status(400).json({ status: 400, message: 'Format users.json tidak valid, harus berupa array.' });
        }
        
        console.log(`[MIGRATE_USERS] Found ${usersData.length} users in uploaded file: ${req.file.originalname}`);

        // Clean up uploaded file after reading
        try {
            fs.unlinkSync(uploadedFilePath);
            console.log('[MIGRATE_USERS] Temporary file cleaned up');
        } catch (cleanupError) {
            console.warn('[MIGRATE_USERS] Failed to cleanup temp file:', cleanupError.message);
        }

        // 2. Prepare for DB Insertion with Promise-based approach
        const db = global.db;
        
        // Wrap the entire migration in a promise for proper async handling
        const migrationPromise = new Promise(async (resolve, reject) => {
            try {
                // First, check existing users to avoid duplicates - CHECK ONLY BY ID (Requirement 8.1, 8.4, 8.5)
                // Allow multiple records with same phone_number (Requirement 8.2)
                const existingUsers = await new Promise((res, rej) => {
                    db.all("SELECT id FROM users", [], (err, rows) => {
                        if (err) {
                            console.error('[MIGRATE_USERS] Error checking existing users:', err.message);
                            return rej(new Error(`Gagal cek users existing: ${err.message}`));
                        }
                        res(rows || []);
                    });
                });

                // Only check by ID, NOT by phone_number (Requirement 8.4, 8.5)
                const existingIds = new Set(existingUsers.map(u => String(u.id)));

                // Filter out duplicates - only by ID
                const usersToInsert = [];
                const skippedUsers = [];
                
                for (const user of usersData) {
                    const idExists = existingIds.has(String(user.id));
                    
                    if (idExists) {
                        console.log(`[MIGRATE_USERS] Skipping duplicate ID: ${user.name} (ID: ${user.id})`);
                        skippedUsers.push({ id: user.id, name: user.name, reason: 'Duplicate ID' });
                    } else {
                        usersToInsert.push(user);
                    }
                }

                console.log(`[MIGRATE_USERS] Total users in file: ${usersData.length}`);
                console.log(`[MIGRATE_USERS] Duplicates found (by ID only): ${skippedUsers.length}`);
                console.log(`[MIGRATE_USERS] Users to insert: ${usersToInsert.length}`);

                if (usersToInsert.length === 0) {
                    return resolve({ 
                        insertCount: 0, 
                        errorCount: 0, 
                        errors: [], 
                        totalUsers: usersData.length, 
                        skipped: skippedUsers.length,
                        skippedDetails: skippedUsers
                    });
                }

                // Build INSERT statement with all 40+ fields from USER_SCHEMA
                const fieldNames = getFieldNames();
                const placeholders = getPlaceholders();
                
                const insertSQL = `INSERT OR IGNORE INTO users (${fieldNames.join(', ')}) VALUES (${placeholders})`;
                console.log(`[MIGRATE_USERS] INSERT statement prepared with ${fieldNames.length} fields`);

                let insertCount = 0;
                let errorCount = 0;
                const errors = [];

                // Start transaction
                await new Promise((res, rej) => {
                    db.run("BEGIN TRANSACTION", (err) => {
                        if (err) {
                            console.error('[MIGRATE_USERS] Error starting transaction:', err.message);
                            return rej(new Error(`Gagal memulai transaksi: ${err.message}`));
                        }
                        console.log('[MIGRATE_USERS] Transaction started');
                        res();
                    });
                });

                // Prepare statement
                const insertStmt = db.prepare(insertSQL);

                // Process each user with prepareUserData() (Requirement 5.1)
                // Wrap each record in try-catch to continue on failures (Requirement 7.5)
                for (const user of usersToInsert) {
                    try {
                        // Use prepareUserData() for field mapping, generation, and conversion
                        const preparedData = await prepareUserData(user);
                        const values = getValuesArray(preparedData);
                        
                        // Insert with error handling per record (Requirement 7.5)
                        await new Promise((res, rej) => {
                            insertStmt.run(values, function(err) {
                                if (err) {
                                    // Log error but continue processing (Requirement 7.5)
                                    errorCount++;
                                    const errorDetail = { 
                                        userId: user.id, 
                                        userName: user.name, 
                                        error: err.message 
                                    };
                                    errors.push(errorDetail);
                                    console.error(`[MIGRATE_USERS] Error inserting user ${user.id} (${user.name}):`, err.message);
                                    res(); // Continue, don't reject
                                } else {
                                    insertCount++;
                                    res();
                                }
                            });
                        });
                    } catch (prepareError) {
                        // Handle prepareUserData errors (Requirement 7.4, 7.5)
                        errorCount++;
                        const errorDetail = { 
                            userId: user.id, 
                            userName: user.name, 
                            error: `Prepare error: ${prepareError.message}` 
                        };
                        errors.push(errorDetail);
                        console.error(`[MIGRATE_USERS] Error preparing user ${user.id} (${user.name}):`, prepareError.message);
                        // Continue processing remaining records (Requirement 7.5)
                    }
                }

                // Finalize statement
                await new Promise((res, rej) => {
                    insertStmt.finalize((err) => {
                        if (err) {
                            console.error('[MIGRATE_USERS] Error finalizing statement:', err.message);
                            return rej(new Error(`Gagal finalize statement: ${err.message}`));
                        }
                        console.log(`[MIGRATE_USERS] Statement finalized. Insert count: ${insertCount}, Error count: ${errorCount}`);
                        res();
                    });
                });

                // Commit transaction
                await new Promise((res, rej) => {
                    db.run("COMMIT", (err) => {
                        if (err) {
                            console.error('[MIGRATE_USERS] Error committing transaction:', err.message);
                            // Attempt rollback
                            db.run("ROLLBACK", (rollbackErr) => {
                                if (rollbackErr) {
                                    console.error('[MIGRATE_USERS] Error rolling back:', rollbackErr.message);
                                }
                            });
                            return rej(new Error(`Gagal commit transaksi: ${err.message}`));
                        }
                        
                        console.log('[MIGRATE_USERS] Transaction committed successfully');
                        res();
                    });
                });
                
                // Report any errors that occurred during inserts (Requirement 7.4)
                if (errorCount > 0) {
                    console.warn(`[MIGRATE_USERS] Migration completed with ${errorCount} errors:`, errors);
                }

                // Migration result reporting (Requirement 7.1, 7.2, 7.3)
                console.log(`[MIGRATE_USERS] Migration summary: ${insertCount} inserted, ${skippedUsers.length} skipped (duplicates), ${errorCount} errors`);
                
                resolve({ 
                    insertCount,          // Requirement 7.2 - success count
                    errorCount,           // Requirement 7.3 - failed count
                    errors,               // Requirement 7.4 - detailed errors
                    totalUsers: usersData.length,  // Requirement 7.1 - total processed
                    skipped: skippedUsers.length,
                    skippedDetails: skippedUsers,
                    inserted: insertCount
                });
            } catch (error) {
                reject(error);
            }
        });

        // 7. Wait for migration to complete, then reload users
        migrationPromise.then((migrationResult) => {
            console.log(`[MIGRATE_USERS] Migration promise resolved. Inserted: ${migrationResult.insertCount}, Errors: ${migrationResult.errorCount}`);

            // 8. Reload users into memory - NOW SAFE because COMMIT is complete
            const reloadPromise = new Promise((resolve, reject) => {
                db.all('SELECT * FROM users', [], (err, rows) => {
                    if (err) {
                        console.error('[MIGRATE_USERS] Error reloading users from database:', err.message);
                        return reject(err);
                    }
                    
                    console.log(`[MIGRATE_USERS] Retrieved ${rows.length} rows from database`);
                    
                    // Transform the data to the format expected by the application
                    // Using transformUsersFromDb for consistent transformation (Requirement 5.4)
                    const { transformedUsers, errorCount: transformErrorCount } = transformUsersFromDb(rows);
                    
                    if (transformErrorCount > 0) {
                        console.warn(`[MIGRATE_USERS] ${transformErrorCount} users failed to transform`);
                    }
                    
                    global.users = transformedUsers;
                    
                    console.log(`[MIGRATE_USERS] Successfully reloaded and transformed ${global.users.length} users into memory`);
                    resolve(rows.length);
                });
            });

            reloadPromise.then((reloadedCount) => {
                // 9. Send success response with detailed information (Requirement 7.1, 7.2, 7.3, 7.4)
                const responseMessage = migrationResult.errorCount > 0
                    ? `Migrasi selesai dengan peringatan! ${migrationResult.insertCount} dari ${migrationResult.totalUsers} pengguna berhasil dimigrasikan. ${migrationResult.errorCount} pengguna gagal. ${migrationResult.skipped} duplikat dilewati.`
                    : `Migrasi berhasil! ${migrationResult.insertCount} pengguna telah dipindahkan ke database SQLite dan dimuat ke memori. ${migrationResult.skipped} duplikat dilewati.`;
                
                console.log(`[MIGRATE_USERS] ${responseMessage}`);
                
                res.status(200).json({
                    status: 200,
                    message: responseMessage,
                    details: {
                        total: migrationResult.totalUsers,      // Requirement 7.1
                        success: migrationResult.insertCount,   // Requirement 7.2
                        failed: migrationResult.errorCount,     // Requirement 7.3
                        skipped: migrationResult.skipped,       // Requirement 8.3
                        reloaded: reloadedCount,
                        errors: migrationResult.errors          // Requirement 7.4
                    }
                });
            }).catch((reloadError) => {
                console.error('[MIGRATE_USERS] Error reloading users:', reloadError);
                res.status(500).json({
                    status: 500,
                    message: 'Migrasi berhasil tapi gagal reload users. Silakan restart aplikasi.',
                    error: reloadError.message,
                    details: {
                        total: migrationResult.totalUsers,
                        success: migrationResult.insertCount,
                        failed: migrationResult.errorCount,
                        skipped: migrationResult.skipped
                    }
                });
            });
        }).catch((migrationError) => {
            console.error('[MIGRATE_USERS] Migration failed:', migrationError);
            res.status(500).json({
                status: 500,
                message: 'Gagal melakukan migrasi.',
                error: migrationError.message
            });
        });

    } catch (error) {
        console.error('[MIGRATE_USERS] Fatal error during migration:', error);
        res.status(500).json({ 
            status: 500, 
            message: `Terjadi kesalahan saat migrasi: ${error.message}`,
            error: error.message
        });
    }
});

// Note: POST /api/users/update endpoint has been moved to routes/api.js to avoid duplication

// Note: GET /api/users endpoint has been moved to routes/api.js to avoid duplication

// Note: POST /api/users endpoint has been moved to routes/api.js to avoid duplication

// Note: POST /api/users/:id endpoint has been moved to routes/api.js to avoid duplication

// Note: DELETE /api/users/:id endpoint has been moved to routes/api.js to avoid duplication

// POST /api/admin/delete-all-users - Delete all users (moved here to avoid routing conflicts)
router.post('/api/admin/delete-all-users', ensureAuthenticatedStaff, async (req, res) => {
    if (!req.user || !['admin', 'owner', 'superadmin'].includes(req.user.role)) {
        return res.status(403).json({ status: 403, message: "Akses ditolak." });
    }
    
    try {
        console.log('[/api/admin/delete-all-users] Route hit');
        
        // Get password from request
        const { password } = req.body;
        if (!password) {
            console.log('[/api/admin/delete-all-users] Password not provided.');
            return res.status(400).json({ 
                status: 400, 
                message: "Password is required." 
            });
        }
        
        // Import required functions
        const { comparePassword } = require('../lib/password');
        const { deleteActivePPPoEUser } = require('../lib/mikrotik');
        const { saveNetworkAssets } = require('../lib/database');
        
        // Find admin account - handle both string and number ID comparison
        console.log('[/api/admin/delete-all-users] Looking for account with ID:', req.user.id, 'Type:', typeof req.user.id);
        console.log('[/api/admin/delete-all-users] Available accounts:', global.accounts.map(acc => ({ id: acc.id, type: typeof acc.id, username: acc.username })));
        
        let account = global.accounts.find(acc => String(acc.id) === String(req.user.id));
        if (!account) {
            console.log('[/api/admin/delete-all-users] Admin account not found by ID, checking if req.user can be used directly');
            // Fallback: if account not found by ID, but req.user exists and is admin, use req.user directly
            if (req.user && req.user.username && req.user.password) {
                console.log('[/api/admin/delete-all-users] Using req.user directly as account');
                account = req.user; // Use req.user as the account
            } else {
                return res.status(401).json({ 
                    status: 401, 
                    message: "Akun admin tidak ditemukan. Silakan login ulang." 
                });
            }
        }
        
        // Verify password
        console.log('[/api/admin/delete-all-users] Comparing passwords for account:', account.username);
        const isValid = await comparePassword(password, account.password);
        console.log('[/api/admin/delete-all-users] Password validation result:', isValid);
        
        if (!isValid) {
            return res.status(401).json({ 
                status: 401, 
                message: "Password salah. Silakan coba lagi." 
            });
        }
        
        console.log('[/api/admin/delete-all-users] Password is valid. Deleting all users.');
        
        // Delete all PPPoE users
        for (const user of global.users) {
            if (user.pppoe_username) {
                try {
                    await deleteActivePPPoEUser(user.pppoe_username);
                } catch (err) {
                    console.error(`[DELETE_ALL] Failed to delete PPPoE user ${user.pppoe_username}:`, err);
                }
            }
        }
        
        // Delete all users from database
        const deletePromise = new Promise((resolve, reject) => {
            global.db.run('DELETE FROM users', function(err) {
                if (err) {
                    console.error('[/api/admin/delete-all-users] Error deleting users:', err.message);
                    return reject(err);
                }
                const deletedCount = this.changes;
                console.log(`[/api/admin/delete-all-users] Deleted ${deletedCount} users from database`);
                resolve(deletedCount);
            });
        });

        const deletedCount = await deletePromise;

        // Reset auto-increment sequence (IMPORTANT for clean start)
        const resetSequencePromise = new Promise((resolve, reject) => {
            global.db.run("DELETE FROM sqlite_sequence WHERE name='users'", [], (err) => {
                if (err) {
                    console.warn('[/api/admin/delete-all-users] Warning: Could not reset sequence:', err.message);
                    // Not critical, continue
                } else {
                    console.log('[/api/admin/delete-all-users] Reset auto-increment sequence (ID will start from 1)');
                }
                resolve();
            });
        });

        await resetSequencePromise;
        
        // CRITICAL: Run VACUUM to physically remove deleted data from file
        // Without VACUUM, deleted data still exists in file and can be seen in text editors
        console.log('[/api/admin/delete-all-users] Running VACUUM to physically remove deleted data from file...');
        const vacuumPromise = new Promise((resolve, reject) => {
            global.db.run('VACUUM', (err) => {
                if (err) {
                    console.error('[/api/admin/delete-all-users] Error running VACUUM:', err.message);
                    // Not critical, continue but warn user
                    console.warn('[/api/admin/delete-all-users] WARNING: VACUUM failed. Deleted data may still exist in file.');
                    resolve(); // Don't reject, continue with cleanup
                } else {
                    console.log('[/api/admin/delete-all-users] ✅ VACUUM completed successfully. Deleted data has been physically removed from file.');
                    resolve();
                }
            });
        });
        
        await vacuumPromise;
        
        // NOTE: login_logs and activity_logs are now in separate database (activity_logs.sqlite)
        // They should be cleaned separately if needed via the activity logger module
        
        // Clear memory
        global.users = [];
        console.log('[/api/admin/delete-all-users] Cleared global.users from memory');
        
        // Reset all ODP/ODC port usage
        global.networkAssets.forEach(asset => {
            if (asset.type === 'ODP' || asset.type === 'ODC') {
                asset.ports_used = 0;
                if (asset.ports) {
                    asset.ports.forEach(port => {
                        port.used = false;
                        port.userId = null;
                    });
                }
            }
        });
        saveNetworkAssets(global.networkAssets);
        console.log('[/api/admin/delete-all-users] Network assets ports reset.');
        
        // Verify deletion (count check)
        const verifyPromise = new Promise((resolve, reject) => {
            global.db.get("SELECT COUNT(*) as count FROM users", [], (err, row) => {
                if (err) {
                    return reject(err);
                }
                const remainingCount = row ? row.count : 0;
                resolve(remainingCount);
            });
        });

        const remainingCount = await verifyPromise;

        if (remainingCount > 0) {
            console.warn(`[/api/admin/delete-all-users] WARNING: ${remainingCount} users still remain in database!`);
            return res.json({
                status: 200,
                message: `Hapus users berhasil dengan peringatan. ${deletedCount} users dihapus, ${remainingCount} masih tersisa.`,
                details: {
                    deleted: deletedCount,
                    remaining: remainingCount
                }
            });
        }

        console.log('[/api/admin/delete-all-users] Complete cleanup successful!');
        
        // Get file size after VACUUM for verification
        const fs = require('fs');
        const path = require('path');
        const { getDatabasePath } = require('../lib/env-config');
        const dbPath = getDatabasePath('users.sqlite');
        let fileSizeAfter = 0;
        try {
            if (fs.existsSync(dbPath)) {
                fileSizeAfter = fs.statSync(dbPath).size;
            }
        } catch (err) {
            console.warn('[/api/admin/delete-all-users] Could not get file size:', err.message);
        }
        
        return res.json({
            status: 200,
            message: `Semua pengguna berhasil dihapus secara permanen! ${deletedCount} users dihapus. Database telah dibersihkan dan siap untuk production.`,
            details: {
                deleted: deletedCount,
                remaining: remainingCount,
                memoryCleared: true,
                sequenceReset: true,
                vacuumPerformed: true,
                logsCleaned: true,
                fileSizeAfter: fileSizeAfter,
                note: 'VACUUM telah dijalankan untuk menghapus data secara fisik dari file database. Admin logs (login_logs, activity_logs) berada di database terpisah (activity_logs.sqlite) dan tidak terpengaruh oleh operasi ini.',
                important: 'CATATAN: Database pelanggan (users.sqlite) terpisah dari database log (activity_logs.sqlite). Operasi ini hanya menghapus data pelanggan.'
            }
        });
        
    } catch (error) {
        console.error('[API_ADMIN_DELETE_ALL_ERROR]', error);
        return res.status(500).json({
            status: 500,
            message: 'Terjadi kesalahan saat menghapus semua user',
            error: error.message
        });
    }
});

// POST /api/admin/cleanup-orphaned-photos - Cleanup photos from deleted tickets
router.post('/api/admin/cleanup-orphaned-photos', ensureAuthenticatedStaff, async (req, res) => {
    if (!req.user || !['admin', 'owner', 'superadmin'].includes(req.user.role)) {
        return res.status(403).json({ status: 403, message: "Akses ditolak." });
    }
    
    try {
        // Get password from request
        const { password } = req.body;
        if (!password) {
            return res.status(400).json({ 
                status: 400, 
                message: "Password is required." 
            });
        }
        
        // Import required functions
        const { comparePassword } = require('../lib/password');
        const { getReportsUploadsPath, getProjectRoot } = require('../lib/path-helper');
        
        // Find admin account
        let account = global.accounts.find(acc => String(acc.id) === String(req.user.id));
        if (!account) {
            if (req.user && req.user.username && req.user.password) {
                account = req.user;
            } else {
                return res.status(401).json({ 
                    status: 401, 
                    message: "Akun admin tidak ditemukan. Silakan login ulang." 
                });
            }
        }
        
        // Verify password
        const isValid = await comparePassword(password, account.password);
        if (!isValid) {
            return res.status(401).json({ 
                status: 401, 
                message: "Password salah. Silakan coba lagi." 
            });
        }
        
        // Get all ticket IDs from reports.json
        const validTicketIds = new Set();
        if (global.reports && Array.isArray(global.reports)) {
            global.reports.forEach(ticket => {
                if (ticket.ticketId) {
                    validTicketIds.add(ticket.ticketId);
                }
            });
        }
        
        const projectRoot = getProjectRoot(__dirname);
        const deletedFiles = [];
        const errors = [];
        
        // 1. Cleanup customer photos: uploads/reports/YEAR/MONTH/TICKET_ID/
        const reportsDir = path.join(projectRoot, 'uploads', 'reports');
        if (fs.existsSync(reportsDir)) {
            const years = fs.readdirSync(reportsDir, { withFileTypes: true })
                .filter(dirent => dirent.isDirectory())
                .map(dirent => dirent.name);
            
            for (const year of years) {
                const yearDir = path.join(reportsDir, year);
                const months = fs.readdirSync(yearDir, { withFileTypes: true })
                    .filter(dirent => dirent.isDirectory())
                    .map(dirent => dirent.name);
                
                for (const month of months) {
                    const monthDir = path.join(yearDir, month);
                    const ticketDirs = fs.readdirSync(monthDir, { withFileTypes: true })
                        .filter(dirent => dirent.isDirectory())
                        .map(dirent => dirent.name);
                    
                    for (const ticketId of ticketDirs) {
                        if (!validTicketIds.has(ticketId)) {
                            // Ticket tidak ada di reports.json, hapus folder dan isinya
                            const ticketDir = path.join(monthDir, ticketId);
                            try {
                                // Delete all files in ticket directory
                                const files = fs.readdirSync(ticketDir);
                                for (const file of files) {
                                    const filePath = path.join(ticketDir, file);
                                    if (fs.statSync(filePath).isFile()) {
                                        fs.unlinkSync(filePath);
                                        deletedFiles.push(filePath);
                                    }
                                }
                                // Delete empty directory
                                fs.rmdirSync(ticketDir);
                            } catch (err) {
                                errors.push(`Error deleting ${ticketDir}: ${err.message}`);
                            }
                        }
                    }
                }
            }
        }
        
        // 2. Cleanup teknisi photos (WhatsApp): uploads/teknisi/YEAR/MONTH/TICKET_ID/ (NEW STRUCTURE)
        const teknisiDir = path.join(projectRoot, 'uploads', 'teknisi');
        if (fs.existsSync(teknisiDir)) {
            // Scan structured folders: YEAR/MONTH/TICKET_ID/
            const years = fs.readdirSync(teknisiDir, { withFileTypes: true })
                .filter(dirent => dirent.isDirectory())
                .map(dirent => dirent.name);
            
            for (const year of years) {
                const yearDir = path.join(teknisiDir, year);
                const months = fs.readdirSync(yearDir, { withFileTypes: true })
                    .filter(dirent => dirent.isDirectory())
                    .map(dirent => dirent.name);
                
                for (const month of months) {
                    const monthDir = path.join(yearDir, month);
                    const ticketDirs = fs.readdirSync(monthDir, { withFileTypes: true })
                        .filter(dirent => dirent.isDirectory())
                        .map(dirent => dirent.name);
                    
                    for (const ticketId of ticketDirs) {
                        if (!validTicketIds.has(ticketId)) {
                            // Ticket tidak ada, hapus folder dan isinya
                            const ticketDir = path.join(monthDir, ticketId);
                            try {
                                const files = fs.readdirSync(ticketDir);
                                for (const file of files) {
                                    const filePath = path.join(ticketDir, file);
                                    if (fs.statSync(filePath).isFile()) {
                                        fs.unlinkSync(filePath);
                                        deletedFiles.push(filePath);
                                    }
                                }
                                fs.rmdirSync(ticketDir);
                            } catch (err) {
                                errors.push(`Error deleting ${ticketDir}: ${err.message}`);
                            }
                        }
                    }
                }
            }
            
            // BACKWARD COMPATIBILITY: Also check old flat structure (files directly in teknisi/)
            const files = fs.readdirSync(teknisiDir, { withFileTypes: true })
                .filter(dirent => dirent.isFile())
                .map(dirent => dirent.name);
            
            for (const file of files) {
                const filePath = path.join(teknisiDir, file);
                // Try to extract ticketId from filename (old format: teknisi_TIMESTAMP.jpg or TICKET_ID-TIMESTAMP-RANDOM.ext)
                let ticketId = null;
                const match = file.match(/^([A-Z0-9]+)-/);
                if (match) {
                    ticketId = match[1];
                }
                
                if (!ticketId || !validTicketIds.has(ticketId)) {
                    try {
                        fs.unlinkSync(filePath);
                        deletedFiles.push(filePath);
                    } catch (err) {
                        errors.push(`Error deleting ${filePath}: ${err.message}`);
                    }
                }
            }
        }
        
        // 3. Cleanup teknisi photos (Web): uploads/tickets/YEAR/MONTH/TICKET_ID/ (NEW STRUCTURE)
        const ticketsDir = path.join(projectRoot, 'uploads', 'tickets');
        if (fs.existsSync(ticketsDir)) {
            // Scan structured folders: YEAR/MONTH/TICKET_ID/
            const years = fs.readdirSync(ticketsDir, { withFileTypes: true })
                .filter(dirent => dirent.isDirectory())
                .map(dirent => dirent.name);
            
            for (const year of years) {
                const yearDir = path.join(ticketsDir, year);
                const months = fs.readdirSync(yearDir, { withFileTypes: true })
                    .filter(dirent => dirent.isDirectory())
                    .map(dirent => dirent.name);
                
                for (const month of months) {
                    const monthDir = path.join(yearDir, month);
                    const ticketDirs = fs.readdirSync(monthDir, { withFileTypes: true })
                        .filter(dirent => dirent.isDirectory())
                        .map(dirent => dirent.name);
                    
                    for (const ticketId of ticketDirs) {
                        if (!validTicketIds.has(ticketId)) {
                            // Ticket tidak ada, hapus folder dan isinya
                            const ticketDir = path.join(monthDir, ticketId);
                            try {
                                const files = fs.readdirSync(ticketDir);
                                for (const file of files) {
                                    const filePath = path.join(ticketDir, file);
                                    if (fs.statSync(filePath).isFile()) {
                                        fs.unlinkSync(filePath);
                                        deletedFiles.push(filePath);
                                    }
                                }
                                fs.rmdirSync(ticketDir);
                            } catch (err) {
                                errors.push(`Error deleting ${ticketDir}: ${err.message}`);
                            }
                        }
                    }
                }
            }
            
            // BACKWARD COMPATIBILITY: Also check old flat structure (files directly in tickets/)
            const files = fs.readdirSync(ticketsDir, { withFileTypes: true })
                .filter(dirent => dirent.isFile())
                .map(dirent => dirent.name);
            
            for (const file of files) {
                const filePath = path.join(ticketsDir, file);
                // Try to extract ticketId from filename (old format: TICKET_ID-TIMESTAMP-RANDOM.ext)
                let ticketId = null;
                const match = file.match(/^([A-Z0-9]+)-/);
                if (match) {
                    ticketId = match[1];
                }
                
                if (!ticketId || !validTicketIds.has(ticketId)) {
                    try {
                        fs.unlinkSync(filePath);
                        deletedFiles.push(filePath);
                    } catch (err) {
                        errors.push(`Error deleting ${filePath}: ${err.message}`);
                    }
                }
            }
        }
        
        return res.json({
            status: 200,
            message: `Berhasil menghapus ${deletedFiles.length} foto yang tidak terpakai.`,
            deletedCount: deletedFiles.length,
            errors: errors.length > 0 ? errors : undefined
        });
        
    } catch (error) {
        console.error('[API_ADMIN_CLEANUP_PHOTOS_ERROR]', error);
        return res.status(500).json({
            status: 500,
            message: 'Terjadi kesalahan saat membersihkan foto',
            error: error.message
        });
    }
});


// --- Mikrotik Devices CRUD ---

const MIKROTIK_DEVICES_PATH = path.join(__dirname, '..', 'database', 'mikrotik_devices.json');
const ENV_PATH = path.join(__dirname, '..', '.env');

function readMikrotikDevices() {
    try {
        if (!fs.existsSync(MIKROTIK_DEVICES_PATH)) {
            return [];
        }
        const data = fs.readFileSync(MIKROTIK_DEVICES_PATH, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error("Error reading Mikrotik devices file:", error);
        return [];
    }
}

function writeMikrotikDevices(data) {
    try {
        fs.writeFileSync(MIKROTIK_DEVICES_PATH, JSON.stringify(data, null, 2), 'utf8');
    } catch (error) {
        console.error("Error writing Mikrotik devices file:", error);
    }
}

function updateEnvFile(key, value) {
    console.log(`[ENV_UPDATE_DEBUG] Attempting to update .env file. Key: ${key}, Value: ${value}`);
    try {
        let envContent = fs.readFileSync(ENV_PATH, 'utf8');
        console.log(`[ENV_UPDATE_DEBUG] Successfully read .env file content.`);
        const keyRegex = new RegExp(`^${key}=.*$`, 'm');
        
        if (keyRegex.test(envContent)) {
            console.log(`[ENV_UPDATE_DEBUG] Key '${key}' found. Replacing existing value.`);
            envContent = envContent.replace(keyRegex, `${key}=${value}`);
        } else {
            console.log(`[ENV_UPDATE_DEBUG] Key '${key}' not found. Appending new key-value pair.`);
            // Ensure there's a newline before appending if the file is not empty
            if (envContent.length > 0 && !envContent.endsWith('\n')) {
                envContent += '\n';
            }
            envContent += `${key}=${value}`;
        }
        
        try {
            fs.writeFileSync(ENV_PATH, envContent, 'utf8');
            console.log(`[ENV_UPDATE_SUCCESS] Successfully wrote updated content to .env file for key '${key}'.`);
        } catch (writeError) {
            console.error(`[ENV_UPDATE_FATAL] FAILED to write to .env file. Error:`, writeError);
            throw new Error(`Failed to write to .env file: ${writeError.message}`);
        }

    } catch (error) {
        // Catch errors from both reading the file and the final throw
        console.error(`[ENV_UPDATE_ERROR] An error occurred in updateEnvFile for key '${key}':`, error);
        // Re-throw to ensure the calling function knows about the failure.
        throw new Error('Failed to update .env file.');
    }
}

router.get('/api/mikrotik-devices', ensureAuthenticatedStaff, (req, res) => {
    try {
        const devices = readMikrotikDevices();
        res.json(devices);
    } catch (error) {
        res.status(500).json({ message: "Failed to read device list." });
    }
});

router.get('/api/mikrotik-devices/:id', ensureAuthenticatedStaff, (req, res) => {
    try {
        const deviceId = req.params.id;
        
        // PENTING: Validasi deviceId
        if (!deviceId) {
            return res.status(400).json({ 
                status: 400,
                message: 'Device ID harus diisi',
                error: 'Missing device ID'
            });
        }
        
        const devices = readMikrotikDevices();
        
        // PENTING: Pastikan devices adalah array
        if (!Array.isArray(devices)) {
            console.error('[MIKROTIK_DEVICES] Devices data is not an array:', typeof devices);
            return res.status(500).json({ 
                status: 500,
                message: 'Data perangkat tidak valid',
                error: 'Invalid devices data format'
            });
        }
        
        const device = devices.find(d => d && d.id === deviceId);
        
        if (device) {
            // PENTING: Pastikan semua field ada sebelum return
            const responseDevice = {
                id: device.id || '',
                ip: device.ip || '',
                name: device.name || '',
                password: device.password || '',
                port: device.port || '8728',
                active: device.active || false
            };
            
            res.json(responseDevice);
        } else {
            res.status(404).json({ 
                status: 404,
                message: 'Perangkat tidak ditemukan',
                error: 'Device not found'
            });
        }
    } catch (error) {
        console.error('[MIKROTIK_DEVICES] Error reading device:', error);
        res.status(500).json({ 
            status: 500,
            message: 'Gagal membaca data perangkat',
            error: error.message
        });
    }
});

router.post('/api/mikrotik-devices', ensureAuthenticatedStaff, (req, res) => {
    try {
        const devices = readMikrotikDevices();
        const newDevice = {
            id: String(Date.now()),
            ip: req.body.ip,
            name: req.body.name,
            password: req.body.password,
            port: req.body.port || '8728', // Add port with fallback
            active: false
        };
        devices.push(newDevice);
        writeMikrotikDevices(devices);
        res.status(201).json({ message: 'Device added successfully', data: newDevice });
    } catch (error) {
        res.status(500).json({ message: "Failed to add device." });
    }
});

router.put('/api/mikrotik-devices/:id', ensureAuthenticatedStaff, (req, res) => {
    try {
        const deviceId = req.params.id;
        
        // PENTING: Validasi deviceId
        if (!deviceId) {
            return res.status(400).json({ 
                status: 400,
                message: 'Device ID harus diisi',
                error: 'Missing device ID'
            });
        }
        
        // PENTING: Validasi request body
        if (!req.body) {
            return res.status(400).json({ 
                status: 400,
                message: 'Data perangkat harus diisi',
                error: 'Missing request body'
            });
        }
        
        const devices = readMikrotikDevices();
        
        // PENTING: Pastikan devices adalah array
        if (!Array.isArray(devices)) {
            console.error('[MIKROTIK_DEVICES] Devices data is not an array:', typeof devices);
            return res.status(500).json({ 
                status: 500,
                message: 'Data perangkat tidak valid',
                error: 'Invalid devices data format'
            });
        }
        
        const index = devices.findIndex(d => d && d.id === deviceId);
        
        if (index !== -1) {
            // PENTING: Pastikan semua field ada dengan fallback
            const updatedDevice = {
                ...devices[index],
                id: deviceId, // Pastikan ID tidak berubah
                ip: req.body.ip || devices[index].ip || '',
                name: req.body.name || devices[index].name || '',
                password: req.body.password || devices[index].password || '',
                port: req.body.port || devices[index].port || '8728',
                active: devices[index].active || false // Preserve active status
            };
            
            devices[index] = updatedDevice;

            // If the device being updated is the active one, update the .env file too.
            if (updatedDevice.active) {
                try {
                    updateEnvFile('IP_MC', updatedDevice.ip);
                    updateEnvFile('NAME_MC', updatedDevice.name);
                    updateEnvFile('PASSWORD_MC', updatedDevice.password);
                    updateEnvFile('PORT_MC', updatedDevice.port);
                } catch (envError) {
                    // Log the error but don't fail the whole request,
                    // as the primary data (devices.json) was still updated.
                    console.error(`[ENV_UPDATE_WARN] Failed to update .env file after editing active device: ${envError.message}`);
                    // Optionally, you could add a specific message to the response
                    // res.json({ message: 'Device updated, but failed to sync with .env.', data: updatedDevice });
                    // For now, we'll let it pass silently to the user.
                }
            }

            writeMikrotikDevices(devices);
            res.json({ 
                status: 200,
                message: 'Perangkat berhasil diperbarui', 
                data: updatedDevice 
            });
        } else {
            res.status(404).json({ 
                status: 404,
                message: 'Perangkat tidak ditemukan',
                error: 'Device not found'
            });
        }
    } catch (error) {
        console.error('[MIKROTIK_DEVICES] Error updating device:', error);
        res.status(500).json({ 
            status: 500,
            message: 'Gagal memperbarui perangkat',
            error: error.message
        });
    }
});



router.post('/api/mikrotik-devices/set-active/:id', ensureAuthenticatedStaff, (req, res) => {
    try {
        let devices = readMikrotikDevices();
        const index = devices.findIndex(d => d.id === req.params.id);
        if (index !== -1) {
            devices.forEach((device, i) => {
                devices[i].active = i === index;
            });
            const activeDevice = devices[index];
            
            updateEnvFile('IP_MC', activeDevice.ip);
            updateEnvFile('NAME_MC', activeDevice.name);
            updateEnvFile('PASSWORD_MC', activeDevice.password);
            updateEnvFile('PORT_MC', activeDevice.port || '8728'); // Update port

            writeMikrotikDevices(devices);
            res.json({ message: 'Device set as active successfully' });
        } else {
            res.status(404).json({ message: 'Device not found' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message || "Failed to set active device." });
    }
});

// --- WiFi Templates Management API ---
const wifiTemplatesPath = path.join(__dirname, '..', 'database', 'wifi_templates.json');

// Get all WiFi templates
// Get login logs
router.get('/api/logs/login', ensureAuthenticatedStaff, async (req, res) => {
    try {
        const {
            limit = parseInt(req.query.limit) || 100,
            offset = parseInt(req.query.offset) || 0,
            username = req.query.username || null,
            actionType = req.query.actionType || null,
            successOnly = req.query.successOnly === 'true',
            startDate = req.query.startDate ? new Date(req.query.startDate) : null,
            endDate = req.query.endDate ? new Date(req.query.endDate) : null
        } = req.query;

        const logs = await getLoginLogs({
            limit: parseInt(limit),
            offset: parseInt(offset),
            username,
            actionType,
            successOnly,
            startDate,
            endDate
        });

        res.status(200).json({
            status: 200,
            message: 'Login logs retrieved',
            data: logs,
            pagination: {
                limit: parseInt(limit),
                offset: parseInt(offset),
                count: logs.length
            }
        });
    } catch (error) {
        console.error('[API_LOGIN_LOGS_ERROR]', error);
        res.status(500).json({
            status: 500,
            message: 'Error retrieving login logs: ' + error.message
        });
    }
});

// Get activity logs
router.get('/api/logs/activity', ensureAuthenticatedStaff, async (req, res) => {
    try {
        const {
            limit = parseInt(req.query.limit) || 100,
            offset = parseInt(req.query.offset) || 0,
            userId = req.query.userId ? parseInt(req.query.userId) : null,
            actionType = req.query.actionType || null,
            resourceType = req.query.resourceType || null,
            startDate = req.query.startDate ? new Date(req.query.startDate) : null,
            endDate = req.query.endDate ? new Date(req.query.endDate) : null
        } = req.query;

        const logs = await getActivityLogs({
            limit: parseInt(limit),
            offset: parseInt(offset),
            userId,
            actionType,
            resourceType,
            startDate,
            endDate
        });

        res.status(200).json({
            status: 200,
            message: 'Activity logs retrieved',
            data: logs,
            pagination: {
                limit: parseInt(limit),
                offset: parseInt(offset),
                count: logs.length
            }
        });
    } catch (error) {
        console.error('[API_ACTIVITY_LOGS_ERROR]', error);
        res.status(500).json({
            status: 500,
            message: 'Error retrieving activity logs: ' + error.message
        });
    }
});

router.get('/api/wifi-templates', ensureAuthenticatedStaff, (req, res) => {
    if (!req.user || !['admin', 'owner', 'superadmin'].includes(req.user.role)) {
        return res.status(403).json({ message: "Akses ditolak." });
    }
    try {
        const templates = loadJSON('wifi_templates.json');
        res.status(200).json({ status: 200, message: "WiFi templates berhasil dimuat.", data: templates });
    } catch (error) {
        console.error("[API_WIFI_TEMPLATES_GET_ERROR]", error);
        res.status(500).json({ status: 500, message: "Gagal memuat WiFi templates." });
    }
});

// Add new WiFi template
router.post('/api/wifi-templates', ensureAuthenticatedStaff, (req, res) => {
    if (!req.user || !['admin', 'owner', 'superadmin'].includes(req.user.role)) {
        return res.status(403).json({ message: "Akses ditolak." });
    }
    try {
        const { intent, keywords, category, description, icon } = req.body;
        
        if (!intent || !keywords || !Array.isArray(keywords) || keywords.length === 0) {
            return res.status(400).json({ status: 400, message: "Intent dan keywords (array) wajib diisi." });
        }

        const templates = loadJSON('wifi_templates.json');
        
        // Check if intent already exists
        const existingTemplate = templates.find(t => t.intent === intent);
        if (existingTemplate) {
            return res.status(400).json({ status: 400, message: `Intent '${intent}' sudah ada. Gunakan update untuk mengubahnya.` });
        }

        const newTemplate = {
            keywords: keywords.filter(k => k && k.trim() !== ''),
            intent: intent,
            category: category || 'other',
            description: description || '',
            icon: icon || '📝'
        };

        templates.push(newTemplate);
        saveJSON('wifi_templates.json', templates);

        // Force reload WiFi templates untuk update cache
        try {
            const { loadWifiTemplates } = require('../lib/wifi_template_handler');
            loadWifiTemplates();
            console.log('[WIFI_TEMPLATES] Template cache reloaded after save');
        } catch (reloadError) {
            console.error('[WIFI_TEMPLATES] Failed to reload template cache:', reloadError.message);
            // Don't fail the request if reload fails, just log the error
        }

        console.log(`[WIFI_TEMPLATES] Template baru ditambahkan: ${intent} (${category}) oleh ${req.user.username}`);
        res.status(201).json({ status: 201, message: "Template WiFi berhasil ditambahkan.", data: newTemplate });
    } catch (error) {
        console.error("[API_WIFI_TEMPLATES_POST_ERROR]", error);
        res.status(500).json({ status: 500, message: "Gagal menambahkan template WiFi." });
    }
});

// Update WiFi template by intent
router.put('/api/wifi-templates/:intent', ensureAuthenticatedStaff, (req, res) => {
    if (!req.user || !['admin', 'owner', 'superadmin'].includes(req.user.role)) {
        return res.status(403).json({ message: "Akses ditolak." });
    }
    try {
        const { intent } = req.params;
        const { keywords, newIntent, category, description, icon } = req.body;

        if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
            return res.status(400).json({ status: 400, message: "Keywords (array) wajib diisi." });
        }

        const templates = loadJSON('wifi_templates.json');
        const templateIndex = templates.findIndex(t => t.intent === intent);

        if (templateIndex === -1) {
            return res.status(404).json({ status: 404, message: `Template dengan intent '${intent}' tidak ditemukan.` });
        }

        // If newIntent is provided and different, check if it doesn't conflict with existing intents
        if (newIntent && newIntent !== intent) {
            const conflictingTemplate = templates.find((t, idx) => t.intent === newIntent && idx !== templateIndex);
            if (conflictingTemplate) {
                return res.status(400).json({ status: 400, message: `Intent '${newIntent}' sudah digunakan oleh template lain.` });
            }
            templates[templateIndex].intent = newIntent;
        }

        // Update keywords (required)
        templates[templateIndex].keywords = keywords.filter(k => k && k.trim() !== '');
        
        // Update category (optional, only if provided)
        if (category !== undefined && category !== null && category.trim() !== '') {
            templates[templateIndex].category = category.trim();
        }
        
        // Update description (optional, only if provided)
        if (description !== undefined && description !== null) {
            templates[templateIndex].description = description.trim() || '';
        }
        
        // Update icon (optional, only if provided)
        if (icon !== undefined && icon !== null && icon.trim() !== '') {
            templates[templateIndex].icon = icon.trim();
        }
        
        saveJSON('wifi_templates.json', templates);

        // Force reload WiFi templates untuk update cache
        try {
            const { loadWifiTemplates } = require('../lib/wifi_template_handler');
            loadWifiTemplates();
            console.log('[WIFI_TEMPLATES] Template cache reloaded after update');
        } catch (reloadError) {
            console.error('[WIFI_TEMPLATES] Failed to reload template cache:', reloadError.message);
            // Don't fail the request if reload fails, just log the error
        }

        console.log(`[WIFI_TEMPLATES] Template diupdate: ${intent} oleh ${req.user.username}`);
        res.status(200).json({ status: 200, message: "Template WiFi berhasil diupdate.", data: templates[templateIndex] });
    } catch (error) {
        console.error("[API_WIFI_TEMPLATES_PUT_ERROR]", error);
        res.status(500).json({ status: 500, message: "Gagal mengupdate template WiFi." });
    }
});

// Delete WiFi template by intent
router.delete('/api/wifi-templates/:intent', ensureAuthenticatedStaff, (req, res) => {
    if (!req.user || !['admin', 'owner', 'superadmin'].includes(req.user.role)) {
        return res.status(403).json({ message: "Akses ditolak." });
    }
    try {
        const { intent } = req.params;
        const templates = loadJSON('wifi_templates.json');
        const initialLength = templates.length;
        
        const filteredTemplates = templates.filter(t => t.intent !== intent);
        
        if (filteredTemplates.length === initialLength) {
            return res.status(404).json({ status: 404, message: `Template dengan intent '${intent}' tidak ditemukan.` });
        }

        saveJSON('wifi_templates.json', filteredTemplates);

        // Force reload WiFi templates untuk update cache
        try {
            const { loadWifiTemplates } = require('../lib/wifi_template_handler');
            loadWifiTemplates();
            console.log('[WIFI_TEMPLATES] Template cache reloaded after delete');
        } catch (reloadError) {
            console.error('[WIFI_TEMPLATES] Failed to reload template cache:', reloadError.message);
            // Don't fail the request if reload fails, just log the error
        }

        console.log(`[WIFI_TEMPLATES] Template dihapus: ${intent} oleh ${req.user.username}`);
        res.status(200).json({ status: 200, message: "Template WiFi berhasil dihapus." });
    } catch (error) {
        console.error("[API_WIFI_TEMPLATES_DELETE_ERROR]", error);
        res.status(500).json({ status: 500, message: "Gagal menghapus template WiFi." });
    }
});

// Batch customer metrics endpoint
router.post('/api/customer-metrics-batch', ensureAuthenticatedStaff, async (req, res) => {
    try {
        const { deviceIds } = req.body;
        
        if (!deviceIds || !Array.isArray(deviceIds) || deviceIds.length === 0) {
            return res.status(400).json({ 
                status: 400, 
                message: "deviceIds array is required and cannot be empty" 
            });
        }

        console.log(`[API_CUSTOMER_METRICS_BATCH] Processing ${deviceIds.length} devices: ${JSON.stringify(deviceIds)}`);
        
        const results = await getMultipleDeviceMetrics(deviceIds);
        
        res.status(200).json({
            status: 200,
            message: "Batch metrics retrieved successfully",
            data: results
        });
        
    } catch (error) {
        console.error("[API_CUSTOMER_METRICS_BATCH_ERROR]", error);
        res.status(500).json({
            status: 500,
            message: error.message || "Failed to retrieve batch device metrics",
            data: []
        });
    }
});

// Single device details endpoint - proxy to batch metrics
router.get('/api/device-details/:deviceId', ensureAuthenticatedStaff, async (req, res) => {
    try {
        const { deviceId } = req.params;
        
        if (!deviceId) {
            return res.status(400).json({ 
                status: 400, 
                message: "deviceId is required" 
            });
        }

        console.log(`[API_DEVICE_DETAILS] Fetching details for device: ${deviceId}`);
        
        const results = await getMultipleDeviceMetrics([deviceId]);
        
        if (results && results.length > 0) {
            const deviceData = results[0];
            res.status(200).json({
                status: 200,
                message: "Device details retrieved successfully",
                data: {
                    modemType: deviceData.modemType || null,
                    redaman: deviceData.redaman || null,
                    temperature: deviceData.temperature || null,
                    uptime: deviceData.uptime || null,
                    totalConnectedDevices: deviceData.totalConnectedDevices || 0
                }
            });
        } else {
            res.status(404).json({
                status: 404,
                message: "Device not found or no data available",
                data: null
            });
        }
        
    } catch (error) {
        console.error("[API_DEVICE_DETAILS_ERROR]", error);
        res.status(500).json({
            status: 500,
            message: error.message || "Failed to retrieve device details",
            data: null
        });
    }
});

// Single device redaman endpoint - proxy to batch metrics
router.get('/api/customer-redaman/:deviceId', ensureAuthenticatedStaff, async (req, res) => {
    try {
        const { deviceId } = req.params;
        const forceRefresh = req.query.force_refresh === 'true';
        
        if (!deviceId) {
            return res.status(400).json({ 
                status: 400, 
                message: "deviceId is required" 
            });
        }

        console.log(`[API_CUSTOMER_REDAMAN] Fetching redaman for device: ${deviceId} (force_refresh: ${forceRefresh})`);
        
        const results = await getMultipleDeviceMetrics([deviceId]);
        
        if (results && results.length > 0) {
            const deviceData = results[0];
            let redamanValue = null;
            
            // Extract numeric value from "X.XX dBm" format
            if (deviceData.redaman) {
                const match = deviceData.redaman.match(/-?\d+\.?\d*/);
                if (match) {
                    redamanValue = parseFloat(match[0]);
                }
            }
            
            res.status(200).json({
                status: 200,
                message: redamanValue !== null ? "Data redaman berhasil diambil" : "Data redaman tidak tersedia untuk perangkat ini",
                data: {
                    redaman: redamanValue,
                    redamanRaw: deviceData.redaman || null
                }
            });
        } else {
            res.status(404).json({
                status: 404,
                message: "Device not found or no data available",
                data: { redaman: null }
            });
        }
        
    } catch (error) {
        console.error("[API_CUSTOMER_REDAMAN_ERROR]", error);
        res.status(500).json({
            status: 500,
            message: error.message || "Failed to retrieve redaman data",
            data: { redaman: null }
        });
    }
});

// GenieACS Parameters Management APIs
router.get('/api/genieacs-parameters', ensureAuthenticatedStaff, (req, res) => {
    try {
        const parameters = loadJSON('genieacs_parameters.json') || [];
        res.status(200).json({
            status: 200,
            message: "Parameters retrieved successfully",
            data: parameters
        });
    } catch (error) {
        console.error("[API_GENIEACS_PARAMETERS_GET_ERROR]", error);
        res.status(500).json({
            status: 500,
            message: "Failed to retrieve parameters"
        });
    }
});

router.post('/api/genieacs-parameters', ensureAuthenticatedStaff, (req, res) => {
    try {
        const { type, name, description, paths } = req.body;
        
        if (!type || !name || !paths || !Array.isArray(paths) || paths.length === 0) {
            return res.status(400).json({
                status: 400,
                message: "Type, name, and paths array are required"
            });
        }

        const parameters = loadJSON('genieacs_parameters.json') || [];
        const newParameter = {
            id: Date.now().toString() + Math.random().toString(36).substring(2, 7),
            type,
            name,
            description: description || '',
            paths: paths.filter(p => p && p.trim()),
            createdAt: new Date().toISOString(),
            createdBy: req.user.username
        };

        parameters.push(newParameter);
        saveJSON('genieacs_parameters.json', parameters);

        console.log(`[API_GENIEACS_PARAMETERS_POST] Parameter created: ${name} by ${req.user.username}`);
        res.status(200).json({
            status: 200,
            message: "Parameter created successfully",
            data: newParameter
        });
    } catch (error) {
        console.error("[API_GENIEACS_PARAMETERS_POST_ERROR]", error);
        res.status(500).json({
            status: 500,
            message: "Failed to create parameter"
        });
    }
});

router.put('/api/genieacs-parameters/:id', ensureAuthenticatedStaff, (req, res) => {
    try {
        const { id } = req.params;
        const { type, name, description, paths } = req.body;
        
        if (!type || !name || !paths || !Array.isArray(paths) || paths.length === 0) {
            return res.status(400).json({
                status: 400,
                message: "Type, name, and paths array are required"
            });
        }

        const parameters = loadJSON('genieacs_parameters.json') || [];
        const paramIndex = parameters.findIndex(p => p.id === id);
        
        if (paramIndex === -1) {
            return res.status(404).json({
                status: 404,
                message: "Parameter not found"
            });
        }

        parameters[paramIndex] = {
            ...parameters[paramIndex],
            type,
            name,
            description: description || '',
            paths: paths.filter(p => p && p.trim()),
            updatedAt: new Date().toISOString(),
            updatedBy: req.user.username
        };

        saveJSON('genieacs_parameters.json', parameters);

        console.log(`[API_GENIEACS_PARAMETERS_PUT] Parameter updated: ${name} by ${req.user.username}`);
        res.status(200).json({
            status: 200,
            message: "Parameter updated successfully",
            data: parameters[paramIndex]
        });
    } catch (error) {
        console.error("[API_GENIEACS_PARAMETERS_PUT_ERROR]", error);
        res.status(500).json({
            status: 500,
            message: "Failed to update parameter"
        });
    }
});

router.delete('/api/genieacs-parameters/:id', ensureAuthenticatedStaff, (req, res) => {
    try {
        const { id } = req.params;
        const parameters = loadJSON('genieacs_parameters.json') || [];
        const initialLength = parameters.length;
        
        const filteredParameters = parameters.filter(p => p.id !== id);
        
        if (filteredParameters.length === initialLength) {
            return res.status(404).json({
                status: 404,
                message: "Parameter not found"
            });
        }

        saveJSON('genieacs_parameters.json', filteredParameters);

        console.log(`[API_GENIEACS_PARAMETERS_DELETE] Parameter deleted: ${id} by ${req.user.username}`);
        res.status(200).json({
            status: 200,
            message: "Parameter deleted successfully"
        });
    } catch (error) {
        console.error("[API_GENIEACS_PARAMETERS_DELETE_ERROR]", error);
        res.status(500).json({
            status: 500,
            message: "Failed to delete parameter"
        });
    }
});

// Test parameter endpoint
router.post('/api/test-parameter', ensureAuthenticatedStaff, async (req, res) => {
    try {
        const { deviceId, parameterType } = req.body;
        
        if (!deviceId || !parameterType) {
            return res.status(400).json({
                status: 400,
                message: "deviceId and parameterType are required"
            });
        }

        // Get configured parameters
        const parameters = loadJSON('genieacs_parameters.json') || [];
        const paramConfig = parameters.find(p => p.type === parameterType);
        
        if (!paramConfig) {
            return res.status(404).json({
                status: 404,
                message: `No configuration found for parameter type: ${parameterType}`
            });
        }

        // Test the parameter by trying to fetch it from GenieACS
        const config = global.config;
        const queryPayload = { "_id": deviceId };
        const projectionFields = paramConfig.paths.join(',');
        
        const response = await axios.get(`${config.genieacsBaseUrl}/devices/`, {
            params: {
                query: JSON.stringify(queryPayload),
                projection: projectionFields
            },
            timeout: 10000
        });

        if (!response.data || response.data.length === 0) {
            return res.status(404).json({
                status: 404,
                message: "Device not found in GenieACS",
                data: { value: null, pathFound: null }
            });
        }

        const deviceData = response.data[0];
        let value = null;
        let pathFound = null;

        // Try each path until we find a value
        for (const path of paramConfig.paths) {
            const pathValue = getNestedValue(deviceData, path);
            if (pathValue !== undefined && pathValue !== null) {
                // Handle _value wrapper
                if (typeof pathValue === 'object' && pathValue.hasOwnProperty('_value')) {
                    value = pathValue._value;
                    pathFound = path;
                    break;
                } 
                // Handle direct value (string, number, etc.)
                else if (typeof pathValue !== 'object' || Array.isArray(pathValue)) {
                    value = pathValue;
                    pathFound = path;
                    break;
                }
                // Handle object that might have value property
                else if (pathValue.value !== undefined) {
                    value = pathValue.value;
                    pathFound = path;
                    break;
                }
            }
        }

        res.status(200).json({
            status: 200,
            message: value ? "Parameter found successfully" : "Parameter paths configured but no value found",
            data: {
                value: value,
                pathFound: pathFound,
                deviceId: deviceId,
                parameterType: parameterType,
                testedPaths: paramConfig.paths
            }
        });

    } catch (error) {
        console.error("[API_TEST_PARAMETER_ERROR]", error);
        res.status(500).json({
            status: 500,
            message: error.message || "Failed to test parameter",
            data: { value: null, pathFound: null }
        });
    }
});

// Test custom parameter endpoint (not registered - direct path testing)
router.post('/api/test-parameter-custom', ensureAuthenticatedStaff, async (req, res) => {
    try {
        const { deviceId, parameterPath } = req.body;
        
        if (!deviceId || !parameterPath) {
            return res.status(400).json({
                status: 400,
                message: "deviceId and parameterPath are required"
            });
        }

        // Test the parameter by fetching it directly from GenieACS
        const config = global.config;
        if (!config.genieacsBaseUrl) {
            return res.status(500).json({
                status: 500,
                message: "GenieACS URL not configured"
            });
        }

        const queryPayload = { "_id": deviceId };
        const projectionFields = parameterPath; // Use the provided path directly
        
        console.log(`[API_TEST_PARAMETER_CUSTOM] Testing parameter: ${parameterPath} for device: ${deviceId}`);
        
        const response = await axios.get(`${config.genieacsBaseUrl}/devices/`, {
            params: {
                query: JSON.stringify(queryPayload),
                projection: projectionFields
            },
            timeout: 10000
        });

        if (!response.data || response.data.length === 0) {
            return res.status(404).json({
                status: 404,
                message: "Device not found in GenieACS",
                data: { 
                    value: null, 
                    pathFound: null,
                    valueType: null,
                    rawValue: null
                }
            });
        }

        const deviceData = response.data[0];
        
        // Try multiple ACCESS METHODS to get value from the SAME path (like modemType does)
        // Method 1: Direct path using getNestedValue
        let pathValue = getNestedValue(deviceData, parameterPath);
        let pathFound = parameterPath;
        let accessMethod = 'getNestedValue';
        
        // Method 2: If not found, try alternative access methods for the SAME path
        if (pathValue === undefined || pathValue === null) {
            // Try flat key access (e.g., device['Events.Registered'])
            if (deviceData[parameterPath] !== undefined && deviceData[parameterPath] !== null) {
                pathValue = deviceData[parameterPath];
                accessMethod = 'flat key';
            }
            // Try nested access for Events.Registered (same path, different access)
            else if (parameterPath === 'Events.Registered' && deviceData.Events) {
                if (deviceData.Events.Registered !== undefined && deviceData.Events.Registered !== null) {
                    pathValue = deviceData.Events.Registered;
                    accessMethod = 'nested (Events.Registered)';
                } else if (deviceData.Events['Registered'] !== undefined && deviceData.Events['Registered'] !== null) {
                    pathValue = deviceData.Events['Registered'];
                    accessMethod = 'nested (Events[Registered])';
                }
            }
            // Try manual traversal for the same path
            else {
                const parts = parameterPath.split('.');
                let current = deviceData;
                let found = true;
                for (const part of parts) {
                    if (current && typeof current === 'object' && current.hasOwnProperty(part)) {
                        current = current[part];
                    } else {
                        found = false;
                        break;
                    }
                }
                if (found && current !== undefined && current !== null) {
                    pathValue = current;
                    accessMethod = 'manual traversal';
                }
            }
        }
        
        let value = null;
        let valueType = null;
        let rawValue = pathValue;

        // Try multiple METHODS to EXTRACT VALUE from the same pathValue (like test-parameter does)
        if (pathValue !== undefined && pathValue !== null) {
            // Method 1: Handle _value wrapper (common in GenieACS, like VirtualParameters.getSerialNumber)
            // Structure: {_value: "...", _type: "xsd:string", _timestamp: "...", _writable: false}
            if (typeof pathValue === 'object' && pathValue.hasOwnProperty('_value')) {
                value = pathValue._value;
                valueType = typeof value;
                // If _type indicates Date, try to parse it
                if (pathValue._type && (pathValue._type.includes('date') || pathValue._type.includes('time'))) {
                    if (typeof value === 'string') {
                        const dateValue = new Date(value);
                        if (!isNaN(dateValue.getTime())) {
                            value = dateValue.toISOString();
                            valueType = 'Date';
                        }
                    } else if (typeof value === 'number') {
                        // Timestamp in milliseconds or seconds
                        const dateValue = new Date(value > 1000000000000 ? value : value * 1000);
                        if (!isNaN(dateValue.getTime())) {
                            value = dateValue.toISOString();
                            valueType = 'Date';
                        }
                    }
                }
            } 
            // Method 2: Handle direct value (string, number, boolean, etc.) - like modemType
            // This is for values that are directly accessible without wrapper
            else if (typeof pathValue !== 'object' || Array.isArray(pathValue)) {
                value = pathValue;
                valueType = typeof pathValue;
            }
            // Method 3: Handle Date object
            else if (pathValue instanceof Date) {
                value = pathValue.toISOString();
                valueType = 'Date';
            }
            // Method 4: Handle object that might have value property (alternative structure)
            else if (pathValue.value !== undefined) {
                value = pathValue.value;
                valueType = typeof value;
            }
            // Method 5: If it's an object but no _value or value property, try to extract meaningful data
            else {
                // Try to find any string/number property that might be the actual value
                const keys = Object.keys(pathValue);
                for (const key of keys) {
                    const propValue = pathValue[key];
                    if (typeof propValue === 'string' || typeof propValue === 'number' || typeof propValue === 'boolean') {
                        value = propValue;
                        valueType = typeof propValue;
                        break;
                    }
                }
                // If still no value found, return the whole object as JSON string for inspection
                if (value === null) {
                    value = JSON.stringify(pathValue, null, 2);
                    valueType = 'object';
                }
            }
        }

        const message = value !== null && value !== undefined 
            ? `Parameter found successfully at path: ${pathFound} (access method: ${accessMethod})`
            : `Parameter path "${parameterPath}" exists but no value found or value is null`;

        res.status(200).json({
            status: 200,
            message: message,
            data: {
                value: value,
                pathFound: pathFound,
                valueType: valueType,
                rawValue: rawValue,
                deviceId: deviceId,
                parameterPath: parameterPath,
                accessMethod: accessMethod
            }
        });

    } catch (error) {
        console.error("[API_TEST_PARAMETER_CUSTOM_ERROR]", error);
        
        let errorMessage = error.message || "Failed to test parameter";
        if (error.response) {
            errorMessage = `GenieACS error: ${error.response.status} - ${error.response.statusText}`;
        } else if (error.code === 'ECONNABORTED') {
            errorMessage = "Request timeout - GenieACS tidak merespons";
        }
        
        return res.status(500).json({
            status: 500,
            message: errorMessage,
            data: { 
                value: null, 
                pathFound: null,
                valueType: null,
                rawValue: null
            }
        });
    }
});

// Bulk update payment status endpoint - Using SQLite database
router.post('/api/payment-status/bulk-update', ensureAuthenticatedStaff, async (req, res) => {
    const { userIds, paid, triggerNotification, paymentMethod } = req.body;
    const db = global.db;
    
    if (!db) {
        return res.status(500).json({
            status: 500,
            message: "Database not initialized"
        });
    }
    
    if (!Array.isArray(userIds) || userIds.length === 0) {
        return res.status(400).json({
            status: 400,
            message: "userIds must be a non-empty array"
        });
    }
    
    if (typeof paid !== 'boolean') {
        return res.status(400).json({
            status: 400,
            message: "paid must be a boolean value"
        });
    }
    
    const newPaidStatus = paid ? 1 : 0;
    let successCount = 0;
    let failedCount = 0;
    const errors = [];
    
    console.log(`[BULK_PAYMENT_UPDATE] Starting bulk update for ${userIds.length} users to paid=${paid}, triggerNotification=${triggerNotification}`);
    
    for (const userId of userIds) {
        try {
            // Get full user data from database
            const userExists = await new Promise((resolve, reject) => {
                db.get('SELECT * FROM users WHERE id = ?', [userId], (err, row) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(row);
                    }
                });
            });
            
            if (!userExists) {
                errors.push({ userId, error: 'User not found in database' });
                failedCount++;
                continue;
            }
            
            // Update database
            await new Promise((resolve, reject) => {
                db.run('UPDATE users SET paid = ? WHERE id = ?', [newPaidStatus, userId], function(err) {
                    if (err) {
                        console.error(`[BULK_PAYMENT_UPDATE_ERROR] Failed to update user ${userId}:`, err.message);
                        reject(err);
                    } else {
                        resolve();
                    }
                });
            });
            
            // Update in-memory cache if it exists
            if (global.users && Array.isArray(global.users)) {
                const cachedUser = global.users.find(u => u.id === userId);
                if (cachedUser) {
                    cachedUser.paid = paid;
                }
            }
            
            // Get previous paid status for comparison
            const previousPaidStatus = userExists.paid === 1;
            
            // Log activity
            if (previousPaidStatus !== paid) {
                try {
                    const user = global.users.find(u => u.id === userId);
                    await logActivity({
                        userId: req.user.id,
                        username: req.user.username,
                        role: req.user.role,
                        actionType: 'UPDATE',
                        resourceType: 'payment',
                        resourceId: userId.toString(),
                        resourceName: user ? user.name : `User ID ${userId}`,
                        description: `Bulk updated payment status for user ${user ? user.name : userId}: ${previousPaidStatus ? 'paid' : 'unpaid'} → ${paid ? 'paid' : 'unpaid'}`,
                        oldValue: { paid: previousPaidStatus },
                        newValue: { paid: paid },
                        ipAddress: req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'],
                        userAgent: req.headers['user-agent']
                    });
                } catch (logErr) {
                    console.error(`[ACTIVITY_LOG_ERROR] Failed to log bulk payment update for user ${userId}:`, logErr);
                }
            }

            // Trigger handlePaidStatusChange if status changed from unpaid to paid
            if (paid && !previousPaidStatus) {
                try {
                    // Create complete user object for handlePaidStatusChange
                    const userForNotification = {
                        id: userExists.id,
                        name: userExists.name,
                        phone_number: userExists.phone_number,
                        device_id: userExists.device_id,
                        subscription: userExists.subscription,
                        send_invoice: userExists.send_invoice,
                        pppoe_username: userExists.pppoe_username,
                        address: userExists.address,
                        bulk: userExists.bulk ? JSON.parse(userExists.bulk) : []
                    };
                    
                    // Call handlePaidStatusChange with payment details
                    // Use paymentMethod from request body if provided, otherwise default to TRANSFER_BANK
                    const method = paymentMethod && ['CASH', 'TRANSFER_BANK'].includes(paymentMethod) 
                        ? paymentMethod 
                        : 'TRANSFER_BANK';
                    
                    const paymentDetails = {
                        paidDate: new Date().toISOString(),
                        method: method,
                        approvedBy: req.user ? req.user.username : 'Admin',
                        notes: `Status pembayaran diubah melalui halaman Payment Status (${method === 'CASH' ? 'Tunai' : 'Transfer Bank'})`
                    };
                    
                    await handlePaidStatusChange(userForNotification, paymentDetails);
                    console.log(`[BULK_PAYMENT_UPDATE] handlePaidStatusChange triggered for user ${userId}`);
                } catch (notifError) {
                    console.error(`[BULK_PAYMENT_NOTIF_ERROR] Failed to trigger handlePaidStatusChange for user ${userId}:`, notifError);
                    // Don't fail the payment update if notification fails
                }
            } else if (!paid && previousPaidStatus) {
                // Handle status change from paid to unpaid (isolir logic if needed)
                console.log(`[BULK_PAYMENT_UPDATE] User ${userId} status changed from paid to unpaid`);
                // Additional logic for isolir can be added here if needed
            }
            
            successCount++;
            
        } catch (error) {
            console.error(`[BULK_PAYMENT_UPDATE_ERROR] Failed to update user ${userId}:`, error);
            errors.push({ userId, error: error.message });
            failedCount++;
        }
    }
    
    console.log(`[BULK_PAYMENT_UPDATE] Completed: ${successCount} success, ${failedCount} failed`);
    
    res.status(200).json({
        status: 200,
        message: `Bulk update completed. Success: ${successCount}, Failed: ${failedCount}`,
        updated: successCount,
        failed: failedCount,
        errors: errors.length > 0 ? errors : undefined
    });
});

// === WORKING HOURS API ===
const { isWithinWorkingHours, getNextAvailableMessage } = require('../lib/working-hours-helper');

// GET working hours settings
router.get('/api/working-hours', ensureAuthenticatedStaff, (req, res) => {
    try {
        const settings = global.config.teknisiWorkingHours || {
            enabled: false,
            weekdays: { start: "08:00", end: "17:00" },
            saturday: { start: "08:00", end: "13:00" },
            sunday: { enabled: false, start: "00:00", end: "00:00" },
            holidays: [],
            responseTime: {
                high_priority_within_hours: "maksimal 2 jam",
                high_priority_outside_hours: "keesokan hari jam kerja",
                medium_priority: "1x24 jam kerja"
            },
            psbEstimationTime: "30-60 menit"
        };
        
        // Ensure psbEstimationTime exists (for backward compatibility)
        if (!settings.psbEstimationTime) {
            settings.psbEstimationTime = "30-60 menit";
        }
        
        const workingStatus = isWithinWorkingHours();
        const nextAvailable = getNextAvailableMessage();
        
        res.json({
            success: true,
            settings: settings,
            status: {
                isWithinHours: workingStatus.isWithinHours,
                dayType: workingStatus.dayType,
                message: workingStatus.message,
                nextAvailable: nextAvailable
            }
        });
    } catch (error) {
        console.error('[API] Error getting working hours:', error);
        res.status(500).json({
            success: false,
            message: 'Gagal mengambil pengaturan jam kerja'
        });
    }
});

// POST working hours settings (update)
router.post('/api/working-hours', ensureAuthenticatedStaff, rateLimit('working-hours-update', 5, 60000), async (req, res) => {
    if (!req.user || !['admin', 'owner', 'superadmin'].includes(req.user.role)) {
        return res.status(403).json({
            success: false,
            message: "Akses ditolak. Hanya admin yang dapat mengubah pengaturan."
        });
    }
    
    try {
        const newSettings = req.body;
        
        // Support both old and new structure
        let configToSave;
        
        if (newSettings.days) {
            // New per-day structure
            // Validate required fields
            if (!newSettings.days || !newSettings.responseTime) {
                return res.status(400).json({
                    success: false,
                    message: 'Data pengaturan tidak lengkap'
                });
            }
            
            configToSave = {
                enabled: newSettings.enabled !== false,
                days: newSettings.days,
                holidays: newSettings.holidays || global.config.teknisiWorkingHours?.holidays || [],
                responseTime: newSettings.responseTime,
                outOfHoursMessage: newSettings.outOfHoursMessage || 'Laporan Anda diterima di luar jam kerja. Akan diproses pada jam kerja berikutnya.',
                holidayMessage: newSettings.holidayMessage || 'Laporan Anda diterima pada hari libur. Akan diproses pada hari kerja berikutnya.',
                psbEstimationTime: newSettings.psbEstimationTime || '30-60 menit'
            };
        } else {
            // Old structure (for backward compatibility)
            if (!newSettings.weekdays || !newSettings.saturday || !newSettings.sunday || !newSettings.responseTime) {
                return res.status(400).json({
                    success: false,
                    message: 'Data pengaturan tidak lengkap'
                });
            }
            
            configToSave = {
                enabled: newSettings.enabled !== false,
                weekdays: newSettings.weekdays,
                saturday: newSettings.saturday,
                sunday: newSettings.sunday,
                holidays: newSettings.holidays || [],
                responseTime: newSettings.responseTime,
                psbEstimationTime: newSettings.psbEstimationTime || '30-60 menit'
            };
        }
        
        // Update config
        global.config.teknisiWorkingHours = configToSave;
        
        // Save to file
        const configPath = path.join(__dirname, '..', 'config.json');
        fs.writeFileSync(configPath, JSON.stringify(global.config, null, 4));
        
        console.log('[API] Working hours settings updated successfully');
        
        res.json({
            success: true,
            message: 'Pengaturan jam kerja berhasil disimpan'
        });
    } catch (error) {
        console.error('[API] Error saving working hours:', error);
        res.status(500).json({
            success: false,
            message: 'Gagal menyimpan pengaturan jam kerja'
        });
    }
});

// Helper function for nested value access (if not already defined)
function getNestedValue(obj, path) {
    const parts = path.split('.');
    let current = obj;
    for (const part of parts) {
        if (current && typeof current === 'object') {
            // Handle method calls like getSerialNumber (GenieACS VirtualParameters)
            if (current.hasOwnProperty(part)) {
                current = current[part];
            } else {
                // Try with different casing or as method result
                // For VirtualParameters.getSerialNumber, GenieACS might return it as getSerialNumber directly
                const lowerPart = part.toLowerCase();
                const foundKey = Object.keys(current).find(key => key.toLowerCase() === lowerPart);
                if (foundKey) {
                    current = current[foundKey];
                } else {
                    return undefined;
                }
            }
        } else {
            return undefined;
        }
    }
    return current;
}


// Generate alternative paths based on common GenieACS patterns
function generateAlternativePaths(path) {
    const alternatives = [];
    
    // Common patterns for ProductClass
    if (path.includes('ProductClass')) {
        // If path is DeviceID.ProductClass, try alternatives
        if (path === 'DeviceID.ProductClass') {
            alternatives.push('Device.DeviceInfo.ProductClass');
            alternatives.push('InternetGatewayDevice.DeviceInfo.ProductClass');
            alternatives.push('Device.DeviceInfo.ModelName');
            alternatives.push('InternetGatewayDevice.DeviceInfo.ModelName');
        }
        // If path contains Device.DeviceInfo.ProductClass
        else if (path.includes('Device.DeviceInfo.ProductClass')) {
            alternatives.push('DeviceID.ProductClass');
            alternatives.push('InternetGatewayDevice.DeviceInfo.ProductClass');
            alternatives.push('Device.DeviceInfo.ModelName');
            alternatives.push('InternetGatewayDevice.DeviceInfo.ModelName');
        }
        // If path contains InternetGatewayDevice.DeviceInfo.ProductClass
        else if (path.includes('InternetGatewayDevice.DeviceInfo.ProductClass')) {
            alternatives.push('DeviceID.ProductClass');
            alternatives.push('Device.DeviceInfo.ProductClass');
            alternatives.push('Device.DeviceInfo.ModelName');
            alternatives.push('InternetGatewayDevice.DeviceInfo.ModelName');
        }
    }
    
    // Common patterns for SerialNumber
    if (path.includes('SerialNumber')) {
        if (path.includes('Device.DeviceInfo.SerialNumber')) {
            alternatives.push('VirtualParameters.getSerialNumber');
            alternatives.push('VirtualParameters.serialNumber');
            alternatives.push('InternetGatewayDevice.DeviceInfo.SerialNumber');
            alternatives.push('_serialNumber');
        } else if (path.includes('InternetGatewayDevice.DeviceInfo.SerialNumber')) {
            alternatives.push('VirtualParameters.getSerialNumber');
            alternatives.push('VirtualParameters.serialNumber');
            alternatives.push('Device.DeviceInfo.SerialNumber');
            alternatives.push('_serialNumber');
        } else if (path.includes('VirtualParameters')) {
            alternatives.push('Device.DeviceInfo.SerialNumber');
            alternatives.push('InternetGatewayDevice.DeviceInfo.SerialNumber');
            alternatives.push('_serialNumber');
        }
    }
    
    // Common patterns for ModelName
    if (path.includes('ModelName')) {
        if (path.includes('Device.DeviceInfo.ModelName')) {
            alternatives.push('DeviceID.ProductClass');
            alternatives.push('Device.DeviceInfo.ProductClass');
            alternatives.push('InternetGatewayDevice.DeviceInfo.ModelName');
            alternatives.push('InternetGatewayDevice.DeviceInfo.ProductClass');
        } else if (path.includes('InternetGatewayDevice.DeviceInfo.ModelName')) {
            alternatives.push('DeviceID.ProductClass');
            alternatives.push('Device.DeviceInfo.ProductClass');
            alternatives.push('Device.DeviceInfo.ModelName');
            alternatives.push('InternetGatewayDevice.DeviceInfo.ProductClass');
        }
    }
    
    // Common patterns for Events.Registered
    if (path === 'Events.Registered') {
        // Events.Registered usually doesn't have alternatives, but we can try flat key
        alternatives.push('Events.Registered'); // Already tried, but keep for consistency
    }
    
    return alternatives;
}

// ====================
// Database Migration APIs
// ====================

// Note: exec is already imported at the top of this file (line 5)
const sqlite3 = require('sqlite3').verbose();

// Get database information
router.get('/api/database/info', ensureAuthenticatedStaff, async (req, res) => {
    try {
        // All databases stored in database/ folder
        const dbPath = path.join(__dirname, '..', 'database', 'users.sqlite');
        const stats = fs.statSync(dbPath);
        
        // Get user count and column info from database
        const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY);
        
        const getInfo = () => new Promise((resolve, reject) => {
            let info = {
                size: `${(stats.size / 1024).toFixed(1)} KB`,
                lastModified: new Date(stats.mtime).toLocaleString(),
                totalUsers: 0,
                totalColumns: 0
            };
            
            // Get user count
            db.get("SELECT COUNT(*) as count FROM users", [], (err, row) => {
                if (err) {
                    console.error('[DB_INFO] Error counting users:', err);
                    info.totalUsers = 'N/A';
                } else {
                    info.totalUsers = row.count;
                }
                
                // Get column count
                db.all("PRAGMA table_info(users)", [], (err, columns) => {
                    if (err) {
                        console.error('[DB_INFO] Error getting columns:', err);
                        info.totalColumns = 'N/A';
                    } else {
                        info.totalColumns = columns.length;
                    }
                    
                    db.close();
                    resolve(info);
                });
            });
        });
        
        const info = await getInfo();
        
        res.status(200).json({
            status: 200,
            message: "Database info retrieved",
            data: info
        });
        
    } catch (error) {
        console.error('[DB_INFO] Error:', error);
        res.status(500).json({
            status: 500,
            message: "Error getting database info",
            data: null
        });
    }
});

// Get database backup list
router.get('/api/database/backups', ensureAuthenticatedStaff, (req, res) => {
    try {
        const rootDir = path.join(__dirname, '..');
        const backupsDir = path.join(rootDir, 'backups');
        
        // Create backups directory if it doesn't exist
        if (!fs.existsSync(backupsDir)) {
            fs.mkdirSync(backupsDir, { recursive: true });
        }
        
        // Get backups from backups directory
        const backupFiles = fs.existsSync(backupsDir) ? 
            fs.readdirSync(backupsDir).filter(file => 
                file.startsWith('database.backup.') && file.endsWith('.sqlite')
            ) : [];
        
        // Sort by timestamp (newest first)
        const backups = backupFiles.map(filename => {
            const filePath = path.join(backupsDir, filename);
            const stats = fs.statSync(filePath);
            const timestamp = parseInt(filename.match(/database\.backup\.(\d+)\.sqlite/)[1]);
            
            return {
                filename: filename,
                created: new Date(timestamp).toLocaleString(),
                size: `${(stats.size / 1024).toFixed(1)} KB`,
                timestamp: timestamp
            };
        }).sort((a, b) => b.timestamp - a.timestamp);
        
        res.status(200).json({
            status: 200,
            message: "Backup list retrieved",
            data: backups
        });
        
    } catch (error) {
        console.error('[DB_BACKUPS] Error:', error);
        res.status(500).json({
            status: 500,
            message: "Error getting backup list",
            data: []
        });
    }
});

// Check database schema
router.post('/api/database/check-schema', ensureAuthenticatedStaff, async (req, res) => {
    try {
        const expectedColumns = [
            'id', 'name', 'username', 'password', 'phone_number', 'address',
            'latitude', 'longitude', 'subscription', 'device_id', 'status',
            'paid', 'send_invoice', 'is_corporate', 'corporate_name',
            'corporate_address', 'corporate_npwp', 'corporate_pic_name',
            'corporate_pic_phone', 'corporate_pic_email', 'pppoe_username',
            'pppoe_password', 'connected_odp_id', 'bulk', 'created_at',
            'updated_at', 'otp', 'otpTimestamp',
            // Additional fields from migrate-database.js
            'subscription_price', 'payment_due_date', 'is_paid', 'auto_isolir',
            'odc', 'odp', 'olt', 'maps_url', 'registration_date', 'last_login',
            'last_payment_date', 'reminder_sent', 'isolir_sent', 'compensation_minutes',
            'email', 'alternative_phone', 'notes'
        ];
        
        // Try users.sqlite first (new format), fallback to database.sqlite (old format)
        let dbPath = path.join(__dirname, '..', 'database', 'users.sqlite');
        if (!fs.existsSync(dbPath)) {
            dbPath = path.join(__dirname, '..', 'database', 'database.sqlite');
        }
        
        if (!fs.existsSync(dbPath)) {
            return res.status(404).json({
                status: 404,
                message: "Database file not found (users.sqlite or database.sqlite)",
                data: null
            });
        }
        
        const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY);
        
        const checkSchema = () => new Promise((resolve, reject) => {
            db.all("PRAGMA table_info(users)", [], (err, columns) => {
                if (err) {
                    reject(err);
                    return;
                }
                
                const existingColumns = columns.map(col => col.name);
                const missingColumns = expectedColumns.filter(col => 
                    !existingColumns.includes(col)
                );
                
                db.close();
                resolve({
                    existingColumns: existingColumns,
                    missingColumns: missingColumns,
                    totalExpected: expectedColumns.length,
                    totalExisting: existingColumns.length
                });
            });
        });
        
        const result = await checkSchema();
        
        res.status(200).json({
            status: 200,
            message: "Schema check complete",
            data: result
        });
        
    } catch (error) {
        console.error('[DB_CHECK_SCHEMA] Error:', error);
        res.status(500).json({
            status: 500,
            message: "Error checking schema: " + error.message,
            data: null
        });
    }
});

// Run database migration
router.post('/api/database/migrate-schema', ensureAuthenticatedStaff, async (req, res) => {
    try {
        // Try to use the new comprehensive migration script first
        let scriptPath = path.join(__dirname, '..', 'scripts', 'migrate-database.js');
        
        // Fallback to old script if new one doesn't exist
        if (!fs.existsSync(scriptPath)) {
            scriptPath = path.join(__dirname, '..', 'tools', 'smart-migrate-database.js');
            
            if (!fs.existsSync(scriptPath)) {
                return res.status(404).json({
                    status: 404,
                    message: "Migration script not found",
                    data: null
                });
            }
        }
        
        // Run migration script
        exec(`node "${scriptPath}"`, { cwd: path.join(__dirname, '..') }, async (error, stdout, stderr) => {
            if (error) {
                console.error('[DB_MIGRATE] Error:', error);
                console.error('[DB_MIGRATE] Stderr:', stderr);
                
                return res.status(500).json({
                    status: 500,
                    message: "Migration failed: " + error.message,
                    data: null
                });
            }
            
            // Parse output to extract useful info
            const output = stdout.toString();
            let backupFile = null;
            let addedColumns = [];
            
            // Handle both old and new migration script output formats
            
            // New script format: "[SUCCESS] Backup created: path"
            let backupMatch = output.match(/\[SUCCESS\].*Backup created: ([^\n]+)/);
            if (!backupMatch) {
                // Old script format: "Creating backup: path"
                backupMatch = output.match(/Creating backup: ([^\n]+)/);
            }
            
            if (backupMatch) {
                // Get just the filename without path
                const fullPath = backupMatch[1].trim();
                backupFile = path.basename(fullPath);
            }
            
            // New script format: "[SUCCESS] Added field: fieldname"
            let columnMatches = output.match(/\[SUCCESS\].*Added field:.*?(\w+)/g);
            if (!columnMatches) {
                // Old script format: "✅ Added column: fieldname"
                columnMatches = output.match(/✅ Added column: (\w+)/g);
            }
            
            if (columnMatches) {
                addedColumns = columnMatches.map(match => {
                    // Handle both formats
                    if (match.includes('[SUCCESS]')) {
                        // Extract field name from colored output
                        const fieldMatch = match.match(/Added field:.*?(\w+)/);
                        return fieldMatch ? fieldMatch[1] : match;
                    } else {
                        return match.replace('✅ Added column: ', '').split(' ')[0];
                    }
                });
            }
            
            // Check if already up to date (both script formats)
            const upToDate = output.includes('All required fields already exist!') || 
                            output.includes('Database schema is already up to date!');
            
            console.log('[DB_MIGRATE] Migration completed successfully');
            
            // Auto-reload database after migration
            const { reloadUsersFromDatabase } = require('../lib/database-reload');
            
            try {
                const reloadResult = await reloadUsersFromDatabase();
                console.log('[DB_MIGRATE] Database reloaded in memory:', reloadResult.message);
                
                res.status(200).json({
                    status: 200,
                    message: upToDate ? "Database already up to date" : "Migration completed successfully. No restart needed!",
                    data: {
                        backupFile: backupFile,
                        addedColumns: addedColumns,
                        upToDate: upToDate,
                        output: output,
                        reloadResult: reloadResult,
                        restartRequired: false
                    }
                });
            } catch (reloadErr) {
                console.error('[DB_MIGRATE] Error reloading database:', reloadErr);
                
                // Migration succeeded but reload failed
                res.status(200).json({
                    status: 200,
                    message: upToDate ? "Database already up to date" : "Migration completed. Please restart for changes to take effect.",
                    data: {
                        backupFile: backupFile,
                        addedColumns: addedColumns,
                        upToDate: upToDate,
                        output: output,
                        reloadError: reloadErr.message,
                        restartRequired: true
                    }
                });
            }
        });
        
    } catch (error) {
        console.error('[DB_MIGRATE] Error:', error);
        res.status(500).json({
            status: 500,
            message: "Error starting migration: " + error.message,
            data: null
        });
    }
});

// Upload and replace database
router.post('/api/database/upload', ensureAuthenticatedStaff, async (req, res) => {
    try {
        // Check for multer middleware
        const multer = require('multer');
        const upload = multer({
            dest: path.join(__dirname, '..', 'temp'),
            limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
            fileFilter: (req, file, cb) => {
                const ext = path.extname(file.originalname).toLowerCase();
                if (['.sqlite', '.db', '.sqlite3'].includes(ext)) {
                    cb(null, true);
                } else {
                    cb(new Error('Invalid file type. Only SQLite files are allowed.'));
                }
            }
        }).single('database');
        
        // Process upload
        upload(req, res, async (err) => {
            if (err) {
                console.error('[DB_UPLOAD] Upload error:', err);
                return res.status(400).json({
                    status: 400,
                    message: err.message || 'Upload failed',
                    data: null
                });
            }
            
            if (!req.file) {
                return res.status(400).json({
                    status: 400,
                    message: 'No file uploaded',
                    data: null
                });
            }
            
            const uploadedPath = req.file.path;
            // All databases stored in database/ folder
            const dbPath = path.join(__dirname, '..', 'database', 'users.sqlite');
            const autoMigrate = req.body.autoMigrate === 'true';
            
            // Validate SQLite file
            const sqlite3Test = require('sqlite3').verbose();
            const testDb = new sqlite3Test.Database(uploadedPath, sqlite3Test.OPEN_READONLY, (testErr) => {
                if (testErr) {
                    // Not a valid SQLite file - safe cleanup
                    try {
                        if (fs.existsSync(uploadedPath)) {
                            fs.unlinkSync(uploadedPath);
                        }
                    } catch (unlinkErr) {
                        console.error('[DB_UPLOAD] Warning: Could not delete invalid file:', unlinkErr.message);
                    }
                    
                    return res.status(400).json({
                        status: 400,
                        message: 'File is not a valid SQLite database',
                        data: null
                    });
                }
                
                // Check if users table exists
                testDb.get("SELECT name FROM sqlite_master WHERE type='table' AND name='users'", [], async (checkErr, row) => {
                    // Close database and wait for it to complete
                    await new Promise((resolve) => {
                        testDb.close((closeErr) => {
                            if (closeErr) {
                                console.error('[DB_UPLOAD] Error closing test database:', closeErr);
                            }
                            resolve();
                        });
                    });
                    
                    if (checkErr || !row) {
                        // Safe cleanup with try-catch
                        try {
                            if (fs.existsSync(uploadedPath)) {
                                fs.unlinkSync(uploadedPath);
                            }
                        } catch (unlinkErr) {
                            console.error('[DB_UPLOAD] Error cleaning up file:', unlinkErr);
                        }
                        
                        return res.status(400).json({
                            status: 400,
                            message: 'Database does not contain users table',
                            data: null
                        });
                    }
                    
                    // Create backup of current database
                    const timestamp = Date.now();
                    const backupsDir = path.join(__dirname, '..', 'backups');
                    
                    // Create backups directory if it doesn't exist
                    if (!fs.existsSync(backupsDir)) {
                        fs.mkdirSync(backupsDir, { recursive: true });
                    }
                    
                    const backupPath = path.join(backupsDir, `database.backup.${timestamp}.sqlite`);
                    
                    try {
                        // Backup current database
                        if (fs.existsSync(dbPath)) {
                            fs.copyFileSync(dbPath, backupPath);
                            console.log(`[DB_UPLOAD] Current database backed up to: ${path.basename(backupPath)}`);
                        }
                        
                        // Replace with uploaded database
                        fs.copyFileSync(uploadedPath, dbPath);
                        console.log(`[DB_UPLOAD] Database replaced with uploaded file: ${req.file.originalname}`);
                        
                        // Clean up uploaded file with retry logic
                        let cleanupSuccess = false;
                        for (let i = 0; i < 3; i++) {
                            try {
                                if (fs.existsSync(uploadedPath)) {
                                    fs.unlinkSync(uploadedPath);
                                    cleanupSuccess = true;
                                    break;
                                } else {
                                    cleanupSuccess = true;
                                    break;
                                }
                            } catch (unlinkErr) {
                                if (i < 2) {
                                    // Wait a bit before retry
                                    await new Promise(resolve => setTimeout(resolve, 100));
                                } else {
                                    console.error('[DB_UPLOAD] Warning: Could not delete temp file:', unlinkErr.message);
                                    // Don't fail the whole operation just because of cleanup
                                }
                            }
                        }
                        
                        let migrationResult = null;
                        
                        // Run migration if requested
                        if (autoMigrate) {
                            console.log('[DB_UPLOAD] Running automatic migration...');
                            
                            const scriptPath = path.join(__dirname, '..', 'tools', 'smart-migrate-database.js');
                            
                            if (fs.existsSync(scriptPath)) {
                                // Run migration using child_process
                                await new Promise((resolve, reject) => {
                                    exec(`node "${scriptPath}"`, { cwd: path.join(__dirname, '..') }, (migErr, stdout, stderr) => {
                                        if (migErr) {
                                            console.error('[DB_UPLOAD] Migration error:', migErr);
                                            console.error('[DB_UPLOAD] Stderr:', stderr);
                                            // Don't fail the whole request, just note the migration failed
                                            migrationResult = {
                                                success: false,
                                                error: migErr.message
                                            };
                                        } else {
                                            // Parse migration output
                                            const output = stdout.toString();
                                            let addedColumns = [];
                                            
                                            const columnMatches = output.match(/✅ Added column: (\w+)/g);
                                            if (columnMatches) {
                                                addedColumns = columnMatches.map(match => 
                                                    match.replace('✅ Added column: ', '').split(' ')[0]
                                                );
                                            }
                                            
                                            const upToDate = output.includes('Database schema is already up to date!');
                                            
                                            migrationResult = {
                                                success: true,
                                                addedColumns: addedColumns,
                                                upToDate: upToDate
                                            };
                                            
                                            console.log('[DB_UPLOAD] Migration completed successfully');
                                        }
                                        resolve();
                                    });
                                });
                            }
                        }
                        
                        // Reload users from new database WITHOUT RESTART
                        const { reloadUsersFromDatabase } = require('../lib/database-reload');
                        
                        try {
                            const reloadResult = await reloadUsersFromDatabase();
                            console.log('[DB_UPLOAD] Database reloaded in memory:', reloadResult.message);
                            
                            res.status(200).json({
                                status: 200,
                                message: 'Database uploaded and replaced successfully. No restart needed!',
                                data: {
                                    originalName: req.file.originalname,
                                    backupFile: path.basename(backupPath),
                                    migrationResult: migrationResult,
                                    reloadResult: reloadResult,
                                    restartRequired: false
                                }
                            });
                        } catch (reloadErr) {
                            console.error('[DB_UPLOAD] Error reloading database:', reloadErr);
                            
                            // Still return success but note that restart might be needed
                            res.status(200).json({
                                status: 200,
                                message: 'Database uploaded successfully. Please restart the application for changes to take effect.',
                                data: {
                                    originalName: req.file.originalname,
                                    backupFile: path.basename(backupPath),
                                    migrationResult: migrationResult,
                                    reloadError: reloadErr.message,
                                    restartRequired: true
                                }
                            });
                        }
                        
                    } catch (replaceErr) {
                        console.error('[DB_UPLOAD] Error replacing database:', replaceErr);
                        
                        // Safe cleanup with try-catch
                        try {
                            if (fs.existsSync(uploadedPath)) {
                                fs.unlinkSync(uploadedPath);
                            }
                        } catch (cleanupErr) {
                            console.error('[DB_UPLOAD] Warning: Could not delete temp file:', cleanupErr.message);
                            // Don't fail response just because of cleanup
                        }
                        
                        res.status(500).json({
                            status: 500,
                            message: 'Error replacing database: ' + replaceErr.message,
                            data: null
                        });
                    }
                });
            });
        });
        
    } catch (error) {
        console.error('[DB_UPLOAD] Error:', error);
        res.status(500).json({
            status: 500,
            message: 'Error processing upload: ' + error.message,
            data: null
        });
    }
});

// Reload database from disk to memory (no restart needed)
router.post('/api/database/reload', ensureAuthenticatedStaff, async (req, res) => {
    try {
        const { reloadUsersFromDatabase } = require('../lib/database-reload');
        
        console.log('[DB_RELOAD_API] Manual database reload requested');
        
        const result = await reloadUsersFromDatabase();
        
        res.status(200).json({
            status: 200,
            message: 'Database reloaded successfully from disk to memory',
            data: {
                oldCount: result.oldCount,
                newCount: result.newCount,
                oldColumns: result.oldColumns,
                newColumns: result.newColumns,
                message: result.message
            }
        });
        
    } catch (error) {
        console.error('[DB_RELOAD_API] Error:', error);
        res.status(500).json({
            status: 500,
            message: 'Error reloading database: ' + error.message,
            data: null
        });
    }
});

// Restore database from backup
router.post('/api/database/restore', ensureAuthenticatedStaff, (req, res) => {
    try {
        const { filename } = req.body;
        
        if (!filename) {
            return res.status(400).json({
                status: 400,
                message: "Filename is required",
                data: null
            });
        }
        
        // Security check - filename must match expected pattern
        if (!filename.match(/^database\.backup\.\d+\.sqlite$/)) {
            return res.status(400).json({
                status: 400,
                message: "Invalid backup filename",
                data: null
            });
        }
        
        const backupsDir = path.join(__dirname, '..', 'backups');
        const backupPath = path.join(backupsDir, filename);
        // All databases stored in database/ folder
        const dbPath = path.join(__dirname, '..', 'database', 'users.sqlite');
        
        if (!fs.existsSync(backupPath)) {
            return res.status(404).json({
                status: 404,
                message: "Backup file not found",
                data: null
            });
        }
        
        // Create a backup of current database before restoring
        const timestamp = Date.now();
        const currentBackupPath = path.join(backupsDir, `database.backup.${timestamp}.sqlite`);
        
        try {
            // Backup current database
            fs.copyFileSync(dbPath, currentBackupPath);
            console.log(`[DB_RESTORE] Current database backed up to: ${path.basename(currentBackupPath)}`);
            
            // Restore from backup
            fs.copyFileSync(backupPath, dbPath);
            console.log(`[DB_RESTORE] Database restored from: ${filename}`);
            
            // Reload users from restored database
            const { initializeDatabase, initializeConnectionWaypointsTable } = require('../lib/database');
            initDatabase((err) => {
                if (err) {
                    console.error('[DB_RESTORE] Error reloading database:', err);
                }
            });
            
            res.status(200).json({
                status: 200,
                message: "Database restored successfully",
                data: {
                    restoredFrom: filename,
                    currentBackup: path.basename(currentBackupPath)
                }
            });
            
        } catch (copyError) {
            console.error('[DB_RESTORE] Error during restore:', copyError);
            res.status(500).json({
                status: 500,
                message: "Error during restore: " + copyError.message,
                data: null
            });
        }
        
    } catch (error) {
        console.error('[DB_RESTORE] Error:', error);
        res.status(500).json({
            status: 500,
            message: "Error restoring database: " + error.message,
            data: null
        });
    }
});

// ============================================
// VOUCHER MANAGEMENT API ENDPOINTS
// ============================================

/**
 * GET /api/voucher
 * Get all voucher profiles for DataTable
 */
router.get('/api/voucher', ensureAuthenticatedStaff, (req, res) => {
    try {
        console.log('[VOUCHER_API] GET /api/voucher - Request received');
        console.log('[VOUCHER_API] User:', req.user ? req.user.username : 'No user');
        
        const voucherManager = require('../lib/voucher-manager');
        console.log('[VOUCHER_API] VoucherManager loaded:', typeof voucherManager);
        console.log('[VOUCHER_API] getVoucherProfiles function:', typeof voucherManager.getVoucherProfiles);
        
        if (typeof voucherManager.getVoucherProfiles !== 'function') {
            console.error('[VOUCHER_API] Error: getVoucherProfiles is not a function');
            return res.status(500).json({ error: 'getVoucherProfiles function not found' });
        }
        
        const vouchers = voucherManager.getVoucherProfiles();
        
        console.log('[VOUCHER_API] Vouchers loaded:', vouchers.length, 'items');
        
        if (!Array.isArray(vouchers)) {
            console.error('[VOUCHER_API] Error: vouchers is not an array:', typeof vouchers);
            return res.status(500).json({ error: 'Invalid voucher data format' });
        }
        
        if (vouchers.length === 0) {
            console.warn('[VOUCHER_API] Warning: No vouchers found in database');
            // Return empty array instead of error
            return res.json([]);
        }
        
        // Pastikan setiap voucher memiliki hargaReseller dan margin
        // DataTable mengharapkan array langsung, bukan object dengan property data
        const vouchersWithReseller = vouchers.map((voucher, index) => {
            try {
                const hargaJual = parseInt(voucher.hargavc || 0);
                const hargaReseller = parseInt(voucher.hargaReseller || 0);
                const margin = hargaJual - hargaReseller;
                
                const result = {
                    prof: voucher.prof || '',
                    namavc: voucher.namavc || '',
                    durasivc: voucher.durasivc || '',
                    hargavc: voucher.hargavc || '0',
                    hargaReseller: voucher.hargaReseller || (hargaReseller > 0 ? String(hargaReseller) : null),
                    margin: voucher.margin || (hargaReseller > 0 ? String(margin) : null)
                };
                
                return result;
            } catch (mapError) {
                console.error(`[VOUCHER_API] Error mapping voucher at index ${index}:`, mapError);
                return null;
            }
        }).filter(v => v !== null); // Filter out any null entries
        
        console.log('[VOUCHER_API] Processed vouchers:', vouchersWithReseller.length, 'items');
        console.log('[VOUCHER_API] Sample voucher:', JSON.stringify(vouchersWithReseller[0] || {}));
        
        // DataTable mengharapkan array langsung
        res.json(vouchersWithReseller);
    } catch (error) {
        console.error('[VOUCHER_API] Error getting vouchers:', error);
        console.error('[VOUCHER_API] Error stack:', error.stack);
        res.status(500).json({ 
            error: 'Failed to get vouchers',
            message: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

/**
 * POST /api/voucher
 * Create new voucher profile
 */
router.post('/api/voucher', ensureAuthenticatedStaff, async (req, res) => {
    try {
        const voucherManager = require('../lib/voucher-manager');
        const { prof, namavc, durasivc, hargavc, hargaReseller } = req.body;
        
        if (!prof || !namavc || !durasivc || !hargavc) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        
        const hargaJual = parseInt(hargavc);
        const hargaResellerValue = hargaReseller ? parseInt(hargaReseller) : null;
        const margin = hargaResellerValue ? hargaJual - hargaResellerValue : null;
        
        const result = voucherManager.addVoucherProfile({
            prof,
            namavc,
            durasivc,
            hargavc: String(hargaJual),
            hargaReseller: hargaResellerValue ? String(hargaResellerValue) : null,
            margin: margin ? String(margin) : null
        });
        
        if (result.success) {
            // Reload global.voucher
            const { loadJSON } = require('../lib/database');
            global.voucher = loadJSON('voucher.json');
            
            res.json({ success: true, message: 'Voucher created successfully' });
        } else {
            res.status(400).json({ error: result.message });
        }
    } catch (error) {
        console.error('[VOUCHER_API] Error creating voucher:', error);
        res.status(500).json({ error: 'Failed to create voucher' });
    }
});

/**
 * PUT /api/voucher/:id
 * Update voucher profile
 */
router.put('/api/voucher/:id', ensureAuthenticatedStaff, async (req, res) => {
    try {
        const voucherManager = require('../lib/voucher-manager');
        const { id } = req.params;
        const { prof, namavc, durasivc, hargavc, hargaReseller } = req.body;
        
        if (!namavc || !durasivc || !hargavc) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        
        const hargaJual = parseInt(hargavc);
        const hargaResellerValue = hargaReseller ? parseInt(hargaReseller) : null;
        const margin = hargaResellerValue ? hargaJual - hargaResellerValue : null;
        
        const result = voucherManager.updateVoucherProfile(id, {
            prof: prof || id,
            namavc,
            durasivc,
            hargavc: String(hargaJual),
            hargaReseller: hargaResellerValue ? String(hargaResellerValue) : null,
            margin: margin ? String(margin) : null
        });
        
        if (result.success) {
            // Reload global.voucher
            const { loadJSON } = require('../lib/database');
            global.voucher = loadJSON('voucher.json');
            
            res.json({ success: true, message: 'Voucher updated successfully' });
        } else {
            res.status(400).json({ error: result.message });
        }
    } catch (error) {
        console.error('[VOUCHER_API] Error updating voucher:', error);
        res.status(500).json({ error: 'Failed to update voucher' });
    }
});

/**
 * DELETE /api/voucher/:id
 * Delete voucher profile
 */
router.delete('/api/voucher/:id', ensureAuthenticatedStaff, async (req, res) => {
    try {
        const voucherManager = require('../lib/voucher-manager');
        const { id } = req.params;
        
        const result = voucherManager.deleteVoucherProfile(id);
        
        if (result.success) {
            // Reload global.voucher
            const { loadJSON } = require('../lib/database');
            global.voucher = loadJSON('voucher.json');
            
            res.json({ success: true, message: 'Voucher deleted successfully' });
        } else {
            res.status(400).json({ error: result.message });
        }
    } catch (error) {
        console.error('[VOUCHER_API] Error deleting voucher:', error);
        res.status(500).json({ error: 'Failed to delete voucher' });
    }
});

// ============================================
// AGENT VOUCHER MANAGEMENT API ENDPOINTS
// ============================================

/**
 * GET /api/admin/agent-voucher/stats
 * Get overall statistics for agent voucher system
 */
router.get('/api/admin/agent-voucher/stats', ensureAuthenticatedStaff, (req, res) => {
    try {
        const agents = agentManager.getAllAgents();
        
        let totalPurchases = 0;
        let totalSales = 0;
        let totalRevenue = 0;
        let totalProfit = 0;
        let totalStok = 0;
        
        const agentStats = [];
        
        agents.forEach(agent => {
            const inventory = agentVoucherManager.getAgentInventory(agent.id);
            const stats = agentVoucherManager.getAgentVoucherStats(agent.id);
            
            totalStok += inventory.totalStok;
            totalPurchases += stats.purchases.total;
            totalSales += stats.sales.total;
            totalRevenue += stats.sales.totalAmount;
            totalProfit += stats.sales.totalProfit;
            
            if (stats.sales.total > 0 || stats.purchases.total > 0) {
                agentStats.push({
                    agentId: agent.id,
                    agentName: agent.name,
                    totalStok: inventory.totalStok,
                    totalPurchases: stats.purchases.total,
                    totalSales: stats.sales.total,
                    totalRevenue: stats.sales.totalAmount,
                    totalProfit: stats.sales.totalProfit
                });
            }
        });
        
        // Sort by profit (descending)
        agentStats.sort((a, b) => b.totalProfit - a.totalProfit);
        
        res.json({
            status: 200,
            message: 'Statistics retrieved successfully',
            data: {
                overall: {
                    totalAgents: agentStats.length,
                    totalStok: totalStok,
                    totalPurchases: totalPurchases,
                    totalSales: totalSales,
                    totalRevenue: totalRevenue,
                    totalProfit: totalProfit
                },
                topAgents: agentStats.slice(0, 10) // Top 10 agents
            }
        });
        
    } catch (error) {
        console.error('[AGENT_VOUCHER_STATS] Error:', error);
        res.status(500).json({
            status: 500,
            message: 'Error retrieving statistics: ' + error.message,
            data: null
        });
    }
});

/**
 * GET /api/admin/agent-voucher/inventory
 * Get all agent inventories
 */
router.get('/api/admin/agent-voucher/inventory', ensureAuthenticatedStaff, (req, res) => {
    try {
        const agents = agentManager.getAllAgents();
        
        const inventories = agents.map(agent => {
            const inventory = agentVoucherManager.getAgentInventory(agent.id);
            return {
                agentId: agent.id,
                agentName: agent.name,
                agentPhone: agent.phone,
                agentArea: agent.area,
                inventory: inventory
            };
        }).filter(item => item.inventory.totalStok > 0 || item.inventory.totalTerjual > 0);
        
        res.json({
            status: 200,
            message: 'Inventories retrieved successfully',
            data: inventories
        });
        
    } catch (error) {
        console.error('[AGENT_VOUCHER_INVENTORY] Error:', error);
        res.status(500).json({
            status: 500,
            message: 'Error retrieving inventories: ' + error.message,
            data: null
        });
    }
});

/**
 * GET /api/admin/agent-voucher/agent/:id/inventory
 * Get specific agent inventory
 */
router.get('/api/admin/agent-voucher/agent/:id/inventory', ensureAuthenticatedStaff, (req, res) => {
    try {
        const agentId = req.params.id;
        const agent = agentManager.getAgentById(agentId);
        
        if (!agent) {
            return res.status(404).json({
                status: 404,
                message: 'Agent not found',
                data: null
            });
        }
        
        const inventory = agentVoucherManager.getAgentInventory(agentId);
        const stats = agentVoucherManager.getAgentVoucherStats(agentId);
        
        res.json({
            status: 200,
            message: 'Inventory retrieved successfully',
            data: {
                agent: {
                    id: agent.id,
                    name: agent.name,
                    phone: agent.phone,
                    area: agent.area
                },
                inventory: inventory,
                stats: stats
            }
        });
        
    } catch (error) {
        console.error('[AGENT_VOUCHER_AGENT_INVENTORY] Error:', error);
        res.status(500).json({
            status: 500,
            message: 'Error retrieving inventory: ' + error.message,
            data: null
        });
    }
});

/**
 * GET /api/admin/agent-voucher/agent/:id/purchases
 * Get agent purchase history
 */
router.get('/api/admin/agent-voucher/agent/:id/purchases', ensureAuthenticatedStaff, (req, res) => {
    try {
        const agentId = req.params.id;
        const limit = parseInt(req.query.limit) || 50;
        
        const agent = agentManager.getAgentById(agentId);
        
        if (!agent) {
            return res.status(404).json({
                status: 404,
                message: 'Agent not found',
                data: null
            });
        }
        
        const purchases = agentVoucherManager.getPurchaseHistory(agentId, limit);
        
        res.json({
            status: 200,
            message: 'Purchase history retrieved successfully',
            data: {
                agent: {
                    id: agent.id,
                    name: agent.name
                },
                purchases: purchases
            }
        });
        
    } catch (error) {
        console.error('[AGENT_VOUCHER_AGENT_PURCHASES] Error:', error);
        res.status(500).json({
            status: 500,
            message: 'Error retrieving purchase history: ' + error.message,
            data: null
        });
    }
});

/**
 * GET /api/admin/agent-voucher/agent/:id/sales
 * Get agent sales history
 */
router.get('/api/admin/agent-voucher/agent/:id/sales', ensureAuthenticatedStaff, (req, res) => {
    try {
        const agentId = req.params.id;
        const limit = parseInt(req.query.limit) || 50;
        
        const agent = agentManager.getAgentById(agentId);
        
        if (!agent) {
            return res.status(404).json({
                status: 404,
                message: 'Agent not found',
                data: null
            });
        }
        
        const sales = agentVoucherManager.getSalesHistory(agentId, limit);
        
        res.json({
            status: 200,
            message: 'Sales history retrieved successfully',
            data: {
                agent: {
                    id: agent.id,
                    name: agent.name
                },
                sales: sales
            }
        });
        
    } catch (error) {
        console.error('[AGENT_VOUCHER_AGENT_SALES] Error:', error);
        res.status(500).json({
            status: 500,
            message: 'Error retrieving sales history: ' + error.message,
            data: null
        });
    }
});

/**
 * GET /api/admin/agent-voucher/top-agents
 * Get top agents by profit or volume
 */
router.get('/api/admin/agent-voucher/top-agents', ensureAuthenticatedStaff, (req, res) => {
    try {
        const sortBy = req.query.sortBy || 'profit'; // 'profit' or 'volume'
        const limit = parseInt(req.query.limit) || 10;
        
        const agents = agentManager.getAllAgents();
        
        const agentStats = agents.map(agent => {
            const stats = agentVoucherManager.getAgentVoucherStats(agent.id);
            return {
                agentId: agent.id,
                agentName: agent.name,
                agentArea: agent.area,
                totalStok: stats.inventory.totalStok,
                totalPurchases: stats.purchases.total,
                totalSales: stats.sales.total,
                totalRevenue: stats.sales.totalAmount,
                totalProfit: stats.sales.totalProfit
            };
        }).filter(stat => stat.totalSales > 0 || stat.totalPurchases > 0);
        
        // Sort by profit or volume
        if (sortBy === 'profit') {
            agentStats.sort((a, b) => b.totalProfit - a.totalProfit);
        } else {
            agentStats.sort((a, b) => b.totalSales - a.totalSales);
        }
        
        res.json({
            status: 200,
            message: 'Top agents retrieved successfully',
            data: {
                sortBy: sortBy,
                agents: agentStats.slice(0, limit)
            }
        });
        
    } catch (error) {
        console.error('[AGENT_VOUCHER_TOP_AGENTS] Error:', error);
        res.status(500).json({
            status: 500,
            message: 'Error retrieving top agents: ' + error.message,
            data: null
        });
    }
});

// =====================================================
// TELEGRAM BACKUP API ENDPOINTS
// =====================================================

const { testTelegramConnection, performDatabaseBackup, getTelegramConfig } = require('../lib/telegram-backup');

/**
 * GET /api/telegram-backup/config
 * Get Telegram backup configuration
 */
router.get('/api/telegram-backup/config', ensureAuthenticatedStaff, (req, res) => {
    if (!req.user || !['admin', 'owner', 'superadmin'].includes(req.user.role)) {
        return res.status(403).json({ status: 403, message: "Akses ditolak." });
    }

    try {
        const mainConfigPath = path.join(__dirname, '..', 'config.json');
        const cronConfigPath = path.join(__dirname, '..', 'database', 'cron.json');
        
        const mainConfig = JSON.parse(fs.readFileSync(mainConfigPath, 'utf8'));
        const cronConfig = JSON.parse(fs.readFileSync(cronConfigPath, 'utf8'));
        
        res.json({
            status: 200,
            message: 'Telegram backup config retrieved',
            data: {
                botToken: mainConfig.telegramBackup?.botToken || '',
                chatId: mainConfig.telegramBackup?.chatId || '',
                enabled: mainConfig.telegramBackup?.enabled === true,
                schedule: cronConfig.schedule_telegram_backup || '0 4 * * *',
                status_telegram_backup: cronConfig.status_telegram_backup === true
            }
        });
    } catch (error) {
        console.error('[TELEGRAM_BACKUP_CONFIG_GET] Error:', error);
        res.status(500).json({
            status: 500,
            message: 'Gagal mengambil konfigurasi Telegram backup',
            error: error.message
        });
    }
});

/**
 * POST /api/telegram-backup/config
 * Save Telegram backup configuration
 */
router.post('/api/telegram-backup/config', ensureAuthenticatedStaff, async (req, res) => {
    if (!req.user || !['admin', 'owner', 'superadmin'].includes(req.user.role)) {
        return res.status(403).json({ status: 403, message: "Akses ditolak." });
    }

    try {
        const { botToken, chatId, enabled, schedule, status_telegram_backup } = req.body;
        
        const mainConfigPath = path.join(__dirname, '..', 'config.json');
        const cronConfigPath = path.join(__dirname, '..', 'database', 'cron.json');
        
        // Load current configs
        const mainConfig = JSON.parse(fs.readFileSync(mainConfigPath, 'utf8'));
        const cronConfig = JSON.parse(fs.readFileSync(cronConfigPath, 'utf8'));
        
        // Update Telegram backup config in main config
        mainConfig.telegramBackup = {
            botToken: botToken || '',
            chatId: chatId || '',
            enabled: enabled === true || enabled === 'true'
        };
        
        // Update cron config
        if (schedule) {
            // Validate cron expression
            if (!schedule.startsWith('#') && !isValidCron(schedule)) {
                return res.status(400).json({
                    status: 400,
                    message: 'Format jadwal cron tidak valid. Gunakan format seperti "0 4 * * *" untuk jam 4 pagi.'
                });
            }
            cronConfig.schedule_telegram_backup = schedule;
        }
        cronConfig.status_telegram_backup = status_telegram_backup === true || status_telegram_backup === 'true';
        
        // Save configs
        fs.writeFileSync(mainConfigPath, JSON.stringify(mainConfig, null, 4), 'utf8');
        fs.writeFileSync(cronConfigPath, JSON.stringify(cronConfig, null, 2), 'utf8');
        
        // Update global config
        global.config = mainConfig;
        global.cronConfig = cronConfig;
        
        // Re-initialize cron tasks
        initializeAllCronTasks();
        
        // Log activity
        try {
            await logActivity({
                userId: req.user.id,
                username: req.user.username,
                role: req.user.role,
                actionType: 'UPDATE',
                resourceType: 'config',
                resourceId: 'telegram-backup',
                resourceName: 'Telegram Backup Configuration',
                description: `Updated Telegram backup configuration (enabled: ${mainConfig.telegramBackup.enabled}, schedule: ${cronConfig.schedule_telegram_backup})`,
                ipAddress: req.ip || req.connection.remoteAddress,
                userAgent: req.headers['user-agent']
            });
        } catch (logErr) {
            console.error('[ACTIVITY_LOG_ERROR] Failed to log telegram config change:', logErr);
        }
        
        res.json({
            status: 200,
            message: 'Konfigurasi Telegram backup berhasil disimpan'
        });
        
    } catch (error) {
        console.error('[TELEGRAM_BACKUP_CONFIG_SAVE] Error:', error);
        res.status(500).json({
            status: 500,
            message: 'Gagal menyimpan konfigurasi Telegram backup',
            error: error.message
        });
    }
});

/**
 * POST /api/telegram-backup/test
 * Test Telegram connection
 */
router.post('/api/telegram-backup/test', ensureAuthenticatedStaff, async (req, res) => {
    if (!req.user || !['admin', 'owner', 'superadmin'].includes(req.user.role)) {
        return res.status(403).json({ status: 403, message: "Akses ditolak." });
    }

    try {
        const { botToken, chatId } = req.body;
        
        if (!botToken || !chatId) {
            return res.status(400).json({
                status: 400,
                message: 'Bot Token dan Chat ID harus diisi'
            });
        }
        
        const result = await testTelegramConnection(botToken, chatId);
        
        res.json({
            status: 200,
            message: result.message
        });
        
    } catch (error) {
        console.error('[TELEGRAM_BACKUP_TEST] Error:', error);
        res.status(400).json({
            status: 400,
            message: error.message
        });
    }
});

/**
 * POST /api/telegram-backup/run
 * Manually trigger database backup to Telegram
 */
router.post('/api/telegram-backup/run', ensureAuthenticatedStaff, async (req, res) => {
    if (!req.user || !['admin', 'owner', 'superadmin'].includes(req.user.role)) {
        return res.status(403).json({ status: 403, message: "Akses ditolak." });
    }

    try {
        const config = getTelegramConfig();
        
        if (!config.botToken || !config.chatId) {
            return res.status(400).json({
                status: 400,
                message: 'Konfigurasi Telegram belum lengkap. Silakan isi Bot Token dan Chat ID terlebih dahulu.'
            });
        }
        
        console.log(`[TELEGRAM_BACKUP] Manual backup triggered by ${req.user.username}`);
        
        // Run backup (don't wait for completion to avoid timeout)
        performDatabaseBackup().then(result => {
            console.log('[TELEGRAM_BACKUP] Manual backup completed:', result);
        }).catch(err => {
            console.error('[TELEGRAM_BACKUP] Manual backup error:', err);
        });
        
        // Log activity
        try {
            await logActivity({
                userId: req.user.id,
                username: req.user.username,
                role: req.user.role,
                actionType: 'CREATE',
                resourceType: 'backup',
                resourceId: 'telegram-backup',
                resourceName: 'Manual Telegram Backup',
                description: 'Triggered manual database backup to Telegram',
                ipAddress: req.ip || req.connection.remoteAddress,
                userAgent: req.headers['user-agent']
            });
        } catch (logErr) {
            console.error('[ACTIVITY_LOG_ERROR] Failed to log manual backup:', logErr);
        }
        
        res.json({
            status: 200,
            message: 'Backup sedang diproses. File akan dikirim ke Telegram dalam beberapa saat.'
        });
        
    } catch (error) {
        console.error('[TELEGRAM_BACKUP_RUN] Error:', error);
        res.status(500).json({
            status: 500,
            message: 'Gagal menjalankan backup: ' + error.message
        });
    }
});

module.exports = router;