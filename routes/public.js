const express = require('express');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const convertRupiah = require('rupiah-format');

// Local dependencies that were used by these routes in index.js
const pay = require("../lib/ipaymu");
const { getvoucher } = require("../lib/mikrotik");
const { addKoinUser, addATM, checkATMuser } = require('../lib/saldo');
const { updateStatusPayment, checkStatusPayment, delPayment, addPayBuy, addPayment, updateKetPayment } = require('../lib/payment');
const { checkprofvc, checkdurasivc, checkhargavc } = require('../lib/voucher');
const { saveReports, saveSpeedRequests, savePackageChangeRequests, loadJSON } = require('../lib/database');
const { comparePassword, hashPassword } = require('../lib/password');
const { apiAuth } = require('../lib/auth');
const { normalizePhoneNumber } = require('../lib/utils');
const { generateSecureOTP, checkOTPRequestLimit, checkOTPVerifyLimit, resetOTPAttempts, isOTPValid } = require('../lib/otp');
const { asyncHandler, createError, ErrorTypes, validateRequired, dbOperation } = require('../lib/error-handler');

const router = express.Router();

// --- Middleware & Helper Functions (moved from index.js) ---

// This function is now a wrapper around the centralized apiAuth middleware.
function ensureCustomerAuthenticated(req, res, next) {
    apiAuth(req, res, next);
}

function mapReportStatus(internalStatus) {
    switch (internalStatus) {
        case 'baru': return 'Submitted';
        case 'diproses teknisi': return 'In Progress';
        case 'selesai': return 'Resolved';
        case 'dibatalkan admin':
        case 'dibatalkan pelanggan': return 'Cancelled';
        default: return internalStatus;
    }
}

function generateAdminTicketId(length = 7) {
    const characters = 'ABCDEFGHJKLMNOPQRSTUVWXYZ23456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return `${result}`;
}


// --- Router Setup ---

// Middleware is now applied globally in index.js

router.post('/api/login', asyncHandler(async (req, res) => {
    const { username, password } = req.body;
    
    // Validate required fields
    validateRequired(req.body, ['username', 'password']);

    const account = global.accounts.find(acc => acc.username === username);
    const isValid = account && await comparePassword(password, account.password);

    if (!isValid) {
        throw createError(
            ErrorTypes.AUTHENTICATION_ERROR,
            'Username atau password salah.',
            401
        );
    }

    const payload = {
        id: account.id,
        username: account.username,
        name: account.name || account.username, // ✅ ADD name
        photo: account.photo || null, // ✅ ADD photo
        role: account.role
    };

    const token = jwt.sign(payload, global.config.jwt, { expiresIn: '1d' });

    res.cookie("token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000, // 1 day
        path: '/'
    });

    // Check if request wants JSON response (API call)
    if (req.headers.accept && req.headers.accept.includes('application/json')) {
        return res.json({
            status: 200,
            message: 'Login berhasil',
            token: token,
            user: {
                id: account.id,
                username: account.username,
                name: account.name || account.username, // ✅ ADD name
                photo: account.photo || null, // ✅ ADD photo
                role: account.role
            }
        });
    }

    // Redirect based on role
    if (account.role === 'teknisi') {
        return res.redirect('/pembayaran/teknisi');
    } else {
        return res.redirect('/');
    }
}));


// --- Customer Authenticated Routes ---

const customerApiRouter = express.Router();
customerApiRouter.use(ensureCustomerAuthenticated);

customerApiRouter.get('/profile', async (req, res) => {
    try {
        const customer = req.customer;
        const userPackage = global.packages.find(p => p.name === customer.subscription);
        if (!userPackage) {
            // This case might happen if a package is deleted but a user still has it.
            console.warn(`[API_CUSTOMER_PROFILE] Configuration for customer's package (${customer.subscription}) not found for user ID ${customer.id}.`);
            return res.status(404).json({ status: 404, message: `Konfigurasi untuk paket Anda (${customer.subscription}) tidak ditemukan.` });
        }

        const monthlyBill = parseFloat(userPackage.price);
        if (isNaN(monthlyBill)) {
            console.error(`[API_CUSTOMER_PROFILE] Invalid price format for package '${userPackage.name}'.`);
            return res.status(500).json({ status: 500, message: `Format harga tidak valid untuk paket '${userPackage.name}'.` });
        }

        const dueDay = (global.config && parseInt(global.config.tanggal_batas_bayar)) || 10;
        const now = new Date();
        let dueDate = new Date(now.getFullYear(), now.getMonth(), dueDay, 23, 59, 59, 999);
        // If the due date for this month has already passed, show next month's due date
        if (now > dueDate) {
            dueDate.setMonth(dueDate.getMonth() + 1);
        }

        return res.status(200).json({
            name: customer.name,
            username: customer.username,
            packageName: userPackage.name,
            monthlyBill,
            dueDate: dueDate.toISOString(),
            paymentStatus: customer.paid ? "PAID" : "UNPAID",
            address: customer.address || null,
            phone_number: customer.phone_number,
            allowed_ssids: customer.bulk || []
        });
    } catch (error) {
        console.error(`[API_CUSTOMER_PROFILE_ERROR] Error for user ID ${req.customer?.id}:`, error);
        return res.status(500).json({ status: 500, message: "Internal Server Error." });
    }
});

customerApiRouter.get('/reports/history', async (req, res) => {
    try {
        const customer = req.customer;
        const customerJids = customer.phone_number.split('|').map(n => normalizePhoneNumber(n) + '@s.whatsapp.net');
        const reportHistory = global.reports.filter(r => customerJids.includes(r.pelangganId));
        const responseData = reportHistory.map(report => ({
            id: report.ticketId,
            category: report.category,
            status: mapReportStatus(report.status),
            submittedAt: report.createdAt
        })).sort((a, b) => new Date(b.submittedAt) - new Date(a.createdAt));
        return res.status(200).json(responseData);
    } catch (error) {
        console.error('[API_REPORTS_HISTORY_ERROR]', error);
        return res.status(500).json({ status: 500, message: "Internal Server Error." });
    }
});

