/**
 * WiFi Power Management Handler
 * Handles WiFi transmit power adjustments
 */

const axios = require('axios');
const { findUserWithLidSupport } = require('../../lib/lid-handler');

/**
 * Handle WiFi power change
 */
async function handleGantiPowerWifi({ sender, args, q, isOwner, isTeknisi, users, reply, global, mess, msg, raf }) {
    try {
        let user;
        const providedId = args[1];
        
        // Admin/Teknisi dapat menyebutkan ID pelanggan
        if ((isOwner || isTeknisi) && providedId && !isNaN(parseInt(providedId))) {
            user = users.find(v => v.id == providedId);
        } else {
            // Auto-detect phone number from @lid using remoteJidAlt (Baileys v7)
            let plainSenderNumber = sender.split('@')[0];
            
            // Check remoteJidAlt first for @lid format (auto-detection)
            if (sender.includes('@lid') && msg && msg.key && msg.key.remoteJidAlt) {
                plainSenderNumber = msg.key.remoteJidAlt.split('@')[0].split(':')[0];
                console.log('[GANTI_POWER_WIFI] Auto-detected phone from remoteJidAlt:', plainSenderNumber);
            }
            
            user = await findUserWithLidSupport(users, msg, plainSenderNumber, raf);
            
            // If still not found for @lid, show error (no manual verification needed)
            if (sender.includes('@lid') && !user) {
                console.log('[GANTI_POWER_WIFI] @lid format detected, user not found');
                return reply(`❌ Maaf, nomor Anda tidak terdaftar dalam database.\n\nSilakan hubungi admin untuk bantuan.`);
            }
        }
        
        if (!user) {
            const errorMessage = (isOwner || isTeknisi)
                ? (providedId ? `Maaf, Kak. Pelanggan dengan ID "${providedId}" tidak ditemukan.` : mess.notRegister)
                : mess.userNotRegister;
            throw errorMessage;
        }
        
        if (user.subscription == 'PAKET-VOUCHER') {
            throw mess.onlyMonthly;
        }
        
        if (!q) {
            throw `Silahkan Isi Berapa Power Wifi\n\nContoh : gantipower 80\n\nFungsi : Untuk Mengatur Luas Jangkauan Wifi\n\nNB : Untuk Power Hanya Bisa Diisi 100, 80, 60, 40, 20.`;
        }
        
        if (!['100', '80', '60', '40', '20'].includes(q)) {
            throw `*ERROR!*\n\nSilahkan Cek format gantipower dan coba lagi.\n\nTerimakasih\n${global.config.namabot}`;
        }
        
        // Make API call to GenieACS
        try {
            const response = await axios.post(
                global.config.genieacsBaseUrl + "/devices/" + encodeURIComponent(user.device_id) + "/tasks?connection_request", 
                {
                    name: 'setParameterValues',
                    parameterValues: [
                        ["InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.TransmitPower", `${q}`, "xsd:string"]
                    ]
                }
            );
            
            console.log('[WIFI_POWER] Success:', response.data);
            await reply(`Power Wifi Berhasil Dirubah Ke :\n\n==================================\n${q}%\n==================================\n\n${global.config.namabot}`);
            
        } catch (error) {
            console.error('[WIFI_POWER] Error:', error);
            await reply(`Gagal Mengubah Power Wifi\n\nSilahkan Cek Format Power Wifi Atau Hubungi Admin\n\nTerimakasih\n\n${global.config.namabot}`);
        }
        
    } catch (error) {
        if (typeof error === 'string') {
            await reply(error);
        } else {
            console.error('[WIFI_POWER_HANDLER] Unexpected error:', error);
            await reply('Terjadi kesalahan. Silakan coba lagi atau hubungi admin.');
        }
    }
}

module.exports = {
    handleGantiPowerWifi
};
