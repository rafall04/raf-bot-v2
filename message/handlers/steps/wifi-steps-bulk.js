"use strict";

/**
 * WiFi Conversation Steps dengan Bulk SSID Support
 * Menangani percakapan multi-step untuk operasi WiFi dengan Mode Kustom
 */

const axios = require('axios');
const { setSSIDName, setPassword, getSSIDInfo } = require("../../../lib/wifi");
const { isDeviceOnline, getDeviceOfflineMessage } = require('../../../lib/device-status');

/**
 * Safe error message handler - hides sensitive information
 * @param {Error} error - The error object
 * @returns {string} Safe error message for user
 */
function getSafeErrorMessage(error) {
    // Log full error for debugging (admin can see in console/logs)
    console.error('[WIFI_ERROR_DETAILS]', error);
    
    // Return safe message to user (no IP, no technical details)
    if (error.code === 'ETIMEDOUT' || error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
        return '❌ Tidak dapat terhubung ke server. Silakan coba beberapa saat lagi atau hubungi admin.';
    } else if (error.response && error.response.status >= 500) {
        return '❌ Server sedang mengalami gangguan. Silakan hubungi admin.';
    } else if (error.response && error.response.status >= 400) {
        return '❌ Terjadi kesalahan pada permintaan. Silakan hubungi admin.';
    } else if (error.message && error.message.includes('network')) {
        return '❌ Gangguan koneksi jaringan. Silakan coba lagi atau hubungi admin.';
    } else {
        return '❌ Terjadi kesalahan. Silakan coba lagi atau hubungi admin.';
    }
}

/**
 * Handle WiFi password change conversation steps
 */
