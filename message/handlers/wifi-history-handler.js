"use strict";

/**
 * WiFi History Handler
 * Handles WiFi change history viewing for customers and admins
 */

const { getWifiChangeLogs } = require('./wifi-logger');
const { findUserByPhone, isAdmin, isTeknisi } = require('./utils');
const { getSSIDInfo } = require('../../lib/wifi');

/**
 * Format date to Indonesian format
 * @param {string} timestamp - ISO timestamp
 * @returns {string} Formatted date
 */
function formatDate(timestamp) {
    const date = new Date(timestamp);
    const options = {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Jakarta'
    };
    return date.toLocaleDateString('id-ID', options);
}

/**
 * Handle WiFi history check request
 * @param {Object} params - Parameters
 * @returns {Promise<Object>} Response object
 */
async function handleWifiHistory({ sender, pushname, args, isOwner, isTeknisi: isTeknisiUser }) {
    try {
        let targetUser;
        let showPasswords = false;
        
        // Check if admin/teknisi checking for specific user
        // Handle different command formats: "history wifi 1", "historywifi 1", etc.
        let targetId = null;
        if ((isOwner || isTeknisiUser) && args && args.length >= 1) {
            // Try to find user ID in args
            const lastArg = args[args.length - 1];
            if (!isNaN(parseInt(lastArg, 10))) {
                targetId = lastArg;
            } else if (args.length > 2 && !isNaN(parseInt(args[2], 10))) {
                targetId = args[2];
            }
        }
        
        if (targetId) {
            targetUser = global.users.find(u => u.id == targetId);
            
            if (!targetUser) {
                return {
                    success: false,
                    message: `❌ Pelanggan dengan ID "${targetId}" tidak ditemukan.`
                };
            }
            
            // Admin/teknisi can see passwords
            showPasswords = true;
        } else {
            // Regular user checking their own history
            targetUser = findUserByPhone(sender);
            
            if (!targetUser) {
                return {
                    success: false,
                    message: '❌ Maaf, Anda belum terdaftar sebagai pelanggan.'
                };
            }
            
            // Customers can see their own passwords
            showPasswords = true;
        }
        
        // Get WiFi change logs for the user - filter by userId
        const allLogs = getWifiChangeLogs();
        const logs = allLogs.filter(log => String(log.userId) === String(targetUser.id));
        
        if (!logs || logs.length === 0) {
            return {
                success: true,
                message: `📋 *Riwayat Perubahan WiFi*\n\nNama: ${targetUser.name}\n\n_Belum ada riwayat perubahan WiFi._`
            };
        }
        
        // Sort logs by timestamp (newest first)
        logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        // Take only last 10 changes
        const recentLogs = logs.slice(0, 10);
        
        // Format the message
        let message = `📋 *RIWAYAT PERUBAHAN WIFI*\n`;
        message += `━━━━━━━━━━━━━━━━━━\n`;
        message += `👤 *Pelanggan:* ${targetUser.name}\n`;
        message += `📍 *Alamat:* ${targetUser.address || 'N/A'}\n`;
        message += `📊 *Total Perubahan:* ${logs.length}\n`;
        message += `━━━━━━━━━━━━━━━━━━\n`;
        
        // Get current WiFi info from device
        let currentWifiInfo = null;
        if (targetUser.device_id) {
            try {
                currentWifiInfo = await getSSIDInfo(targetUser.device_id, true); // Skip refresh for faster loading
            } catch (err) {
                console.log('[WIFI_HISTORY] Could not get current WiFi info:', err.message);
            }
        }
        
        // Show current WiFi info based on bulk configuration
        if (currentWifiInfo && currentWifiInfo.ssid) {
            message += `\n📡 *INFO WIFI SAAT INI*\n\n`;
            
            // Determine which SSIDs to show based on bulk
            let ssidsToShow = [];
            if (targetUser.bulk && Array.isArray(targetUser.bulk) && targetUser.bulk.length > 0) {
                ssidsToShow = currentWifiInfo.ssid.filter(ssid => targetUser.bulk.includes(String(ssid.id)));
            } else {
                ssidsToShow = currentWifiInfo.ssid.filter(ssid => String(ssid.id) === '1');
            }
            
            ssidsToShow.forEach(ssid => {
                message += `*SSID ${ssid.id}:*\n`;
                message += `📶 Nama: *${ssid.name || 'N/A'}*\n`;
                
                // Get latest password from logs for this SSID
                const ssidPasswordLog = logs.find(log => 
                    (log.changeType === 'password' || log.changeType === 'both') && 
                    log.changes && log.changes.newPassword
                );
                
                if (showPasswords && ssidPasswordLog && ssidPasswordLog.changes.newPassword) {
                    message += `🔐 Password: *${ssidPasswordLog.changes.newPassword}*\n`;
                } else {
                    message += `🔐 Password: _Tidak dapat ditampilkan_\n`;
                }
                message += `\n`;
            });
            
            message += `━━━━━━━━━━━━━━━━━━\n`;
        }
        
        message += `\n📜 *RIWAYAT PERUBAHAN* (10 Terakhir)\n\n`;
        
        recentLogs.forEach((log, index) => {
            const date = formatDate(log.timestamp);
            const num = index + 1;
            
            message += `${num}. *${date}*\n`;
            
            switch (log.changeType) {
                case 'ssid_name':
                case 'name_change':
                    message += `   📶 Ganti Nama WiFi\n`;
                    if (log.changes) {
                        if (log.changes.oldSsidName && log.changes.oldSsidName !== 'N/A') {
                            message += `   Dari: ${log.changes.oldSsidName}\n`;
                        }
                        if (log.changes.newSsidName) {
                            message += `   Menjadi: *${log.changes.newSsidName}*\n`;
                        }
                    }
                    break;
                    
                case 'both':
                    message += `   📶🔐 Ganti Nama & Password WiFi\n`;
                    if (log.changes) {
                        if (log.changes.oldSsidName && log.changes.oldSsidName !== 'N/A') {
                            message += `   Nama Lama: ${log.changes.oldSsidName}\n`;
                        }
                        if (log.changes.newSsidName) {
                            message += `   Nama Baru: *${log.changes.newSsidName}*\n`;
                        }
                        if (showPasswords && log.changes.newPassword) {
                            message += `   Password: *${log.changes.newPassword}*\n`;
                        }
                    }
                    break;
                    
                case 'password':
                    message += `   🔐 Ganti Password WiFi\n`;
                    if (showPasswords && log.changes && log.changes.newPassword) {
                        message += `   Password: *${log.changes.newPassword}*\n`;
                    } else {
                        message += `   Password: ******* (tersembunyi)\n`;
                    }
                    break;
                    
                case 'transmit_power':
                    message += `   📡 Ganti Transmit Power\n`;
                    if (log.changes) {
                        if (log.changes.oldTransmitPower) {
                            message += `   Dari: ${log.changes.oldTransmitPower}\n`;
                        }
                        if (log.changes.newTransmitPower) {
                            message += `   Menjadi: ${log.changes.newTransmitPower}\n`;
                        }
                    }
                    break;
                    
                default:
                    message += `   ⚙️ ${log.reason || 'Perubahan konfigurasi'}\n`;
            }
            
            if (log.notes) {
                message += `   📌 ${log.notes}\n`;
            }
            
            message += `   👤 Oleh: ${log.changedBy || 'System'}\n`;
            message += `\n`;
        });
        
        if (logs.length > 10) {
            message += `_... dan ${logs.length - 10} perubahan lainnya_\n`;
        }
        
        message += `\n━━━━━━━━━━━━━━━━━\n`;
        message += `_Update: ${formatDate(new Date().toISOString())}_`;
        
        return {
            success: true,
            message: message
        };
        
    } catch (error) {
        console.error('[WIFI_HISTORY_ERROR]', error);
        return {
            success: false,
            message: '❌ Terjadi kesalahan saat mengambil riwayat WiFi.'
        };
    }
}

