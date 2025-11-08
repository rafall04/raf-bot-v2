const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { saveReports, loadJSON, saveJSON } = require('../lib/database');

const router = express.Router();
const reportsDbPath = path.join(__dirname, '..', 'database', 'reports.json');

/**
 * Configure multer for photo uploads
 * Store in public/uploads/tickets/
 */
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = path.join(__dirname, '..', 'public', 'uploads', 'tickets');
        // Create directory if it doesn't exist
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        // Generate unique filename: TICKET_ID-TIMESTAMP-RANDOM.ext
        const ticketId = req.body.ticketId || 'UNKNOWN';
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(7);
        const ext = path.extname(file.originalname);
        cb(null, `${ticketId}-${timestamp}-${random}${ext}`);
    }
});

const upload = multer({
    storage: storage,
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

/**
 * Generate random 6-digit OTP
 * Same function used in WhatsApp bot (teknisi-workflow-handler.js)
 */
function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Normalize phone number to WhatsApp JID format
 * Handles various formats: 0xxx, 62xxx, xxx
 */
function normalizePhoneToJID(phone) {
    if (!phone) return null;
    
    let phoneNum = phone.trim().replace(/[^0-9]/g, '');
    
    if (phoneNum.startsWith('0')) {
        phoneNum = '62' + phoneNum.substring(1);
    } else if (!phoneNum.startsWith('62')) {
        phoneNum = '62' + phoneNum;
    }
    
    return `${phoneNum}@s.whatsapp.net`;
}

/**
 * Send WhatsApp notification to ALL customer phone numbers
 * Follows pattern from teknisi-workflow-handler.js
 */
async function notifyAllCustomerNumbers(ticket, message) {
    if (!global.raf || !global.raf.sendMessage) {
        console.log('[NOTIFY_CUSTOMER] WhatsApp not connected');
        return;
    }
    
    const notifiedNumbers = new Set();
    
    // 1. Send to main customer (pelangganId)
    if (ticket.pelangganId) {
        try {
            await global.raf.sendMessage(ticket.pelangganId, { text: message });
            console.log(`[NOTIFY_CUSTOMER] Sent to main customer: ${ticket.pelangganId}`);
            notifiedNumbers.add(ticket.pelangganId);
        } catch (err) {
            console.error(`[NOTIFY_CUSTOMER] Failed to notify main customer:`, err.message);
        }
    }
    
    // 2. Send to ALL registered phone numbers
    if (ticket.pelangganPhone) {
        const phones = ticket.pelangganPhone.split('|').map(p => p.trim()).filter(p => p);
        console.log(`[NOTIFY_CUSTOMER] Sending to ${phones.length} phone numbers`);
        
        for (const phone of phones) {
            const phoneJid = normalizePhoneToJID(phone);
            
            if (!phoneJid || notifiedNumbers.has(phoneJid)) {
                continue; // Skip if already notified or invalid
            }
            
            try {
                await global.raf.sendMessage(phoneJid, { text: message });
                console.log(`[NOTIFY_CUSTOMER] Sent to additional number: ${phoneJid}`);
                notifiedNumbers.add(phoneJid);
            } catch (err) {
                console.error(`[NOTIFY_CUSTOMER] Failed to notify ${phoneJid}:`, err.message);
            }
        }
    }
}

// Middleware for authentication
function ensureAuthenticatedStaff(req, res, next) {
    if (!req.user || !['admin', 'owner', 'superadmin', 'teknisi'].includes(req.user.role)) {
        return res.status(403).json({ status: 403, message: "Akses ditolak." });
    }
    next();
}

function ensureAdmin(req, res, next) {
    if (!req.user || !['admin', 'owner', 'superadmin'].includes(req.user.role)) {
        return res.status(403).json({ status: 403, message: "Akses ditolak. Hanya admin yang diizinkan." });
    }
    next();
}

// Helper function to broadcast to admins
async function broadcastToAdmins(message, excludeNumbers = []) {
    try {
        if (!global.raf) {
            console.log('[BROADCAST] WhatsApp not connected, skipping broadcast');
            return;
        }

        const recipients = new Set();
        
        // Add owner number
        if (global.config.ownerNumber) {
            global.config.ownerNumber.forEach(num => {
                const cleanNum = num.replace(/[^0-9]/g, '');
                if (cleanNum && !excludeNumbers.includes(cleanNum)) {
                    recipients.add(cleanNum);
                }
            });
        }
        
        // Add admin accounts
        const adminAccounts = global.accounts.filter(acc => 
            ['admin', 'owner', 'superadmin'].includes(acc.role) && 
            acc.phone && 
            !excludeNumbers.includes(acc.phone.replace(/[^0-9]/g, ''))
        );
        
        adminAccounts.forEach(acc => {
            const cleanNum = acc.phone.replace(/[^0-9]/g, '');
            if (cleanNum) recipients.add(cleanNum);
        });
        
        // Send to all recipients
        for (const number of recipients) {
            try {
                const jid = number.includes('@s.whatsapp.net') ? number : `${number}@s.whatsapp.net`;
                await global.raf.sendMessage(jid, { text: message });
                console.log(`[BROADCAST] Sent to ${number}`);
            } catch (err) {
                console.error(`[BROADCAST] Failed to send to ${number}:`, err.message);
            }
        }
    } catch (error) {
        console.error('[BROADCAST_ERROR]', error);
    }
}

// GET /api/tickets - Get tickets for teknisi (filtered by status)
router.get('/tickets', ensureAuthenticatedStaff, async (req, res) => {
    try {
        const { status } = req.query;
        let filteredReports = [...global.reports];
        
        // Filter by status if provided
        if (status) {
            const statusArray = status.split(',').map(s => s.trim().toLowerCase());
            filteredReports = filteredReports.filter(report => {
                const reportStatus = (report.status || 'baru').toLowerCase();
                return statusArray.includes(reportStatus);
            });
            console.log(`[API_TICKETS] Filtered by status: ${status} → ${filteredReports.length} tickets`);
        }
        
        // REMOVED DOUBLE FILTER for teknisi role!
        // Frontend already specifies which statuses to show via query param
        // No need to filter again here - it was killing tickets with status='process', 'otw', etc.
        // See TICKET_STATUS_STANDARD.md for correct workflow
        
        // Sort by created_at descending (newest first)
        filteredReports.sort((a, b) => {
            const dateA = new Date(a.created_at || 0);
            const dateB = new Date(b.created_at || 0);
            return dateB - dateA;
        });
        
        // Add user details to each report
        const reportsWithDetails = filteredReports.map(report => {
            const user = global.users.find(u => u.id === report.user_id);
            return {
                ...report,
                user_name: user ? user.name : 'Unknown',
                user_phone: user ? user.phone : '',
                user_package: user ? user.package : '',
                user_pppoe: user ? user.pppoe_username : ''
            };
        });
        
        return res.json({
            status: 200,
            data: reportsWithDetails
        });
    } catch (error) {
        console.error('[API_TICKETS_ERROR]', error);
        return res.status(500).json({
            status: 500,
            message: 'Terjadi kesalahan saat mengambil data tiket'
        });
    }
});

// GET /api/admin/tickets - Get all tickets for admin
router.get('/admin/tickets', ensureAdmin, async (req, res) => {
    try {
        const { status, pppoeName, ticketId } = req.query;
        let filteredReports = [...global.reports];
        
        // Filter by status if provided
        if (status && status !== 'all') {
            filteredReports = filteredReports.filter(report => 
                (report.status || 'baru').toLowerCase() === status.toLowerCase()
            );
        }
        
        // Filter by PPPoE name if provided
        if (pppoeName) {
            const usersWithPppoe = global.users.filter(u => 
                u.pppoe_username && u.pppoe_username.toLowerCase().includes(pppoeName.toLowerCase())
            );
            const userIds = usersWithPppoe.map(u => u.id);
            filteredReports = filteredReports.filter(report => 
                userIds.includes(report.user_id)
            );
        }
        
        // Filter by ticket ID if provided
        if (ticketId) {
            filteredReports = filteredReports.filter(report => 
                report.id && report.id.toLowerCase().includes(ticketId.toLowerCase())
            );
        }
        
        // Sort by created_at descending (newest first)
        filteredReports.sort((a, b) => {
            const dateA = new Date(a.created_at || 0);
            const dateB = new Date(b.created_at || 0);
            return dateB - dateA;
        });
        
        // Add user details to each report
        const reportsWithDetails = filteredReports.map(report => {
            const user = global.users.find(u => u.id === report.user_id);
            return {
                ...report,
                user_name: user ? user.name : 'Unknown',
                user_phone: user ? user.phone : '',
                user_package: user ? user.package : '',
                user_pppoe: user ? user.pppoe_username : ''
            };
        });
        
        return res.json({
            status: 200,
            data: reportsWithDetails
        });
    } catch (error) {
        console.error('[API_ADMIN_TICKETS_ERROR]', error);
        return res.status(500).json({
            status: 500,
            message: 'Terjadi kesalahan saat mengambil data tiket'
        });
    }
});

// POST /api/ticket/process - Process a ticket (teknisi)
// UPDATED: Now follows WhatsApp bot workflow with OTP generation and multi-phone notifications
router.post('/ticket/process', ensureAuthenticatedStaff, async (req, res) => {
    try {
        const { ticketId } = req.body;
        
        if (!ticketId) {
            return res.status(400).json({
                status: 400,
                message: 'ID tiket harus diisi'
            });
        }
        
        // Find the ticket (support both 'id' and 'ticketId' fields)
        const reportIndex = global.reports.findIndex(r => 
            r.id === ticketId || r.ticketId === ticketId || 
            r.id === ticketId.toUpperCase() || r.ticketId === ticketId.toUpperCase()
        );
        
        if (reportIndex === -1) {
            return res.status(404).json({
                status: 404,
                message: 'Tiket tidak ditemukan'
            });
        }
        
        const ticket = global.reports[reportIndex];
        
        // Log current ticket status for debugging
        console.log(`[TICKET_PROCESS] Ticket ${ticketId} current status: "${ticket.status}"`);
        
        // Check if ticket is already being processed (support multiple status formats)
        if (ticket.status === 'process' || ticket.status === 'diproses teknisi' || 
            ticket.status === 'otw' || ticket.status === 'arrived' || ticket.status === 'working') {
            return res.status(400).json({
                status: 400,
                message: `Tiket sudah dalam proses atau sedang ditangani (Status: ${ticket.status})`
            });
        }
        
        if (ticket.status === 'selesai' || ticket.status === 'completed' || ticket.status === 'resolved') {
            return res.status(400).json({
                status: 400,
                message: 'Tiket sudah selesai'
            });
        }
        
        // Find teknisi account from global.accounts
        // Match by username, ID, or phone number
        const teknisi = global.accounts.find(acc => 
            acc.role === 'teknisi' && (
                acc.username === req.user.username ||
                acc.id === req.user.id ||
                (acc.phone_number && req.user.phone && acc.phone_number === req.user.phone)
            )
        );
        
        if (!teknisi) {
            console.error(`[TICKET_PROCESS] Teknisi not found in accounts. User:`, req.user);
            return res.status(403).json({
                status: 403,
                message: 'Akun teknisi tidak ditemukan'
            });
        }
        
        console.log(`[TICKET_PROCESS] Teknisi found: ${teknisi.name || teknisi.username} (ID: ${teknisi.id})`);
        
        // Generate OTP (same as WhatsApp bot)
        const otp = generateOTP();
        console.log(`[TICKET_PROCESS] Generated OTP: ${otp} for ticket ${ticketId}`);
        
        // Update ticket with all required fields (following WhatsApp bot pattern)
        ticket.status = 'process';  // Use 'process' status like in bot
        ticket.teknisiId = req.user.id || req.user.username;  // Store teknisi identifier
        ticket.teknisiName = teknisi.name || teknisi.username;  // IMPORTANT: Use name, not username
        ticket.teknisiPhone = teknisi.phone_number;  // For customer contact
        ticket.otp = otp;  // Store OTP for verification later
        ticket.processedAt = new Date().toISOString();
        ticket.processedBy = req.user.username;  // Keep for backward compatibility
        
        // Ensure ticketId field exists (for consistency with WhatsApp bot)
        if (!ticket.ticketId) {
            ticket.ticketId = ticket.id;
        }
        
        // Save to database
        saveReports(global.reports);
        console.log(`[TICKET_PROCESS] Ticket ${ticketId} updated with status=process, OTP=${otp}`);
        
        // Get customer (user) details - support both field names for backward compatibility
        const userId = ticket.pelangganUserId || ticket.user_id;
        console.log(`[TICKET_PROCESS] Looking for user with ID: ${userId}`);
        
        const user = global.users.find(u => u.id === userId);
        
        if (!user) {
            console.error(`[TICKET_PROCESS] User not found. Tried pelangganUserId: ${ticket.pelangganUserId}, user_id: ${ticket.user_id}`);
            console.error(`[TICKET_PROCESS] Available users:`, global.users.length, 'users in database');
            return res.status(404).json({
                status: 404,
                message: 'Data pelanggan tidak ditemukan. Pastikan pelanggan terdaftar di sistem.'
            });
        }
        
        console.log(`[TICKET_PROCESS] User found: ${user.name} (ID: ${user.id})`);
        
        // Get teknisi phone for customer contact (format for wa.me link)
        const teknisiPhone = (() => {
            if (!teknisi.phone_number) return null;
            let phone = teknisi.phone_number.replace(/[^0-9]/g, '');
            if (phone.startsWith('0')) {
                return '62' + phone.substring(1);
            } else if (!phone.startsWith('62')) {
                return '62' + phone;
            }
            return phone;
        })();
        
        // Prepare customer notification message (same format as WhatsApp bot)
        const customerMessage = `✅ *TIKET DIPROSES*

━━━━━━━━━━━━━━━━
📋 ID Tiket: *${ticket.ticketId || ticket.id}*
🔧 Teknisi: *${teknisi.name || teknisi.username}*
${teknisiPhone ? `📱 Kontak: wa.me/${teknisiPhone}\n` : ''}━━━━━━━━━━━━━━━━

🔐 *KODE OTP: ${otp}*

⚠️ *PENTING:*
• Simpan kode OTP ini
• Berikan ke teknisi saat tiba
• Jangan berikan ke orang lain
• Kode hanya untuk tiket ini

Teknisi akan segera menuju lokasi Anda.

_Estimasi kedatangan akan diinformasikan._`;
        
        // Send to ALL customer phone numbers (following WhatsApp bot pattern)
        await notifyAllCustomerNumbers(ticket, customerMessage);
        
        // Broadcast to admins (using teknisi.name instead of username)
        const broadcastMsg = `🔧 *TIKET DIPROSES*\n\n` +
            `📋 *ID Tiket:* ${ticket.ticketId || ticket.id}\n` +
            `👤 *Pelanggan:* ${user.name}\n` +
            `📦 *Paket:* ${user.subscription || user.package || '-'}\n` +
            `📝 *Laporan:* ${ticket.description || ticket.laporan || '-'}\n` +
            `👨‍🔧 *Teknisi:* ${teknisi.name || teknisi.username}\n` +
            `⏰ *Waktu:* ${new Date().toLocaleString('id-ID')}\n` +
            `🔐 *OTP Generated:* ${otp}\n` +
            `📊 *Status:* SEDANG DIPROSES`;
            
        await broadcastToAdmins(broadcastMsg);
        
        return res.json({
            status: 200,
            message: 'Tiket berhasil diproses',
            data: {
                ticketId: ticket.ticketId || ticket.id,
                teknisiName: teknisi.name || teknisi.username,
                otp: otp,
                status: 'process',
                customerNotified: true
            }
        });
    } catch (error) {
        console.error('[API_TICKET_PROCESS_ERROR]', error);
        return res.status(500).json({
            status: 500,
            message: 'Terjadi kesalahan saat memproses tiket',
            error: error.message
        });
    }
});

// POST /api/ticket/otw - Teknisi on the way (OTW)
// Follows WhatsApp bot workflow: handleOTW()
router.post('/ticket/otw', ensureAuthenticatedStaff, async (req, res) => {
    try {
        const { ticketId } = req.body;
        
        if (!ticketId) {
            return res.status(400).json({
                status: 400,
                message: 'ID tiket harus diisi'
            });
        }
        
        // Find the ticket
        const reportIndex = global.reports.findIndex(r => 
            r.id === ticketId || r.ticketId === ticketId || 
            r.id === ticketId.toUpperCase() || r.ticketId === ticketId.toUpperCase()
        );
        
        if (reportIndex === -1) {
            return res.status(404).json({
                status: 404,
                message: 'Tiket tidak ditemukan'
            });
        }
        
        const ticket = global.reports[reportIndex];
        
        // Verify teknisi is assigned to this ticket
        if (ticket.teknisiId && ticket.teknisiId !== req.user.id && ticket.teknisiId !== req.user.username) {
            return res.status(403).json({
                status: 403,
                message: 'Anda bukan teknisi yang menangani tiket ini'
            });
        }
        
        // Check status - must be 'process' to go OTW
        if (ticket.status !== 'process' && ticket.status !== 'diproses teknisi') {
            return res.status(400).json({
                status: 400,
                message: `Status tiket tidak sesuai. Harus diproses dulu. Status saat ini: ${ticket.status}`
            });
        }
        
        // Find teknisi info
        const teknisi = global.accounts.find(acc => 
            acc.role === 'teknisi' && (
                acc.username === req.user.username ||
                acc.id === req.user.id
            )
        );
        
        if (!teknisi) {
            return res.status(403).json({
                status: 403,
                message: 'Akun teknisi tidak ditemukan'
            });
        }
        
        // Update ticket status to OTW
        ticket.status = 'otw';
        ticket.otwAt = new Date().toISOString();
        
        // Ensure teknisi fields are set (for backward compatibility)
        if (!ticket.teknisiId) ticket.teknisiId = req.user.id || req.user.username;
        if (!ticket.teknisiName) ticket.teknisiName = teknisi.name || teknisi.username;
        if (!ticket.teknisiPhone) ticket.teknisiPhone = teknisi.phone_number;
        
        // Save to database
        saveReports(global.reports);
        console.log(`[TICKET_OTW] Ticket ${ticketId} status updated to OTW`);
        
        // Get teknisi phone for customer contact
        const teknisiPhone = (() => {
            if (!teknisi.phone_number) return null;
            let phone = teknisi.phone_number.replace(/[^0-9]/g, '');
            if (phone.startsWith('0')) {
                return '62' + phone.substring(1);
            } else if (!phone.startsWith('62')) {
                return '62' + phone;
            }
            return phone;
        })();
        
        // Prepare customer notification (same format as WhatsApp bot)
        const customerMessage = `🚗 *TEKNISI BERANGKAT*

━━━━━━━━━━━━━━━━
📋 ID Tiket: *${ticket.ticketId || ticket.id}*
🔧 Teknisi: *${teknisi.name || teknisi.username}*
${teknisiPhone ? `📱 Kontak: wa.me/${teknisiPhone}\n` : ''}━━━━━━━━━━━━━━━━

Teknisi sedang menuju lokasi Anda.

⏱️ *Estimasi Tiba:* 30-60 menit
_Waktu dapat berubah tergantung kondisi_

${ticket.otp ? `🔐 *KODE VERIFIKASI:*
╔════════════════╗
║  *${ticket.otp}*  ║
╚════════════════╝

Berikan kode ini saat teknisi tiba.` : ''}`;
        
        // Send to ALL customer phone numbers
        await notifyAllCustomerNumbers(ticket, customerMessage);
        
        return res.json({
            status: 200,
            message: 'Status OTW berhasil diupdate',
            data: {
                ticketId: ticket.ticketId || ticket.id,
                status: 'otw',
                teknisiName: teknisi.name || teknisi.username,
                customerNotified: true
            }
        });
    } catch (error) {
        console.error('[API_TICKET_OTW_ERROR]', error);
        return res.status(500).json({
            status: 500,
            message: 'Terjadi kesalahan saat update status OTW',
            error: error.message
        });
    }
});

// POST /api/ticket/arrived - Teknisi arrived at location (Sampai Lokasi)
// Follows WhatsApp bot workflow: handleSampaiLokasi()
router.post('/ticket/arrived', ensureAuthenticatedStaff, async (req, res) => {
    try {
        const { ticketId } = req.body;
        
        if (!ticketId) {
            return res.status(400).json({
                status: 400,
                message: 'ID tiket harus diisi'
            });
        }
        
        // Find the ticket
        const reportIndex = global.reports.findIndex(r => 
            r.id === ticketId || r.ticketId === ticketId || 
            r.id === ticketId.toUpperCase() || r.ticketId === ticketId.toUpperCase()
        );
        
        if (reportIndex === -1) {
            return res.status(404).json({
                status: 404,
                message: 'Tiket tidak ditemukan'
            });
        }
        
        const ticket = global.reports[reportIndex];
        
        // Verify teknisi is assigned to this ticket
        if (ticket.teknisiId && ticket.teknisiId !== req.user.id && ticket.teknisiId !== req.user.username) {
            return res.status(403).json({
                status: 403,
                message: 'Anda bukan teknisi yang menangani tiket ini'
            });
        }
        
        // Check status - can be OTW or process (allow flexibility)
        if (ticket.status !== 'otw' && ticket.status !== 'process' && ticket.status !== 'diproses teknisi') {
            return res.status(400).json({
                status: 400,
                message: `Status tiket tidak sesuai. Status saat ini: ${ticket.status}`
            });
        }
        
        // Ensure OTP exists (generate if missing - recovery mechanism)
        if (!ticket.otp) {
            console.warn(`[TICKET_ARRIVED] OTP not found for ticket ${ticketId}, generating new OTP`);
            ticket.otp = generateOTP();
        }
        
        // Find teknisi info
        const teknisi = global.accounts.find(acc => 
            acc.role === 'teknisi' && (
                acc.username === req.user.username ||
                acc.id === req.user.id
            )
        );
        
        if (!teknisi) {
            return res.status(403).json({
                status: 403,
                message: 'Akun teknisi tidak ditemukan'
            });
        }
        
        // Update ticket status to arrived
        ticket.status = 'arrived';
        ticket.arrivedAt = new Date().toISOString();
        
        // Ensure teknisi fields are set
        if (!ticket.teknisiId) ticket.teknisiId = req.user.id || req.user.username;
        if (!ticket.teknisiName) ticket.teknisiName = teknisi.name || teknisi.username;
        if (!ticket.teknisiPhone) ticket.teknisiPhone = teknisi.phone_number;
        
        // Save to database
        saveReports(global.reports);
        console.log(`[TICKET_ARRIVED] Ticket ${ticketId} status updated to arrived, OTP: ${ticket.otp}`);
        
        // Get teknisi phone for customer contact
        const teknisiPhone = (() => {
            if (!teknisi.phone_number) return null;
            let phone = teknisi.phone_number.replace(/[^0-9]/g, '');
            if (phone.startsWith('0')) {
                return '62' + phone.substring(1);
            } else if (!phone.startsWith('62')) {
                return '62' + phone;
            }
            return phone;
        })();
        
        // Prepare customer notification (same format as WhatsApp bot)
        const customerMessage = `🎉 *TEKNISI SUDAH TIBA*

━━━━━━━━━━━━━━━━
📋 ID Tiket: *${ticket.ticketId || ticket.id}*
🔧 Teknisi: *${teknisi.name || teknisi.username}*
${teknisiPhone ? `📱 Kontak: wa.me/${teknisiPhone}\n` : ''}━━━━━━━━━━━━━━━━

✅ Teknisi sudah di lokasi Anda

🔐 *KODE VERIFIKASI:*
╔════════════════╗
║  *${ticket.otp}*  ║
╚════════════════╝

⚠️ *PENTING:*
• Berikan kode ini ke teknisi
• Untuk memverifikasi identitas
• Jangan berikan ke orang lain

_Perbaikan akan segera dimulai._`;
        
        // Send to ALL customer phone numbers
        await notifyAllCustomerNumbers(ticket, customerMessage);
        
        return res.json({
            status: 200,
            message: 'Status arrived berhasil diupdate',
            data: {
                ticketId: ticket.ticketId || ticket.id,
                status: 'arrived',
                otp: ticket.otp,
                teknisiName: teknisi.name || teknisi.username,
                customerNotified: true,
                nextStep: 'verifikasi OTP'
            }
        });
    } catch (error) {
        console.error('[API_TICKET_ARRIVED_ERROR]', error);
        return res.status(500).json({
            status: 500,
            message: 'Terjadi kesalahan saat update status arrived',
            error: error.message
        });
    }
});

// POST /api/ticket/verify-otp - Verify OTP and start work
// Follows WhatsApp bot workflow: handleVerifikasiOTP()
router.post('/ticket/verify-otp', ensureAuthenticatedStaff, async (req, res) => {
    try {
        const { ticketId, otp } = req.body;
        
        if (!ticketId || !otp) {
            return res.status(400).json({
                status: 400,
                message: 'ID tiket dan OTP harus diisi'
            });
        }
        
        // Find the ticket
        const reportIndex = global.reports.findIndex(r => 
            r.id === ticketId || r.ticketId === ticketId || 
            r.id === ticketId.toUpperCase() || r.ticketId === ticketId.toUpperCase()
        );
        
        if (reportIndex === -1) {
            return res.status(404).json({
                status: 404,
                message: 'Tiket tidak ditemukan'
            });
        }
        
        const ticket = global.reports[reportIndex];
        
        // Verify teknisi is assigned to this ticket
        if (ticket.teknisiId && ticket.teknisiId !== req.user.id && ticket.teknisiId !== req.user.username) {
            return res.status(403).json({
                status: 403,
                message: 'Anda bukan teknisi yang menangani tiket ini'
            });
        }
        
        // Check status - must be 'arrived' to verify OTP
        if (ticket.status !== 'arrived') {
            return res.status(400).json({
                status: 400,
                message: `Harus sampai di lokasi dulu. Status saat ini: ${ticket.status}`
            });
        }
        
        // Verify OTP
        if (ticket.otp !== otp.toString().trim()) {
            return res.status(400).json({
                status: 400,
                message: 'Kode OTP salah! Minta kode yang benar dari pelanggan.'
            });
        }
        
        // Find teknisi info
        const teknisi = global.accounts.find(acc => 
            acc.role === 'teknisi' && (
                acc.username === req.user.username ||
                acc.id === req.user.id
            )
        );
        
        if (!teknisi) {
            return res.status(403).json({
                status: 403,
                message: 'Akun teknisi tidak ditemukan'
            });
        }
        
        // Update ticket status to working
        ticket.status = 'working';
        ticket.otpVerifiedAt = new Date().toISOString();
        ticket.workStartedAt = new Date().toISOString();
        
        // Initialize photos array if not exists
        if (!ticket.photos) {
            ticket.photos = [];
        }
        
        // Save to database
        saveReports(global.reports);
        console.log(`[TICKET_VERIFY_OTP] Ticket ${ticketId} OTP verified, status updated to working`);
        
        // Prepare customer notification
        const customerMessage = `🔧 *PENGERJAAN DIMULAI*

━━━━━━━━━━━━━━━━
📋 ID Tiket: *${ticket.ticketId || ticket.id}*
🔧 Teknisi: *${teknisi.name || teknisi.username}*
━━━━━━━━━━━━━━━━

✅ Verifikasi OTP berhasil
🔧 Teknisi mulai melakukan perbaikan

_Anda akan diinformasikan saat selesai._`;
        
        // Send to ALL customer phone numbers
        await notifyAllCustomerNumbers(ticket, customerMessage);
        
        return res.json({
            status: 200,
            message: 'OTP berhasil diverifikasi',
            data: {
                ticketId: ticket.ticketId || ticket.id,
                status: 'working',
                teknisiName: teknisi.name || teknisi.username,
                workStartedAt: ticket.workStartedAt,
                customerNotified: true,
                nextStep: 'upload foto (minimal 2)'
            }
        });
    } catch (error) {
        console.error('[API_TICKET_VERIFY_OTP_ERROR]', error);
        return res.status(500).json({
            status: 500,
            message: 'Terjadi kesalahan saat verifikasi OTP',
            error: error.message
        });
    }
});

// POST /api/ticket/upload-photo - Upload photo documentation
// Follows WhatsApp bot workflow: handleTeknisiPhotoUpload()
router.post('/ticket/upload-photo', ensureAuthenticatedStaff, upload.single('photo'), async (req, res) => {
    try {
        const { ticketId } = req.body;
        
        if (!ticketId) {
            return res.status(400).json({
                status: 400,
                message: 'ID tiket harus diisi'
            });
        }
        
        if (!req.file) {
            return res.status(400).json({
                status: 400,
                message: 'File foto harus diupload'
            });
        }
        
        // Find the ticket
        const reportIndex = global.reports.findIndex(r => 
            r.id === ticketId || r.ticketId === ticketId || 
            r.id === ticketId.toUpperCase() || r.ticketId === ticketId.toUpperCase()
        );
        
        if (reportIndex === -1) {
            return res.status(404).json({
                status: 404,
                message: 'Tiket tidak ditemukan'
            });
        }
        
        const ticket = global.reports[reportIndex];
        
        // Verify teknisi is assigned to this ticket
        if (ticket.teknisiId && ticket.teknisiId !== req.user.id && ticket.teknisiId !== req.user.username) {
            return res.status(403).json({
                status: 403,
                message: 'Anda bukan teknisi yang menangani tiket ini'
            });
        }
        
        // Check status - must be 'working' to upload photos
        if (ticket.status !== 'working') {
            return res.status(400).json({
                status: 400,
                message: `Harus verifikasi OTP dulu. Status saat ini: ${ticket.status}`
            });
        }
        
        // Initialize BOTH photos arrays for compatibility
        if (!ticket.photos) {
            ticket.photos = [];
        }
        if (!ticket.teknisiPhotos) {
            ticket.teknisiPhotos = [];
        }
        
        // Check maximum photos limit (max 5 photos)
        // Check BOTH arrays to get total count
        const totalPhotos = Math.max(
            ticket.photos.length,
            ticket.teknisiPhotos.length
        );
        
        if (totalPhotos >= 5) {
            // Delete the uploaded file since we're rejecting it
            fs.unlinkSync(req.file.path);
            return res.status(400).json({
                status: 400,
                message: 'Maksimal 5 foto sudah tercapai'
            });
        }
        
        // Store photo info in BOTH fields for compatibility
        const photoInfo = {
            path: `/uploads/tickets/${req.file.filename}`,  // Web-accessible path
            filename: req.file.filename,
            uploadedAt: new Date().toISOString(),
            uploadedBy: req.user.username,
            size: req.file.size
        };
        
        // Store in photos field (for web dashboard compatibility)
        ticket.photos.push(photoInfo);
        
        // ALSO store filename in teknisiPhotos (for WhatsApp bot compatibility)
        // Move file to teknisi folder for consistency
        const oldPath = req.file.path;
        const newPath = path.join(__dirname, '..', 'uploads', 'teknisi', req.file.filename);
        
        // Ensure teknisi folder exists
        const teknisiDir = path.join(__dirname, '..', 'uploads', 'teknisi');
        if (!fs.existsSync(teknisiDir)) {
            fs.mkdirSync(teknisiDir, { recursive: true });
        }
        
        // Copy file to teknisi folder
        fs.copyFileSync(oldPath, newPath);
        
        // Add to teknisiPhotos array (just filename, like WhatsApp does)
        ticket.teknisiPhotos.push(req.file.filename);
        
        // Save to database
        saveReports(global.reports);
        console.log(`[TICKET_UPLOAD_PHOTO] Photo uploaded for ticket ${ticketId}. Total: ${ticket.photos.length}`);
        
        // Update photoCount for consistency
        ticket.teknisiPhotoCount = ticket.teknisiPhotos.length;
        
        // Check if minimum photos requirement is met
        const minPhotos = 2;
        const currentTotal = ticket.teknisiPhotos.length;
        const canComplete = currentTotal >= minPhotos;
        
        return res.json({
            status: 200,
            message: `Foto ${currentTotal} berhasil diupload`,
            data: {
                ticketId: ticket.ticketId || ticket.id,
                photoCount: currentTotal,
                totalPhotos: currentTotal,
                minPhotos: minPhotos,
                canComplete: canComplete,
                photo: photoInfo,
                nextStep: canComplete ? 'Bisa selesaikan tiket sekarang' : `Perlu ${minPhotos - currentTotal} foto lagi (minimal ${minPhotos} foto)`
            }
        });
    } catch (error) {
        console.error('[API_TICKET_UPLOAD_PHOTO_ERROR]', error);
        return res.status(500).json({
            status: 500,
            message: 'Terjadi kesalahan saat upload foto',
            error: error.message
        });
    }
});

// POST /api/ticket/complete - Complete ticket with resolution notes
// Follows WhatsApp bot workflow: handleSelesaiTicket() / handleCompleteTicket()
// IMPORTANT: Enforces minimum 2 photos requirement
router.post('/ticket/complete', ensureAuthenticatedStaff, async (req, res) => {
    try {
        const { ticketId, resolutionNotes } = req.body;
        
        if (!ticketId) {
            return res.status(400).json({
                status: 400,
                message: 'ID tiket harus diisi'
            });
        }
        
        // Find the ticket
        const reportIndex = global.reports.findIndex(r => 
            r.id === ticketId || r.ticketId === ticketId || 
            r.id === ticketId.toUpperCase() || r.ticketId === ticketId.toUpperCase()
        );
        
        if (reportIndex === -1) {
            return res.status(404).json({
                status: 404,
                message: 'Tiket tidak ditemukan'
            });
        }
        
        const ticket = global.reports[reportIndex];
        
        // Verify teknisi is assigned to this ticket
        if (ticket.teknisiId && ticket.teknisiId !== req.user.id && ticket.teknisiId !== req.user.username) {
            return res.status(403).json({
                status: 403,
                message: 'Anda bukan teknisi yang menangani tiket ini'
            });
        }
        
        // Check status - must be 'working' to complete
        if (ticket.status !== 'working') {
            return res.status(400).json({
                status: 400,
                message: `Tiket belum dalam status working. Status saat ini: ${ticket.status}`
            });
        }
        
        // CRITICAL: Check minimum photos requirement (same as WhatsApp bot)
        const minPhotos = 2;
        if (!ticket.photos || ticket.photos.length < minPhotos) {
            return res.status(400).json({
                status: 400,
                message: `Minimal ${minPhotos} foto diperlukan! Saat ini: ${ticket.photos ? ticket.photos.length : 0} foto`,
                data: {
                    currentPhotos: ticket.photos ? ticket.photos.length : 0,
                    requiredPhotos: minPhotos,
                    missing: minPhotos - (ticket.photos ? ticket.photos.length : 0)
                }
            });
        }
        
        // Find teknisi info
        const teknisi = global.accounts.find(acc => 
            acc.role === 'teknisi' && (
                acc.username === req.user.username ||
                acc.id === req.user.id
            )
        );
        
        if (!teknisi) {
            return res.status(403).json({
                status: 403,
                message: 'Akun teknisi tidak ditemukan'
            });
        }
        
        // Calculate work duration
        const workStartedAt = new Date(ticket.workStartedAt);
        const completedAt = new Date();
        const durationMs = completedAt - workStartedAt;
        const durationMinutes = Math.floor(durationMs / 1000 / 60);
        
        // Update ticket status to completed/resolved
        ticket.status = 'resolved';  // Use 'resolved' status like in WhatsApp bot
        ticket.completedAt = completedAt.toISOString();
        ticket.resolvedAt = completedAt.toISOString();
        ticket.resolvedBy = req.user.username;
        ticket.resolutionNotes = resolutionNotes || 'Selesai';
        ticket.workDuration = durationMinutes;
        ticket.photoCount = ticket.photos.length;
        
        // Save to database
        saveReports(global.reports);
        console.log(`[TICKET_COMPLETE] Ticket ${ticketId} completed. Duration: ${durationMinutes} min, Photos: ${ticket.photos.length}`);
        
        // Prepare customer notification (same format as WhatsApp bot)
        const customerMessage = `✅ *PERBAIKAN SELESAI*

━━━━━━━━━━━━━━━━
📋 ID Tiket: *${ticket.ticketId || ticket.id}*
🔧 Teknisi: *${teknisi.name || teknisi.username}*
⏱️ Durasi: ${durationMinutes} menit
━━━━━━━━━━━━━━━━

✅ Masalah telah diselesaikan
📸 Dokumentasi: ${ticket.photos.length} foto
${resolutionNotes ? `\n📝 *Catatan:*\n${resolutionNotes}\n` : ''}
*Terima kasih telah menunggu!*

Jika ada masalah lagi, silakan lapor kembali.

_Tiket telah ditutup._`;
        
        // Send to ALL customer phone numbers
        await notifyAllCustomerNumbers(ticket, customerMessage);
        
        // Broadcast to admins
        const broadcastMsg = `✅ *TIKET SELESAI*\n\n` +
            `📋 *ID Tiket:* ${ticket.ticketId || ticket.id}\n` +
            `🔧 *Teknisi:* ${teknisi.name || teknisi.username}\n` +
            `⏱️ *Durasi:* ${durationMinutes} menit\n` +
            `📸 *Foto:* ${ticket.photos.length} dokumentasi\n` +
            (resolutionNotes ? `📝 *Catatan:* ${resolutionNotes}\n` : '') +
            `⏰ *Selesai:* ${new Date().toLocaleString('id-ID')}\n` +
            `📊 *Status:* SELESAI`;
            
        await broadcastToAdmins(broadcastMsg);
        
        return res.json({
            status: 200,
            message: 'Tiket berhasil diselesaikan',
            data: {
                ticketId: ticket.ticketId || ticket.id,
                status: 'resolved',
                teknisiName: teknisi.name || teknisi.username,
                duration: durationMinutes,
                photoCount: ticket.photos.length,
                customerNotified: true,
                completedAt: ticket.completedAt
            }
        });
    } catch (error) {
        console.error('[API_TICKET_COMPLETE_ERROR]', error);
        return res.status(500).json({
            status: 500,
            message: 'Terjadi kesalahan saat menyelesaikan tiket',
            error: error.message
        });
    }
});

// POST /api/ticket/resolve - Resolve a ticket (teknisi)
router.post('/ticket/resolve', ensureAuthenticatedStaff, async (req, res) => {
    try {
        const { ticketId, resolution } = req.body;
        
        if (!ticketId) {
            return res.status(400).json({
                status: 400,
                message: 'ID tiket harus diisi'
            });
        }
        
        // Find the ticket
        const reportIndex = global.reports.findIndex(r => r.id === ticketId);
        if (reportIndex === -1) {
            return res.status(404).json({
                status: 404,
                message: 'Tiket tidak ditemukan'
            });
        }
        
        const report = global.reports[reportIndex];
        
        // Update ticket status
        report.status = 'selesai';
        report.resolved_by = req.user.username;
        report.resolved_at = new Date().toISOString();
        if (resolution) {
            report.resolution = resolution;
        }
        
        // Calculate duration if it was being processed
        if (report.processed_at) {
            const processedTime = new Date(report.processed_at);
            const resolvedTime = new Date(report.resolved_at);
            const durationMs = resolvedTime - processedTime;
            const durationMinutes = Math.floor(durationMs / 60000);
            report.duration_minutes = durationMinutes;
        }
        
        // Save to database
        saveReports(global.reports);
        
        // Get user details
        const user = global.users.find(u => u.id === report.user_id);
        
        // Broadcast to admins
        const broadcastMsg = `✅ *TIKET SELESAI*\n\n` +
            `📋 *ID Tiket:* ${report.ticketId || report.id}\n` +
            `👤 *Pelanggan:* ${user ? user.name : 'Unknown'}\n` +
            `📦 *Paket:* ${user ? user.package : '-'}\n` +
            `📝 *Laporan:* ${report.description}\n` +
            `👨‍🔧 *Diselesaikan oleh:* ${req.user.username}\n` +
            `⏰ *Waktu Selesai:* ${new Date().toLocaleString('id-ID')}\n` +
            (report.duration_minutes ? `⏱️ *Durasi Penanganan:* ${report.duration_minutes} menit\n` : '') +
            `📊 *Status:* SELESAI`;
            
        await broadcastToAdmins(broadcastMsg);
        
        // Send notification to customer via WhatsApp if possible
        if (global.raf && user && user.phone) {
            const customerMsg = `Halo ${user.name},\n\n` +
                `✅ Laporan Anda dengan ID *${report.ticketId || report.id}* telah SELESAI ditangani.\n\n` +
                (resolution ? `*Penyelesaian:* ${resolution}\n\n` : '') +
                `Terima kasih telah menggunakan layanan kami. Jika masih ada kendala, silakan hubungi kami kembali.\n\n` +
                `Salam hangat,\nTim Support 🙏`;
            
            try {
                const phoneNumber = user.phone.replace(/[^0-9]/g, '');
                const jid = phoneNumber.includes('@s.whatsapp.net') ? phoneNumber : `${phoneNumber}@s.whatsapp.net`;
                await global.raf.sendMessage(jid, { text: customerMsg });
            } catch (err) {
                console.error('[TICKET_RESOLVE] Failed to send WhatsApp to customer:', err);
            }
        }
        
        return res.json({
            status: 200,
            message: 'Tiket berhasil diselesaikan'
        });
    } catch (error) {
        console.error('[API_TICKET_RESOLVE_ERROR]', error);
        return res.status(500).json({
            status: 500,
            message: 'Terjadi kesalahan saat menyelesaikan tiket'
        });
    }
});

// Helper function to generate ticket ID (consistent with WhatsApp bot)
function generateTicketId(length = 7) {
    const characters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let result = '';
    const charactersLength = characters.length;
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
}

// POST /api/admin/ticket/create - Admin create ticket (UPDATED to match WhatsApp bot)
router.post('/admin/ticket/create', ensureAdmin, async (req, res) => {
    try {
        const { customerUserId, laporanText, priority, issueType } = req.body;
        
        if (!customerUserId || !laporanText) {
            return res.status(400).json({
                status: 400,
                message: 'User ID dan laporan harus diisi'
            });
        }
        
        // Find the user
        const user = global.users.find(u => u.id === parseInt(customerUserId));
        if (!user) {
            return res.status(404).json({
                status: 404,
                message: 'Pelanggan tidak ditemukan'
            });
        }
        
        // Generate ticket ID (consistent with WhatsApp bot)
        const ticketId = generateTicketId(7);
        
        // Create ticket with SAME structure as WhatsApp bot
        const newTicket = {
            ticketId: ticketId,  // Use ticketId, not id
            pelangganUserId: user.id,
            pelangganId: user.phone_number ? `${user.phone_number}@s.whatsapp.net` : '',
            pelangganName: user.name || user.username || 'Customer',
            pelangganPhone: user.phone_number || '',
            pelangganAddress: user.address || '',
            pelangganSubscription: user.subscription || 'Tidak terinfo',
            pelangganDataSystem: {
                id: user.id,
                name: user.name,
                address: user.address,
                subscription: user.subscription,
                pppoe_username: user.pppoe_username
            },
            laporanText: laporanText,
            status: 'baru',
            priority: priority || 'MEDIUM',  // Add priority field
            issueType: issueType || 'GENERAL',  // Add issue type
            createdAt: new Date().toISOString(),
            createdBy: req.user.username,
            createdByAdmin: true,
            deviceOnline: null,  // Unknown from admin panel
            troubleshootingDone: false,
            assignedTeknisiId: null,
            assignedTeknisiName: null,
            processingStartedAt: null,
            processedByTeknisiId: null,
            processedByTeknisiName: null,
            resolvedAt: null,
            resolvedByTeknisiId: null,
            resolvedByTeknisiName: null,
            cancellationReason: null,
            cancellationTimestamp: null,
            cancelledBy: null
        };
        
        // Add to reports
        global.reports.push(newTicket);
        
        // Save to database
        saveReports(global.reports);
        
        // Notify customer via WhatsApp
        if (global.raf && user.phone_number) {
            const customerMsg = `✨ *TIKET LAPORAN DIBUAT OLEH ADMIN* ✨\n\n` +
                `Halo ${user.name || 'Pelanggan'},\n\n` +
                `Admin telah membuat tiket laporan untuk Anda:\n\n` +
                `━━━━━━━━━━━━━━━━\n` +
                `📋 *ID Tiket:* ${ticketId}\n` +
                `⚡ *Prioritas:* ${priority === 'HIGH' ? '🔴 URGENT' : priority === 'MEDIUM' ? '🟡 NORMAL' : '🟢 LOW'}\n` +
                `📝 *Laporan:* ${laporanText}\n` +
                `⏰ *Waktu:* ${new Date().toLocaleString('id-ID')}\n` +
                `━━━━━━━━━━━━━━━━\n\n` +
                `Tim teknisi kami akan segera menangani laporan ini.\n` +
                `Anda dapat cek status dengan: *cektiket ${ticketId}*\n\n` +
                `Terima kasih. 🙏`;
            
            try {
                let phoneJid = user.phone_number.trim();
                if (!phoneJid.endsWith('@s.whatsapp.net')) {
                    if (phoneJid.startsWith('0')) {
                        phoneJid = `62${phoneJid.substring(1)}@s.whatsapp.net`;
                    } else if (phoneJid.startsWith('62')) {
                        phoneJid = `${phoneJid}@s.whatsapp.net`;
                    } else {
                        phoneJid = `62${phoneJid}@s.whatsapp.net`;
                    }
                }
                await global.raf.sendMessage(phoneJid, { text: customerMsg });
            } catch (err) {
                console.error('[ADMIN_CREATE_TICKET] Failed to send WhatsApp to customer:', err);
            }
        }
        
        // NOTIFY ALL TEKNISI (like WhatsApp bot does)
        const teknisiAccounts = global.accounts.filter(acc => acc.role === 'teknisi' && acc.phone_number && acc.phone_number.trim() !== '');
        const waktuLaporFormatted = new Date(newTicket.createdAt).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta' });
        
        const urgentIcon = newTicket.priority === 'HIGH' ? '🚨' : newTicket.priority === 'MEDIUM' ? '📢' : '📌';
        const messageToTeknisi = `${urgentIcon} *TIKET BARU DARI ADMIN*\n\n` +
            `━━━━━━━━━━━━━━━━\n` +
            `📋 ID Tiket: *${ticketId}*\n` +
            `⚡ Prioritas: ${newTicket.priority === 'HIGH' ? '🔴 URGENT' : newTicket.priority === 'MEDIUM' ? '🟡 NORMAL' : '🟢 LOW'}\n` +
            `🏷️ Tipe: ${issueType || 'GENERAL'}\n` +
            `━━━━━━━━━━━━━━━━\n\n` +
            `*Informasi Pelanggan:*\n` +
            `👤 Nama: ${user.name || 'N/A'}\n` +
            `📱 No: ${user.phone_number || 'N/A'}\n` +
            `📍 Alamat: ${user.address || 'N/A'}\n` +
            `📦 Paket: ${user.subscription || 'N/A'}\n` +
            `${user.pppoe_username ? `🌐 PPPoE: ${user.pppoe_username}\n` : ''}` +
            `\n*Isi Laporan:*\n${laporanText}\n\n` +
            `⏰ Waktu: ${waktuLaporFormatted}\n` +
            `👤 Dibuat oleh: Admin ${req.user.username}\n\n` +
            `━━━━━━━━━━━━━━━━\n` +
            `*LANGKAH SELANJUTNYA:*\n\n` +
            `1️⃣ Proses tiket: *proses ${ticketId}*\n` +
            `2️⃣ Mulai perjalanan: *otw ${ticketId}*\n` +
            `3️⃣ Sampai lokasi: *sampai ${ticketId}*\n\n` +
            `Mohon segera ditangani. Terima kasih! 🙏`;
        
        // Send to all teknisi
        for (const teknisi of teknisiAccounts) {
            let teknisiJid = teknisi.phone_number.trim();
            if (!teknisiJid.endsWith('@s.whatsapp.net')) {
                if (teknisiJid.startsWith('0')) {
                    teknisiJid = `62${teknisiJid.substring(1)}@s.whatsapp.net`;
                } else if (teknisiJid.startsWith('62')) {
                    teknisiJid = `${teknisiJid}@s.whatsapp.net`;
                } else {
                    teknisiJid = `62${teknisiJid}@s.whatsapp.net`;
                }
            }
            try {
                await global.raf.sendMessage(teknisiJid, { text: messageToTeknisi });
                await new Promise(resolve => setTimeout(resolve, 1000)); // Delay to prevent spam
            } catch (err) {
                console.error(`[ADMIN_CREATE_TICKET] Failed to notify teknisi ${teknisi.username}:`, err);
            }
        }
        
        return res.json({
            status: 200,
            message: 'Tiket berhasil dibuat dan teknisi telah dinotifikasi',
            data: newTicket
        });
    } catch (error) {
        console.error('[API_ADMIN_TICKET_CREATE_ERROR]', error);
        return res.status(500).json({
            status: 500,
            message: 'Terjadi kesalahan saat membuat tiket',
            error: error.message
        });
    }
});

// POST /api/ticket/create - Teknisi create ticket (SAME logic as admin)
router.post('/ticket/create', ensureAuthenticatedStaff, async (req, res) => {
    try {
        const { customerUserId, laporanText, priority, issueType } = req.body;
        
        if (!customerUserId || !laporanText) {
            return res.status(400).json({
                status: 400,
                message: 'User ID dan laporan harus diisi'
            });
        }
        
        // Find the user
        const user = global.users.find(u => u.id === parseInt(customerUserId));
        if (!user) {
            return res.status(404).json({
                status: 404,
                message: 'Pelanggan tidak ditemukan'
            });
        }
        
        // Generate ticket ID (consistent with WhatsApp bot)
        const ticketId = generateTicketId(7);
        
        // Create ticket with SAME structure as WhatsApp bot
        const newTicket = {
            ticketId: ticketId,
            pelangganUserId: user.id,
            pelangganId: user.phone_number ? `${user.phone_number}@s.whatsapp.net` : '',
            pelangganName: user.name || user.username || 'Customer',
            pelangganPhone: user.phone_number || '',
            pelangganAddress: user.address || '',
            pelangganSubscription: user.subscription || 'Tidak terinfo',
            pelangganDataSystem: {
                id: user.id,
                name: user.name,
                address: user.address,
                subscription: user.subscription,
                pppoe_username: user.pppoe_username
            },
            laporanText: laporanText,
            status: 'baru',
            priority: priority || 'MEDIUM',
            issueType: issueType || 'GENERAL',
            createdAt: new Date().toISOString(),
            createdBy: req.user.username,
            createdByRole: req.user.role,  // Track who created (admin/teknisi)
            deviceOnline: null,
            troubleshootingDone: false,
            assignedTeknisiId: req.user.role === 'teknisi' ? req.user.id : null,
            assignedTeknisiName: req.user.role === 'teknisi' ? req.user.username : null,
            processingStartedAt: null,
            processedByTeknisiId: null,
            processedByTeknisiName: null,
            resolvedAt: null,
            resolvedByTeknisiId: null,
            resolvedByTeknisiName: null,
            cancellationReason: null,
            cancellationTimestamp: null,
            cancelledBy: null
        };
        
        // Add to reports
        global.reports.push(newTicket);
        
        // Save to database
        saveReports(global.reports);
        
        // Notify customer via WhatsApp
        if (global.raf && user.phone_number) {
            const creatorInfo = req.user.role === 'teknisi' ? `Teknisi ${req.user.username}` : `Admin ${req.user.username}`;
            const customerMsg = `✨ *TIKET LAPORAN DIBUAT* ✨\n\n` +
                `Halo ${user.name || 'Pelanggan'},\n\n` +
                `${creatorInfo} telah membuat tiket laporan untuk Anda:\n\n` +
                `━━━━━━━━━━━━━━━━\n` +
                `📋 *ID Tiket:* ${ticketId}\n` +
                `⚡ *Prioritas:* ${priority === 'HIGH' ? '🔴 URGENT' : priority === 'MEDIUM' ? '🟡 NORMAL' : '🟢 LOW'}\n` +
                `📝 *Laporan:* ${laporanText}\n` +
                `⏰ *Waktu:* ${new Date().toLocaleString('id-ID')}\n` +
                `━━━━━━━━━━━━━━━━\n\n` +
                `Tim teknisi kami akan segera menangani laporan ini.\n` +
                `Anda dapat cek status dengan: *cektiket ${ticketId}*\n\n` +
                `Terima kasih. 🙏`;
            
            try {
                let phoneJid = user.phone_number.trim();
                if (!phoneJid.endsWith('@s.whatsapp.net')) {
                    if (phoneJid.startsWith('0')) {
                        phoneJid = `62${phoneJid.substring(1)}@s.whatsapp.net`;
                    } else if (phoneJid.startsWith('62')) {
                        phoneJid = `${phoneJid}@s.whatsapp.net`;
                    } else {
                        phoneJid = `62${phoneJid}@s.whatsapp.net`;
                    }
                }
                await global.raf.sendMessage(phoneJid, { text: customerMsg });
            } catch (err) {
                console.error('[CREATE_TICKET] Failed to send WhatsApp to customer:', err);
            }
        }
        
        // NOTIFY OTHER TEKNISI (not the creator)
        const teknisiAccounts = global.accounts.filter(acc => 
            acc.role === 'teknisi' && 
            acc.phone_number && 
            acc.phone_number.trim() !== '' &&
            acc.username !== req.user.username  // Don't notify creator
        );
        
        const waktuLaporFormatted = new Date(newTicket.createdAt).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta' });
        const urgentIcon = newTicket.priority === 'HIGH' ? '🚨' : newTicket.priority === 'MEDIUM' ? '📢' : '📌';
        const creatorInfo = req.user.role === 'teknisi' ? `Teknisi ${req.user.username}` : `Admin ${req.user.username}`;
        
        const messageToTeknisi = `${urgentIcon} *TIKET BARU*\n\n` +
            `━━━━━━━━━━━━━━━━\n` +
            `📋 ID Tiket: *${ticketId}*\n` +
            `⚡ Prioritas: ${newTicket.priority === 'HIGH' ? '🔴 URGENT' : newTicket.priority === 'MEDIUM' ? '🟡 NORMAL' : '🟢 LOW'}\n` +
            `🏷️ Tipe: ${issueType || 'GENERAL'}\n` +
            `━━━━━━━━━━━━━━━━\n\n` +
            `*Informasi Pelanggan:*\n` +
            `👤 Nama: ${user.name || 'N/A'}\n` +
            `📱 No: ${user.phone_number || 'N/A'}\n` +
            `📍 Alamat: ${user.address || 'N/A'}\n` +
            `📦 Paket: ${user.subscription || 'N/A'}\n` +
            `${user.pppoe_username ? `🌐 PPPoE: ${user.pppoe_username}\n` : ''}` +
            `\n*Isi Laporan:*\n${laporanText}\n\n` +
            `⏰ Waktu: ${waktuLaporFormatted}\n` +
            `👤 Dibuat oleh: ${creatorInfo}\n\n` +
            `━━━━━━━━━━━━━━━━\n` +
            `*LANGKAH SELANJUTNYA:*\n\n` +
            `1️⃣ Proses tiket: *proses ${ticketId}*\n` +
            `2️⃣ Mulai perjalanan: *otw ${ticketId}*\n` +
            `3️⃣ Sampai lokasi: *sampai ${ticketId}*\n\n` +
            `Mohon segera ditangani. Terima kasih! 🙏`;
        
        // Send to other teknisi
        for (const teknisi of teknisiAccounts) {
            let teknisiJid = teknisi.phone_number.trim();
            if (!teknisiJid.endsWith('@s.whatsapp.net')) {
                if (teknisiJid.startsWith('0')) {
                    teknisiJid = `62${teknisiJid.substring(1)}@s.whatsapp.net`;
                } else if (teknisiJid.startsWith('62')) {
                    teknisiJid = `${teknisiJid}@s.whatsapp.net`;
                } else {
                    teknisiJid = `62${teknisiJid}@s.whatsapp.net`;
                }
            }
            try {
                await global.raf.sendMessage(teknisiJid, { text: messageToTeknisi });
                await new Promise(resolve => setTimeout(resolve, 1000)); // Delay to prevent spam
            } catch (err) {
                console.error(`[CREATE_TICKET] Failed to notify teknisi ${teknisi.username}:`, err);
            }
        }
        
        return res.json({
            status: 200,
            message: 'Tiket berhasil dibuat dan telah dinotifikasi',
            data: newTicket
        });
    } catch (error) {
        console.error('[API_TICKET_CREATE_ERROR]', error);
        return res.status(500).json({
            status: 500,
            message: 'Terjadi kesalahan saat membuat tiket',
            error: error.message
        });
    }
});

// POST /api/admin/ticket/cancel - Cancel a ticket (admin only)
router.post('/admin/ticket/cancel', ensureAdmin, async (req, res) => {
    try {
        const { ticketId, cancellationReason } = req.body;
        
        if (!ticketId) {
            return res.status(400).json({
                status: 400,
                message: 'ID tiket harus diisi'
            });
        }
        
        // Find the ticket
        const reportIndex = global.reports.findIndex(r => r.id === ticketId);
        if (reportIndex === -1) {
            return res.status(404).json({
                status: 404,
                message: 'Tiket tidak ditemukan'
            });
        }
        
        const report = global.reports[reportIndex];
        
        // Update ticket status
        report.status = 'dibatalkan';
        report.cancelled_by = req.user.username;
        report.cancelled_at = new Date().toISOString();
        if (cancellationReason) {
            report.cancellation_reason = cancellationReason;
        }
        
        // Save to database
        saveReports(global.reports);
        
        // Get user details
        const user = global.users.find(u => u.id === report.user_id);
        
        // Send notification to customer via WhatsApp if possible
        if (global.raf && user && user.phone) {
            const customerMsg = `Halo ${user.name},\n\n` +
                `Tiket laporan Anda dengan ID *${report.ticketId || report.id}* telah dibatalkan oleh admin.\n\n` +
                (cancellationReason ? `*Alasan:* ${cancellationReason}\n\n` : '') +
                `Jika Anda masih mengalami kendala, silakan buat laporan baru atau hubungi kami.\n\n` +
                `Terima kasih. 🙏`;
            
            try {
                const phoneNumber = user.phone.replace(/[^0-9]/g, '');
                const jid = phoneNumber.includes('@s.whatsapp.net') ? phoneNumber : `${phoneNumber}@s.whatsapp.net`;
                await global.raf.sendMessage(jid, { text: customerMsg });
            } catch (err) {
                console.error('[ADMIN_CANCEL_TICKET] Failed to send WhatsApp to customer:', err);
            }
        }
        
        return res.json({
            status: 200,
            message: 'Tiket berhasil dibatalkan'
        });
    } catch (error) {
        console.error('[API_ADMIN_TICKET_CANCEL_ERROR]', error);
        return res.status(500).json({
            status: 500,
            message: 'Terjadi kesalahan saat membatalkan tiket'
        });
    }
});

module.exports = router;