customerApiRouter.post('/request-package-change', async (req, res) => {
    const { targetPackageName } = req.body;
    const customer = req.customer;

    if (!targetPackageName) {
        return res.status(400).json({ status: 400, message: "Parameter 'targetPackageName' wajib diisi." });
    }

    try {
        // Use global.packageChangeRequests which is loaded at startup
        const existingRequest = global.packageChangeRequests.find(r => r.userId === customer.id && r.status === 'pending');
        if (existingRequest) {
            return res.status(409).json({ status: 409, message: `Anda sudah memiliki permintaan perubahan paket yang sedang diproses. Mohon tunggu hingga selesai.` });
        }

        const requestedPackage = global.packages.find(p => p.name === targetPackageName);
        if (!requestedPackage) {
            return res.status(404).json({ status: 404, message: `Paket tujuan "${targetPackageName}" tidak ditemukan.` });
        }

        if (customer.subscription === targetPackageName) {
            return res.status(400).json({ status: 400, message: `Anda sudah menggunakan paket "${targetPackageName}".` });
        }

        const newRequest = {
            id: `pkgchange_${Date.now()}_${customer.id}`,
            userId: customer.id,
            userName: customer.name,
            currentPackageName: customer.subscription,
            requestedPackageName: targetPackageName,
            status: 'pending',
            createdAt: new Date().toISOString(),
            updatedAt: null,
            approvedBy: null
        };

        global.packageChangeRequests.unshift(newRequest);
        savePackageChangeRequests(); // This function saves the global.packageChangeRequests array

        if (global.raf && global.config.ownerNumber && Array.isArray(global.config.ownerNumber)) {
            const notifMessage = `🔄 *Permintaan Perubahan Paket Baru* 🔄\n\nPelanggan telah mengajukan permintaan perubahan paket.\n\n*Pelanggan:* ${customer.name}\n*Paket Saat Ini:* ${customer.subscription}\n*Paket Diminta:* ${targetPackageName}\n\nMohon segera ditinjau di panel admin.`;
            for (const ownerNum of global.config.ownerNumber) {
                const { delay } = await import('@whiskeysockets/baileys');
                const ownerJid = ownerNum.endsWith('@s.whatsapp.net') ? ownerNum : `${ownerNum}@s.whatsapp.net`;
                try {
                    await delay(500);
                    await global.raf.sendMessage(ownerJid, { text: notifMessage });
                } catch (e) {
                    console.error(`[PACKAGE_CHANGE_NOTIF_ERROR] Gagal mengirim notifikasi ke owner ${ownerJid}:`, e.message);
                }
            }
        }

        return res.status(201).json({ status: 201, message: "Permintaan perubahan paket Anda telah berhasil dikirim dan menunggu persetujuan admin." });

    } catch (error) {
        console.error('[API_PACKAGE_CHANGE_FATAL_ERROR]', error);
        return res.status(500).json({ status: 500, message: "Terjadi kesalahan pada server." });
    }
});

customerApiRouter.post('/account/update', async (req, res) => {
    const { currentPassword, newUsername, newPassword } = req.body;
    const customer = req.customer; // Authenticated customer from middleware

    if (!currentPassword) {
        return res.status(400).json({ status: 400, message: "Password saat ini diperlukan untuk verifikasi." });
    }
    if (!newUsername && !newPassword) {
        return res.status(400).json({ status: 400, message: "Tidak ada data untuk diubah. Harap berikan username baru atau password baru." });
    }

    try {
        // 1. Verify current password
        const isPasswordValid = await comparePassword(currentPassword, customer.password);
        if (!isPasswordValid) {
            return res.status(403).json({ status: 403, message: "Password saat ini yang Anda masukkan salah." });
        }

        let updates = [];
        let params = [];
        let cacheUpdates = {};

        // 2. Handle username change
        if (newUsername && newUsername !== customer.username) {
            // Check if new username is already taken
            const existingUser = global.users.find(u => u.username && u.username.toLowerCase() === newUsername.toLowerCase() && u.id !== customer.id);
            if (existingUser) {
                return res.status(409).json({ status: 409, message: `Username '${newUsername}' sudah digunakan. Silakan pilih yang lain.` });
            }
            updates.push("username = ?");
            params.push(newUsername);
            cacheUpdates.username = newUsername;
        }

        // 3. Handle password change
        if (newPassword) {
            const hashedPassword = await hashPassword(newPassword);
            updates.push("password = ?");
            params.push(hashedPassword);
            cacheUpdates.password = hashedPassword; // We update the cache with the hash
        }

        if (updates.length === 0) {
            return res.status(200).json({ status: 200, message: "Tidak ada perubahan yang dilakukan." });
        }

        // 4. Update database
        const sql = `UPDATE users SET ${updates.join(', ')} WHERE id = ?`;
        params.push(customer.id);

        await new Promise((resolve, reject) => {
            global.db.run(sql, params, function(err) {
                if (err) {
                    console.error("[CUSTOMER_UPDATE_ERROR] Gagal memperbarui data di DB:", err.message);
                    return reject(new Error("Gagal memperbarui akun Anda."));
                }
                if (this.changes === 0) {
                    return reject(new Error("User tidak ditemukan di database saat pembaruan."));
                }
                resolve();
            });
        });

        // 5. Update in-memory cache on success
        Object.assign(customer, cacheUpdates);

        return res.status(200).json({ status: 200, message: "Akun Anda telah berhasil diperbarui." });

    } catch (error) {
        console.error("[API_CUSTOMER_UPDATE_ERROR]", error);
        return res.status(500).json({ status: 500, message: error.message || "Terjadi kesalahan pada server." });
    }
});

