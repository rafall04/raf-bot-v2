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
    updateOdpPortUsage, savePackageChangeRequests
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

const router = express.Router();

// --- Helper Functions (moved from index.js) ---

function ensureAuthenticatedStaff(req, res, next) {
    if (!req.user || !['admin', 'owner', 'superadmin', 'teknisi'].includes(req.user.role)) {
        return res.status(403).json({ status: 403, message: "Akses ditolak." });
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

            for (const number of numbers) {
                try {
                    const { delay } = await import('@whiskeysockets/baileys');
                    await global.raf.sendMessage(number + "@s.whatsapp.net", { text: personalizedText });
                    console.log(`Broadcast sent to ${user.name} (${number})`);
                    await delay(1000); // Delay between sending to each number
                } catch (e) {
                    console.error(`Failed to send broadcast to ${number}:`, e);
                }
            }
        }
    }
}



// --- Admin API Routes ---

// All routes here are implicitly protected by the admin auth middleware in index.js

// API routes for populating form dropdowns
router.get('/api/list/users', ensureAuthenticatedStaff, (req, res) => {
    // Return a simplified list of users suitable for a dropdown
    const userList = global.users.map(u => ({
        id: u.id,
        name: u.name,
        pppoe_username: u.pppoe_username,
        subscription: u.subscription
    }));
    res.json({ status: 200, message: "User list fetched.", data: userList });
});

