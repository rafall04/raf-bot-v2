/**
 * WiFi Check Handler
 * Menangani pengecekan status WiFi dan modem
 */

const axios = require('axios');
const { getSSIDInfo } = require('../../lib/wifi');
const { sleep } = require('../../lib/myfunc');
const { getProfileBySubscription } = require('../../lib/myfunc');
const { getONUInfo } = require('../../lib/wifi');
const { findUserWithLidSupport } = require('../../lib/lid-handler');

/**
 * Handle cek WiFi status
 */
async function handleCekWifi({ sender, args, isOwner, isTeknisi, pushname, users, reply, global, mess, msg, raf }) {
    const plainSenderNumber = sender.split('@')[0];
    let user;
    let searchMode = 'direct'; // 'direct', 'by_id', 'by_name'
    let searchQuery = null;
    let providedId = null;
    
    // Debug logging
    console.log('[CEK_WIFI_DEBUG] Sender:', sender);
    console.log('[CEK_WIFI_DEBUG] PlainSenderNumber:', plainSenderNumber);
    console.log('[CEK_WIFI_DEBUG] Users count:', users.length);
    console.log('[CEK_WIFI_DEBUG] isOwner:', isOwner, 'isTeknisi:', !!isTeknisi);
    console.log('[CEK_WIFI_DEBUG] Args:', args);
    
    // Priority 1: Admin/Teknisi providing an ID
    if ((isOwner || isTeknisi) && args.length >= 2 && !isNaN(parseInt(args[1], 10))) {
        searchMode = 'by_id';
        providedId = args[1];
        user = users.find(v => v.id == providedId);
        console.log('[CEK_WIFI_DEBUG] Search by ID:', providedId, 'Found:', !!user);
    } 
    // Priority 2: Admin/Teknisi providing a name to search
    else if ((isOwner || isTeknisi) && args.length >= 2 && isNaN(parseInt(args[1], 10))) {
        searchMode = 'by_name';
        searchQuery = args.slice(1).join(' ').toLowerCase().trim();
        user = users.find(v => v.name && v.name.toLowerCase().includes(searchQuery));
        console.log('[CEK_WIFI_DEBUG] Search by name:', searchQuery, 'Found:', !!user);
    }
    // Priority 3 (Fallback): Find by WhatsApp sender number (with @lid support)
    else {
        // Use the new lid-handler to find user (supports @lid format)
        user = await findUserWithLidSupport(users, msg, plainSenderNumber, raf);
        
        console.log('[CEK_WIFI_DEBUG] Search by phone/LID:', plainSenderNumber, 'Found:', !!user);
        
        // Additional debug if not found
        if (!user && plainSenderNumber) {
            console.log('[CEK_WIFI_DEBUG] No user found for phone/LID:', plainSenderNumber);
            console.log('[CEK_WIFI_DEBUG] Sender format:', sender);
            
            // Check if it's @lid format and provide verification instructions
            if (sender.includes('@lid')) {
                console.log('[CEK_WIFI_DEBUG] This is @lid format - WhatsApp privacy mode');
                const { createLidVerification } = require('../../lib/lid-handler');
                const lidId = sender.split('@')[0];
                const verification = createLidVerification(lidId, users);
                return reply(verification.message);
            }
            
            console.log('[CEK_WIFI_DEBUG] Sample phone formats in DB:');
            users.slice(0, 3).forEach((u, i) => {
                if (u.phone_number) {
                    console.log(`  User ${i+1}:`, u.phone_number);
                }
            });
        }
    }

    if (!user) {
        let errorMessage;
        
        if (isOwner || isTeknisi) {
            if (providedId) {
                errorMessage = `Maaf, Kak. Pelanggan dengan ID "${providedId}" tidak ditemukan.`;
            } else if (searchQuery) {
                errorMessage = `Maaf, Kak. Pelanggan dengan nama "${searchQuery}" tidak ditemukan.`;
            } else {
                // Owner/teknisi without specifying customer
                // Provide helpful guidance instead of error
                let helpMessage = "📋 **CEK WIFI - Panduan Admin/Teknisi**\n\n";
                helpMessage += "Untuk mengecek WiFi pelanggan, gunakan:\n";
                helpMessage += "• `cek wifi [ID]` - Cek berdasarkan ID\n";
                helpMessage += "• `cek wifi [nama]` - Cek berdasarkan nama\n\n";
                helpMessage += "Contoh:\n";
                helpMessage += "• `cek wifi 1`\n";
                helpMessage += "• `cek wifi John`\n";
                helpMessage += "• `cek wifi Pak Budi`\n\n";
                helpMessage += "💡 Tips: Anda sebagai admin/teknisi tidak terdaftar sebagai pelanggan WiFi.";
                return reply(helpMessage);
            }
        } else {
            // Regular user not registered
            errorMessage = mess.userNotRegister || "Maaf, nomor Anda belum terdaftar sebagai pelanggan. Silakan hubungi admin untuk mendaftar.";
        }
        
        return reply(errorMessage);
    }

    if (!user.device_id) {
        return reply(`Maaf, Kak. Data device ID untuk pelanggan "${user.name || 'ini'}" tidak ditemukan di sistem kami, jadi saya tidak bisa melakukan pengecekan.`);
    }

    await reply("⏳ Sedang mengambil informasi WiFi dan modem Anda, mohon tunggu sebentar...");

    try {
        // Refresh device function
        const refreshDevice = async (deviceId, objectName) => {
            try {
                const response = await axios.post(
                    `${global.config.genieacsBaseUrl}/devices/${encodeURIComponent(deviceId)}/tasks?connection_request`,
                    {
                        name: "refreshObject",
                        objectName: objectName
                    },
                    { timeout: 20000 }
                );

                console.log(`[CEK_WIFI] Refresh request sent for ${objectName}, status: ${response.status}`);
                return response.status >= 200 && response.status < 300;
            } catch (err) {
                console.error(`[CEK_WIFI] Error refreshing ${objectName}:`, err.message);
                return false;
            }
        };

        // Send refresh requests and wait
        const refreshLAN = refreshDevice(user.device_id, "InternetGatewayDevice.LANDevice.1");
        const refreshVirtual = refreshDevice(user.device_id, "VirtualParameters");

        // Wait for both refreshes to complete
        await Promise.all([refreshLAN, refreshVirtual]);

        // Wait a few seconds to ensure data is updated on server
        await sleep(10000);

        // Get latest data after refresh
        const { uptime, ssid } = await getSSIDInfo(user.device_id);

        let ssidInfoText = "";
        let filteredSsids = [];

        if (user.bulk && user.bulk.length > 0) {
            const bulkSsidIds = user.bulk.map(String);
            filteredSsids = ssid.filter(s => {
                return s.id && bulkSsidIds.includes(String(s.id));
            });
        } else {
            filteredSsids = ssid.filter(s => String(s.id) === "1");
        }

        if (filteredSsids.length > 0) {
            ssidInfoText = filteredSsids.map(s_item => {
                let ssidIdentifier = "";
                if (s_item.id) ssidIdentifier = `(SSID ID: ${s_item.id})`;
                else ssidIdentifier = "(Band Tidak Diketahui)";

                let devicesConnectedText = "  Tidak ada perangkat terhubung ke SSID ini.";
                if (s_item.associatedDevices && s_item.associatedDevices.length > 0) {
                    devicesConnectedText = `  *Daftar Perangkat Terhubung (${s_item.associatedDevices.length}):*\n` +
                          s_item.associatedDevices.map((d, index) =>
                              `    ${index + 1}. ${d.hostName || "Tanpa Nama"} (IP: ${d.ip || "-"}) Sinyal: ${d.signal ? d.signal + " dBm" : "-"}`
                          ).join("\n");
                }

                return `📶 *Detail SSID: "${s_item.name || 'N/A'}"* ${ssidIdentifier}\n` +
                       `   ⚡ *Transmit Power:* ${s_item.transmitPower ? s_item.transmitPower + "%" : "Tidak Terbaca"}\n` +
                       `${devicesConnectedText}`;
            }).join("\n\n-----------------------------------\n");
        } else {
            ssidInfoText = "Informasi SSID tidak tersedia atau tidak dapat diambil untuk konfigurasi Anda saat ini.";
        }

        const namaPelangganTampil = user.name || pushname;
        const namaLayanan = global.config.nama || "Layanan Kami";
        const botNama = global.config.namabot || "Bot Asisten";

        const messageReply = `📡 *STATUS MODEM ANDA - ${namaLayanan}* 📡\n\nHalo Kak ${namaPelangganTampil}! Berikut adalah informasi modem Anda:\n\n⏱️ *Uptime Perangkat:* ${uptime || "Tidak terbaca"}\n-----------------------------------\n${ssidInfoText}\n-----------------------------------\n\n💡 *Tips Singkat:*\n- Jika ada perangkat dengan sinyal lemah (misalnya, di bawah -75 dBm), coba dekatkan perangkat ke modem atau periksa penghalang sinyal.\n- Jika mengalami kendala, Anda dapat mencoba me-restart modem dengan kalimat "reboot modem saya" atau melaporkannya dengan "lapor wifi saya lemot".\n\nJika ada pertanyaan lebih lanjut, jangan ragu untuk menghubungi saya lagi ya!\n\nTerima kasih,\nTim ${botNama}`;

        await reply(messageReply);

    } catch(e) {
        console.error(`[CEK_WIFI_ERROR] Gagal mengambil info WiFi untuk ${user.name} (Device ID: ${user.device_id}):`, e);

        let userFriendlyError = `*MAAF, TERJADI KESALAHAN!* 😟\n\nTidak dapat mengambil informasi modem untuk pelanggan "${user.name || 'ini'}" saat ini.\nKemungkinan penyebab:\n- Modem sedang offline atau tidak terjangkau.\n- Ada gangguan pada sistem pemantauan.`;

        if (e.response && e.response.status === 404) {
            userFriendlyError += `\n- Device ID tidak ditemukan di sistem.\n\n📞 *Hubungi admin untuk bantuan lebih lanjut.*`;
        } else {
            userFriendlyError += `\n\nSilakan coba lagi beberapa saat atau hubungi admin jika masalah berlanjut.`;
        }

        await reply(userFriendlyError);
    }
}

module.exports = {
    handleCekWifi
};
