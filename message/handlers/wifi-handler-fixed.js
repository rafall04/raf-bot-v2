"use strict";

/**
 * WiFi Handler - FIXED VERSION
 * Menggunakan logika asli dari raf-old.js
 */

const axios = require('axios');
const { getUserState, setUserState, deleteUserState, mess } = require('./conversation-handler');
const { findUserByPhone, findUserByDeviceId, isAdmin, isTeknisi, isValidDeviceId } = require('./utils');
const { getSSIDInfo } = require("../../lib/wifi");
const { saveWifiChangeLog } = require('./wifi-logger');
const { isDeviceOnline, getDeviceOfflineMessage } = require('../../lib/device-status');
const fs = require('fs');
const path = require('path');

/**
 * Safe error message handler - hides sensitive information like IP addresses
 * @param {Error} error - The error object
 * @returns {string} Safe error message for user
 */
function getSafeErrorMessage(error) {
    // Log full error for debugging (admin can see in console/logs)
    console.error('[WIFI_ERROR_FULL]', {
        message: error.message,
        code: error.code,
        status: error.response?.status,
        stack: error.stack
    });
    
    // Return safe message to user (no IP, no technical details)
    if (error.code === 'ETIMEDOUT' || error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
        return '❌ Tidak dapat terhubung ke server. Silakan coba beberapa saat lagi atau hubungi admin.';
    } else if (error.response && error.response.status >= 500) {
        return '❌ Server sedang mengalami gangguan. Silakan hubungi admin.';
    } else if (error.response && error.response.status >= 400) {
        return '❌ Terjadi kesalahan pada permintaan. Silakan hubungi admin.';
    } else if (error.message && error.message.toLowerCase().includes('network')) {
        return '❌ Gangguan koneksi jaringan. Silakan coba lagi atau hubungi admin.';
    } else {
        return '❌ Terjadi kesalahan sistem. Silakan coba lagi atau hubungi admin.';
    }
}

/**
 * Handle WiFi password change - USING ORIGINAL LOGIC
 */
