/**
 * WiFi Password State Handler
 * Handles all conversation states related to WiFi password changes
 * 
 * CRITICAL: Contains complete state machine for WiFi password modification
 * DO NOT modify without understanding the complete flow
 */

const axios = require('axios');
const { logWifiChange } = require('../../../lib/wifi-logger');

/**
 * Handle SELECT_CHANGE_PASSWORD_MODE and SELECT_CHANGE_PASSWORD_MODE_FIRST states
 */
async function handleSelectPasswordMode(userState, userReply, reply, sender, temp) {
    const choice = userReply.trim();
    const userData = temp[sender];

    if (choice === '1') {
        // Pilihan 1: Ubah satu SSID saja
        if (userData.step === 'SELECT_CHANGE_PASSWORD_MODE') {
            // Jika password sudah ada, langsung pilih SSID
            temp[sender] = {
                step: 'SELECT_SSID_PASSWORD',
                targetUser: userData.targetUser,
                sandi_wifi_baru: userData.sandi_wifi_baru,
                bulk_ssids: userData.bulk_ssids
            };

            const ssidOptions = userData.bulk_ssids.map((id, index) =>
                `${index + 1}. SSID ID: ${id}${userData.ssid_info ? ' - ' + userData.ssid_info.split('\n')[index].split(': ')[1] : ''}`
            ).join('\n');

            reply(`Pilih nomor SSID yang ingin diubah kata sandinya:\n\n${ssidOptions}\n\nBalas dengan angka pilihan Anda.`);
        } else {
            // Jika password belum ada, tanya SSID dulu
            temp[sender] = {
                step: 'SELECT_SSID_PASSWORD_FIRST',
                targetUser: userData.targetUser,
                bulk_ssids: userData.bulk_ssids,
                ssid_info: userData.ssid_info
            };

            const ssidOptions = userData.bulk_ssids.map((id, index) =>
                `${index + 1}. SSID ID: ${id}${userData.ssid_info ? ' - ' + userData.ssid_info.split('\n')[index].split(': ')[1] : ''}`
            ).join('\n');

            reply(`Pilih nomor SSID yang ingin diubah kata sandinya:\n\n${ssidOptions}\n\nBalas dengan angka pilihan Anda.`);
        }
    } else if (choice === '2') {
        // Pilihan 2: Ubah semua SSID sekaligus
        if (userData.step === 'SELECT_CHANGE_PASSWORD_MODE') {
            // Jika password sudah ada, langsung konfirmasi
            temp[sender] = {
                step: 'CONFIRM_GANTI_SANDI_BULK',
                targetUser: userData.targetUser,
                sandi_wifi_baru: userData.sandi_wifi_baru,
                bulk_ssids: userData.bulk_ssids
            };

            reply(`Anda yakin ingin mengubah kata sandi SEMUA SSID menjadi: \`${userData.sandi_wifi_baru}\` ?\n\nBalas *'ya'* untuk melanjutkan, atau *'batal'* untuk membatalkan.`);
        } else {
            // Jika password belum ada, tanya password dulu
            temp[sender] = {
                step: 'ASK_NEW_PASSWORD_BULK',
                targetUser: userData.targetUser,
                bulk_ssids: userData.bulk_ssids
            };

            reply("Silakan ketik kata sandi WiFi baru yang Anda inginkan untuk SEMUA SSID.\n\n🔐 *Ketentuan kata sandi WiFi:*\n• Minimal 8 karakter\n• Boleh menggunakan huruf, angka, dan simbol\n• Contoh: Password123, MyWiFi2024!\n\n💡 Ketik *batal* jika ingin membatalkan proses ini.");
        }
    } else {
        reply("Pilihan tidak valid. Silakan pilih 1 untuk mengubah satu SSID atau 2 untuk mengubah semua SSID sekaligus.");
    }
}

/**
 * Handle SELECT_SSID_PASSWORD and SELECT_SSID_PASSWORD_FIRST states
 */