router.use('/api/customer', customerApiRouter);

// Additional customer endpoints for NextJS frontend
router.get('/api/customer/speed-requests/active', ensureCustomerAuthenticated, async (req, res) => {
    try {
        const speedHelper = require('../lib/speed-request-helper');
        const customer = req.customer;
        
        // Find active speed request
        const activeRequest = global.speed_requests.find(r => 
            r.userId === customer.id && r.status === 'active'
        );
        
        if (!activeRequest) {
            return res.status(200).json({ 
                status: 200, 
                data: null,
                message: "Tidak ada speed boost yang aktif." 
            });
        }
        
        // Format response using helper
        const formattedRequest = speedHelper.formatSpeedRequest(activeRequest, global.packages);
        
        return res.status(200).json({ 
            status: 200, 
            data: formattedRequest 
        });
    } catch (error) {
        console.error('[API_CUSTOMER_SPEED_ACTIVE_ERROR]', error);
        return res.status(500).json({ 
            status: 500, 
            message: "Terjadi kesalahan pada server." 
        });
    }
});

router.get('/api/customer/speed-requests/history', ensureCustomerAuthenticated, async (req, res) => {
    try {
        const speedHelper = require('../lib/speed-request-helper');
        const customer = req.customer;
        
        // Get all speed requests for this customer
        const customerRequests = global.speed_requests.filter(r => r.userId === customer.id);
        
        // Sort by created date (newest first)
        const sortedRequests = customerRequests.sort((a, b) => 
            new Date(b.createdAt) - new Date(a.createdAt)
        );
        
        // Format all requests
        const formattedRequests = sortedRequests.map(request => 
            speedHelper.formatSpeedRequest(request, global.packages)
        );
        
        return res.status(200).json({ 
            status: 200, 
            data: formattedRequests 
        });
    } catch (error) {
        console.error('[API_CUSTOMER_SPEED_HISTORY_ERROR]', error);
        return res.status(500).json({ 
            status: 500, 
            message: "Terjadi kesalahan pada server." 
        });
    }
});

router.post('/api/customer/speed-requests/cancel', ensureCustomerAuthenticated, async (req, res) => {
    try {
        const customer = req.customer;
        const { requestId } = req.body;
        
        if (!requestId) {
            return res.status(400).json({ 
                status: 400, 
                message: "ID permintaan diperlukan." 
            });
        }
        
        // Find the request
        const requestIndex = global.speed_requests.findIndex(r => 
            r.id === requestId && r.userId === customer.id
        );
        
        if (requestIndex === -1) {
            return res.status(404).json({ 
                status: 404, 
                message: "Permintaan tidak ditemukan." 
            });
        }
        
        const request = global.speed_requests[requestIndex];
        
        // Only allow cancellation of pending requests
        if (request.status !== 'pending') {
            return res.status(400).json({ 
                status: 400, 
                message: `Permintaan dengan status '${request.status}' tidak dapat dibatalkan.` 
            });
        }
        
        // Update status
        request.status = 'cancelled';
        request.updatedAt = new Date().toISOString();
        request.notes = 'Dibatalkan oleh pelanggan';
        
        // Save changes
        saveSpeedRequests();
        
        return res.status(200).json({ 
            status: 200, 
            message: "Permintaan speed boost berhasil dibatalkan." 
        });
    } catch (error) {
        console.error('[API_CUSTOMER_SPEED_CANCEL_ERROR]', error);
        return res.status(500).json({ 
            status: 500, 
            message: "Terjadi kesalahan pada server." 
        });
    }
});

router.get('/api/customer/speed-boost/available', ensureCustomerAuthenticated, async (req, res) => {
    try {
        const speedHelper = require('../lib/speed-request-helper');
        const customer = req.customer;
        
        // Validate customer eligibility
        const validation = speedHelper.validateSpeedRequest(customer, global.packages);
        if (!validation.valid) {
            return res.status(200).json({ 
                status: 200, 
                data: [],
                message: validation.errors[0] 
            });
        }
        
        // Get available speed boost packages
        const availablePackages = speedHelper.getAvailableSpeedBoosts(customer, global.packages);
        
        // Format response with pricing for each duration
        const formattedPackages = availablePackages.map(pkg => {
            const durations = {};
            
            // Calculate price for each available duration
            Object.keys(speedHelper.DURATION_MAP).forEach(durationKey => {
                if (durationKey.includes('_')) { // Use standard format only
                    const price = speedHelper.calculateBoostPrice(
                        global.packages.find(p => p.name === customer.subscription),
                        pkg,
                        durationKey
                    );
                    if (price) {
                        const durationInfo = speedHelper.getDurationInfo(durationKey);
                        durations[durationKey] = {
                            label: durationInfo.label,
                            hours: durationInfo.hours,
                            price: price
                        };
                    }
                }
            });
            
            return {
                name: pkg.name,
                profile: pkg.profile,
                basePrice: pkg.price,
                durations: durations
            };
        });
        
        return res.status(200).json({ 
            status: 200, 
            data: formattedPackages 
        });
    } catch (error) {
        console.error('[API_CUSTOMER_SPEED_AVAILABLE_ERROR]', error);
        return res.status(500).json({ 
            status: 500, 
            message: "Terjadi kesalahan pada server." 
        });
    }
});

