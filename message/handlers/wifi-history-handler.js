const { getWifiChangeLogs } = require('../../lib/wifi-logger');

/**
 * Handle HISTORY_WIFI intent - Show WiFi change history
 */
async function handleHistoryWifi(sender, reply, global) {
    try {
        // Get user info
        const senderNumber = sender.replace('@s.whatsapp.net', '');
        const user = global.users.find(u => {
            if (!u.phone_number) return false;
            const phones = u.phone_number.split('|');
            return phones.some(phone => {
                const normalizedPhone = phone.replace(/\D/g, '');
                const normalizedSender = senderNumber.replace(/\D/g, '');
                return normalizedPhone === normalizedSender || 
                       normalizedPhone === '62' + normalizedSender ||
                       '62' + normalizedPhone === normalizedSender;
            });
        });
        
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
