const express = require('express');
const fs = require('fs');
const path = require('path');
const { hashPassword, comparePassword } = require('../lib/password');
const { updatePPPoEProfile, deleteActivePPPoEUser, addPPPoEUser } = require('../lib/mikrotik');
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
const crypto = require('crypto');

const router = express.Router();

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
        const send = await global.raf.sendMessage(req.params.id, { text: req.params.text });
        return res.send({ status: 200, message: `Success send message with text ${req.params.text}`, result: send });
    } catch (e) {
        return res.send({ status: 500, message: e });
    }
});

// GET /api/users - Get all users
router.get('/users', ensureAuthenticated, (req, res) => {
    try {
        // Return users from global.users which is already synced with database
        return res.json({ 
            status: 200, 
            message: "Data pengguna berhasil dimuat",
            data: global.users 
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
                method: 'CASH',
                approvedBy: req.user.username,
                notes: 'Status pembayaran diperbarui oleh admin'
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

// Helper function to find the next available ID (fills gaps or gets next sequential)
async function getNextAvailableUserId() {
    return new Promise((resolve, reject) => {
        // Get all existing IDs ordered
        global.db.all('SELECT id FROM users ORDER BY id ASC', [], (err, rows) => {
            if (err) {
                reject(err);
                return;
            }
            
            // If no users, start with ID 1
            if (!rows || rows.length === 0) {
                resolve(1);
                return;
            }
            
            // Find the first gap in the sequence
            let expectedId = 1;
            for (const row of rows) {
                if (row.id > expectedId) {
                    // Found a gap, use this ID
                    resolve(expectedId);
                    return;
                }
                expectedId = row.id + 1;
            }
            
            // No gaps found, use the next ID after the last one
            resolve(expectedId);
        });
    });
}

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
            
            // Update user data
            const updatedUser = {
                ...existingUser,
                ...userData,
                updated_at: new Date().toISOString()
            };
            
            // Handle paid status change
            if (existingUser.paid !== updatedUser.paid && updatedUser.paid === true) {
                await handlePaidStatusChange(updatedUser, {
                    paidDate: new Date().toISOString(),
                    method: userData.payment_method || 'CASH',
                    approvedBy: req.user.username,
                    notes: 'Status pembayaran diperbarui oleh admin'
                });
            }
            
            // Update in memory
            global.users[userIndex] = updatedUser;
            
            // Update in database
            const updateQuery = `
                UPDATE users SET 
                    name = ?, phone_number = ?, subscription = ?, device_id = ?, 
                    paid = ?, pppoe_username = ?, pppoe_password = ?,
                    connected_odp_id = ?, send_invoice = ?,
                    is_corporate = ?, corporate_name = ?, corporate_address = ?,
                    corporate_npwp = ?, corporate_pic_name = ?, 
                    corporate_pic_phone = ?, corporate_pic_email = ?
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
            const phoneToValidate = userData.phone_number || userData.phone;
            const defaultCountry = userData.country || 'ID'; // Default to Indonesia
            const validationResult = await validatePhoneNumbers(global.db, phoneToValidate, null, defaultCountry);
            
            if (!validationResult.valid) {
                return res.status(400).json({
                    status: 400,
                    message: validationResult.message,
                    conflictUser: validationResult.conflictUser || null
                });
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
                created_at: new Date().toISOString()
            };
            
            // Add to memory
            global.users.push(newUser);
            
            // Insert into database
            const insertQuery = `
                INSERT INTO users (
                    id, name, phone_number, subscription, device_id, paid, 
                    pppoe_username, pppoe_password, connected_odp_id, 
                    send_invoice, is_corporate, corporate_name, 
                    corporate_address, corporate_npwp, corporate_pic_name,
                    corporate_pic_phone, corporate_pic_email
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
                    newUser.corporate_pic_email || null
                ], function(err) {
                    if (err) reject(err);
                    else resolve();
                });
            });
            
            // Add PPPoE user if needed
            if (newUser.pppoe_username && newUser.pppoe_password && newUser.subscription) {
                const profile = getProfileBySubscription(newUser.subscription);
                if (profile) {
                    await addPPPoEUser(newUser.pppoe_username, newUser.pppoe_password, profile);
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
        if (userData.phone_number || userData.phone) {
            const phoneToValidate = userData.phone_number || userData.phone;
            const defaultCountry = userData.country || userToUpdate.country || 'ID';
            const validationResult = await validatePhoneNumbers(global.db, phoneToValidate, id, defaultCountry);
            
            if (!validationResult.valid) {
                return res.status(400).json({
                    status: 400,
                    message: validationResult.message,
                    conflictUser: validationResult.conflictUser || null
                });
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
        
        // Handle paid status change
        if (oldPaidStatus !== userToUpdate.paid && userToUpdate.paid === true) {
            await handlePaidStatusChange(userToUpdate, {
                paidDate: new Date().toISOString(),
                method: userData.payment_method || 'CASH',
                approvedBy: req.user.username,
                notes: 'Status pembayaran diperbarui oleh admin'
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

module.exports = router;