router.get('/api/dashboard-status', ensureCustomerAuthenticated, async (req, res) => {
    try {
        const customer = req.customer;
        const activeBoost = global.speed_requests.find(r => r.userId === customer.id && r.status === 'active');
        let boostResponse = null;
        if (activeBoost) {
            const boostPackage = global.packages.find(p => p.name === activeBoost.requestedPackageName);
            boostResponse = {
                profile: boostPackage ? boostPackage.name : activeBoost.requestedPackageName,
                expiresAt: activeBoost.expirationDate
            };
        }
        const customerJids = customer.phone_number.split('|').map(n => normalizePhoneNumber(n) + '@s.whatsapp.net');
        const activeReport = global.reports.find(r => customerJids.includes(r.pelangganId) && (r.status === 'baru' || r.status === 'diproses teknisi'));
        let reportResponse = null;
        if (activeReport) {
            reportResponse = { id: activeReport.ticketId, category: activeReport.category, status: mapReportStatus(activeReport.status) };
        }
        return res.status(200).json({ activeBoost: boostResponse, activeReport: reportResponse });
    } catch (error) {
        console.error('[API_DASHBOARD_STATUS_ERROR]', error);
        return res.status(500).json({ status: 500, message: "Internal Server Error." });
    }
});

// --- Public Unauthenticated Routes ---

router.get('/app/:type/:id?', async (req, res) => {
    const { type, id } = req.params;
    try {
        switch(type) {
            case "buy": {
                const { phone, email } = req.query;
                if (!phone || !email) return res.status(400).json({ status: 400, message: "Nomor telepon dan email diperlukan!" });
                const reff = Math.floor(Math.random() * 1677721631342).toString(16);
                let hargavc = checkhargavc(id);
                hargavc = parseInt(hargavc);
                let result = await pay({ amount: hargavc, reffId: reff, comment: `pembelian voucher ${id} sebesar Rp. ${hargavc} melalui web`, name: email?.split('@')?.[0] || "Anonymous", phone: parseInt(phone), email });
                addPayment(reff, result.id, phone, `buynowweb`, hargavc, 'QRIS', ``, { qrStr: result.qrString, priceTotal: result.total, fee: result.fee, subtotal: result.subTotal });
                return res.status(200).json({ status: 200, message: 'Success', data: reff });
            }
            case 'detailtrx': {
                return res.status(200).json({ status: 200, message: 'Success', data: global.payment.find(h => h.reffId == id) || null });
            }
            case 'statustrx': {
                let pay = global.payment.find(d => d.reffId == id);
                if (!pay) return res.status(404).json({ status: 404, message: "" });
                if (!pay.status) return res.status(400).json({ status: 400, message: "menunggu pembayaran!" });
                return res.status(200).json({ status: 200, message: 'Success', data: global.payment.find(h => h.reffId == id) || null });
            }
            default: {
                return res.json({ data: type == 'packages' ? global.packages : type == 'voucher' ? global.voucher : [] });
            }
        }
    } catch(err) {
        if (typeof err === "string") return res.json({ status: 400, message: err });
        console.log(err);
        return res.json({ status: 500, message: "Internal server error" });
    }
});

router.post('/callback/payment', async (req, res) => {
    const { reference_id, status_code } = req.body;
    try {
        const pay = global.payment.find(val => val.reffId == reference_id);
        if (!pay) throw !1;
        if (status_code == '1') {
            let isDone = checkStatusPayment(reference_id);
            if (isDone) throw !0;
            if (pay.tag == 'buynow') {
                const prof = checkprofvc(`${pay.amount}`);
                const durasivc = checkdurasivc(prof);
                const hargavc = checkhargavc(prof);
                await getvoucher(prof, pay.sender).then(async result => {
                    updateKetPayment(reference_id, `Voucher: ${result}`);
                    updateStatusPayment(reference_id, true);
                    if (pay.sender != "buynow" && global.raf) {
                        await global.raf.sendMessage(pay.sender, { text: `\n=============================\nPaket                    : *${durasivc}*\nHarga                    : *${convertRupiah.convert(hargavc)}*\nKode Voucher     : *${result}*\n=============================\nStatus Transaksi : *Berhasil*\n=============================\n_Terima Kasih Atas Pembelian Anda_` });
                    }
                    throw !0;
                }).catch(async err => {
                    if (typeof err === "string") {
                        if (pay.sender != "buynow" && global.raf) {
                            updateStatusPayment(reference_id, true);
                            await global.raf.sendMessage(pay.sender, { text: err });
                            throw !0;
                        }
                    } else throw !1;
                });
            } else if (pay.tag == 'buynowweb') {
                const prof = checkprofvc(String(pay.amount));
                await getvoucher(prof, pay.sender).then(async result => {
                    updateKetPayment(reference_id, `${result}`);
                    updateStatusPayment(reference_id, true);
                    throw !0;
                }).catch(async err => {
                    if (typeof err === "string") {
                        updateKetPayment(reference_id, `${err}`);
                        updateStatusPayment(reference_id, true);
                        throw !0;
                    } else throw !1;
                });
            } else if (pay.tag == 'topup') {
                const checkATM = checkATMuser(pay.sender);
                if (checkATM == undefined) addATM(pay.sender);
                addKoinUser(pay.sender, pay.amount);
                updateStatusPayment(reference_id, true);
                if (global.raf) await global.raf.sendMessage(pay.sender, { text: `Topup saldo masuk!\n- Terbaca: ${convertRupiah.convert(pay.amount)}\n- Total saldo: ${convertRupiah.convert(checkATMuser(pay.sender))}` });
                else console.warn(`[TOPUP_NOTIFICATION_SKIP] WhatsApp connection is not open. User: ${pay.sender}`);
                throw !0;
            }
        }
    } catch(err) {
        res.status(err ? 200 : 500).json({ status: err });
    }
});

// This route is obsolete and insecure. It is replaced by GET /api/customer/profile
// router.get('/api/user/:phoneNumber', apiAuth, async (req, res) => { ... });