/**
 * Handle WiFi info quick check (current password and name)
 * @param {Object} params - Parameters
 * @returns {Promise<Object>} Response object
 */
async function handleQuickWifiInfo({ sender, pushname }) {
    try {
        const user = findUserByPhone(sender);
        
        if (!user) {
            return {
                success: false,
                message: '❌ Maaf, Anda belum terdaftar sebagai pelanggan.'
            };
        }
        
        // Get latest WiFi info from logs
        const logs = getWifiChangeLogs({ userId: user.id });
        
        if (!logs || logs.length === 0) {
            return {
                success: true,
                message: `📡 *Info WiFi Anda*\n\n👤 Nama: ${user.name}\n\n_Belum ada data WiFi tersimpan._\n\nSilakan hubungi admin untuk informasi lebih lanjut.`
            };
        }
        
        // Find latest changes
        const latestNameChange = logs
            .filter(log => log.changeType === 'ssid_name')
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];
            
        const latestPasswordChange = logs
            .filter(log => log.changeType === 'password')
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];
        
        let message = `📡 *Info WiFi Anda*\n\n`;
        message += `👤 Nama: ${user.name}\n`;
        message += `📱 ID Pelanggan: ${user.id}\n`;
        message += `\n━━━━━━━━━━━━━━━━━\n\n`;
        
        let hasInfo = false;
        
        if (latestNameChange && latestNameChange.changes && latestNameChange.changes.newSsidName) {
            message += `📶 *Nama WiFi:*\n${latestNameChange.changes.newSsidName}\n\n`;
            hasInfo = true;
        }
        
        if (latestPasswordChange && latestPasswordChange.changes && latestPasswordChange.changes.newPassword) {
            message += `🔐 *Password WiFi:*\n${latestPasswordChange.changes.newPassword}\n\n`;
            hasInfo = true;
        }
        
        if (!hasInfo) {
            message += `_Belum ada data WiFi tersimpan._\n\nSilakan hubungi admin untuk informasi lebih lanjut.\n\n`;
        }
        
        message += `━━━━━━━━━━━━━━━━━\n`;
        
        if (latestNameChange || latestPasswordChange) {
            const lastUpdate = latestPasswordChange && latestNameChange ? 
                (new Date(latestPasswordChange.timestamp) > new Date(latestNameChange.timestamp) ? 
                    latestPasswordChange.timestamp : latestNameChange.timestamp) :
                (latestPasswordChange ? latestPasswordChange.timestamp : latestNameChange.timestamp);
                
            message += `\n_Terakhir diperbarui: ${formatDate(lastUpdate)}_`;
        }
        
        message += `\n\n💡 *Tips:*\n`;
        message += `• Ketik *history wifi* untuk melihat riwayat lengkap\n`;
        message += `• Ketik *ganti nama* untuk mengubah nama WiFi\n`;
        message += `• Ketik *ganti sandi* untuk mengubah password WiFi`;
        
        return {
            success: true,
            message: message
        };
        
    } catch (error) {
        console.error('[QUICK_WIFI_INFO_ERROR]', error);
        return {
            success: false,
            message: '❌ Terjadi kesalahan saat mengambil info WiFi.'
        };
    }
}

module.exports = {
    handleWifiHistory,
    handleQuickWifiInfo
};
