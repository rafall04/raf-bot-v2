/**
 * WiFi Name State Handler
 * Handles all conversation states related to WiFi name changes
 * 
 * CRITICAL: Contains complete state machine for WiFi name modification
 * DO NOT modify without understanding the complete flow
 */

const axios = require('axios');

/**
 * Handle SELECT_CHANGE_MODE and SELECT_CHANGE_MODE_FIRST states
 */
async function handleSelectChangeMode(userState, userReply, reply) {
    const choice = userReply.trim();
    
    if (choice === '1') { // Ubah satu SSID
        userState.step = 'SELECT_SSID_TO_CHANGE';
        const ssidList = userState.ssid_info || userState.bulk_ssids.map((id, index) => `${index + 1}. SSID ${id}`).join('\n');
        return reply(`Baik, Anda memilih untuk mengubah satu SSID.\n\nBerikut daftar SSID Anda:\n${ssidList}\n\nSilakan balas dengan *nomor* SSID yang ingin Anda ubah (misalnya: \`1\`).`);
    } else if (choice === '2') { // Ubah semua SSID
        if (userState.nama_wifi_baru) { // Jika nama sudah ada, langsung konfirmasi
            userState.step = 'CONFIRM_GANTI_NAMA_BULK';
            userState.selected_ssid_indices = userState.bulk_ssids.map((_, index) => index); // Pilih semua
            return reply(`Siap! Nama untuk *semua SSID* akan diubah menjadi *"${userState.nama_wifi_baru}"*.\n\nSudah benar? Balas *'ya'* untuk melanjutkan.`);
        } else { // Jika nama belum ada, tanya dulu
            userState.step = 'ASK_NEW_NAME_FOR_BULK';
            return reply("Oke, Anda memilih untuk mengubah semua SSID sekaligus. Silakan ketik nama WiFi baru yang Anda inginkan.\n\n📝 *Ketentuan nama WiFi:*\n• Maksimal 32 karakter\n• Boleh menggunakan huruf, angka, spasi, titik, dan tanda hubung\n• Contoh: WiFiRumah, Keluarga-Bahagia\n\n💡 Ketik *batal* jika ingin membatalkan proses ini.");
        }
    } else {
        return reply("Pilihan tidak valid. Mohon balas dengan angka *1* atau *2*.");
    }
}

/**
 * Handle SELECT_SSID_TO_CHANGE state
 */
async function handleSelectSsidToChange(userState, userReply, reply) {
    const choiceIndex = parseInt(userReply, 10) - 1;
    
    if (isNaN(choiceIndex) || choiceIndex < 0 || choiceIndex >= userState.bulk_ssids.length) {
        return reply("Nomor SSID tidak valid. Mohon balas dengan nomor yang sesuai dari daftar.");
    }
    
    userState.selected_ssid_indices = [choiceIndex]; // Simpan index SSID yang dipilih

    if (userState.nama_wifi_baru) { // Jika nama sudah ada, langsung konfirmasi
        userState.step = 'CONFIRM_GANTI_NAMA_BULK';
        const selectedSsidId = userState.bulk_ssids[choiceIndex];
        return reply(`Baik. Nama untuk *SSID ${selectedSsidId}* akan diubah menjadi *"${userState.nama_wifi_baru}"*.\n\nSudah benar? Balas *'ya'* untuk melanjutkan.`);
    } else { // Jika nama belum ada, tanya dulu
        userState.step = 'ASK_NEW_NAME_FOR_SINGLE_BULK';
        return reply("Oke. Sekarang, silakan ketik nama WiFi baru yang Anda inginkan untuk SSID tersebut.\n\n📝 *Ketentuan nama WiFi:*\n• Maksimal 32 karakter\n• Boleh menggunakan huruf, angka, spasi, titik, dan tanda hubung\n• Contoh: WiFiRumah, Keluarga-Bahagia\n\n💡 Ketik *batal* jika ingin membatalkan proses ini.");
    }
}

/**
 * Handle ASK_NEW_NAME_FOR_SINGLE, ASK_NEW_NAME_FOR_SINGLE_BULK and ASK_NEW_NAME_FOR_BULK states
 */