router.post('/api/lapor', apiAuth, async (req, res) => {
    // Refactored: User is identified by token, not by phone number in the body.
    const { category, reportText } = req.body;
    const user = req.customer; // Use authenticated user from middleware

    if (!category || !reportText) {
        return res.status(400).json({ status: 400, message: "Kategori dan isi laporan wajib diisi." });
    }

    try {
        // Use the first phone number as the primary JID for notifications
        const primaryPhoneNumber = user.phone_number.split('|')[0];
        const customerJid = `${normalizePhoneNumber(primaryPhoneNumber)}@s.whatsapp.net`;

        const existingActiveReport = global.reports.find(r => r.pelangganId === customerJid && (r.status === 'baru' || r.status === 'diproses teknisi'));
        if (existingActiveReport) {
            return res.status(409).json({ status: 409, message: `Anda sudah memiliki laporan aktif dengan ID Tiket: ${existingActiveReport.ticketId}. Mohon tunggu hingga laporan tersebut diselesaikan.`, ticketId: existingActiveReport.ticketId });
        }

        const ticketId = generateAdminTicketId(7);
        const now = new Date();
        // Refactored: Use user object from token for all user-related data
        const newReport = {
            ticketId,
            pelangganId: customerJid,
            pelangganPushName: user.name,
            pelangganDataSystem: { id: user.id, name: user.name, address: user.address, subscription: user.subscription, pppoe_username: user.pppoe_username },
            category,
            laporanText: reportText,
            status: "baru",
            createdAt: now.toISOString(),
            createdBy: { type: 'customer_panel', ip: req.ip, userId: user.id },
            assignedTeknisiId: null,
            processingStartedAt: null,
            processedByTeknisiId: null,
            processedByTeknisiName: null,
            resolvedAt: null,
            resolvedByTeknisiId: null,
            resolvedByTeknisiName: null
        };

        global.reports.unshift(newReport);
        saveReports();

        if (global.raf) {
            const confirmationMessage = `✅ *Laporan Anda Telah Diterima*\n\nHalo *${user.name}*,\n\nTerima kasih, laporan Anda telah berhasil kami terima dan akan segera diproses oleh tim kami.\n\n*Detail Laporan Anda:*\n- *Nomor Tiket:* *${ticketId}*\n- *Kategori:* ${category}\n- *Isi Laporan:* ${reportText}\n\nMohon simpan Nomor Tiket ini untuk referensi Anda. Tim teknisi kami akan segera menghubungi Anda.\n\nTerima kasih,\nTim Layanan ${global.config.nama || 'Kami'}`;
            try {
                await global.raf.sendMessage(customerJid, { text: confirmationMessage });
            } catch (e) {
                console.error(`[API_LAPOR_ERROR] Gagal mengirim konfirmasi ke pelanggan ${customerJid}:`, e.message);
            }

            const teknisiAccounts = global.accounts.filter(acc => acc.role === 'teknisi' && acc.phone_number && acc.phone_number.trim() !== "");
            if (teknisiAccounts.length > 0) {
                const linkWaPelanggan = `https://wa.me/${normalizePhoneNumber(primaryPhoneNumber)}`;
                const waktuLaporFormatted = now.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta' });
                let detailPelangganUntukTeknisi = `*Dari:* ${user.name} (${linkWaPelanggan})\n*Nama Sistem:* ${user.name}\n*Alamat:* ${user.address || 'N/A'}\n*Paket:* ${user.subscription || 'N/A'}\n`;
                if(user.pppoe_username) detailPelangganUntukTeknisi += `*PPPoE:* ${user.pppoe_username}`;
                const messageToTeknisi = `🔔 *LAPORAN BARU DARI PELANGGAN* 🔔\n\n*ID TIKET: ${ticketId}*\n\n*Waktu Lapor:* ${waktuLaporFormatted}\n\n*Data Pelanggan:*\n${detailPelangganUntukTeknisi}\n\n*Kategori Laporan: ${category}*\n*Isi Laporan:*\n${reportText}\n\n-----------------------------------\nMohon segera ditindaklanjuti. Periksa dashboard teknisi untuk memproses tiket ini.`;
                for (const teknisi of teknisiAccounts) {
                    let teknisiJid = normalizePhoneNumber(teknisi.phone_number);
                    if (teknisiJid) {
                        teknisiJid += '@s.whatsapp.net';
                        try {
                            const { delay } = await import('@whiskeysockets/baileys');
                            await delay(500);
                            await global.raf.sendMessage(teknisiJid, { text: messageToTeknisi });
                        } catch (e) {
                            console.error(`[API_LAPOR_ERROR] Gagal mengirim notifikasi ke teknisi ${teknisi.username} (${teknisiJid}):`, e.message);
                        }
                    }
                }
            }
        } else {
            console.warn("[API_LAPOR_WARN] Koneksi WhatsApp tidak aktif, notifikasi tidak dikirim.");
        }
        return res.status(201).json({ status: 201, message: "Laporan berhasil dibuat. Tim kami akan segera menghubungi Anda.", ticketId });
    } catch (error) {
        console.error('[API_LAPOR_FATAL_ERROR] Kesalahan tidak terduga di endpoint /api/lapor:', error);
        return res.status(500).json({ status: 500, message: "Terjadi kesalahan pada server." });
    }
});

