const express = require('express');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const convertRupiah = require('rupiah-format');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

// Local dependencies that were used by these routes in index.js
const pay = require("../lib/ipaymu");
const { getvoucher } = require("../lib/mikrotik");
const { addKoinUser, addATM, checkATMuser } = require('../lib/saldo');
const { updateStatusPayment, checkStatusPayment, delPayment, addPayBuy, addPayment, updateKetPayment } = require('../lib/payment');
const { checkprofvc, checkdurasivc, checkhargavc } = require('../lib/voucher');
const { saveReports, saveSpeedRequests, savePackageChangeRequests, loadJSON } = require('../lib/database');
const { authCache } = require('../lib/auth-cache');
const { comparePassword, hashPassword } = require('../lib/password');
const { apiAuth } = require('../lib/auth');
const { normalizePhoneNumber } = require('../lib/utils');
const { generateSecureOTP, checkOTPRequestLimit, checkOTPVerifyLimit, resetOTPAttempts, isOTPValid } = require('../lib/otp');
const { asyncHandler, createError, ErrorTypes, validateRequired, dbOperation } = require('../lib/error-handler');
const { renderTemplate } = require('../lib/templating');
const { sendSuccess, sendError } = require('../lib/response-helper');
const CustomerService = require('../lib/services/customer-service');
const ReportService = require('../lib/services/report-service');
const SpeedRequestService = require('../lib/services/speed-request-service');
const PublicService = require('../lib/services/public-service');
const WifiService = require('../lib/services/wifi-service');
const {
    loginValidation,
    customerLoginValidation,
    otpRequestValidation,
    otpVerifyValidation,
    updateAccountValidation,
    submitReportValidation,
    requestSpeedValidation,
    cancelSpeedRequestValidation,
    requestPackageChangeValidation
} = require('../lib/middleware/validation');

const router = express.Router();

// --- Middleware & Helper Functions (moved from index.js) ---

// This function is now a wrapper around the centralized apiAuth middleware.
function ensureCustomerAuthenticated(req, res, next) {
    apiAuth(req, res, next);
}

// Helper functions moved to service layer:
// - mapReportStatus() -> ReportService.mapReportStatus()
// - generateAdminTicketId() -> ReportService.generateTicketId()

// --- Rate Limiters ---

// Rate limiter untuk WiFi endpoints (resource-intensive operations)
// CATATAN: Endpoint ini memerlukan customer authentication, jadi semua request sudah memiliki req.customer
const wifiRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 menit
    max: 30, // 30 requests per 15 menit per customer
    message: {
        status: 429,
        message: 'Terlalu banyak permintaan WiFi. Silakan coba lagi dalam 15 menit.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    // Gunakan customer ID sebagai key (semua request sudah authenticated via ensureCustomerAuthenticated)
    keyGenerator: (req) => {
        // Karena endpoint ini memerlukan authentication, req.customer selalu ada
        // Tidak perlu fallback ke IP, sehingga tidak perlu handle IPv6
        return `wifi_customer_${req.customer?.id || 'unknown'}`;
    },
    skip: (req) => {
        // Skip rate limiting untuk static files (tidak perlu)
        return req.path.match(/\.(jpg|jpeg|png|gif|svg|css|js|ico|woff|woff2|ttf|eot)$/i);
    }
});

// Stricter rate limiter untuk WiFi write operations (update name/password)
// CATATAN: Endpoint ini memerlukan customer authentication, jadi semua request sudah memiliki req.customer
const wifiWriteRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 menit
    max: 10, // 10 requests per 15 menit per customer (lebih strict untuk write operations)
    message: {
        status: 429,
        message: 'Terlalu banyak perubahan WiFi. Silakan coba lagi dalam 15 menit.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    // Gunakan customer ID sebagai key (semua request sudah authenticated via ensureCustomerAuthenticated)
    keyGenerator: (req) => {
        // Karena endpoint ini memerlukan authentication, req.customer selalu ada
        // Tidak perlu fallback ke IP, sehingga tidak perlu handle IPv6
        return `wifi_write_customer_${req.customer?.id || 'unknown'}`;
    },
    skip: (req) => {
        // Skip rate limiting untuk static files (tidak perlu)
        return req.path.match(/\.(jpg|jpeg|png|gif|svg|css|js|ico|woff|woff2|ttf|eot)$/i);
    }
});

// --- Router Setup ---

// Middleware is now applied globally in index.js