async function handleSelectSsidPassword(userState, userReply, reply, sender, temp) {
    const choice = parseInt(userReply.trim());
    const userData = temp[sender];

    if (isNaN(choice) || choice < 1 || choice > userData.bulk_ssids.length) {
        return reply(`Pilihan tidak valid. Silakan pilih nomor antara 1 dan ${userData.bulk_ssids.length}.`);
    }

    const selectedSsidId = userData.bulk_ssids[choice - 1];

    if (userData.step === 'SELECT_SSID_PASSWORD') {
        // Jika password sudah ada, langsung konfirmasi
        temp[sender] = {
            step: 'CONFIRM_GANTI_SANDI',
            targetUser: userData.targetUser,
            sandi_wifi_baru: userData.sandi_wifi_baru,
            ssid_id: selectedSsidId
        };

        reply(`Anda yakin ingin mengubah kata sandi WiFi SSID ${selectedSsidId} menjadi: \`${userData.sandi_wifi_baru}\` ?\n\nBalas *'ya'* untuk melanjutkan, atau *'batal'* untuk membatalkan.`);
    } else {
        // Jika password belum ada, tanya password dulu
        temp[sender] = {
            step: 'ASK_NEW_PASSWORD',
            targetUser: userData.targetUser,
            ssid_id: selectedSsidId
        };

        reply(`Silakan ketik kata sandi WiFi baru yang Anda inginkan untuk SSID ${selectedSsidId}.\n\n🔐 *Ketentuan kata sandi WiFi:*\n• Minimal 8 karakter\n• Boleh menggunakan huruf, angka, dan simbol\n• Contoh: Password123, MyWiFi2024!\n\n💡 Ketik *batal* jika ingin membatalkan proses ini.`);
    }
}

/**
 * Handle ASK_NEW_PASSWORD state
 */
async function handleAskNewPassword(userState, chats, reply, sender, temp, global) {
    const newPassword = chats.trim();
    const userData = temp[sender];

    // Validasi password WiFi
    if (newPassword.length < 8) {
        return reply(`⚠️ Kata sandi terlalu pendek, minimal harus 8 karakter.`);
    }
    if (newPassword.length > 64) {
        return reply(`⚠️ Kata sandi terlalu panjang, maksimal 64 karakter.`);
    }

    // Check config for execution mode
    if (global && global.config && global.config.custom_wifi_modification) {
        // MODE 1: Set confirmation state
        temp[sender] = {
            step: 'CONFIRM_GANTI_SANDI',
            targetUser: userData.targetUser,
            sandi_wifi_baru: newPassword,
            ssid_id: userData.ssid_id,
            current_ssid: userData.current_ssid
        };

        const ssidInfo = userData.current_ssid ? `SSID: *"${userData.current_ssid}"*\n\n` : '';
        return reply(`${ssidInfo}Anda yakin ingin mengubah kata sandi WiFi${userData.ssid_id ? ` SSID ${userData.ssid_id}` : ''} menjadi: \`${newPassword}\` ?\n\nBalas *'ya'* untuk melanjutkan, atau *'batal'* untuk membatalkan.`);
    } else {
        // MODE 2: Direct execution without confirmation
        const { setPassword } = require('../../../lib/wifi');
        
        try {
            await setPassword(userData.targetUser.device_id, userData.ssid_id || '1', newPassword);
            
            // Log the password change
            try {
                await logWifiChange({
                    userId: userData.targetUser.id,
                    deviceId: userData.targetUser.device_id,
                    changeType: 'password',
                    changes: {
                        oldPassword: '[Previous]',
                        newPassword: newPassword,  // Show actual password as requested
                        ssidId: userData.ssid_id || '1'
                    },
                    changedBy: 'customer',
                    changeSource: 'wa_bot',
                    customerName: userData.targetUser.name || 'Customer',
                    customerPhone: sender.replace('@s.whatsapp.net', ''),
                    reason: `WiFi password change via WhatsApp Bot (SSID ${userData.ssid_id || '1'})`,
                    notes: `Password changed for SSID ${userData.ssid_id || '1'}`,
                    ipAddress: 'WhatsApp',
                    userAgent: 'WhatsApp Bot'
                });
                console.log(`[WIFI_PASSWORD] Password changed for user ${userData.targetUser.id}, SSID ${userData.ssid_id || '1'}`);
            } catch (logError) {
                console.error('[WIFI_PASSWORD_LOG] Error:', logError);
                // Don't fail the operation if logging fails
            }
            
            // Clear state
            delete temp[sender];
            
            return reply(`✅ *Berhasil!*\n\nKata sandi WiFi telah diubah menjadi: \`${newPassword}\`\n\n📝 *Info Penting:*\n• Perubahan akan aktif dalam 1-2 menit\n• WiFi akan terputus dari semua perangkat\n• Silakan sambungkan kembali dengan password baru\n• Nama WiFi tetap sama, hanya password yang berubah\n\n⚠️ *PENTING:* Simpan password ini dengan baik!\n💡 Jika ada masalah, hubungi admin untuk bantuan.`);
            
        } catch (error) {
            console.error(`[ASK_NEW_PASSWORD] Error:`, error);
            delete temp[sender];
            return reply(`❌ Maaf, gagal mengubah kata sandi WiFi. Silakan coba lagi atau hubungi admin.\n\nError: ${error.message}`);
        }
    }
}