router.post('/api/request-speed', apiAuth, async (req, res) => {
    // Import helper functions
    const speedHelper = require('../lib/speed-request-helper');
    
    // User is identified by token, not by phone number in the body.
    const { targetPackageName, duration, paymentMethod = 'cash' } = req.body;
    const user = req.customer; // Use authenticated user from middleware

    if (!targetPackageName || !duration) {
        return res.status(400).json({ status: 400, message: "Parameter tidak lengkap. targetPackageName, dan duration wajib diisi." });
    }
    
    // Validate payment method
    const validPaymentMethods = ['cash', 'transfer', 'double_billing'];
    if (!validPaymentMethods.includes(paymentMethod)) {
        return res.status(400).json({ 
            status: 400, 
            message: `Metode pembayaran tidak valid. Gunakan: ${validPaymentMethods.join(', ')}` 
        });
    }
    
    try {
        // Step 1: Validate user eligibility for speed request
        const validation = speedHelper.validateSpeedRequest(user, global.packages);
        if (!validation.valid) {
            return res.status(400).json({ 
                status: 400, 
                message: validation.errors[0] || "Anda tidak memenuhi syarat untuk request speed boost." 
            });
        }

        // Step 2: Validate requested package
        const requestedPackage = global.packages.find(p => p.name === targetPackageName);
        if (!requestedPackage) {
            return res.status(404).json({ status: 404, message: `Paket tujuan "${targetPackageName}" tidak ditemukan.` });
        }
        
        // Check if it's a valid speed boost package
        if (!requestedPackage.isSpeedBoost) {
            return res.status(400).json({ status: 400, message: `Paket "${targetPackageName}" bukan paket speed boost.` });
        }
        
        // Check if target package is higher than current
        const currentPackage = global.packages.find(p => p.name === user.subscription);
        if (currentPackage && Number(requestedPackage.price) <= Number(currentPackage.price)) {
            return res.status(400).json({ 
                status: 400, 
                message: "Paket speed boost harus memiliki kecepatan lebih tinggi dari paket Anda saat ini." 
            });
        }

        // Step 3: Normalize duration and calculate price
        const normalizedDuration = speedHelper.normalizeDurationKey(duration);
        if (!normalizedDuration) {
            return res.status(400).json({ status: 400, message: `Durasi '${duration}' tidak valid. Gunakan: 1_day, 3_days, atau 7_days.` });
        }
        
        const price = speedHelper.calculateBoostPrice(currentPackage, requestedPackage, normalizedDuration);
        if (!price) {
            return res.status(400).json({ status: 400, message: `Harga untuk durasi '${duration}' pada paket '${targetPackageName}' tidak tersedia.` });
        }

        // Step 4: Create standardized speed request with payment method
        const newRequest = speedHelper.createSpeedRequest(user, targetPackageName, normalizedDuration, price, paymentMethod);
        
        // Set payment amount
        newRequest.paymentAmount = price;
        
        // For double billing, mark as pending (will be paid with next invoice)
        if (paymentMethod === 'double_billing') {
            newRequest.paymentStatus = 'pending';
        }
        
        // Save to database
        global.speed_requests.unshift(newRequest);
        saveSpeedRequests();

        if (global.raf && global.config.ownerNumber && Array.isArray(global.config.ownerNumber)) {
            const paymentMethodText = {
                'cash': 'Cash',
                'transfer': 'Transfer Bank',
                'double_billing': 'Tagihan Bulan Depan'
            };
            
            const notifMessage = `🚀 *Permintaan Speed on Demand Baru* 🚀\n\n` +
                `Pelanggan telah mengajukan permintaan penambahan kecepatan.\n\n` +
                `*Pelanggan:* ${user.name}\n` +
                `*Paket Saat Ini:* ${user.subscription}\n` +
                `*Paket Diminta:* ${targetPackageName}\n` +
                `*Durasi:* ${normalizedDuration.replace('_', ' ')}\n` +
                `*Harga:* Rp ${price.toLocaleString('id-ID')}\n` +
                `*Metode Pembayaran:* ${paymentMethodText[paymentMethod] || paymentMethod}\n\n` +
                `${paymentMethod === 'double_billing' ? '📝 Akan ditagihkan pada invoice bulan depan\n\n' : '⏳ Menunggu bukti pembayaran dari pelanggan\n\n'}` +
                `Mohon segera ditinjau di halaman admin "Speed Requests".`;
            
            for (const ownerNum of global.config.ownerNumber) {
                const { delay } = await import('@whiskeysockets/baileys');
                const ownerJid = ownerNum.endsWith('@s.whatsapp.net') ? ownerNum : `${ownerNum}@s.whatsapp.net`;
                try {
                    await delay(500);
                    await global.raf.sendMessage(ownerJid, { text: notifMessage });
                } catch (e) {
                    console.error(`[SPEED_REQUEST_NOTIF_ERROR] Gagal mengirim notifikasi ke owner ${ownerJid}:`, e.message);
                }
            }
        }
        // Prepare response message based on payment method
        let responseMessage = "Permintaan penambahan kecepatan Anda telah berhasil dikirim.";
        
        if (paymentMethod === 'cash' || paymentMethod === 'transfer') {
            responseMessage += " Silakan upload bukti pembayaran untuk melanjutkan proses.";
        } else if (paymentMethod === 'double_billing') {
            responseMessage += " Biaya akan ditambahkan ke tagihan bulan depan. Menunggu persetujuan admin.";
        }
        
        return res.status(201).json({ 
            status: 201, 
            message: responseMessage,
            data: {
                requestId: newRequest.id,
                paymentMethod: paymentMethod,
                amount: price,
                needsPaymentProof: ['cash', 'transfer'].includes(paymentMethod)
            }
        });
    } catch (error) {
        console.error('[API_SPEED_REQUEST_FATAL_ERROR]', error);
        return res.status(500).json({ status: 500, message: "Terjadi kesalahan pada server." });
    }
});