router.post('/api/login', loginValidation, asyncHandler(async (req, res) => {
    const loginStartTime = Date.now();
    const { username, password } = req.body;
    
    // Validate required fields
    const validateStart = Date.now();
    validateRequired(req.body, ['username', 'password']);
    console.log(`[LOGIN_TIMING] Validation: ${Date.now() - validateStart}ms`);

    // Get client info for logging
    const ipAddress = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'] || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';
    
    // Import activity logger and rate limiter
    const importStart = Date.now();
    const { logLogin } = require('../lib/activity-logger');
    const { checkRateLimit } = require('../lib/security');
    console.log(`[LOGIN_TIMING] Import modules: ${Date.now() - importStart}ms`);
    
    // Rate limiting: max 5 attempts per 15 minutes per IP
    const rateLimitStart = Date.now();
    const rateLimitResult = checkRateLimit('login', 5, 15 * 60 * 1000, ipAddress);
    console.log(`[LOGIN_TIMING] Rate limit check: ${Date.now() - rateLimitStart}ms`);
    
    // Check rate limit
    if (!rateLimitResult.allowed) {
        // Log failed attempt due to rate limit (fire-and-forget, tidak blocking)
        logLogin({
            userId: null,
            username: username || 'unknown',
            role: 'unknown',
            ipAddress,
            userAgent,
            success: false,
            failureReason: 'Rate limit exceeded'
        }).catch(logErr => {
            // Ignore logging errors
        });
        
        throw createError(
            ErrorTypes.RATE_LIMIT_ERROR || 'RATE_LIMIT_ERROR',
            'Terlalu banyak percobaan login. Silakan coba lagi dalam 15 menit.',
            429
        );
    }

    // Gunakan cache untuk account lookup
    const accountLookupStart = Date.now();
    const account = authCache.getAccountByUsername(username, () => {
        return global.accounts.find(acc => acc.username === username);
    });
    console.log(`[LOGIN_TIMING] Account lookup: ${Date.now() - accountLookupStart}ms`);
    
    // Password verification - ini yang paling mungkin lambat
    const passwordStart = Date.now();
    const isValid = account && await comparePassword(password, account.password);
    console.log(`[LOGIN_TIMING] Password verification: ${Date.now() - passwordStart}ms`);

    if (!isValid) {
        // Log failed login attempt (fire-and-forget, tidak blocking)
        logLogin({
            userId: account ? account.id : null,
            username: username,
            role: account ? account.role : 'unknown',
            ipAddress,
            userAgent,
            success: false,
            failureReason: 'Invalid username or password',
            actionType: 'login'
        }).catch(logErr => {
            console.error(`[AUTH_LOG] ❌ Failed to log login: ${username} - ${logErr.message}`);
        });
        
        throw createError(
            ErrorTypes.AUTHENTICATION_ERROR,
            'Username atau password salah.',
            401
        );
    }

    const payload = {
        id: account.id,
        username: account.username,
        name: account.name || account.username,
        photo: account.photo || null,
        role: account.role
    };

    // Shorten token expiry for production: 8 hours instead of 1 day
    const tokenStart = Date.now();
    const tokenExpiry = process.env.NODE_ENV === 'production' ? '8h' : '1d';
    // SECURITY: Sign token dengan explicit algorithm untuk prevent algorithm confusion attacks
    const token = jwt.sign(payload, global.config.jwt, { 
        expiresIn: tokenExpiry,
        algorithm: 'HS256'
    });
    console.log(`[LOGIN_TIMING] Token generation: ${Date.now() - tokenStart}ms`);

    const cookieStart = Date.now();
    // PENTING: Set secure: false untuk semua kasus agar API bisa berkomunikasi dengan baik di frontend
    // Cloudflare Tunnel akan handle HTTPS di level reverse proxy, tapi aplikasi tetap HTTP
    // Cookie dengan secure: false akan bekerja di HTTP dan HTTPS
    res.cookie("token", token, {
        httpOnly: true,
        secure: false, // Selalu false - Cloudflare Tunnel handle HTTPS, aplikasi HTTP
        sameSite: 'Lax', // Allow cookies untuk same-site requests (termasuk akses via IP)
        maxAge: process.env.NODE_ENV === 'production' ? 8 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000,
        path: '/'
    });
    console.log(`[LOGIN_TIMING] Cookie set: ${Date.now() - cookieStart}ms`);

    // Log successful login attempt (fire-and-forget, tidak blocking response)
    logLogin({
        userId: account.id,
        username: username,
        role: account.role,
        ipAddress,
        userAgent,
        success: true,
        failureReason: null,
        actionType: 'login'
    }).catch(logErr => {
        console.error(`[AUTH_LOG] ❌ Failed to log login: ${username} - ${logErr.message}`);
    });

    const totalTime = Date.now() - loginStartTime;
    console.log(`[LOGIN_TIMING] ⏱️ TOTAL LOGIN TIME: ${totalTime}ms`);

    // Check if request wants JSON response (API call)
    if (req.headers.accept && req.headers.accept.includes('application/json')) {
        return sendSuccess(res, {
            token: token,
            user: {
                id: account.id,
                username: account.username,
                name: account.name || account.username,
                photo: account.photo || null,
                role: account.role
            }
        }, 'Login berhasil');
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

customerApiRouter.get('/profile', asyncHandler(async (req, res) => {
    const customer = req.customer;
    const profileData = await CustomerService.getProfile(customer, req);
    return sendSuccess(res, profileData, "Profile berhasil diambil");
}));

customerApiRouter.get('/reports/history', asyncHandler(async (req, res) => {
    const customer = req.customer;
    const reportHistory = await ReportService.getReportHistory(customer, req);
    return sendSuccess(res, reportHistory, "Riwayat laporan berhasil diambil");
}));

customerApiRouter.post('/request-package-change', asyncHandler(async (req, res) => {
    const { targetPackageName } = req.body;
    const customer = req.customer;
    
    const result = await CustomerService.requestPackageChange(customer, targetPackageName, req);
    
    return sendSuccess(res, null, result.message, 201);
}));

customerApiRouter.get('/package-change-requests/history', asyncHandler(async (req, res) => {
    const customer = req.customer;
    const history = await CustomerService.getPackageChangeHistory(customer, req);
    return sendSuccess(res, history, "Riwayat permintaan perubahan paket berhasil diambil");
}));

customerApiRouter.get('/packages', asyncHandler(async (req, res) => {
    const customer = req.customer;
    const packages = await CustomerService.getAvailablePackages(customer, req);
    return sendSuccess(res, packages, "Daftar paket bulanan berhasil diambil");
}));

customerApiRouter.post('/account/update', asyncHandler(async (req, res) => {
    const { currentPassword, newUsername, newPassword } = req.body;
    const customer = req.customer;
    
    const result = await CustomerService.updateAccount(customer, {
        currentPassword,
        newUsername,
        newPassword
    }, req);
    
    return sendSuccess(res, null, result.message);
}));

// Phone Number Management Endpoints untuk Customer
customerApiRouter.get('/phone-numbers', asyncHandler(async (req, res) => {
    const customer = req.customer;
    const phoneNumbers = await CustomerService.getPhoneNumbers(customer, req);
    return sendSuccess(res, phoneNumbers, "Daftar nomor HP berhasil diambil");
}));

customerApiRouter.post('/phone-numbers/add', asyncHandler(async (req, res) => {
    const customer = req.customer;
    const { phoneNumber } = req.body;
    
    // Validation
    if (!phoneNumber || typeof phoneNumber !== 'string' || phoneNumber.trim() === '') {
        return sendError(res, "Nomor HP tidak boleh kosong.", 400);
    }
    
    const result = await CustomerService.addPhoneNumber(customer, phoneNumber, req);
    return sendSuccess(res, result, result.message);
}));

customerApiRouter.delete('/phone-numbers/:phoneNumber', asyncHandler(async (req, res) => {
    const customer = req.customer;
    const { phoneNumber } = req.params;
    
    // Validation
    if (!phoneNumber || phoneNumber.trim() === '') {
        return sendError(res, "Nomor HP tidak boleh kosong.", 400);
    }
    
    // Decode URL-encoded phone number
    const decodedPhoneNumber = decodeURIComponent(phoneNumber);
    
    const result = await CustomerService.removePhoneNumber(customer, decodedPhoneNumber, req);
    return sendSuccess(res, result, result.message);
}));

// WiFi Management Endpoints untuk Customer
customerApiRouter.get('/wifi/info', wifiRateLimiter, asyncHandler(async (req, res) => {
    const customer = req.customer;
    const skipRefresh = req.query.skipRefresh === 'true'; // Optional: skip refresh untuk performa
    
    const wifiInfo = await WifiService.getCustomerWifiInfo(customer, req, skipRefresh);
    return sendSuccess(res, wifiInfo, "Info WiFi berhasil diambil");
}));

customerApiRouter.get('/wifi/connected-devices', wifiRateLimiter, asyncHandler(async (req, res) => {
    const customer = req.customer;
    const skipRefresh = req.query.skipRefresh === 'true'; // Optional: skip refresh untuk performa
    
    const connectedDevices = await WifiService.getConnectedDevices(customer, req, skipRefresh);
    return sendSuccess(res, connectedDevices, "Data device terkoneksi berhasil diambil");
}));

customerApiRouter.post('/wifi/update-name', wifiWriteRateLimiter, asyncHandler(async (req, res) => {
    const customer = req.customer;
    const { ssidIndex = 1, newName } = req.body;
    
    // Validation
    if (!newName || typeof newName !== 'string' || newName.trim() === '') {
        return sendError(res, "Nama WiFi tidak boleh kosong.", 400);
    }
    
    if (newName.length < 3 || newName.length > 32) {
        return sendError(res, "Nama WiFi harus antara 3-32 karakter.", 400);
    }
    
    // Validasi SSID index (1-8 untuk dual band)
    const parsedIndex = parseInt(ssidIndex);
    if (isNaN(parsedIndex) || parsedIndex < 1 || parsedIndex > 8) {
        return sendError(res, "SSID index harus antara 1-8 (4 untuk 2.4GHz dan 4 untuk 5GHz).", 400);
    }
    
    const result = await WifiService.updateCustomerWifiName(customer, ssidIndex, newName, req);
    return sendSuccess(res, result, "Nama WiFi berhasil diubah");
}));

customerApiRouter.post('/wifi/update-password', wifiWriteRateLimiter, asyncHandler(async (req, res) => {
    const customer = req.customer;
    const { ssidIndex = 1, newPassword } = req.body;
    
    // Validation
    if (!newPassword || typeof newPassword !== 'string' || newPassword.trim() === '') {
        return sendError(res, "Password WiFi harus diisi.", 400);
    }
    
    if (newPassword.length < 8 || newPassword.length > 63) {
        return sendError(res, "Password WiFi harus antara 8-63 karakter.", 400);
    }
    
    // Validasi SSID index (1-8 untuk dual band)
    const parsedIndex = parseInt(ssidIndex);
    if (isNaN(parsedIndex) || parsedIndex < 1 || parsedIndex > 8) {
        return sendError(res, "SSID index harus antara 1-8 (4 untuk 2.4GHz dan 4 untuk 5GHz).", 400);
    }
    
    const result = await WifiService.updateCustomerWifiPassword(customer, ssidIndex, newPassword, req);
    return sendSuccess(res, result, "Password WiFi berhasil diubah");
}));

customerApiRouter.put('/wifi/update', wifiWriteRateLimiter, asyncHandler(async (req, res) => {
    const customer = req.customer;
    const { ssidIndex = 1, newName, newPassword } = req.body;
    
    // Validation
    if (!newName && !newPassword) {
        return sendError(res, "Minimal harus ada nama WiFi atau password yang diubah.", 400);
    }
    
    if (newName && (newName.length < 3 || newName.length > 32)) {
        return sendError(res, "Nama WiFi harus antara 3-32 karakter.", 400);
    }
    
    if (newPassword && (newPassword.length < 8 || newPassword.length > 63)) {
        return sendError(res, "Password WiFi harus antara 8-63 karakter.", 400);
    }
    
    // Validasi SSID index (1-8 untuk dual band)
    const parsedIndex = parseInt(ssidIndex);
    if (isNaN(parsedIndex) || parsedIndex < 1 || parsedIndex > 8) {
        return sendError(res, "SSID index harus antara 1-8 (4 untuk 2.4GHz dan 4 untuk 5GHz).", 400);
    }
    
    const result = await WifiService.updateCustomerWifi(customer, ssidIndex, { newName, newPassword }, req);
    return sendSuccess(res, result, "WiFi berhasil diupdate");
}));

customerApiRouter.post('/wifi/reboot', wifiWriteRateLimiter, asyncHandler(async (req, res) => {
    const customer = req.customer;
    
    const result = await WifiService.rebootCustomerRouter(customer, req);
    return sendSuccess(res, result, result.message || "Perintah reboot berhasil dikirim");
}));

router.use('/api/customer', customerApiRouter);

// Additional customer endpoints for NextJS frontend
router.get('/api/customer/speed-requests/active', ensureCustomerAuthenticated, asyncHandler(async (req, res) => {
    const customer = req.customer;
    const activeRequest = await SpeedRequestService.getActiveRequest(customer, req);
    
    if (!activeRequest) {
        return sendSuccess(res, null, "Tidak ada speed boost yang aktif.");
    }
    
    return sendSuccess(res, activeRequest, "Speed boost aktif berhasil diambil");
}));

router.get('/api/customer/speed-requests/history', ensureCustomerAuthenticated, asyncHandler(async (req, res) => {
    const customer = req.customer;
    const requestHistory = await SpeedRequestService.getRequestHistory(customer, req);
    return sendSuccess(res, requestHistory, "Riwayat speed boost berhasil diambil");
}));

router.post('/api/customer/speed-requests/cancel', ensureCustomerAuthenticated, cancelSpeedRequestValidation, asyncHandler(async (req, res) => {
    const customer = req.customer;
    const { requestId } = req.body;
    
    const result = await SpeedRequestService.cancelRequest(customer, requestId, req);
    return sendSuccess(res, null, result.message);
}));

// GET /api/customer/speed-boost/status - Check if Speed On Demand is enabled
router.get('/api/customer/speed-boost/status', ensureCustomerAuthenticated, asyncHandler(async (req, res) => {
    const isEnabled = SpeedRequestService.isFeatureEnabled();
    return sendSuccess(res, { enabled: isEnabled }, isEnabled ? "Speed On Demand tersedia" : "Speed On Demand tidak tersedia");
}));

router.get('/api/customer/speed-boost/available', ensureCustomerAuthenticated, asyncHandler(async (req, res) => {
    const customer = req.customer;
    const availablePackages = await SpeedRequestService.getAvailableSpeedBoosts(customer);
    
    if (availablePackages.length === 0) {
        // Check if feature is disabled
        if (!SpeedRequestService.isFeatureEnabled()) {
            return sendSuccess(res, [], "Speed Boost sedang tidak tersedia saat ini");
        }
        return sendSuccess(res, [], "Tidak ada paket speed boost yang tersedia untuk paket Anda saat ini");
    }
    
    return sendSuccess(res, availablePackages, "Daftar paket speed boost berhasil diambil");
}));

router.get('/api/dashboard-status', ensureCustomerAuthenticated, asyncHandler(async (req, res) => {
    const customer = req.customer;
    const dashboardData = await PublicService.getDashboardStatus(customer);
    return sendSuccess(res, dashboardData, "Status dashboard berhasil diambil");
}));

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
                    // PENTING: Cek connection state dan gunakan error handling sesuai rules
                    if (pay.sender != "buynow" && global.whatsappConnectionState === 'open' && global.raf && global.raf.sendMessage) {
                        try {
                            const message = renderTemplate('voucher_purchase_success', {
                                nama_paket: durasivc,
                                harga: convertRupiah.convert(hargavc),
                                kode_voucher: result
                            });
                            await global.raf.sendMessage(pay.sender, { text: message });
                        } catch (error) {
                            console.error('[SEND_MESSAGE_ERROR]', {
                                sender: pay.sender,
                                error: error.message
                            });
                            // Jangan throw - notification tidak critical
                        }
                    } else {
                        console.warn('[SEND_MESSAGE_SKIP] WhatsApp not connected, skipping send to', pay.sender);
                    }
                    throw !0;
                }).catch(async err => {
                    if (typeof err === "string") {
                        // PENTING: Cek connection state dan gunakan error handling sesuai rules untuk command response
                        if (pay.sender != "buynow" && global.whatsappConnectionState === 'open' && global.raf && global.raf.sendMessage) {
                            try {
                                updateStatusPayment(reference_id, true);
                                await global.raf.sendMessage(pay.sender, { text: err }, { skipDuplicateCheck: true });
                            } catch (error) {
                                console.error('[SEND_MESSAGE_ERROR]', {
                                    sender: pay.sender,
                                    error: error.message
                                });
                            }
                        } else {
                            console.warn('[SEND_MESSAGE_SKIP] WhatsApp not connected, skipping send to', pay.sender);
                        }
                        throw !0;
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
                await addKoinUser(pay.sender, pay.amount);
                updateStatusPayment(reference_id, true);
                // PENTING: Cek connection state dan gunakan error handling sesuai rules
                if (global.whatsappConnectionState === 'open' && global.raf && global.raf.sendMessage) {
                    try {
                        const currentSaldo = await checkATMuser(pay.sender);
                        const message = renderTemplate('topup_saldo_masuk', {
                            harga: convertRupiah.convert(pay.amount),
                            formattedSaldo: convertRupiah.convert(currentSaldo)
                        });
                        await global.raf.sendMessage(pay.sender, { text: message });
                    } catch (error) {
                        console.error('[SEND_MESSAGE_ERROR]', {
                            sender: pay.sender,
                            error: error.message
                        });
                        // Jangan throw - notification tidak critical
                    }
                } else {
                    console.warn('[SEND_MESSAGE_SKIP] WhatsApp not connected, skipping send to', pay.sender);
                }
                throw !0;
            }
        }
    } catch(err) {
        res.status(err ? 200 : 500).json({ status: err });
    }
});