/**
 * Handle ASK_NEW_PASSWORD_BULK state
 */
async function handleAskNewPasswordBulk(userState, chats, reply, sender, temp, global) {
    const newPassword = chats.trim();

    if (newPassword.length < 8) {
        return reply(`⚠️ Password terlalu pendek! Minimal 8 karakter ya, Kak. Coba lagi atau ketik *batal*.`);
    }
    if (newPassword.length > 64) {
        return reply(`⚠️ Password terlalu panjang! Maksimal 64 karakter. Coba yang lebih pendek atau ketik *batal*.`);
    }

    userState.sandi_wifi_baru = newPassword;
    
    // Check config for execution mode
    if (global && global.config && global.config.custom_wifi_modification) {
        // MODE 1: Set confirmation state
        userState.step = 'CONFIRM_GANTI_SANDI_BULK';
        const ssidsToChange = userState.selected_ssids || userState.bulk_ssids || [];
        const ssidInfo = ssidsToChange.length > 1 
            ? `untuk *${ssidsToChange.length} SSID*` 
            : `untuk SSID ${ssidsToChange[0]}`;
        
        return reply(`Anda yakin ingin mengubah kata sandi WiFi ${ssidInfo} menjadi: \`${newPassword}\`?\n\nBalas *'ya'* untuk melanjutkan, atau *'batal'* untuk membatalkan.`);
    } else {
        // MODE 2: Direct execution without confirmation
        const { setPassword } = require('../../../lib/wifi');
        const axios = require('axios');
        
        try {
            // Execute password changes for selected SSIDs
            const ssidsToChange = userState.selected_ssids || userState.bulk_ssids || [];
            
            for (const ssidId of ssidsToChange) {
                await setPassword(userState.targetUser.device_id, ssidId, newPassword);
            }
            
            // Log the password change
            try {
                await logWifiChange({
                    userId: userState.targetUser.id,
                    deviceId: userState.targetUser.device_id,
                    changeType: 'password',
                    changes: {
                        oldPassword: '[Previous]',
                        newPassword: newPassword,  // Show actual password
                        ssidIds: ssidsToChange.join(', ')
                    },
                    changedBy: 'customer',
                    changeSource: 'wa_bot',
                    customerName: userState.targetUser.name || 'Customer',
                    customerPhone: sender.replace('@s.whatsapp.net', ''),
                    reason: `WiFi password change via WhatsApp Bot (${ssidsToChange.length} SSIDs)`,
                    notes: `Changed password for SSIDs: ${ssidsToChange.join(', ')}`,
                    ipAddress: 'WhatsApp',
                    userAgent: 'WhatsApp Bot'
                });
                console.log(`[WIFI_PASSWORD_BULK] Password changed for ${ssidsToChange.length} SSIDs`);
            } catch (logError) {
                console.error('[WIFI_PASSWORD_BULK_LOG] Error:', logError);
            }
            
            // Clear state
            delete temp[sender];
            
            const ssidInfo = ssidsToChange.length > 1 
                ? `untuk *${ssidsToChange.length} SSID*` 
                : `untuk SSID ${ssidsToChange[0]}`;
            
            return reply(`✅ *Berhasil!*\n\nKata sandi WiFi ${ssidInfo} telah diubah menjadi: \`${newPassword}\`\n\n📝 *Info Penting:*\n• Perubahan akan aktif dalam 1-2 menit\n• WiFi akan terputus dari semua perangkat\n• Silakan sambungkan kembali dengan password baru\n• Nama WiFi tetap sama, hanya password yang berubah\n\n⚠️ *PENTING:* Simpan password ini dengan baik!\n💡 Jika ada masalah, hubungi admin untuk bantuan.`);
            
        } catch (error) {
            console.error(`[ASK_NEW_PASSWORD_BULK] Error:`, error);
            delete temp[sender];
            return reply(`❌ Maaf, gagal mengubah kata sandi WiFi. Silakan coba lagi atau hubungi admin.\n\nError: ${error.message}`);
        }
    }
}

