"use strict";

/**
 * Admin/Teknisi Handler
 * Menangani fitur-fitur khusus admin dan teknisi
 */

const { getPppStats, getHotspotStats } = require("../../lib/mikrotik");
const { getUserState, setUserState, deleteUserState, mess } = require('./conversation-handler');

/**
 * Handle PPPoE statistics request
 * @returns {Promise<Object>} Response object
 */
async function handlePppStats() {
    try {
        const pppStats = await getPppStats();
        
        let replyText = `📊 *Statistik PPPoE Saat Ini (${global.config.nama || "Layanan Kami"}):*\n\n`;
        replyText += `👤 Total Pengguna PPPoE: *${pppStats.total !== undefined ? pppStats.total : 'N/A'}*\n`;
        replyText += `🟢 Aktif Saat Ini: *${pppStats.online !== undefined ? pppStats.online : 'N/A'}*\n`;
        replyText += `🔴 Tidak Aktif: *${pppStats.offline !== undefined ? pppStats.offline : 'N/A'}*\n`;

        // Add inactive users list
        if (pppStats.inactive_users_list && Array.isArray(pppStats.inactive_users_list) && pppStats.inactive_users_list.length > 0) {
            replyText += `\n📜 *Daftar Pengguna PPPoE Tidak Aktif:*\n`;
            const maxInactiveToShow = 20;
            const inactiveToShow = pppStats.inactive_users_list.slice(0, maxInactiveToShow);

            inactiveToShow.forEach((user, index) => {
                replyText += `${index + 1}. ${user}\n`;
            });

            if (pppStats.inactive_users_list.length > maxInactiveToShow) {
                replyText += `... dan ${pppStats.inactive_users_list.length - maxInactiveToShow} pengguna lainnya.\n`;
            }
        } else if (pppStats.offline > 0) {
            replyText += `\n📜 *Daftar Pengguna PPPoE Tidak Aktif:* (Detail daftar tidak tersedia saat ini)\n`;
        } else {
            replyText += `\n👍 Semua pengguna PPPoE yang terdaftar saat ini aktif atau tidak ada pengguna tidak aktif.\n`;
        }

        replyText += `\n----\nℹ️ _Data diambil pada: ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}_\nTim ${global.config.namabot || "Bot Kami"}`;
        
        return {
            success: true,
            message: replyText
        };
    } catch (error) {
        console.error("[statusppp_ERROR]", error.message);
        return {
            success: false,
            message: `🚫 Gagal mengambil statistik PPPoE: ${error.message}. Silakan coba lagi nanti atau hubungi Admin.`
        };
    }
}

/**
 * Handle Hotspot statistics request
 * @returns {Promise<Object>} Response object
 */
async function handleHotspotStats() {
    try {
        const hotspotStats = await getHotspotStats();
        
        let replyText = `📊 *Statistik Hotspot Saat Ini (${global.config.nama || "Layanan Kami"}):*\n\n`;
        replyText += `👥 Total Pengguna Hotspot Terdaftar: *${hotspotStats.total !== undefined ? hotspotStats.total : 'N/A'}*\n`;
        replyText += `🟢 Aktif Saat Ini: *${hotspotStats.active !== undefined ? hotspotStats.active : 'N/A'}*\n`;
        replyText += `\n----\nℹ️ _Data diambil pada: ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}_\nTim ${global.config.namabot || "Bot Kami"}`;
        
        return {
            success: true,
            message: replyText
        };
    } catch (error) {
        console.error("[statushotspot_ERROR]", error.message);
        return {
            success: false,
            message: `🚫 Gagal mengambil statistik Hotspot: ${error.message}. Silakan coba lagi nanti atau hubungi Admin.`
        };
    }
}

/**
 * Handle list users request
 * @param {Object} params - Parameters
 * @returns {Object} Response object
 */
function handleListUsers({ filter = null }) {
    try {
        let users = [...global.users];
        
        // Apply filter if provided
        if (filter === 'paid') {
            users = users.filter(u => u.paid === true);
        } else if (filter === 'unpaid') {
            users = users.filter(u => u.paid === false);
        }
        
        if (users.length === 0) {
            return {
                success: false,
                message: '📋 Tidak ada pelanggan yang ditemukan dengan filter tersebut.'
            };
        }
        
        // Sort by name
        users.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        
        let message = `📋 *Daftar Pelanggan*\n`;
        message += `Total: ${users.length} pelanggan\n\n`;
        
        // Limit display to prevent too long message
        const maxDisplay = 20;
        const displayUsers = users.slice(0, maxDisplay);
        
        displayUsers.forEach((user, index) => {
            const statusEmoji = user.paid ? '✅' : '❌';
            const phoneNumber = user.phone_number ? user.phone_number.split('|')[0] : 'N/A';
            message += `${index + 1}. ${statusEmoji} *${user.name}*\n`;
            message += `   📱 ${phoneNumber}\n`;
            message += `   📦 ${user.subscription || user.package || 'N/A'}\n`;
            if (user.device_id) {
                message += `   🔧 ${user.device_id}\n`;
            }
            message += '\n';
        });
        
        if (users.length > maxDisplay) {
            message += `... dan ${users.length - maxDisplay} pelanggan lainnya.\n`;
        }
        
        message += `\n✅ = Sudah Bayar | ❌ = Belum Bayar`;
        
        return {
            success: true,
            message: message
        };
    } catch (error) {
        console.error('[LIST_USERS_ERROR]', error);
        return {
            success: false,
            message: '❌ Gagal mengambil daftar pelanggan. Silakan coba lagi.'
        };
    }
}

