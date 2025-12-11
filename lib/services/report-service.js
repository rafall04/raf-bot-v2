/**
 * ReportService
 * 
 * Service untuk handle business logic terkait report/ticket operations.
 * 
 * Methods:
 * - submitReport() - Submit report baru dari customer
 * - getReportHistory() - Get report history untuk customer
 * - mapReportStatus() - Map internal status ke external status
 */

const BaseService = require('./base-service');
const { createError, ErrorTypes } = require('../error-handler');
const { saveReports } = require('../database');
const { renderTemplate } = require('../templating');

class ReportService extends BaseService {
    /**
     * Generate unique ticket ID
     * @param {number} length - Panjang ID (default 7)
     * @returns {string} Ticket ID
     */
    static generateTicketId(length = 7) {
        const characters = 'ABCDEFGHJKLMNOPQRSTUVWXYZ23456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += characters.charAt(Math.floor(Math.random() * characters.length));
        }
        return result;
    }

    /**
     * Map internal report status to external status
     * @param {string} internalStatus - Internal status
     * @returns {string} External status
     */
    static mapReportStatus(internalStatus) {
        switch (internalStatus) {
            case 'baru': 
                return 'Submitted';
            case 'diproses teknisi': 
                return 'In Progress';
            case 'selesai': 
                return 'Resolved';
            case 'dibatalkan admin':
            case 'dibatalkan pelanggan': 
                return 'Cancelled';
            default: 
                return internalStatus;
        }
    }

    /**
     * Submit report dari customer
     * 
     * @param {Object} user - Customer user object
     * @param {Object} reportData - { category, reportText }
     * @param {string} ipAddress - IP address dari request (optional)
     * @returns {Promise<Object>} { ticketId }
     * @throws {Error} Jika validasi gagal atau ada error
     */
    static async submitReport(user, reportData, ipAddress = null, req = null) {
        const { category, reportText } = reportData;

        // Audit log: Data access
        this.logDataAccess('ReportService', 'submitReport', user.id, null, true, req || { ip: ipAddress });

        // Validation
        this.validateRequired(reportData, ['category', 'reportText']);

        // Get primary phone number
        const primaryPhoneNumber = user.phone_number.split('|')[0];
        const customerJid = this.getCustomerJid(primaryPhoneNumber);

        // Check for existing active report - hanya report dengan status 'baru' atau 'diproses teknisi' yang dianggap aktif
        // Report dengan status 'dibatalkan', 'dibatalkan admin', 'dibatalkan pelanggan', atau 'selesai' TIDAK dianggap aktif
        const existingActiveReport = global.reports.find(
            r => r.pelangganId === customerJid && 
            (r.status === 'baru' || r.status === 'diproses teknisi')
        );

        if (existingActiveReport) {
            throw createError(
                ErrorTypes.VALIDATION_ERROR,
                `Anda sudah memiliki laporan aktif dengan ID Tiket: ${existingActiveReport.ticketId}. Mohon tunggu hingga laporan tersebut diselesaikan.`,
                409
            );
        }

        // Generate ticket ID
        const ticketId = this.generateTicketId(7);
        const now = new Date();

        // Create report object
        const newReport = {
            ticketId,
            pelangganId: customerJid,
            pelangganPushName: user.name,
            pelangganDataSystem: {
                id: user.id,
                name: user.name,
                address: user.address,
                subscription: user.subscription,
                pppoe_username: user.pppoe_username
            },
            category,
            laporanText: reportText,
            status: "baru",
            createdAt: now.toISOString(),
            createdBy: {
                type: 'customer_panel',
                ip: ipAddress,
                userId: user.id
            },
            assignedTeknisiId: null,
            processingStartedAt: null,
            processedByTeknisiId: null,
            processedByTeknisiName: null,
            resolvedAt: null,
            resolvedByTeknisiId: null,
            resolvedByTeknisiName: null
        };

        // Save to database
        global.reports.unshift(newReport);
        saveReports();

        // Send notifications (fire-and-forget)
        this._sendReportNotifications(newReport, user, customerJid, primaryPhoneNumber, now).catch(err => {
            this.logError('ReportService', 'submitReport', err, {
                ticketId,
                userId: user.id
            });
        });

        return { ticketId };
    }

    /**
     * Get report history untuk customer
     * 
     * @param {Object} user - Customer user object
     * @returns {Promise<Array>} Array of report history
     */
    static async getReportHistory(user, req = null) {
        if (!user || !user.phone_number) {
            return [];
        }

        // Audit log: Data access
        this.logDataAccess('ReportService', 'getReportHistory', user.id, null, true, req);

        // Get all customer JIDs
        const customerJids = this.getCustomerJids(user.phone_number);

        // CRITICAL: Strict ownership check - only return reports owned by this user
        // Filter reports by customer JIDs (user bisa punya multiple phone numbers)
        const reportHistory = global.reports.filter(
            r => customerJids.includes(r.pelangganId)
        );

        // Additional security: Verify all reports belong to this user
        // (defense in depth - should already be filtered by JIDs, but double-check)
        const verifiedReports = reportHistory.filter(report => {
            // If report has userId field, verify it matches
            if (report.userId !== undefined) {
                return String(report.userId) === String(user.id);
            }
            // If no userId field, trust JID-based filtering
            return true;
        });

        // Map to response format
        const responseData = verifiedReports.map(report => ({
            id: report.ticketId,
            category: report.category,
            status: this.mapReportStatus(report.status),
            submittedAt: report.createdAt
        })).sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));

        return responseData;
    }

    /**
     * Send notifications untuk report baru
     * @private
     * @param {Object} report - Report object
     * @param {Object} user - User object
     * @param {string} customerJid - Customer JID
     * @param {string} primaryPhoneNumber - Primary phone number
     * @param {Date} now - Current date
     */
    static async _sendReportNotifications(report, user, customerJid, primaryPhoneNumber, now) {
        if (global.whatsappConnectionState !== 'open' || !global.raf || !global.raf.sendMessage) {
            console.warn("[REPORT_SERVICE] Koneksi WhatsApp tidak aktif, notifikasi tidak dikirim.");
            return;
        }

        // Send confirmation to customer
        const confirmationMessage = `✅ *Laporan Anda Telah Diterima*\n\nHalo *${user.name}*,\n\nTerima kasih, laporan Anda telah berhasil kami terima dan akan segera diproses oleh tim kami.\n\n*Detail Laporan Anda:*\n- *Nomor Tiket:* *${report.ticketId}*\n- *Kategori:* ${report.category}\n- *Isi Laporan:* ${report.laporanText}\n\nMohon simpan Nomor Tiket ini untuk referensi Anda. Tim teknisi kami akan segera menghubungi Anda.\n\nTerima kasih,\nTim Layanan ${global.config.nama || 'Kami'}`;

        try {
            await global.raf.sendMessage(customerJid, { text: confirmationMessage });
        } catch (error) {
            console.error('[SEND_MESSAGE_ERROR]', {
                customerJid,
                error: error.message
            });
        }

        // Send notification to teknisi
        const teknisiAccounts = global.accounts.filter(
            acc => acc.role === 'teknisi' && acc.phone_number && acc.phone_number.trim() !== ""
        );

        if (teknisiAccounts.length > 0) {
            const linkWaPelanggan = `https://wa.me/${this.normalizePhoneNumber(primaryPhoneNumber)}`;
            const waktuLaporFormatted = now.toLocaleString('id-ID', {
                dateStyle: 'medium',
                timeStyle: 'short',
                timeZone: 'Asia/Jakarta'
            });

            let detailPelangganUntukTeknisi = `*Dari:* ${user.name} (${linkWaPelanggan})\n*Nama Sistem:* ${user.name}\n*Alamat:* ${user.address || 'N/A'}\n*Paket:* ${user.subscription || 'N/A'}\n`;
            if (user.pppoe_username) {
                detailPelangganUntukTeknisi += `*PPPoE:* ${user.pppoe_username}`;
            }

            const messageToTeknisi = `🔔 *LAPORAN BARU DARI PELANGGAN* 🔔\n\n*ID TIKET: ${report.ticketId}*\n\n*Waktu Lapor:* ${waktuLaporFormatted}\n\n*Data Pelanggan:*\n${detailPelangganUntukTeknisi}\n\n*Kategori Laporan: ${report.category}*\n*Isi Laporan:*\n${report.laporanText}\n\n-----------------------------------\nMohon segera ditindaklanjuti. Periksa dashboard teknisi untuk memproses tiket ini.`;

            // Send to all teknisi
            for (const teknisi of teknisiAccounts) {
                let teknisiJid = this.normalizePhoneNumber(teknisi.phone_number);
                if (teknisiJid) {
                    teknisiJid += '@s.whatsapp.net';
                    try {
                        const { delay } = await import('@whiskeysockets/baileys');
                        await delay(500);
                        await global.raf.sendMessage(teknisiJid, { text: messageToTeknisi });
                    } catch (error) {
                        console.error('[SEND_MESSAGE_ERROR]', {
                            teknisiJid,
                            error: error.message
                        });
                        // Continue to next teknisi
                    }
                }
            }
        }
    }
}

module.exports = ReportService;

