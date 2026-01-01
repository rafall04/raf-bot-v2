/**
 * PSB WhatsApp Notification Functions
 * Functions untuk mengirim notifikasi WhatsApp ke calon pelanggan saat proses PSB
 */

const { renderTemplate } = require('./templating');

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
    
    // Render template dengan data
    const message = renderTemplate('psb_phase1_registered', {
        nama_pelanggan: user.name || 'Pelanggan',
        customer_id: user.id || '-',
        no_hp: user.phone_number || '-',
        alamat: user.address || '-',
        nama_wifi: global.config?.company?.name || global.config?.nama_wifi || 'RAF NET'
    });
    
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
 * @param {Object} config - Konfigurasi koneksi { pppoe_username, pppoe_password, wifi_ssid, wifi_password }
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
    
    // Get portal URL from config
    const portalUrl = global.config?.welcomeMessage?.customerPortalUrl || 
                      global.config?.company?.website || 
                      global.config?.site_url_bot || 
                      'https://rafnet.my.id/customer';
    
    // Render template dengan data lengkap
    const message = renderTemplate('psb_welcome', {
        nama_pelanggan: user.name || 'Pelanggan',
        wifi_ssid: config.wifi_ssid,
        wifi_password: config.wifi_password,
        nama_paket: user.subscription || '-',
        username: config.pppoe_username,
        password: config.pppoe_password || config.wifi_password, // Fallback ke wifi_password jika pppoe_password tidak ada
        portal_url: portalUrl
    });
    
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
    
    // Render template dengan data
    const message = renderTemplate('psb_teknisi_meluncur', {
        nama_pelanggan: psbRecord.name || 'Pelanggan',
        customer_id: psbRecord.id || '-',
        teknisi_name: teknisiInfo.name,
        teknisi_phone_section: teknisiPhoneSection,
        estimasi_waktu: estimationTime,
        alamat: psbRecord.address || '-',
        nama_wifi: global.config?.company?.name || global.config?.nama_wifi || 'RAF NET'
    });
    
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

/**
 * Send WhatsApp notification saat instalasi fisik selesai (Phase 2 - Pemasangan)
 * Dikirim setelah teknisi selesai memasang kabel/perangkat, sebelum setup WiFi
 * @param {Object} psbRecord - PSB record dengan data pelanggan
 * @returns {Promise<boolean>} - True jika berhasil, false jika gagal
 */
async function sendPSBInstallationCompleteNotification(psbRecord) {
    // PENTING: Cek connection state sesuai rules
    if (global.whatsappConnectionState !== 'open' || !global.raf || !global.raf.sendMessage) {
        console.warn('[PSB_NOTIF] WhatsApp not connected, skipping installation complete notification');
        return false;
    }
    
    if (!psbRecord || !psbRecord.phone_number) {
        console.warn('[PSB_NOTIF] PSB record or phone number missing for installation complete notification');
        return false;
    }
    
    // Render template dengan data
    const message = renderTemplate('psb_installation_complete', {
        nama_pelanggan: psbRecord.name || 'Pelanggan',
        customer_id: psbRecord.id || '-',
        nama_wifi: global.config?.company?.name || global.config?.nama_wifi || 'RAF NET'
    });
    
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
                console.log(`[PSB_NOTIF] Installation complete notification sent to ${psbRecord.phone_number}`);
                return true;
            } catch (error) {
                console.error('[SEND_MESSAGE_ERROR]', {
                    phoneJid,
                    error: error.message
                });
                console.error(`[PSB_NOTIF] Failed to send installation complete notification:`, error);
                return false;
            }
        } else {
            console.warn('[SEND_MESSAGE_SKIP] WhatsApp not connected, skipping send to', phoneJid);
            return false;
        }
    } catch (error) {
        console.error(`[PSB_NOTIF] Error in sendPSBInstallationCompleteNotification:`, error);
        return false;
    }
}

module.exports = {
    sendPSBPhase1Notification,
    sendPSBPhase2Notification,
    sendPSBTeknisiMeluncurNotification,
    sendPSBInstallationCompleteNotification,
    normalizePhoneToJID
};

