const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const axios = require('axios');
const { hashPassword, comparePassword } = require('../lib/password');
const { updatePPPoEProfile, deleteActivePPPoEUser, addPPPoEUser, checkPPPoEUserExists } = require('../lib/mikrotik');
const { getProfileBySubscription } = require('../lib/myfunc');
const { handlePaidStatusChange } = require('../lib/approval-logic');
const { validatePhoneNumbers, normalizePhone, getSupportedCountries } = require('../lib/phone-validator-international');
const { renderTemplate, templatesCache } = require('../lib/templating');
const { 
    savePackage, 
    saveAccounts, 
    loadJSON, 
    saveJSON,
    updateOdpPortUsage,
    updateOdcPortUsage,
    saveNetworkAssets
} = require('../lib/database');
const { parseGoogleMapsLink, generateRandomPassword, validateCoordinates } = require('../lib/psb-helper');
const { sendPSBPhase1Notification, sendPSBPhase2Notification, sendPSBTeknisiMeluncurNotification, sendPSBInstallationCompleteNotification } = require('../lib/psb-notification');
const { logActivity } = require('../lib/activity-logger');
const { insertPSBRecord, updatePSBRecord, getPSBRecord, getPSBRecordsByStatus, movePSBToUsers, getNextAvailablePSBId, getNextAvailableUserId } = require('../lib/psb-database');
const { logWifiChange } = require('../lib/wifi-logger');
const crypto = require('crypto');
const { rateLimit } = require('../lib/security');
const { withLock } = require('../lib/request-lock');

const router = express.Router();

