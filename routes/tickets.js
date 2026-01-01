const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { saveReports, loadJSON, saveJSON } = require('../lib/database');
const { renderTemplate } = require('../lib/templating');
const { generateOTP } = require('../lib/otp-generator');
const { logActivity } = require('../lib/activity-logger');
const { rateLimit } = require('../lib/security');
const { withLock } = require('../lib/request-lock');

const router = express.Router();
const reportsDbPath = path.join(__dirname, '..', 'database', 'reports.json');

// Debug flag for verbose logging
const DEBUG = process.env.TICKET_DEBUG === 'true' || false;

// Import working hours helper
const { isWithinWorkingHours, getNextAvailableMessage, getResponseTimeMessage } = require('../lib/working-hours-helper');

/**
 * Configure multer for photo uploads
 * Store in uploads/tickets/YEAR/MONTH/TICKET_ID/ (structured, consistent with reports)
 */
const { getTicketsUploadsPathByTicket, getReportsUploadsPath } = require('../lib/path-helper');

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        // PENTING: req.body mungkin belum tersedia saat destination dipanggil untuk multipart/form-data
        // Gunakan query parameter atau header sebagai fallback
        const ticketId = req.query?.ticketId || req.body?.ticketId || req.headers['x-ticket-id'] || 'UNKNOWN';
        
        // Get year and month from ticket creation date (if available) or current date
        let year, month;
        const ticketCreatedAt = req.query?.ticketCreatedAt || req.body?.ticketCreatedAt || req.headers['x-ticket-created-at'];
        if (ticketCreatedAt) {
            const ticketDate = new Date(ticketCreatedAt);
            year = ticketDate.getFullYear();
            month = String(ticketDate.getMonth() + 1).padStart(2, '0');
        } else {
            // Fallback to current date if ticket date not available
            const now = new Date();
            year = now.getFullYear();
            month = String(now.getMonth() + 1).padStart(2, '0');
        }
        
        // Use structured path: uploads/tickets/YEAR/MONTH/TICKET_ID/
        const uploadDir = getTicketsUploadsPathByTicket(year, month, ticketId, __dirname);
        
        // Create directory if it doesn't exist
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        // Generate unique filename: photo_TIMESTAMP_RANDOM.ext
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(7);
        const ext = path.extname(file.originalname);
        cb(null, `photo_${timestamp}_${random}${ext}`);
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

// generateOTP is imported from ../lib/otp-generator

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
 * FIXED: Proper duplicate tracking to prevent double notifications
 */
