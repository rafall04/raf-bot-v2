"use strict";

/**
 * WiFi Conversation Steps (Cleaned Version)
 * Menangani percakapan multi-step untuk operasi WiFi
 * Konfirmasi sudah dihapus - langsung eksekusi
 */

const { setSSIDName, setPassword } = require("../../../lib/wifi");

/**
 * Handle WiFi name change conversation steps
 */
async function handleWifiNameSteps({ userState, sender, chats, pushname, reply, setUserState, deleteUserState }) {
    const userReply = chats.toLowerCase().trim();
    
    switch (userState.step) {
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
                    message: `❌ Nama WiFi terlalu panjang (maksimal 32 karakter). Silakan coba nama yang lebih pendek.`
                };
            }
            
            // Langsung eksekusi tanpa konfirmasi
            const { targetUser } = userState;
            reply(`⏳ Sedang mengubah nama WiFi untuk *${targetUser.name}*...`);
            
            try {
                const result = await setSSIDName(targetUser.device_id, newName);
                
                if (result.success) {
                    deleteUserState(sender);
                    return {
                        success: true,
                        message: `✅ *Berhasil!*\n\nNama WiFi untuk *${targetUser.name}* telah diubah menjadi:\n📶 *${newName}*\n\n⚠️ *Penting:*\n• Semua perangkat akan terputus\n• Cari dan pilih nama WiFi baru untuk menyambung kembali`
                    };
                } else {
                    deleteUserState(sender);
                    return {
                        success: false,
                        message: `❌ Gagal mengubah nama WiFi: ${result.message || 'Unknown error'}`
                    };
                }
            } catch (error) {
                console.error('[WIFI_NAME_CHANGE_ERROR]', error);
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

/**
 * Handle WiFi password change conversation steps
 */
async function handleWifiPasswordSteps({ userState, sender, chats, pushname, reply, setUserState, deleteUserState }) {
    const userReply = chats.toLowerCase().trim();
    
    switch (userState.step) {
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
                    message: `❌ Sandi WiFi terlalu pendek (minimal 8 karakter). Silakan gunakan sandi yang lebih panjang.`
                };
            }
            
            // Langsung eksekusi tanpa konfirmasi
            const { targetUser } = userState;
            reply(`⏳ Sedang mengubah sandi WiFi untuk *${targetUser.name}*...`);
            
            try {
                const result = await setPassword(targetUser.device_id, newPassword);
                
                if (result.success) {
                    deleteUserState(sender);
                    return {
                        success: true,
                        message: `✅ *Berhasil!*\n\nSandi WiFi untuk *${targetUser.name}* telah diubah menjadi:\n🔐 *${newPassword}*\n\n⚠️ *Penting:*\n• Semua perangkat akan terputus\n• Masukkan sandi baru untuk menyambung kembali`
                    };
                } else {
                    deleteUserState(sender);
                    return {
                        success: false,
                        message: `❌ Gagal mengubah sandi WiFi: ${result.message || 'Unknown error'}`
                    };
                }
            } catch (error) {
                console.error('[WIFI_PASSWORD_CHANGE_ERROR]', error);
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

module.exports = {
    handleWifiNameSteps,
    handleWifiPasswordSteps
};