async function handleWifiPasswordChange({ sender, pushname, entities, args, q, matchedKeywordLength, isOwner, isTeknisi, reply }) {
    try {
        let user;
        let newPassword;
        
        // Debug logging
        console.log('[DEBUG_PASSWORD_CHANGE] Args:', args);
        console.log('[DEBUG_PASSWORD_CHANGE] matchedKeywordLength:', matchedKeywordLength);
        console.log('[DEBUG_PASSWORD_CHANGE] q:', q);
        
        // Hitung berapa kata yang merupakan bagian dari keyword
        // Untuk "ganti sandi" atau "gantisandi", keyword adalah 2 kata atau 1 kata
        let keywordWordCount = matchedKeywordLength || 0;
        
        // Jika matchedKeywordLength tidak ada atau 0, coba deteksi manual
        if (!keywordWordCount) {
            const lowerChats = args.join(' ').toLowerCase();
            if (lowerChats.startsWith('ganti sandi wifi') || lowerChats.startsWith('ganti password wifi') || lowerChats.startsWith('ubah sandi wifi')) {
                keywordWordCount = 3;
            } else if (lowerChats.startsWith('ganti sandi') || lowerChats.startsWith('ganti password') || lowerChats.startsWith('ubah sandi')) {
                keywordWordCount = 2;
            } else if (lowerChats.startsWith('gantisandi')) {
                keywordWordCount = 1;
            } else {
                keywordWordCount = 1; // Default
            }
        }
        
        // Check if owner/teknisi trying to change for specific user
        if ((isOwner || isTeknisi) && args && args.length > keywordWordCount && !isNaN(parseInt(args[keywordWordCount], 10))) {
            // Admin dengan ID
            const targetId = args[keywordWordCount];
            user = global.users.find(u => u.id == targetId);
            
            if (!user) {
                return {
                    success: false,
                    message: `❌ Pelanggan dengan ID "${targetId}" tidak ditemukan.`
                };
            }
            
            // Get password from remaining args after keyword and ID
            newPassword = args.slice(keywordWordCount + 1).join(' ');
            console.log('[DEBUG_PASSWORD_CHANGE] Admin mode - targetId:', targetId);
            console.log('[DEBUG_PASSWORD_CHANGE] Admin mode - newPassword from args:', newPassword);
            
            // If password is still empty, try using q (the text after command)
            if (!newPassword && q) {
                // Extract password from q by removing the ID part
                const parts = q.trim().split(' ');
                if (parts.length > 1 && parts[0] == targetId) {
                    newPassword = parts.slice(1).join(' ');
                    console.log('[DEBUG_PASSWORD_CHANGE] Admin mode - newPassword from q:', newPassword);
                }
            }
        } else {
            // Regular user
            user = findUserByPhone(sender);
            if (!user) {
                return {
                    success: false,
                    message: mess.userNotRegister
                };
            }
            
            newPassword = args && args.length > keywordWordCount ? args.slice(keywordWordCount).join(' ') : '';
            console.log('[DEBUG_PASSWORD_CHANGE] User mode - newPassword:', newPassword);
        }
        
        // Validate device_id
        if (!user.device_id) {
            return {
                success: false,
                message: `❌ Maaf Kak ${user.name}, perangkat Anda belum terdaftar dalam sistem kami.`
            };
        }
        
        // Check subscription
        if (!user.paid) {
            return {
                success: false,
                message: `⚠️ Maaf Kak ${user.name}, layanan Anda sedang tidak aktif. Silakan lakukan pembayaran terlebih dahulu.`
            };
        }
        
        // If no password provided, ask for it
        if (!newPassword) {
            setUserState(sender, {
                step: 'ASK_NEW_PASSWORD',
                targetUser: user
            });
            
            return {
                success: true,
                message: `🔐 *Ganti Sandi WiFi*\n\nSilakan ketik sandi WiFi baru yang Anda inginkan.\n\n*Ketentuan:*\n• Minimal 8 karakter\n• Kombinasi huruf dan angka lebih aman\n\nKetik *batal* untuk membatalkan.`
            };
        }
        
        // Validate password length
        if (newPassword.length < 8) {
            return {
                success: false,
                message: `❌ Sandi WiFi terlalu pendek (minimal 8 karakter).`
            };
        }
        
        // Check if bulk mode is enabled
        if (global.config.custom_wifi_modification && user.bulk && user.bulk.length > 0) {
            // BULK MODE - Show SSID selection menu
            reply(`⏳ Sedang memeriksa informasi WiFi...`);
            
            try {
                const { ssid } = await getSSIDInfo(user.device_id);
                
                // Dapatkan nama-nama SSID saat ini untuk ditampilkan
                const currentSSIDs = user.bulk.map((bulkId, index) => {
                    const matchedSSID = ssid.find(s => String(s.id) === String(bulkId));
                    return `${index + 1}. SSID ${bulkId}: "${matchedSSID?.name || 'Tidak diketahui'}"`;
                }).join('\n');
                
                // Jika password sudah diberikan, tanyakan mode perubahan
                if (newPassword && newPassword.trim().length > 0) {
                    setUserState(sender, {
                        step: 'SELECT_CHANGE_PASSWORD_MODE',
                        targetUser: user,
                        sandi_wifi_baru: newPassword,
                        bulk_ssids: user.bulk,
                        ssid_info: currentSSIDs
                    });
                    
                    return {
                        success: true,
                        message: `📡 *SSID WiFi yang tersedia:*\n${currentSSIDs}\n\nAnda ingin mengubah kata sandi WiFi menjadi: *${newPassword}*\n\n*Pilih mode perubahan:*\n1️⃣ Ubah satu SSID saja\n2️⃣ Ubah semua SSID sekaligus\n\nBalas dengan angka pilihan Anda.`
                    };
                } else {
                    // Jika password belum diberikan, tanyakan dulu mode perubahan
                    setUserState(sender, {
                        step: 'SELECT_CHANGE_PASSWORD_MODE_FIRST',
                        targetUser: user,
                        bulk_ssids: user.bulk,
                        ssid_info: currentSSIDs
                    });
                    
                    return {
                        success: true,
                        message: `📡 *SSID WiFi yang tersedia:*\n${currentSSIDs}\n\n*Pilih mode perubahan kata sandi:*\n1️⃣ Ubah satu SSID saja\n2️⃣ Ubah semua SSID sekaligus\n\nBalas dengan angka pilihan Anda.`
                    };
                }
            } catch (error) {
                console.error('[GET_SSID_INFO_ERROR]', error);
                // Fallback jika gagal mendapatkan info SSID
                if (newPassword && newPassword.trim().length > 0) {
                    setUserState(sender, {
                        step: 'SELECT_CHANGE_PASSWORD_MODE',
                        targetUser: user,
                        sandi_wifi_baru: newPassword,
                        bulk_ssids: user.bulk
                    });
                    
                    return {
                        success: true,
                        message: `Anda ingin mengubah kata sandi WiFi menjadi: *${newPassword}*\n\n*Pilih mode perubahan:*\n1️⃣ Ubah satu SSID saja\n2️⃣ Ubah semua SSID sekaligus\n\nBalas dengan angka pilihan Anda.`
                    };
                } else {
                    setUserState(sender, {
                        step: 'SELECT_CHANGE_PASSWORD_MODE_FIRST',
                        targetUser: user,
                        bulk_ssids: user.bulk
                    });
                    
                    return {
                        success: true,
                        message: `*Pilih mode perubahan kata sandi:*\n1️⃣ Ubah satu SSID saja\n2️⃣ Ubah semua SSID sekaligus\n\nBalas dengan angka pilihan Anda.`
                    };
                }
            }
        } else {
            // SINGLE MODE - One SSID
            reply(`⏳ Memeriksa status perangkat...`);
            
            // Check if device is online
            const deviceStatus = await isDeviceOnline(user.device_id);
            
            if (!deviceStatus.online) {
                return {
                    success: false,
                    message: getDeviceOfflineMessage(user.name, deviceStatus.minutesAgo)
                };
            }
            
            reply(`⏳ Sedang mengubah sandi WiFi untuk *${user.name}*...`);
            
            try {
                // Use SSID 1 by default for single mode
                const ssidId = 1;
                
                const response = await axios.post(
                    `${global.config.genieacsBaseUrl}/devices/${encodeURIComponent(user.device_id)}/tasks?connection_request`,
                    {
                        name: 'setParameterValues',
                        parameterValues: [
                            [`InternetGatewayDevice.LANDevice.1.WLANConfiguration.${ssidId}.PreSharedKey.1.PreSharedKey`, newPassword, "xsd:string"]
                        ]
                    }
                );
                
                if (response.status === 200 || response.status === 202) {
                    console.log(`[WIFI_PASSWORD_CHANGED] User: ${user.name} (${user.id}), Changed by: ${pushname}, New Password: ${newPassword}`);
                    
                    // Save to log
                    saveWifiChangeLog({
                        type: 'password_change',
                        userId: user.id,
                        userName: user.name,
                        userPhone: user.phone_number || user.phone,
                        deviceId: user.device_id,
                        newPassword: newPassword,
                        changedBy: pushname || 'Admin',
                        changedBySender: sender,
                        notes: `Password diubah langsung oleh ${isOwner ? 'Owner' : isTeknisi ? 'Teknisi' : 'User'}`,
                        timestamp: new Date().toISOString()
                    });
                    
                    return {
                        success: true,
                        message: `✅ *Permintaan Diterima*\n\n` +
                               `Perubahan sandi WiFi sedang diproses.\n\n` +
                               `*Perhatian:*\n` +
                               `• Modem akan restart otomatis (1-2 menit)\n` +
                               `• Semua perangkat akan terputus\n` +
                               `• Gunakan sandi baru: *${newPassword}*\n\n` +
                               `_Jika tidak berubah setelah 5 menit, silakan hubungi teknisi._`
                    };
                } else {
                    return {
                        success: false,
                        message: getSafeErrorMessage(response)
                    };
                }
            } catch (error) {
                return {
                    success: false,
                    message: getSafeErrorMessage(error)
                };
            }
        }
        
    } catch (error) {
        console.error('[WIFI_PASSWORD_CHANGE_ERROR]', error);
        return {
            success: false,
            message: '❌ Terjadi kesalahan saat mengubah sandi WiFi.'
        };
    }
}

