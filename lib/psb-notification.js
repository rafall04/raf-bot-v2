/**
 * PSB WhatsApp Notification Functions
 * Functions untuk mengirim notifikasi WhatsApp ke calon pelanggan saat proses PSB
 */

/**
 * Normalize phone number to WhatsApp JID format
 * @param {string} phone - Phone number
 * @returns {string|null} - JID format atau null jika invalid
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
 * Send WhatsApp notification setelah PSB Phase 1 (Data Awal)
 * @param {Object} user - User object dengan data pelanggan
 * @returns {Promise<boolean>} - True jika berhasil, false jika gagal
 */
async function sendPSBPhase1Notification(user) {
    // PENTING: Cek connection state sesuai rules
    if (global.whatsappConnectionState !== 'open' || !global.raf || !global.raf.sendMessage) {
        console.warn('[PSB_NOTIF] WhatsApp not connected, skipping Phase 1 notification');
        return false;
    }
    
    if (!user || !user.phone_number) {
        console.warn('[PSB_NOTIF] User or phone number missing for Phase 1 notification');
        return false;
    }
    
    const message = `*Selamat! Data Anda Telah Terdaftar*

Halo *${user.name || 'Pelanggan'}*,

Data Anda telah berhasil didaftarkan untuk instalasi internet baru.

*Detail Pendaftaran:*
• Nama: ${user.name || '-'}
• No. HP: ${user.phone_number || '-'}
• Alamat: ${user.address || '-'}
• Status: Menunggu Instalasi

Tim teknisi akan segera menghubungi Anda untuk jadwal instalasi.

Terima kasih.`;
    
    try {
        const phoneJid = normalizePhoneToJID(user.phone_number);
        if (!phoneJid) {
            console.error(`[PSB_NOTIF] Invalid phone number: ${user.phone_number}`);
            return false;
        }
        
        // PENTING: Cek connection state dan gunakan error handling sesuai rules
        if (global.whatsappConnectionState === 'open' && global.raf && global.raf.sendMessage) {
            try {
                await global.raf.sendMessage(phoneJid, { text: message });
                console.log(`[PSB_NOTIF] Phase 1 notification sent to ${user.phone_number}`);
                return true;
            } catch (error) {
                console.error('[SEND_MESSAGE_ERROR]', {
                    phoneJid,
                    error: error.message
                });
                console.error(`[PSB_NOTIF] Failed to send Phase 1 notification:`, error);
                return false;
            }
        } else {
            console.warn('[SEND_MESSAGE_SKIP] WhatsApp not connected, skipping send to', phoneJid);
            return false;
        }
    } catch (error) {
        console.error(`[PSB_NOTIF] Error in sendPSBPhase1Notification:`, error);
        return false;
    }
}

/**
 * Send WhatsApp notification setelah PSB Phase 2 (Konfigurasi Modem)
 * @param {Object} user - User object dengan data pelanggan
 * @param {Object} config - Konfigurasi koneksi { pppoe_username, wifi_ssid, wifi_password }
 * @returns {Promise<boolean>} - True jika berhasil, false jika gagal
 */
async function sendPSBPhase2Notification(user, config) {
    // PENTING: Cek connection state sesuai rules
    if (global.whatsappConnectionState !== 'open' || !global.raf || !global.raf.sendMessage) {
        console.warn('[PSB_NOTIF] WhatsApp not connected, skipping Phase 2 notification');
        return false;
    }
    
    if (!user || !user.phone_number) {
        console.warn('[PSB_NOTIF] User or phone number missing for Phase 2 notification');
        return false;
    }
    
    if (!config || !config.pppoe_username || !config.wifi_ssid || !config.wifi_password) {
        console.warn('[PSB_NOTIF] Missing config data for Phase 2 notification');
        return false;
    }
    
    const message = `*✅ Instalasi Selesai!*

Halo *${user.name || 'Pelanggan'}*,

Instalasi internet Anda telah selesai dan siap digunakan.

*Detail:*
• Nama: ${user.name || '-'}
• Paket: ${user.subscription || '-'}
• Nama WiFi: ${config.wifi_ssid}
• Password WiFi: ${config.wifi_password}

Selamat menikmati internet Anda! 🎉

Terima kasih.`;
    
    try {
        const phoneJid = normalizePhoneToJID(user.phone_number);
        if (!phoneJid) {
            console.error(`[PSB_NOTIF] Invalid phone number: ${user.phone_number}`);
            return false;
        }
        
        // PENTING: Cek connection state dan gunakan error handling sesuai rules
        if (global.whatsappConnectionState === 'open' && global.raf && global.raf.sendMessage) {
            try {
                await global.raf.sendMessage(phoneJid, { text: message });
                console.log(`[PSB_NOTIF] Phase 2 notification sent to ${user.phone_number}`);
                return true;
            } catch (error) {
                console.error('[SEND_MESSAGE_ERROR]', {
                    phoneJid,
                    error: error.message
                });
                console.error(`[PSB_NOTIF] Failed to send Phase 2 notification:`, error);
                return false;
            }
        } else {
            console.warn('[SEND_MESSAGE_SKIP] WhatsApp not connected, skipping send to', phoneJid);
            return false;
        }
    } catch (error) {
        console.error(`[PSB_NOTIF] Error in sendPSBPhase2Notification:`, error);
        return false;
    }
}