async function handleAskNewName(userState, chats, reply, sender, temp, global) {
    const newName = chats.trim();
    
    if (newName.length === 0) {
        return reply(`Nama WiFi tidak boleh kosong ya, Kak. Silakan ketik nama yang baru atau ketik *batal*.`);
    }
    if (newName.length > 32) {
        return reply(`Wah, nama WiFi-nya terlalu panjang (maksimal 32 karakter). Coba yang lebih pendek ya, atau ketik *batal*.`);
    }
    if (/[^\w\s\-.]/.test(newName)) {
        return reply(`⚠️ Nama WiFi mengandung karakter yang tidak diperbolehkan. Gunakan hanya huruf, angka, spasi, titik, dan tanda hubung.`);
    }

    userState.nama_wifi_baru = newName;
    
    // Check config for execution mode
    if (global && global.config && global.config.custom_wifi_modification) {
        // MODE 1: Set confirmation state
        // Determine next step based on whether it's single or bulk
        if (userState.ssid_id && !userState.bulk_ssids) {
            // Single SSID without bulk
            userState.step = 'CONFIRM_GANTI_NAMA';
            return reply(`Baik. Nama WiFi akan diubah menjadi *"${newName}"*. Sudah benar?\n\nBalas *'ya'* untuk melanjutkan, atau *'batal'* untuk membatalkan.`);
        } else {
            // Bulk cases
            userState.step = 'CONFIRM_GANTI_NAMA_BULK';
            
            if (userState.selected_ssid_indices && userState.selected_ssid_indices.length === 1) {
                const selectedSsidId = userState.bulk_ssids[userState.selected_ssid_indices[0]];
                return reply(`Siap. Saya konfirmasi ya, nama untuk *SSID ${selectedSsidId}* akan diubah menjadi *"${newName}"*. Sudah benar?\n\nBalas *'ya'* untuk melanjutkan.`);
            } else {
                userState.selected_ssid_indices = userState.bulk_ssids.map((_, index) => index);
                return reply(`Siap. Saya konfirmasi ya, nama untuk *semua SSID* akan diubah menjadi *"${newName}"*. Sudah benar?\n\nBalas *'ya'* untuk melanjutkan.`);
            }
        }
    } else {
        // MODE 2: Direct execution without confirmation
        const { setSSIDName, getSSIDInfo } = require('../../../lib/wifi');
        const { logWifiChange } = require('../../../lib/wifi-logger');
        const axios = require('axios');
        
        try {
            // Determine SSIDs to change
            let ssidsToChange = [];
            
            if (userState.ssid_id && !userState.bulk_ssids) {
                // Single SSID without bulk
                ssidsToChange = [userState.ssid_id];
            } else if (userState.selected_ssid_indices && userState.selected_ssid_indices.length === 1) {
                // Single SSID from bulk selection
                ssidsToChange = [userState.bulk_ssids[userState.selected_ssid_indices[0]]];
            } else {
                // All SSIDs in bulk
                ssidsToChange = userState.bulk_ssids || [];
            }
            
            // Fetch old name before changing
            let oldName = 'Previous';
            try {
                const oldInfo = await getSSIDInfo(userState.targetUser.device_id);  // No second parameter!
                if (oldInfo && oldInfo.ssid && Array.isArray(oldInfo.ssid)) {
                    // Find the specific SSID being changed
                    const targetSsid = oldInfo.ssid.find(s => String(s.id) === String(ssidsToChange[0] || '1'));
                    oldName = targetSsid?.name || 'Unknown';
                }
            } catch (fetchErr) {
                console.log('[WIFI_NAME] Could not fetch old name:', fetchErr.message);
            }
            
            // Execute name changes
            for (const ssidId of ssidsToChange) {
                await setSSIDName(userState.targetUser.device_id, ssidId, newName);
            }
            
            // Log the change with CORRECT field names
            await logWifiChange({
                userId: userState.targetUser.id,
                deviceId: userState.targetUser.device_id,
                changeType: 'ssid_name',  // Use correct type
                changes: {
                    oldSsidName: oldName,  // Use correct field name
                    newSsidName: newName   // Use correct field name
                },
                changedBy: 'customer',
                changeSource: 'wa_bot',
                customerName: userState.targetUser.name || 'Customer',
                customerPhone: sender.replace('@s.whatsapp.net', ''),
                reason: `WiFi name change via WhatsApp Bot (SSID ${ssidsToChange[0] || '1'})`,
                notes: ssidsToChange.length > 1 ? `Changed ${ssidsToChange.length} SSIDs: ${ssidsToChange.join(', ')}` : `Changed SSID ${ssidsToChange[0] || '1'} only`,
                ipAddress: 'WhatsApp',
                userAgent: 'WhatsApp Bot'
            });
            
            // Clear state
            delete temp[sender];
            
            // Send success message
            const ssidInfo = ssidsToChange.length > 1 
                ? `untuk *${ssidsToChange.length} SSID*` 
                : ssidsToChange.length === 1 
                    ? `untuk SSID ${ssidsToChange[0]}`
                    : '';
                    
            return reply(`✅ *Berhasil!*\n\nNama WiFi ${ssidInfo} telah diubah menjadi: *"${newName}"*\n\n📝 *Info Penting:*\n• Perubahan akan aktif dalam 1-2 menit\n• WiFi dengan nama lama akan terputus\n• Silakan cari WiFi dengan nama baru di perangkat Anda\n• Gunakan password yang sama untuk menyambung\n\n💡 Jika ada masalah, hubungi admin untuk bantuan.`);
            
        } catch (error) {
            console.error(`[ASK_NEW_NAME] Error:`, error);
            delete temp[sender];
            return reply(`❌ Maaf, gagal mengubah nama WiFi. Silakan coba lagi atau hubungi admin.\n\nError: ${error.message}`);
        }
    }
}