/**
 * Handle WiFi name change - USING ORIGINAL LOGIC
 */
async function handleWifiNameChange({ sender, pushname, entities, args, q, matchedKeywordLength, isOwner, isTeknisi, reply }) {
    try {
        let user;
        let newName;
        
        // Debug logging
        console.log('[DEBUG_NAME_CHANGE] Args:', args);
        console.log('[DEBUG_NAME_CHANGE] matchedKeywordLength:', matchedKeywordLength);
        console.log('[DEBUG_NAME_CHANGE] q:', q);
        
        // Hitung berapa kata yang merupakan bagian dari keyword
        // Untuk "ganti nama" atau "gantinama", keyword adalah 2 kata atau 1 kata
        let keywordWordCount = matchedKeywordLength || 0;
        
        // Jika matchedKeywordLength tidak ada atau 0, coba deteksi manual
        if (!keywordWordCount) {
            const lowerChats = args.join(' ').toLowerCase();
            if (lowerChats.startsWith('ganti nama wifi') || lowerChats.startsWith('ganti nama hotspot') || lowerChats.startsWith('ubah nama wifi')) {
                keywordWordCount = 3;
            } else if (lowerChats.startsWith('ganti nama') || lowerChats.startsWith('ubah nama') || lowerChats.startsWith('ganti ssid')) {
                keywordWordCount = 2;
            } else if (lowerChats.startsWith('gantinama')) {
                keywordWordCount = 1;
            } else {
                keywordWordCount = 1; // Default
            }
        }
        
        // Check if owner/teknisi trying to change for specific user
        if ((isOwner || isTeknisi) && args && args.length > keywordWordCount && !isNaN(parseInt(args[keywordWordCount], 10))) {
            // Admin dengan ID
            const targetId = args[keywordWordCount];
            user = global.users.find(u => u.id == targetId);
            
            if (!user) {
                return {
                    success: false,
                    message: `❌ Pelanggan dengan ID "${targetId}" tidak ditemukan.`
                };
            }
            
            // Get name from remaining args after keyword and ID
            newName = args.slice(keywordWordCount + 1).join(' ');
            console.log('[DEBUG_NAME_CHANGE] Admin mode - targetId:', targetId);
            console.log('[DEBUG_NAME_CHANGE] Admin mode - newName from args:', newName);
            
            // If name is still empty, try using q (the text after command)
            if (!newName && q) {
                // Extract name from q by removing the ID part
                const parts = q.trim().split(' ');
                if (parts.length > 1 && parts[0] == targetId) {
                    newName = parts.slice(1).join(' ');
                    console.log('[DEBUG_NAME_CHANGE] Admin mode - newName from q:', newName);
                }
            }
        } else {
            // Regular user
            user = findUserByPhone(sender);
            if (!user) {
                return {
                    success: false,
                    message: mess.userNotRegister
                };
            }
            
            newName = args && args.length > keywordWordCount ? args.slice(keywordWordCount).join(' ') : '';
            console.log('[DEBUG_NAME_CHANGE] User mode - newName:', newName);
        }
        
        // Validate device_id
        if (!user.device_id) {
            return {
                success: false,
                message: `❌ Maaf Kak ${user.name}, perangkat Anda belum terdaftar dalam sistem kami.`
            };
        }
        
        // Check subscription
        if (!user.paid) {
            return {
                success: false,
                message: `⚠️ Maaf Kak ${user.name}, layanan Anda sedang tidak aktif.`
            };
        }
        
        // If no name provided, ask for it
        if (!newName) {
            setUserState(sender, {
                step: 'ASK_NEW_NAME',
                targetUser: user
            });
            
            return {
                success: true,
                message: `📝 *Ganti Nama WiFi*\n\nSilakan ketik nama WiFi baru yang Anda inginkan.\n\n*Ketentuan:*\n• Maksimal 32 karakter\n• Boleh menggunakan huruf, angka, spasi\n\nKetik *batal* untuk membatalkan.`
            };
        }
        
        // Validate name length
        if (newName.length > 32) {
            return {
                success: false,
                message: `❌ Nama WiFi terlalu panjang (maksimal 32 karakter).`
            };
        }
        
        // Check if bulk mode is enabled
        if (global.config.custom_wifi_modification && user.bulk && user.bulk.length > 0) {
            // BULK MODE - Show SSID selection menu
            reply(`⏳ Sedang memeriksa informasi WiFi...`);
            
            try {
                const { ssid } = await getSSIDInfo(user.device_id);
                
                // Dapatkan nama-nama SSID saat ini untuk ditampilkan
                const currentSSIDs = user.bulk.map((bulkId, index) => {
                    const matchedSSID = ssid.find(s => String(s.id) === String(bulkId));
                    return `${index + 1}. SSID ${bulkId}: "${matchedSSID?.name || 'Tidak diketahui'}"`;
                }).join('\n');
                
                // Jika nama sudah diberikan, tanyakan mode perubahan
                if (newName && newName.trim().length > 0) {
                    setUserState(sender, {
                        step: 'SELECT_CHANGE_MODE',
                        targetUser: user,
                        nama_wifi_baru: newName,
                        bulk_ssids: user.bulk,
                        ssid_info: currentSSIDs
                    });
                    
                    return {
                        success: true,
                        message: `📡 *SSID WiFi yang tersedia:*\n${currentSSIDs}\n\nAnda ingin mengubah nama WiFi menjadi: *${newName}*\n\n*Pilih mode perubahan:*\n1️⃣ Ubah satu SSID saja\n2️⃣ Ubah semua SSID sekaligus\n\nBalas dengan angka pilihan Anda.`
                    };
                } else {
                    // Jika nama belum diberikan, tanyakan dulu mode perubahan
                    setUserState(sender, {
                        step: 'SELECT_CHANGE_MODE_FIRST',
                        targetUser: user,
                        bulk_ssids: user.bulk,
                        ssid_info: currentSSIDs
                    });
                    
                    return {
                        success: true,
                        message: `📡 *SSID WiFi yang tersedia:*\n${currentSSIDs}\n\n*Pilih mode perubahan nama:*\n1️⃣ Ubah satu SSID saja\n2️⃣ Ubah semua SSID sekaligus\n\nBalas dengan angka pilihan Anda.`
                    };
                }
            } catch (error) {
                console.error('[GET_SSID_INFO_ERROR]', error);
                // Fallback jika gagal mendapatkan info SSID
                if (newName && newName.trim().length > 0) {
                    setUserState(sender, {
                        step: 'SELECT_CHANGE_MODE',
                        targetUser: user,
                        nama_wifi_baru: newName,
                        bulk_ssids: user.bulk
                    });
                    
                    return {
                        success: true,
                        message: `Anda ingin mengubah nama WiFi menjadi: *${newName}*\n\n*Pilih mode perubahan:*\n1️⃣ Ubah satu SSID saja\n2️⃣ Ubah semua SSID sekaligus\n\nBalas dengan angka pilihan Anda.`
                    };
                } else {
                    setUserState(sender, {
                        step: 'SELECT_CHANGE_MODE_FIRST',
                        targetUser: user,
                        bulk_ssids: user.bulk
                    });
                    
                    return {
                        success: true,
                        message: `*Pilih mode perubahan nama:*\n1️⃣ Ubah satu SSID saja\n2️⃣ Ubah semua SSID sekaligus\n\nBalas dengan angka pilihan Anda.`
                    };
                }
            }
        } else {
            // SINGLE MODE - One SSID
            reply(`⏳ Memeriksa status perangkat...`);
            
            // Check if device is online
            const deviceStatus2 = await isDeviceOnline(user.device_id);
            
            if (!deviceStatus2.online) {
                return {
                    success: false,
                    message: getDeviceOfflineMessage(user.name, deviceStatus2.minutesAgo)
                };
            }
            
            reply(`⏳ Sedang mengubah nama WiFi untuk *${user.name}*...`);
            
            try {
                const ssidId = 1;
                
                // Get current SSID name before changing
                let oldSsidName = 'N/A';
                try {
                    const { getSSIDInfo } = require('../../lib/wifi');
                    const currentInfo = await getSSIDInfo(user.device_id);
                    if (currentInfo && currentInfo.ssid && Array.isArray(currentInfo.ssid)) {
                        const targetSSID = currentInfo.ssid.find(s => String(s.id) === String(ssidId));
                        if (targetSSID && targetSSID.name) {
                            oldSsidName = targetSSID.name;
                            console.log(`[WIFI_NAME_CHANGE] Current SSID ${ssidId} name: "${oldSsidName}"`);
                        }
                    }
                } catch (infoError) {
                    console.warn(`[WIFI_NAME_CHANGE] Could not get current SSID name: ${infoError.message}`);
                }
                
                const response = await axios.post(
                    `${global.config.genieacsBaseUrl}/devices/${encodeURIComponent(user.device_id)}/tasks?connection_request`,
                    {
                        name: 'setParameterValues',
                        parameterValues: [
                            [`InternetGatewayDevice.LANDevice.1.WLANConfiguration.${ssidId}.SSID`, newName, "xsd:string"]
                        ]
                    }
                );
                
                if (response.status === 200 || response.status === 202) {
                    console.log(`[WIFI_NAME_CHANGED] User: ${user.name} (${user.id}), Changed by: ${pushname}, Old Name: ${oldSsidName}, New Name: ${newName}`);
                    
                    // Save to log
                    saveWifiChangeLog({
                        type: 'name_change',
                        userId: user.id,
                        userName: user.name,
                        userPhone: user.phone_number || user.phone,
                        deviceId: user.device_id,
                        changes: {
                            oldSsidName: oldSsidName,
                            newSsidName: newName
                        },
                        changedBy: pushname || 'Admin',
                        changedBySender: sender,
                        notes: `Nama WiFi diubah langsung oleh ${isOwner ? 'Owner' : isTeknisi ? 'Teknisi' : 'User'}`,
                        timestamp: new Date().toISOString()
                    });
                    
                    return {
                        success: true,
                        message: `✅ *Permintaan Diterima*\n\n` +
                               `Perubahan nama WiFi sedang diproses.\n\n` +
                               `*Perhatian:*\n` +
                               `• Modem akan restart otomatis (1-2 menit)\n` +
                               `• Semua perangkat akan terputus\n` +
                               `• Cari dan gunakan nama WiFi baru: *${newName}*\n\n` +
                               `_Jika tidak berubah setelah 5 menit, silakan hubungi teknisi._`
                    };
                } else {
                    throw new Error(`GenieACS returned status ${response.status}`);
                }
            } catch (error) {
                return {
                    success: false,
                    message: getSafeErrorMessage(error)
                };
            }
        }
        
    } catch (error) {
        console.error('[WIFI_NAME_CHANGE_ERROR]', error);
        return {
            success: false,
            message: '❌ Terjadi kesalahan saat mengubah nama WiFi.'
        };
    }
}