router.get('/api/speed-boost/packages', (req, res) => {
    try {
        const speedHelper = require('../lib/speed-request-helper');
        const availableBoosts = global.packages.filter(p => p.isSpeedBoost === true);
        
        // Standardize the response format
        const responseData = availableBoosts.map(p => {
            const durations = {};
            
            // Normalize speed boost prices to use standard duration keys
            if (p.speedBoostPrices) {
                Object.keys(p.speedBoostPrices).forEach(key => {
                    const normalizedKey = speedHelper.normalizeDurationKey(key);
                    if (normalizedKey && p.speedBoostPrices[key]) {
                        const durationInfo = speedHelper.getDurationInfo(normalizedKey);
                        durations[normalizedKey] = {
                            label: durationInfo.label,
                            hours: durationInfo.hours,
                            price: Number(p.speedBoostPrices[key]) || 0
                        };
                    }
                });
            }
            
            // Add default durations if not present
            ['1_day', '3_days', '7_days'].forEach(key => {
                if (!durations[key]) {
                    const durationInfo = speedHelper.getDurationInfo(key);
                    durations[key] = {
                        label: durationInfo.label,
                        hours: durationInfo.hours,
                        price: 0
                    };
                }
            });
            
            return {
                name: p.name,
                price: p.price,
                profile: p.profile,
                speedBoostPrices: durations
            };
        });
        return res.status(200).json({ data: responseData });
    } catch (error) {
        console.error('[API_SPEED_BOOST_PACKAGES_ERROR]', error);
        return res.status(500).json({ status: 500, message: "Internal Server Error." });
    }
});

router.post('/api/otp', async (req, res) => {
    if (!req.body.phoneNumber) return res.status(400).json({ message: "Nomor telepon diperlukan" });
    if (!global.raf) return res.status(500).json({ message: "Bot is offline" });
    
    // Check rate limiting
    const rateLimitCheck = checkOTPRequestLimit(req.body.phoneNumber);
    if (!rateLimitCheck.allowed) {
        return res.status(429).json({ 
            message: `Terlalu banyak permintaan OTP. Coba lagi dalam ${rateLimitCheck.remainingTime} menit.` 
        });
    }
    
    const otp = generateSecureOTP(6);
    const userToUpdate = global.users.find(v => v.phone_number.split('|').includes(req.body.phoneNumber));
    if (!userToUpdate) return res.status(404).json({ message: "User tidak ditemukan" });

    const otpTimestamp = Date.now();
    global.db.run(`UPDATE users SET otp = ?, otpTimestamp = ? WHERE id = ?`, [otp, otpTimestamp, userToUpdate.id], async function(err) {
        if (err) {
            console.error("[API_OTP_ERROR] Gagal update OTP di database:", err.message);
            return res.status(500).json({ message: "Gagal menyimpan OTP." });
        }
        userToUpdate.otp = otp;
        userToUpdate.otpTimestamp = otpTimestamp;
        await global.raf.sendMessage(req.body.phoneNumber + "@s.whatsapp.net", { text: `Kode OTP Anda: \n${otp}\n\nBerlaku Hanya 5 Menit.` });
        return res.json({ message: "OTP berhasil dikirim" });
    });
});

router.post('/api/otpverify', async (req, res) => {
    const { phoneNumber: otpPhone, otp } = req.body;
    if (!otpPhone || !otp) return res.status(400).json({ message: "Nomor telepon dan OTP diperlukan" });

    // Check verification rate limiting
    const verifyLimitCheck = checkOTPVerifyLimit(otpPhone);
    if (!verifyLimitCheck.allowed) {
        return res.status(429).json({ 
            message: "Terlalu banyak percobaan verifikasi. Silakan minta OTP baru." 
        });
    }

    const userToVerify = global.users.find(v => v.phone_number.split('|').includes(otpPhone));
    if (!userToVerify) return res.status(404).json({ status: 404, message: "Pengguna tidak ditemukan." });
    
    // Check if OTP is still valid using utility function
    if (!isOTPValid(userToVerify.otpTimestamp)) {
        global.db.run(`UPDATE users SET otp = ?, otpTimestamp = ? WHERE id = ?`, [null, null, userToVerify.id], (err) => {
            if (err) console.error("[API_OTP_EXPIRED_ERROR] Gagal membersihkan OTP kedaluwarsa di DB:", err.message);
            userToVerify.otp = null;
            userToVerify.otpTimestamp = null;
        });
        return res.status(400).json({ status: 400, message: "OTP sudah kedaluwarsa. Silakan minta OTP baru." });
    }

    global.db.run(`UPDATE users SET otp = ?, otpTimestamp = ? WHERE id = ?`, [null, null, userToVerify.id], (err) => {
        if (err) {
            console.error("[API_OTP_VERIFY_ERROR] Gagal membersihkan OTP di DB:", err.message);
        }
        userToVerify.otp = null;
        userToVerify.otpTimestamp = null;
        const payload = { id: userToVerify.id, name: userToVerify.name };
        const token = jwt.sign(payload, global.config.jwt, { expiresIn: '7d' });
        return res.json({ status: 200, message: "OTP berhasil diverifikasi.", token, user: { name: userToVerify.name, deviceId: userToVerify.device_id, phoneNumber: userToVerify.phone_number } });
    });
});

router.post('/api/customer/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ message: "Username dan password diperlukan." });
    }

    try {
        const sql = `SELECT * FROM users WHERE username = ?`;
        global.db.get(sql, [username], async (err, user) => {
            if (err) {
                console.error("[API_CUSTOMER_LOGIN_ERROR] Database error:", err.message);
                return res.status(500).json({ message: "Terjadi kesalahan pada server." });
            }

            const isValid = user && await comparePassword(password, user.password);

            if (!isValid) {
                return res.status(401).json({ message: "Username atau password salah." });
            }

            // Create a payload for the JWT
            const payload = {
                id: user.id,
                name: user.name
            };

            // Sign the token
            const token = jwt.sign(payload, global.config.jwt, { expiresIn: '7d' });

            // Return the token to the client
            res.status(200).json({
                status: 200,
                message: "Login berhasil.",
                token: token,
                user: {
                    name: user.name,
                    deviceId: user.device_id,
                    phoneNumber: user.phone_number
                }
            });
        });

    } catch (error) {
        console.error("[API_CUSTOMER_LOGIN_ERROR] Unexpected error:", error);
        return res.status(500).json({ message: "Terjadi kesalahan pada server." });
    }
});