// Helper function to extract value from device using parameter configuration
function extractParameterValue(device, parameterType) {
    try {
        const parameters = loadJSON('genieacs_parameters.json') || [];
        const paramConfig = parameters.find(p => p.type === parameterType);
        
        if (!paramConfig || !paramConfig.paths || paramConfig.paths.length === 0) {
            return null;
        }
        
        // Helper to get nested value
        const getNestedValue = (obj, path) => {
            const parts = path.split('.');
            let current = obj;
            for (const part of parts) {
                if (current && typeof current === 'object') {
                    if (current.hasOwnProperty(part)) {
                        current = current[part];
                    } else {
                        // Try with different casing
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
        };
        
        // Try each path until we find a value
        for (const path of paramConfig.paths) {
            const pathValue = getNestedValue(device, path);
            if (pathValue !== undefined && pathValue !== null) {
                // Handle _value wrapper
                if (typeof pathValue === 'object' && pathValue.hasOwnProperty('_value')) {
                    return pathValue._value;
                } 
                // Handle direct value (string, number, etc.)
                else if (typeof pathValue !== 'object' || Array.isArray(pathValue)) {
                    return pathValue;
                }
                // Handle object that might have value property
                else if (pathValue.value !== undefined) {
                    return pathValue.value;
                }
            }
        }
        
        return null;
    } catch (error) {
        console.error(`[extractParameterValue] Error extracting ${parameterType}:`, error);
        return null;
    }
}

// Middleware to ensure user is authenticated
function ensureAuthenticated(req, res, next) {
    if (!req.user) {
        return res.status(401).json({ status: 401, message: "Unauthorized" });
    }
    next();
}

// Middleware for admin-only routes
function ensureAdmin(req, res, next) {
    if (!req.user || !['admin', 'owner', 'superadmin'].includes(req.user.role)) {
        return res.status(403).json({ status: 403, message: "Akses ditolak." });
    }
    next();
}

// POST /api/action - Update PPPoE profile
router.post('/action', ensureAuthenticated, async (req, res) => {
    const { action, username, newProfile } = req.body;
    switch (action) {
        case "update-pppoe-profile": {
            if (!username || !newProfile) {
                return res.status(400).json({ message: "Username and new profile are required." });
            }
            try {
                const result = await updatePPPoEProfile(username, newProfile);
                console.log(`Updated PPPoE profile for user ${username} to ${newProfile}`);
                res.json({ message: `PPPoE profile updated for ${username} to ${newProfile}`, result });
            } catch (error) {
                console.error("Failed to update PPPoE profile:", error);
                res.status(500).json({ message: "Failed to update PPPoE profile" });
            }
            break;
        }
        default:
            res.status(400).json({ message: "Invalid action specified." });
    }
});

// GET /send/:id/:text - Send WhatsApp message
router.get('/send/:id/:text', async (req, res) => {
    if (!global.raf) return res.send({ status: 500, message: "the server is not connected to WhatsApp" });
    try {
        if (req.params.id.endsWith("@g.us")) {
            let groups = Object.entries(await global.raf.groupFetchAllParticipating()).slice(0).map(entry => entry[1]);
            if (!groups.find(v => v.id === req.params.id)) return res.send({ status: 400, message: "Invalid group id" });
        } else if (req.params.id.endsWith("@c.us") || req.params.id.endsWith("@s.whatsapp.net")) {
            if (!(await global.raf.onWhatsApp(req.params.id))[0]) return res.send({ status: 400, message: "Invalid contact id" });
        } else return res.send({ status: 400, message: "Invalid id" });
        // PENTING: Cek connection state dan gunakan error handling sesuai rules untuk command response
        if (global.whatsappConnectionState === 'open' && global.raf && global.raf.sendMessage) {
            try {
                const send = await global.raf.sendMessage(req.params.id, { text: req.params.text }, { skipDuplicateCheck: true });
                return res.send({ status: 200, message: `Success send message with text ${req.params.text}`, result: send });
            } catch (error) {
                console.error('[SEND_MESSAGE_ERROR]', {
                    recipientId: req.params.id,
                    error: error.message
                });
                return res.send({ status: 500, message: `Failed to send message: ${error.message}` });
            }
        } else {
            console.warn('[SEND_MESSAGE_SKIP] WhatsApp not connected, skipping send to', req.params.id);
            return res.send({ status: 503, message: 'WhatsApp connection not available' });
        }
    } catch (e) {
        return res.send({ status: 500, message: e });
    }
});

// GET /api/users - Get all users
router.get('/users', ensureAuthenticated, (req, res) => {
    try {
        // IMPORTANT: Verify data integrity - check if global.users matches database
        // If there's a mismatch, reload from database
        const sqlite3 = require('sqlite3').verbose();
        const { getDatabasePath } = require('../lib/env-config');
        const dbPath = getDatabasePath('users.sqlite');
        
        // Quick verification: Count users in database vs memory
        const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY);
        db.get("SELECT COUNT(*) as count FROM users", [], (err, row) => {
            if (err) {
                console.error('[GET_USERS] Error verifying database count:', err.message);
                // Continue with global.users even if verification fails
                db.close();
                return res.json({ 
                    status: 200, 
                    message: "Data pengguna berhasil dimuat",
                    data: global.users || [],
                    warning: "Database verification failed"
                });
            }
            
            const dbCount = row ? row.count : 0;
            const memoryCount = global.users ? global.users.length : 0;
            
            if (dbCount !== memoryCount) {
                console.warn(`[GET_USERS] WARNING: Data mismatch! Database has ${dbCount} users but memory has ${memoryCount} users`);
                console.warn(`[GET_USERS] This indicates data synchronization issue. Consider reloading users from database.`);
                
                // Still return global.users but log warning
                db.close();
                return res.json({ 
                    status: 200, 
                    message: "Data pengguna berhasil dimuat",
                    data: global.users || [],
                    warning: `Data mismatch detected: Database has ${dbCount} users, memory has ${memoryCount} users`,
                    databaseCount: dbCount,
                    memoryCount: memoryCount
                });
            }
            
            db.close();
            
            // Data matches, return normally
            return res.json({ 
                status: 200, 
                message: "Data pengguna berhasil dimuat",
                data: global.users || [],
                count: memoryCount
            });
        });
    } catch (error) {
        console.error('[GET_USERS_ERROR]', error);
        return res.status(500).json({ 
            status: 500, 
            message: "Terjadi kesalahan saat memuat data pengguna",
            error: error.message 
        });
    }
});

// POST /api/users/update - Update user payment status
router.post('/users/update', ensureAdmin, async (req, res) => {
    const { id, paid } = req.body;
    
    if (!id) {
        return res.status(400).json({
            status: 400,
            message: "User ID is required"
        });
    }
    
    if (typeof paid !== 'boolean') {
        return res.status(400).json({
            status: 400,
            message: "paid must be a boolean value"
        });
    }
    
    try {
        // Find the user
        const user = global.users.find(u => String(u.id) === String(id));
        if (!user) {
            return res.status(404).json({
                status: 404,
                message: "User not found"
            });
        }
        
        // Update in database
        const updateQuery = `UPDATE users SET paid = ? WHERE id = ?`;
        await new Promise((resolve, reject) => {
            global.db.run(updateQuery, [paid ? 1 : 0, id], function(err) {
                if (err) {
                    console.error('[DB_UPDATE_ERROR]', err);
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
        
        // Update in memory
        user.paid = paid;
        
        // Handle paid status change logic
        if (paid === true) {
            await handlePaidStatusChange(user, {
                paidDate: new Date().toISOString(),
                method: 'TRANSFER_BANK', // Admin creating paid user = bank transfer
                approvedBy: req.user.username,
                notes: 'User baru dengan status lunas'
            });
        }
        
        console.log(`[USER_UPDATE] User ${user.name} (ID: ${id}) payment status updated to ${paid}`);
        
        return res.json({ 
            status: 200, 
            message: "Status pembayaran berhasil diperbarui",
            data: user
        });
        
    } catch (error) {
        console.error('[USER_UPDATE_ERROR]', error);
        return res.status(500).json({ 
            status: 500, 
            message: "Terjadi kesalahan saat memperbarui data",
            error: error.message 
        });
    }
});

// POST /api/users - Create or update user
router.post('/users', ensureAdmin, async (req, res) => {
    try {
        const userData = req.body;
        const isEdit = userData.id && userData.id !== '';
        
        if (isEdit) {
            // Update existing user
            const userIndex = global.users.findIndex(u => u.id === userData.id);
            if (userIndex === -1) {
                return res.status(404).json({ status: 404, message: 'User tidak ditemukan' });
            }
            
            const existingUser = global.users[userIndex];
            
            // PENTING: Jika bulk kosong atau tidak ada, set default dari config (atau SSID 1 sebagai fallback)
            let bulkData = userData.bulk;
            if (!bulkData || !Array.isArray(bulkData) || bulkData.length === 0) {
                // Ambil default SSID dari config, fallback ke '1' jika tidak ada
                const defaultSSID = (global.config && global.config.defaultBulkSSID) 
                    ? String(global.config.defaultBulkSSID) 
                    : '1';
                bulkData = [defaultSSID];
                console.log(`[UPDATE_USER] User ${userData.id} tidak memiliki bulk, otomatis set ke SSID ${defaultSSID} (dari config)`);
            }
            
            // Update user data
            const updatedUser = {
                ...existingUser,
                ...userData,
                bulk: bulkData,
                updated_at: new Date().toISOString()
            };
            
            // Handle paid status change
            if (existingUser.paid !== updatedUser.paid && updatedUser.paid === true) {
                await handlePaidStatusChange(updatedUser, {
                    paidDate: new Date().toISOString(),
                    method: userData.payment_method || 'TRANSFER_BANK', // Default to bank transfer for admin updates
                    approvedBy: req.user.username,
                    notes: 'Status pembayaran diperbarui'
                });
            }
            
            // Store old values for activity log
            const oldUserData = {
                name: existingUser.name,
                phone_number: existingUser.phone_number,
                subscription: existingUser.subscription,
                paid: existingUser.paid,
                pppoe_username: existingUser.pppoe_username
            };
            
            // Update in memory
            global.users[userIndex] = updatedUser;
            
            // Log activity
            try {
                await logActivity({
                    userId: req.user.id,
                    username: req.user.username,
                    role: req.user.role,
                    actionType: 'UPDATE',
                    resourceType: 'user',
                    resourceId: updatedUser.id.toString(),
                    resourceName: updatedUser.name,
                    description: `Updated user ${updatedUser.name}`,
                    oldValue: oldUserData,
                    newValue: {
                        name: updatedUser.name,
                        phone_number: updatedUser.phone_number,
                        subscription: updatedUser.subscription,
                        paid: updatedUser.paid,
                        pppoe_username: updatedUser.pppoe_username
                    },
                    ipAddress: req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'],
                    userAgent: req.headers['user-agent']
                });
            } catch (logErr) {
                console.error('[ACTIVITY_LOG_ERROR] Failed to log user update:', logErr);
            }
            
            // Update in database
            const updateQuery = `
                UPDATE users SET 
                    name = ?, phone_number = ?, subscription = ?, device_id = ?, 
                    paid = ?, pppoe_username = ?, pppoe_password = ?,
                    connected_odp_id = ?, send_invoice = ?,
                    is_corporate = ?, corporate_name = ?, corporate_address = ?,
                    corporate_npwp = ?, corporate_pic_name = ?, 
                    corporate_pic_phone = ?, corporate_pic_email = ?,
                    bulk = ?
                WHERE id = ?
            `;
            
            await new Promise((resolve, reject) => {
                global.db.run(updateQuery, [
                    updatedUser.name,
                    updatedUser.phone_number || updatedUser.phone,
                    updatedUser.subscription || updatedUser.package,
                    updatedUser.device_id,
                    updatedUser.paid ? 1 : 0,
                    updatedUser.pppoe_username,
                    updatedUser.pppoe_password,
                    updatedUser.connected_odp_id || updatedUser.odp_id || null,
                    updatedUser.send_invoice ? 1 : 0,
                    updatedUser.is_corporate ? 1 : 0,
                    updatedUser.corporate_name || null,
                    updatedUser.corporate_address || null,
                    updatedUser.corporate_npwp || null,
                    updatedUser.corporate_pic_name || null,
                    updatedUser.corporate_pic_phone || null,
                    updatedUser.corporate_pic_email || null,
                    JSON.stringify(updatedUser.bulk || ['1']),
                    updatedUser.id
                ], function(err) {
                    if (err) reject(err);
                    else resolve();
                });
            });
            
            // Update PPPoE if needed
            if (updatedUser.pppoe_username && (updatedUser.subscription || updatedUser.package)) {
                const profile = getProfileBySubscription(updatedUser.subscription || updatedUser.package);
                if (profile) {
                    await updatePPPoEProfile(updatedUser.pppoe_username, profile);
                }
            }
            
            return res.json({
                status: 200,
                message: 'User berhasil diperbarui',
                data: updatedUser
            });
            
        } else {
            // Create new user with sequential ID
            let newUserId;
            try {
                newUserId = await getNextAvailableUserId();
            } catch (err) {
                console.error('[GET_NEXT_ID_ERROR]', err);
                return res.status(500).json({
                    status: 500,
                    message: 'Gagal mendapatkan ID untuk user baru',
                    error: err.message
                });
            }
            
            // Validate phone numbers before creating user (support international)
            // Phone number is now OPTIONAL
            const phoneToValidate = userData.phone_number || userData.phone;
            if (phoneToValidate && phoneToValidate.trim() !== '') {
                const defaultCountry = userData.country || 'ID'; // Default to Indonesia
                const validationResult = await validatePhoneNumbers(global.db, phoneToValidate, null, defaultCountry);
                
                if (!validationResult.valid) {
                    return res.status(400).json({
                        status: 400,
                        message: validationResult.message,
                        conflictUser: validationResult.conflictUser || null
                    });
                }
            }
            
            // Final safety check: ensure ID is not already in use
            const idExists = global.users.some(u => parseInt(u.id) === parseInt(newUserId));
            if (idExists) {
                console.error(`[CREATE_USER_ERROR] ID ${newUserId} already exists!`);
                return res.status(500).json({
                    status: 500,
                    message: 'Terjadi kesalahan dalam pembuatan ID. Silakan coba lagi.',
                    error: 'ID conflict detected'
                });
            }
            
            // Generate username and password if not provided
            let finalUsername = userData.username;
            let finalPassword = userData.password;
            let plainTextPassword = '';
            
            if (!finalUsername || finalUsername.trim() === '') {
                // Generate username from name
                const nameParts = (userData.name || '').toLowerCase().split(' ').filter(Boolean);
                let baseUsername = nameParts[0] || 'user';
                if (nameParts.length > 1) {
                    baseUsername += nameParts[1].charAt(0);
                }
                let counter = 1;
                finalUsername = baseUsername;
                // Check for conflicts in both database and memory
                while (global.users.some(u => u.username === finalUsername && String(u.id) !== String(newUserId))) {
                    counter++;
                    finalUsername = `${baseUsername}${counter}`;
                }
            }
            
            if (!finalPassword || finalPassword.trim() === '') {
                // Generate random password
                const { generateRandomPassword } = require('../lib/psb-helper');
                plainTextPassword = generateRandomPassword();
                finalPassword = await hashPassword(plainTextPassword);
            } else {
                plainTextPassword = finalPassword;
                finalPassword = await hashPassword(finalPassword);
            }
            
            // PENTING: Jika bulk kosong atau tidak ada, set default dari config (atau SSID 1 sebagai fallback)
            let bulkData = userData.bulk;
            if (!bulkData || !Array.isArray(bulkData) || bulkData.length === 0) {
                // Ambil default SSID dari config, fallback ke '1' jika tidak ada
                const defaultSSID = (global.config && global.config.defaultBulkSSID) 
                    ? String(global.config.defaultBulkSSID) 
                    : '1';
                bulkData = [defaultSSID];
                console.log(`[CREATE_USER] User baru tidak memiliki bulk, otomatis set ke SSID ${defaultSSID} (dari config)`);
            }
            
            const newUser = {
                id: newUserId,
                ...userData,
                // Map frontend fields to database fields
                phone_number: userData.phone_number || userData.phone,
                subscription: userData.subscription || userData.package,
                connected_odp_id: userData.connected_odp_id || userData.odp_id,
                paid: userData.paid || false,
                send_invoice: userData.send_invoice || false,
                is_corporate: userData.is_corporate || false,
                bulk: bulkData,
                username: finalUsername,
                password: finalPassword,
                created_at: new Date().toISOString()
            };
            
            // Add to memory
            global.users.push(newUser);
            
            // Log activity
            try {
                await logActivity({
                    userId: req.user.id,
                    username: req.user.username,
                    role: req.user.role,
                    actionType: 'CREATE',
                    resourceType: 'user',
                    resourceId: newUser.id.toString(),
                    resourceName: newUser.name,
                    description: `Created new user ${newUser.name}`,
                    oldValue: null,
                    newValue: {
                        name: newUser.name,
                        phone_number: newUser.phone_number,
                        subscription: newUser.subscription,
                        paid: newUser.paid,
                        pppoe_username: newUser.pppoe_username
                    },
                    ipAddress: req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'],
                    userAgent: req.headers['user-agent']
                });
            } catch (logErr) {
                console.error('[ACTIVITY_LOG_ERROR] Failed to log user create:', logErr);
            }
            
            // Insert into database
            const insertQuery = `
                INSERT INTO users (
                    id, name, phone_number, subscription, device_id, paid, 
                    pppoe_username, pppoe_password, connected_odp_id, 
                    send_invoice, is_corporate, corporate_name, 
                    corporate_address, corporate_npwp, corporate_pic_name,
                    corporate_pic_phone, corporate_pic_email, bulk
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;
            
            await new Promise((resolve, reject) => {
                global.db.run(insertQuery, [
                    newUser.id,
                    newUser.name,
                    newUser.phone_number || newUser.phone,
                    newUser.subscription || newUser.package,
                    newUser.device_id,
                    newUser.paid ? 1 : 0,
                    newUser.pppoe_username,
                    newUser.pppoe_password,
                    newUser.connected_odp_id || newUser.odp_id || null,
                    newUser.send_invoice ? 1 : 0,
                    newUser.is_corporate ? 1 : 0,
                    newUser.corporate_name || null,
                    newUser.corporate_address || null,
                    newUser.corporate_npwp || null,
                    newUser.corporate_pic_name || null,
                    newUser.corporate_pic_phone || null,
                    newUser.corporate_pic_email || null,
                    JSON.stringify(newUser.bulk || ['1'])
                ], function(err) {
                    if (err) reject(err);
                    else resolve();
                });
            });
            
            // Add PPPoE user if needed - HANYA jika checkbox "add_to_mikrotik" dicentang
            const addToMikrotik = userData.add_to_mikrotik === true || userData.add_to_mikrotik === 'true';
            if (addToMikrotik && newUser.pppoe_username && newUser.pppoe_password && newUser.subscription) {
                const profile = getProfileBySubscription(newUser.subscription);
                if (profile) {
                    try {
                        await addPPPoEUser(newUser.pppoe_username, newUser.pppoe_password, profile);
                        // PPPoE user added to MikroTik
                    } catch (mikrotikError) {
                        // Jika error karena user sudah ada, log warning tapi jangan gagalkan proses
                        if (mikrotikError.message && mikrotikError.message.includes('sudah ada')) {
                            console.warn(`[USER_CREATE_WARNING] PPPoE user ${newUser.pppoe_username} sudah ada di MikroTik. User tetap ditambahkan ke database.`);
                        } else {
                            // Untuk error lain, throw error untuk mencegah inconsistent state
                            throw new Error(`Gagal menambahkan user ke MikroTik: ${mikrotikError.message}`);
                        }
                    }
                } else {
                    console.warn(`[USER_CREATE_WARNING] Profile tidak ditemukan untuk subscription ${newUser.subscription}. User tetap ditambahkan ke database.`);
                }
            } else if (newUser.pppoe_username && newUser.pppoe_password && newUser.subscription && !addToMikrotik) {
                // Log info jika field PPPoE terisi tapi checkbox tidak dicentang
                // Simplified log
            }
            
            // Send welcome message if enabled
            const welcomeEnabled = global.config.welcomeMessage?.enabled !== false; // Default to true
            if (welcomeEnabled && newUser.username && plainTextPassword && newUser.phone_number) {
                try {
                    const { normalizePhoneNumber } = require('../lib/utils');
                    const portalUrl = global.config.welcomeMessage?.customerPortalUrl || global.config.company?.website || global.config.site_url_bot || 'https://rafnet.my.id/customer';
                    
                    const templateData = {
                        nama_pelanggan: newUser.name,
                        username: newUser.username,
                        password: plainTextPassword, // Use plain text password for message
                        portal_url: portalUrl,
                        nama_wifi: global.config.nama || global.config.nama_wifi || 'Layanan Kami',
                        nama_bot: global.config.namabot || global.config.botName || 'RAF NET BOT'
                    };
                    
                    const messageText = renderTemplate('customer_welcome', templateData);
                    const phoneNumbers = newUser.phone_number.split('|').map(p => p.trim()).filter(p => p);
                    
                    // Send message asynchronously (non-blocking)
                    (async () => {
                        for (const number of phoneNumbers) {
                            const normalizedNumber = normalizePhoneNumber(number);
                            if (normalizedNumber && global.whatsappConnectionState === 'open' && global.raf && global.raf.sendMessage) {
                                const jid = `${normalizedNumber}@s.whatsapp.net`;
                                try {
                                    const { delay } = await import('@whiskeysockets/baileys');
                                    await delay(1000);
                                    await global.raf.sendMessage(jid, { text: messageText });
                                } catch (e) {
                                    console.error(`[WELCOME_MSG_ERROR] Failed to send welcome message to ${jid}:`, e.message);
                                }
                            }
                        }
                    })();
                } catch (welcomeError) {
                    console.error('[WELCOME_MSG_ERROR] Failed to send welcome message:', welcomeError.message);
                    // Don't fail user creation if welcome message fails
                }
            }
            
            return res.json({
                status: 201,
                message: 'User berhasil ditambahkan',
                data: newUser
            });
        }
        
    } catch (error) {
        console.error('[API_USERS_POST_ERROR]', error);
        return res.status(500).json({
            status: 500,
            message: 'Terjadi kesalahan saat menyimpan data user',
            error: error.message
        });
    }
});

// POST /api/users/bulk-change-profile - Bulk change MikroTik profile for users with specific package
// IMPORTANT: This route MUST be defined BEFORE /users/:id to avoid route conflict
// Also updates the package configuration to sync the new profile
router.post('/users/bulk-change-profile', ensureAdmin, async (req, res) => {
    try {
        const { packageName, targetProfile } = req.body;
        
        // Validate input
        if (!packageName || !targetProfile) {
            return res.status(400).json({
                status: 400,
                message: 'Nama paket dan profil tujuan harus diisi'
            });
        }
        
        // Find all users with matching subscription AND pppoe_username
        const affectedUsers = global.users.filter(u => 
            u.subscription === packageName && u.pppoe_username
        );
        
        if (affectedUsers.length === 0) {
            return res.json({
                status: 200,
                message: `Tidak ada pelanggan dengan paket "${packageName}" yang memiliki PPPoE username`,
                successCount: 0,
                failedCount: 0
            });
        }
        
        // Get old profile from package config for logging
        const packageConfig = global.packages.find(p => p.name === packageName);
        const oldProfile = packageConfig ? packageConfig.profile : null;
        
        console.log(`[BULK_CHANGE_PROFILE] Starting bulk profile change for package "${packageName}"`);
        console.log(`[BULK_CHANGE_PROFILE] Old profile: ${oldProfile} → New profile: ${targetProfile}`);
        console.log(`[BULK_CHANGE_PROFILE] Affected users: ${affectedUsers.length}`);
        
        let successCount = 0;
        let failedCount = 0;
        const errors = [];
        
        // Process each user - update MikroTik profile
        for (const user of affectedUsers) {
            try {
                // Update PPPoE profile in MikroTik
                await updatePPPoEProfile(user.pppoe_username, targetProfile);
                
                successCount++;
                console.log(`[BULK_CHANGE_PROFILE] Success: ${user.pppoe_username} (${user.name})`);
                
            } catch (error) {
                failedCount++;
                errors.push({
                    userId: user.id,
                    username: user.pppoe_username,
                    name: user.name,
                    error: error.message
                });
                console.error(`[BULK_CHANGE_PROFILE] Failed: ${user.pppoe_username} - ${error.message}`);
            }
        }
        
        // Update package configuration to sync the new profile
        let packageUpdated = false;
        if (packageConfig && successCount > 0) {
            try {
                // Update in memory
                const packageIndex = global.packages.findIndex(p => p.name === packageName);
                if (packageIndex !== -1) {
                    global.packages[packageIndex].profile = targetProfile;
                }
                
                // Save to packages.json
                await savePackage(global.packages);
                packageUpdated = true;
                console.log(`[BULK_CHANGE_PROFILE] Package "${packageName}" profile updated to "${targetProfile}" in packages.json`);
            } catch (saveError) {
                console.error(`[BULK_CHANGE_PROFILE] Failed to update packages.json:`, saveError);
            }
        }
        
        // Log activity
        try {
            await logActivity({
                userId: req.user.id,
                username: req.user.username,
                role: req.user.role,
                actionType: 'UPDATE',
                resourceType: 'user',
                resourceId: 'bulk',
                resourceName: `Bulk Profile Change: ${packageName}`,
                description: `Bulk changed MikroTik profile for package "${packageName}" from "${oldProfile}" to "${targetProfile}" for ${successCount} users (${failedCount} failed). Package config ${packageUpdated ? 'updated' : 'not updated'}.`,
                oldValue: { package: packageName, profile: oldProfile, affectedCount: affectedUsers.length },
                newValue: { targetProfile, successCount, failedCount, packageUpdated },
                ipAddress: req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'],
                userAgent: req.headers['user-agent']
            });
        } catch (logErr) {
            console.error('[BULK_CHANGE_PROFILE] Activity log error:', logErr);
        }
        
        console.log(`[BULK_CHANGE_PROFILE] Completed: ${successCount} success, ${failedCount} failed, package updated: ${packageUpdated}`);
        
        return res.json({
            status: 200,
            message: `Berhasil mengubah profil ${successCount} pelanggan${failedCount > 0 ? `, ${failedCount} gagal` : ''}${packageUpdated ? '. Konfigurasi paket juga diperbarui.' : ''}`,
            successCount,
            failedCount,
            packageUpdated,
            oldProfile,
            newProfile: targetProfile,
            errors: errors.length > 0 ? errors : undefined
        });
        
    } catch (error) {
        console.error('[BULK_CHANGE_PROFILE_ERROR]', error);
        return res.status(500).json({
            status: 500,
            message: 'Gagal melakukan perubahan profil massal',
            error: error.message
        });
    }
});

// POST /api/users/:id - Update existing user
router.post('/users/:id', ensureAdmin, async (req, res) => {
    const { id } = req.params;
    
    // DEBUG: Log incoming request
    console.log('[API_USER_UPDATE_DEBUG] ========================================');
    console.log('[API_USER_UPDATE_DEBUG] User ID:', id);
    console.log('[API_USER_UPDATE_DEBUG] Request body:', JSON.stringify(req.body, null, 2));
    console.log('[API_USER_UPDATE_DEBUG] Paid field in body:', req.body.paid, typeof req.body.paid);
    
    const userToUpdate = global.users.find(u => String(u.id) === String(id));
    
    if (!userToUpdate) {
        console.log('[API_USER_UPDATE_DEBUG] User not found!');
        return res.status(404).json({ 
            status: 404, 
            message: "Pengguna tidak ditemukan." 
        });
    }

    console.log('[API_USER_UPDATE_DEBUG] User found:', userToUpdate.name);
    console.log('[API_USER_UPDATE_DEBUG] OLD paid status:', userToUpdate.paid);

    try {
        const userData = req.body;
        
        // Store old values for comparison
        const oldPaidStatus = userToUpdate.paid;
        
        // Validate phone numbers if being updated (support international)
        // Phone number is now OPTIONAL - only validate if provided and not empty
        const phoneToValidate = userData.phone_number || userData.phone;
        if (phoneToValidate && phoneToValidate.trim() !== '') {
            const defaultCountry = userData.country || userToUpdate.country || 'ID';
            const validationResult = await validatePhoneNumbers(global.db, phoneToValidate, id, defaultCountry);
            
            if (!validationResult.valid) {
                // Only block if format is invalid, not for duplicates (allow admin to fix duplicates)
                if (!validationResult.message.includes('already registered')) {
                    return res.status(400).json({
                        status: 400,
                        message: validationResult.message,
                        conflictUser: validationResult.conflictUser || null
                    });
                } else {
                    // Log warning but allow update (admin might be fixing duplicate)
                    console.warn(`[USER_UPDATE] Phone duplicate warning for user ${id}: ${validationResult.message}`);
                }
            }
        }
        
        // Update user object with new data
        Object.keys(userData).forEach(key => {
            if (userData[key] !== undefined && key !== 'id') {
                // Handle boolean conversions
                if (key === 'paid' || key === 'send_invoice' || key === 'is_corporate') {
                    const newValue = userData[key] === true || userData[key] === 'true' || userData[key] === 1;
                    console.log(`[API_USER_UPDATE_DEBUG] Updating ${key}: ${userToUpdate[key]} -> ${newValue}`);
                    userToUpdate[key] = newValue;
                } else if (key === 'phone_number' || key === 'phone') {
                    // Store phone number in the correct field
                    userToUpdate['phone_number'] = userData[key];
                } else if (key === 'package' || key === 'subscription') {
                    // Store subscription in the correct field
                    userToUpdate['subscription'] = userData[key];
                } else if (key === 'odp_id' || key === 'connected_odp_id') {
                    // Store ODP ID in the correct field
                    userToUpdate['connected_odp_id'] = userData[key];
                } else {
                    userToUpdate[key] = userData[key];
                }
            }
        });
        
        userToUpdate.updated_at = new Date().toISOString();
        
        // Store old values for activity log (before database update)
        const oldUserData = {
            name: userToUpdate.name,
            phone_number: userToUpdate.phone_number,
            subscription: userToUpdate.subscription,
            paid: oldPaidStatus,
            pppoe_username: userToUpdate.pppoe_username
        };
        
        // Update database - use dynamic fields based on what's in userData
        const fields = Object.keys(userData).filter(key => key !== 'id');
        if (fields.length > 0) {
            // Define valid database columns to prevent SQL injection
            const validColumns = [
                'name', 'phone_number', 'address', 'subscription', 'pppoe_username', 
                'device_id', 'paid', 'username', 'password', 'otp', 'otpTimestamp',
                'bulk', 'connected_odp_id', 'latitude', 'longitude', 'pppoe_password',
                'send_invoice', 'is_corporate', 'corporate_name', 'corporate_address',
                'corporate_npwp', 'corporate_pic_name', 'corporate_pic_phone', 
                'corporate_pic_email'
            ];
            
            const updateFields = [];
            const updateValues = [];
            
            fields.forEach(field => {
                // Map field names to database columns
                let dbField = field;
                if (field === 'phone') dbField = 'phone_number';
                else if (field === 'package') dbField = 'subscription';
                else if (field === 'odp_id') dbField = 'connected_odp_id';
                // Convert dash to underscore for any field (e.g., corporate-pic-name -> corporate_pic_name)
                else dbField = field.replace(/-/g, '_');
                
                // Only update valid columns
                if (validColumns.includes(dbField)) {
                    updateFields.push(dbField);
                    const value = userToUpdate[field];
                    // Convert booleans to integers for SQLite
                    if (typeof value === 'boolean') {
                        updateValues.push(value ? 1 : 0);
                    } else if (dbField === 'bulk') {
                        // PENTING: bulk harus di-stringify karena database menyimpan sebagai TEXT JSON
                        updateValues.push(Array.isArray(value) ? JSON.stringify(value) : (value || null));
                    } else {
                        updateValues.push(value);
                    }
                }
            });
            
            if (updateFields.length > 0) {
                // Build query with proper escaping
                const setClause = updateFields.map(field => `"${field}" = ?`).join(', ');
                updateValues.push(id); // Add ID for WHERE clause
                
                const updateQuery = `UPDATE users SET ${setClause} WHERE id = ?`;
                
                // DEBUG: Log SQL query
                console.log('[API_USER_UPDATE_DEBUG] SQL Query:', updateQuery);
                console.log('[API_USER_UPDATE_DEBUG] SQL Values:', updateValues);
                console.log('[API_USER_UPDATE_DEBUG] Update fields:', updateFields);
            
                await new Promise((resolve, reject) => {
                    global.db.run(updateQuery, updateValues, function(err) {
                        if (err) {
                            console.error('[DB_UPDATE_USER_ERROR]', err);
                            console.error('[DB_UPDATE_QUERY]', updateQuery);
                            console.error('[DB_UPDATE_VALUES]', updateValues);
                            reject(err);
                        } else {
                            console.log(`[DB_UPDATE_SUCCESS] User ${id} updated successfully. Rows affected: ${this.changes}`);
                            console.log('[API_USER_UPDATE_DEBUG] NEW paid status:', userToUpdate.paid);
                            resolve();
                        }
                    });
                });
            } else {
                console.log('[DB_UPDATE_SKIP] No valid fields to update');
            }
        }
        
        // Log activity
        try {
            const changedFields = [];
            if (oldUserData.name !== userToUpdate.name) changedFields.push('name');
            if (oldUserData.phone_number !== userToUpdate.phone_number) changedFields.push('phone_number');
            if (oldUserData.subscription !== userToUpdate.subscription) changedFields.push('subscription');
            if (oldUserData.paid !== userToUpdate.paid) changedFields.push('paid');
            if (oldUserData.pppoe_username !== userToUpdate.pppoe_username) changedFields.push('pppoe_username');
            
            await logActivity({
                userId: req.user.id,
                username: req.user.username,
                role: req.user.role,
                actionType: 'UPDATE',
                resourceType: 'user',
                resourceId: userToUpdate.id.toString(),
                resourceName: userToUpdate.name,
                description: `Updated user ${userToUpdate.name} (changed: ${changedFields.join(', ') || 'none'})`,
                oldValue: oldUserData,
                newValue: {
                    name: userToUpdate.name,
                    phone_number: userToUpdate.phone_number,
                    subscription: userToUpdate.subscription,
                    paid: userToUpdate.paid,
                    pppoe_username: userToUpdate.pppoe_username
                },
                ipAddress: req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'],
                userAgent: req.headers['user-agent']
            });
        } catch (logErr) {
            console.error('[ACTIVITY_LOG_ERROR] Failed to log user update:', logErr);
        }
        
        // Handle paid status change
        if (oldPaidStatus !== userToUpdate.paid && userToUpdate.paid === true) {
            await handlePaidStatusChange(userToUpdate, {
                paidDate: new Date().toISOString(),
                method: userData.payment_method || 'TRANSFER_BANK', // Default to bank transfer for admin updates
                approvedBy: req.user.username,
                notes: 'Status pembayaran diperbarui'
            });
        }
        
        // Update PPPoE if needed
        if (userToUpdate.pppoe_username && (userToUpdate.subscription || userToUpdate.package)) {
            const profile = getProfileBySubscription(userToUpdate.subscription || userToUpdate.package);
            if (profile) {
                await updatePPPoEProfile(userToUpdate.pppoe_username, profile);
            }
        }
        
        console.log('[API_USER_UPDATE_DEBUG] Sending response with paid status:', userToUpdate.paid);
        console.log('[API_USER_UPDATE_DEBUG] ========================================');
        
        return res.json({
            status: 200,
            message: 'User berhasil diperbarui',
            data: userToUpdate
        });
        
    } catch (error) {
        console.error('[API_USERS_UPDATE_ERROR]', error);
        return res.status(500).json({
            status: 500,
            message: 'Terjadi kesalahan saat memperbarui user',
            error: error.message
        });
    }
});

// GET /api/supported-countries - Get list of supported phone countries
router.get('/supported-countries', (req, res) => {
    const countries = getSupportedCountries();
    return res.json({
        status: 200,
        message: 'Supported countries for phone validation',
        data: countries,
        note: 'Any international format with + is also supported'
    });
});

// DELETE /api/users/:id - Delete a user
router.delete('/users/:id', ensureAdmin, async (req, res) => {
    try {
        const userId = req.params.id;
        
        // Find user
        const userIndex = global.users.findIndex(u => u.id === userId);
        if (userIndex === -1) {
            return res.status(404).json({
                status: 404,
                message: 'User tidak ditemukan'
            });
        }
        
        const user = global.users[userIndex];
        
        // Log activity before deletion
        try {
            await logActivity({
                userId: req.user.id,
                username: req.user.username,
                role: req.user.role,
                actionType: 'DELETE',
                resourceType: 'user',
                resourceId: user.id.toString(),
                resourceName: user.name,
                description: `Deleted user ${user.name}`,
                oldValue: {
                    name: user.name,
                    phone_number: user.phone_number,
                    subscription: user.subscription,
                    paid: user.paid,
                    pppoe_username: user.pppoe_username
                },
                newValue: null,
                ipAddress: req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'],
                userAgent: req.headers['user-agent']
            });
        } catch (logErr) {
            console.error('[ACTIVITY_LOG_ERROR] Failed to log user delete:', logErr);
        }
        
        // Delete from PPPoE if exists
        if (user.pppoe_username) {
            try {
                await deleteActivePPPoEUser(user.pppoe_username);
            } catch (err) {
                console.error('[DELETE_USER] Failed to delete PPPoE user:', err);
            }
        }
        
        // Delete from database
        await new Promise((resolve, reject) => {
            global.db.run('DELETE FROM users WHERE id = ?', [userId], function(err) {
                if (err) reject(err);
                else resolve();
            });
        });
        
        // Remove from memory
        global.users.splice(userIndex, 1);
        
        // Update ODP port usage if needed
        if (user.odp_id && user.odp_port) {
            updateOdpPortUsage(user.odp_id, user.odp_port, false);
        }
        
        return res.json({
            status: 200,
            message: 'User berhasil dihapus'
        });
        
    } catch (error) {
        console.error('[API_USERS_DELETE_ERROR]', error);
        return res.status(500).json({
            status: 500,
            message: 'Terjadi kesalahan saat menghapus user',
            error: error.message
        });
    }
});

// POST /api/users/delete-all - Delete all users
router.post('/users/delete-all', ensureAdmin, async (req, res) => {
    try {
        console.log('[/api/users/delete-all] Route hit');
        
        // Get password from request
        const { password } = req.body;
        if (!password) {
            console.log('[/api/users/delete-all] Password not provided.');
            return res.status(400).json({ 
                status: 400, 
                message: "Password is required." 
            });
        }
        
        // Find admin account - handle both string and number ID comparison
        console.log('[/api/users/delete-all] Looking for account with ID:', req.user.id, 'Type:', typeof req.user.id);
        console.log('[/api/users/delete-all] Available accounts:', global.accounts.map(acc => ({ id: acc.id, type: typeof acc.id, username: acc.username })));
        
        let account = global.accounts.find(acc => String(acc.id) === String(req.user.id));
        if (!account) {
            console.log('[/api/users/delete-all] Admin account not found by ID, checking if req.user can be used directly');
            // Fallback: if account not found by ID, but req.user exists and is admin, use req.user directly
            if (req.user && req.user.username && req.user.password) {
                console.log('[/api/users/delete-all] Using req.user directly as account');
                account = req.user; // Use req.user as the account
            } else {
                return res.status(401).json({ 
                    status: 401, 
                    message: "Akun admin tidak ditemukan. Silakan login ulang." 
                });
            }
        }
        
        // Verify password
        console.log('[/api/users/delete-all] Comparing passwords for account:', account.username);
        const isValid = await comparePassword(password, account.password);
        console.log('[/api/users/delete-all] Password validation result:', isValid);
        
        if (!isValid) {
            return res.status(401).json({ 
                status: 401, 
                message: "Password salah. Silakan coba lagi." 
            });
        }
        
        console.log('[/api/users/delete-all] Password is valid. Deleting all users.');
        
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
        
        // Clear database
        await new Promise((resolve, reject) => {
            global.db.run('DELETE FROM users', function(err) {
                if (err) reject(err);
                else resolve();
            });
        });
        
        // Clear memory
        global.users = [];
        
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
        console.log('[/api/users/delete-all] Network assets ports reset.');
        
        return res.json({
            status: 200,
            message: 'Semua pengguna berhasil dihapus'
        });
        
    } catch (error) {
        console.error('[API_USERS_DELETE_ALL_ERROR]', error);
        return res.status(500).json({
            status: 500,
            message: 'Terjadi kesalahan saat menghapus semua user',
            error: error.message
        });
    }
});

// GET /api/start - Start WhatsApp connection
router.get('/start', ensureAdmin, async (req, res) => {
    try {
        if (global.raf) {
            return res.json({
                status: 200,
                message: 'WhatsApp sudah terhubung'
            });
        }
        
        if (typeof global.rafect === 'function') {
            global.rafect();
            return res.json({
                status: 200,
                message: 'Memulai koneksi WhatsApp...'
            });
        } else {
            return res.status(500).json({
                status: 500,
                message: 'Fungsi connect tidak tersedia'
            });
        }
    } catch (error) {
        console.error('[API_START_ERROR]', error);
        return res.status(500).json({
            status: 500,
            message: 'Terjadi kesalahan saat memulai koneksi WhatsApp',
            error: error.message
        });
    }
});

// ==================== PSB (Pasang Baru) Endpoints ====================

// Multer storage untuk PSB photo upload
// Struktur: uploads/psb/YEAR/MONTH/tempId/ktp_photo.jpg dan house_photo.jpg
// Catatan: req.body mungkin belum tersedia saat destination dipanggil untuk multipart/form-data
// Solusi: Gunakan query parameter atau simpan di req sebelum multer
const psbStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        // Coba ambil tempId dari berbagai sumber (body, query, atau header)
        // Untuk multipart/form-data, body mungkin belum terisi saat destination dipanggil
        let tempId = req.body?.tempId || req.query?.tempId || req.headers['x-temp-id'];
        
        // Jika masih belum ada, coba parse dari fieldname atau buat fallback
        // Tapi lebih baik pastikan frontend mengirim via query parameter
        if (!tempId) {
            // Fallback: buat tempId baru (tidak ideal, tapi mencegah error)
            tempId = 'TEMP_' + Date.now();
            console.warn(`[PSB_UPLOAD_WARN] tempId tidak ditemukan, menggunakan fallback: ${tempId}`);
        }
        
        const year = String(new Date().getFullYear()); // Convert to string
        const month = String(new Date().getMonth() + 1).padStart(2, '0');
        // Satu folder per request pelanggan: uploads/psb/YEAR/MONTH/tempId/
        const uploadDir = path.join(__dirname, '../uploads/psb', year, month, tempId);
        
        // Create directory if it doesn't exist
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        
        // Simpan tempId di req untuk digunakan di filename function
        req._psbTempId = tempId;
        
        // Coba ambil fieldname dari query parameter juga (untuk memastikan tersedia)
        const fieldname = req.query?.fieldname || req.body?.fieldname;
        if (fieldname) {
            req._psbFieldname = fieldname;
        }
        
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        // Gunakan fieldname dari berbagai sumber
        // Query parameter lebih reliable untuk multipart/form-data
        let fieldname = req._psbFieldname || req.query?.fieldname || req.body?.fieldname;
        
        // Jika masih belum ada, coba deteksi dari file.fieldname atau gunakan default
        if (!fieldname) {
            // file.fieldname biasanya adalah nama field di FormData ('photo')
            // Tapi kita butuh 'ktp_photo' atau 'house_photo'
            // Fallback: gunakan 'photo' dan akan diperbaiki saat submit
            fieldname = 'photo';
            console.warn(`[PSB_UPLOAD_WARN] fieldname tidak ditemukan, menggunakan fallback: ${fieldname}`);
        }
        
        const ext = path.extname(file.originalname) || '.jpg';
        // Nama file: ktp_photo.jpg atau house_photo.jpg
        cb(null, `${fieldname}${ext}`);
    }
});

const psbUpload = multer({
    storage: psbStorage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    },
    fileFilter: function (req, file, cb) {
        // Accept images only
        if (!file.mimetype.startsWith('image/')) {
            return cb(new Error('Hanya file gambar yang diperbolehkan'), false);
        }
        cb(null, true);
    }
});

// Middleware untuk ensure teknisi/staff
function ensureAuthenticatedStaff(req, res, next) {
    if (!req.user) {
        return res.status(401).json({ status: 401, message: "Unauthorized" });
    }
    // Allow admin, owner, superadmin, and teknisi
    const allowedRoles = ['admin', 'owner', 'superadmin', 'teknisi'];
    if (!allowedRoles.includes(req.user.role)) {
        return res.status(403).json({ status: 403, message: "Akses ditolak. Hanya teknisi dan admin yang dapat mengakses." });
    }
    next();
}

// POST /api/psb/upload-photo - Upload foto untuk PSB (KTP atau rumah)
router.post('/psb/upload-photo', ensureAuthenticatedStaff, rateLimit('psb-upload-photo', 20, 60000), psbUpload.single('photo'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                status: 400,
                message: 'File foto harus diupload'
            });
        }
        
        // Ambil tempId dari berbagai sumber (body, query, atau yang disimpan di req)
        // Body mungkin sudah terisi setelah multer memproses
        const tempId = req.body?.tempId || req.query?.tempId || req._psbTempId;
        
        // Validasi tempId harus ada
        if (!tempId) {
            return res.status(400).json({
                status: 400,
                message: 'tempId harus disediakan. Satu tempId untuk satu request pelanggan. Pastikan tempId dikirim via query parameter atau form data.'
            });
        }
        
        const year = String(new Date().getFullYear()); // Convert to string
        const month = String(new Date().getMonth() + 1).padStart(2, '0');
        
        // Path relatif untuk web access
        // Struktur: /uploads/psb/YEAR/MONTH/tempId/ktp_photo.jpg atau house_photo.jpg
        const webPath = `/uploads/psb/${year}/${month}/${tempId}/${req.file.filename}`;
        
        // Full storage path for reference
        const fullStoragePath = path.join(__dirname, '../uploads/psb', year, month, tempId, req.file.filename);
        
        // Log untuk debugging
        const fieldnameUsed = req._psbFieldname || req.query?.fieldname || req.body?.fieldname || 'not found';
        console.log(`[PSB_UPLOAD_SUCCESS] File uploaded: ${req.file.filename}`);
        console.log(`[PSB_UPLOAD_SUCCESS] fieldname used: ${fieldnameUsed}`);
        console.log(`[PSB_UPLOAD_SUCCESS] tempId: ${tempId} (satu folder untuk 2 foto: KTP + Rumah)`);
        console.log(`[PSB_UPLOAD_SUCCESS] Web path: ${webPath}`);
        console.log(`[PSB_UPLOAD_SUCCESS] Storage path: ${fullStoragePath}`);
        
        return res.json({
            status: 200,
            message: 'Foto berhasil diupload',
            data: {
                path: webPath,
                filename: req.file.filename,
                size: req.file.size,
                tempId: tempId,
                storagePath: `uploads/psb/${year}/${month}/${tempId}/${req.file.filename}`,
                year: year,
                month: month
            }
        });
    } catch (error) {
        console.error('[PSB_UPLOAD_ERROR]', error);
        return res.status(500).json({
            status: 500,
            message: 'Gagal upload foto',
            error: error.message
        });
    }
});

// POST /api/psb/submit-phase1 - Submit data awal PSB (sebelum instalasi)
router.post('/psb/submit-phase1', ensureAuthenticatedStaff, rateLimit('psb-submit-phase1', 5, 60000), async (req, res) => {
    try {
        const { 
            phone_number, 
            name, 
            address, 
            odc_id,
            odp_id, 
            location_url, 
            latitude, 
            longitude, 
            ktp_photo_path, 
            house_photo_path, 
            temp_id 
        } = req.body;
        
        // Validasi required fields
        if (!phone_number || !name || !address) {
            return res.status(400).json({
                status: 400,
                message: 'Nomor HP, nama, dan alamat harus diisi'
            });
        }
        
        if (!ktp_photo_path || !house_photo_path) {
            return res.status(400).json({
                status: 400,
                message: 'Foto KTP dan foto rumah harus diupload'
            });
        }
        
        // Parse location dari Google Maps link jika ada
        let finalLat = latitude ? parseFloat(latitude) : null;
        let finalLng = longitude ? parseFloat(longitude) : null;
        
        if (location_url && (!finalLat || !finalLng)) {
            const parsed = parseGoogleMapsLink(location_url);
            if (parsed) {
                finalLat = parsed.latitude;
                finalLng = parsed.longitude;
            }
        }
        
        // Validasi koordinat jika ada
        if (finalLat !== null && finalLng !== null) {
            if (!validateCoordinates(finalLat, finalLng)) {
                return res.status(400).json({
                    status: 400,
                    message: 'Koordinat lokasi tidak valid'
                });
            }
        }
        
        // Validasi nomor HP (cek duplikasi dan max limit)
        const defaultCountry = 'ID';
        // Get accessLimit from config (could be in mainConfig or cronConfig)
        // Format: accessLimit can be string or number in config.json (e.g., "5" or 5)
        let accessLimit = 3; // Default
        const configAccessLimit = global.config?.accessLimit;
        const cronAccessLimit = global.cronConfig?.accessLimit;
        
        if (configAccessLimit !== undefined && configAccessLimit !== null) {
            accessLimit = parseInt(configAccessLimit) || 3;
        } else if (cronAccessLimit !== undefined && cronAccessLimit !== null) {
            accessLimit = parseInt(cronAccessLimit) || 3;
        }
        
        console.log('[PSB_PHASE1] accessLimit from config:', accessLimit, '(type:', typeof accessLimit, ', from mainConfig:', configAccessLimit, '(type:', typeof configAccessLimit, '), cronConfig:', cronAccessLimit, '(type:', typeof cronAccessLimit, '))');
        
        // Split phone numbers untuk check count
        const phoneNumbers = phone_number.split('|').map(p => p.trim()).filter(p => p);
        
        if (phoneNumbers.length === 0) {
            return res.status(400).json({
                status: 400,
                message: 'Minimal 1 nomor HP harus diisi'
            });
        }
        
        if (phoneNumbers.length > accessLimit) {
            return res.status(400).json({
                status: 400,
                message: `Maksimal ${accessLimit} nomor HP sesuai konfigurasi. Anda memasukkan ${phoneNumbers.length} nomor.`
            });
        }
        
        // Validate format dan duplikasi
        const validationResult = await validatePhoneNumbers(global.db, phone_number, null, defaultCountry);
        
        if (!validationResult.valid) {
            return res.status(400).json({
                status: 400,
                message: validationResult.message,
                conflictUser: validationResult.conflictUser || null
            });
        }
        
        // Generate Customer ID
        // IMPORTANT: Use getNextAvailablePSBId() which checks BOTH psb_records AND users tables
        // because PSB records eventually move to users table, so they share the same ID space
        let customerId;
        try {
            customerId = await getNextAvailablePSBId();
            console.log(`[PSB_PHASE1] Generated PSB ID: ${customerId}`);
        } catch (err) {
            console.error('[PSB_PHASE1] Get ID error:', err);
            return res.status(500).json({
                status: 500,
                message: 'Gagal mendapatkan ID untuk customer baru',
                error: err.message
            });
        }
        
        // Pindahkan foto ke folder final
        const year = String(new Date().getFullYear()); // Convert to string
        const month = String(new Date().getMonth() + 1).padStart(2, '0');
        const finalDir = path.join(__dirname, '../uploads/psb', year, month, customerId.toString());
        
        // Create final directory
        if (!fs.existsSync(finalDir)) {
            fs.mkdirSync(finalDir, { recursive: true });
        }
        
        // Move photos from tempId folder to customerId folder
        // Struktur: uploads/psb/YEAR/MONTH/tempId/ktp_photo.jpg -> uploads/psb/YEAR/MONTH/customerId/ktp_photo.jpg
        // Satu folder per request pelanggan, berisi 2 foto: ktp_photo.jpg dan house_photo.jpg
        let finalKtpPath = ktp_photo_path;
        if (temp_id && ktp_photo_path.includes(temp_id)) {
            const oldKtpPath = path.join(__dirname, '..', ktp_photo_path.replace(/^\//, ''));
            if (fs.existsSync(oldKtpPath)) {
                const ktpFilename = path.basename(ktp_photo_path);
                // Pastikan nama file konsisten: ktp_photo.jpg
                const finalKtpFilename = ktpFilename.startsWith('ktp_photo') ? ktpFilename : `ktp_photo${path.extname(ktpFilename)}`;
                const newKtpPath = path.join(finalDir, finalKtpFilename);
                fs.renameSync(oldKtpPath, newKtpPath);
                finalKtpPath = `/uploads/psb/${year}/${month}/${customerId}/${finalKtpFilename}`;
                console.log(`[PSB_PHASE1] KTP photo moved: ${oldKtpPath} -> ${newKtpPath}`);
            }
        }
        
        // Move house photo
        let finalHousePath = house_photo_path;
        if (temp_id && house_photo_path.includes(temp_id)) {
            const oldHousePath = path.join(__dirname, '..', house_photo_path.replace(/^\//, ''));
            if (fs.existsSync(oldHousePath)) {
                const houseFilename = path.basename(house_photo_path);
                // Pastikan nama file konsisten: house_photo.jpg
                const finalHouseFilename = houseFilename.startsWith('house_photo') ? houseFilename : `house_photo${path.extname(houseFilename)}`;
                const newHousePath = path.join(finalDir, finalHouseFilename);
                fs.renameSync(oldHousePath, newHousePath);
                finalHousePath = `/uploads/psb/${year}/${month}/${customerId}/${finalHouseFilename}`;
                console.log(`[PSB_PHASE1] House photo moved: ${oldHousePath} -> ${newHousePath}`);
            }
        }
        
        // Clean up temp folder if empty
        if (temp_id) {
            const tempDir = path.join(__dirname, '../uploads/psb', year, month, temp_id);
            try {
                if (fs.existsSync(tempDir)) {
                    const files = fs.readdirSync(tempDir);
                    if (files.length === 0) {
                        fs.rmdirSync(tempDir);
                        console.log(`[PSB_PHASE1] Temp folder cleaned up: ${tempDir}`);
                    }
                }
            } catch (err) {
                console.warn(`[PSB_PHASE1] Could not clean up temp folder: ${err.message}`);
            }
        }
        
        // Buat PSB record dengan status phase1_completed
        const psbRecord = {
            id: customerId,
            name: name,
            phone_number: phone_number,
            address: address,
            latitude: finalLat,
            longitude: finalLng,
            location_url: location_url || null,
            psb_status: 'phase1_completed',
            created_at: new Date().toISOString(),
            created_by: req.user.username,
            phase1_completed_at: new Date().toISOString(),
            odc_id: odc_id || null,
            odp_id: odp_id || null,
            psb_data: {
                ktp_photo: finalKtpPath,
                house_photo: finalHousePath,
                location_shared_at: new Date().toISOString(),
                odc_id: odc_id || null,
                odp_id: odp_id || null
            }
        };
        
        // Insert into PSB database (NOT users table)
        await insertPSBRecord(psbRecord);
        
        // Add to memory (global.psbRecords)
        if (!global.psbRecords) {
            global.psbRecords = [];
        }
        global.psbRecords.push(psbRecord);
        
        // Log activity
        try {
            await logActivity({
                userId: req.user.id,
                username: req.user.username,
                role: req.user.role,
                actionType: 'CREATE',
                resourceType: 'user',
                resourceId: customerId.toString(),
                resourceName: name,
                description: `PSB Phase 1 completed for ${name}`,
                oldValue: null,
                newValue: {
                    name: name,
                    phone_number: phone_number,
                    psb_status: 'phase1_completed'
                },
                ipAddress: req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'],
                userAgent: req.headers['user-agent']
            });
        } catch (logErr) {
            console.error('[PSB_PHASE1] Activity log error:', logErr);
        }
        
        // Send WhatsApp notification
        try {
            await sendPSBPhase1Notification(psbRecord);
        } catch (notifErr) {
            console.error('[PSB_PHASE1] Notification error:', notifErr);
            // Continue even if notification fails
        }
        
        return res.json({
            status: 200,
            message: 'Data awal PSB berhasil disimpan',
            data: {
                customerId: customerId,
                name: name,
                phone_number: phone_number,
                psb_status: 'phase1_completed'
            }
        });
        
    } catch (error) {
        console.error('[PSB_PHASE1_ERROR]', error);
        return res.status(500).json({
            status: 500,
            message: 'Gagal menyimpan data awal PSB',
            error: error.message
        });
    }
});

// POST /api/psb/find-device - Cari device di GenieACS
router.post('/psb/find-device', ensureAuthenticatedStaff, async (req, res) => {
    try {
        const { deviceId } = req.body;
        
        if (!deviceId) {
            return res.status(400).json({
                status: 400,
                message: 'Device ID harus diisi'
            });
        }
        
        // Query GenieACS untuk device
        const query = { "_id": deviceId };
        
        const response = await axios.get(`${global.config.genieacsBaseUrl}/devices/`, {
            params: {
                query: JSON.stringify(query),
                projection: '_id,Device.DeviceInfo,InternetGatewayDevice.DeviceInfo,InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1,Device.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1'
            },
            timeout: 10000
        });
        
        if (response.data && response.data.length > 0) {
            const device = response.data[0];
            
            // Extract current PPP username if exists (try multiple paths)
            const currentPPPUsername = device.InternetGatewayDevice?.WANDevice?.['1']?.WANConnectionDevice?.['1']?.WANPPPConnection?.['1']?.Username?._value || 
                                      device.Device?.WANDevice?.['1']?.WANConnectionDevice?.['1']?.WANPPPConnection?.['1']?.Username?._value || 
                                      null;
            
            return res.json({
                status: 200,
                message: 'Device ditemukan',
                data: {
                    deviceId: device._id,
                    serialNumber: device.Device?.DeviceInfo?.SerialNumber?._value || 
                                 device.InternetGatewayDevice?.DeviceInfo?.SerialNumber?._value || 
                                 null,
                    model: device.Device?.DeviceInfo?.ModelName?._value || 
                          device.InternetGatewayDevice?.DeviceInfo?.ModelName?._value || 
                          null,
                    manufacturer: device.Device?.DeviceInfo?.Manufacturer?._value || 
                                device.InternetGatewayDevice?.DeviceInfo?.Manufacturer?._value || 
                                null,
                    currentPPPUsername: currentPPPUsername // Biasanya "tes@hw" untuk device baru
                }
            });
        } else {
            return res.status(404).json({
                status: 404,
                message: 'Device tidak ditemukan di GenieACS'
            });
        }
    } catch (error) {
        console.error('[PSB_FIND_DEVICE_ERROR]', error);
        console.error('[PSB_FIND_DEVICE_ERROR] Stack:', error.stack);
        
        // Handle specific error cases
        if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
            return res.status(503).json({
                status: 503,
                message: 'GenieACS tidak dapat dijangkau. Pastikan server GenieACS berjalan.',
                error: error.message
            });
        }
        
        if (error.response) {
            return res.status(error.response.status || 500).json({
                status: error.response.status || 500,
                message: 'Error dari GenieACS',
                error: error.response.data || error.message
            });
        }
        
        return res.status(500).json({
            status: 500,
            message: 'Error mencari device',
            error: error.message
        });
    }
});

// GET /api/psb/list-customers - List PSB customers berdasarkan status
router.get('/psb/list-customers', ensureAuthenticatedStaff, async (req, res) => {
    try {
        const { status } = req.query; // Optional: filter by status
        
        // Get from memory (global.psbRecords)
        let customers = global.psbRecords || [];
        
        // Filter by status if provided
        if (status) {
            customers = customers.filter(c => c.psb_status === status);
        }
        
        return res.json({
            status: 200,
            message: 'Data customers berhasil diambil',
            data: customers
        });
    } catch (error) {
        console.error('[PSB_LIST_CUSTOMERS_ERROR]', error);
        return res.status(500).json({
            status: 500,
            message: 'Gagal mengambil data customers',
            error: error.message
        });
    }
});

// GET /api/psb/list-devices - List devices dengan berbagai filter
// Query params: filter (default|new|all), serialNumber (optional - filter by serial number)
router.get('/psb/list-devices', ensureAuthenticatedStaff, async (req, res) => {
    try {
        const filterType = req.query.filter || 'default'; // default, new, by-sn
        // Handle serialNumber parameter - could be string, array, or undefined
        let serialNumberFilter = null;
        if (req.query.serialNumber) {
            // If it's an array (multiple query params), take the first one
            if (Array.isArray(req.query.serialNumber)) {
                serialNumberFilter = req.query.serialNumber[0] ? String(req.query.serialNumber[0]).trim() : null;
            } else if (typeof req.query.serialNumber === 'string') {
                serialNumberFilter = req.query.serialNumber.trim();
            } else {
                // Convert to string if it's another type
                serialNumberFilter = String(req.query.serialNumber).trim();
            }
            // Set to null if empty after trim
            if (!serialNumberFilter || serialNumberFilter === '') {
                serialNumberFilter = null;
            }
        }
        
        // Validate: "by-sn" filter requires Serial Number
        if (filterType === 'by-sn' && !serialNumberFilter) {
            return res.status(400).json({
                status: 400,
                message: 'Filter "By SN" memerlukan Serial Number. Silakan masukkan Serial Number terlebih dahulu.',
                error: 'Serial Number required for by-sn filter'
            });
        }
        
        // Build query based on filter type
        let query = {};
        let limit = 100;
        
        if (filterType === 'new') {
            // Filter devices registered in the last 24 hours (86700000 ms = 24 hours)
            // According to GenieACS: Events.Registered is a Date object in MongoDB
            // User confirmed: Events.Registered shows as "11/20/2025, 10:23:21 PM" in GenieACS UI
            // PROBLEM: Server-side query with Events.Registered returns 0 results
            // SOLUTION: Fetch all devices and filter client-side (Events might not be included in projection with query filter)
            const oneDayAgo = Date.now() - 86700000;
            const oneDayAgoDate = new Date(oneDayAgo);
            
            // Don't use server-side query - it doesn't work with Events.Registered
            // Fetch all devices and filter client-side instead
            query = {}; // Empty query to get all devices
            
            limit = 500; // Get more devices to ensure we don't miss any
            
            console.log(`[PSB_LIST_DEVICES] New filter: Will fetch all devices and filter client-side for Events.Registered > ${oneDayAgoDate.toISOString()}`);
        } else if (filterType === 'by-sn') {
            // Filter by Serial Number only - fetch all devices, filter client-side
            // Note: Serial Number filter is already validated above
            query = {}; // Empty query to get all devices, will filter by SN client-side
            limit = 500; // Get more devices to search for matching SN
            
            console.log(`[PSB_LIST_DEVICES] By SN filter: Will fetch all devices and filter client-side for Serial Number containing "${serialNumberFilter}"`);
        } else {
            // Default: filter by username "tes@hw" or empty/null
            // GenieACS query might not support complex $or with nested paths, so we'll fetch more and filter client-side
            // Try simple query first - get devices with username "tes@hw" if possible
            query = {}; // Get all devices, filter client-side for better reliability
            limit = 300; // Get more devices to filter client-side
        }
        
        console.log(`[PSB_LIST_DEVICES] Filter: ${filterType}, Query:`, JSON.stringify(query));
        
        // Request DeviceInfo fields - using whole object for better compatibility
        // GenieACS may return data in different structures, so we'll extract with multiple attempts
        // Also include VirtualParameters in case SerialNumber is stored there
        // IMPORTANT: Events.Registered is a parameter like VirtualParameters.RXPower
        // So we need to include it in projection as "Events.Registered" (not just "Events")
        // Similar to how we get VirtualParameters.RXPower with projection: "VirtualParameters.RXPower"
        let projectionFields = '_id,Device.DeviceInfo,InternetGatewayDevice.DeviceInfo,VirtualParameters,InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1,Device.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1,_lastInform';
        
        // Add Events.Registered to projection (like other parameters)
        if (filterType === 'new' || filterType === 'all') {
            projectionFields += ',Events.Registered';
            console.log(`[PSB_LIST_DEVICES] Including Events.Registered in projection for filter: ${filterType}`);
        }
        
        // For "new" filter, use empty query to get all devices, then filter client-side
        let actualQuery = query;
        if (filterType === 'new') {
            actualQuery = {}; // Empty query to get all devices
            console.log(`[PSB_LIST_DEVICES] New filter: Using empty query to fetch all devices, will filter client-side`);
        }
        
        console.log(`[PSB_LIST_DEVICES] Requesting devices with filter: ${filterType}`);
        console.log(`[PSB_LIST_DEVICES] Query: ${JSON.stringify(actualQuery)}`);
        console.log(`[PSB_LIST_DEVICES] Projection: ${projectionFields}`);
        console.log(`[PSB_LIST_DEVICES] Limit: ${limit}`);
        
        const response = await axios.get(`${global.config.genieacsBaseUrl}/devices/`, {
            params: {
                query: JSON.stringify(actualQuery),
                projection: projectionFields,
                limit: limit
            },
            timeout: 20000
        });
        
        console.log(`[PSB_LIST_DEVICES] Response: ${response.data?.length || 0} devices returned from GenieACS`);
        
        // Debug: Check if Events.Registered is included in response (sample first device)
        if (response.data && response.data.length > 0) {
            const sampleDevice = response.data[0];
            // Events.Registered is accessed like VirtualParameters.RXPower
            // So it might be: device.Events.Registered or device['Events.Registered'] or nested
            let eventsRegistered = null;
            let eventsRegisteredPath = null;
            
            // Try different ways to access Events.Registered
            if (sampleDevice.Events && sampleDevice.Events.Registered !== undefined) {
                eventsRegistered = sampleDevice.Events.Registered;
                eventsRegisteredPath = 'Events.Registered';
            } else if (sampleDevice['Events.Registered'] !== undefined) {
                eventsRegistered = sampleDevice['Events.Registered'];
                eventsRegisteredPath = 'Events.Registered (flat)';
            } else {
                // Try to find it in nested structure
                const deviceKeys = Object.keys(sampleDevice);
                const eventsKey = deviceKeys.find(k => k.includes('Events') || k.includes('Registered'));
                if (eventsKey) {
                    eventsRegistered = sampleDevice[eventsKey];
                    eventsRegisteredPath = eventsKey;
                }
            }
            
            if (eventsRegistered !== null && eventsRegistered !== undefined) {
                const regType = typeof eventsRegistered;
                let regDate = null;
                if (regType === 'object' && eventsRegistered._value !== undefined) {
                    // Parameter format: { _value: ... }
                    regDate = eventsRegistered._value;
                    console.log(`[PSB_LIST_DEVICES] ✓ Sample Events.Registered found at ${eventsRegisteredPath} (parameter format with _value)`);
                } else {
                    regDate = eventsRegistered;
                    console.log(`[PSB_LIST_DEVICES] ✓ Sample Events.Registered found at ${eventsRegisteredPath}`);
                }
                
                const regDateStr = regDate instanceof Date ? regDate.toISOString() : 
                                 typeof regDate === 'string' ? regDate : 
                                 typeof regDate === 'number' ? new Date(regDate).toISOString() : 
                                 String(regDate);
                console.log(`[PSB_LIST_DEVICES] Sample Events.Registered value: ${regDateStr} (type: ${typeof regDate})`);
            } else {
                console.warn(`[PSB_LIST_DEVICES] ⚠️ Events.Registered NOT found in response!`);
                console.warn(`[PSB_LIST_DEVICES] Available keys: ${Object.keys(sampleDevice).join(', ')}`);
            }
        }
        
        if (response.data && Array.isArray(response.data)) {
            let filteredDevices = response.data;
            
            // Apply additional client-side filtering for more accuracy
            if (filterType === 'default') {
                // Double-check username filter (in case GenieACS query didn't work perfectly)
                filteredDevices = response.data.filter(device => {
                    const currentPPPUsername = device.InternetGatewayDevice?.WANDevice?.['1']?.WANConnectionDevice?.['1']?.WANPPPConnection?.['1']?.Username?._value || 
                                              device.Device?.WANDevice?.['1']?.WANConnectionDevice?.['1']?.WANPPPConnection?.['1']?.Username?._value || 
                                              null;
                    
                    // Include devices with "tes@hw" or empty/null username (new devices)
                    return !currentPPPUsername || currentPPPUsername === 'tes@hw' || currentPPPUsername === '';
                });
                console.log(`[PSB_LIST_DEVICES] After default filter: ${filteredDevices.length} devices`);
            } else if (filterType === 'new') {
                // Client-side filter for new devices (registered in last 24 hours)
                // CRITICAL: Events might not be included when using query filter
                // So we fetch all devices and filter client-side
                const oneDayAgo = Date.now() - 86700000;
                const oneDayAgoDate = new Date(oneDayAgo);
                
                console.log(`[PSB_LIST_DEVICES] Client-side filtering ${response.data.length} devices for new (registered after ${oneDayAgoDate.toISOString()})`);
                
                // Count devices with Events
                const devicesWithEvents = response.data.filter(d => d.Events).length;
                console.log(`[PSB_LIST_DEVICES] Devices with Events: ${devicesWithEvents} / ${response.data.length}`);
                
                filteredDevices = response.data.filter(device => {
                    // Events.Registered is a parameter like VirtualParameters.RXPower
                    // So it might be accessed as:
                    // 1. device.Events.Registered (nested object)
                    // 2. device['Events.Registered'] (flat key)
                    // 3. device.Events.Registered._value (parameter format with _value wrapper)
                    
                    let registeredDate = null;
                    
                    // Try different access methods (like we do for modemType - multiple methods)
                    // Method 1: Nested object access
                    if (device.Events && device.Events.Registered !== undefined && device.Events.Registered !== null) {
                        registeredDate = device.Events.Registered;
                    } 
                    // Method 2: Flat key access
                    else if (device['Events.Registered'] !== undefined && device['Events.Registered'] !== null) {
                        registeredDate = device['Events.Registered'];
                    }
                    // Method 3: Bracket notation on Events object
                    else if (device.Events && device.Events['Registered'] !== undefined && device.Events['Registered'] !== null) {
                        registeredDate = device.Events['Registered'];
                    }
                    // Method 4: Use getNestedValue helper (like modemType does)
                    else {
                        // Try using getNestedValue helper function (if available) or manual traversal
                        const parts = 'Events.Registered'.split('.');
                        let current = device;
                        for (const part of parts) {
                            if (current && typeof current === 'object' && current.hasOwnProperty(part)) {
                                current = current[part];
                            } else {
                                current = undefined;
                                break;
                            }
                        }
                        if (current !== undefined && current !== null) {
                            registeredDate = current;
                        } else {
                            // Device doesn't have Events.Registered
                            return false;
                        }
                    }
                    
                    // Handle parameter format with _value wrapper (like VirtualParameters.getSerialNumber or modemType)
                    // Based on test: VirtualParameters.getSerialNumber has structure {_value, _type, _timestamp, _writable}
                    // So Events.Registered might have the same structure
                    if (registeredDate && typeof registeredDate === 'object' && registeredDate.hasOwnProperty('_value')) {
                        // Extract _value
                        const rawValue = registeredDate._value;
                        // Check _type to determine if it's a date/time
                        if (registeredDate._type && (registeredDate._type.includes('date') || registeredDate._type.includes('time'))) {
                            // _value might be string (ISO) or number (timestamp)
                            if (typeof rawValue === 'string') {
                                registeredDate = new Date(rawValue).getTime();
                            } else if (typeof rawValue === 'number') {
                                // Timestamp in milliseconds or seconds
                                registeredDate = rawValue > 1000000000000 ? rawValue : rawValue * 1000;
                            } else {
                                registeredDate = rawValue;
                            }
                        } else {
                            // Even if _type doesn't indicate date, if _value is a string that looks like ISO date, parse it
                            if (typeof rawValue === 'string' && /^\d{4}-\d{2}-\d{2}/.test(rawValue)) {
                                registeredDate = new Date(rawValue).getTime();
                            } else {
                                // Not a date, use _value directly
                                registeredDate = rawValue;
                            }
                        }
                    }
                    
                    // Convert to timestamp (milliseconds)
                    let registeredTimestamp = null;
                    if (typeof registeredDate === 'number') {
                        // Timestamp: check if milliseconds or seconds
                        registeredTimestamp = registeredDate > 1000000000000 ? registeredDate : registeredDate * 1000;
                    } else if (typeof registeredDate === 'string') {
                        // ISO string or date string: parse it
                        registeredTimestamp = new Date(registeredDate).getTime();
                    } else if (registeredDate instanceof Date) {
                        // Date object: get time
                        registeredTimestamp = registeredDate.getTime();
                    } else {
                        // Try to parse as date
                        registeredTimestamp = new Date(registeredDate).getTime();
                    }
                    
                    // Validate timestamp
                    if (isNaN(registeredTimestamp) || registeredTimestamp <= 0) {
                        console.warn(`[PSB_LIST_DEVICES] Invalid Events.Registered for device ${device._id}:`, registeredDate, `(type: ${typeof registeredDate})`);
                        return false;
                    }
                    
                    // Check if registered within last 24 hours
                    const isNew = registeredTimestamp > oneDayAgo;
                    
                    if (isNew) {
                        const regDateStr = new Date(registeredTimestamp).toISOString();
                        const hoursAgo = Math.round((Date.now() - registeredTimestamp) / 1000 / 60 / 60 * 10) / 10;
                        console.log(`[PSB_LIST_DEVICES] ✓ New device found: ${device._id}, Events.Registered: ${regDateStr} (${hoursAgo} hours ago)`);
                    }
                    
                    return isNew;
                });
                
                console.log(`[PSB_LIST_DEVICES] After new filter: ${filteredDevices.length} new devices found (from ${response.data.length} total)`);
                
                // Log all new devices for debugging
                if (filteredDevices.length > 0) {
                    console.log(`[PSB_LIST_DEVICES] ✓ New devices list:`);
                    filteredDevices.forEach(dev => {
                        const regDate = dev.Events?.Registered;
                        const regDateStr = regDate ? new Date(regDate).toISOString() : 'N/A';
                        const hoursAgo = regDate ? Math.round((Date.now() - new Date(regDate).getTime()) / 1000 / 60 / 60 * 10) / 10 : 'N/A';
                        console.log(`  - ${dev._id}: Events.Registered = ${regDateStr} (${hoursAgo} hours ago)`);
                    });
                } else {
                    console.warn(`[PSB_LIST_DEVICES] ⚠️ No new devices found. Checking sample devices with Events...`);
                    // Log first 5 devices with Events to see their Events.Registered
                    const devicesWithEvents = response.data.filter(d => d.Events && d.Events.Registered).slice(0, 5);
                    if (devicesWithEvents.length > 0) {
                        devicesWithEvents.forEach(dev => {
                            const regDate = dev.Events.Registered;
                            const regDateStr = new Date(regDate).toISOString();
                            const hoursAgo = Math.round((Date.now() - new Date(regDate).getTime()) / 1000 / 60 / 60 * 10) / 10;
                            console.log(`  Sample device ${dev._id}: Events.Registered = ${regDateStr} (${hoursAgo} hours ago)`);
                        });
                    } else {
                        console.warn(`[PSB_LIST_DEVICES] ⚠️ No devices found with Events.Registered in response!`);
                    }
                }
            }
            // Apply Serial Number filter if provided (for any filter type)
            // For 'by-sn' filter, Serial Number filter is required and will be applied
            if (serialNumberFilter) {
                const beforeSNFilter = filteredDevices.length;
                filteredDevices = filteredDevices.filter(device => {
                    // Extract Serial Number (same logic as in mapping below)
                    const ddInfo = device.Device?.DeviceInfo;
                    const igdInfo = device.InternetGatewayDevice?.DeviceInfo;
                    
                    let serialNumber = null;
                    
                    // Try Device.DeviceInfo first
                    if (ddInfo) {
                        serialNumber = ddInfo.SerialNumber?._value || null;
                    }
                    
                    // Try InternetGatewayDevice.DeviceInfo (fill in if not found)
                    if (igdInfo && !serialNumber) {
                        serialNumber = igdInfo.SerialNumber?._value || null;
                    }
                    
                    // Try alternative paths if still not found
                    if (!serialNumber) {
                        const configSerialNumber = extractParameterValue(device, 'serialNumber');
                        if (configSerialNumber && typeof configSerialNumber === 'string') {
                            serialNumber = configSerialNumber;
                        } else {
                            // Fallback to direct access without _value wrapper
                            serialNumber = device.Device?.DeviceInfo?.SerialNumber || 
                                          device.InternetGatewayDevice?.DeviceInfo?.SerialNumber || 
                                          null;
                            // If it's an object, try to get _value
                            if (serialNumber && typeof serialNumber === 'object') {
                                serialNumber = serialNumber._value || serialNumber.value || serialNumber;
                            }
                            // If still not a string, try other possible paths
                            if (typeof serialNumber !== 'string' || !serialNumber) {
                                // Try VirtualParameters (some devices store SN here)
                                serialNumber = device.VirtualParameters?.serialNumber?._value || 
                                              device.VirtualParameters?.serialNumber ||
                                              null;
                                // Try _serialNumber at root level
                                if (!serialNumber) {
                                    serialNumber = device._serialNumber?._value || device._serialNumber || null;
                                }
                                // Final check - if still not string, set to null
                                if (serialNumber && typeof serialNumber === 'object') {
                                    serialNumber = serialNumber._value || serialNumber.value || null;
                                }
                                if (typeof serialNumber !== 'string') {
                                    serialNumber = null;
                                }
                            }
                        }
                    }
                    
                    // Case-insensitive search
                    if (serialNumber && typeof serialNumber === 'string') {
                        return serialNumber.toLowerCase().includes(serialNumberFilter.toLowerCase());
                    }
                    
                    return false; // Exclude devices without serial number or non-matching
                });
                
                console.log(`[PSB_LIST_DEVICES] Serial Number filter "${serialNumberFilter}": ${filteredDevices.length} devices (from ${beforeSNFilter} before filter)`);
            }
            
            const mappedDevices = filteredDevices.map(device => {
                const currentPPPUsername = device.InternetGatewayDevice?.WANDevice?.['1']?.WANConnectionDevice?.['1']?.WANPPPConnection?.['1']?.Username?._value || 
                                          device.Device?.WANDevice?.['1']?.WANConnectionDevice?.['1']?.WANPPPConnection?.['1']?.Username?._value || 
                                          'tes@hw'; // Default jika tidak ada
                
                // Handle Events.Registered - accessed like VirtualParameters.RXPower
                // Try different access methods
                let registeredDate = null;
                if (device.Events && device.Events.Registered !== undefined && device.Events.Registered !== null) {
                    registeredDate = device.Events.Registered;
                } else if (device['Events.Registered'] !== undefined && device['Events.Registered'] !== null) {
                    registeredDate = device['Events.Registered'];
                }
                
                // Handle parameter format with _value wrapper
                if (registeredDate && typeof registeredDate === 'object' && registeredDate._value !== undefined) {
                    registeredDate = registeredDate._value;
                }
                
                let registeredTimestamp = null;
                if (registeredDate !== undefined && registeredDate !== null) {
                    if (typeof registeredDate === 'number') {
                        registeredTimestamp = registeredDate;
                    } else {
                        registeredTimestamp = new Date(registeredDate).getTime();
                        if (isNaN(registeredTimestamp)) {
                            registeredTimestamp = null;
                        }
                    }
                }
                
                // Ensure deviceId is the _id from GenieACS (this is what will be used for registration)
                const deviceId = device._id;
                
                // Extract Serial Number with multiple path attempts (similar to lib/wifi.js)
                const ddInfo = device.Device?.DeviceInfo;
                const igdInfo = device.InternetGatewayDevice?.DeviceInfo;
                
                let serialNumber = null;
                let model = null;
                let manufacturer = null;
                
                // Try Device.DeviceInfo first
                if (ddInfo) {
                    serialNumber = ddInfo.SerialNumber?._value || serialNumber;
                    model = ddInfo.ModelName?._value || model;
                    manufacturer = ddInfo.Manufacturer?._value || manufacturer;
                }
                
                // Try InternetGatewayDevice.DeviceInfo (fill in if not found)
                if (igdInfo) {
                    serialNumber = serialNumber || igdInfo.SerialNumber?._value || null;
                    model = model || igdInfo.ModelName?._value || null;
                    manufacturer = manufacturer || igdInfo.Manufacturer?._value || null;
                }
                
                // Try alternative paths if still not found
                if (!serialNumber) {
                    // Try using parameter configuration (customizable paths)
                    const configSerialNumber = extractParameterValue(device, 'serialNumber');
                    if (configSerialNumber && typeof configSerialNumber === 'string') {
                        serialNumber = configSerialNumber;
                    } else {
                        // Fallback to direct access without _value wrapper
                        serialNumber = device.Device?.DeviceInfo?.SerialNumber || 
                                      device.InternetGatewayDevice?.DeviceInfo?.SerialNumber || 
                                      null;
                        // If it's an object, try to get _value
                        if (serialNumber && typeof serialNumber === 'object') {
                            serialNumber = serialNumber._value || serialNumber.value || serialNumber;
                        }
                        // If still not a string, try other possible paths
                        if (typeof serialNumber !== 'string' || !serialNumber) {
                            // Try VirtualParameters (some devices store SN here)
                            serialNumber = device.VirtualParameters?.serialNumber?._value || 
                                          device.VirtualParameters?.serialNumber ||
                                          null;
                            // Try _serialNumber at root level
                            if (!serialNumber) {
                                serialNumber = device._serialNumber?._value || device._serialNumber || null;
                            }
                            // Final check - if still not string, set to null
                            if (serialNumber && typeof serialNumber === 'object') {
                                serialNumber = serialNumber._value || serialNumber.value || null;
                            }
                            if (typeof serialNumber !== 'string') {
                                serialNumber = null;
                            }
                        }
                    }
                }
                
                if (!manufacturer) {
                    manufacturer = device.Device?.DeviceInfo?.Manufacturer || 
                                 device.InternetGatewayDevice?.DeviceInfo?.Manufacturer || 
                                 null;
                    if (manufacturer && typeof manufacturer === 'object' && manufacturer._value) {
                        manufacturer = manufacturer._value;
                    } else if (typeof manufacturer !== 'string') {
                        manufacturer = null;
                    }
                }
                
                // Log warning if Serial Number is still missing (it's important!)
                if (!serialNumber) {
                    console.warn(`[PSB_LIST_DEVICES] Serial Number not found for device ${deviceId}.`);
                    console.warn(`[PSB_LIST_DEVICES] Device structure:`, JSON.stringify({
                        hasDevice: !!device.Device,
                        hasDeviceInfo: !!device.Device?.DeviceInfo,
                        hasIGD: !!device.InternetGatewayDevice,
                        hasIGDInfo: !!device.InternetGatewayDevice?.DeviceInfo,
                        deviceKeys: device.Device ? Object.keys(device.Device) : [],
                        igdKeys: device.InternetGatewayDevice ? Object.keys(device.InternetGatewayDevice) : []
                    }, null, 2));
                }
                
                return {
                    deviceId: deviceId, // This is the _id from GenieACS - used for device registration
                    serialNumber: serialNumber || 'N/A', // Serial Number is important, show N/A if not found
                    model: model || 'N/A',
                    manufacturer: manufacturer || 'N/A',
                    currentPPPUsername: currentPPPUsername,
                    lastInform: device._lastInform ? new Date(device._lastInform).toISOString() : null,
                    registeredDate: registeredDate || null,
                    registeredTimestamp: registeredTimestamp
                };
            });
            
            return res.json({
                status: 200,
                message: `Devices berhasil diambil (filter: ${filterType})`,
                data: mappedDevices,
                filter: filterType,
                count: mappedDevices.length
            });
        } else {
            return res.status(404).json({
                status: 404,
                message: 'Tidak ada device ditemukan di GenieACS'
            });
        }
    } catch (error) {
        console.error('[PSB_LIST_DEVICES_ERROR]', error);
        console.error('[PSB_LIST_DEVICES_ERROR] Stack:', error.stack);
        
        // Handle specific error cases
        if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
            return res.status(503).json({
                status: 503,
                message: 'GenieACS tidak dapat dijangkau. Pastikan server GenieACS berjalan.',
                error: error.message
            });
        }
        
        if (error.response) {
            return res.status(error.response.status || 500).json({
                status: error.response.status || 500,
                message: 'Error dari GenieACS',
                error: error.response.data || error.message
            });
        }
        
        return res.status(500).json({
            status: 500,
            message: 'Gagal mengambil list devices dari GenieACS',
            error: error.message
        });
    }
});

// POST /api/psb/update-device-config - Update konfigurasi device di GenieACS (PPP & WiFi)
router.post('/psb/update-device-config', ensureAuthenticatedStaff, async (req, res) => {
    try {
        const { deviceId, pppUsername, pppPassword, wifiSSID, wifiPassword, ssidIndex = 1 } = req.body;
        
        if (!deviceId) {
            return res.status(400).json({
                status: 400,
                message: 'Device ID harus diisi'
            });
        }
        
        const parameterValues = [];
        
        // 1. Update PPP Username (jika diisi)
        if (pppUsername) {
            // Try multiple possible paths untuk compatibility dengan berbagai device
            parameterValues.push([
                `InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.Username`,
                pppUsername,
                "xsd:string"
            ]);
            // Also try Device path as fallback
            parameterValues.push([
                `Device.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.Username`,
                pppUsername,
                "xsd:string"
            ]);
        }
        
        // 2. Update PPP Password (jika diisi)
        if (pppPassword) {
            parameterValues.push([
                `InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.Password`,
                pppPassword,
                "xsd:string"
            ]);
            parameterValues.push([
                `Device.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.Password`,
                pppPassword,
                "xsd:string"
            ]);
        }
        
        // 3. Update WiFi SSID (jika diisi)
        if (wifiSSID) {
            parameterValues.push([
                `InternetGatewayDevice.LANDevice.1.WLANConfiguration.${ssidIndex}.SSID`,
                wifiSSID,
                "xsd:string"
            ]);
        }
        
        // 4. Update WiFi Password (jika diisi)
        if (wifiPassword) {
            parameterValues.push([
                `InternetGatewayDevice.LANDevice.1.WLANConfiguration.${ssidIndex}.PreSharedKey.1.PreSharedKey`,
                wifiPassword,
                "xsd:string"
            ]);
        }
        
        if (parameterValues.length === 0) {
            return res.status(400).json({
                status: 400,
                message: 'Tidak ada parameter yang perlu diupdate. Minimal harus ada salah satu: pppUsername, pppPassword, wifiSSID, atau wifiPassword'
            });
        }
        
        // Send update request to GenieACS
        const response = await axios.post(
            `${global.config.genieacsBaseUrl}/devices/${encodeURIComponent(deviceId)}/tasks?connection_request`,
            {
                name: 'setParameterValues',
                parameterValues: parameterValues
            },
            { timeout: 30000 }
        );
        
        if (response.status === 200 || response.status === 202) {
            return res.json({
                status: 200,
                message: 'Konfigurasi device berhasil diupdate',
                data: {
                    deviceId: deviceId,
                    updatedParameters: parameterValues.length,
                    parameters: parameterValues.map(p => p[0])
                }
            });
        } else {
            throw new Error(`GenieACS returned status ${response.status}`);
        }
        
    } catch (error) {
        console.error('[UPDATE_DEVICE_CONFIG_ERROR]', error);
        
        // Handle specific error cases
        if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
            return res.status(503).json({
                status: 503,
                message: 'GenieACS tidak dapat dijangkau. Pastikan server GenieACS berjalan.',
                error: error.message
            });
        }
        
        if (error.response) {
            return res.status(error.response.status || 500).json({
                status: error.response.status || 500,
                message: 'Error dari GenieACS saat update konfigurasi',
                error: error.response.data || error.message
            });
        }
        
        return res.status(500).json({
            status: 500,
            message: 'Gagal update konfigurasi device',
            error: error.message
        });
    }
});

// POST /api/psb/update-status - Update status PSB (untuk teknisi meluncur, dll)
router.post('/psb/update-status', ensureAuthenticatedStaff, rateLimit('psb-update-status', 10, 60000), async (req, res) => {
    try {
        const { customerId, status } = req.body;
        
        if (!customerId || !status) {
            return res.status(400).json({
                status: 400,
                message: 'Customer ID dan status harus diisi'
            });
        }
        
        // Use lock to prevent race condition when updating same PSB record
        return await withLock(`psb-update-status-${customerId}`, async () => {
            // Validasi status yang diizinkan
            const allowedStatuses = ['teknisi_meluncur', 'phase1_completed', 'phase2_completed'];
            if (!allowedStatuses.includes(status)) {
                return res.status(400).json({
                    status: 400,
                    message: `Status tidak valid. Status yang diizinkan: ${allowedStatuses.join(', ')}`
                });
            }
            
            // Cari PSB record
            const psbRecordIndex = (global.psbRecords || []).findIndex(r => String(r.id) === String(customerId));
            if (psbRecordIndex === -1) {
                return res.status(404).json({
                    status: 404,
                    message: 'Customer tidak ditemukan di database PSB'
                });
            }
            
            const psbRecord = global.psbRecords[psbRecordIndex];
            
            // Simpan status lama untuk log
            const oldStatus = psbRecord.psb_status;
            
            // Validasi transisi status
            if (status === 'teknisi_meluncur' && psbRecord.psb_status !== 'phase1_completed') {
                return res.status(400).json({
                    status: 400,
                    message: `Status tidak dapat diubah ke 'teknisi_meluncur'. Status saat ini harus 'phase1_completed'. Status saat ini: ${psbRecord.psb_status}`
                });
            }
            
            // Update status
            await updatePSBRecord(customerId, {
                psb_status: status
            });
            
            // Update in memory
            psbRecord.psb_status = status;
            global.psbRecords[psbRecordIndex] = psbRecord;
            
            // Jika status adalah teknisi_meluncur, kirim notifikasi
            if (status === 'teknisi_meluncur') {
                try {
                    // Get teknisi info
                    const teknisiInfo = {
                        name: req.user.name || req.user.username || 'Teknisi',
                        phone_number: req.user.phone_number || null
                    };
                    
                    await sendPSBTeknisiMeluncurNotification(psbRecord, teknisiInfo);
                } catch (notifErr) {
                    console.error('[PSB_UPDATE_STATUS] Notification error:', notifErr);
                    // Continue even if notification fails
                }
            }
            
            // Log activity
            try {
                await logActivity({
                    userId: req.user.id,
                    username: req.user.username,
                    role: req.user.role,
                    actionType: 'UPDATE',
                    resourceType: 'psb',
                    resourceId: customerId.toString(),
                    resourceName: psbRecord.name,
                    description: `PSB status updated to ${status} for ${psbRecord.name}`,
                    oldValue: { psb_status: oldStatus },
                    newValue: { psb_status: status },
                    ipAddress: req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'],
                    userAgent: req.headers['user-agent']
                });
            } catch (logErr) {
                console.error('[PSB_UPDATE_STATUS] Activity log error:', logErr);
            }
            
            return res.json({
                status: 200,
                message: `Status berhasil diupdate menjadi '${status}'`,
                data: {
                    customerId: customerId,
                    status: status
                }
            });
        });
    } catch (error) {
        console.error('[PSB_UPDATE_STATUS_ERROR]', error);
        return res.status(500).json({
            status: 500,
            message: error.message === `Could not acquire lock for psb-update-status-${req.body.customerId}`
                ? 'Status sedang diproses. Silakan coba lagi.'
                : 'Gagal update status',
            error: error.message
        });
    }
});

// GET /api/psb/validate-pppoe-username - Pre-validate PPPoE username sebelum submit Phase 3
router.get('/psb/validate-pppoe-username', ensureAuthenticatedStaff, async (req, res) => {
    try {
        const { username } = req.query;
        
        if (!username || typeof username !== 'string' || username.trim() === '') {
            return res.status(400).json({
                status: 400,
                message: 'Username tidak boleh kosong',
                available: false
            });
        }
        
        const usernameTrimmed = username.trim();
        
        // Check if username already exists in MikroTik
        try {
            const exists = await checkPPPoEUserExists(usernameTrimmed);
            
            return res.status(200).json({
                status: 200,
                available: !exists,
                message: exists 
                    ? `Username "${usernameTrimmed}" sudah ada di MikroTik. Silakan gunakan username lain.`
                    : `Username "${usernameTrimmed}" tersedia.`
            });
        } catch (mikrotikError) {
            // If MikroTik connection error, still allow but warn
            console.warn('[PSB_VALIDATE_USERNAME] MikroTik check failed:', mikrotikError.message);
            return res.status(200).json({
                status: 200,
                available: true, // Allow if check fails (MikroTik might be down)
                message: `Tidak dapat mengecek username (${mikrotikError.message}). Silakan coba lagi.`,
                warning: true
            });
        }
    } catch (error) {
        console.error('[PSB_VALIDATE_USERNAME_ERROR]', error);
        return res.status(500).json({
            status: 500,
            message: 'Gagal mengecek username',
            available: false,
            error: error.message
        });
    }
});

// GET /api/psb/test-connections - Test koneksi ke GenieACS dan MikroTik
router.get('/psb/test-connections', ensureAuthenticatedStaff, async (req, res) => {
    try {
        const results = {
            genieacs: { connected: false, message: '' },
            mikrotik: { connected: false, message: '' },
            device: { online: false, message: '', deviceId: req.query.deviceId || null }
        };
        
        // Test GenieACS connection
        if (global.config?.genieacsBaseUrl) {
            try {
                const response = await axios.get(`${global.config.genieacsBaseUrl}/devices`, { timeout: 5000 });
                results.genieacs.connected = response.status === 200 || response.status === 404; // 404 means server is up but no devices
                results.genieacs.message = results.genieacs.connected 
                    ? 'Koneksi GenieACS OK'
                    : `GenieACS returned status ${response.status}`;
            } catch (error) {
                results.genieacs.message = `GenieACS tidak dapat dijangkau: ${error.message}`;
            }
        } else {
            results.genieacs.message = 'GenieACS URL tidak dikonfigurasi';
        }
        
        // Test MikroTik connection (try to get PPP profiles)
        try {
            const { getPPPProfiles } = require('../lib/mikrotik');
            await getPPPProfiles();
            results.mikrotik.connected = true;
            results.mikrotik.message = 'Koneksi MikroTik OK';
        } catch (error) {
            results.mikrotik.message = `MikroTik tidak dapat dijangkau: ${error.message}`;
        }
        
        // Test device online (if deviceId provided)
        if (req.query.deviceId && global.config?.genieacsBaseUrl) {
            try {
                // GenieACS requires query filter format, not direct ID access
                // Use query parameter to find device by _id
                const query = JSON.stringify({ "_id": req.query.deviceId });
                const deviceResponse = await axios.get(
                    `${global.config.genieacsBaseUrl}/devices`,
                    { 
                        params: { query: query },
                        timeout: 5000 
                    }
                );
                
                // Check if device was found in the response array
                const devices = deviceResponse.data;
                const deviceFound = Array.isArray(devices) && devices.length > 0;
                
                results.device.online = deviceFound;
                results.device.message = deviceFound 
                    ? 'Device ditemukan di GenieACS'
                    : 'Device tidak ditemukan di GenieACS';
            } catch (error) {
                results.device.message = `Device tidak dapat dijangkau: ${error.message}`;
            }
        } else if (req.query.deviceId) {
            results.device.message = 'GenieACS URL tidak dikonfigurasi';
        } else {
            results.device.message = 'Device ID tidak disediakan';
        }
        
        const allOk = results.genieacs.connected && results.mikrotik.connected && 
                     (!req.query.deviceId || results.device.online);
        
        return res.status(200).json({
            status: 200,
            allOk: allOk,
            results: results,
            message: allOk 
                ? 'Semua koneksi OK'
                : 'Beberapa koneksi bermasalah. Periksa detail di bawah.'
        });
    } catch (error) {
        console.error('[PSB_TEST_CONNECTIONS_ERROR]', error);
        return res.status(500).json({
            status: 500,
            message: 'Gagal mengetes koneksi',
            error: error.message
        });
    }
});

// POST /api/psb/submit-phase2 - Submit proses pemasangan PSB
router.post('/psb/submit-phase2', ensureAuthenticatedStaff, async (req, res) => {
    try {
        const { 
            customerId, 
            installed_odc_id,
            installed_odp_id, 
            port_number,
            installation_notes
        } = req.body;
        
        // Validasi required fields (ODC dan ODP sekarang optional)
        if (!customerId) {
            return res.status(400).json({
                status: 400,
                message: 'Customer ID harus diisi'
            });
        }
        
        // ODC dan ODP sekarang optional - set to null if not provided
        const installed_odc_id_final = installed_odc_id || null;
        const installed_odp_id_final = installed_odp_id || null;
        
        // Cari PSB record di memory (global.psbRecords)
        const psbRecordIndex = (global.psbRecords || []).findIndex(r => String(r.id) === String(customerId));
        if (psbRecordIndex === -1) {
            return res.status(404).json({
                status: 404,
                message: 'Customer tidak ditemukan di database PSB'
            });
        }
        
        const psbRecord = global.psbRecords[psbRecordIndex];
        
        // Validasi status harus phase1_completed atau teknisi_meluncur
        if (psbRecord.psb_status !== 'phase1_completed' && psbRecord.psb_status !== 'teknisi_meluncur') {
            return res.status(400).json({
                status: 400,
                message: `Customer belum siap untuk instalasi. Status saat ini: ${psbRecord.psb_status || 'unknown'}. Status harus 'phase1_completed' atau 'teknisi_meluncur'.`
            });
        }
        
        // Update PSB record
        const psbData = psbRecord.psb_data || {};
        psbData.phase2_completed_at = new Date().toISOString();
        psbData.installed_odc_id = installed_odc_id_final;
        psbData.installed_odp_id = installed_odp_id_final;
        psbData.port_number = port_number || null;
        psbData.installation_notes = installation_notes || null;
        
        // Update in PSB database
        await updatePSBRecord(customerId, {
            psb_status: 'phase2_completed',
            installed_odc_id: installed_odc_id_final,
            installed_odp_id: installed_odp_id_final,
            port_number: port_number || null,
            installation_notes: installation_notes || null,
            phase2_completed_at: new Date().toISOString(),
            psb_data: psbData
        });
        
        // Update in memory
        psbRecord.psb_status = 'phase2_completed';
        psbRecord.installed_odc_id = installed_odc_id_final;
        psbRecord.installed_odp_id = installed_odp_id_final;
        psbRecord.port_number = port_number || null;
        psbRecord.installation_notes = installation_notes || null;
        psbRecord.phase2_completed_at = new Date().toISOString();
        psbRecord.psb_data = psbData;
        global.psbRecords[psbRecordIndex] = psbRecord;
        
        // Log activity
        try {
            await logActivity({
                userId: req.user.id,
                username: req.user.username,
                role: req.user.role,
                actionType: 'UPDATE',
                resourceType: 'psb',
                resourceId: customerId.toString(),
                resourceName: psbRecord.name,
                description: `PSB Phase 2 (Pemasangan) completed for ${psbRecord.name}`,
                oldValue: {
                    psb_status: psbRecord.psb_status,
                    installed_odc_id: psbRecord.installed_odc_id || null,
                    installed_odp_id: psbRecord.installed_odp_id || null
                },
                newValue: {
                    psb_status: 'phase2_completed',
                    installed_odc_id: installed_odc_id_final,
                    installed_odp_id: installed_odp_id_final,
                    port_number: port_number
                },
                ipAddress: req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'],
                userAgent: req.headers['user-agent']
            });
        } catch (logErr) {
            console.error('[PSB_PHASE2] Activity log error:', logErr);
        }
        
        // Send WhatsApp notification to customer
        try {
            await sendPSBInstallationCompleteNotification(psbRecord);
            console.log(`[PSB_PHASE2] Installation complete notification sent to ${psbRecord.phone_number}`);
        } catch (notifErr) {
            console.error('[PSB_PHASE2] Notification error:', notifErr);
            // Don't fail the request if notification fails
        }
        
        return res.json({
            status: 200,
            message: 'Data pemasangan berhasil disimpan',
            data: {
                customerId: customerId,
                name: psbRecord.name,
                phone_number: psbRecord.phone_number,
                installed_odc_id: installed_odc_id_final,
                installed_odp_id: installed_odp_id_final,
                port_number: port_number
            }
        });
        
    } catch (error) {
        console.error('[PSB_PHASE2_ERROR]', error);
        return res.status(500).json({
            status: 500,
            message: 'Gagal menyimpan data pemasangan',
            error: error.message
        });
    }
});

// POST /api/psb/submit-phase3 - Submit setup awal pelanggan PSB (konfigurasi modem)
router.post('/psb/submit-phase3', ensureAuthenticatedStaff, async (req, res) => {
    const transaction = {
        customerId: null,
        pppoeCreated: false,
        deviceUpdated: false
    };
    
    try {
        const { 
            customerId, 
            pppoe_username, 
            pppoe_password, 
            subscription, 
            device_id, 
            wifi_ssid, 
            wifi_password, 
            ssid_index = 1, // Legacy support
            ssid_indices = [] // New: array of SSID indices to update
        } = req.body;
        
        // Use ssid_indices if provided, otherwise fallback to ssid_index
        const ssidIndicesToUpdate = Array.isArray(ssid_indices) && ssid_indices.length > 0 
            ? ssid_indices 
            : [ssid_index];
        
        // Validasi required fields
        if (!customerId || !pppoe_username || !subscription || !device_id || !wifi_ssid || !wifi_password) {
            return res.status(400).json({
                status: 400,
                message: 'Customer ID, PPPoE username, subscription, device ID, WiFi SSID, dan WiFi password harus diisi'
            });
        }
        
        // Cari PSB record di memory (global.psbRecords)
        const psbRecordIndex = (global.psbRecords || []).findIndex(r => String(r.id) === String(customerId));
        if (psbRecordIndex === -1) {
            return res.status(404).json({
                status: 404,
                message: 'Customer tidak ditemukan di database PSB'
            });
        }
        
        const psbRecord = global.psbRecords[psbRecordIndex];
        
        // Validasi status harus phase2_completed
        if (psbRecord.psb_status !== 'phase2_completed') {
            return res.status(400).json({
                status: 400,
                message: `Customer belum menyelesaikan Fase 2 (Pemasangan). Status saat ini: ${psbRecord.psb_status || 'unknown'}`
            });
        }
        
        transaction.customerId = customerId;
        
        // Dapatkan Password PPPoE
        const finalPPPoEPassword = pppoe_password || global.config.defaultPPPoEPassword || generateRandomPassword();
        
        // Dapatkan Profile MikroTik
        const profile = getProfileBySubscription(subscription);
        if (!profile) {
            return res.status(400).json({
                status: 400,
                message: `Profile tidak ditemukan untuk subscription: ${subscription}`
            });
        }
        
        // Registrasi ke MikroTik (PPP Secret)
        // IMPORTANT: Check if user already exists BEFORE adding to MikroTik
        try {
            // The addPPPoEUser function already checks for duplicates in the PHP script
            // but we catch the error here to show user-friendly message
            await addPPPoEUser(pppoe_username, finalPPPoEPassword, profile);
            transaction.pppoeCreated = true;
            console.log(`[PSB_PHASE3] PPPoE user created in MikroTik: ${pppoe_username}`);
        } catch (mikrotikError) {
            console.error('[PSB_PHASE3] MikroTik registration error:', mikrotikError);
            
            // Check if error is about duplicate username (in Indonesian or English)
            const errorMessage = mikrotikError.message || '';
            const isDuplicateError = errorMessage.includes('sudah ada') || 
                errorMessage.includes('already') || 
                errorMessage.includes('Akun PPPoE dengan nama yang sama');
            
            if (isDuplicateError) {
                // CRITICAL: Return error immediately - process STOPS here
                // NO GenieACS update, NO database save, NO user creation
                // This ensures data integrity: if PPPoE already exists in MikroTik, nothing else should be done
                console.error(`[PSB_PHASE3] DUPLICATE PPPoE USER DETECTED - PROCESS STOPPED: ${pppoe_username}`);
                return res.status(400).json({
                    status: 400,
                    message: `PPPoE username "${pppoe_username}" sudah ada di MikroTik. Silakan gunakan username lain.`,
                    error: errorMessage,
                    errorType: 'duplicate_username',
                    stoppedAt: 'mikrotik_registration' // Indicate where process stopped
                });
            }
            
            // Other MikroTik errors - also STOP process (no partial updates)
            console.error(`[PSB_PHASE3] MIKROTIK ERROR - PROCESS STOPPED: ${errorMessage}`);
            return res.status(500).json({
                status: 500,
                message: 'Gagal registrasi ke MikroTik. Pastikan koneksi ke MikroTik berjalan dan username tidak duplikat.',
                error: errorMessage,
                errorType: 'mikrotik_error',
                stoppedAt: 'mikrotik_registration' // Indicate where process stopped
            });
        }
        
        // If we reach here, MikroTik registration was successful
        // Continue with GenieACS update and database save
        
        // PENTING: Load SSID lama dari GenieACS SEBELUM melakukan update untuk log yang lebih detail
        let oldSsidName = null;
        try {
            const { getSSIDInfo } = require('../lib/wifi');
            const ssidInfo = await getSSIDInfo(device_id, true); // skipRefresh = true untuk speed
            if (ssidInfo && ssidInfo.ssid && Array.isArray(ssidInfo.ssid) && ssidInfo.ssid.length > 0) {
                // Cari SSID berdasarkan ssid_index yang akan diubah
                const targetSsidIndex = ssidIndicesToUpdate[0] || ssid_index || '1';
                const oldSsid = ssidInfo.ssid.find(s => String(s.id) === String(targetSsidIndex));
                if (oldSsid && oldSsid.name) {
                    oldSsidName = oldSsid.name;
                    console.log(`[PSB_PHASE3] Found old SSID name: "${oldSsidName}" for SSID index ${targetSsidIndex}`);
                } else {
                    console.log(`[PSB_PHASE3] SSID index ${targetSsidIndex} not found in device, using null for old SSID`);
                }
            } else {
                console.log(`[PSB_PHASE3] No SSID info found in device, using null for old SSID`);
            }
        } catch (ssidInfoError) {
            console.warn(`[PSB_PHASE3] Could not fetch old SSID info from GenieACS: ${ssidInfoError.message}`);
            // Continue dengan oldSsidName = null jika gagal load
        }
        
        // Update Device di GenieACS
        try {
            const updateResponse = await axios.post(
                `${global.config.genieacsBaseUrl}/devices/${encodeURIComponent(device_id)}/tasks?connection_request`,
                {
                    name: 'setParameterValues',
                    parameterValues: [
                        // Update PPP Username
                        [`InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.Username`, pppoe_username, "xsd:string"],
                        [`Device.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.Username`, pppoe_username, "xsd:string"],
                        // Update PPP Password
                        [`InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.Password`, finalPPPoEPassword, "xsd:string"],
                        [`Device.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.Password`, finalPPPoEPassword, "xsd:string"],
                        // Update WiFi SSID and Password for each selected SSID index
                        ...ssidIndicesToUpdate.flatMap(idx => [
                            [`InternetGatewayDevice.LANDevice.1.WLANConfiguration.${idx}.SSID`, wifi_ssid, "xsd:string"],
                            [`InternetGatewayDevice.LANDevice.1.WLANConfiguration.${idx}.PreSharedKey.1.PreSharedKey`, wifi_password, "xsd:string"]
                        ])
                    ]
                },
                { timeout: 30000 }
            );
            
            if (updateResponse.status === 200 || updateResponse.status === 202) {
                transaction.deviceUpdated = true;
                console.log(`[PSB_PHASE2] GenieACS device updated: ${device_id}`);
            } else {
                throw new Error(`GenieACS returned status ${updateResponse.status}`);
            }
        } catch (genieError) {
            console.warn('[PSB_PHASE2] GenieACS update failed, but continuing:', genieError.message);
            // Continue even if GenieACS update fails - teknisi bisa retry manual
            // Tapi tetap log warning
        }
        
        // Update PSB record
        const psbData = psbRecord.psb_data || {};
        psbData.phase3_completed_at = new Date().toISOString();
        // IMPORTANT: Save SSID indices yang dipilih untuk monitoring dan tracking
        psbData.ssid_indices = ssidIndicesToUpdate; // Array of SSID indices yang diupdate
        psbData.wifi_config = {
            ssid: wifi_ssid,
            password: wifi_password,
            ssid_indices: ssidIndicesToUpdate // SSID indices yang dikonfigurasi
        };
        
        // Update in PSB database
        await updatePSBRecord(customerId, {
            pppoe_username: pppoe_username,
            pppoe_password: finalPPPoEPassword,
            device_id: device_id,
            subscription: subscription,
            psb_status: 'completed',
            psb_wifi_ssid: wifi_ssid,
            psb_wifi_password: wifi_password,
            phase3_completed_at: new Date().toISOString(),
            psb_data: psbData
        });
        
        // Update in memory
        psbRecord.pppoe_username = pppoe_username;
        psbRecord.pppoe_password = finalPPPoEPassword;
        psbRecord.device_id = device_id;
        psbRecord.subscription = subscription;
        psbRecord.psb_status = 'completed';
        psbRecord.psb_wifi_ssid = wifi_ssid;
        psbRecord.psb_wifi_password = wifi_password;
        psbRecord.phase3_completed_at = new Date().toISOString();
        psbRecord.psb_data = psbData;
        global.psbRecords[psbRecordIndex] = psbRecord;
        
        // Move completed PSB record to users table
        // PSB ID is temporary, will get new sequential ID from users.sqlite
        const newUserId = await movePSBToUsers(psbRecord);
        
        // Add to global.users with new ID (not PSB ID)
        // IMPORTANT: Save SSID indices to bulk field (same as other user creation)
        // CRITICAL: Format bulk sebagai ARRAY (bukan string JSON) agar konsisten dengan format dari database
        // Database menyimpan sebagai JSON string, tapi saat load di lib/database.js di-parse menjadi array
        // Jadi di memory, bulk harus selalu array agar konsisten
        const bulkSSIDs = ssidIndicesToUpdate.map(idx => String(idx)); // Convert to string array for bulk field
        
        const newUser = {
            id: newUserId, // Use new ID from database, not PSB ID
            name: psbRecord.name,
            phone_number: psbRecord.phone_number,
            address: psbRecord.address,
            latitude: psbRecord.latitude,
            longitude: psbRecord.longitude,
            location_url: psbRecord.location_url,
            subscription: subscription,
            device_id: device_id,
            paid: false,
            pppoe_username: pppoe_username,
            pppoe_password: finalPPPoEPassword,
            connected_odp_id: psbRecord.installed_odp_id || psbRecord.odp_id,
            bulk: bulkSSIDs, // IMPORTANT: Array, bukan string JSON (konsisten dengan format dari database setelah di-parse)
            send_invoice: 0,
            is_corporate: 0,
            created_at: psbRecord.created_at,
            updated_at: new Date().toISOString()
        };
        
        // Add new user to memory (with new ID)
        global.users.push(newUser);
        console.log(`[PSB_PHASE3] Added user with new ID ${newUserId} to global.users (PSB temporary ID was ${psbRecord.id})`);
        console.log(`[PSB_PHASE3] User bulk SSIDs: ${JSON.stringify(bulkSSIDs)}`);
        
        // Log activity
        try {
            await logActivity({
                userId: req.user.id,
                username: req.user.username,
                role: req.user.role,
                actionType: 'UPDATE',
                resourceType: 'user',
                resourceId: customerId.toString(),
                resourceName: psbRecord.name,
                description: `PSB Phase 3 (Setup Awal Pelanggan) completed for ${psbRecord.name}`,
                oldValue: {
                    psb_status: 'phase2_completed',
                    subscription: null,
                    device_id: null,
                    pppoe_username: null
                },
                newValue: {
                    psb_status: 'completed',
                    subscription: subscription,
                    device_id: device_id,
                    pppoe_username: pppoe_username,
                    wifi_ssid: wifi_ssid
                },
                ipAddress: req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'],
                userAgent: req.headers['user-agent']
            });
        } catch (logErr) {
            console.error('[PSB_PHASE3] Activity log error:', logErr);
        }
        
        // Log WiFi configuration to WiFi logs for monitoring
        // PENTING: oldSsidName sudah di-load SEBELUM update device (di atas)
        try {
            await logWifiChange({
                userId: newUserId.toString(), // Use final user ID
                deviceId: device_id,
                changeType: 'both', // Both SSID name and password
                changes: {
                    oldSsidName: oldSsidName, // PENTING: Gunakan SSID lama yang sudah di-load dari GenieACS sebelum update
                    newSsidName: wifi_ssid,
                    oldPassword: null, // Password tidak terdeteksi di GenieACS
                    newPassword: wifi_password,
                    passwordChanged: true,
                    ssidNameChanged: true,
                    ssidId: ssidIndicesToUpdate[0] || ssid_index || '1' // Tambahkan SSID index untuk referensi
                },
                changedBy: req.user.username || req.user.name || 'System',
                changeSource: 'web_technician',
                customerName: psbRecord.name,
                customerPhone: psbRecord.phone_number,
                reason: 'PSB Setup - Konfigurasi WiFi awal pelanggan',
                notes: `PSB Phase 3 setup. Paket: ${subscription}`,
                ipAddress: req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'],
                userAgent: req.headers['user-agent']
            });
            console.log(`[PSB_PHASE3] WiFi configuration logged for user ${newUserId}, device ${device_id}, old SSID: "${oldSsidName || 'null'}" → new SSID: "${wifi_ssid}"`);
        } catch (wifiLogErr) {
            console.error('[PSB_PHASE3] WiFi log error:', wifiLogErr);
            // Continue even if WiFi logging fails
        }
        
        // Send WhatsApp notification
        try {
            // Prepare user object with subscription for notification
            const userForNotification = {
                ...psbRecord,
                subscription: subscription // Use subscription from request
            };
            await sendPSBPhase2Notification(userForNotification, {
                pppoe_username: pppoe_username,
                pppoe_password: finalPPPoEPassword,
                wifi_ssid: wifi_ssid,
                wifi_password: wifi_password
            });
        } catch (notifErr) {
            console.error('[PSB_PHASE3] Notification error:', notifErr);
            // Continue even if notification fails
        }
        
        return res.json({
            status: 200,
            message: 'PSB Phase 3 (Setup Awal Pelanggan) berhasil diselesaikan',
            data: {
                psbCustomerId: customerId, // Temporary PSB ID (antrian)
                finalUserId: newUserId, // Final user ID from users.sqlite (sequential)
                name: psbRecord.name,
                pppoe_username: pppoe_username,
                pppoe_password: finalPPPoEPassword, // Include password untuk summary modal
                wifi_ssid: wifi_ssid,
                wifi_password: wifi_password, // Include password untuk summary modal
                device_id: device_id,
                mikrotikRegistered: transaction.pppoeCreated,
                genieacsUpdated: transaction.deviceUpdated
            }
        });
        
    } catch (error) {
        console.error('[PSB_PHASE3_ERROR]', error);
        
        // Rollback logic
        if (transaction.pppoeCreated) {
            // Optionally delete PPPoE user from MikroTik
            // Tapi karena user sudah dibuat, mungkin lebih baik keep it
            console.warn('[PSB_PHASE3_ROLLBACK] PPPoE user created but process failed:', error.message);
        }
        
        return res.status(500).json({
            status: 500,
            message: 'Gagal menyelesaikan PSB Phase 3',
            error: error.message
        });
    }
});

// POST /api/psb/delete-all - Delete all PSB records with password verification
router.post('/psb/delete-all', ensureAdmin, async (req, res) => {
    try {
        const { password } = req.body;
        
        // Validate password is provided
        if (!password) {
            return res.status(400).json({
                status: 400,
                message: 'Password diperlukan untuk konfirmasi'
            });
        }
        
        // Verify password against current user
        const currentUser = global.accounts.find(acc => acc.username === req.user.username);
        if (!currentUser) {
            return res.status(401).json({
                status: 401,
                message: 'User tidak ditemukan'
            });
        }
        
        // Compare password
        const isPasswordValid = await comparePassword(password, currentUser.password);
        if (!isPasswordValid) {
            return res.status(401).json({
                status: 401,
                message: 'Password salah'
            });
        }
        
        // Get count before delete
        const recordCount = (global.psbRecords || []).length;
        
        if (recordCount === 0) {
            return res.json({
                status: 200,
                message: 'Tidak ada data PSB untuk dihapus',
                deletedCount: 0
            });
        }
        
        // Delete all PSB records from database
        const { deletePSBRecord } = require('../lib/psb-database');
        
        // Get PSB database connection
        if (!global.psbDb) {
            return res.status(500).json({
                status: 500,
                message: 'Database PSB tidak tersedia'
            });
        }
        
        // Delete all records from database
        await new Promise((resolve, reject) => {
            global.psbDb.run('DELETE FROM psb_records', function(err) {
                if (err) {
                    console.error('[PSB_DELETE_ALL] Database error:', err);
                    reject(err);
                } else {
                    console.log(`[PSB_DELETE_ALL] Deleted ${this.changes} records from database`);
                    resolve(this.changes);
                }
            });
        });
        
        // Clear memory
        global.psbRecords = [];
        
        // Log activity
        try {
            await logActivity({
                userId: req.user.id,
                username: req.user.username,
                role: req.user.role,
                actionType: 'DELETE',
                resourceType: 'psb',
                resourceId: 'all',
                resourceName: 'All PSB Records',
                description: `Deleted all ${recordCount} PSB records`,
                oldValue: { count: recordCount },
                newValue: { count: 0 },
                ipAddress: req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'],
                userAgent: req.headers['user-agent']
            });
        } catch (logErr) {
            console.error('[PSB_DELETE_ALL] Activity log error:', logErr);
        }
        
        console.log(`[PSB_DELETE_ALL] User ${req.user.username} deleted all ${recordCount} PSB records`);
        
        return res.json({
            status: 200,
            message: `Berhasil menghapus ${recordCount} data PSB`,
            deletedCount: recordCount
        });
        
    } catch (error) {
        console.error('[PSB_DELETE_ALL_ERROR]', error);
        return res.status(500).json({
            status: 500,
            message: 'Gagal menghapus data PSB',
            error: error.message
        });
    }
});

// ============================================
// IMPORT MIKROTIK ENDPOINTS
// ============================================

// GET /api/mikrotik/unregistered-pppoe - Get PPPoE users from MikroTik that are not registered in system
router.get('/mikrotik/unregistered-pppoe', ensureAdmin, async (req, res) => {
    try {
        const { getAllPPPoESecrets } = require('../lib/mikrotik');
        
        // Get all PPPoE secrets from MikroTik
        const mikrotikSecrets = await getAllPPPoESecrets();
        
        if (!mikrotikSecrets || mikrotikSecrets.length === 0) {
            return res.json({
                status: 200,
                message: 'Tidak ada PPPoE secrets di MikroTik',
                data: [],
                stats: { total: 0, registered: 0, unregistered: 0 }
            });
        }
        
        // Get registered PPPoE usernames from system
        const registeredUsernames = new Set(
            (global.users || [])
                .filter(u => u.pppoe_username)
                .map(u => u.pppoe_username.toLowerCase())
        );
        
        // Filter unregistered PPPoE users
        const unregisteredSecrets = mikrotikSecrets.filter(secret => {
            const username = (secret.name || '').toLowerCase();
            return username && !registeredUsernames.has(username);
        });
        
        // Get available packages for profile mapping
        const packages = global.packages || [];
        
        // Map profile to package
        const profileToPackage = {};
        packages.forEach(pkg => {
            if (pkg.profile) {
                profileToPackage[pkg.profile.toLowerCase()] = {
                    name: pkg.name,
                    price: pkg.price,
                    profile: pkg.profile
                };
            }
        });
        
        // Enhance unregistered secrets with package info
        const enhancedSecrets = unregisteredSecrets.map(secret => {
            const profileLower = (secret.profile || '').toLowerCase();
            const matchedPackage = profileToPackage[profileLower] || null;
            
            return {
                ...secret,
                matchedPackage: matchedPackage,
                packageName: matchedPackage ? matchedPackage.name : null,
                packagePrice: matchedPackage ? matchedPackage.price : null
            };
        });
        
        return res.json({
            status: 200,
            message: `Ditemukan ${enhancedSecrets.length} PPPoE yang belum terdaftar`,
            data: enhancedSecrets,
            stats: {
                total: mikrotikSecrets.length,
                registered: registeredUsernames.size,
                unregistered: enhancedSecrets.length
            },
            profiles: [...new Set(mikrotikSecrets.map(s => s.profile).filter(Boolean))],
            packages: packages.map(p => ({ name: p.name, profile: p.profile, price: p.price }))
        });
        
    } catch (error) {
        console.error('[MIKROTIK_UNREGISTERED_ERROR]', error);
        return res.status(500).json({
            status: 500,
            message: 'Gagal mengambil data dari MikroTik',
            error: error.message
        });
    }
});

// GET /api/genieacs/devices-for-import - Get all devices from GenieACS for import matching
router.get('/genieacs/devices-for-import', ensureAdmin, async (req, res) => {
    try {
        if (!global.config?.genieacsBaseUrl) {
            return res.status(400).json({
                status: 400,
                message: 'GenieACS tidak dikonfigurasi'
            });
        }
        
        // Fetch all devices from GenieACS with PPP username info
        const projectionFields = '_id,Device.DeviceInfo,InternetGatewayDevice.DeviceInfo,InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.Username,Device.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.Username';
        
        const response = await axios.get(`${global.config.genieacsBaseUrl}/devices/`, {
            params: {
                projection: projectionFields,
                limit: 1000
            },
            timeout: 30000
        });
        
        if (!response.data || !Array.isArray(response.data)) {
            return res.json({
                status: 200,
                message: 'Tidak ada device di GenieACS',
                data: []
            });
        }
        
        // Get already registered device IDs from users
        const registeredDeviceIds = new Set(
            (global.users || [])
                .filter(u => u.device_id)
                .map(u => u.device_id)
        );
        
        // Process devices
        const devices = response.data.map(device => {
            const deviceId = device._id;
            
            // Get serial number
            const serialNumber = device.InternetGatewayDevice?.DeviceInfo?.SerialNumber?._value ||
                               device.Device?.DeviceInfo?.SerialNumber?._value ||
                               deviceId;
            
            // Get model
            const model = device.InternetGatewayDevice?.DeviceInfo?.ModelName?._value ||
                         device.Device?.DeviceInfo?.ModelName?._value ||
                         device.InternetGatewayDevice?.DeviceInfo?.ProductClass?._value ||
                         device.Device?.DeviceInfo?.ProductClass?._value ||
                         '-';
            
            // Get manufacturer
            const manufacturer = device.InternetGatewayDevice?.DeviceInfo?.Manufacturer?._value ||
                                device.Device?.DeviceInfo?.Manufacturer?._value ||
                                '-';
            
            // Get current PPP username
            const pppUsername = device.InternetGatewayDevice?.WANDevice?.['1']?.WANConnectionDevice?.['1']?.WANPPPConnection?.['1']?.Username?._value ||
                               device.Device?.WANDevice?.['1']?.WANConnectionDevice?.['1']?.WANPPPConnection?.['1']?.Username?._value ||
                               null;
            
            return {
                deviceId: deviceId,
                serialNumber: serialNumber,
                model: model,
                manufacturer: manufacturer,
                pppUsername: pppUsername,
                isRegistered: registeredDeviceIds.has(deviceId)
            };
        });
        
        // Filter out already registered devices (optional - can include all)
        const availableDevices = devices.filter(d => !d.isRegistered);
        
        console.log(`[GENIEACS_DEVICES_FOR_IMPORT] Found ${devices.length} devices, ${availableDevices.length} available for import`);
        
        return res.json({
            status: 200,
            message: `Ditemukan ${availableDevices.length} device tersedia`,
            data: availableDevices,
            stats: {
                total: devices.length,
                registered: devices.length - availableDevices.length,
                available: availableDevices.length
            }
        });
        
    } catch (error) {
        console.error('[GENIEACS_DEVICES_FOR_IMPORT_ERROR]', error);
        return res.status(500).json({
            status: 500,
            message: 'Gagal mengambil data dari GenieACS',
            error: error.message
        });
    }
});

// ==========================================
// VOUCHER SEND ENDPOINTS
// ==========================================

const voucherSentDbPath = path.join(__dirname, '../database/voucher_sent.json');

// Helper: Load voucher sent history
function loadVoucherSentHistory() {
    try {
        if (fs.existsSync(voucherSentDbPath)) {
            return JSON.parse(fs.readFileSync(voucherSentDbPath, 'utf8'));
        }
        return [];
    } catch (error) {
        console.error('[VOUCHER_SENT] Error loading history:', error);
        return [];
    }
}

// Helper: Save voucher sent history
function saveVoucherSentHistory(data) {
    fs.writeFileSync(voucherSentDbPath, JSON.stringify(data, null, 2));
}

// GET /api/voucher/profiles - Get voucher profiles from database
router.get('/voucher/profiles', async (req, res) => {
    try {
        // Load from global.voucher or database/voucher.json
        let profiles = global.voucher || [];
        
        if (!profiles || profiles.length === 0) {
            const voucherDbPath = path.join(__dirname, '../database/voucher.json');
            if (fs.existsSync(voucherDbPath)) {
                profiles = JSON.parse(fs.readFileSync(voucherDbPath, 'utf8'));
            }
        }
        
        console.log(`[VOUCHER_PROFILES] Loaded ${profiles.length} profiles`);
        
        return res.json({
            status: 200,
            message: `Ditemukan ${profiles.length} paket voucher`,
            data: profiles
        });
    } catch (error) {
        console.error('[VOUCHER_PROFILES_ERROR]', error);
        return res.status(500).json({
            status: 500,
            message: 'Gagal memuat paket voucher',
            error: error.message
        });
    }
});

// POST /api/voucher/generate-send - Generate voucher and optionally send via WhatsApp
router.post('/voucher/generate-send', async (req, res) => {
    try {
        const { profile, profileName, duration, quantity, phones, notes, sendWhatsApp, voucherType, customUsername, customPassword } = req.body;
        
        if (!profile) {
            return res.status(400).json({
                status: 400,
                message: 'Profile voucher diperlukan'
            });
        }
        
        const isCustom = voucherType === 'custom';
        let generatedVouchers = [];
        
        if (isCustom) {
            // Custom voucher - tidak generate di MikroTik, hanya kirim pesan
            if (!customUsername || !customPassword) {
                return res.status(400).json({
                    status: 400,
                    message: 'Username dan Password diperlukan untuk voucher custom'
                });
            }
            
            console.log(`[VOUCHER_CUSTOM] Sending custom voucher: ${customUsername}`);
            
            generatedVouchers.push({
                username: customUsername,
                password: customPassword,
                profile: profile,
                type: 'custom'
            });
        } else {
            // Random voucher - generate di MikroTik
            if (!quantity || quantity < 1 || quantity > 50) {
                return res.status(400).json({
                    status: 400,
                    message: 'Jumlah voucher harus antara 1-50'
                });
            }
            
            console.log(`[VOUCHER_GENERATE] Generating ${quantity} vouchers for profile: ${profile}`);
            
            const axios = require('axios');
            
            // Get site_url_bot from config
            const siteUrlBot = global.config?.site_url_bot || `http://127.0.0.1:${process.env.PORT || 3000}`;
            
            for (let i = 0; i < quantity; i++) {
                try {
                    // Call PHP script to generate voucher in MikroTik
                    // Comment format: "vc-BotWa | VoucherSend | {profile} | {date}"
                    const phpUrl = `${siteUrlBot}/adduserhotspot.php?profil=${encodeURIComponent(profile)}&komen=VoucherSend`;
                    console.log(`[VOUCHER_GENERATE] Calling: ${phpUrl}`);
                    
                    const phpResponse = await axios.get(phpUrl, { timeout: 15000 });
                    
                    if (phpResponse.data && phpResponse.data.status === 'success' && phpResponse.data.data) {
                        generatedVouchers.push({
                            username: phpResponse.data.data.username,
                            password: phpResponse.data.data.password,
                            profile: phpResponse.data.data.profile || profile,
                            type: 'random'
                        });
                        console.log(`[VOUCHER_GENERATE] Generated voucher ${i + 1}: ${phpResponse.data.data.username}`);
                    } else {
                        console.error(`[VOUCHER_GENERATE] Failed to generate voucher ${i + 1}:`, phpResponse.data);
                    }
                } catch (err) {
                    console.error(`[VOUCHER_GENERATE] Error generating voucher ${i + 1}:`, err.message);
                }
                
                // Small delay between MikroTik calls
                if (i < quantity - 1) {
                    await new Promise(resolve => setTimeout(resolve, 300));
                }
            }
            
            if (generatedVouchers.length === 0) {
                return res.status(500).json({
                    status: 500,
                    message: 'Gagal generate voucher dari MikroTik. Pastikan koneksi MikroTik aktif.'
                });
            }
        }
        
        // Load message template
        let messageTemplate = '';
        try {
            const templatesPath = path.join(__dirname, '../database/message_templates.json');
            const templates = JSON.parse(fs.readFileSync(templatesPath, 'utf8'));
            
            if (isCustom) {
                messageTemplate = templates.voucher_send_custom?.template || '';
            } else {
                messageTemplate = templates.voucher_send?.template || '';
            }
        } catch (err) {
            console.error('[VOUCHER_GENERATE] Error loading template:', err);
        }
        
        // Default templates if not found
        if (!messageTemplate) {
            if (isCustom) {
                messageTemplate = `🎫 *VOUCHER HOTSPOT*\n\n📦 Paket: *\${nama_paket}*\n⏱️ Durasi: *\${durasi}*\n\n🔐 *KREDENSIAL LOGIN:*\n👤 Username: \`\${username}\`\n🔑 Password: \`\${password}\`\n\n📌 *Cara Penggunaan:*\n1. Hubungkan ke WiFi Hotspot\n2. Buka browser\n3. Masukkan Username & Password di atas\n\n\${catatan}\n\nTerima kasih! 🙏\n*\${nama_wifi}*`;
            } else {
                messageTemplate = `🎫 *VOUCHER HOTSPOT*\n\n📦 Paket: *\${nama_paket}*\n⏱️ Durasi: *\${durasi}*\n\n🔐 *KODE VOUCHER:*\n\${voucher_list}\n\n📌 *Cara Penggunaan:*\n1. Hubungkan ke WiFi Hotspot\n2. Buka browser\n3. Masukkan kode di atas pada Username & Password\n\n\${catatan}\n\nTerima kasih! 🙏\n*\${nama_wifi}*`;
            }
        }
        
        const notesText = notes ? `📝 Catatan: ${notes}` : '';
        const wifiName = global.config?.nama_wifi || 'RAF NET';
        
        // Build message based on type
        let message = '';
        if (isCustom) {
            message = messageTemplate
                .replace(/\$\{nama_paket\}/g, profileName || profile)
                .replace(/\$\{durasi\}/g, duration || '-')
                .replace(/\$\{username\}/g, customUsername)
                .replace(/\$\{password\}/g, customPassword)
                .replace(/\$\{catatan\}/g, notesText)
                .replace(/\$\{nama_wifi\}/g, wifiName);
        } else {
            // Build voucher list text - username = password, so show as single "Kode Voucher"
            const voucherListText = generatedVouchers.map((v, i) => 
                `${generatedVouchers.length > 1 ? `${i+1}. ` : ''}Kode: \`${v.username}\``
            ).join('\n');
            
            message = messageTemplate
                .replace(/\$\{nama_paket\}/g, profileName || profile)
                .replace(/\$\{durasi\}/g, duration || '-')
                .replace(/\$\{voucher_list\}/g, voucherListText)
                .replace(/\$\{catatan\}/g, notesText)
                .replace(/\$\{nama_wifi\}/g, wifiName);
        }
        
        // Send via WhatsApp if requested
        const sentTo = [];
        if (sendWhatsApp && phones && phones.length > 0 && global.conn) {
            for (const phone of phones) {
                try {
                    // Normalize phone number
                    let normalizedPhone = phone.replace(/\D/g, '');
                    if (normalizedPhone.startsWith('0')) {
                        normalizedPhone = '62' + normalizedPhone.substring(1);
                    }
                    if (!normalizedPhone.startsWith('62')) {
                        normalizedPhone = '62' + normalizedPhone;
                    }
                    
                    const jid = normalizedPhone + '@s.whatsapp.net';
                    await global.conn.sendMessage(jid, { text: message });
                    sentTo.push(phone);
                    
                    console.log(`[VOUCHER_SEND] Sent to ${phone}`);
                    
                    // Small delay between sends
                    await new Promise(resolve => setTimeout(resolve, 500));
                } catch (err) {
                    console.error(`[VOUCHER_SEND] Failed to send to ${phone}:`, err.message);
                }
            }
        }
        
        // Save to history
        const history = loadVoucherSentHistory();
        const timestamp = new Date().toISOString();
        
        generatedVouchers.forEach((voucher, index) => {
            history.push({
                id: `VS${Date.now()}${index}`,
                type: isCustom ? 'custom' : 'random',
                profile: profile,
                profile_name: profileName,
                duration: duration,
                username: voucher.username,
                password: voucher.password,
                phone: sendWhatsApp && phones.length > 0 ? phones.join(', ') : null,
                notes: notes,
                sent_status: sendWhatsApp && sentTo.length > 0 ? 'sent' : 'generated',
                created_at: timestamp,
                created_by: req.user?.username || 'admin'
            });
        });
        
        saveVoucherSentHistory(history);
        
        return res.json({
            status: 200,
            message: `Berhasil generate ${generatedVouchers.length} voucher`,
            vouchers: generatedVouchers,
            sentTo: sentTo,
            totalSent: sentTo.length
        });
        
    } catch (error) {
        console.error('[VOUCHER_GENERATE_SEND_ERROR]', error);
        return res.status(500).json({
            status: 500,
            message: 'Terjadi kesalahan',
            error: error.message
        });
    }
});

// GET /api/voucher/sent-history - Get sent voucher history
router.get('/voucher/sent-history', (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const history = loadVoucherSentHistory();
        
        // Sort by created_at descending and limit
        const sorted = history
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
            .slice(0, limit);
        
        return res.json({
            status: 200,
            data: sorted,
            total: history.length
        });
    } catch (error) {
        console.error('[VOUCHER_HISTORY_ERROR]', error);
        return res.status(500).json({
            status: 500,
            message: 'Gagal memuat riwayat',
            error: error.message
        });
    }
});

// GET /api/voucher/sent-stats - Get voucher sent statistics
router.get('/voucher/sent-stats', (req, res) => {
    try {
        const history = loadVoucherSentHistory();
        
        // Today's date
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const todayCount = history.filter(item => {
            const itemDate = new Date(item.created_at);
            itemDate.setHours(0, 0, 0, 0);
            return itemDate.getTime() === today.getTime();
        }).length;
        
        return res.json({
            status: 200,
            today: todayCount,
            total: history.length
        });
    } catch (error) {
        console.error('[VOUCHER_STATS_ERROR]', error);
        return res.status(500).json({
            status: 500,
            message: 'Gagal memuat statistik',
            error: error.message
        });
    }
});

// ==========================================
// MEMBER CREDENTIALS SEND ENDPOINTS
// ==========================================

// POST /api/member/send-credentials - Send member credentials via WhatsApp
router.post('/member/send-credentials', async (req, res) => {
    try {
        const { userId, phones, notes } = req.body;
        
        if (!userId) {
            return res.status(400).json({
                status: 400,
                message: 'User ID diperlukan'
            });
        }
        
        // Get user data from global.users or database
        let user = null;
        if (global.users) {
            user = global.users.find(u => u.id == userId || u.pppoe == userId);
        }
        
        if (!user) {
            // Try to get from database
            const sqlite3 = require('sqlite3').verbose();
            const dbPath = path.join(__dirname, '../database/users.sqlite');
            const db = new sqlite3.Database(dbPath);
            
            user = await new Promise((resolve, reject) => {
                db.get('SELECT * FROM users WHERE id = ? OR pppoe = ?', [userId, userId], (err, row) => {
                    db.close();
                    if (err) reject(err);
                    else resolve(row);
                });
            });
        }
        
        if (!user) {
            return res.status(404).json({
                status: 404,
                message: 'User tidak ditemukan'
            });
        }
        
        // Get package info
        let packageInfo = null;
        if (global.packages && user.paket) {
            packageInfo = global.packages.find(p => p.nama === user.paket || p.profile === user.paket);
        }
        
        // Determine target phones
        let targetPhones = phones && phones.length > 0 ? phones : [];
        if (targetPhones.length === 0 && user.no_hp) {
            targetPhones = user.no_hp.split('|').map(p => p.trim()).filter(p => p);
        }
        
        if (targetPhones.length === 0) {
            return res.status(400).json({
                status: 400,
                message: 'Tidak ada nomor HP tujuan'
            });
        }
        
        // Load message template
        let messageTemplate = '';
        try {
            const templatesPath = path.join(__dirname, '../database/message_templates.json');
            const templates = JSON.parse(fs.readFileSync(templatesPath, 'utf8'));
            messageTemplate = templates.member_credentials_send?.template || '';
        } catch (err) {
            console.error('[MEMBER_CREDENTIALS] Error loading template:', err);
        }
        
        // Default template if not found
        if (!messageTemplate) {
            messageTemplate = `🔐 *KREDENSIAL MEMBER*\n\nHalo *\${nama_pelanggan}*,\n\nBerikut adalah informasi login internet Anda:\n\n👤 *Username:* \`\${username}\`\n🔑 *Password:* \`\${password}\`\n\n📦 Paket: *\${nama_paket}*\n\n📌 *Cara Penggunaan:*\n1. Hubungkan ke jaringan WiFi\n2. Masukkan username & password saat diminta\n\n\${catatan}\n\nTerima kasih! 🙏\n*\${nama_wifi}*`;
        }
        
        const notesText = notes ? `📝 Catatan: ${notes}` : '';
        const wifiName = global.config?.nama_wifi || 'RAF NET';
        
        // Build message
        const message = messageTemplate
            .replace(/\$\{nama_pelanggan\}/g, user.nama || '-')
            .replace(/\$\{username\}/g, user.pppoe || user.username || '-')
            .replace(/\$\{password\}/g, user.password || '-')
            .replace(/\$\{nama_paket\}/g, packageInfo?.nama || user.paket || '-')
            .replace(/\$\{catatan\}/g, notesText)
            .replace(/\$\{nama_wifi\}/g, wifiName);
        
        // Send via WhatsApp
        const sentTo = [];
        if (global.conn) {
            for (const phone of targetPhones) {
                try {
                    let normalizedPhone = phone.replace(/\D/g, '');
                    if (normalizedPhone.startsWith('0')) {
                        normalizedPhone = '62' + normalizedPhone.substring(1);
                    }
                    if (!normalizedPhone.startsWith('62')) {
                        normalizedPhone = '62' + normalizedPhone;
                    }
                    
                    const jid = normalizedPhone + '@s.whatsapp.net';
                    await global.conn.sendMessage(jid, { text: message });
                    sentTo.push(phone);
                    
                    console.log(`[MEMBER_CREDENTIALS] Sent to ${phone}`);
                    await new Promise(resolve => setTimeout(resolve, 500));
                } catch (err) {
                    console.error(`[MEMBER_CREDENTIALS] Failed to send to ${phone}:`, err.message);
                }
            }
        } else {
            return res.status(500).json({
                status: 500,
                message: 'WhatsApp tidak terhubung'
            });
        }
        
        if (sentTo.length === 0) {
            return res.status(500).json({
                status: 500,
                message: 'Gagal mengirim ke semua nomor'
            });
        }
        
        // Save to history
        const history = loadVoucherSentHistory();
        history.push({
            id: `MC${Date.now()}`,
            type: 'member_credentials',
            user_id: user.id,
            user_name: user.nama,
            username: user.pppoe || user.username,
            phone: sentTo.join(', '),
            notes: notes,
            sent_status: 'sent',
            created_at: new Date().toISOString(),
            created_by: req.user?.username || 'admin'
        });
        saveVoucherSentHistory(history);
        
        return res.json({
            status: 200,
            message: `Kredensial berhasil dikirim ke ${sentTo.length} nomor`,
            sentTo: sentTo,
            user: {
                nama: user.nama,
                username: user.pppoe || user.username,
                paket: user.paket
            }
        });
        
    } catch (error) {
        console.error('[MEMBER_CREDENTIALS_ERROR]', error);
        return res.status(500).json({
            status: 500,
            message: 'Terjadi kesalahan',
            error: error.message
        });
    }
});

module.exports = router;