/**
 * Handle WiFi info check
 */
async function handleWifiInfoCheck({ sender, pushname, entities, args, isOwner, isTeknisi, reply }) {
    try {
        let user;
        
        console.log('[WIFI_INFO_CHECK] Args:', args);
        console.log('[WIFI_INFO_CHECK] isOwner:', isOwner, 'isTeknisi:', isTeknisi);
        
        // Check if owner/teknisi checking for specific user
        // Handle different command formats:
        // - "cek wifi 1" -> ["cek", "wifi", "1"]
        // - "cekwifi 1" -> ["cekwifi", "1"]
        // - "Cekwifi 1" -> ["Cekwifi", "1"]
        
        let targetId = null;
        
        // Try to find user ID in different positions
        if ((isOwner || isTeknisi) && args && args.length >= 2) {
            // Check last argument first (most common case)
            const lastArg = args[args.length - 1];
            if (!isNaN(parseInt(lastArg, 10))) {
                targetId = lastArg;
            }
            // Also check args[2] for "cek wifi 1" format
            else if (args.length > 2 && !isNaN(parseInt(args[2], 10))) {
                targetId = args[2];
            }
            // Check args[1] for "cekwifi 1" format
            else if (args.length === 2 && !isNaN(parseInt(args[1], 10))) {
                targetId = args[1];
            }
        }
        
        if (targetId) {
            console.log('[WIFI_INFO_CHECK] Admin checking for user ID:', targetId);
            user = global.users.find(u => u.id == targetId);
            
            if (!user) {
                return {
                    success: false,
                    message: `❌ Pelanggan dengan ID "${targetId}" tidak ditemukan.`
                };
            }
        } else {
            // No target ID specified or not admin, check own WiFi
            user = findUserByPhone(sender);
            if (!user) {
                return {
                    success: false,
                    message: mess.userNotRegister
                };
            }
        }
        
        if (!user.device_id) {
            return {
                success: false,
                message: `❌ Maaf Kak ${user.name}, perangkat Anda belum terdaftar.`
            };
        }
        
        reply(`⏳ Tunggu sebentar, sedang mengambil informasi WiFi untuk *${user.name}*...`);
        
        try {
            // Check device online status (with error handling)
            let deviceStatus = { online: null, lastInform: null, minutesAgo: null };
            try {
                deviceStatus = await isDeviceOnline(user.device_id);
                console.log(`[WIFI_INFO_CHECK] Device status for ${user.device_id}:`, deviceStatus);
            } catch (statusError) {
                console.warn(`[WIFI_INFO_CHECK] Could not check device status:`, statusError.message);
                // Continue anyway, just won't show status
            }
            
            console.log(`[WIFI_INFO_CHECK] Getting WiFi info for device: ${user.device_id}`);
            // Use refresh (false) to get real-time connected devices
            const wifiInfo = await getSSIDInfo(user.device_id, false);
            console.log(`[WIFI_INFO_CHECK] WiFi info received with connected devices`);
            
            // Fix: Use 'ssid' not 'ssids' (singular)
            if (!wifiInfo || !wifiInfo.ssid || wifiInfo.ssid.length === 0) {
                return {
                    success: false,
                    message: `❌ Tidak dapat mengambil informasi WiFi untuk ${user.name}.`
                };
            }
            
            // Determine which SSIDs to show based on bulk configuration
            // Bulk SSID is for showing multiple SSIDs, NOT related to custom_wifi_modification
            // custom_wifi_modification is for allowing customers to modify WiFi settings
            let ssidsToShow = [];
            
            if (user.bulk && Array.isArray(user.bulk) && user.bulk.length > 0) {
                // Filter SSIDs based on bulk configuration
                console.log(`[WIFI_INFO_CHECK] User has bulk SSIDs: ${user.bulk.join(', ')}`);
                ssidsToShow = wifiInfo.ssid.filter(ssid => user.bulk.includes(String(ssid.id)));
            } else {
                // Show only SSID 1 if no bulk configuration
                console.log(`[WIFI_INFO_CHECK] No bulk SSIDs, showing only SSID 1`);
                ssidsToShow = wifiInfo.ssid.filter(ssid => String(ssid.id) === '1');
            }
            
            if (ssidsToShow.length === 0) {
                return {
                    success: false,
                    message: `❌ Tidak ada SSID yang dikonfigurasi untuk ${user.name}.`
                };
            }
            
            // Format message yang lebih detail dan user-friendly
            let message = `📶 *INFORMASI WIFI*\n`;
            message += `━━━━━━━━━━━━━━━━━━\n`;
            message += `👤 *Pelanggan:* ${user.name}\n`;
            message += `📍 *Alamat:* ${user.address || 'N/A'}\n`;
            message += `📞 *No. HP:* ${user.phone_number || user.phone || 'N/A'}\n`;
            
            // Add device status (if available)
            if (deviceStatus.online === true) {
                message += `🟢 *Status Device:* ONLINE\n`;
                if (deviceStatus.minutesAgo !== null && deviceStatus.minutesAgo < 1) {
                    message += `🕐 *Last Contact:* Baru saja\n`;
                } else if (deviceStatus.minutesAgo !== null) {
                    message += `🕐 *Last Contact:* ${deviceStatus.minutesAgo} menit yang lalu\n`;
                }
            } else if (deviceStatus.online === false) {
                message += `🔴 *Status Device:* OFFLINE\n`;
                if (deviceStatus.minutesAgo !== null) {
                    message += `🕐 *Terakhir Online:* ${deviceStatus.minutesAgo} menit yang lalu\n`;
                } else {
                    message += `🕐 *Terakhir Online:* Tidak diketahui\n`;
                }
            }
            // If deviceStatus.online is null, skip showing status (error occurred during check)
            
            if (wifiInfo.uptime) {
                message += `⏱️ *Router Uptime:* ${wifiInfo.uptime}\n`;
            }
            message += `━━━━━━━━━━━━━━━━━━\n\n`;
            
            let totalDevices = 0;
            
            // Show filtered SSIDs with connected devices
            ssidsToShow.forEach((ssid) => {
                message += `📡 *SSID ${ssid.id}*\n`;
                message += `├ *Nama WiFi:* ${ssid.name || 'N/A'}\n`;
                message += `├ *Transmit Power:* ${ssid.transmitPower || 100}%\n`;
                
                // Show connected devices (from associatedDevices)
                if (ssid.associatedDevices && ssid.associatedDevices.length > 0) {
                    message += `└ *Perangkat Terhubung:* ${ssid.associatedDevices.length} device\n`;
                    message += `\n  📱 *Daftar Perangkat:*\n`;
                    
                    ssid.associatedDevices.forEach((device, idx) => {
                        message += `  ${idx + 1}. *${device.hostName || 'Unknown Device'}*\n`;
                        message += `     • MAC: ${device.mac}\n`;
                        if (device.ip && device.ip !== 'N/A') {
                            message += `     • IP: ${device.ip}\n`;
                        }
                        if (device.signal && device.signal !== 'N/A') {
                            const signalQuality = device.signal > -50 ? 'Excellent' : 
                                                 device.signal > -60 ? 'Good' : 
                                                 device.signal > -70 ? 'Fair' : 'Poor';
                            message += `     • Signal: ${device.signal} dBm (${signalQuality})\n`;
                        }
                    });
                    totalDevices += ssid.associatedDevices.length;
                } else {
                    message += `└ *Perangkat Terhubung:* Tidak ada\n`;
                }
                message += `\n`;
            });
            
            message += `━━━━━━━━━━━━━━━━━━\n`;
            message += `📊 *TOTAL PERANGKAT TERHUBUNG:* ${totalDevices} device\n`;
            message += `━━━━━━━━━━━━━━━━━━\n`;
            
            // Add footer note based on device status
            if (deviceStatus.online === true) {
                message += `\n✅ _Data diperbarui secara realtime_`;
            } else if (deviceStatus.online === false) {
                message += `\n⚠️ _Data mungkin tidak akurat karena device sedang offline_`;
                message += `\n\n💡 *Tip:* Pastikan modem menyala dan terhubung untuk data terbaru.`;
            } else {
                // If status check failed, show generic message
                message += `\n_Data diperbarui dari cache sistem_`;
            }
            
            return {
                success: true,
                message: message
            };
            
        } catch (error) {
            console.error('[WIFI_INFO_CHECK_ERROR] Failed to get WiFi info:', error);
            console.error('[WIFI_INFO_CHECK_ERROR] Error details:', {
                message: error.message,
                code: error.code,
                response: error.response?.data
            });
            
            // Provide more specific error messages
            if (error.message?.includes('ECONNREFUSED')) {
                return {
                    success: false,
                    message: `❌ Tidak dapat terhubung ke server manajemen perangkat. Silakan coba lagi nanti.`
                };
            } else if (error.message?.includes('404') || error.message?.includes('not found')) {
                return {
                    success: false,
                    message: `❌ Perangkat dengan ID ${user.device_id} tidak ditemukan di server.`
                };
            } else if (error.message?.includes('timeout')) {
                return {
                    success: false,
                    message: `❌ Timeout saat mengambil data. Perangkat mungkin offline atau tidak merespons.`
                };
            }
            
            return {
                success: false,
                message: `❌ Gagal mengambil informasi WiFi: ${getSafeErrorMessage(error)}`
            };
        }
        
    } catch (error) {
        console.error('[WIFI_INFO_CHECK_ERROR]', error);
        return {
            success: false,
            message: '❌ Terjadi kesalahan saat mengecek informasi WiFi.'
        };
    }
}