// --- ALIASES FOR FRONTEND ---

// Alias for /api/customer/login
router.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ message: "Username dan password diperlukan." });
    }

    try {
        const sql = `SELECT * FROM users WHERE username = ?`;
        global.db.get(sql, [username], async (err, user) => {
            if (err) {
                console.error("[API_CUSTOMER_LOGIN_ERROR] Database error:", err.message);
                return res.status(500).json({ message: "Terjadi kesalahan pada server." });
            }

            const isValid = user && await comparePassword(password, user.password);

            if (!isValid) {
                return res.status(401).json({ message: "Username atau password salah." });
            }

            const payload = {
                id: user.id,
                name: user.name
            };

            const token = jwt.sign(payload, global.config.jwt, { expiresIn: '7d' });

            res.status(200).json({
                status: 200,
                message: "Login berhasil.",
                token: token,
                user: {
                    name: user.name,
                    deviceId: user.device_id,
                    phoneNumber: user.phone_number
                }
            });
        });

    } catch (error) {
        console.error("[API_CUSTOMER_LOGIN_ERROR] Unexpected error:", error);
        return res.status(500).json({ message: "Terjadi kesalahan pada server." });
    }
});

// Alias for /api/otp
router.post('/api/auth/otp/request', async (req, res) => {
    if (!req.body.phoneNumber) return res.status(400).json({ message: "Nomor telepon diperlukan" });
    if (!global.raf) return res.status(500).json({ message: "Bot is offline" });
    
    // Check rate limiting
    const rateLimitCheck = checkOTPRequestLimit(req.body.phoneNumber);
    if (!rateLimitCheck.allowed) {
        return res.status(429).json({ 
            message: `Terlalu banyak permintaan OTP. Coba lagi dalam ${rateLimitCheck.remainingTime} menit.` 
        });
    }
    
    const otp = generateSecureOTP(6);
    const userToUpdate = global.users.find(v => v.phone_number.split('|').includes(req.body.phoneNumber));
    if (!userToUpdate) return res.status(404).json({ message: "User tidak ditemukan" });

    const otpTimestamp = Date.now();
    global.db.run(`UPDATE users SET otp = ?, otpTimestamp = ? WHERE id = ?`, [otp, otpTimestamp, userToUpdate.id], async function(err) {
        if (err) {
            console.error("[API_OTP_ERROR] Gagal update OTP di database:", err.message);
            return res.status(500).json({ message: "Gagal menyimpan OTP." });
        }
        userToUpdate.otp = otp;
        userToUpdate.otpTimestamp = otpTimestamp;
        await global.raf.sendMessage(req.body.phoneNumber + "@s.whatsapp.net", { text: `Kode OTP Anda: \n${otp}\n\nBerlaku Hanya 5 Menit.` });
        return res.json({ message: "OTP berhasil dikirim" });
    });
});

// Alias for /api/otpverify
router.post('/api/auth/otp/verify', async (req, res) => {
    const { phoneNumber: otpPhone, otp } = req.body;
    if (!otpPhone || !otp) return res.status(400).json({ message: "Nomor telepon dan OTP diperlukan" });

    const userToVerify = global.users.find(v => v.phone_number.split('|').includes(otpPhone));
    if (!userToVerify) return res.status(404).json({ status: 404, message: "Pengguna tidak ditemukan." });
    if (userToVerify.otp !== otp) return res.status(400).json({ status: 400, message: "OTP tidak valid." });

    const otpTimestamp = userToVerify.otpTimestamp;
    const now = Date.now();
    const fiveMinutesInMillis = 5 * 60 * 1000;

    if (!otpTimestamp || (now - otpTimestamp > fiveMinutesInMillis)) {
        global.db.run(`UPDATE users SET otp = ?, otpTimestamp = ? WHERE id = ?`, [null, null, userToVerify.id], (err) => {
            if (err) console.error("[API_OTP_EXPIRED_ERROR] Gagal membersihkan OTP kedaluwarsa di DB:", err.message);
            userToVerify.otp = null;
            userToVerify.otpTimestamp = null;
        });
        return res.status(400).json({ status: 400, message: "OTP sudah kedaluwarsa. Silakan minta OTP baru." });
    }

    global.db.run(`UPDATE users SET otp = ?, otpTimestamp = ? WHERE id = ?`, [null, null, userToVerify.id], (err) => {
        if (err) {
            console.error("[API_OTP_VERIFY_ERROR] Gagal membersihkan OTP di DB:", err.message);
        }
        userToVerify.otp = null;
        userToVerify.otpTimestamp = null;
        const payload = { id: userToVerify.id, name: userToVerify.name };
        const token = jwt.sign(payload, global.config.jwt, { expiresIn: '7d' });
        return res.json({ status: 200, message: "OTP berhasil diverifikasi.", token, user: { name: userToVerify.name, deviceId: userToVerify.device_id, phoneNumber: userToVerify.phone_number } });
    });
});


router.get('/api/wifi-name', (req, res) => {
    res.json({
        wifiName: global.config.nama || "Default WiFi Name"
    });
});

router.get('/api/announcements', (req, res) => {
    const sortedAnnouncements = [...(global.announcements || [])].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json(sortedAnnouncements);
});

router.get('/api/news', (req, res) => {
    const sortedNews = [...(global.news || [])].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json(sortedNews);
});

module.exports = router;