// This route is obsolete and insecure. It is replaced by GET /api/customer/profile
// router.get('/api/user/:phoneNumber', apiAuth, async (req, res) => { ... });

router.post('/api/lapor', apiAuth, asyncHandler(async (req, res) => {
    const { category, reportText } = req.body;
    const user = req.customer;
    
    const result = await ReportService.submitReport(user, { category, reportText }, req.ip, req);
    
    return sendSuccess(res, { ticketId: result.ticketId }, "Laporan berhasil dibuat. Tim kami akan segera menghubungi Anda.", 201);
}));

// POST /api/customer/reports/upload-photo - Upload photo untuk report (customer)
const { getReportsUploadsPath } = require('../lib/path-helper');

const reportPhotoStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        const { ticketId } = req.body;
        
        if (!ticketId) {
            return cb(new Error('Ticket ID harus diisi'), null);
        }
        
        // Find report to get creation date
        const report = global.reports.find(r => r.ticketId === ticketId || r.id === ticketId);
        let year, month;
        
        if (report && report.createdAt) {
            const reportDate = new Date(report.createdAt);
            year = reportDate.getFullYear();
            month = String(reportDate.getMonth() + 1).padStart(2, '0');
        } else {
            // Fallback to current date
            const now = new Date();
            year = now.getFullYear();
            month = String(now.getMonth() + 1).padStart(2, '0');
        }
        
        const uploadDir = getReportsUploadsPath(year, month, ticketId, __dirname);
        
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(7);
        const ext = path.extname(file.originalname);
        cb(null, `customer_${req.body.ticketId}_${timestamp}_${random}${ext}`);
    }
});