/**
 * Handle router reboot
 */
async function handleRouterReboot({ sender, pushname, entities, args, isOwner, isTeknisi, reply }) {
    try {
        let user;
        let targetId = null;
        
        // Debug logging
        console.log('[DEBUG_REBOOT] Args:', args);
        console.log('[DEBUG_REBOOT] isOwner:', isOwner, 'isTeknisi:', isTeknisi);
        
        // Check if owner/teknisi trying to reboot for specific user
        // Support multiple formats like "cek wifi" does:
        // - "reboot 1" -> ["reboot", "1"]
        // - "reboot" -> ["reboot"]
        if ((isOwner || isTeknisi) && args && args.length >= 2) {
            // Check last argument first (most common case)
            const lastArg = args[args.length - 1];
            if (!isNaN(parseInt(lastArg, 10))) {
                targetId = lastArg;
            }
            // Also check args[1] for "reboot 1" format
            else if (args.length > 1 && !isNaN(parseInt(args[1], 10))) {
                targetId = args[1];
            }
        }
        
        if (targetId) {
            console.log('[DEBUG_REBOOT] Admin rebooting for user ID:', targetId);
            user = global.users.find(u => u.id == targetId);
            
            if (!user) {
                return {
                    success: false,
                    message: `❌ Pelanggan dengan ID "${targetId}" tidak ditemukan.`
                };
            }
        } else {
            // Regular user rebooting own device
            user = findUserByPhone(sender);
            if (!user) {
                return {
                    success: false,
                    message: mess.userNotRegister
                };
            }
        }
        
        // Validate device_id
        if (!user.device_id) {
            return {
                success: false,
                message: `❌ Maaf Kak ${user.name}, perangkat Anda belum terdaftar dalam sistem kami.`
            };
        }
        
        // CRITICAL FIX: Add device status check before reboot (like other WiFi operations)
        reply(`⏳ Memeriksa status perangkat...`);
        
        const deviceStatus = await isDeviceOnline(user.device_id);
        
        if (!deviceStatus.online) {
            return {
                success: false,
                message: getDeviceOfflineMessage(user.name, deviceStatus.minutesAgo) +
                        `\n\n💡 *Catatan:* Reboot hanya bisa dilakukan jika modem online dan terhubung ke sistem.`
            };
        }
        
        // Set confirmation state
        setUserState(sender, {
            step: 'CONFIRM_REBOOT',
            targetUser: user
        });
        
        return {
            success: true,
            message: `⚠️ *Konfirmasi Reboot Modem*\n\nAnda akan me-reboot modem untuk *${user.name}*.\n\n*Perhatian:*\n• Modem akan mati selama 5-10 menit\n• Semua perangkat akan terputus\n• Internet tidak dapat digunakan selama proses\n\nApakah Anda yakin?\n\nBalas *'ya'* untuk melanjutkan atau *'tidak'* untuk membatalkan.`
        };
        
    } catch (error) {
        console.error('[ROUTER_REBOOT_ERROR]', error);
        return {
            success: false,
            message: getSafeErrorMessage(error)
        };
    }
}

