const axios = require('axios');

/**
 * Check if device is online based on last inform time
 * @param {string} deviceId - Device ID
 * @param {number} maxMinutes - Maximum minutes since last inform (default: 5)
 * @returns {Promise<{online: boolean, lastInform: Date|null, minutesAgo: number|null}>}
 */
async function isDeviceOnline(deviceId, maxMinutes = 5) {
    try {
        // Convert deviceId to string to avoid errors
        const deviceIdStr = String(deviceId);
        
        // Check if GenieACS is configured and deviceId is valid
        if (!global.config.genieacsBaseUrl || !deviceIdStr || deviceIdStr.startsWith('DEVICE-')) {
            console.log(`[isDeviceOnline] Skipping check - Mock mode or invalid device ID: ${deviceIdStr}`);
            return {
                online: null,  // Unknown status
                lastInform: null,
                minutesAgo: null,
                mockMode: true
            };
        }
        
        const response = await axios.get(
            `${global.config.genieacsBaseUrl}/devices/?query={"_id":"${deviceIdStr}"}&projection=_lastInform`,
            { timeout: 5000 }
        );
        
        if (response.data && response.data[0] && response.data[0]._lastInform) {
            const lastInform = new Date(response.data[0]._lastInform);
            const now = new Date();
            const diffMinutes = (now - lastInform) / 1000 / 60;
            
            console.log(`[isDeviceOnline] Device ${deviceId}: Last inform ${diffMinutes.toFixed(2)} minutes ago`);
            
            return {
                online: diffMinutes < maxMinutes,
                lastInform: lastInform,
                minutesAgo: Math.round(diffMinutes)
            };
        }
        
        console.warn(`[isDeviceOnline] Device ${deviceId}: No last inform data`);
        return {
            online: false,
            lastInform: null,
            minutesAgo: null
        };
    } catch (error) {
        console.error(`[isDeviceOnline] Error checking device ${deviceId}:`, error.message);
        // If error, assume offline to be safe
        return {
            online: false,
            lastInform: null,
            minutesAgo: null,
            error: error.message
        };
    }
}

/**
 * Get device last inform time
 * @param {string} deviceId - Device ID
 * @returns {Promise<Date|null>} Last inform date or null
 */
async function getDeviceLastInform(deviceId) {
    try {
        const response = await axios.get(
            `${global.config.genieacsBaseUrl}/devices/?query={"_id":"${deviceId}"}&projection=_lastInform`,
            { timeout: 5000 }
        );
        
        if (response.data && response.data[0] && response.data[0]._lastInform) {
            return new Date(response.data[0]._lastInform);
        }
        
        return null;
    } catch (error) {
        console.error(`[getDeviceLastInform] Error:`, error.message);
        return null;
    }
}

/**
 * Get formatted offline message for user
 * @param {string} userName - User name
 * @param {number|null} minutesAgo - Minutes since last contact
 * @returns {string} Formatted message
 */
function getDeviceOfflineMessage(userName, minutesAgo = null) {
    let message = `❌ *Perangkat Offline*\n\n`;
    message += `Maaf Kak ${userName}, perangkat Anda sedang tidak terhubung ke sistem.\n\n`;
    
    if (minutesAgo !== null) {
        message += `📅 *Terakhir Online:* ${minutesAgo} menit yang lalu\n\n`;
    }
    
    message += `*Kemungkinan Penyebab:*\n`;
    message += `├ Modem mati/tidak ada listrik\n`;
    message += `├ Kabel power lepas\n`;
    message += `├ Gangguan jaringan\n`;
    message += `└ Isolir karena tunggakan\n\n`;
    
    message += `*Solusi:*\n`;
    message += `1️⃣ Pastikan modem menyala (lampu indikator nyala)\n`;
    message += `2️⃣ Periksa kabel power dan LAN\n`;
    message += `3️⃣ Tunggu 5 menit lalu coba lagi\n`;
    message += `4️⃣ Pastikan tagihan sudah dibayar\n\n`;
    
    message += `Jika masih bermasalah setelah pengecekan di atas, silakan hubungi teknisi atau ketik *lapor gangguan*.`;
    
    return message;
}

module.exports = {
    isDeviceOnline,
    getDeviceLastInform,
    getDeviceOfflineMessage
};