const reportPhotoUpload = multer({
    storage: reportPhotoStorage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    },
    fileFilter: function (req, file, cb) {
        if (!file.mimetype.startsWith('image/')) {
            return cb(new Error('Hanya file gambar yang diperbolehkan'), false);
        }
        cb(null, true);
    }
});

router.post('/api/customer/reports/upload-photo', apiAuth, reportPhotoUpload.single('photo'), asyncHandler(async (req, res) => {
    const customer = req.customer;
    const { ticketId } = req.body;
    
    if (!ticketId) {
        return sendError(res, "Ticket ID harus diisi", 400);
    }
    
    if (!req.file) {
        return sendError(res, "File foto harus diupload", 400);
    }
    
    // Get all customer JIDs (customer bisa punya multiple phone numbers)
    const BaseService = require('../lib/services/base-service');
    const customerJids = BaseService.getCustomerJids(customer.phone_number);
    
    // Find report - check by ticketId and customer JIDs
    const reportIndex = global.reports.findIndex(r => 
        (r.ticketId === ticketId || r.id === ticketId) &&
        customerJids.includes(r.pelangganId)
    );
    
    if (reportIndex === -1) {
        // Clean up uploaded file
        if (req.file && req.file.path) {
            try {
                fs.unlinkSync(req.file.path);
            } catch (err) {
                console.error('[REPORT_UPLOAD_PHOTO] Failed to delete file:', err);
            }
        }
        return sendError(res, "Tiket tidak ditemukan atau tidak memiliki akses", 404);
    }
    
    const report = global.reports[reportIndex];
    
    // Check status - only allow upload for new or in-progress reports
    if (report.status !== 'baru' && report.status !== 'diproses teknisi') {
        // Clean up uploaded file
        if (req.file && req.file.path) {
            try {
                fs.unlinkSync(req.file.path);
            } catch (err) {
                console.error('[REPORT_UPLOAD_PHOTO] Failed to delete file:', err);
            }
        }
        return sendError(res, `Tidak bisa upload foto. Status tiket: ${report.status}`, 400);
    }
    
    // Initialize customerPhotos array
    if (!report.customerPhotos) {
        report.customerPhotos = [];
    }
    
    // Check max photos (3 photos max)
    if (report.customerPhotos.length >= 3) {
        // Clean up uploaded file
        if (req.file && req.file.path) {
            try {
                fs.unlinkSync(req.file.path);
            } catch (err) {
                console.error('[REPORT_UPLOAD_PHOTO] Failed to delete file:', err);
            }
        }
        return sendError(res, "Maksimal 3 foto per laporan", 400);
    }
    
    // Add photo info
    const photoInfo = {
        fileName: req.file.filename,
        path: req.file.path,
        uploadedAt: new Date().toISOString(),
        size: req.file.size,
        uploadedBy: 'customer',
        uploadedVia: 'customer_panel'
    };
    
    report.customerPhotos.push(photoInfo);
    report.hasCustomerPhotos = true;
    report.photoCount = report.customerPhotos.length;
    
    // Save to database
    const { saveReports } = require('../lib/database');
    saveReports(global.reports);
    
    return sendSuccess(res, {
        ticketId: report.ticketId || report.id,
        photoCount: report.customerPhotos.length,
        totalPhotos: report.customerPhotos.length,
        maxPhotos: 3,
        photo: {
            fileName: photoInfo.fileName,
            uploadedAt: photoInfo.uploadedAt,
            size: photoInfo.size
        }
    }, `Foto berhasil diupload (${report.customerPhotos.length}/3)`, 200);
}));

