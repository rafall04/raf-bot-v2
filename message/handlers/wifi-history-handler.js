const { getWifiChangeLogs } = require('../../lib/wifi-logger');
const { findUserWithLidSupport } = require('../../lib/lid-handler');

/**
 * Handle HISTORY_WIFI intent - Show WiFi change history
 */
async function handleHistoryWifi(sender, reply, global, msg, raf) {
    try {
        // Auto-detect phone number from @lid using remoteJidAlt (Baileys v7)
        let plainSenderNumber = sender.split('@')[0];
        
        // Check remoteJidAlt first for @lid format (auto-detection)
        if (sender.includes('@lid') && msg && msg.key && msg.key.remoteJidAlt) {
            plainSenderNumber = msg.key.remoteJidAlt.split('@')[0].split(':')[0];
            console.log('[HISTORY_WIFI] Auto-detected phone from remoteJidAlt:', plainSenderNumber);
        }
        
        const user = await findUserWithLidSupport(global.users, msg, plainSenderNumber, raf);
        
        // If still not found for @lid, show error (no manual verification needed)
        if (sender.includes('@lid') && !user) {
            console.log('[HISTORY_WIFI] @lid format detected, user not found');
            return reply(`❌ Maaf, nomor Anda tidak terdaftar dalam database.\n\nSilakan hubungi admin untuk bantuan.`);
        }
        
        if (!user) {
            return reply('❌ Maaf, nomor Anda tidak terdaftar sebagai pelanggan.');
        }
        
        // Get logs for this user
        const result = await getWifiChangeLogs({
            userId: user.id,
            limit: 10
        });
        
        // getWifiChangeLogs returns an object with logs property
        const logs = result.logs || [];
        
        if (!logs || logs.length === 0) {
            return reply('📋 Tidak ada history perubahan WiFi untuk akun Anda.');
        }
        
        let message = '📋 *HISTORY PERUBAHAN WIFI*\n';
        message += `👤 *Pelanggan:* ${user.name}\n`;
        message += `📱 *Device:* ${user.device_id}\n`;
        message += '━━━━━━━━━━━━━━━━━━━━\n\n';
        
        logs.forEach((log, index) => {
            const date = new Date(log.timestamp);
            const dateStr = date.toLocaleDateString('id-ID');
            const timeStr = date.toLocaleTimeString('id-ID');
            
            message += `*${index + 1}. ${dateStr} - ${timeStr}*\n`;
            
            if (log.changeType === 'ssid_name') {
                message += `   📡 *Ganti Nama WiFi*\n`;
                message += `   Lama: _${log.changes.oldSsidName || 'Unknown'}_\n`;
                message += `   Baru: *${log.changes.newSsidName}*\n`;
                if (log.changes.ssidId) {
                    message += `   SSID: ${log.changes.ssidId}\n`;
                }
            } else if (log.changeType === 'password') {
                message += `   🔑 *Ganti Password WiFi*\n`;
                message += `   Password: *${log.changes.newPassword}*\n`;  // Show actual password
                if (log.changes.ssidId) {
                    message += `   SSID: ${log.changes.ssidId}\n`;
                } else if (log.changes.ssidIds) {
                    message += `   SSIDs: ${log.changes.ssidIds}\n`;
                }
            }
            
            message += `   Oleh: ${log.changedBy}\n`;
            if (log.notes) {
                message += `   Info: ${log.notes}\n`;
            }
            message += '\n';
        });
        
        message += '━━━━━━━━━━━━━━━━━━━━\n';
        message += '💡 _Menampilkan 10 perubahan terakhir_';
        
        reply(message);
        
    } catch (error) {
        console.error('[HISTORY_WIFI] Error:', error);
        reply('❌ Maaf, terjadi kesalahan saat mengambil history WiFi.');
    }
}

module.exports = {
    handleHistoryWifi
};