/**
 * Send WhatsApp notification saat teknisi meluncur ke lokasi
 * @param {Object} psbRecord - PSB record dengan data pelanggan
 * @param {Object} teknisiInfo - Info teknisi { name, phone_number }
 * @returns {Promise<boolean>} - True jika berhasil, false jika gagal
 */
async function sendPSBTeknisiMeluncurNotification(psbRecord, teknisiInfo) {
    // PENTING: Cek connection state sesuai rules
    if (global.whatsappConnectionState !== 'open' || !global.raf || !global.raf.sendMessage) {
        console.warn('[PSB_NOTIF] WhatsApp not connected, skipping teknisi meluncur notification');
        return false;
    }
    
    if (!psbRecord || !psbRecord.phone_number) {
        console.warn('[PSB_NOTIF] PSB record or phone number missing for teknisi meluncur notification');
        return false;
    }
    
    if (!teknisiInfo || !teknisiInfo.name) {
        console.warn('[PSB_NOTIF] Teknisi info missing for teknisi meluncur notification');
        return false;
    }
    
    // Get teknisi phone for contact
    const teknisiPhone = (() => {
        if (!teknisiInfo.phone_number) return null;
        let phone = teknisiInfo.phone_number.replace(/[^0-9]/g, '');
        if (phone.startsWith('0')) {
            return '62' + phone.substring(1);
        } else if (!phone.startsWith('62')) {
            return '62' + phone;
        }
        return phone;
    })();
    
    const teknisiPhoneSection = teknisiPhone ? `📱 Kontak: wa.me/${teknisiPhone}\n` : '';
    
    // Get estimation time from config
    const estimationTime = (global.config && global.config.teknisiWorkingHours && global.config.teknisiWorkingHours.psbEstimationTime) 
        ? global.config.teknisiWorkingHours.psbEstimationTime 
        : '30-60 menit';
    
    const message = `🚗 *TEKNISI BERANGKAT KE LOKASI ANDA*

━━━━━━━━━━━━━━━━
📋 ID Pelanggan: *${psbRecord.id}*
🔧 Teknisi: *${teknisiInfo.name}*
${teknisiPhoneSection}━━━━━━━━━━━━━━━━

Halo *${psbRecord.name || 'Pelanggan'}*,

Teknisi sedang menuju lokasi Anda untuk melakukan instalasi internet.

⏱️ *Estimasi Tiba:* ${estimationTime}
_Waktu dapat berubah tergantung kondisi lalu lintas_

📍 *Alamat Instalasi:*
${psbRecord.address || '-'}

Silakan pastikan Anda atau wakil Anda ada di lokasi saat teknisi tiba.

Terima kasih.`;
    
    try {
        const phoneJid = normalizePhoneToJID(psbRecord.phone_number);
        if (!phoneJid) {
            console.error(`[PSB_NOTIF] Invalid phone number: ${psbRecord.phone_number}`);
            return false;
        }
        
        // PENTING: Cek connection state dan gunakan error handling sesuai rules
        if (global.whatsappConnectionState === 'open' && global.raf && global.raf.sendMessage) {
            try {
                await global.raf.sendMessage(phoneJid, { text: message });
                console.log(`[PSB_NOTIF] Teknisi meluncur notification sent to ${psbRecord.phone_number}`);
                return true;
            } catch (error) {
                console.error('[SEND_MESSAGE_ERROR]', {
                    phoneJid,
                    error: error.message
                });
                console.error(`[PSB_NOTIF] Failed to send teknisi meluncur notification:`, error);
                return false;
            }
        } else {
            console.warn('[SEND_MESSAGE_SKIP] WhatsApp not connected, skipping send to', phoneJid);
            return false;
        }
    } catch (error) {
        console.error(`[PSB_NOTIF] Error in sendPSBTeknisiMeluncurNotification:`, error);
        return false;
    }
}

module.exports = {
    sendPSBPhase1Notification,
    sendPSBPhase2Notification,
    sendPSBTeknisiMeluncurNotification,
    normalizePhoneToJID
};

