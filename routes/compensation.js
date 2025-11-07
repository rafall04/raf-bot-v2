const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { updatePPPoEProfile, deleteActivePPPoEUser } = require('../lib/mikrotik');
const { saveCompensations, saveSpeedRequests } = require('../lib/database');
const { normalizePhoneNumber } = require('../lib/myfunc');
const { renderTemplate, templatesCache } = require('../lib/templating');
const { getUploadDir, getUploadPath, generateFilename } = require('../lib/upload-helper');
const { rebootRouter } = require('../lib/wifi');

// Configure multer for file uploads (Speed Request proofs)
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = getUploadDir('speed-requests');
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const requestId = req.body.requestId || 'unknown';
        const filename = generateFilename('payment', requestId, file.originalname);
        cb(null, filename);
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
    fileFilter: function (req, file, cb) {
        const allowedTypes = /jpeg|jpg|png|gif|pdf/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        
        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Hanya file gambar (JPEG, PNG, GIF) atau PDF yang diperbolehkan.'));
        }
    }
});

// Middleware for admin-only routes
function ensureAdmin(req, res, next) {
    if (!req.user || !['admin', 'owner', 'superadmin'].includes(req.user.role)) {
        return res.status(403).json({ message: "Akses ditolak. Hanya peran tertentu yang diizinkan." });
    }
    next();
}

// Middleware for authenticated users
function ensureAuthenticated(req, res, next) {
    if (!req.user) {
        return res.status(401).json({ message: "Autentikasi diperlukan." });
    }
    next();
}

// GET /api/speed-requests - Get all speed boost requests
router.get('/speed-requests', ensureAdmin, async (req, res) => {
    try {
        const sortedRequests = [...global.speed_requests].sort((a, b) => 
            new Date(b.createdAt) - new Date(a.createdAt)
        );
        
        return res.json({
            status: 200,
            data: sortedRequests
        });
    } catch (error) {
        console.error('[API_SPEED_REQUESTS_ERROR]', error);
        return res.status(500).json({
            status: 500,
            message: 'Terjadi kesalahan saat mengambil data speed requests'
        });
    }
});

// GET /api/compensations/active
router.get('/compensations/active', ensureAdmin, async (req, res) => {
    try {
        const activeCompensations = global.compensations.filter(comp => comp.status === 'active');
        const detailedActiveCompensations = activeCompensations.map(comp => {
            const user = global.users.find(u => u.id.toString() === comp.userId.toString());
            return {
                compensationId: comp.id,
                userId: comp.userId,
                userName: user ? user.name : 'User Tidak Ditemukan',
                pppoeUsername: user ? user.pppoe_username : comp.pppoeUsername,
                originalProfile: comp.originalProfile,
                compensatedProfile: comp.compensatedProfile,
                startDate: comp.startDate,
                endDate: comp.endDate,
                durationDays: comp.durationDays,
                durationHours: comp.durationHours,
                durationMinutes: comp.durationMinutes || 0,
                notes: comp.notes,
                processedBy: comp.processedBy
            };
        }).sort((a, b) => new Date(b.startDate) - new Date(a.startDate));

        return res.status(200).json({
            message: "Data kompensasi aktif berhasil diambil.",
            data: detailedActiveCompensations
        });

    } catch (error) {
        console.error("[API_COMPENSATIONS_ACTIVE_ERROR] Gagal mengambil daftar kompensasi aktif:", error);
        return res.status(500).json({ message: "Terjadi kesalahan internal server saat mengambil data." });
    }
});