async function handleWifiPasswordSteps({ userState, sender, chats, pushname, reply, setUserState, deleteUserState }) {
    const userReply = chats.toLowerCase().trim();
    
    switch (userState.step) {
        // Step 1: Pilih mode perubahan (dengan password)
        case 'SELECT_CHANGE_PASSWORD_MODE': {
            const choice = chats.trim();
            
            if (choice === '1') {
                // Pilih satu SSID
                userState.step = 'SELECT_SSID_PASSWORD';
                setUserState(sender, userState);
                
                let message = `📡 *Pilih SSID yang Akan Diubah*\n\n`;
                userState.bulk_ssids.forEach((ssidId, index) => {
                    message += `${index + 1}. SSID ${ssidId}\n`;
                });
                message += `\nBalas dengan nomor SSID yang ingin diubah.`;
                
                return { success: true, message };
                
            } else if (choice === '2') {
                // Ubah semua SSID
                const { targetUser, sandi_wifi_baru, bulk_ssids } = userState;
                
                reply(`⏳ Memeriksa status perangkat...`);
                
                // Check if device is online
                const deviceStatus = await isDeviceOnline(targetUser.device_id);
                
                if (!deviceStatus.online) {
                    deleteUserState(sender);
                    return {
                        success: false,
                        message: getDeviceOfflineMessage(targetUser.name, deviceStatus.minutesAgo)
                    };
                }
                
                reply(`⏳ Sedang mengubah sandi WiFi untuk *semua SSID*...`);
                
                try {
                    // Prepare parameter values untuk semua SSIDs
                    const parameterValues = bulk_ssids.map(ssidId => {
                        return [`InternetGatewayDevice.LANDevice.1.WLANConfiguration.${ssidId}.PreSharedKey.1.PreSharedKey`, sandi_wifi_baru, "xsd:string"];
                    });
                    
                    const response = await axios.post(
                        `${global.config.genieacsBaseUrl}/devices/${encodeURIComponent(targetUser.device_id)}/tasks?connection_request`,
                        {
                            name: 'setParameterValues',
                            parameterValues: parameterValues
                        }
                    );
                    
                    if (response.status === 200 || response.status === 202) {
                        deleteUserState(sender);
                        return {
                            success: true,
                            message: `✅ *Permintaan Diterima*\n\n` +
                                   `Perubahan sandi WiFi sedang diproses.\n\n` +
                                   `*Perhatian:*\n` +
                                   `• Modem akan restart otomatis (1-2 menit)\n` +
                                   `• Semua perangkat akan terputus\n` +
                                   `• Gunakan sandi baru: *${sandi_wifi_baru}*\n\n` +
                                   `_Jika tidak berubah setelah 5 menit, silakan hubungi teknisi._`
                        };
                    } else {
                        throw new Error(`GenieACS returned status ${response.status}`);
                    }
                } catch (error) {
                    deleteUserState(sender);
                    return {
                        success: false,
                        message: getSafeErrorMessage(error)
                    };
                }
            }
            
            return {
                success: false,
                message: "Pilihan tidak valid. Mohon balas dengan angka *1* atau *2*."
            };
        }
        
        // Step 1 Alternative: Pilih mode dulu (tanpa password)
        case 'SELECT_CHANGE_PASSWORD_MODE_FIRST': {
            const choice = chats.trim();
            
            if (choice === '1') {
                userState.step = 'SELECT_SSID_PASSWORD_FIRST';
                setUserState(sender, userState);
                
                let message = `📡 *Pilih SSID yang Akan Diubah*\n\n`;
                userState.bulk_ssids.forEach((ssidId, index) => {
                    message += `${index + 1}. SSID ${ssidId}\n`;
                });
                message += `\nBalas dengan nomor SSID yang ingin diubah.`;
                
                return { success: true, message };
                
            } else if (choice === '2') {
                userState.step = 'ASK_NEW_PASSWORD_FOR_BULK';
                setUserState(sender, userState);
                
                return {
                    success: true,
                    message: `🔐 Silakan ketik sandi WiFi baru yang akan digunakan untuk *semua SSID*.\n\n*Ketentuan:*\n• Minimal 8 karakter\n• Kombinasi huruf dan angka lebih aman\n\nKetik *batal* untuk membatalkan.`
                };
            }
            
            return {
                success: false,
                message: "Pilihan tidak valid. Mohon balas dengan angka *1* atau *2*."
            };
        }
        
        // Step 2: Pilih SSID spesifik (dengan password)
        case 'SELECT_SSID_PASSWORD': {
            const choiceIndex = parseInt(chats, 10) - 1;
            
            if (isNaN(choiceIndex) || choiceIndex < 0 || choiceIndex >= userState.bulk_ssids.length) {
                return {
                    success: false,
                    message: "Nomor SSID tidak valid. Mohon balas dengan nomor yang sesuai dari daftar."
                };
            }
            
            const selectedSsidId = userState.bulk_ssids[choiceIndex];
            const { targetUser, sandi_wifi_baru } = userState;
            
            reply(`⏳ Memeriksa status perangkat...`);
            
            // Check if device is online
            const deviceStatus = await isDeviceOnline(targetUser.device_id);
            
            if (!deviceStatus.online) {
                deleteUserState(sender);
                return {
                    success: false,
                    message: getDeviceOfflineMessage(targetUser.name, deviceStatus.minutesAgo)
                };
            }
            
            reply(`⏳ Sedang mengubah sandi WiFi untuk SSID ${selectedSsidId}...`);
            
            try {
                const response = await axios.post(
                    `${global.config.genieacsBaseUrl}/devices/${encodeURIComponent(targetUser.device_id)}/tasks?connection_request`,
                    {
                        name: 'setParameterValues',
                        parameterValues: [
                            [`InternetGatewayDevice.LANDevice.1.WLANConfiguration.${selectedSsidId}.PreSharedKey.1.PreSharedKey`, sandi_wifi_baru, "xsd:string"]
                        ]
                    }
                );
                
                if (response.status === 200 || response.status === 202) {
                    deleteUserState(sender);
                    return {
                        success: true,
                        message: `✅ *Permintaan Diterima*\n\n` +
                               `Perubahan sandi WiFi untuk SSID ${selectedSsidId} sedang diproses.\n\n` +
                               `*Perhatian:*\n` +
                               `• Modem akan restart otomatis (1-2 menit)\n` +
                               `• Perangkat akan terputus sementara\n` +
                               `• Gunakan sandi baru: *${sandi_wifi_baru}*\n\n` +
                               `_Jika tidak berubah setelah 5 menit, silakan hubungi teknisi._`
                    };
                } else {
                    throw new Error(`GenieACS returned status ${response.status}`);
                }
            } catch (error) {
                console.error('[SINGLE_PASSWORD_CHANGE_ERROR]', error);
                deleteUserState(sender);
                return {
                    success: false,
                    message: `❌ Gagal mengubah sandi WiFi: ${error.message}`
                };
            }
        }
        
        // Step 2 Alternative: Pilih SSID dulu baru minta password
        case 'SELECT_SSID_PASSWORD_FIRST': {
            const choiceIndex = parseInt(chats, 10) - 1;
            
            if (isNaN(choiceIndex) || choiceIndex < 0 || choiceIndex >= userState.bulk_ssids.length) {
                return {
                    success: false,
                    message: "Nomor SSID tidak valid. Mohon balas dengan nomor yang sesuai dari daftar."
                };
            }
            
            userState.selected_ssid = userState.bulk_ssids[choiceIndex];
            userState.step = 'ASK_NEW_PASSWORD_FOR_SINGLE';
            setUserState(sender, userState);
            
            return {
                success: true,
                message: `🔐 Silakan ketik sandi WiFi baru untuk *SSID ${userState.selected_ssid}*.\n\n*Ketentuan:*\n• Minimal 8 karakter\n• Kombinasi huruf dan angka lebih aman\n\nKetik *batal* untuk membatalkan.`
            };
        }
        
        // Step 3: Input password untuk single SSID
        case 'ASK_NEW_PASSWORD_FOR_SINGLE': {
            if (userReply === 'batal') {
                deleteUserState(sender);
                return {
                    success: true,
                    message: '❌ Perubahan sandi WiFi dibatalkan.'
                };
            }
            
            const newPassword = chats.trim();
            if (newPassword.length < 8) {
                return {
                    success: false,
                    message: `❌ Sandi WiFi terlalu pendek (minimal 8 karakter).`
                };
            }
            
            const { targetUser, selected_ssid } = userState;
            
            reply(`⏳ Memeriksa status perangkat...`);
            
            // Check if device is online
            const deviceStatus = await isDeviceOnline(targetUser.device_id);
            
            if (!deviceStatus.online) {
                deleteUserState(sender);
                return {
                    success: false,
                    message: getDeviceOfflineMessage(targetUser.name, deviceStatus.minutesAgo)
                };
            }
            
            reply(`⏳ Sedang mengubah sandi WiFi untuk SSID ${selected_ssid}...`);
            
            try {
                const response = await axios.post(
                    `${global.config.genieacsBaseUrl}/devices/${encodeURIComponent(targetUser.device_id)}/tasks?connection_request`,
                    {
                        name: 'setParameterValues',
                        parameterValues: [
                            [`InternetGatewayDevice.LANDevice.1.WLANConfiguration.${selected_ssid}.PreSharedKey.1.PreSharedKey`, newPassword, "xsd:string"]
                        ]
                    }
                );
                
                if (response.status === 200 || response.status === 202) {
                    deleteUserState(sender);
                    return {
                        success: true,
                        message: `✅ *Berhasil!*\n\nSandi WiFi untuk *SSID ${selected_ssid}* telah diubah menjadi:\n🔐 *${newPassword}*`
                    };
                } else {
                    throw new Error(`GenieACS returned status ${response.status}`);
                }
            } catch (error) {
                console.error('[SINGLE_PASSWORD_CHANGE_ERROR]', error);
                deleteUserState(sender);
                return {
                    success: false,
                    message: `❌ Gagal mengubah sandi WiFi: ${error.message}`
                };
            }
        }
        
        // Step 3: Input password untuk bulk
        case 'ASK_NEW_PASSWORD_FOR_BULK': {
            if (userReply === 'batal') {
                deleteUserState(sender);
                return {
                    success: true,
                    message: '❌ Perubahan sandi WiFi dibatalkan.'
                };
            }
            
            const newPassword = chats.trim();
            if (newPassword.length < 8) {
                return {
                    success: false,
                    message: `❌ Sandi WiFi terlalu pendek (minimal 8 karakter).`
                };
            }
            
            const { targetUser, bulk_ssids } = userState;
            
            reply(`⏳ Memeriksa status perangkat...`);
            
            // Check if device is online
            const deviceStatus = await isDeviceOnline(targetUser.device_id);
            
            if (!deviceStatus.online) {
                deleteUserState(sender);
                return {
                    success: false,
                    message: getDeviceOfflineMessage(targetUser.name, deviceStatus.minutesAgo)
                };
            }
            
            reply(`⏳ Sedang mengubah sandi WiFi untuk *semua SSID*...`);
            
            try {
                const parameterValues = bulk_ssids.map(ssidId => {
                    return [`InternetGatewayDevice.LANDevice.1.WLANConfiguration.${ssidId}.PreSharedKey.1.PreSharedKey`, newPassword, "xsd:string"];
                });
                
                const response = await axios.post(
                    `${global.config.genieacsBaseUrl}/devices/${encodeURIComponent(targetUser.device_id)}/tasks?connection_request`,
                    {
                        name: 'setParameterValues',
                        parameterValues: parameterValues
                    }
                );
                
                if (response.status === 200 || response.status === 202) {
                    deleteUserState(sender);
                    return {
                        success: true,
                        message: `✅ *Permintaan Diterima*\n\n` +
                               `Perubahan sandi WiFi untuk semua SSID sedang diproses.\n\n` +
                               `*Perhatian:*\n` +
                               `• Modem akan restart otomatis (1-2 menit)\n` +
                               `• Semua perangkat akan terputus\n` +
                               `• Gunakan sandi baru: *${newPassword}*\n\n` +
                               `_Jika tidak berubah setelah 5 menit, silakan hubungi teknisi._`
                    };
                } else {
                    throw new Error(`GenieACS returned status ${response.status}`);
                }
            } catch (error) {
                console.error('[BULK_PASSWORD_CHANGE_ERROR]', error);
                deleteUserState(sender);
                return {
                    success: false,
                    message: `❌ Gagal mengubah sandi WiFi: ${error.message}`
                };
            }
        }
        
        // Fallback untuk step ASK_NEW_PASSWORD (single mode tanpa bulk)
        case 'ASK_NEW_PASSWORD': {
            if (userReply === 'batal') {
                deleteUserState(sender);
                return {
                    success: true,
                    message: '❌ Perubahan sandi WiFi dibatalkan.'
                };
            }
            
            const newPassword = chats.trim();
            if (newPassword.length < 8) {
                return {
                    success: false,
                    message: `❌ Sandi WiFi terlalu pendek (minimal 8 karakter).`
                };
            }
            
            const { targetUser } = userState;
            
            reply(`⏳ Memeriksa status perangkat...`);
            
            // Check if device is online
            const deviceStatus2 = await isDeviceOnline(targetUser.device_id);
            
            if (!deviceStatus2.online) {
                deleteUserState(sender);
                return {
                    success: false,
                    message: getDeviceOfflineMessage(targetUser.name, deviceStatus2.minutesAgo)
                };
            }
            
            reply(`⏳ Sedang mengubah sandi WiFi...`);
            
            try {
                const response = await axios.post(
                    `${global.config.genieacsBaseUrl}/devices/${encodeURIComponent(targetUser.device_id)}/tasks?connection_request`,
                    {
                        name: 'setParameterValues',
                        parameterValues: [
                            [`InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.PreSharedKey.1.PreSharedKey`, newPassword, "xsd:string"]
                        ]
                    }
                );
                
                if (response.status === 200 || response.status === 202) {
                    deleteUserState(sender);
                    return {
                        success: true,
                        message: `✅ *Berhasil!*\n\nSandi WiFi telah diubah menjadi:\n🔐 *${newPassword}*`
                    };
                } else {
                    throw new Error(`GenieACS returned status ${response.status}`);
                }
            } catch (error) {
                console.error('[PASSWORD_CHANGE_ERROR]', error);
                deleteUserState(sender);
                return {
                    success: false,
                    message: `❌ Gagal mengubah sandi WiFi: ${error.message}`
                };
            }
        }
    }
    
    return {
        success: false,
        message: '❌ State tidak dikenali. Silakan mulai ulang.'
    };
}