router.post('/api/request-speed', apiAuth, requestSpeedValidation, asyncHandler(async (req, res) => {
    // Import helper functions
    const speedHelper = require('../lib/speed-request-helper');
    
    // User is identified by token, not by phone number in the body.
    const { targetPackageName, duration, paymentMethod = 'cash' } = req.body;
    const user = req.customer; // Use authenticated user from middleware

    if (!targetPackageName || !duration) {
        return sendError(res, "Parameter tidak lengkap. targetPackageName, dan duration wajib diisi.", 400);
    }
    
    // Validate payment method
    const validPaymentMethods = ['cash', 'transfer', 'double_billing'];
    if (!validPaymentMethods.includes(paymentMethod)) {
        return sendError(res, `Metode pembayaran tidak valid. Gunakan: ${validPaymentMethods.join(', ')}`, 400);
    }
    
    try {
        // Step 1: Validate user eligibility for speed request
        const validation = speedHelper.validateSpeedRequest(user, global.packages);
        if (!validation.valid) {
            return sendError(res, validation.errors[0] || "Anda tidak memenuhi syarat untuk request speed boost.", 400);
        }

        // Step 2: Validate requested package
        const requestedPackage = global.packages.find(p => p.name === targetPackageName);
        if (!requestedPackage) {
            return sendError(res, `Paket tujuan "${targetPackageName}" tidak ditemukan.`, 404);
        }
        
        // Check if it's a valid speed boost package
        if (!requestedPackage.isSpeedBoost) {
            return sendError(res, `Paket "${targetPackageName}" bukan paket speed boost.`, 400);
        }
        
        // Check if target package is higher than current
        const currentPackage = global.packages.find(p => p.name === user.subscription);
        if (currentPackage && Number(requestedPackage.price) <= Number(currentPackage.price)) {
            return sendError(res, "Paket speed boost harus memiliki kecepatan lebih tinggi dari paket Anda saat ini.", 400);
        }

        // Step 3: Normalize duration and calculate price
        const normalizedDuration = speedHelper.normalizeDurationKey(duration);
        if (!normalizedDuration) {
            return sendError(res, `Durasi '${duration}' tidak valid. Gunakan: 1_day, 3_days, atau 7_days.`, 400);
        }
        
        const price = speedHelper.calculateBoostPrice(currentPackage, requestedPackage, normalizedDuration);
        if (!price) {
            return sendError(res, `Harga untuk durasi '${duration}' pada paket '${targetPackageName}' tidak tersedia.`, 400);
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
            
            // PENTING: Cek connection state dan gunakan error handling sesuai rules untuk multiple recipients
            for (const ownerNum of global.config.ownerNumber) {
                const { delay } = await import('@whiskeysockets/baileys');
                const ownerJid = ownerNum.endsWith('@s.whatsapp.net') ? ownerNum : `${ownerNum}@s.whatsapp.net`;
                if (global.whatsappConnectionState === 'open' && global.raf && global.raf.sendMessage) {
                    try {
                        await delay(500);
                        await global.raf.sendMessage(ownerJid, { text: notifMessage });
                    } catch (e) {
                        console.error('[SEND_MESSAGE_ERROR]', {
                            ownerJid,
                            error: e.message
                        });
                        console.error(`[SPEED_REQUEST_NOTIF_ERROR] Gagal mengirim notifikasi ke owner ${ownerJid}:`, e.message);
                        // Continue to next owner
                    }
                } else {
                    console.warn('[SEND_MESSAGE_SKIP] WhatsApp not connected, skipping send to owner', ownerJid);
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
        
        return sendSuccess(res, {
            requestId: newRequest.id,
            paymentMethod: paymentMethod,
            amount: price,
            needsPaymentProof: ['cash', 'transfer'].includes(paymentMethod)
        }, responseMessage, 201);
    } catch (error) {
        console.error('[API_SPEED_REQUEST_FATAL_ERROR]', error);
        return sendError(res, "Terjadi kesalahan pada server.", 500);
    }
}));

router.get('/api/speed-boost/packages', asyncHandler(async (req, res) => {
    const packages = await SpeedRequestService.getSpeedBoostPackages();
    return sendSuccess(res, packages, "Daftar paket speed boost berhasil diambil");
}));

router.post('/api/otp', asyncHandler(async (req, res) => {
    const { phoneNumber } = req.body;
    
    console.log(`[API_OTP_REQUEST] OTP request received - PhoneNumber: "${phoneNumber}"`);
    
    if (!phoneNumber) {
        console.log(`[API_OTP_REQUEST] Validation failed - PhoneNumber is empty`);
        return sendError(res, "Nomor telepon diperlukan", 400);
    }
    
    if (!global.raf) {
        console.log(`[API_OTP_REQUEST] Bot offline - Cannot send OTP`);
        return sendError(res, "Bot sedang offline", 503);
    }
    
    // Check rate limiting
    const rateLimitCheck = checkOTPRequestLimit(phoneNumber);
    if (!rateLimitCheck.allowed) {
        console.log(`[API_OTP_REQUEST] Rate limit exceeded - PhoneNumber: "${phoneNumber}", RemainingTime: ${rateLimitCheck.remainingTime} menit`);
        return sendError(res, `Terlalu banyak permintaan OTP. Coba lagi dalam ${rateLimitCheck.remainingTime} menit.`, 429);
    }
    
    const otp = generateSecureOTP(6);
    console.log(`[API_OTP_REQUEST] OTP generated: "${otp}" for PhoneNumber: "${phoneNumber}"`);
    
    const userToUpdate = global.users.find(v => v.phone_number.split('|').includes(phoneNumber));
    if (!userToUpdate) {
        console.log(`[API_OTP_REQUEST] User not found - PhoneNumber: "${phoneNumber}"`);
        return sendError(res, "User tidak ditemukan", 404);
    }
    
    console.log(`[API_OTP_REQUEST] User found - ID: ${userToUpdate.id}, Username: ${userToUpdate.username}, Name: ${userToUpdate.name}`);

    const otpTimestamp = Date.now();
    
    // Update OTP di database
    await new Promise((resolve, reject) => {
        global.db.run(`UPDATE users SET otp = ?, otpTimestamp = ? WHERE id = ?`, [otp, otpTimestamp, userToUpdate.id], function(err) {
            if (err) {
                console.error("[API_OTP_ERROR] Gagal update OTP di database:", err.message);
                reject(err);
            } else {
                console.log(`[API_OTP_REQUEST] OTP saved to database - User ID: ${userToUpdate.id}, OTP: "${otp}"`);
                resolve();
            }
        });
    });
    
    // Update in-memory user object
    userToUpdate.otp = otp;
    userToUpdate.otpTimestamp = otpTimestamp;
    
    const otpMessage = renderTemplate('otp_code', { otp });
    const phoneJid = phoneNumber + "@s.whatsapp.net";
    
    console.log(`[API_OTP_REQUEST] Preparing to send OTP - PhoneJID: "${phoneJid}", Message length: ${otpMessage.length} chars`);
    
    // PENTING: Cek connection state dan gunakan error handling sesuai rules
    if (global.whatsappConnectionState === 'open' && global.raf && global.raf.sendMessage) {
        try {
            console.log(`[API_OTP_REQUEST] Sending OTP via WhatsApp - PhoneJID: "${phoneJid}"`);
            await global.raf.sendMessage(phoneJid, { text: otpMessage }, { skipDuplicateCheck: true });
            console.log(`[API_OTP_REQUEST] ✅ OTP successfully sent - PhoneJID: "${phoneJid}", OTP: "${otp}"`);
            return sendSuccess(res, null, "OTP berhasil dikirim");
        } catch (error) {
            console.error('[API_OTP_REQUEST] ❌ Failed to send OTP', {
                phoneJid,
                otp,
                error: error.message,
                stack: error.stack
            });
            return sendError(res, "Gagal mengirim OTP. Silakan coba lagi.", 500);
        }
    } else {
        console.warn(`[API_OTP_REQUEST] ⚠️ WhatsApp not connected - ConnectionState: "${global.whatsappConnectionState}", RAF available: ${!!global.raf}`);
        return sendError(res, "Layanan WhatsApp sedang tidak tersedia. Silakan coba lagi nanti.", 503);
    }
}));

router.post('/api/otpverify', asyncHandler(async (req, res) => {
    const { phoneNumber: otpPhone, otp } = req.body;
    
    if (!otpPhone || !otp) {
        return sendError(res, "Nomor telepon dan OTP diperlukan", 400);
    }

    // Check verification rate limiting
    const verifyLimitCheck = checkOTPVerifyLimit(otpPhone);
    if (!verifyLimitCheck.allowed) {
        return sendError(res, "Terlalu banyak percobaan verifikasi. Silakan minta OTP baru.", 429);
    }

    const userToVerify = global.users.find(v => v.phone_number.split('|').includes(otpPhone));
    if (!userToVerify) {
        return sendError(res, "Pengguna tidak ditemukan.", 404);
    }
    
    // Check if OTP is still valid using utility function
    if (!isOTPValid(userToVerify.otpTimestamp)) {
        // Clean up expired OTP
        await new Promise((resolve) => {
            global.db.run(`UPDATE users SET otp = ?, otpTimestamp = ? WHERE id = ?`, [null, null, userToVerify.id], (err) => {
                if (err) console.error("[API_OTP_EXPIRED_ERROR] Gagal membersihkan OTP kedaluwarsa di DB:", err.message);
                userToVerify.otp = null;
                userToVerify.otpTimestamp = null;
                resolve();
            });
        });
        return sendError(res, "OTP sudah kedaluwarsa. Silakan minta OTP baru.", 400);
    }

    // Verify OTP
    if (userToVerify.otp !== otp) {
        return sendError(res, "OTP tidak valid.", 400);
    }

    // Clean up OTP after successful verification
    await new Promise((resolve) => {
        global.db.run(`UPDATE users SET otp = ?, otpTimestamp = ? WHERE id = ?`, [null, null, userToVerify.id], (err) => {
            if (err) {
                console.error("[API_OTP_VERIFY_ERROR] Gagal membersihkan OTP di DB:", err.message);
            }
            userToVerify.otp = null;
            userToVerify.otpTimestamp = null;
            resolve();
        });
    });

    // SECURITY: Generate JWT token dengan minimal payload
    const payload = { 
        id: userToVerify.id, 
        name: userToVerify.name,
        iat: Math.floor(Date.now() / 1000)
    };
    
    // SECURITY: Sign token dengan explicit algorithm
    const token = jwt.sign(payload, global.config.jwt, { 
        expiresIn: '7d',
        algorithm: 'HS256'
    });
    
    return sendSuccess(res, {
        token: token,
        user: {
            id: userToVerify.id,
            name: userToVerify.name
            // Removed: deviceId, phoneNumber (sensitive data)
            // Frontend bisa fetch full profile via /api/customer/profile jika diperlukan
        }
    }, "OTP berhasil diverifikasi.");
}));

router.post('/api/customer/login', customerLoginValidation, asyncHandler(async (req, res) => {
    const { username, password } = req.body;

    // Deteksi apakah input adalah username atau nomor HP
    const isPhoneNumber = !/^[a-zA-Z0-9_]+$/.test(username);
    
    console.log(`[API_CUSTOMER_LOGIN] Login attempt - Input: "${username}", IsPhoneNumber: ${isPhoneNumber}`);
    
    let user = null;
    
    if (isPhoneNumber) {
        // Login dengan nomor HP: normalize dan cari di phone_number
        const { normalizePhone } = require('../lib/phone-validator');
        const normalizedPhone = normalizePhone(username);
        console.log(`[API_CUSTOMER_LOGIN] Phone login - Original: "${username}", Normalized: "${normalizedPhone}"`);
        
        // Cari user berdasarkan nomor HP (format: "phone1|phone2|phone3")
        // Query: cari di semua phone numbers dengan split di JavaScript (lebih reliable)
        const allUsers = await new Promise((resolve, reject) => {
            global.db.all('SELECT * FROM users WHERE phone_number IS NOT NULL AND phone_number != ""', [], (err, rows) => {
                if (err) {
                    console.error("[API_CUSTOMER_LOGIN_ERROR] Database error:", err.message);
                    reject(err);
                } else {
                    resolve(rows || []);
                }
            });
        });
        
        console.log(`[API_CUSTOMER_LOGIN] Found ${allUsers.length} users with phone numbers`);
        
        // Cari user yang memiliki nomor HP yang cocok (setelah normalize)
        user = allUsers.find(u => {
            if (!u.phone_number) return false;
            const phones = u.phone_number.split('|').map(p => p.trim()).filter(p => p);
            const found = phones.some(p => {
                const normalized = normalizePhone(p);
                const match = normalized === normalizedPhone;
                if (match) {
                    console.log(`[API_CUSTOMER_LOGIN] Match found! User ID: ${u.id}, Username: ${u.username}, Phone: "${p}" (normalized: "${normalized}")`);
                }
                return match;
            });
            if (!found && phones.length > 0) {
                console.log(`[API_CUSTOMER_LOGIN] No match for user ID ${u.id} - Phones: [${phones.join(', ')}], Normalized: [${phones.map(p => normalizePhone(p)).join(', ')}]`);
            }
            return found;
        });
        
        if (!user) {
            console.log(`[API_CUSTOMER_LOGIN] No user found with phone number: "${normalizedPhone}"`);
        }
    } else {
        // Login dengan username: cari di kolom username
        console.log(`[API_CUSTOMER_LOGIN] Username login - Username: "${username}"`);
        const sql = `SELECT * FROM users WHERE username = ?`;
        
        user = await new Promise((resolve, reject) => {
            global.db.get(sql, [username], (err, row) => {
                if (err) {
                    console.error("[API_CUSTOMER_LOGIN_ERROR] Database error:", err.message);
                    reject(err);
                } else {
                    if (row) {
                        console.log(`[API_CUSTOMER_LOGIN] Found user: ID=${row.id}, Username=${row.username}`);
                    } else {
                        console.log(`[API_CUSTOMER_LOGIN] No user found with username: "${username}"`);
                    }
                    resolve(row);
                }
            });
        });
    }

    if (!user) {
        console.log(`[API_CUSTOMER_LOGIN] User not found - returning 401`);
        return sendError(res, "Username atau password salah.", 401);
    }

    const isValid = await comparePassword(password, user.password);
    if (!isValid) {
        return sendError(res, "Username atau password salah.", 401);
    }

    // SECURITY: Create minimal payload untuk JWT (tidak include sensitive data)
    const payload = {
        id: user.id,
        name: user.name,
        // Add issued at time untuk token management
        iat: Math.floor(Date.now() / 1000)
    };

    // SECURITY: Sign token dengan expiration yang reasonable (7 days)
    // Consider: Token refresh mechanism untuk better security
    const token = jwt.sign(payload, global.config.jwt, { 
        expiresIn: '7d',
        // Add algorithm explicitly untuk prevent algorithm confusion attacks
        algorithm: 'HS256'
    });

    // Return the token to the client
    // SECURITY: Minimal data exposure - hanya return data yang diperlukan
    // Note: deviceId tidak perlu dikirim ke frontend karena:
    // - Frontend tidak perlu langsung akses GenieACS
    // - Backend sudah handle semua WiFi operations menggunakan device_id dari database
    // - Backend akan ambil device_id dari database berdasarkan JWT token
    return sendSuccess(res, {
        token: token,
        user: {
            id: user.id,
            name: user.name
        }
    }, "Login berhasil.");
}));

// --- ALIASES FOR FRONTEND ---

// Alias for /api/customer/login
router.post('/api/auth/login', customerLoginValidation, asyncHandler(async (req, res) => {
    const { username, password } = req.body;

    // Deteksi apakah input adalah username atau nomor HP
    const isPhoneNumber = !/^[a-zA-Z0-9_]+$/.test(username);
    
    console.log(`[API_AUTH_LOGIN] Login attempt - Input: "${username}", IsPhoneNumber: ${isPhoneNumber}`);
    
    let user = null;
    
    if (isPhoneNumber) {
        // Login dengan nomor HP: normalize dan cari di phone_number
        const { normalizePhone } = require('../lib/phone-validator');
        const normalizedPhone = normalizePhone(username);
        console.log(`[API_AUTH_LOGIN] Phone login - Original: "${username}", Normalized: "${normalizedPhone}"`);
        
        // Cari user berdasarkan nomor HP (format: "phone1|phone2|phone3")
        // Query: cari di semua phone numbers dengan split di JavaScript (lebih reliable)
        const allUsers = await new Promise((resolve, reject) => {
            global.db.all('SELECT * FROM users WHERE phone_number IS NOT NULL AND phone_number != ""', [], (err, rows) => {
                if (err) {
                    console.error("[API_AUTH_LOGIN_ERROR] Database error:", err.message);
                    reject(err);
                } else {
                    resolve(rows || []);
                }
            });
        });
        
        console.log(`[API_AUTH_LOGIN] Found ${allUsers.length} users with phone numbers`);
        
        // Cari user yang memiliki nomor HP yang cocok (setelah normalize)
        user = allUsers.find(u => {
            if (!u.phone_number) return false;
            const phones = u.phone_number.split('|').map(p => p.trim()).filter(p => p);
            const found = phones.some(p => {
                const normalized = normalizePhone(p);
                const match = normalized === normalizedPhone;
                if (match) {
                    console.log(`[API_AUTH_LOGIN] Match found! User ID: ${u.id}, Username: ${u.username}, Phone: "${p}" (normalized: "${normalized}")`);
                }
                return match;
            });
            if (!found && phones.length > 0) {
                console.log(`[API_AUTH_LOGIN] No match for user ID ${u.id} - Phones: [${phones.join(', ')}], Normalized: [${phones.map(p => normalizePhone(p)).join(', ')}]`);
            }
            return found;
        });
        
        if (!user) {
            console.log(`[API_AUTH_LOGIN] No user found with phone number: "${normalizedPhone}"`);
        }
    } else {
        // Login dengan username: cari di kolom username
        console.log(`[API_AUTH_LOGIN] Username login - Username: "${username}"`);
        const sql = `SELECT * FROM users WHERE username = ?`;
        
        user = await new Promise((resolve, reject) => {
            global.db.get(sql, [username], (err, row) => {
                if (err) {
                    console.error("[API_AUTH_LOGIN_ERROR] Database error:", err.message);
                    reject(err);
                } else {
                    if (row) {
                        console.log(`[API_AUTH_LOGIN] Found user: ID=${row.id}, Username=${row.username}`);
                    } else {
                        console.log(`[API_AUTH_LOGIN] No user found with username: "${username}"`);
                    }
                    resolve(row);
                }
            });
        });
    }

    if (!user) {
        console.log(`[API_AUTH_LOGIN] User not found - returning 401`);
        return sendError(res, "Username atau password salah.", 401);
    }

    console.log(`[API_AUTH_LOGIN] User found: ID=${user.id}, Username=${user.username}, Verifying password...`);
    const isValid = await comparePassword(password, user.password);
    if (!isValid) {
        console.log(`[API_AUTH_LOGIN] Password verification failed for user ID: ${user.id}`);
        return sendError(res, "Username atau password salah.", 401);
    }
    console.log(`[API_AUTH_LOGIN] Password verified successfully for user ID: ${user.id}`);

    // SECURITY: Create minimal payload untuk JWT (tidak include sensitive data)
    const payload = {
        id: user.id,
        name: user.name,
        // Add issued at time untuk token management
        iat: Math.floor(Date.now() / 1000)
    };

    // SECURITY: Sign token dengan expiration yang reasonable (7 days)
    // Consider: Token refresh mechanism untuk better security
    const token = jwt.sign(payload, global.config.jwt, { 
        expiresIn: '7d',
        // Add algorithm explicitly untuk prevent algorithm confusion attacks
        algorithm: 'HS256'
    });

    // SECURITY: Minimal data exposure - hanya return data yang diperlukan
    // Note: deviceId tidak perlu dikirim ke frontend karena:
    // - Frontend tidak perlu langsung akses GenieACS
    // - Backend sudah handle semua WiFi operations menggunakan device_id dari database
    // - Backend akan ambil device_id dari database berdasarkan JWT token
    return sendSuccess(res, {
        token: token,
        user: {
            id: user.id,
            name: user.name
        }
    }, "Login berhasil.");
}));

// Alias for /api/otp
router.post('/api/auth/otp/request', otpRequestValidation, asyncHandler(async (req, res) => {
    const { phoneNumber } = req.body;
    
    console.log(`[API_AUTH_OTP_REQUEST] OTP request received - PhoneNumber: "${phoneNumber}"`);
    
    if (!global.raf) {
        console.log(`[API_AUTH_OTP_REQUEST] Bot offline - Cannot send OTP`);
        return sendError(res, "Bot sedang offline", 503);
    }
    
    // Check rate limiting
    const rateLimitCheck = checkOTPRequestLimit(phoneNumber);
    if (!rateLimitCheck.allowed) {
        console.log(`[API_AUTH_OTP_REQUEST] Rate limit exceeded - PhoneNumber: "${phoneNumber}", RemainingTime: ${rateLimitCheck.remainingTime} menit`);
        return sendError(res, `Terlalu banyak permintaan OTP. Coba lagi dalam ${rateLimitCheck.remainingTime} menit.`, 429);
    }
    
    const otp = generateSecureOTP(6);
    console.log(`[API_AUTH_OTP_REQUEST] OTP generated: "${otp}" for PhoneNumber: "${phoneNumber}"`);
    
    const userToUpdate = global.users.find(v => v.phone_number.split('|').includes(phoneNumber));
    if (!userToUpdate) {
        console.log(`[API_AUTH_OTP_REQUEST] User not found - PhoneNumber: "${phoneNumber}"`);
        return sendError(res, "User tidak ditemukan", 404);
    }
    
    console.log(`[API_AUTH_OTP_REQUEST] User found - ID: ${userToUpdate.id}, Username: ${userToUpdate.username}, Name: ${userToUpdate.name}`);

    const otpTimestamp = Date.now();
    
    // Update OTP di database
    await new Promise((resolve, reject) => {
        global.db.run(`UPDATE users SET otp = ?, otpTimestamp = ? WHERE id = ?`, [otp, otpTimestamp, userToUpdate.id], function(err) {
            if (err) {
                console.error("[API_AUTH_OTP_ERROR] Gagal update OTP di database:", err.message);
                reject(err);
            } else {
                console.log(`[API_AUTH_OTP_REQUEST] OTP saved to database - User ID: ${userToUpdate.id}, OTP: "${otp}"`);
                resolve();
            }
        });
    });
    
    // Update in-memory user object
    userToUpdate.otp = otp;
    userToUpdate.otpTimestamp = otpTimestamp;
    
    const otpMessage = renderTemplate('otp_code', { otp });
    const phoneJid = phoneNumber + "@s.whatsapp.net";
    
    console.log(`[API_AUTH_OTP_REQUEST] Preparing to send OTP - PhoneJID: "${phoneJid}", Message length: ${otpMessage.length} chars`);
    
    // PENTING: Cek connection state dan gunakan error handling sesuai rules
    if (global.whatsappConnectionState === 'open' && global.raf && global.raf.sendMessage) {
        try {
            console.log(`[API_AUTH_OTP_REQUEST] Sending OTP via WhatsApp - PhoneJID: "${phoneJid}"`);
            await global.raf.sendMessage(phoneJid, { text: otpMessage }, { skipDuplicateCheck: true });
            console.log(`[API_AUTH_OTP_REQUEST] ✅ OTP successfully sent - PhoneJID: "${phoneJid}", OTP: "${otp}"`);
            return sendSuccess(res, null, "OTP berhasil dikirim");
        } catch (error) {
            console.error('[API_AUTH_OTP_REQUEST] ❌ Failed to send OTP', {
                phoneJid,
                otp,
                error: error.message,
                stack: error.stack
            });
            return sendError(res, "Gagal mengirim OTP. Silakan coba lagi.", 500);
        }
    } else {
        console.warn(`[API_AUTH_OTP_REQUEST] ⚠️ WhatsApp not connected - ConnectionState: "${global.whatsappConnectionState}", RAF available: ${!!global.raf}`);
        return sendError(res, "Layanan WhatsApp sedang tidak tersedia. Silakan coba lagi nanti.", 503);
    }
}));

// Alias for /api/otpverify
router.post('/api/auth/otp/verify', otpVerifyValidation, asyncHandler(async (req, res) => {
    const { phoneNumber: otpPhone, otp } = req.body;

    const userToVerify = global.users.find(v => v.phone_number.split('|').includes(otpPhone));
    if (!userToVerify) {
        return sendError(res, "Pengguna tidak ditemukan.", 404);
    }
    
    if (userToVerify.otp !== otp) {
        return sendError(res, "OTP tidak valid.", 400);
    }

    // Check if OTP is still valid using utility function
    if (!isOTPValid(userToVerify.otpTimestamp)) {
        // Clean up expired OTP
        await new Promise((resolve) => {
            global.db.run(`UPDATE users SET otp = ?, otpTimestamp = ? WHERE id = ?`, [null, null, userToVerify.id], (err) => {
                if (err) console.error("[API_OTP_EXPIRED_ERROR] Gagal membersihkan OTP kedaluwarsa di DB:", err.message);
                userToVerify.otp = null;
                userToVerify.otpTimestamp = null;
                resolve();
            });
        });
        return sendError(res, "OTP sudah kedaluwarsa. Silakan minta OTP baru.", 400);
    }

    // Clean up OTP after successful verification
    await new Promise((resolve) => {
        global.db.run(`UPDATE users SET otp = ?, otpTimestamp = ? WHERE id = ?`, [null, null, userToVerify.id], (err) => {
            if (err) {
                console.error("[API_OTP_VERIFY_ERROR] Gagal membersihkan OTP di DB:", err.message);
            }
            userToVerify.otp = null;
            userToVerify.otpTimestamp = null;
            resolve();
        });
    });

    // SECURITY: Generate JWT token dengan minimal payload
    const payload = { 
        id: userToVerify.id, 
        name: userToVerify.name,
        iat: Math.floor(Date.now() / 1000)
    };
    
    // SECURITY: Sign token dengan explicit algorithm
    const token = jwt.sign(payload, global.config.jwt, { 
        expiresIn: '7d',
        algorithm: 'HS256'
    });
    
    return sendSuccess(res, {
        token: token,
        user: {
            id: userToVerify.id,
            name: userToVerify.name
            // Note: deviceId tidak perlu dikirim ke frontend karena:
            // - Frontend tidak perlu langsung akses GenieACS
            // - Backend sudah handle semua WiFi operations menggunakan device_id dari database
            // - Backend akan ambil device_id dari database berdasarkan JWT token
        }
    }, "OTP berhasil diverifikasi.");
}));


router.get('/api/wifi-name', asyncHandler(async (req, res) => {
    const wifiData = await PublicService.getWifiName();
    return sendSuccess(res, wifiData, "Nama WiFi berhasil diambil");
}));

// GET /api/announcements - Get all announcements
router.get('/api/announcements', asyncHandler(async (req, res) => {
    const limit = req.query.limit ? parseInt(req.query.limit) : null;
    const announcements = await PublicService.getAnnouncements({ limit });
    
    // Set cache-control headers untuk mencegah browser caching (real-time updates)
    res.set({
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
    });
    
    // Response format dengan compatibility: tambahkan success field untuk admin panel
    return res.status(200).json({
        status: 200,
        success: true, // Compatibility field untuk admin panel
        message: "Daftar pengumuman berhasil diambil",
        data: announcements
    });
}));

// GET /api/announcements/recent - Get recent announcements (alias untuk compatibility)
router.get('/api/announcements/recent', asyncHandler(async (req, res) => {
    const limit = req.query.limit ? parseInt(req.query.limit) : 5;
    const announcements = await PublicService.getAnnouncements({ limit });
    
    // Set cache-control headers untuk mencegah browser caching (real-time updates)
    res.set({
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
    });
    
    // Response format dengan compatibility: tambahkan success field untuk admin panel
    return res.status(200).json({
        status: 200,
        success: true, // Compatibility field untuk admin panel
        message: "Daftar pengumuman terbaru berhasil diambil",
        data: announcements
    });
}));

// GET /api/news - Get all news
router.get('/api/news', asyncHandler(async (req, res) => {
    const limit = req.query.limit ? parseInt(req.query.limit) : null;
    const news = await PublicService.getNews({ limit });
    
    // Set cache-control headers untuk mencegah browser caching (real-time updates)
    res.set({
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
    });
    
    // Response format dengan compatibility: tambahkan success field untuk admin panel
    return res.status(200).json({
        status: 200,
        success: true, // Compatibility field untuk admin panel
        message: "Daftar berita berhasil diambil",
        data: news
    });
}));

// GET /api/news/recent - Get recent news (alias untuk compatibility)
router.get('/api/news/recent', asyncHandler(async (req, res) => {
    const limit = req.query.limit ? parseInt(req.query.limit) : 5;
    const news = await PublicService.getNews({ limit });
    
    // Set cache-control headers untuk mencegah browser caching (real-time updates)
    res.set({
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
    });
    
    // Response format dengan compatibility: tambahkan success field untuk admin panel
    return res.status(200).json({
        status: 200,
        success: true, // Compatibility field untuk admin panel
        message: "Daftar berita terbaru berhasil diambil",
        data: news
    });
}));

module.exports = router;