/**
 * Handle ASK_NEW_NAME_FOR_BULK_AUTO state
 */
async function handleAskNewNameBulkAuto(userState, chats, reply, sender, temp, global, axios) {
    const newName = chats.trim();
    
    if (newName.length === 0) return reply(`Nama WiFi tidak boleh kosong ya, Kak. Silakan ketik nama yang baru atau ketik *batal*.`);
    if (newName.length > 32) return reply(`Wah, nama WiFi-nya terlalu panjang (maksimal 32 karakter). Coba yang lebih pendek ya, atau ketik *batal*.`);
    if (/[^\w\s\-.]/.test(newName)) return reply(`⚠️ Nama WiFi mengandung karakter yang tidak diperbolehkan. Gunakan hanya huruf, angka, spasi, titik, dan tanda hubung.`);

    const { targetUser, bulk_ssids, ssid_info } = userState;

    // Tampilkan daftar SSID yang akan diubah
    if (ssid_info) {
        reply(`📋 *Daftar SSID yang akan diubah:*\n${ssid_info}\n\n⏳ Sedang mengubah semua nama WiFi menjadi *"${newName}"*...`);
    } else {
        reply(`⏳ Sedang mengubah semua nama WiFi menjadi *"${newName}"*...`);
    }

    // Langsung eksekusi tanpa konfirmasi untuk nama WiFi
    const parameterValues = bulk_ssids.map(ssidId => {
        return [`InternetGatewayDevice.LANDevice.1.WLANConfiguration.${ssidId}.SSID`, newName, "xsd:string"];
    });

    try {
        const response = await axios.post(`${global.config.genieacsBaseUrl}/devices/${encodeURIComponent(targetUser.device_id)}/tasks?connection_request`, {
            name: 'setParameterValues',
            parameterValues: parameterValues
        });

        // Log WiFi change
        try {
            const { logWifiChange } = require('../../lib/wifi-logger');
            
            const nameChangeDetails = bulk_ssids.map(ssidId => 
                `SSID ${ssidId} name changed to "${newName}"`
            ).join('; ');
            
            const logData = {
                userId: targetUser.id,
                deviceId: targetUser.device_id,
                changeType: 'ssid_name',
                changes: {
                    oldSsidName: 'Multiple SSIDs',
                    newSsidName: nameChangeDetails
                },
                changedBy: 'customer',
                changeSource: 'wa_bot',
                customerName: targetUser.name,
                customerPhone: sender.replace('@s.whatsapp.net', ''),
                reason: 'Perubahan nama WiFi melalui WhatsApp Bot (Mode Kustom Nonaktif)',
                notes: `Mengubah nama untuk ${bulk_ssids.length} SSID secara otomatis`,
                ipAddress: 'WhatsApp',
                userAgent: 'WhatsApp Bot'
            };

            await logWifiChange(logData);
            console.log(`[WA_WIFI_LOG] WiFi name changed (auto): ${bulk_ssids.length} SSID(s) for user ${targetUser.id}`);
        } catch (logError) {
            console.error(`[WA_WIFI_LOG_ERROR] ${logError.message}`);
        }
        
        reply(`✨ Berhasil! Nama WiFi untuk *semua SSID* Anda sudah diubah menjadi *"${newName}"*.\n\nSilakan cari nama WiFi baru tersebut di perangkat Anda dan sambungkan kembali menggunakan kata sandi yang sama ya. Jika ada kendala, jangan ragu hubungi saya lagi! 😊`);
    } catch (error) {
        console.error("[GANTI_NAMA_BULK_AUTO_ERROR]", error.response ? error.response.data : error.message);
        reply(`⚠️ Aduh, maaf Kak. Sepertinya ada kendala teknis saat saya mencoba mengubah nama WiFi Anda. Mohon pastikan modem dalam keadaan menyala dan coba lagi beberapa saat, ya.`);
    }

    delete temp[sender];
}

/**
 * Handle CONFIRM_GANTI_NAMA and CONFIRM_GANTI_NAMA_BULK states
 */