/**
 * Handle WiFi power level change
 * Initiates conversation flow for changing WiFi signal strength
 */
async function handleWifiPowerChange({ sender, pushname, entities, args, isOwner, isTeknisi, reply }) {
    try {
        let user;
        
        // Check if owner/teknisi trying to change for specific user
        if ((isOwner || isTeknisi) && args && args.length > 0 && !isNaN(parseInt(args[0], 10))) {
            // Admin dengan ID
            const targetId = args[0];
            user = global.users.find(u => u.id == targetId);
            
            if (!user) {
                return {
                    success: false,
                    message: `❌ Pelanggan dengan ID "${targetId}" tidak ditemukan.`
                };
            }
        } else {
            // Regular user
            user = findUserByPhone(sender);
            
            if (!user) {
                return {
                    success: false,
                    message: mess.userNotRegister
                };
            }
        }
        
        // Check if device is registered
        if (!user.device_id) {
            return {
                success: false,
                message: `❌ Maaf Kak ${user.name}, perangkat Anda belum terdaftar dalam sistem kami.`
            };
        }
        
        // Set conversation state for power level selection
        setUserState(sender, {
            step: 'ASK_POWER_LEVEL',
            targetUser: user
        });
        
        return {
            success: true,
            message: `📡 *Pengaturan Kekuatan Sinyal WiFi*\n\nSilakan pilih level kekuatan sinyal yang diinginkan:\n\n• *100* - Maksimal (jangkauan luas)\n• *80* - Tinggi\n• *60* - Sedang\n• *40* - Rendah\n• *20* - Minimal (hemat daya)\n\nBalas dengan angka level yang diinginkan.`
        };
        
    } catch (error) {
        console.error('[WIFI_POWER_ERROR]', error);
        return {
            success: false,
            message: getSafeErrorMessage(error)
        };
    }
}

module.exports = {
    handleWifiNameChange,
    handleWifiPasswordChange,
    handleWifiInfoCheck,
    handleRouterReboot,
    handleWifiPowerChange
};
