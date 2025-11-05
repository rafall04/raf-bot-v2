/**
 * WiFi Power Management Handler
 * Handles WiFi transmit power adjustments
 */

const axios = require('axios');

/**
 * Handle WiFi power change
 */
async function handleGantiPowerWifi({ sender, args, q, isOwner, isTeknisi, users, reply, global, mess }) {
    try {
        // Find user
        const user = users.find(v => 
            (isOwner || isTeknisi) 
                ? v.id == args[1] 
                : v.phone_number && v.phone_number.split("|").find(vv => vv == (/^([^:@]+)[:@]?.*$/.exec(sender)[1]))
        );
        
        if (!user) {
            throw (isOwner || isTeknisi) ? mess.notRegister : mess.userNotRegister;
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