async function handleConfirmGantiNamaBulk(userState, userReply, reply, sender, temp, global, axios) {
    if (['ya', 'ok', 'lanjut', 'iya', 'y'].includes(userReply)) {
        const { targetUser, nama_wifi_baru, bulk_ssids, selected_ssid_indices, ssid_id } = userState;

        let parameterValues;
        
        if (ssid_id && !bulk_ssids) {
            // Single SSID case (CONFIRM_GANTI_NAMA)
            parameterValues = [
                [`InternetGatewayDevice.LANDevice.1.WLANConfiguration.${ssid_id}.SSID`, nama_wifi_baru, "xsd:string"]
            ];
        } else {
            // Bulk case (CONFIRM_GANTI_NAMA_BULK)
            parameterValues = selected_ssid_indices.map(index => {
                const ssidId = bulk_ssids[index];
                return [`InternetGatewayDevice.LANDevice.1.WLANConfiguration.${ssidId}.SSID`, nama_wifi_baru, "xsd:string"];
            });
        }

        reply(`Oke, ditunggu sebentar ya. Saya sedang proses perubahan nama WiFi untuk *${targetUser.name}*... ⏳`);

        try {
            const response = await axios.post(`${global.config.genieacsBaseUrl}/devices/${encodeURIComponent(targetUser.device_id)}/tasks?connection_request`, {
                name: 'setParameterValues',
                parameterValues: parameterValues
            });

            // Log WiFi change
            try {
                const { logWifiChange } = require('../../lib/wifi-logger');
                const { getSSIDInfo } = require('../../lib/wifi');
                
                // Get current SSID info to log actual old names
                let ssidChangeDetails = [];
                try {
                    const { ssid } = await getSSIDInfo(targetUser.device_id);
                    
                    selected_ssid_indices.forEach(index => {
                        const ssidId = bulk_ssids[index];
                        const matchedSSID = ssid.find(s => String(s.id) === String(ssidId));
                        const oldName = matchedSSID?.name || 'Unknown';
                        ssidChangeDetails.push(`SSID ${ssidId}: "${oldName}" → "${nama_wifi_baru}"`);
                    });
                } catch (ssidError) {
                    console.warn(`[WA_WIFI_LOG] SSID info unavailable: ${ssidError.message}`);
                    // Fallback to generic info
                    selected_ssid_indices.forEach(index => {
                        const ssidId = bulk_ssids[index];
                        ssidChangeDetails.push(`SSID ${ssidId}: "Unknown" → "${nama_wifi_baru}"`);
                    });
                }
                
                const logData = {
                    userId: targetUser.id,
                    deviceId: targetUser.device_id,
                    changeType: 'ssid_name',
                    changes: {
                        oldSsidName: selected_ssid_indices.length === 1 ? 'Single SSID' : 'Multiple SSIDs',
                        newSsidName: ssidChangeDetails.join('; ')
                    },
                    changedBy: 'customer',
                    changeSource: 'wa_bot',
                    customerName: targetUser.name,
                    customerPhone: sender.replace('@s.whatsapp.net', ''),
                    reason: 'Perubahan nama WiFi melalui WhatsApp Bot',
                    notes: `Mengubah ${selected_ssid_indices.length} SSID dari total ${bulk_ssids.length} SSID`,
                    ipAddress: 'WhatsApp',
                    userAgent: 'WhatsApp Bot'
                };

                await logWifiChange(logData);
                console.log(`[WA_WIFI_LOG] WiFi name changed: ${ssidChangeDetails.length} SSID(s) for user ${targetUser.id}`);
            } catch (logError) {
                console.error(`[WA_WIFI_LOG_ERROR] ${logError.message}`);
            }
            
            reply(`✨ Berhasil! Nama WiFi Anda sudah saya ubah menjadi *"${nama_wifi_baru}"*.\n\nSilakan cari nama WiFi baru tersebut di perangkat Anda dan sambungkan kembali menggunakan kata sandi yang sama ya. Jika ada kendala, jangan ragu hubungi saya lagi! 😊`);
        } catch (error) {
            console.error("[GANTINAMA_BULK_ERROR]", error.response ? error.response.data : error.message);
            reply(`⚠️ Aduh, maaf Kak. Sepertinya ada kendala teknis saat saya mencoba mengubah nama WiFi Anda. Mohon pastikan modem dalam keadaan menyala dan coba lagi beberapa saat, ya. Jika masih gagal, silakan hubungi Admin.`);
        }
        
        delete temp[sender];
    } else {
        reply("Mohon balas *'ya'* untuk melanjutkan atau ketik *'batal'* untuk membatalkan.");
    }
}

module.exports = {
    handleSelectChangeMode,
    handleSelectSsidToChange,
    handleAskNewName,
    handleAskNewNameBulkAuto,
    handleConfirmGantiNamaBulk
};