/**
 * Handle WiFi name change conversation steps
 */
async function handleWifiNameSteps({ userState, sender, chats, pushname, reply, setUserState, deleteUserState }) {
    const userReply = chats.toLowerCase().trim();
    
    switch (userState.step) {
        // Step 1: Pilih mode perubahan (dengan nama)
        case 'SELECT_CHANGE_MODE': {
            const choice = chats.trim();
            
            if (choice === '1') {
                // Pilih satu SSID
                userState.step = 'SELECT_SSID_TO_CHANGE';
                setUserState(sender, userState);
                
                let message = `📡 *Pilih SSID yang Akan Diubah*\n\n`;
                userState.bulk_ssids.forEach((ssidId, index) => {
                    message += `${index + 1}. SSID ${ssidId}\n`;
                });
                message += `\nBalas dengan nomor SSID yang ingin diubah.`;
                
                return { success: true, message };
                
            } else if (choice === '2') {
                // Ubah semua SSID
                const { targetUser, nama_wifi_baru, bulk_ssids } = userState;
                
                reply(`⏳ Memeriksa status perangkat...`);
                
                // Check if device is online
                const deviceStatus3 = await isDeviceOnline(targetUser.device_id);
                
                if (!deviceStatus3.online) {
                    deleteUserState(sender);
                    return {
                        success: false,
                        message: getDeviceOfflineMessage(targetUser.name, deviceStatus3.minutesAgo)
                    };
                }
                
                reply(`⏳ Sedang mengubah nama WiFi untuk *semua SSID*...`);
                
                try {
                    const parameterValues = bulk_ssids.map(ssidId => {
                        return [`InternetGatewayDevice.LANDevice.1.WLANConfiguration.${ssidId}.SSID`, nama_wifi_baru, "xsd:string"];
                    });
                    
                    const response = await axios.post(
                        `${global.config.genieacsBaseUrl}/devices/${encodeURIComponent(targetUser.device_id)}/tasks?connection_request`,
                        {
                            name: 'setParameterValues',
                            parameterValues: parameterValues
                        }
                    );
                    
                    if (response.status === 200 || response.status === 202) {
                        deleteUserState(sender);
                        return {
                            success: true,
                            message: `✅ *Permintaan Diterima*\n\n` +
                                   `Perubahan nama WiFi untuk semua SSID sedang diproses.\n\n` +
                                   `*Perhatian:*\n` +
                                   `• Modem akan restart otomatis (1-2 menit)\n` +
                                   `• Semua perangkat akan terputus\n` +
                                   `• Gunakan nama WiFi baru: *${nama_wifi_baru}*\n\n` +
                                   `_Jika tidak berubah setelah 5 menit, silakan hubungi teknisi._`
                        };
                    } else {
                        throw new Error(`GenieACS returned status ${response.status}`);
                    }
                } catch (error) {
                    deleteUserState(sender);
                    return {
                        success: false,
                        message: getSafeErrorMessage(error)
                    };
                }
            }
            
            return {
                success: false,
                message: "Pilihan tidak valid. Mohon balas dengan angka *1* atau *2*."
            };
        }
        
        // Step 1 Alternative: Pilih mode dulu (tanpa nama)
        case 'SELECT_CHANGE_MODE_FIRST': {
            const choice = chats.trim();
            
            if (choice === '1') {
                userState.step = 'SELECT_SSID_TO_CHANGE_FIRST';
                setUserState(sender, userState);
                
                let message = `📡 *Pilih SSID yang Akan Diubah*\n\n`;
                userState.bulk_ssids.forEach((ssidId, index) => {
                    message += `${index + 1}. SSID ${ssidId}\n`;
                });
                message += `\nBalas dengan nomor SSID yang ingin diubah.`;
                
                return { success: true, message };
                
            } else if (choice === '2') {
                userState.step = 'ASK_NEW_NAME_FOR_BULK';
                setUserState(sender, userState);
                
                return {
                    success: true,
                    message: `📝 Silakan ketik nama WiFi baru yang akan digunakan untuk *semua SSID*.\n\n*Ketentuan:*\n• Maksimal 32 karakter\n• Boleh menggunakan huruf, angka, spasi\n\nKetik *batal* untuk membatalkan.`
                };
            }
            
            return {
                success: false,
                message: "Pilihan tidak valid. Mohon balas dengan angka *1* atau *2*."
            };
        }
        
        // Step 2: Pilih SSID spesifik (dengan nama)
        case 'SELECT_SSID_TO_CHANGE': {
            const choiceIndex = parseInt(chats, 10) - 1;
            
            if (isNaN(choiceIndex) || choiceIndex < 0 || choiceIndex >= userState.bulk_ssids.length) {
                return {
                    success: false,
                    message: "Nomor SSID tidak valid. Mohon balas dengan nomor yang sesuai dari daftar."
                };
            }
            
            const selectedSsidId = userState.bulk_ssids[choiceIndex];
            const { targetUser, nama_wifi_baru } = userState;
            
            reply(`⏳ Memeriksa status perangkat...`);
            
            // Check if device is online
            const deviceStatus4 = await isDeviceOnline(targetUser.device_id);
            
            if (!deviceStatus4.online) {
                deleteUserState(sender);
                return {
                    success: false,
                    message: getDeviceOfflineMessage(targetUser.name, deviceStatus4.minutesAgo)
                };
            }
            
            reply(`⏳ Sedang mengubah nama WiFi untuk SSID ${selectedSsidId}...`);
            
            try {
                const response = await axios.post(
                    `${global.config.genieacsBaseUrl}/devices/${encodeURIComponent(targetUser.device_id)}/tasks?connection_request`,
                    {
                        name: 'setParameterValues',
                        parameterValues: [
                            [`InternetGatewayDevice.LANDevice.1.WLANConfiguration.${selectedSsidId}.SSID`, nama_wifi_baru, "xsd:string"]
                        ]
                    }
                );
                
                if (response.status === 200 || response.status === 202) {
                    deleteUserState(sender);
                    return {
                        success: true,
                        message: `✅ *Permintaan Diterima*\n\n` +
                               `Perubahan nama WiFi untuk SSID ${selectedSsidId} sedang diproses.\n\n` +
                               `*Perhatian:*\n` +
                               `• Modem akan restart otomatis (1-2 menit)\n` +
                               `• Perangkat akan terputus sementara\n` +
                               `• Gunakan nama WiFi baru: *${nama_wifi_baru}*\n\n` +
                               `_Jika tidak berubah setelah 5 menit, silakan hubungi teknisi._`
                    };
                } else {
                    throw new Error(`GenieACS returned status ${response.status}`);
                }
            } catch (error) {
                console.error('[SINGLE_NAME_CHANGE_ERROR]', error);
                deleteUserState(sender);
                return {
                    success: false,
                    message: `❌ Gagal mengubah nama WiFi: ${error.message}`
                };
            }
        }
        
        // Similar steps for name change...
        // (implementasi mirip dengan password change)
        
        // Fallback untuk step ASK_NEW_NAME (single mode tanpa bulk)
        case 'ASK_NEW_NAME': {
            if (userReply === 'batal') {
                deleteUserState(sender);
                return {
                    success: true,
                    message: '❌ Perubahan nama WiFi dibatalkan.'
                };
            }
            
            const newName = chats.trim();
            if (newName.length > 32) {
                return {
                    success: false,
                    message: `❌ Nama WiFi terlalu panjang (maksimal 32 karakter).`
                };
            }
            
            const { targetUser } = userState;
            
            reply(`⏳ Memeriksa status perangkat...`);
            
            // Check if device is online
            const deviceStatus5 = await isDeviceOnline(targetUser.device_id);
            
            if (!deviceStatus5.online) {
                deleteUserState(sender);
                return {
                    success: false,
                    message: getDeviceOfflineMessage(targetUser.name, deviceStatus5.minutesAgo)
                };
            }
            
            reply(`⏳ Sedang mengubah nama WiFi...`);
            
            try {
                const response = await axios.post(
                    `${global.config.genieacsBaseUrl}/devices/${encodeURIComponent(targetUser.device_id)}/tasks?connection_request`,
                    {
                        name: 'setParameterValues',
                        parameterValues: [
                            [`InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.SSID`, newName, "xsd:string"]
                        ]
                    }
                );
                
                if (response.status === 200 || response.status === 202) {
                    deleteUserState(sender);
                    return {
                        success: true,
                        message: `✅ *Berhasil!*\n\nNama WiFi telah diubah menjadi:\n📶 *${newName}*`
                    };
                } else {
                    throw new Error(`GenieACS returned status ${response.status}`);
                }
            } catch (error) {
                console.error('[NAME_CHANGE_ERROR]', error);
                deleteUserState(sender);
                return {
                    success: false,
                    message: `❌ Gagal mengubah nama WiFi: ${error.message}`
                };
            }
        }
    }
    
    return {
        success: false,
        message: '❌ State tidak dikenali. Silakan mulai ulang.'
    };
}

module.exports = {
    handleWifiNameSteps,
    handleWifiPasswordSteps
};