/**
 * Handle ASK_NEW_PASSWORD_BULK_AUTO state
 */
async function handleAskNewPasswordBulkAuto(userState, chats, reply, sender, temp, global, axios) {
    const newPassword = chats.trim();
    const userData = temp[sender];

    // Validasi password WiFi
    if (newPassword.length < 8) {
        return reply(`⚠️ Kata sandi terlalu pendek, minimal harus 8 karakter.`);
    }

    const { targetUser, bulk_ssids, ssid_info } = userData;

    // Tampilkan daftar SSID yang akan diubah
    if (ssid_info) {
        reply(`📋 *Daftar SSID yang akan diubah:*\n${ssid_info}\n\n⏳ Sedang mengubah kata sandi untuk *semua SSID*...`);
    } else {
        reply(`⏳ Sedang mengubah kata sandi untuk *semua SSID*...`);
    }

    // Langsung eksekusi tanpa konfirmasi
    const parameterValues = bulk_ssids.map(ssidId => {
        return [`InternetGatewayDevice.LANDevice.1.WLANConfiguration.${ssidId}.PreSharedKey.1.PreSharedKey`, newPassword, "xsd:string"];
    });

    try {
        const response = await axios.post(`${global.config.genieacsBaseUrl}/devices/${encodeURIComponent(targetUser.device_id)}/tasks?connection_request`, {
            name: 'setParameterValues',
            parameterValues: parameterValues
        });

        // Log WiFi password change for bulk
        try {
            const logData = {
                userId: targetUser.id,
                deviceId: targetUser.device_id,
                changeType: 'password',
                changes: {
                    oldPassword: '[Previous]',
                    newPassword: newPassword,  // Show actual password
                    ssidIds: bulk_ssids.join(', ')
                },
                changedBy: 'customer',
                changeSource: 'wa_bot',
                customerName: targetUser.name,
                customerPhone: sender.replace('@s.whatsapp.net', ''),
                reason: 'Perubahan password WiFi melalui WhatsApp Bot (Mode Kustom Nonaktif)',
                notes: `Mengubah password untuk ${bulk_ssids.length} SSID secara otomatis tanpa konfirmasi: ${bulk_ssids.join(', ')}`,
                ipAddress: 'WhatsApp',
                userAgent: 'WhatsApp Bot'
            };

            await logWifiChange(logData);
            console.log(`[WA_WIFI_LOG] Bulk password changed (auto): ${bulk_ssids.length} SSID(s)`);
        } catch (logError) {
            console.error(`[WA_WIFI_LOG_ERROR] ${logError.message}`);
        }
        
        reply(`✅ *Berhasil!*\n\nKata sandi WiFi untuk *semua SSID* telah diubah menjadi: \`${newPassword}\`\n\n📝 *Info Penting:*\n• Perubahan akan aktif dalam 1-2 menit\n• WiFi akan terputus dari semua perangkat\n• Silakan sambungkan kembali dengan password baru\n• Nama WiFi tetap sama, hanya password yang berubah\n\n⚠️ *PENTING:* Simpan password ini dengan baik!\n💡 Jika ada masalah, hubungi admin untuk bantuan.`);
    } catch (error) {
        console.error("[GANTI_SANDI_BULK_AUTO_ERROR]", error.response ? error.response.data : error.message);
        reply(`⚠️ Aduh, maaf. Sepertinya ada kendala teknis saat saya mencoba mengubah kata sandi WiFi Anda. Mohon pastikan modem dalam keadaan menyala dan coba lagi beberapa saat, ya.`);
    }

    delete temp[sender];
}