/**
 * Handle search user
 * @param {Object} params - Parameters
 * @returns {Object} Response object
 */
function handleSearchUser({ query }) {
    try {
        if (!query || query.trim() === '') {
            return {
                success: false,
                message: '❌ Mohon masukkan kata kunci pencarian (nama/nomor telepon).'
            };
        }
        
        const searchQuery = query.toLowerCase().trim();
        
        // Search in users
        const results = global.users.filter(user => {
            const nameMatch = user.name && user.name.toLowerCase().includes(searchQuery);
            const phoneMatch = user.phone_number && user.phone_number.includes(searchQuery);
            const deviceMatch = user.device_id && user.device_id.toLowerCase().includes(searchQuery);
            return nameMatch || phoneMatch || deviceMatch;
        });
        
        if (results.length === 0) {
            return {
                success: false,
                message: `🔍 Tidak ditemukan pelanggan dengan kata kunci "*${query}*".`
            };
        }
        
        let message = `🔍 *Hasil Pencarian untuk "${query}"*\n`;
        message += `Ditemukan: ${results.length} pelanggan\n\n`;
        
        results.forEach((user, index) => {
            const statusEmoji = user.paid ? '✅' : '❌';
            const phoneNumber = user.phone_number ? user.phone_number.split('|')[0] : 'N/A';
            message += `${index + 1}. ${statusEmoji} *${user.name}*\n`;
            message += `   📱 ${phoneNumber}\n`;
            message += `   📦 ${user.subscription || user.package || 'N/A'}\n`;
            if (user.device_id) {
                message += `   🔧 ${user.device_id}\n`;
            }
            message += '\n';
        });
        
        return {
            success: true,
            message: message
        };
    } catch (error) {
        console.error('[SEARCH_USER_ERROR]', error);
        return {
            success: false,
            message: '❌ Gagal melakukan pencarian. Silakan coba lagi.'
        };
    }
}

/**
 * Handle report list for teknisi
 * @param {Object} params - Parameters
 * @returns {Object} Response object
 */
function handleReportList({ status = 'all' }) {
    try {
        let reports = [...global.reports];
        
        // Filter by status
        if (status === 'new') {
            reports = reports.filter(r => r.status === 'baru');
        } else if (status === 'processing') {
            reports = reports.filter(r => r.status === 'diproses teknisi');
        } else if (status === 'done') {
            reports = reports.filter(r => r.status === 'selesai');
        }
        
        if (reports.length === 0) {
            return {
                success: false,
                message: '📋 Tidak ada laporan dengan status tersebut.'
            };
        }
        
        // Sort by date (newest first)
        reports.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        
        let message = `📋 *Daftar Laporan Gangguan*\n`;
        message += `Total: ${reports.length} laporan\n\n`;
        
        const maxDisplay = 10;
        const displayReports = reports.slice(0, maxDisplay);
        
        displayReports.forEach((report, index) => {
            const statusEmoji = report.status === 'baru' ? '🆕' :
                              report.status === 'diproses teknisi' ? '⚙️' :
                              report.status === 'selesai' ? '✅' : '❌';
            
            const createdAt = new Date(report.createdAt).toLocaleString('id-ID', {
                timeZone: 'Asia/Jakarta',
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit'
            });
            
            const keluhan = report.laporanText.substring(0, 50) + 
                          (report.laporanText.length > 50 ? '...' : '');
            
            message += `${index + 1}. ${statusEmoji} *${report.ticketId}*\n`;
            message += `   👤 ${report.pelangganName}\n`;
            message += `   📅 ${createdAt}\n`;
            message += `   💬 ${keluhan}\n`;
            
            if (report.status === 'diproses teknisi' && report.processedByTeknisiName) {
                message += `   🔧 ${report.processedByTeknisiName}\n`;
            }
            
            message += '\n';
        });
        
        if (reports.length > maxDisplay) {
            message += `... dan ${reports.length - maxDisplay} laporan lainnya.\n`;
        }
        
        return {
            success: true,
            message: message
        };
    } catch (error) {
        console.error('[REPORT_LIST_ERROR]', error);
        return {
            success: false,
            message: '❌ Gagal mengambil daftar laporan. Silakan coba lagi.'
        };
    }
}

module.exports = {
    handlePppStats,
    handleHotspotStats,
    handleListUsers,
    handleSearchUser,
    handleReportList
};