router.get('/api/list/packages', ensureAuthenticatedStaff, (req, res) => {
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

router.get('/api/templates', ensureAuthenticatedStaff, (req, res) => {
    try {
        const { notificationTemplates, wifiMenuTemplates, responseTemplates } = templatesCache;

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
            responseTemplates: responseTemplates
        };

        res.status(200).json({ status: 200, message: "Templates loaded successfully from cache.", data: responseData });
    } catch (error) {
        console.error("[API_TEMPLATES_GET_ERROR]", error);
        res.status(500).json({ status: 500, message: "Failed to process templates from cache." });
    }
});

router.post('/api/templates', ensureAuthenticatedStaff, (req, res) => {
    try {
        const { notificationTemplates, wifiMenuTemplates, responseTemplates } = req.body;

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

        // The fs.watchFile in templating.js will handle reloading the cache automatically.
        // No manual reload call is needed here.
        console.log("[TEMPLATES] Templates saved. The cache will be reloaded automatically by the file watcher.");

        res.status(200).json({ status: 200, message: "All message templates saved successfully. Cache reloads automatically." });
    } catch (error) {
        console.error("[API_TEMPLATES_POST_ERROR]", error);
        res.status(500).json({ status: 500, message: "Failed to save one or more message template files." });
    }
});

router.post('/api/cron', ensureAuthenticatedStaff, (req, res) => {
    if (!req.user || !['admin', 'owner', 'superadmin'].includes(req.user.role)) {
        return res.status(403).json({ message: "Akses ditolak." });
    }

    const cronDbPath = path.join(__dirname, '..', 'database', 'cron.json');
    const newConfig = req.body;

    // Validate cron expressions
    const cronFields = [
        'unpaid_schedule',
        'schedule',
        'schedule_unpaid_action',
        'schedule_isolir_notification'
    ];

    for (const field of cronFields) {
        if (newConfig[field] && !isValidCron(newConfig[field])) {
            return res.status(400).json({
                message: `Jadwal cron tidak valid untuk kolom '${field}'. Harap gunakan format yang benar.`, 
                field: field
            });
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

router.post('/api/config', ensureAuthenticatedStaff, (req, res) => {
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

        // Write the updated configs back to their files
        fs.writeFileSync(mainConfigPath, JSON.stringify(finalMainConfig, null, 4), 'utf8');
        fs.writeFileSync(cronConfigPath, JSON.stringify(finalCronConfig, null, 2), 'utf8');

        // Update the global config objects in memory
        global.config = finalMainConfig;

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
    if (!req.user || !['admin', 'owner', 'superadmin'].includes(req.user.role)) {
        return res.status(403).json({ message: "Akses ditolak." });
    }
    const { message } = req.body;
    if (!message || typeof message !== 'string') {
        return res.status(400).json({ message: "Invalid message provided." });
    }
    try {
        const newAnnouncement = {
            id: String(Date.now()),
            message: message,
            createdAt: new Date().toISOString()
        };
        global.announcements.push(newAnnouncement);
        saveJSON('announcements.json', global.announcements);
        res.status(201).json({ message: "Announcement created successfully.", data: newAnnouncement });
    } catch (error) {
        console.error("[API_ANNOUNCEMENTS_POST_ERROR]", error);
        res.status(500).json({ message: "Failed to create announcement." });
    }
});

router.post('/api/announcements/:id', ensureAuthenticatedStaff, (req, res) => {
    if (!req.user || !['admin', 'owner', 'superadmin'].includes(req.user.role)) {
        return res.status(403).json({ message: "Akses ditolak." });
    }
    const { id } = req.params;
    const { message } = req.body;
    if (!message || typeof message !== 'string') {
        return res.status(400).json({ message: "Invalid message provided." });
    }
    try {
        const announcementIndex = global.announcements.findIndex(a => a.id === id);
        if (announcementIndex === -1) {
            return res.status(404).json({ message: "Announcement not found." });
        }
        global.announcements[announcementIndex].message = message;
        saveJSON('announcements.json', global.announcements);
        res.status(200).json({ message: "Announcement updated successfully.", data: global.announcements[announcementIndex] });
    } catch (error) {
        console.error("[API_ANNOUNCEMENTS_UPDATE_ERROR]", error);
        res.status(500).json({ message: "Failed to update announcement." });
    }
});

router.delete('/api/announcements/:id', ensureAuthenticatedStaff, (req, res) => {
    if (!req.user || !['admin', 'owner', 'superadmin'].includes(req.user.role)) {
        return res.status(403).json({ message: "Akses ditolak." });
    }
    const { id } = req.params;
    try {
        const initialLength = global.announcements.length;
        global.announcements = global.announcements.filter(a => a.id !== id);
        if (global.announcements.length === initialLength) {
            return res.status(404).json({ message: "Announcement not found." });
        }
        saveJSON('announcements.json', global.announcements);
        res.status(200).json({ message: "Announcement deleted successfully." });
    } catch (error) {
        console.error("[API_ANNOUNCEMENTS_DELETE_ERROR]", error);
        res.status(500).json({ message: "Failed to delete announcement." });
    }
});

// --- News CRUD ---
router.post('/api/news', ensureAuthenticatedStaff, (req, res) => {
    if (!req.user || !['admin', 'owner', 'superadmin'].includes(req.user.role)) {
        return res.status(403).json({ message: "Akses ditolak." });
    }
    const { title, news_content } = req.body;
    if (!title || !news_content || typeof title !== 'string' || typeof news_content !== 'string') {
        return res.status(400).json({ message: "Invalid title or content provided." });
    }
    try {
        const newItem = {
            id: `news_${Date.now()}`,
            title: title,
            content: news_content,
            createdAt: new Date().toISOString()
        };
        global.news.push(newItem);
        saveJSON('news.json', global.news);
        res.status(201).json({ message: "News item created successfully.", data: newItem });
    } catch (error) {
        console.error("[API_NEWS_POST_ERROR]", error);
        res.status(500).json({ message: "Failed to create news item." });
    }
});

router.post('/api/news/:id', ensureAuthenticatedStaff, (req, res) => {
    if (!req.user || !['admin', 'owner', 'superadmin'].includes(req.user.role)) {
        return res.status(403).json({ message: "Akses ditolak." });
    }
    const { id } = req.params;
    const { title, news_content } = req.body;
    if (!title || !news_content || typeof title !== 'string' || typeof news_content !== 'string') {
        return res.status(400).json({ message: "Invalid title or content provided." });
    }
    try {
        const newsIndex = global.news.findIndex(item => item.id === id);
        if (newsIndex === -1) {
            return res.status(404).json({ message: "News item not found." });
        }
        global.news[newsIndex].title = title;
        global.news[newsIndex].content = news_content;
        saveJSON('news.json', global.news);
        res.status(200).json({ message: "News item updated successfully.", data: global.news[newsIndex] });
    } catch (error) {
        console.error("[API_NEWS_UPDATE_ERROR]", error);
        res.status(500).json({ message: "Failed to update news item." });
    }
});

router.delete('/api/news/:id', ensureAuthenticatedStaff, (req, res) => {
    if (!req.user || !['admin', 'owner', 'superadmin'].includes(req.user.role)) {
        return res.status(403).json({ message: "Akses ditolak." });
    }
    const { id } = req.params;
    try {
        const initialLength = global.news.length;
        global.news = global.news.filter(item => item.id !== id);
        if (global.news.length === initialLength) {
            return res.status(404).json({ message: "News item not found." });
        }
        saveJSON('news.json', global.news);
        res.status(200).json({ message: "News item deleted successfully." });
    } catch (error) {
        console.error("[API_NEWS_DELETE_ERROR]", error);
        res.status(500).json({ message: "Failed to delete news item." });
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
            userToUpdate.paid = (newPaidStatus === 1);
            if (userToUpdate.paid === true) {
                await handlePaidStatusChange(userToUpdate);
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

router.post('/api/request-package-change', ensureAuthenticatedStaff, async (req, res) => {
    const { userId, newPackageName, notes } = req.body;
    const requester = req.user; // Can be admin or technician

    // Validasi input
    if (!userId || !newPackageName) {
        return res.status(400).json({ message: "Parameter 'userId' dan 'newPackageName' wajib diisi." });
    }

    try {
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

        // Cek apakah ada request pending untuk user ini
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
        if (global.raf && global.raf.ws && global.raf.ws.isOpen && global.config.ownerNumber && Array.isArray(global.config.ownerNumber) && global.config.ownerNumber.length > 0) {
            const { delay } = await import('@whiskeysockets/baileys');
            
            // Format harga paket
            const formattedPrice = new Intl.NumberFormat('id-ID', { 
                style: 'currency', 
                currency: 'IDR', 
                minimumFractionDigits: 0 
            }).format(requestedPackage.price);

            // Buat pesan notifikasi
            const messageToOwner = `🔔 *Permintaan Perubahan Paket Baru* 🔔

${requester.role === 'teknisi' ? 'Teknisi' : 'Admin'} *${requester.username}* telah mengajukan permintaan perubahan paket untuk pelanggan:

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
            for (const ownerNum of global.config.ownerNumber) {
                try {
                    const ownerNumberJid = ownerNum.endsWith('@s.whatsapp.net') ? ownerNum : `${ownerNum}@s.whatsapp.net`;
                    await delay(1000); // Delay untuk menghindari spam
                    await global.raf.sendMessage(ownerNumberJid, { text: messageToOwner });
                    console.log(`[REQUEST_PKG_CHANGE_NOTIF] Notifikasi berhasil dikirim ke owner ${ownerNumberJid}`);
                } catch (notifError) {
                    console.error(`[REQUEST_PKG_CHANGE_NOTIF_ERROR] Gagal kirim notif ke owner ${ownerNum}:`, notifError.message);
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

    } catch (error) {
        console.error(`[API_REQUEST_PKG_CHANGE_ERROR] Gagal membuat permintaan:`, error);
        return res.status(500).json({ message: error.message || "Terjadi kesalahan internal server." });
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

            // Check if sync to MikroTik is enabled before syncing
            const syncToMikrotik = global.config.sync_to_mikrotik !== false; // Default to true if not set

            if (syncToMikrotik) {
                // Update profile on Mikrotik
                try {
                    await updatePPPoEProfile(user.pppoe_username, newProfile);
                    console.log(`[PKG_CHANGE_MIKROTIK_SYNC] Successfully updated profile for ${user.pppoe_username} to ${newProfile}.`);
                } catch (mikrotikError) {
                    console.error(`[PKG_CHANGE_MIKROTIK_ERROR] Failed to update profile for ${user.pppoe_username}:`, mikrotikError.message);
                    throw new Error(`Gagal mengupdate profil di MikroTik: ${mikrotikError.message}`);
                }

                // Try to disconnect the user so the new profile takes effect
                try {
                    await deleteActivePPPoEUser(user.pppoe_username);
                } catch (e) {
                    console.warn(`[PKG_CHANGE_APPROVE_WARN] Gagal memutuskan sesi aktif untuk ${user.pppoe_username}, mungkin sedang tidak online. Melanjutkan proses. Error: ${e.message}`);
                }
            } else {
                console.log(`[PKG_CHANGE_MIKROTIK_SYNC] Sync to MikroTik is DISABLED - skipping profile update for ${user.pppoe_username}.`);
            }

            // Update user's subscription in the database
            user.subscription = request.requestedPackageName;
            // No need to call a separate saveUsers() function as global.users is manipulated directly
            // and will be persisted if the app restarts based on the SQLite DB.
            // We do need to update the SQLite DB, however.
            await new Promise((resolve, reject) => {
                db.run('UPDATE users SET subscription = ? WHERE id = ?', [request.requestedPackageName, user.id], function(err) {
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
             for (let number of phoneNumbers) {
                let normalizedNumber = normalizePhoneNumber(number);
                if(normalizedNumber) {
                    try {
                        await global.raf.sendMessage(`${normalizedNumber}@s.whatsapp.net`, { text: notificationMessage });
                    } catch (e) {
                        console.error(`[PKG_CHANGE_ACTION_NOTIF_ERROR] Gagal kirim notif ke ${normalizedNumber}:`, e.message);
                    }
                }
             }
        }

        return res.status(200).json({ message: `Permintaan berhasil di-${action === 'approve' ? 'setujui' : 'tolak'}.` });

    } catch (error) {
        console.error(`[API_APPROVE_PKG_CHANGE_ERROR] Gagal memproses permintaan ${requestId}:`, error);
        return res.status(500).json({ message: error.message || "Terjadi kesalahan internal server." });
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
                
                // If not found in global.users, try loading from file
                if (!customer) {
                    console.log(`[WIFI_LOGGING] Customer not found in global.users, trying file...`);
                    const users = await loadJSON('users.json');
                    customer = users.find(u => u.device_id === deviceId);
                    if (customer) {
                        console.log(`[WIFI_LOGGING] Customer found in file: ${customer.name} (ID: ${customer.id})`);
                    } else {
                        console.log(`[WIFI_LOGGING] Customer not found in file either for device ${deviceId}`);
                    }
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

router.delete('/api/:category/:id', (req, res) => {
    const { category, id } = req.params;
    switch(category) {
        case 'users': {
            const userIndexToDelete = global.users.findIndex(user => String(user.id) === String(id));
            if (userIndexToDelete === -1) {
                return res.status(404).json({ status: 404, message: 'Pengguna tidak ditemukan' });
            }

            const userToDelete = global.users[userIndexToDelete];
            const connectedOdpId = userToDelete.connected_odp_id;

            global.db.run('DELETE FROM users WHERE id = ?', [id], function(err) {
                if (err) {
                    console.error("[DB_DELETE_USER_ERROR]", err.message);
                    return res.status(500).json({ status: 500, message: "Gagal menghapus pengguna dari database." });
                }

                global.users.splice(userIndexToDelete, 1);

                if (connectedOdpId) {
                    // Ensure updateOdpPortUsage and updateOdcPortUsage are available
                    const { saveNetworkAssets, updateNetworkAssetsWithLock } = require('../lib/database');

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

    const usersJsonPath = path.join(__dirname, '..', 'users.json');
    console.log('[MIGRATE_USERS] Starting migration process...');

    try {
        // 1. Read users.json
        if (!fs.existsSync(usersJsonPath)) {
            console.error('[MIGRATE_USERS] File users.json tidak ditemukan.');
            return res.status(404).json({ status: 404, message: 'File users.json tidak ditemukan.' });
        }
        
        const usersData = JSON.parse(fs.readFileSync(usersJsonPath, 'utf8'));
        if (!Array.isArray(usersData)) {
            console.error('[MIGRATE_USERS] Format users.json tidak valid.');
            return res.status(400).json({ status: 400, message: 'Format users.json tidak valid, harus berupa array.' });
        }
        
        console.log(`[MIGRATE_USERS] Found ${usersData.length} users in users.json`);

        // 2. Prepare for DB Insertion with Promise-based approach
        const db = global.db;
        
        // Wrap the entire migration in a promise for proper async handling
        const migrationPromise = new Promise((resolve, reject) => {
            const insertStmt = db.prepare(`INSERT OR REPLACE INTO users
                (id, name, phone_number, address, subscription, pppoe_username, device_id, paid, bulk, pppoe_password)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

            let insertCount = 0;
            let errorCount = 0;
            const errors = [];

            // 3. Begin transaction with proper error handling
            db.serialize(() => {
                // Start transaction
                db.run("BEGIN TRANSACTION", (err) => {
                    if (err) {
                        console.error('[MIGRATE_USERS] Error starting transaction:', err.message);
                        return reject(new Error(`Gagal memulai transaksi: ${err.message}`));
                    }
                    console.log('[MIGRATE_USERS] Transaction started');
                });

                // 4. Iterate and Insert with error handling
                usersData.forEach((user, index) => {
                    const params = [
                        user.id,
                        user.name || null,
                        user.phone_number || null,
                        user.address || null,
                        user.subscription || null,
                        user.pppoe_username || null,
                        user.device_id || null,
                        user.paid ? 1 : 0,
                        user.bulk ? JSON.stringify(user.bulk) : null,
                        user.pppoe_password || null
                    ];
                    
                    insertStmt.run(params, function(err) {
                        if (err) {
                            errorCount++;
                            errors.push({ userId: user.id, userName: user.name, error: err.message });
                            console.error(`[MIGRATE_USERS] Error inserting user ${user.id} (${user.name}):`, err.message);
                        } else {
                            insertCount++;
                        }
                    });
                });

                // 5. Finalize statement
                insertStmt.finalize((err) => {
                    if (err) {
                        console.error('[MIGRATE_USERS] Error finalizing statement:', err.message);
                        return reject(new Error(`Gagal finalize statement: ${err.message}`));
                    }
                    console.log(`[MIGRATE_USERS] Statement finalized. Insert count: ${insertCount}, Error count: ${errorCount}`);
                });

                // 6. Commit transaction - CRITICAL: This must complete before SELECT
                db.run("COMMIT", (err) => {
                    if (err) {
                        console.error('[MIGRATE_USERS] Error committing transaction:', err.message);
                        // Attempt rollback
                        db.run("ROLLBACK", (rollbackErr) => {
                            if (rollbackErr) {
                                console.error('[MIGRATE_USERS] Error rolling back:', rollbackErr.message);
                            }
                        });
                        return reject(new Error(`Gagal commit transaksi: ${err.message}`));
                    }
                    
                    console.log('[MIGRATE_USERS] Transaction committed successfully');
                    
                    // Report any errors that occurred during inserts
                    if (errorCount > 0) {
                        console.warn(`[MIGRATE_USERS] Migration completed with ${errorCount} errors:`, errors);
                    }
                    
                    resolve({ insertCount, errorCount, errors, totalUsers: usersData.length });
                });
            });
        });

        // 7. Wait for migration to complete, then reload users
        const migrationResult = await migrationPromise;
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
                global.users = rows.map(user => ({
                    ...user,
                    paid: user.paid === 1,
                    bulk: user.bulk ? JSON.parse(user.bulk) : []
                }));
                
                console.log(`[MIGRATE_USERS] Successfully reloaded and transformed ${global.users.length} users into memory`);
                resolve(rows.length);
            });
        });

        const reloadedCount = await reloadPromise;
        
        // 9. Send success response with detailed information
        const responseMessage = migrationResult.errorCount > 0
            ? `Migrasi selesai dengan peringatan! ${migrationResult.insertCount} dari ${migrationResult.totalUsers} pengguna berhasil dimigrasikan. ${migrationResult.errorCount} pengguna gagal. Silakan periksa log untuk detail.`
            : `Migrasi berhasil! ${reloadedCount} pengguna telah dipindahkan ke database SQLite dan dimuat ke memori.`;
        
        console.log(`[MIGRATE_USERS] ${responseMessage}`);
        
        res.status(200).json({
            status: 200,
            message: responseMessage,
            details: {
                totalUsers: migrationResult.totalUsers,
                inserted: migrationResult.insertCount,
                errors: migrationResult.errorCount,
                reloaded: reloadedCount
            }
        });

    } catch (error) {
        console.error('[MIGRATE_USERS] Fatal error during migration:', error);
        res.status(500).json({ 
            status: 500, 
            message: `Terjadi kesalahan saat migrasi: ${error.message}`,
            error: error.stack
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
        console.log('[/api/admin/delete-all-users] Network assets ports reset.');
        
        return res.json({
            status: 200,
            message: 'Semua pengguna berhasil dihapus'
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
        const devices = readMikrotikDevices();
        const device = devices.find(d => d.id === req.params.id);
        if (device) {
            res.json(device);
        } else {
            res.status(404).json({ message: 'Device not found' });
        }
    } catch (error) {
        res.status(500).json({ message: "Failed to read device data." });
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
        const devices = readMikrotikDevices();
        const index = devices.findIndex(d => d.id === req.params.id);
        if (index !== -1) {
            const updatedDevice = {
                ...devices[index],
                ip: req.body.ip,
                name: req.body.name,
                password: req.body.password,
                port: req.body.port || '8728'
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
            res.json({ message: 'Device updated successfully', data: updatedDevice });
        } else {
            res.status(404).json({ message: 'Device not found' });
        }
    } catch (error) {
        res.status(500).json({ message: "Failed to update device." });
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
        const { keywords, newIntent } = req.body;

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

        templates[templateIndex].keywords = keywords.filter(k => k && k.trim() !== '');
        saveJSON('wifi_templates.json', templates);

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
            if (pathValue && typeof pathValue._value !== 'undefined') {
                value = pathValue._value;
                pathFound = path;
                break;
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

// Bulk update payment status endpoint - Using SQLite database
router.post('/api/payment-status/bulk-update', ensureAuthenticatedStaff, async (req, res) => {
    const { userIds, paid, triggerNotification } = req.body;
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
                    const paymentDetails = {
                        paidDate: new Date().toISOString(),
                        method: 'CASH', // Default method, could be passed from frontend
                        approvedBy: req.user ? req.user.username : 'Admin',
                        notes: 'Status pembayaran diubah melalui halaman Payment Status'
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
            }
        };
        
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
router.post('/api/working-hours', ensureAuthenticatedStaff, (req, res) => {
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
                holidayMessage: newSettings.holidayMessage || 'Laporan Anda diterima pada hari libur. Akan diproses pada hari kerja berikutnya.'
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
                responseTime: newSettings.responseTime
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
        if (current && typeof current === 'object' && current.hasOwnProperty(part)) {
            current = current[part];
        } else {
            return undefined;
        }
    }
    return current;
}

module.exports = router;