/**
 * Handle CONFIRM_GANTI_SANDI state
 */
async function handleConfirmGantiSandi(userState, userReply, reply, sender, temp, global, axios) {
    const response = userReply.toLowerCase().trim();
    const userData = temp[sender];

    if (['ya', 'ok', 'lanjut', 'iya', 'y'].includes(response)) {
        const { targetUser, sandi_wifi_baru, ssid_id } = userData;
        
        reply(`⏳ Sedang mengubah kata sandi WiFi SSID ${ssid_id}...`);

        try {
            const res = await axios.post(`${global.config.genieacsBaseUrl}/devices/${encodeURIComponent(targetUser.device_id)}/tasks?connection_request`, {
                name: 'setParameterValues',
                parameterValues: [
                    [`InternetGatewayDevice.LANDevice.1.WLANConfiguration.${ssid_id}.PreSharedKey.1.PreSharedKey`, sandi_wifi_baru, "xsd:string"]
                ]
            });

            // Log WiFi password change
            try {
                const { logWifiChange } = require('../../lib/wifi-logger');
                
                const logData = {
                    userId: targetUser.id,
                    deviceId: targetUser.device_id,
                    changeType: 'password',
                    changes: {
                        oldPassword: '[Previous]',
                        newPassword: sandi_wifi_baru,  // Show actual password
                        ssidId: ssid_id
                    },
                    changedBy: 'customer',
                    changeSource: 'wa_bot',
                    customerName: targetUser.name,
                    customerPhone: sender.replace('@s.whatsapp.net', ''),
                    reason: 'Perubahan password WiFi melalui WhatsApp Bot',
                    notes: `Mengubah password untuk SSID ${ssid_id}`,
                    ipAddress: 'WhatsApp',
                    userAgent: 'WhatsApp Bot'
                };

                await logWifiChange(logData);
                console.log(`[WA_WIFI_LOG] Password changed for SSID ${ssid_id} for user ${targetUser.id}`);
            } catch (logError) {
                console.error(`[WA_WIFI_LOG_ERROR] ${logError.message}`);
            }
            
            reply(`✅ *Berhasil!*\n\nKata sandi WiFi untuk SSID ${ssid_id} telah diubah menjadi: \`${sandi_wifi_baru}\`\n\n📝 *Info Penting:*\n• Perubahan akan aktif dalam 1-2 menit\n• WiFi akan terputus dari semua perangkat\n• Silakan sambungkan kembali dengan password baru\n• Nama WiFi tetap sama, hanya password yang berubah\n\n⚠️ *PENTING:* Simpan password ini dengan baik!\n💡 Jika ada masalah, hubungi admin untuk bantuan.`);
        } catch (error) {
            console.error("[GANTI_SANDI_ERROR]", error.response ? error.response.data : error.message);
            reply(`⚠️ Maaf, ada kendala teknis saat mengubah kata sandi WiFi. Mohon pastikan modem menyala dan coba lagi nanti.`);
        }

        delete temp[sender];
    } else {
        reply("Mohon balas *'ya'* untuk melanjutkan atau ketik *'batal'* untuk membatalkan.");
    }
}