// POST /api/compensation/apply
router.post('/compensation/apply', ensureAdmin, async (req, res) => {
    const { customerIds, speedProfile, durationDays, durationHours, durationMinutes, notes } = req.body;
    if (!customerIds || !Array.isArray(customerIds) || customerIds.length === 0) {
        return res.status(400).json({ message: "Parameter 'customerIds' (array) diperlukan dan tidak boleh kosong." });
    }
    if (!speedProfile) {
        return res.status(400).json({ message: "Parameter 'speedProfile' (profil Mikrotik baru) diperlukan." });
    }
    const parsedDurationDays = parseInt(durationDays || 0);
    const parsedDurationHours = parseInt(durationHours || 0);
    const parsedDurationMinutes = parseInt(durationMinutes || 0);
    if (isNaN(parsedDurationDays) || parsedDurationDays < 0) {
        return res.status(400).json({ message: "Parameter 'durationDays' harus angka non-negatif." });
    }
    if (isNaN(parsedDurationHours) || parsedDurationHours < 0 || parsedDurationHours >= 24) {
        return res.status(400).json({ message: "Parameter 'durationHours' harus angka antara 0 dan 23." });
    }
    if (isNaN(parsedDurationMinutes) || parsedDurationMinutes < 0 || parsedDurationMinutes >= 60) {
        return res.status(400).json({ message: "Parameter 'durationMinutes' harus angka antara 0 dan 59." });
    }
    if (parsedDurationDays === 0 && parsedDurationHours === 0 && parsedDurationMinutes === 0) {
        return res.status(400).json({ message: "Total durasi kompensasi (hari, jam, atau menit) harus lebih dari 0." });
    }
    
    let notificationConfig;
    try {
        notificationConfig = JSON.parse(fs.readFileSync(path.join(__dirname, '../database/cron.json'), 'utf8'));
    } catch (e) {
        console.error("[KOMPENSASI_APPLY_ERROR] Gagal membaca konfigurasi (cron.json) untuk notifikasi:", e);
        notificationConfig = { status_message_compensation_applied_user: false, message_compensation_applied_user: "", date_locale_for_notification: "id-ID", date_options_for_notification: { weekday: "long", year: "numeric", month: "long", day: "numeric" } };
    }
    
    const processedBy = req.user.username || req.user.id;
    const overallResults = [];
    let anyOperationFailedCritically = false;
    
    for (const userId of customerIds) {
        const user = global.users.find(u => u.id.toString() === userId.toString());
        let userResult = { userId, pppoeUsername: user ? (user.pppoe_username || 'N/A') : 'N/A', status: 'pending', details: [] };
        
        if (!user) {
            userResult.status = 'error_critical';
            userResult.details.push(`Pelanggan dengan ID ${userId} tidak ditemukan.`);
            anyOperationFailedCritically = true;
            overallResults.push(userResult);
            continue;
        }
        
        userResult.pppoeUsername = user.pppoe_username || 'N/A';
        if (!user.pppoe_username) {
            userResult.status = 'error_critical';
            userResult.details.push(`Pelanggan ${user.name} (ID: ${userId}) tidak memiliki username PPPoE.`);
            anyOperationFailedCritically = true;
            overallResults.push(userResult);
            continue;
        }
        
        const userPackageName = user.subscription;
        if (!userPackageName) {
            userResult.status = 'error_critical';
            userResult.details.push(`Pelanggan ${user.name} tidak memiliki paket langganan (user.subscription) yang terdefinisi.`);
            anyOperationFailedCritically = true;
            console.warn(`[KOMPENSASI_WARN] Pelanggan ${user.name} (ID: ${userId}) tidak memiliki 'subscription'.`);
            overallResults.push(userResult);
            continue;
        }
        
        const subscribedPackage = global.packages.find(pkg => pkg.name === userPackageName);
        if (!subscribedPackage || !subscribedPackage.profile) {
            userResult.status = 'error_critical';
            userResult.details.push(`Paket langganan '${userPackageName}' untuk pelanggan ${user.name} tidak ditemukan di packages.json atau tidak memiliki properti 'profile' (nama profil Mikrotik).`);
            anyOperationFailedCritically = true;
            console.warn(`[KOMPENSASI_WARN] Paket '${userPackageName}' untuk ${user.name} tidak ditemukan atau tidak ada 'profile' di packages.json.`);
            overallResults.push(userResult);
            continue;
        }
        
        const originalProfile = subscribedPackage.profile;
        const existingActiveCompensation = global.compensations.find(comp => comp.userId === userId.toString() && comp.status === 'active');
        if (existingActiveCompensation) {
            userResult.status = 'error_critical';
            userResult.details.push(`Pelanggan ${user.name} sudah memiliki kompensasi aktif. Selesaikan atau tunggu hingga berakhir.`);
            anyOperationFailedCritically = true;
            console.warn(`[KOMPENSASI_WARN] Pelanggan ${user.name} (ID: ${userId}) sudah memiliki kompensasi aktif.`);
            overallResults.push(userResult);
            continue;
        }
        
        const startDate = new Date();
        const endDate = new Date(startDate);
        if (parsedDurationDays > 0) {
            endDate.setDate(startDate.getDate() + parsedDurationDays);
        }
        if (parsedDurationHours > 0) {
            endDate.setHours(startDate.getHours() + parsedDurationHours);
        }
        if (parsedDurationMinutes > 0) {
            endDate.setMinutes(startDate.getMinutes() + parsedDurationMinutes);
        }
        
        const newCompensationId = `comp_${Date.now()}_${userId}`;
        const compensationEntry = {
            id: newCompensationId,
            userId: userId.toString(),
            pppoeUsername: user.pppoe_username,
            originalProfile: originalProfile,
            compensatedProfile: speedProfile,
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
            durationDays: parsedDurationDays,
            durationHours: parsedDurationHours,
            durationMinutes: parsedDurationMinutes,
            notes: notes || "",
            status: "pending_apply",
            processedBy,
            createdAt: new Date().toISOString()
        };
        
        try {
            await updatePPPoEProfile(user.pppoe_username, speedProfile);
            userResult.details.push(`Profil PPPoE berhasil diubah ke ${speedProfile}.`);
            compensationEntry.status = "active";
            
            try {
                await deleteActivePPPoEUser(user.pppoe_username);
                userResult.details.push(`Sesi aktif PPPoE berhasil dihapus.`);
            } catch (disconnectError) {
                const errMsg = `Gagal menghapus sesi aktif PPPoE: ${disconnectError.message || disconnectError}`;
                console.warn(`[KOMPENSASI_APPLY_WARN] [User: ${user.name}] ${errMsg}`);
                userResult.details.push(`Warning: ${errMsg}`);
                if (userResult.status !== 'error_critical') userResult.status = 'warning_partial';
            }
            
            if (user.device_id) {
                try {
                    await rebootRouter(user.device_id);
                    userResult.details.push(`Perintah reboot untuk router ${user.device_id} berhasil dikirim.`);
                } catch (rebootError) {
                    const errMsg = `Gagal me-reboot router ${user.device_id}: ${rebootError.message || rebootError}`;
                    console.warn(`[KOMPENSASI_APPLY_WARN] [User: ${user.name}] ${errMsg}`);
                    userResult.details.push(`Warning: ${errMsg}`);
                    if (userResult.status !== 'error_critical') userResult.status = 'warning_partial';
                }
            } else {
                userResult.details.push(`Reboot router dilewati (tidak ada Device ID).`);
            }
            
            global.compensations.push(compensationEntry);
            if (userResult.status === 'pending') userResult.status = 'success';
            
            // Send notification if enabled
            if (notificationConfig.status_message_compensation_applied === true && templatesCache.notificationTemplates['compensation_applied'] && global.raf) {
                if (user.phone_number && user.phone_number.trim() !== "") {
                    let durasiLengkapStr = "";
                    if (parsedDurationDays > 0) {
                        durasiLengkapStr += `${parsedDurationDays} hari`;
                    }
                    if (parsedDurationHours > 0) {
                        if (parsedDurationDays > 0) durasiLengkapStr += " ";
                        durasiLengkapStr += `${parsedDurationHours} jam`;
                    }
                    if (parsedDurationMinutes > 0) {
                        if (parsedDurationDays > 0 || parsedDurationHours > 0) durasiLengkapStr += " ";
                        durasiLengkapStr += `${parsedDurationMinutes} menit`;
                    }
                    if (durasiLengkapStr === "") durasiLengkapStr = "Durasi tidak valid";
                    
                    const locale = notificationConfig.date_locale_for_notification || 'id-ID';
                    const dateOptions = notificationConfig.date_options_for_notification || { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' };
                    const dataPesan = {
                        nama: user.name,
                        profileBaru: global.packages.find(p => p.profile === speedProfile)?.name || speedProfile,
                        durasiLengkap: durasiLengkapStr,
                        tanggalAkhir: endDate.toLocaleDateString(locale, dateOptions)
                    };
                    const teksPesan = renderTemplate('compensation_applied', dataPesan);
                    const phoneNumbers = user.phone_number.split('|');
                    for (let number of phoneNumbers) {
                        if (!number || number.trim() === "") continue;
                        let normalizedNumber = number.trim();
                        if (normalizedNumber.startsWith("0")) {
                            normalizedNumber = "62" + normalizedNumber.substring(1);
                        }
                        if (!normalizedNumber.endsWith("@s.whatsapp.net")) {
                            normalizedNumber += "@s.whatsapp.net";
                        }
                        if (normalizedNumber.length > 8) {
                            try {
                                const { delay } = await import('@whiskeysockets/baileys');
                                await delay(1000);
                                await global.raf.sendMessage(normalizedNumber, { text: teksPesan });
                                const successMsg = `Notifikasi penerapan kompensasi BERHASIL dikirim ke ${normalizedNumber}.`;
                                userResult.details.push(successMsg);
                            } catch (msgError) {
                                const errMsg = `GAGAL mengirim notifikasi penerapan ke ${normalizedNumber}: ${msgError.message}`;
                                console.error(`[KOMPENSASI_APPLY_NOTIF_ERROR] [User: ${user.name}] ${errMsg}`, msgError.stack);
                                userResult.details.push(`Warning: ${errMsg}`);
                                if (userResult.status !== 'error_critical') userResult.status = 'warning_partial';
                            }
                        }
                    }
                }
            }
        } catch (mikrotikError) {
            const errMsg = `Gagal mengubah profil Mikrotik: ${mikrotikError.message || mikrotikError}`;
            console.error(`[KOMPENSASI_APPLY_ERROR] [User: ${user.name}] ${errMsg}`);
            userResult.status = 'error_critical';
            userResult.details.push(errMsg);
            anyOperationFailedCritically = true;
        }
        overallResults.push(userResult);
    }
    
    saveCompensations();
    const allSucceeded = overallResults.every(r => r.status === 'success' && r.details.every(d => !d.toLowerCase().includes('gagal') && !d.toLowerCase().includes('warning')));
    const someSucceededOrPartial = overallResults.some(r => r.status === 'success' || r.status === 'warning_partial');
    if (allSucceeded && overallResults.length > 0) {
        return res.status(200).json({ message: "Semua kompensasi berhasil diproses sepenuhnya.", details: overallResults });
    } else if (someSucceededOrPartial && overallResults.length > 0) {
        return res.status(207).json({ message: "Beberapa operasi kompensasi mungkin menghasilkan warning atau ada yang gagal.", details: overallResults });
    } else if (overallResults.length > 0) {
        return res.status(400).json({ message: "Semua operasi kompensasi gagal atau ada masalah validasi.", details: overallResults });
    } else {
        return res.status(400).json({ message: "Tidak ada pelanggan yang diproses atau customerIds kosong.", details: overallResults });
    }
});

// POST /api/speed-requests/payment-proof - Upload bukti pembayaran speed request
router.post('/speed-requests/payment-proof', ensureAuthenticated, upload.single('paymentProof'), async (req, res) => {
    const { requestId, paymentNotes } = req.body;
    
    if (!requestId) {
        return res.status(400).json({ message: "Request ID wajib diisi." });
    }
    
    const requestIndex = global.speed_requests.findIndex(r => r.id === requestId);
    if (requestIndex === -1) {
        return res.status(404).json({ message: "Permintaan tidak ditemukan." });
    }
    
    const request = global.speed_requests[requestIndex];
    
    // Check if user owns this request or is admin
    const isAdmin = ['admin', 'owner', 'superadmin'].includes(req.user.role);
    const isOwner = request.userId.toString() === req.user.id?.toString();
    
    if (!isAdmin && !isOwner) {
        return res.status(403).json({ message: "Anda tidak memiliki akses untuk request ini." });
    }
    
    // Check if request is in correct status
    if (request.status !== 'pending') {
        return res.status(400).json({ message: `Request dengan status '${request.status}' tidak dapat diupdate bukti pembayarannya.` });
    }
    
    // Check payment method
    if (!['cash', 'transfer'].includes(request.paymentMethod)) {
        return res.status(400).json({ message: "Upload bukti pembayaran hanya untuk metode cash/transfer." });
    }
    
    try {
        // Update payment info
        if (req.file) {
            request.paymentProof = getUploadPath('speed-requests', req.file.filename);
        }
        request.paymentStatus = 'pending'; // Waiting for verification
        request.paymentNotes = paymentNotes || '';
        request.paymentDate = new Date().toISOString();
        request.updatedAt = new Date().toISOString();
        
        global.speed_requests[requestIndex] = request;
        saveSpeedRequests();
        
        // Notify admin about payment proof upload
        if (global.raf && global.config.ownerNumber && Array.isArray(global.config.ownerNumber)) {
            const notifMessage = `💰 *Bukti Pembayaran Speed Boost* 💰\n\n` +
                `Pelanggan telah mengupload bukti pembayaran.\n\n` +
                `*Pelanggan:* ${request.userName}\n` +
                `*Paket Diminta:* ${request.requestedPackageName}\n` +
                `*Durasi:* ${request.durationKey.replace('_', ' ')}\n` +
                `*Harga:* Rp ${Number(request.price).toLocaleString('id-ID')}\n` +
                `*Metode:* ${request.paymentMethod}\n` +
                `*Catatan:* ${paymentNotes || '-'}\n\n` +
                `Silakan verifikasi di halaman admin.`;
                
            for (const ownerNum of global.config.ownerNumber) {
                const { delay } = await import('@whiskeysockets/baileys');
                const ownerJid = ownerNum.endsWith('@s.whatsapp.net') ? ownerNum : `${ownerNum}@s.whatsapp.net`;
                try {
                    await delay(500);
                    await global.raf.sendMessage(ownerJid, { text: notifMessage });
                } catch (e) {
                    console.error(`[SPEED_PAYMENT_NOTIF_ERROR] Gagal mengirim notifikasi ke owner ${ownerJid}:`, e.message);
                }
            }
        }
        
        return res.status(200).json({ 
            message: "Bukti pembayaran berhasil diupload. Menunggu verifikasi admin.",
            data: {
                paymentProof: request.paymentProof,
                paymentStatus: request.paymentStatus
            }
        });
    } catch (error) {
        console.error('[SPEED_PAYMENT_UPLOAD_ERROR]', error);
        return res.status(500).json({ message: "Gagal mengupload bukti pembayaran." });
    }
});

// POST /api/speed-requests/verify-payment - Admin verify payment
router.post('/speed-requests/verify-payment', ensureAdmin, async (req, res) => {
    const { requestId, verified, notes } = req.body;
    
    if (!requestId || verified === undefined) {
        return res.status(400).json({ message: "Parameter tidak lengkap. requestId dan verified wajib diisi." });
    }
    
    const requestIndex = global.speed_requests.findIndex(r => r.id === requestId);
    if (requestIndex === -1) {
        return res.status(404).json({ message: "Permintaan tidak ditemukan." });
    }
    
    const request = global.speed_requests[requestIndex];
    
    // Check if payment is pending verification
    if (request.paymentStatus !== 'pending') {
        return res.status(400).json({ message: "Pembayaran tidak dalam status pending verification." });
    }
    
    try {
        if (verified) {
            // Mark payment as verified
            request.paymentStatus = 'verified';
            request.paymentVerifiedBy = req.user.username;
            request.paymentVerifiedAt = new Date().toISOString();
            
            // Auto-approve the speed request if payment is verified
            const user = global.users.find(u => u.id === request.userId);
            if (!user) {
                throw new Error("User untuk permintaan ini tidak ditemukan.");
            }
            
            const requestedPackage = global.packages.find(p => p.name === request.requestedPackageName);
            if (!requestedPackage || !requestedPackage.profile) {
                throw new Error("Paket yang diminta atau profilnya tidak ditemukan.");
            }
            
            const newProfile = requestedPackage.profile;
            console.log(`[SPEED_PAYMENT_VERIFIED] Auto-approving request ${requestId} untuk user ${user.name}. Mengubah profil ke ${newProfile}`);
            
            // Update PPPoE profile
            await updatePPPoEProfile(user.pppoe_username, newProfile);
            
            // Disconnect active session
            try {
                await deleteActivePPPoEUser(user.pppoe_username);
            } catch (e) {
                console.warn(`[SPEED_APPROVE_WARN] Gagal menghapus sesi aktif untuk ${user.pppoe_username}, mungkin tidak sedang online.`);
            }
            
            // Calculate expiration
            let durationInHours = 0;
            if (request.durationKey === '1_day') durationInHours = 24;
            else if (request.durationKey === '3_days') durationInHours = 72;
            else if (request.durationKey === '7_days') durationInHours = 168;
            
            const now = new Date();
            const expirationDate = new Date(now.getTime() + durationInHours * 60 * 60 * 1000);
            
            // Update request status
            request.status = 'active';
            request.updatedAt = now.toISOString();
            request.approvedBy = req.user.username;
            request.durationHours = durationInHours;
            request.expirationDate = expirationDate.toISOString();
            request.notes = notes || "Pembayaran terverifikasi, speed boost diaktifkan.";
            
            // Send notification to customer
            if (user.phone_number && global.raf) {
                const notifMessage = `✅ *Pembayaran Speed Boost Terverifikasi!*\n\n` +
                    `Halo ${user.name},\n` +
                    `Pembayaran Anda telah diverifikasi dan speed boost telah diaktifkan.\n\n` +
                    `*Paket:* ${request.requestedPackageName}\n` +
                    `*Durasi:* ${request.durationKey.replace('_', ' ')}\n` +
                    `*Berlaku hingga:* ${expirationDate.toLocaleString('id-ID')}\n\n` +
                    `Terima kasih telah menggunakan layanan kami.`;
                    
                const phoneNumbers = user.phone_number.split('|');
                for (const number of phoneNumbers) {
                    const normalizedNumber = number.trim().replace(/\D/g, '');
                    if (normalizedNumber.length > 5) {
                        try {
                            const { delay } = await import('@whiskeysockets/baileys');
                            await global.raf.sendMessage(`${normalizedNumber}@s.whatsapp.net`, { text: notifMessage });
                            await delay(1000);
                        } catch (e) {
                            console.error(`[SPEED_PAYMENT_NOTIF_ERROR] Failed to send notification to ${normalizedNumber}:`, e.message);
                        }
                    }
                }
            }
        } else {
            // Reject payment
            request.paymentStatus = 'rejected';
            request.paymentVerifiedBy = req.user.username;
            request.paymentVerifiedAt = new Date().toISOString();
            request.notes = notes || "Pembayaran ditolak.";
            
            // Notify customer about rejection
            const user = global.users.find(u => u.id === request.userId);
            if (user && user.phone_number && global.raf) {
                const notifMessage = `❌ *Pembayaran Speed Boost Ditolak*\n\n` +
                    `Halo ${user.name},\n` +
                    `Mohon maaf, bukti pembayaran Anda tidak dapat diverifikasi.\n\n` +
                    `*Alasan:* ${notes || 'Bukti pembayaran tidak valid'}\n\n` +
                    `Silakan upload ulang bukti pembayaran yang valid atau hubungi admin.`;
                    
                const phoneNumbers = user.phone_number.split('|');
                for (const number of phoneNumbers) {
                    const normalizedNumber = number.trim().replace(/\D/g, '');
                    if (normalizedNumber.length > 5) {
                        try {
                            const { delay } = await import('@whiskeysockets/baileys');
                            await global.raf.sendMessage(`${normalizedNumber}@s.whatsapp.net`, { text: notifMessage });
                            await delay(1000);
                        } catch (e) {
                            console.error(`[SPEED_PAYMENT_REJECT_NOTIF_ERROR] Failed to send notification:`, e.message);
                        }
                    }
                }
            }
        }
        
        request.updatedAt = new Date().toISOString();
        global.speed_requests[requestIndex] = request;
        saveSpeedRequests();
        
        return res.status(200).json({ 
            message: verified ? "Pembayaran berhasil diverifikasi dan speed boost diaktifkan." : "Pembayaran ditolak.",
            data: request
        });
    } catch (error) {
        console.error('[SPEED_PAYMENT_VERIFY_ERROR]', error);
        return res.status(500).json({ message: error.message || "Gagal memverifikasi pembayaran." });
    }
});

// POST /api/speed-requests/action
router.post('/speed-requests/action', ensureAdmin, async (req, res) => {
    const { requestId, action, notes } = req.body;
    if (!requestId || !action ) {
        return res.status(400).json({ message: "Parameter tidak lengkap. requestId dan action wajib diisi." });
    }
    const requestIndex = global.speed_requests.findIndex(r => r.id === requestId);
    if (requestIndex === -1) {
        return res.status(404).json({ message: "Permintaan tidak ditemukan." });
    }
    const request = global.speed_requests[requestIndex];
    if (request.status !== 'pending') {
        return res.status(400).json({ message: `Permintaan ini sudah dalam status '${request.status}' dan tidak dapat diubah lagi.` });
    }
    const adminUser = req.user;
    let notificationMessage = "";
    try {
        if (action === 'approve') {
            const user = global.users.find(u => u.id === request.userId);
            if (!user) throw new Error("User untuk permintaan ini tidak ditemukan.");
            const requestedPackage = global.packages.find(p => p.name === request.requestedPackageName);
            if (!requestedPackage || !requestedPackage.profile) throw new Error("Paket yang diminta atau profilnya tidak ditemukan.");
            const newProfile = requestedPackage.profile;
            console.log(`[SPEED_APPROVE] Menyetujui request ${requestId} untuk user ${user.name}. Mengubah profil ke ${newProfile}`);
            await updatePPPoEProfile(user.pppoe_username, newProfile);
            try {
                await deleteActivePPPoEUser(user.pppoe_username);
            } catch (e) {
                console.warn(`[SPEED_APPROVE_WARN] Gagal menghapus sesi aktif untuk ${user.pppoe_username}, mungkin tidak sedang online. Melanjutkan proses. Error: ${e.message}`);
            }
            let durationInHours = 0;
            if (request.durationKey === '1_day') durationInHours = 24;
            else if (request.durationKey === '3_days') durationInHours = 72;
            else if (request.durationKey === '7_days') durationInHours = 168;
            if (durationInHours === 0) {
                throw new Error("Kunci durasi tidak valid pada permintaan.");
            }
            const now = new Date();
            const expirationDate = new Date(now.getTime() + durationInHours * 60 * 60 * 1000);
            request.status = 'active';
            request.updatedAt = now.toISOString();
            request.approvedBy = adminUser.username;
            request.durationHours = durationInHours;
            request.expirationDate = expirationDate.toISOString();
            request.notes = notes || "";
            notificationMessage = `✅ *Permintaan Speed on Demand Disetujui!*\n\nHalo ${user.name},\nKabar baik! Permintaan Anda untuk penambahan kecepatan ke paket *${request.requestedPackageName}* telah disetujui.\n\nLayanan Anda telah di-upgrade dan akan aktif selama *${request.durationKey.replace('_', ' ')}*.\n\nTerima kasih telah menggunakan layanan kami.`;
        } else if (action === 'reject') {
            request.status = 'rejected';
            request.updatedAt = new Date().toISOString();
            request.approvedBy = adminUser.username;
            request.notes = notes || "Ditolak oleh admin.";
            const user = global.users.find(u => u.id === request.userId);
            notificationMessage = `❌ *Permintaan Speed on Demand Ditolak*\n\nHalo ${user.name},\nMohon maaf, permintaan Anda untuk penambahan kecepatan ke paket *${request.requestedPackageName}* saat ini belum dapat kami setujui.\n\nSilakan hubungi admin untuk informasi lebih lanjut.`;
        } else {
            return res.status(400).json({ message: "Aksi tidak valid. Gunakan 'approve' atau 'reject'." });
        }
        global.speed_requests[requestIndex] = request;
        saveSpeedRequests();
        const user = global.users.find(u => u.id === request.userId);

        // Send notification
        if (user && user.phone_number && global.raf) {
            let messageToSend = notificationMessage;

            // Try to use the template for approvals if conditions are met
            if (action === 'approve') {
                try {
                    const cronConfig = JSON.parse(fs.readFileSync(path.join(__dirname, '../database/cron.json'), 'utf8'));
                    if (cronConfig.status_message_sod_applied === true && templatesCache.notificationTemplates['speed_on_demand_applied']) {
                        const locale = cronConfig.date_locale_for_notification || 'id-ID';
                        const dateOptions = cronConfig.date_options_for_notification || { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
                        const expirationDateFormatted = new Date(request.expirationDate).toLocaleString(locale, dateOptions);

                        const templateData = {
                            nama: user.name,
                            requestedPackageName: request.requestedPackageName,
                            expirationDate: expirationDateFormatted,
                        };
                        messageToSend = renderTemplate('speed_on_demand_applied', templateData);
                        console.log("[SPEED_ACTION_NOTIF] Using template for 'applied' notification.");
                    } else {
                        console.log("[SPEED_ACTION_NOTIF] Template conditions not met, falling back to simple notification.");
                    }
                } catch (e) {
                    console.error("[SPEED_ACTION_NOTIF_ERROR] Could not read cron.json or render template, falling back to simple notification.", e);
                }
            }

            // Send the determined message
            const phoneNumbers = user.phone_number.split('|');
            for (const number of phoneNumbers) {
                const normalizedNumber = normalizePhoneNumber(number);
                if (normalizedNumber) {
                    try {
                        const { delay } = await import('@whiskeysockets/baileys');
                        await global.raf.sendMessage(`${normalizedNumber}@s.whatsapp.net`, { text: messageToSend });
                        console.log(`[SPEED_ACTION_NOTIF] Notification sent to ${user.name} at ${normalizedNumber}`);
                        await delay(1000);
                    } catch (e) {
                        console.error(`[SPEED_ACTION_NOTIF_ERROR] Failed to send notification to ${normalizedNumber}:`, e.message);
                    }
                }
            }
        }
        return res.status(200).json({ message: `Permintaan berhasil di-${action === 'approve' ? 'setujui' : 'tolak'}.` });
    } catch (error) {
        console.error(`[API_SPEED_ACTION_ERROR] Gagal memproses permintaan ${requestId}:`, error);
        return res.status(500).json({ message: error.message || "Terjadi kesalahan internal server." });
    }
});

// Cleanup expired speed requests
router.post('/speed-requests/cleanup', ensureAdmin, (req, res) => {
    try {
        const { cleanupSpeedBoostRequests } = require('../lib/speed-boost-cleanup');
        const cleanedCount = cleanupSpeedBoostRequests();
        
        res.json({ 
            success: true,
            message: `Berhasil cleanup ${cleanedCount} speed boost request${cleanedCount !== 1 ? 's' : ''}`,
            cleanedCount: cleanedCount
        });
    } catch (error) {
        console.error('[SPEED_REQUESTS_CLEANUP_API_ERROR]', error);
        res.status(500).json({ 
            success: false,
            message: 'Gagal melakukan cleanup: ' + error.message 
        });
    }
});

// Speed Boost Configuration endpoints
router.get('/speed-boost-config', ensureAdmin, (req, res) => {
    try {
        const configPath = path.join(__dirname, '..', 'database', 'speed_boost_matrix.json');
        if (fs.existsSync(configPath)) {
            const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            res.json(config);
        } else {
            // Return default config if file doesn't exist
            const defaultConfig = {
                enabled: true,
                description: "Speed Boost pricing configuration matrix",
                lastUpdated: new Date().toISOString(),
                globalSettings: {
                    allowMultipleBoosts: false,
                    requirePaymentFirst: true,
                    autoApproveDoubleBoost: true,
                    maxBoostDuration: 30,
                    minBoostDuration: 1
                },
                pricingMatrix: [],
                customPackages: [],
                paymentMethods: {
                    cash: {
                        enabled: true,
                        label: "Bayar Tunai",
                        requireProof: false,
                        autoApprove: false
                    },
                    transfer: {
                        enabled: true,
                        label: "Transfer Bank",
                        requireProof: true,
                        autoApprove: false
                    },
                    double_billing: {
                        enabled: true,
                        label: "Double Billing",
                        requireProof: false,
                        autoApprove: true,
                        maxAmount: 500000
                    }
                },
                templates: {
                    welcomeMessage: "🚀 *SPEED BOOST ON DEMAND*\\n\\nTingkatkan kecepatan internet Anda sesuai kebutuhan!",
                    successMessage: "✅ Request Speed Boost berhasil dibuat!\\n\\nID: {requestId}\\nPaket: {packageName}\\nDurasi: {duration}\\nHarga: {price}",
                    rejectionMessage: "❌ Maaf, request Speed Boost Anda ditolak.\\n\\nAlasan: {reason}"
                }
            };
            res.json(defaultConfig);
        }
    } catch (error) {
        console.error('[SPEED_BOOST_CONFIG_ERROR]', error);
        res.status(500).json({ message: 'Gagal memuat konfigurasi' });
    }
});

router.post('/speed-boost-config', ensureAdmin, (req, res) => {
    try {
        const configPath = path.join(__dirname, '..', 'database', 'speed_boost_matrix.json');
        const config = req.body;
        
        // Validate config structure
        if (!config.globalSettings || !config.pricingMatrix || !config.paymentMethods) {
            return res.status(400).json({ message: 'Invalid configuration structure' });
        }
        
        // Save configuration
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        
        // Reload global speed boost config if exists
        if (global.speedBoostConfig) {
            global.speedBoostConfig = config;
        }
        
        res.json({ message: 'Konfigurasi berhasil disimpan', success: true });
    } catch (error) {
        console.error('[SPEED_BOOST_CONFIG_SAVE_ERROR]', error);
        res.status(500).json({ message: 'Gagal menyimpan konfigurasi' });
    }
});

module.exports = router;