async function notifyAllCustomerNumbers(ticket, message) {
    if (!global.raf || !global.raf.sendMessage) {
        const error = new Error('WhatsApp not connected');
        console.error('[NOTIFY_CUSTOMER] WhatsApp not connected - cannot send notification');
        throw error; // Throw error so caller can handle it
    }
    
    const sentNumbers = new Set(); // Track actual phone numbers (not JIDs)
    const customerJid = ticket.pelangganId;
    let hasError = false;
    let lastError = null;
    
    // 1. Send to main customer (pelangganId)
    // PENTING: Cek connection state dan gunakan error handling sesuai rules
    if (customerJid && global.whatsappConnectionState === 'open' && global.raf && global.raf.sendMessage) {
        try {
            await global.raf.sendMessage(customerJid, { text: message });
            if (DEBUG) console.log(`[NOTIFY_CUSTOMER] Sent to main customer: ${customerJid}`);
            
            // Track the actual phone number that received the message
            if (customerJid.endsWith('@lid')) {
                // For @lid, track the first phone number as main (to avoid duplicate)
                if (ticket.pelangganPhone) {
                    const phones = ticket.pelangganPhone.split('|').map(p => p.trim()).filter(p => p);
                    if (phones.length > 0) {
                        const mainPhone = phones[0].replace(/\D/g, '');
                        sentNumbers.add(mainPhone);
                        if (DEBUG) console.log(`[NOTIFY_CUSTOMER] Tracking main phone: ${mainPhone} (via @lid)`);
                    }
                }
            } else {
                // For regular format, extract the number
                const mainPhone = customerJid.replace(/\D/g, '');
                sentNumbers.add(mainPhone);
                if (DEBUG) console.log(`[NOTIFY_CUSTOMER] Tracking main phone: ${mainPhone}`);
            }
        } catch (err) {
            hasError = true;
            lastError = err;
            console.error('[SEND_MESSAGE_ERROR]', {
                customerJid,
                error: err.message
            });
            console.error(`[NOTIFY_CUSTOMER] Failed to notify main customer:`, err.message);
        }
    } else if (customerJid) {
        console.warn('[SEND_MESSAGE_SKIP] WhatsApp not connected, skipping send to', customerJid);
    }
    
    // 2. Send to ALL registered phone numbers (skip duplicates)
    if (ticket.pelangganPhone) {
        const phones = ticket.pelangganPhone.split('|').map(p => p.trim()).filter(p => p);
        if (DEBUG) console.log(`[NOTIFY_CUSTOMER] Processing ${phones.length} phone numbers`);
        
        for (const phone of phones) {
            const phoneNumber = phone.replace(/\D/g, '');
            
            // Skip if this phone number was already notified
            if (sentNumbers.has(phoneNumber)) {
                if (DEBUG) console.log(`[NOTIFY_CUSTOMER] Skipping duplicate: ${phoneNumber}`);
                continue;
            }
            
            const phoneJid = normalizePhoneToJID(phone);
            if (!phoneJid) {
                if (DEBUG) console.log(`[NOTIFY_CUSTOMER] Invalid phone number: ${phone}`);
                continue;
            }
            
            // PENTING: Cek connection state dan gunakan error handling sesuai rules untuk multiple recipients
            if (global.whatsappConnectionState === 'open' && global.raf && global.raf.sendMessage) {
                try {
                    await global.raf.sendMessage(phoneJid, { text: message });
                    if (DEBUG) console.log(`[NOTIFY_CUSTOMER] Sent to additional number: ${phoneJid}`);
                    sentNumbers.add(phoneNumber);
                } catch (err) {
                    hasError = true;
                    lastError = err;
                    console.error('[SEND_MESSAGE_ERROR]', {
                        phoneJid,
                        error: err.message
                    });
                    console.error(`[NOTIFY_CUSTOMER] Failed to notify ${phoneJid}:`, err.message);
                    // Continue to next phone number
                }
            } else {
                console.warn('[SEND_MESSAGE_SKIP] WhatsApp not connected, skipping send to', phoneJid);
            }
        }
    }
    
    if (DEBUG) console.log(`[NOTIFY_CUSTOMER] Notification sent to ${sentNumbers.size} unique recipients`);
    
    // If no messages were sent and there was an error, throw error
    if (sentNumbers.size === 0 && hasError && lastError) {
        throw lastError;
    }
    
    // If no messages were sent and no error, it means no valid recipients
    if (sentNumbers.size === 0) {
        const error = new Error('No valid recipients found');
        console.error('[NOTIFY_CUSTOMER] No valid recipients found');
        throw error;
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
            if (DEBUG) console.log('[BROADCAST] WhatsApp not connected, skipping broadcast');
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
        // PENTING: Cek connection state dan gunakan error handling sesuai rules untuk multiple recipients
        for (const number of recipients) {
            const jid = number.includes('@s.whatsapp.net') ? number : `${number}@s.whatsapp.net`;
            if (global.whatsappConnectionState === 'open' && global.raf && global.raf.sendMessage) {
                try {
                    await global.raf.sendMessage(jid, { text: message });
                    if (DEBUG) console.log(`[BROADCAST] Sent to ${number}`);
                } catch (err) {
                    console.error('[SEND_MESSAGE_ERROR]', {
                        jid,
                        error: err.message
                    });
                    console.error(`[BROADCAST] Failed to send to ${number}:`, err.message);
                    // Continue to next recipient
                }
            } else {
                console.warn('[SEND_MESSAGE_SKIP] WhatsApp not connected, skipping send to', jid);
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
            // Only log if there are tickets or if it's an error case
            // Removed verbose logging
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
router.post('/ticket/process', ensureAuthenticatedStaff, rateLimit('ticket-process', 10, 60000), async (req, res) => {
    try {
        const { ticketId } = req.body;
        
        if (!ticketId) {
            return res.status(400).json({
                status: 400,
                message: 'ID tiket harus diisi'
            });
        }
        
        // Use lock to prevent concurrent processing of same ticket
        return await withLock(`ticket-process-${ticketId}`, async () => {
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
            if (DEBUG) console.log(`[TICKET_PROCESS] Ticket ${ticketId} current status: "${ticket.status}"`);
            
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
            
            if (DEBUG) console.log(`[TICKET_PROCESS] Teknisi found: ${teknisi.name || teknisi.username} (ID: ${teknisi.id})`);
            
            // Generate OTP (same as WhatsApp bot)
            const otp = generateOTP();
            if (DEBUG) console.log(`[TICKET_PROCESS] Generated OTP: ${otp} for ticket ${ticketId}`);
            
            // Update ticket with all required fields (following WhatsApp bot pattern)
            ticket.status = 'process';  // Use 'process' status like in bot
            ticket.teknisiId = req.user.id || req.user.username;  // Store teknisi identifier
            ticket.teknisiName = teknisi.name || teknisi.username;  // IMPORTANT: Use name, not username
            ticket.teknisiPhone = teknisi.phone_number;  // For customer contact
            ticket.otp = otp;  // Store OTP for verification later
            ticket.processedAt = new Date().toISOString();
            ticket.processedBy = req.user.username;  // Keep for backward compatibility
            ticket.otpAttempts = 0;  // Initialize OTP attempt counter
            ticket.otpAttemptsResetAt = Date.now();  // Track when attempts reset
            
            // Ensure ticketId field exists (for consistency with WhatsApp bot)
            if (!ticket.ticketId) {
                ticket.ticketId = ticket.id;
            }
            
            // Save to database
            saveReports(global.reports);
            if (DEBUG) console.log(`[TICKET_PROCESS] Ticket ${ticketId} updated with status=process, OTP=${otp}`);
            
            // Log activity
            try {
                await logActivity({
                    userId: req.user.id,
                    username: req.user.username,
                    role: req.user.role,
                    actionType: 'UPDATE',
                    resourceType: 'ticket',
                    resourceId: ticket.ticketId || ticket.id,
                    resourceName: `Ticket ${ticket.ticketId || ticket.id}`,
                    description: `Assigned ticket ${ticket.ticketId || ticket.id} to teknisi ${teknisi.name || teknisi.username}`,
                    oldValue: { status: ticket.status, teknisiId: null },
                    newValue: { status: 'process', teknisiId: teknisi.id, teknisiName: teknisi.name || teknisi.username },
                    ipAddress: req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'],
                    userAgent: req.headers['user-agent']
                });
            } catch (logErr) {
                console.error('[ACTIVITY_LOG_ERROR] Failed to log ticket process:', logErr);
            }
            
            // Get customer (user) details - support both field names for backward compatibility
            const userId = ticket.pelangganUserId || ticket.user_id;
            if (DEBUG) console.log(`[TICKET_PROCESS] Looking for user with ID: ${userId}`);
            
            const user = global.users.find(u => u.id === userId);
            
            if (!user) {
                console.error(`[TICKET_PROCESS] User not found. Tried pelangganUserId: ${ticket.pelangganUserId}, user_id: ${ticket.user_id}`);
                console.error(`[TICKET_PROCESS] Available users:`, global.users.length, 'users in database');
                return res.status(404).json({
                    status: 404,
                    message: 'Data pelanggan tidak ditemukan. Pastikan pelanggan terdaftar di sistem.'
                });
            }
            
            if (DEBUG) console.log(`[TICKET_PROCESS] User found: ${user.name} (ID: ${user.id})`);
            
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
            
            // Prepare customer notification using template
            const customerTemplateData = {
                ticket_id: ticket.ticketId || ticket.id,
                teknisi_name: teknisi.name || teknisi.username || 'Teknisi',
                teknisi_phone_section: teknisiPhone ? `📱 Kontak: wa.me/${teknisiPhone}\n` : '',
                otp: otp
            };
            
            const customerMessage = renderTemplate('ticket_process_customer', customerTemplateData);
            
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
        });
    } catch (error) {
        console.error('[API_TICKET_PROCESS_ERROR]', error);
        return res.status(500).json({
            status: 500,
            message: error.message === `Could not acquire lock for ticket-process-${req.body.ticketId}`
                ? 'Tiket sedang diproses. Silakan coba lagi.'
                : 'Terjadi kesalahan saat memproses tiket',
            error: error.message
        });
    }
});

// POST /api/ticket/otw - Teknisi on the way (OTW)
// Follows WhatsApp bot workflow: handleOTW()
router.post('/ticket/otw', ensureAuthenticatedStaff, rateLimit('ticket-otw', 10, 60000), async (req, res) => {
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
        if (DEBUG) console.log(`[TICKET_OTW] Ticket ${ticketId} status updated to OTW`);
        
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
        
        // Prepare customer notification using template
        const customerTemplateData = {
            ticket_id: ticket.ticketId || ticket.id,
            teknisi_name: teknisi.name || teknisi.username || 'Teknisi',
            teknisi_phone_section: teknisiPhone ? `📱 Kontak: wa.me/${teknisiPhone}\n` : '',
            estimasi_waktu: '30-60 menit',
            lokasi_info: location ? `Update lokasi: ${location}` : 'Lokasi akan diupdate',
            otp: ticket.otp || 'XXXXXX'  // Include OTP like WhatsApp bot does
        };
        
        const customerMessage = renderTemplate('ticket_otw_customer', customerTemplateData);
        
        // Send to ALL customer phone numbers
        let notificationSent = false;
        let notificationError = null;
        
        try {
            await notifyAllCustomerNumbers(ticket, customerMessage);
            notificationSent = true;
            if (DEBUG) console.log(`[TICKET_OTW] Customer notification sent successfully for ticket ${ticketId}`);
        } catch (notifyError) {
            notificationError = notifyError.message;
            console.error(`[TICKET_OTW] Failed to send customer notification:`, notifyError);
            // Continue anyway - ticket status is updated, just notification failed
        }
        
        return res.json({
            status: 200,
            message: notificationSent ? 'Status OTW berhasil diupdate. Pelanggan telah dinotifikasi.' : 'Status OTW berhasil diupdate, namun notifikasi pelanggan gagal.',
            data: {
                ticketId: ticket.ticketId || ticket.id,
                status: 'otw',
                teknisiName: teknisi.name || teknisi.username,
                customerNotified: notificationSent,
                notificationError: notificationError || undefined
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
router.post('/ticket/arrived', ensureAuthenticatedStaff, rateLimit('ticket-arrived', 10, 60000), async (req, res) => {
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
        if (DEBUG) console.log(`[TICKET_ARRIVED] Ticket ${ticketId} status updated to arrived, OTP: ${ticket.otp}`);
        
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
        
        // Prepare customer notification using template
        const customerTemplateData = {
            ticket_id: ticket.ticketId || ticket.id,
            teknisi_name: teknisi.name || teknisi.username || 'Teknisi',
            teknisi_phone_section: teknisiPhone ? `📱 Kontak: wa.me/${teknisiPhone}\n` : '',
            otp: ticket.otp || 'XXXXXX'  // Include OTP like WhatsApp bot does
        };
        
        const customerMessage = renderTemplate('ticket_arrived_customer', customerTemplateData);
        
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
// IMPORTANT: OTP attempt limit to prevent brute force
router.post('/ticket/verify-otp', ensureAuthenticatedStaff, rateLimit('ticket-verify-otp', 10, 60000), async (req, res) => {
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
        
        // OTP Attempt Limit: Prevent brute force attacks
        const MAX_OTP_ATTEMPTS = 5;
        const OTP_ATTEMPT_RESET_WINDOW = 15 * 60 * 1000; // 15 minutes
        
        // Initialize OTP attempts if not exists
        if (ticket.otpAttempts === undefined) {
            ticket.otpAttempts = 0;
            ticket.otpAttemptsResetAt = Date.now();
        }
        
        // Reset attempts if window has passed
        const now = Date.now();
        if (now - ticket.otpAttemptsResetAt > OTP_ATTEMPT_RESET_WINDOW) {
            ticket.otpAttempts = 0;
            ticket.otpAttemptsResetAt = now;
        }
        
        // Check if attempts exceeded
        if (ticket.otpAttempts >= MAX_OTP_ATTEMPTS) {
            const remainingTime = Math.ceil((OTP_ATTEMPT_RESET_WINDOW - (now - ticket.otpAttemptsResetAt)) / (60 * 1000));
            return res.status(429).json({
                status: 429,
                message: `Terlalu banyak percobaan verifikasi OTP. Coba lagi dalam ${remainingTime} menit atau minta OTP baru.`,
                data: {
                    attemptsUsed: ticket.otpAttempts,
                    maxAttempts: MAX_OTP_ATTEMPTS,
                    remainingTimeMinutes: remainingTime
                }
            });
        }
        
        // Verify OTP
        if (ticket.otp !== otp.toString().trim()) {
            // Increment attempt counter
            ticket.otpAttempts = (ticket.otpAttempts || 0) + 1;
            if (!ticket.otpAttemptsResetAt) {
                ticket.otpAttemptsResetAt = now;
            }
            saveReports(global.reports);
            
            const remainingAttempts = MAX_OTP_ATTEMPTS - ticket.otpAttempts;
            return res.status(400).json({
                status: 400,
                message: `Kode OTP salah! Minta kode yang benar dari pelanggan. (Percobaan ${ticket.otpAttempts}/${MAX_OTP_ATTEMPTS})`,
                data: {
                    attemptsUsed: ticket.otpAttempts,
                    maxAttempts: MAX_OTP_ATTEMPTS,
                    remainingAttempts: remainingAttempts
                }
            });
        }
        
        // OTP verified successfully - reset attempts
        ticket.otpAttempts = 0;
        ticket.otpAttemptsResetAt = null;
        
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
        
        // Save to database (OTP attempts already reset above)
        saveReports(global.reports);
        if (DEBUG) console.log(`[TICKET_VERIFY_OTP] Ticket ${ticketId} OTP verified, status updated to working`);
        
        // Prepare customer notification using template
        const customerTemplateData = {
            ticket_id: ticket.ticketId || ticket.id,
            teknisi_name: teknisi.name || teknisi.username || 'Teknisi'
        };
        
        const customerMessage = renderTemplate('ticket_working_customer', customerTemplateData);
        
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
router.post('/ticket/upload-photo', ensureAuthenticatedStaff, rateLimit('ticket-upload-photo', 20, 60000), upload.single('photo'), async (req, res) => {
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
        
        // Get category information from request (optional, for new categorized workflow)
        const category = req.body.category || null;
        const categoryLabel = req.body.categoryLabel || null;
        
        // Get year and month from ticket creation date for structured path
        const ticketDate = ticket.createdAt ? new Date(ticket.createdAt) : new Date();
        const year = ticketDate.getFullYear();
        const month = String(ticketDate.getMonth() + 1).padStart(2, '0');
        
        // Store photo info in BOTH fields for compatibility
        // Path uses new structured format: uploads/tickets/YEAR/MONTH/TICKET_ID/
        const photoInfo = {
            path: `/uploads/tickets/${year}/${month}/${ticketId}/${req.file.filename}`,  // Web-accessible path with structure
            filename: req.file.filename,
            uploadedAt: new Date().toISOString(),
            uploadedBy: req.user.username,
            size: req.file.size,
            // Add category if provided (for new categorized workflow)
            ...(category && { category, categoryLabel })
        };
        
        // Store in photos field (for web dashboard compatibility)
        ticket.photos.push(photoInfo);
        
        // ALSO store filename in teknisiPhotos (for WhatsApp bot compatibility)
        // BUT: Only if not already in photos to avoid duplicates
        // File is in uploads/tickets/ which is served by express.static at /uploads
        if (!ticket.teknisiPhotos.includes(req.file.filename)) {
            ticket.teknisiPhotos.push(req.file.filename);
        }
        
        // Save to database
        saveReports(global.reports);
        if (DEBUG) console.log(`[TICKET_UPLOAD_PHOTO] Photo uploaded for ticket ${ticketId}. Total: ${ticket.photos.length}`);
        
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
router.post('/ticket/complete', ensureAuthenticatedStaff, rateLimit('ticket-complete', 10, 60000), async (req, res) => {
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
        
        // Store old status for activity log
        const oldStatus = ticket.status;
        
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
        if (DEBUG) console.log(`[TICKET_COMPLETE] Ticket ${ticketId} completed. Duration: ${durationMinutes} min, Photos: ${ticket.photos.length}`);
        
        // Log activity
        try {
            await logActivity({
                userId: req.user.id,
                username: req.user.username,
                role: req.user.role,
                actionType: 'UPDATE',
                resourceType: 'ticket',
                resourceId: ticket.ticketId || ticket.id,
                resourceName: `Ticket ${ticket.ticketId || ticket.id}`,
                description: `Completed ticket ${ticket.ticketId || ticket.id} (duration: ${durationMinutes} min, photos: ${ticket.photos.length})`,
                oldValue: { status: oldStatus },
                newValue: { 
                    status: 'resolved', 
                    resolvedBy: teknisi.name || teknisi.username,
                    resolutionNotes: resolutionNotes || 'Selesai',
                    workDuration: durationMinutes,
                    photoCount: ticket.photos.length
                },
                ipAddress: req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'],
                userAgent: req.headers['user-agent']
            });
        } catch (logErr) {
            console.error('[ACTIVITY_LOG_ERROR] Failed to log ticket complete:', logErr);
        }
        
        // Prepare customer notification using template
        const customerTemplateData = {
            ticket_id: ticket.ticketId || ticket.id,
            teknisi_name: teknisi.name || teknisi.username || 'Teknisi',
            durasi: durationMinutes,
            jumlah_foto: ticket.photos.length,
            catatan_section: resolutionNotes ? `📝 Catatan: ${resolutionNotes}` : '',
            nama_wifi: global.config.namaWifi || 'WiFi Service'
        };
        
        const customerMessage = renderTemplate('ticket_completed_customer', customerTemplateData);
        
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
        
        // Find the ticket - cek dengan ticketId atau id (untuk kompatibilitas)
        const reportIndex = global.reports.findIndex(r => 
            r.ticketId === ticketId || r.id === ticketId
        );
        if (reportIndex === -1) {
            return res.status(404).json({
                status: 404,
                message: 'Tiket tidak ditemukan'
            });
        }
        
        const report = global.reports[reportIndex];
        
        // Update ticket status - Standardisasi status ke 'completed'
        report.status = 'completed';
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
        // PENTING: Cek connection state dan gunakan error handling sesuai rules
        if (global.whatsappConnectionState === 'open' && global.raf && global.raf.sendMessage && user && user.phone) {
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
                console.error('[SEND_MESSAGE_ERROR]', {
                    jid: phoneNumber + '@s.whatsapp.net',
                    error: err.message
                });
                console.error('[TICKET_RESOLVE] Failed to send WhatsApp to customer:', err);
            }
        } else if (user && user.phone) {
            console.warn('[SEND_MESSAGE_SKIP] WhatsApp not connected, skipping send to customer');
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
        
        // Check working hours before creating ticket
        const workingStatus = isWithinWorkingHours();
        const nextAvailable = getNextAvailableMessage();
        
        // If outside working hours, prepare warning message
        let workingHoursWarning = null;
        if (!workingStatus.isWithinHours) {
            workingHoursWarning = {
                isOutsideHours: true,
                message: workingStatus.message || 'Di luar jam kerja',
                nextAvailable: nextAvailable,
                dayType: workingStatus.dayType
            };
        }
        
        // Generate ticket ID (consistent with WhatsApp bot)
        const ticketId = generateTicketId(7);
        
        // Extract first phone number for pelangganId (JID format)
        // user.phone_number can contain multiple numbers separated by |
        let primaryPhone = '';
        if (user.phone_number) {
            const phones = user.phone_number.split('|').map(p => p.trim()).filter(p => p);
            if (phones.length > 0) {
                primaryPhone = phones[0];
            }
        }
        
        // Create ticket with SAME structure as WhatsApp bot
        const newTicket = {
            ticketId: ticketId,  // Use ticketId, not id
            pelangganUserId: user.id,
            pelangganId: primaryPhone ? `${primaryPhone}@s.whatsapp.net` : '',
            pelangganName: user.name || user.username || 'Customer',
            pelangganPhone: user.phone_number || '', // Keep all numbers with | separator
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
            createdBy: req.user.name || req.user.username,
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
        
        // Log activity (admin create ticket)
        try {
            await logActivity({
                userId: req.user.id,
                username: req.user.username,
                role: req.user.role,
                actionType: 'CREATE',
                resourceType: 'ticket',
                resourceId: ticketId,
                resourceName: `Ticket ${ticketId}`,
                description: `Created ticket ${ticketId} for user ${user.name} (${issueType || 'GENERAL'}, ${priority || 'MEDIUM'})`,
                oldValue: null,
                newValue: {
                    ticketId: ticketId,
                    customer: user.name,
                    issueType: issueType || 'GENERAL',
                    priority: priority || 'MEDIUM',
                    status: 'baru'
                },
                ipAddress: req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'],
                userAgent: req.headers['user-agent']
            });
        } catch (logErr) {
            console.error('[ACTIVITY_LOG_ERROR] Failed to log ticket create:', logErr);
        }
        
        // Prepare response message based on working hours
        let responseMessage = 'Tiket berhasil dibuat. Notifikasi sedang dikirim...';
        if (workingHoursWarning) {
            responseMessage = `Tiket berhasil dibuat. ${workingHoursWarning.message}. ${workingHoursWarning.nextAvailable || 'Teknisi akan memproses pada jam kerja berikutnya.'}`;
        }
        
        // Send response immediately (don't wait for notifications)
        // PENTING: Pastikan ticketId ada di response untuk frontend (explicit)
        res.json({
            status: 200,
            message: responseMessage,
            data: {
                ...newTicket,
                ticketId: ticketId,  // Explicit ticketId untuk memastikan frontend mendapatkannya
                id: ticketId  // Juga sebagai id untuk kompatibilitas
            },
            workingHours: {
                isWithinHours: workingStatus.isWithinHours,
                warning: workingHoursWarning,
                nextAvailable: nextAvailable
            }
        });
        
        // NOTIFY CUSTOMER VIA WHATSAPP (non-blocking, don't wait)
        // Send to ALL phone numbers if user has multiple numbers
        if (global.raf && user.phone_number && global.whatsappConnectionState === 'open') {
            // Add working hours info to customer message if outside hours
            let workingHoursNotice = '';
            if (workingHoursWarning) {
                const config = global.config.teknisiWorkingHours;
                workingHoursNotice = `\n\n⏰ *PERHATIAN:*\n${config?.outOfHoursMessage || 'Laporan Anda diterima di luar jam kerja. Akan diproses pada jam kerja berikutnya.'}\n${nextAvailable ? `\n${nextAvailable}` : ''}`;
            }
            
            const adminName = req.user.name || req.user.username;
            const customerMsg = `✨ *TIKET LAPORAN DIBUAT OLEH ADMIN* ✨\n\n` +
                `Halo ${user.name || 'Pelanggan'},\n\n` +
                `Admin ${adminName} telah membuat tiket laporan untuk Anda:\n\n` +
                `━━━━━━━━━━━━━━━━\n` +
                `📋 *ID Tiket:* ${ticketId}\n` +
                `⚡ *Prioritas:* ${priority === 'HIGH' ? '🔴 URGENT' : priority === 'MEDIUM' ? '🟡 NORMAL' : '🟢 LOW'}\n` +
                `📝 *Laporan:* ${laporanText}\n` +
                `⏰ *Waktu:* ${new Date().toLocaleString('id-ID')}\n` +
                `━━━━━━━━━━━━━━━━\n\n` +
                `Tim teknisi kami akan segera menangani laporan ini.\n` +
                `Anda dapat cek status dengan: *cektiket ${ticketId}*` +
                workingHoursNotice +
                `\n\nTerima kasih. 🙏`;
            
            // Send notification asynchronously (don't block)
            (async () => {
                try {
                    // Double-check connection before sending
                    if (global.whatsappConnectionState !== 'open') {
                        console.warn(`[ADMIN_CREATE_TICKET] WhatsApp not connected (state: ${global.whatsappConnectionState}), skipping customer notification`);
                        return;
                    }
                    
                    // Split phone numbers (can contain multiple numbers with | separator)
                    const phoneNumbers = user.phone_number.split('|').map(p => p.trim()).filter(p => p);
                    let successCount = 0;
                    let errorCount = 0;
                    
                    for (const phone of phoneNumbers) {
                        try {
                            // Format phone to JID
                            let phoneJid = phone.trim();
                            if (!phoneJid.endsWith('@s.whatsapp.net')) {
                                if (phoneJid.startsWith('0')) {
                                    phoneJid = `62${phoneJid.substring(1)}@s.whatsapp.net`;
                                } else if (phoneJid.startsWith('62')) {
                                    phoneJid = `${phoneJid}@s.whatsapp.net`;
                                } else {
                                    phoneJid = `62${phoneJid}@s.whatsapp.net`;
                                }
                            }
                            
                            const result = await global.raf.sendMessage(phoneJid, { text: customerMsg });
                            
                            // Check if result indicates error
                            if (result && result.status === 'error') {
                                console.warn(`[ADMIN_CREATE_TICKET] Failed to send to ${phoneJid}: ${result.error}`);
                                errorCount++;
                            } else {
                                if (DEBUG) console.log(`[ADMIN_CREATE_TICKET] Customer notification sent: ${phoneJid}`);
                                successCount++;
                            }
                            
                            // Small delay between multiple numbers
                            if (phoneNumbers.length > 1 && phone !== phoneNumbers[phoneNumbers.length - 1]) {
                                await new Promise(resolve => setTimeout(resolve, 500));
                            }
                        } catch (err) {
                            errorCount++;
                            const errorMsg = err.message || err.toString();
                            // Don't log USync errors as critical (they're handled by wrapper)
                            if (errorMsg.includes('attrs') || errorMsg.includes('USyncQuery')) {
                                console.warn(`[ADMIN_CREATE_TICKET] USync error for ${phone} (handled): ${errorMsg.substring(0, 100)}`);
                            } else {
                                console.error(`[ADMIN_CREATE_TICKET] Failed to send to ${phone}:`, errorMsg);
                            }
                        }
                    }
                    
                    if (DEBUG) console.log(`[ADMIN_CREATE_TICKET] Customer notifications: ${successCount} success, ${errorCount} failed out of ${phoneNumbers.length} numbers`);
                } catch (err) {
                    const errorMsg = err.message || err.toString();
                    console.error('[ADMIN_CREATE_TICKET] Error in customer notification loop:', errorMsg);
                }
            })();
        } else {
            console.warn(`[ADMIN_CREATE_TICKET] WhatsApp not available (raf: ${!!global.raf}, state: ${global.whatsappConnectionState}), skipping customer notification`);
        }
        
        // NOTIFY ALL TEKNISI (non-blocking, don't wait)
        const teknisiAccounts = global.accounts.filter(acc => acc.role === 'teknisi' && acc.phone_number && acc.phone_number.trim() !== '');
        
        if (teknisiAccounts.length > 0 && global.raf && global.whatsappConnectionState === 'open') {
            // Get dynamic response time based on priority and working hours
            const responseTime = getResponseTimeMessage(newTicket.priority || 'MEDIUM');
            
            // Format prioritas display with dynamic response time
            let prioritasDisplay = '';
            if (newTicket.priority === 'HIGH') {
                prioritasDisplay = `🔴 URGENT (${responseTime})`;
            } else if (newTicket.priority === 'MEDIUM') {
                prioritasDisplay = `🟡 NORMAL (${responseTime})`;
            } else {
                prioritasDisplay = `🟢 LOW (${responseTime})`;
            }
            
            const teknisiTemplateData = {
                ticket_id: ticketId,
                prioritas: prioritasDisplay,
                nama_pelanggan: user.name || user.username || 'Pelanggan',
                no_hp: user.phone_number || '-',
                alamat: user.address || '-',
                issue_type: (issueType || 'GENERAL').replace(/_/g, ' '),
                laporan_text: laporanText || '-'
            };
            
            const messageToTeknisi = renderTemplate('ticket_created_teknisi', teknisiTemplateData);
            
            // Send to all teknisi asynchronously (don't block response)
            (async () => {
                let successCount = 0;
                let errorCount = 0;
                
                for (const teknisi of teknisiAccounts) {
                    try {
                        // Check connection before each send
                        if (global.whatsappConnectionState !== 'open') {
                            console.warn(`[ADMIN_CREATE_TICKET] WhatsApp disconnected, stopping teknisi notifications`);
                            break;
                        }
                        
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
                        
                        // PENTING: Cek connection state dan gunakan error handling sesuai rules
                        if (global.whatsappConnectionState === 'open' && global.raf && global.raf.sendMessage) {
                            try {
                                await global.raf.sendMessage(teknisiJid, { text: messageToTeknisi });
                                successCount++;
                            } catch (err) {
                                console.error('[SEND_MESSAGE_ERROR]', {
                                    teknisiJid,
                                    error: err.message
                                });
                                console.warn(`[ADMIN_CREATE_TICKET] Failed to notify teknisi ${teknisi.username}:`, err.message);
                                errorCount++;
                                // Continue to next teknisi
                            }
                        } else {
                            console.warn('[SEND_MESSAGE_SKIP] WhatsApp not connected, skipping send to teknisi', teknisi.username);
                            errorCount++;
                        }
                        
                        await new Promise(resolve => setTimeout(resolve, 500)); // Delay to prevent spam
                    } catch (err) {
                        errorCount++;
                        const errorMsg = err.message || err.toString();
                        // Don't log USync errors as critical (they're handled by wrapper)
                        if (errorMsg.includes('attrs') || errorMsg.includes('USyncQuery')) {
                            console.warn(`[ADMIN_CREATE_TICKET] USync error for teknisi ${teknisi.username} (handled): ${errorMsg.substring(0, 100)}`);
                        } else {
                            console.error(`[ADMIN_CREATE_TICKET] Failed to notify teknisi ${teknisi.username}:`, errorMsg);
                        }
                    }
                }
                if (DEBUG) console.log(`[ADMIN_CREATE_TICKET] Notifications: ${successCount} success, ${errorCount} failed out of ${teknisiAccounts.length} teknisi}`);
            })();
        } else {
            console.warn(`[ADMIN_CREATE_TICKET] WhatsApp not available (raf: ${!!global.raf}, state: ${global.whatsappConnectionState}), skipping teknisi notifications`);
        }
    } catch (error) {
        console.error('[API_ADMIN_TICKET_CREATE_ERROR]', error);
        return res.status(500).json({
            status: 500,
            message: 'Terjadi kesalahan saat membuat tiket',
            error: error.message
        });
    }
});

// Multer storage khusus untuk upload foto saat create ticket (menggunakan struktur reports)
const createTicketPhotoStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        // PENTING: req.body mungkin belum tersedia saat destination dipanggil untuk multipart/form-data
        // Gunakan query parameter atau header sebagai fallback
        const ticketId = req.query?.ticketId || req.body?.ticketId || req.headers['x-ticket-id'];
        
        if (!ticketId) {
            // Jangan throw error di destination, biarkan handler yang handle
            // Gunakan temporary directory dan akan dipindahkan di handler
            const tempDir = path.join(__dirname, '..', 'uploads', 'temp');
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }
            return cb(null, tempDir);
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
        // PENTING: req.body mungkin belum tersedia, gunakan query/header sebagai fallback
        const ticketId = req.query?.ticketId || req.body?.ticketId || req.headers['x-ticket-id'] || 'UNKNOWN';
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(7);
        const ext = path.extname(file.originalname);
        cb(null, `teknisi_${ticketId}_${timestamp}_${random}${ext}`);
    }
});

const createTicketPhotoUpload = multer({
    storage: createTicketPhotoStorage,
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

// POST /api/ticket/create/upload-photo - Upload photo saat create ticket (teknisi)
// Endpoint ini digunakan setelah ticket dibuat untuk upload foto opsional
router.post('/ticket/create/upload-photo', ensureAuthenticatedStaff, rateLimit('ticket-create-upload-photo', 10, 60000), createTicketPhotoUpload.single('photo'), async (req, res) => {
    try {
        // PENTING: req.body sudah tersedia di handler (setelah multer parse)
        const ticketId = req.query?.ticketId || req.body?.ticketId || req.headers['x-ticket-id'];
        
        if (!ticketId) {
            // Clean up uploaded file if exists
            if (req.file && req.file.path) {
                try {
                    fs.unlinkSync(req.file.path);
                } catch (err) {
                    console.error('[TICKET_CREATE_UPLOAD_PHOTO] Failed to delete file:', err);
                }
            }
            return res.status(400).json({
                status: 400,
                message: 'Ticket ID harus diisi'
            });
        }
        
        if (!req.file) {
            return res.status(400).json({
                status: 400,
                message: 'File foto harus diupload'
            });
        }
        
        // Helper function untuk process photo upload (didefinisikan di sini untuk digunakan di retry dan normal flow)
        const processPhotoUpload = (report) => {
            // Initialize arrays untuk foto (konsisten dengan struktur yang ada)
            if (!report.teknisiPhotos) report.teknisiPhotos = [];
            if (!report.photos) report.photos = [];
            if (!report.customerPhotos) report.customerPhotos = [];
            
            // Check max photos (3 photos max untuk create ticket - total customer + teknisi saat create)
            const totalPhotos = report.customerPhotos.length + report.teknisiPhotos.length;
            if (totalPhotos >= 3) {
                // Clean up uploaded file
                if (req.file && req.file.path) {
                    try {
                        fs.unlinkSync(req.file.path);
                    } catch (err) {
                        console.error('[TICKET_CREATE_UPLOAD_PHOTO] Failed to delete file:', err);
                    }
                }
                return {
                    error: true,
                    status: 400,
                    message: 'Maksimal 3 foto per laporan (termasuk foto dari customer)'
                };
            }
            
            // Get year and month from ticket creation date
            const ticketDate = report.createdAt ? new Date(report.createdAt) : new Date();
            const year = ticketDate.getFullYear();
            const month = String(ticketDate.getMonth() + 1).padStart(2, '0');
            
            // Store photo info (konsisten dengan struktur customerPhotos)
            const photoInfo = {
                fileName: req.file.filename,
                path: `/uploads/reports/${year}/${month}/${ticketId}/${req.file.filename}`,
                uploadedAt: new Date().toISOString(),
                size: req.file.size,
                uploadedBy: req.user.username || req.user.name || 'teknisi',
                uploadedVia: 'teknisi_panel_create'
            };
            
            // Add to teknisiPhotos (array object, konsisten dengan customerPhotos)
            report.teknisiPhotos.push(photoInfo);
            // Juga simpan ke photos untuk kompatibilitas (tapi cek duplicate dulu)
            // Cek apakah foto dengan filename yang sama sudah ada di photos
            const existingPhotoIndex = report.photos.findIndex(p => {
                if (typeof p === 'object' && p.fileName) {
                    return p.fileName === photoInfo.fileName;
                } else if (typeof p === 'string') {
                    return p === photoInfo.fileName;
                }
                return false;
            });
            if (existingPhotoIndex === -1) {
                report.photos.push(photoInfo);
            }
            report.hasTeknisiPhotos = true;
            report.photoCount = report.customerPhotos.length + report.teknisiPhotos.length;
            
            // Save to database
            saveReports(global.reports);
            
            return {
                error: false,
                photoInfo,
                report
            };
        };
        
        // Jika file di-upload ke temp directory (karena ticketId tidak ada saat destination), pindahkan ke lokasi yang benar
        const isTempFile = req.file.path && req.file.path.includes(path.join('uploads', 'temp'));
        if (isTempFile && ticketId) {
            // Find report to get creation date
            const report = global.reports.find(r => r.ticketId === ticketId || r.id === ticketId);
            let year, month;
            
            if (report && report.createdAt) {
                const reportDate = new Date(report.createdAt);
                year = reportDate.getFullYear();
                month = String(reportDate.getMonth() + 1).padStart(2, '0');
            } else {
                const now = new Date();
                year = now.getFullYear();
                month = String(now.getMonth() + 1).padStart(2, '0');
            }
            
            const correctDir = getReportsUploadsPath(year, month, ticketId, __dirname);
            if (!fs.existsSync(correctDir)) {
                fs.mkdirSync(correctDir, { recursive: true });
            }
            
            const correctPath = path.join(correctDir, req.file.filename);
            try {
                fs.renameSync(req.file.path, correctPath);
                req.file.path = correctPath;
                req.file.destination = correctDir;
            } catch (err) {
                console.error('[TICKET_CREATE_UPLOAD_PHOTO] Failed to move file from temp:', err);
                // Continue with temp path, will be cleaned up later
            }
        }
        
        // Find the ticket - normalize ticketId untuk matching (case-insensitive, trim whitespace)
        const normalizedTicketId = String(ticketId).trim().toUpperCase();
        const reportIndex = global.reports.findIndex(r => {
            const rTicketId = r.ticketId ? String(r.ticketId).trim().toUpperCase() : null;
            const rId = r.id ? String(r.id).trim().toUpperCase() : null;
            return rTicketId === normalizedTicketId || rId === normalizedTicketId;
        });
        
        if (reportIndex === -1) {
            // Retry: Mungkin ticket baru saja dibuat dan belum ter-sync
            // Reload reports dari file dan coba lagi (max 3 retries dengan delay)
            let found = false;
            for (let retry = 0; retry < 3; retry++) {
                await new Promise(resolve => setTimeout(resolve, 100 * (retry + 1)));
                
                // Reload reports dari file untuk memastikan data ter-update
                try {
                    const { loadReports } = require('../lib/database');
                    loadReports();
                } catch (err) {
                    console.warn('[TICKET_CREATE_UPLOAD_PHOTO] Failed to reload reports:', err.message);
                }
                
                // Coba cari lagi setelah reload
                const retryIndex = global.reports.findIndex(r => {
                    const rTicketId = r.ticketId ? String(r.ticketId).trim().toUpperCase() : null;
                    const rId = r.id ? String(r.id).trim().toUpperCase() : null;
                    return rTicketId === normalizedTicketId || rId === normalizedTicketId;
                });
                
                if (retryIndex !== -1) {
                    found = true;
                    const actualReport = global.reports[retryIndex];
                    const uploadResult = processPhotoUpload(actualReport);
                    
                    if (uploadResult.error) {
                        return res.status(uploadResult.status).json({
                            status: uploadResult.status,
                            message: uploadResult.message
                        });
                    }
                    
                    if (DEBUG) console.log(`[TICKET_CREATE_UPLOAD_PHOTO] Photo uploaded for ticket ${ticketId} during creation (after retry ${retry + 1}). Total: ${uploadResult.report.teknisiPhotos.length}`);
                    
                    return res.json({
                        status: 200,
                        message: `Foto berhasil diupload (${uploadResult.report.teknisiPhotos.length}/3)`,
                        data: {
                            ticketId: uploadResult.report.ticketId || uploadResult.report.id,
                            photoCount: uploadResult.report.teknisiPhotos.length,
                            totalPhotos: uploadResult.report.photoCount,
                            maxPhotos: 3,
                            photo: uploadResult.photoInfo
                        }
                    });
                }
            }
            
            // Jika masih tidak ditemukan setelah retry
            if (!found) {
                // Debug: Log untuk troubleshooting
                console.warn(`[TICKET_CREATE_UPLOAD_PHOTO] Ticket not found after retries. Looking for: "${ticketId}" (normalized: "${normalizedTicketId}")`);
                console.warn(`[TICKET_CREATE_UPLOAD_PHOTO] Total reports: ${global.reports.length}`);
                console.warn(`[TICKET_CREATE_UPLOAD_PHOTO] Last 5 tickets:`, global.reports.slice(-5).map(r => ({
                    ticketId: r.ticketId,
                    id: r.id,
                    status: r.status,
                    createdAt: r.createdAt
                })));
                
                // Clean up uploaded file
                if (req.file && req.file.path) {
                    try {
                        fs.unlinkSync(req.file.path);
                    } catch (err) {
                        console.error('[TICKET_CREATE_UPLOAD_PHOTO] Failed to delete file:', err);
                    }
                }
                return res.status(404).json({
                    status: 404,
                    message: 'Tiket tidak ditemukan. Pastikan tiket sudah dibuat sebelum upload foto. Silakan refresh halaman dan coba lagi.'
                });
            }
        }
        
        const report = global.reports[reportIndex];
        const uploadResult = processPhotoUpload(report);
        
        if (uploadResult.error) {
            return res.status(uploadResult.status).json({
                status: uploadResult.status,
                message: uploadResult.message
            });
        }
        
        if (DEBUG) console.log(`[TICKET_CREATE_UPLOAD_PHOTO] Photo uploaded for ticket ${ticketId} during creation. Total: ${uploadResult.report.teknisiPhotos.length}`);
        
        return res.json({
            status: 200,
            message: `Foto berhasil diupload (${uploadResult.report.teknisiPhotos.length}/3)`,
            data: {
                ticketId: uploadResult.report.ticketId || uploadResult.report.id,
                photoCount: uploadResult.report.teknisiPhotos.length,
                totalPhotos: uploadResult.report.photoCount,
                maxPhotos: 3,
                photo: uploadResult.photoInfo
            }
        });
    } catch (error) {
        console.error('[TICKET_CREATE_UPLOAD_PHOTO_ERROR]', error);
        // Clean up uploaded file if exists
        if (req.file && req.file.path) {
            try {
                fs.unlinkSync(req.file.path);
            } catch (err) {
                console.error('[TICKET_CREATE_UPLOAD_PHOTO] Failed to delete file:', err);
            }
        }
        return res.status(500).json({
            status: 500,
            message: 'Terjadi kesalahan saat upload foto',
            error: error.message
        });
    }
});

// POST /api/ticket/create - Teknisi create ticket (SAME logic as admin)
router.post('/ticket/create', ensureAuthenticatedStaff, rateLimit('ticket-create', 5, 60000), async (req, res) => {
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
        
        // Check working hours before creating ticket
        const workingStatus = isWithinWorkingHours();
        const nextAvailable = getNextAvailableMessage();
        
        // If outside working hours, prepare warning message
        let workingHoursWarning = null;
        if (!workingStatus.isWithinHours) {
            workingHoursWarning = {
                isOutsideHours: true,
                message: workingStatus.message || 'Di luar jam kerja',
                nextAvailable: nextAvailable,
                dayType: workingStatus.dayType
            };
        }
        
        // Generate ticket ID (consistent with WhatsApp bot)
        const ticketId = generateTicketId(7);
        
        // Extract first phone number for pelangganId (JID format)
        // user.phone_number can contain multiple numbers separated by |
        let primaryPhone = '';
        if (user.phone_number) {
            const phones = user.phone_number.split('|').map(p => p.trim()).filter(p => p);
            if (phones.length > 0) {
                primaryPhone = phones[0];
            }
        }
        
        // Create ticket with SAME structure as WhatsApp bot
        const newTicket = {
            ticketId: ticketId,
            pelangganUserId: user.id,
            pelangganId: primaryPhone ? `${primaryPhone}@s.whatsapp.net` : '',
            pelangganName: user.name || user.username || 'Customer',
            pelangganPhone: user.phone_number || '', // Keep all numbers with | separator
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
            createdBy: req.user.name || req.user.username,
            createdByRole: req.user.role,  // Track who created (admin/teknisi)
            deviceOnline: null,
            troubleshootingDone: false,
            assignedTeknisiId: req.user.role === 'teknisi' ? req.user.id : null,
            assignedTeknisiName: req.user.role === 'teknisi' ? (req.user.name || req.user.username) : null,
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
        
        // Prepare response message based on working hours
        let responseMessage = 'Tiket berhasil dibuat. Notifikasi sedang dikirim...';
        if (workingHoursWarning) {
            responseMessage = `Tiket berhasil dibuat. ${workingHoursWarning.message}. ${workingHoursWarning.nextAvailable || 'Teknisi akan memproses pada jam kerja berikutnya.'}`;
        }
        
        // Send response immediately (don't wait for notifications)
        // PENTING: Pastikan ticketId ada di response untuk frontend (explicit)
        res.json({
            status: 200,
            message: responseMessage,
            data: {
                ...newTicket,
                ticketId: ticketId,  // Explicit ticketId untuk memastikan frontend mendapatkannya
                id: ticketId  // Juga sebagai id untuk kompatibilitas
            },
            workingHours: {
                isWithinHours: workingStatus.isWithinHours,
                warning: workingHoursWarning,
                nextAvailable: nextAvailable
            }
        });
        
        // Notify customer via WhatsApp (send to ALL phone numbers) - non-blocking
        if (global.raf && user.phone_number && global.whatsappConnectionState === 'open') {
            // Add working hours info to customer message if outside hours
            let workingHoursNotice = '';
            if (workingHoursWarning) {
                const config = global.config.teknisiWorkingHours;
                workingHoursNotice = `\n\n⏰ *PERHATIAN:*\n${config?.outOfHoursMessage || 'Laporan Anda diterima di luar jam kerja. Akan diproses pada jam kerja berikutnya.'}\n${nextAvailable ? `\n${nextAvailable}` : ''}`;
            }
            
            const creatorName = req.user.name || req.user.username;
            const creatorInfo = req.user.role === 'teknisi' ? `Teknisi ${creatorName}` : `Admin ${creatorName}`;
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
                `Anda dapat cek status dengan: *cektiket ${ticketId}*` +
                workingHoursNotice +
                `\n\nTerima kasih. 🙏`;
            
            // Send notification asynchronously (don't block)
            (async () => {
                try {
                    // Double-check connection before sending
                    if (global.whatsappConnectionState !== 'open') {
                        console.warn(`[CREATE_TICKET] WhatsApp not connected (state: ${global.whatsappConnectionState}), skipping customer notification`);
                        return;
                    }
                    
                    // Split phone numbers (can contain multiple numbers with | separator)
                    const phoneNumbers = user.phone_number.split('|').map(p => p.trim()).filter(p => p);
                    let successCount = 0;
                    let errorCount = 0;
                    
                    for (const phone of phoneNumbers) {
                        try {
                            // Format phone to JID
                            let phoneJid = phone.trim();
                            if (!phoneJid.endsWith('@s.whatsapp.net')) {
                                if (phoneJid.startsWith('0')) {
                                    phoneJid = `62${phoneJid.substring(1)}@s.whatsapp.net`;
                                } else if (phoneJid.startsWith('62')) {
                                    phoneJid = `${phoneJid}@s.whatsapp.net`;
                                } else {
                                    phoneJid = `62${phoneJid}@s.whatsapp.net`;
                                }
                            }
                            
                            // PENTING: Cek connection state dan gunakan error handling sesuai rules
                            if (global.whatsappConnectionState === 'open' && global.raf && global.raf.sendMessage) {
                                try {
                                    await global.raf.sendMessage(phoneJid, { text: customerMsg });
                                    if (DEBUG) console.log(`[CREATE_TICKET] Customer notification sent: ${phoneJid}`);
                                    successCount++;
                                } catch (err) {
                                    console.error('[SEND_MESSAGE_ERROR]', {
                                        phoneJid,
                                        error: err.message
                                    });
                                    console.warn(`[CREATE_TICKET] Failed to send to ${phoneJid}:`, err.message);
                                    errorCount++;
                                    // Continue to next phone number
                                }
                            } else {
                                console.warn('[SEND_MESSAGE_SKIP] WhatsApp not connected, skipping send to', phoneJid);
                                errorCount++;
                            }
                            
                            // Small delay between multiple numbers
                            if (phoneNumbers.length > 1 && phone !== phoneNumbers[phoneNumbers.length - 1]) {
                                await new Promise(resolve => setTimeout(resolve, 500));
                            }
                        } catch (err) {
                            errorCount++;
                            const errorMsg = err.message || err.toString();
                            // Don't log USync errors as critical (they're handled by wrapper)
                            if (errorMsg.includes('attrs') || errorMsg.includes('USyncQuery')) {
                                console.warn(`[CREATE_TICKET] USync error for ${phone} (handled): ${errorMsg.substring(0, 100)}`);
                            } else {
                                console.error(`[CREATE_TICKET] Failed to send to ${phone}:`, errorMsg);
                            }
                        }
                    }
                    
                    if (DEBUG) console.log(`[CREATE_TICKET] Customer notifications: ${successCount} success, ${errorCount} failed out of ${phoneNumbers.length} numbers`);
                } catch (err) {
                    const errorMsg = err.message || err.toString();
                    console.error('[CREATE_TICKET] Error in customer notification loop:', errorMsg);
                }
            })();
        } else {
            console.warn(`[CREATE_TICKET] WhatsApp not available (raf: ${!!global.raf}, state: ${global.whatsappConnectionState}), skipping customer notification`);
        }
        
        // NOTIFY OTHER TEKNISI (not the creator)
        const teknisiAccounts = global.accounts.filter(acc => 
            acc.role === 'teknisi' && 
            acc.phone_number && 
            acc.phone_number.trim() !== '' &&
            acc.username !== req.user.username  // Don't notify creator
        );
        
        // Get dynamic response time based on priority and working hours
        const responseTime = getResponseTimeMessage(newTicket.priority || 'MEDIUM');
        
        // Format prioritas display with dynamic response time
        let prioritasDisplay = '';
        if (newTicket.priority === 'HIGH') {
            prioritasDisplay = `🔴 URGENT (${responseTime})`;
        } else if (newTicket.priority === 'MEDIUM') {
            prioritasDisplay = `🟡 NORMAL (${responseTime})`;
        } else {
            prioritasDisplay = `🟢 LOW (${responseTime})`;
        }
        
        const teknisiTemplateData = {
            ticket_id: ticketId,
            prioritas: prioritasDisplay,
            nama_pelanggan: user.name || user.username || 'Pelanggan',
            no_hp: user.phone_number || '-',
            alamat: user.address || '-',
            issue_type: (issueType || 'GENERAL').replace(/_/g, ' '),
            laporan_text: laporanText || '-'
        };
        
        const messageToTeknisi = renderTemplate('ticket_created_teknisi', teknisiTemplateData);
        
        // Send to other teknisi (non-blocking, don't wait)
        (async () => {
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
                // PENTING: Cek connection state dan gunakan error handling sesuai rules
                if (global.whatsappConnectionState === 'open' && global.raf && global.raf.sendMessage) {
                    try {
                        await global.raf.sendMessage(teknisiJid, { text: messageToTeknisi });
                        await new Promise(resolve => setTimeout(resolve, 500)); // Reduced delay
                    } catch (err) {
                        const errorMsg = err.message || err.toString();
                        console.error('[SEND_MESSAGE_ERROR]', {
                            teknisiJid,
                            error: errorMsg
                        });
                        if (errorMsg.includes('attrs') || errorMsg.includes('USyncQuery')) {
                            console.warn(`[CREATE_TICKET] USync error for teknisi ${teknisi.username} (handled): ${errorMsg.substring(0, 100)}`);
                        } else {
                            console.error(`[CREATE_TICKET] Failed to notify teknisi ${teknisi.username}:`, errorMsg);
                        }
                        // Continue to next teknisi
                    }
                } else {
                    console.warn('[SEND_MESSAGE_SKIP] WhatsApp not connected, skipping send to teknisi', teknisi.username);
                }
            }
        })();
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
        
        // Find the ticket - cek dengan ticketId atau id (untuk kompatibilitas)
        const reportIndex = global.reports.findIndex(r => 
            r.ticketId === ticketId || r.id === ticketId
        );
        if (reportIndex === -1) {
            return res.status(404).json({
                status: 404,
                message: 'Tiket tidak ditemukan'
            });
        }
        
        const report = global.reports[reportIndex];
        
        // Store old status for activity log
        const oldStatus = report.status;
        
        // Update ticket status
        report.status = 'dibatalkan';
        report.cancelled_by = req.user.username;
        report.cancelled_at = new Date().toISOString();
        if (cancellationReason) {
            report.cancellation_reason = cancellationReason;
        }
        
        // Save to database
        saveReports(global.reports);
        
        // Log activity
        try {
            await logActivity({
                userId: req.user.id,
                username: req.user.username,
                role: req.user.role,
                actionType: 'UPDATE',
                resourceType: 'ticket',
                resourceId: report.ticketId || report.id,
                resourceName: `Ticket ${report.ticketId || report.id}`,
                description: `Cancelled ticket ${report.ticketId || report.id}${cancellationReason ? `: ${cancellationReason}` : ''}`,
                oldValue: { status: oldStatus },
                newValue: { status: 'dibatalkan', cancellationReason: cancellationReason },
                ipAddress: req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'],
                userAgent: req.headers['user-agent']
            });
        } catch (logErr) {
            console.error('[ACTIVITY_LOG_ERROR] Failed to log ticket cancel:', logErr);
        }
        
        // Get user details - cek dengan pelangganUserId atau pelangganDataSystem.id
        const user = global.users.find(u => 
            u.id === report.pelangganUserId || 
            u.id === report.pelangganDataSystem?.id ||
            u.id === report.user_id  // Backward compatibility
        );
        
        if (!user) {
            console.warn(`[ADMIN_CANCEL_TICKET] User not found for ticket ${ticketId}. Report data:`, {
                pelangganUserId: report.pelangganUserId,
                pelangganDataSystem: report.pelangganDataSystem,
                user_id: report.user_id
            });
        }
        
        // Format cancellation date
        const cancellationDate = new Date(report.cancelled_at).toLocaleString('id-ID', {
            timeZone: 'Asia/Jakarta',
            day: '2-digit',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        // Format alasan section
        const alasanSection = cancellationReason 
            ? `📝 *Alasan Pembatalan:*\n${cancellationReason}\n` 
            : '';
        
        // Send notification to customer via WhatsApp using template
        if (global.raf && user && user.phone_number) {
            const customerTemplateData = {
                nama_pelanggan: user.name || user.username || 'Pelanggan',
                ticket_id: report.ticketId || report.id,
                issue_type: report.issueType || report.laporanText || 'Tidak disebutkan',
                tanggal: cancellationDate,
                cancelled_by: req.user.name || req.user.username || 'Admin',
                alasan_section: alasanSection,
                telfon: global.config.telfon || 'N/A',
                nama_wifi: global.config.nama || 'Layanan WiFi Kami'
            };
            
            const customerMessage = renderTemplate('ticket_cancelled_customer', customerTemplateData);
            
            try {
                // Send to all customer phone numbers (split by |)
                const phoneNumbers = user.phone_number.split('|').map(p => p.trim()).filter(p => p);
                for (const phoneNumber of phoneNumbers) {
                    const cleanPhone = phoneNumber.replace(/[^0-9]/g, '');
                    if (!cleanPhone) continue;
                    
                    const jid = cleanPhone.includes('@s.whatsapp.net') 
                        ? cleanPhone 
                        : `${cleanPhone}@s.whatsapp.net`;
                    
                    // PENTING: Cek connection state dan gunakan error handling sesuai rules untuk multiple recipients
                    if (global.whatsappConnectionState === 'open' && global.raf && global.raf.sendMessage) {
                        try {
                            await global.raf.sendMessage(jid, { text: customerMessage });
                            // Small delay between messages
                            if (phoneNumbers.length > 1) {
                                await new Promise(resolve => setTimeout(resolve, 500));
                            }
                        } catch (err) {
                            console.error('[SEND_MESSAGE_ERROR]', {
                                jid,
                                error: err.message
                            });
                            console.error(`[ADMIN_CANCEL_TICKET] Failed to send WhatsApp to customer ${jid}:`, err);
                            // Continue to next phone number
                        }
                    } else {
                        console.warn('[SEND_MESSAGE_SKIP] WhatsApp not connected, skipping send to', jid);
                    }
                }
            } catch (err) {
                console.error('[ADMIN_CANCEL_TICKET] Failed to send WhatsApp to customer:', err);
            }
        }
        
        // Send notification to assigned technician using template
        if (global.raf && report.teknisiId) {
            const teknisi = global.accounts.find(acc => 
                String(acc.id) === String(report.teknisiId) || 
                acc.username === report.teknisiId ||
                acc.phone_number === report.teknisiPhone
            );
            
            if (teknisi && teknisi.phone_number) {
                const teknisiTemplateData = {
                    ticket_id: report.ticketId || report.id,
                    nama_pelanggan: user?.name || user?.username || report.pelangganName || 'Pelanggan',
                    no_hp: user?.phone_number?.split('|')[0]?.replace(/[^0-9]/g, '') || report.pelangganPhone || 'N/A',
                    alamat: report.pelangganAddress || report.alamat || 'Tidak disebutkan',
                    issue_type: report.issueType || report.laporanText || 'Tidak disebutkan',
                    prioritas: report.priority === 'HIGH' ? 'URGENT' : (report.priority || 'Normal'),
                    cancelled_by: req.user.name || req.user.username || 'Admin',
                    waktu_pembatalan: cancellationDate,
                    alasan_section: alasanSection
                };
                
                const teknisiMessage = renderTemplate('ticket_cancelled_teknisi', teknisiTemplateData);
                
                // PENTING: Cek connection state dan gunakan error handling sesuai rules untuk multiple recipients
                const teknisiJid = teknisi.phone_number.includes('@') 
                    ? teknisi.phone_number 
                    : `${teknisi.phone_number}@s.whatsapp.net`;
                
                if (global.whatsappConnectionState === 'open' && global.raf && global.raf.sendMessage) {
                    try {
                        await global.raf.sendMessage(teknisiJid, { text: teknisiMessage });
                        if (DEBUG) console.log(`[ADMIN_CANCEL_TICKET] Notification sent to technician ${teknisi.name || teknisi.username}`);
                    } catch (err) {
                        console.error('[SEND_MESSAGE_ERROR]', {
                            teknisiJid,
                            error: err.message
                        });
                        console.error('[ADMIN_CANCEL_TICKET] Failed to send WhatsApp to technician:', err);
                        // Continue to next teknisi
                    }
                } else {
                    console.warn('[SEND_MESSAGE_SKIP] WhatsApp not connected, skipping send to teknisi', teknisi.username);
                }
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