/**
 * Handle CONFIRM_GANTI_SANDI_BULK state
 */
async function handleConfirmGantiSandiBulk(userState, userReply, reply, sender, temp, global, axios) {
    const response = userReply.toLowerCase().trim();
    const userData = temp[sender];

    if (['ya', 'ok', 'lanjut', 'iya', 'y'].includes(response)) {
        const { targetUser, sandi_wifi_baru, bulk_ssids } = userData;
        
        reply(`⏳ Sedang mengubah kata sandi untuk ${bulk_ssids.length} SSID...`);

        const parameterValues = bulk_ssids.map(ssidId => {
            return [`InternetGatewayDevice.LANDevice.1.WLANConfiguration.${ssidId}.PreSharedKey.1.PreSharedKey`, sandi_wifi_baru, "xsd:string"];
        });

        try {
            const res = await axios.post(`${global.config.genieacsBaseUrl}/devices/${encodeURIComponent(targetUser.device_id)}/tasks?connection_request`, {
                name: 'setParameterValues',
                parameterValues: parameterValues
            });

            // Log WiFi password change for bulk
            try {
                const logData = {
                    userId: targetUser.id,
                    deviceId: targetUser.device_id,
                    changeType: 'password',
                    changes: {
                        oldPassword: '[Previous]',
                        newPassword: sandi_wifi_baru,  // Show actual password
                        ssidIds: bulk_ssids.join(', ')
                    },
                    changedBy: 'customer',
                    changeSource: 'wa_bot',
                    customerName: targetUser.name,
                    customerPhone: sender.replace('@s.whatsapp.net', ''),
                    reason: 'Perubahan password WiFi melalui WhatsApp Bot (Bulk)',
                    notes: `Mengubah password untuk ${bulk_ssids.length} SSID: ${bulk_ssids.join(', ')}`,
                    ipAddress: 'WhatsApp',
                    userAgent: 'WhatsApp Bot'
                };

                await logWifiChange(logData);
                console.log(`[WA_WIFI_LOG] Bulk password changed: ${bulk_ssids.length} SSID(s) for user ${targetUser.id}`);
            } catch (logError) {
                console.error(`[WA_WIFI_LOG_ERROR] ${logError.message}`);
            }
            
            reply(`✅ *Berhasil!*\n\nKata sandi WiFi untuk *${bulk_ssids.length} SSID* telah diubah menjadi: \`${sandi_wifi_baru}\`\n\n📝 *Info Penting:*\n• Perubahan akan aktif dalam 1-2 menit\n• WiFi akan terputus dari semua perangkat\n• Silakan sambungkan kembali dengan password baru\n• Nama WiFi tetap sama, hanya password yang berubah\n\n⚠️ *PENTING:* Simpan password ini dengan baik!\n💡 Jika ada masalah, hubungi admin untuk bantuan.`);
        } catch (error) {
            console.error("[GANTI_SANDI_BULK_ERROR]", error.response ? error.response.data : error.message);
            reply(`⚠️ Maaf, ada kendala teknis saat mengubah kata sandi WiFi. Mohon pastikan modem menyala dan coba lagi nanti.`);
        }

        delete temp[sender];
    } else {
        reply("Mohon balas *'ya'* untuk melanjutkan atau ketik *'batal'* untuk membatalkan.");
    }
}

module.exports = {
    handleSelectPasswordMode,
    handleSelectSsidPassword,
    handleAskNewPassword,
    handleAskNewPasswordBulk,
    handleAskNewPasswordBulkAuto,
    handleConfirmGantiSandi,
    handleConfirmGantiSandiBulk
};
