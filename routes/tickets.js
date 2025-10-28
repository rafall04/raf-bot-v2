const express = require('express');
const fs = require('fs');
const path = require('path');
const { saveReports, loadJSON, saveJSON } = require('../lib/database');

const router = express.Router();
const reportsDbPath = path.join(__dirname, '..', 'database', 'reports.json');

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
        }
        
        // For teknisi, only show tickets that are 'baru' or 'diproses teknisi'
        if (req.user.role === 'teknisi') {
            filteredReports = filteredReports.filter(report => {
                const reportStatus = (report.status || 'baru').toLowerCase();
                return reportStatus === 'baru' || reportStatus === 'diproses teknisi';
            });
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
router.post('/ticket/process', ensureAuthenticatedStaff, async (req, res) => {
    try {
        const { ticketId } = req.body;
        
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
        
        // Check if ticket is already being processed
        if (report.status === 'diproses teknisi') {
            return res.status(400).json({
                status: 400,
                message: 'Tiket sudah dalam proses'
            });
        }
        
        // Update ticket status
        report.status = 'diproses teknisi';
        report.processed_by = req.user.username;
        report.processed_at = new Date().toISOString();
        
        // Save to database
        saveReports(global.reports);
        
        // Get user details
        const user = global.users.find(u => u.id === report.user_id);
        
        // Broadcast to admins
        const broadcastMsg = `🔧 *TIKET DIPROSES*\n\n` +
            `📋 *ID Tiket:* ${report.id}\n` +
            `👤 *Pelanggan:* ${user ? user.name : 'Unknown'}\n` +
            `📦 *Paket:* ${user ? user.package : '-'}\n` +
            `📝 *Laporan:* ${report.description}\n` +
            `👨‍🔧 *Teknisi:* ${req.user.username}\n` +
            `⏰ *Waktu:* ${new Date().toLocaleString('id-ID')}\n` +
            `📊 *Status:* SEDANG DIPROSES`;
            
        await broadcastToAdmins(broadcastMsg);
        
        // Send notification to customer via WhatsApp if possible
        if (global.raf && user && user.phone) {
            const customerMsg = `Halo ${user.name},\n\n` +
                `Laporan Anda dengan ID *${report.id}* sedang diproses oleh teknisi *${req.user.username}*.\n\n` +
                `Kami akan segera menghubungi Anda untuk penanganan lebih lanjut.\n\n` +
                `Terima kasih atas kesabaran Anda. 🙏`;
            
            try {
                const phoneNumber = user.phone.replace(/[^0-9]/g, '');
                const jid = phoneNumber.includes('@s.whatsapp.net') ? phoneNumber : `${phoneNumber}@s.whatsapp.net`;
                await global.raf.sendMessage(jid, { text: customerMsg });
            } catch (err) {
                console.error('[TICKET_PROCESS] Failed to send WhatsApp to customer:', err);
            }
        }
        
        return res.json({
            status: 200,
            message: 'Tiket berhasil diproses'
        });
    } catch (error) {
        console.error('[API_TICKET_PROCESS_ERROR]', error);
        return res.status(500).json({
            status: 500,
            message: 'Terjadi kesalahan saat memproses tiket'
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
            `📋 *ID Tiket:* ${report.id}\n` +
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
                `✅ Laporan Anda dengan ID *${report.id}* telah SELESAI ditangani.\n\n` +
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

// POST /api/admin/ticket/create - Admin create ticket
router.post('/admin/ticket/create', ensureAdmin, async (req, res) => {
    try {
        const { customerUserId, laporanText } = req.body;
        
        if (!customerUserId || !laporanText) {
            return res.status(400).json({
                status: 400,
                message: 'User ID dan laporan harus diisi'
            });
        }
        
        // Find the user
        const user = global.users.find(u => u.id === customerUserId);
        if (!user) {
            return res.status(404).json({
                status: 404,
                message: 'Pelanggan tidak ditemukan'
            });
        }
        
        // Generate ticket ID
        const ticketId = 'TKT' + Date.now() + Math.random().toString(36).substr(2, 5).toUpperCase();
        
        // Create new ticket
        const newTicket = {
            id: ticketId,
            user_id: customerUserId,
            description: laporanText,
            status: 'baru',
            created_at: new Date().toISOString(),
            created_by: req.user.username,
            created_by_admin: true
        };
        
        // Add to reports
        global.reports.push(newTicket);
        
        // Save to database
        saveReports(global.reports);
        
        // Send notification to customer via WhatsApp if possible
        if (global.raf && user.phone) {
            const customerMsg = `Halo ${user.name},\n\n` +
                `Admin telah membuat tiket laporan untuk Anda:\n\n` +
                `📋 *ID Tiket:* ${ticketId}\n` +
                `📝 *Laporan:* ${laporanText}\n` +
                `⏰ *Waktu:* ${new Date().toLocaleString('id-ID')}\n\n` +
                `Tim teknisi kami akan segera menangani laporan ini.\n` +
                `Terima kasih. 🙏`;
            
            try {
                const phoneNumber = user.phone.replace(/[^0-9]/g, '');
                const jid = phoneNumber.includes('@s.whatsapp.net') ? phoneNumber : `${phoneNumber}@s.whatsapp.net`;
                await global.raf.sendMessage(jid, { text: customerMsg });
            } catch (err) {
                console.error('[ADMIN_CREATE_TICKET] Failed to send WhatsApp to customer:', err);
            }
        }
        
        return res.json({
            status: 200,
            message: 'Tiket berhasil dibuat',
            data: newTicket
        });
    } catch (error) {
        console.error('[API_ADMIN_TICKET_CREATE_ERROR]', error);
        return res.status(500).json({
            status: 500,
            message: 'Terjadi kesalahan saat membuat tiket'
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
                `Tiket laporan Anda dengan ID *${report.id}* telah dibatalkan oleh admin.\n\n` +
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
