/**
 * Handler Messages Configuration
 * Centralized message management for all handlers
 */

const fs = require('fs');
const path = require('path');

class HandlerMessages {
    constructor() {
        this.messagesPath = path.join(__dirname, '../database/handler_messages.json');
        this.messages = this.loadMessages();
    }

    loadMessages() {
        try {
            if (fs.existsSync(this.messagesPath)) {
                const data = fs.readFileSync(this.messagesPath, 'utf8');
                return JSON.parse(data);
            }
        } catch (error) {
            console.error('Error loading handler messages:', error);
        }

        // Default messages if file doesn't exist
        return {
            wifi: {
                // Processing messages
                processing_name_change: "⏳ Sedang mengubah nama WiFi...",
                processing_password_change: "⏳ Sedang mengubah password WiFi...",
                processing_info_check: "⏳ Sedang mengambil informasi WiFi...",
                processing_reboot: "⏳ Sedang me-reboot modem...",
                
                // Success messages
                name_change_success: "✅ *Nama WiFi Berhasil Diubah!*\n\n🏠 Nama Lama: ${oldName}\n🏠 Nama Baru: *${newName}*\n\n⚠️ *Penting:* Semua perangkat akan terputus. Silakan reconnect dengan nama WiFi baru.",
                password_change_success: "✅ *Password WiFi Berhasil Diubah!*\n\n🔐 Password Baru: *${newPassword}*\n\n⚠️ *Penting:* Semua perangkat akan terputus. Silakan reconnect dengan password baru.",
                reboot_success: "✅ *Perintah Reboot Berhasil!*\n\n⏱️ Router akan restart dalam beberapa detik.\nKoneksi akan terputus sementara selama ±2 menit.\n\nMohon tunggu hingga semua lampu indikator menyala normal kembali.",
                
                // Error messages
                user_not_registered: "❌ Anda belum terdaftar sebagai pelanggan.",
                device_not_registered: "❌ Perangkat Anda belum terdaftar.",
                service_inactive: "⚠️ Maaf Kak ${name}, layanan Anda sedang tidak aktif. Silakan lakukan pembayaran terlebih dahulu.",
                name_too_long: "❌ Nama WiFi terlalu panjang (maksimal 32 karakter).",
                password_too_short: "❌ Password WiFi minimal 8 karakter.",
                invalid_ssid_name: "❌ Nama WiFi tidak valid. Gunakan huruf, angka, spasi, dash, atau underscore.",
                change_failed: "❌ Gagal mengubah ${type} WiFi.\n\nError: ${error}",
                
                // Input prompts
                prompt_name_input: "📝 *Ganti Nama WiFi*\n\nSilakan ketik nama WiFi baru.\n\nContoh: ganti nama wifi MyWiFi",
                prompt_password_input: "🔐 *Ganti Password WiFi*\n\nSilakan ketik password WiFi baru.\n\nContoh: ganti password wifi 12345678",
                prompt_ssid_selection: "📡 *Pilih SSID WiFi*\n\n${ssidList}\n\nBalas dengan nomor SSID yang ingin diubah.",
                
                // Info messages
                wifi_info: "📡 *Info WiFi Anda*\n\n👤 Nama: ${name}\n🏠 SSID: *${ssid}*\n🔐 Password: *${password}*\n📶 Status: ${status}\n\n💡 *Tips:*\n• Ketik *ganti nama* untuk mengubah nama WiFi\n• Ketik *ganti sandi* untuk mengubah password WiFi",
                wifi_history: "📋 *Riwayat Perubahan WiFi*\n\nNama: ${name}\n\n${history}\n\n_Update: ${date}_",
                no_wifi_history: "📋 *Riwayat Perubahan WiFi*\n\nNama: ${name}\n\n_Belum ada riwayat perubahan WiFi._"
            },
            
            ticket: {
                // Processing messages
                processing_create: "⏳ Sedang membuat tiket laporan...",
                processing_check: "⏳ Sedang memeriksa status tiket...",
                processing_cancel: "⏳ Sedang membatalkan tiket...",
                processing_resolve: "⏳ Sedang menyelesaikan tiket...",
                
                // Success messages
                ticket_created: "✅ *TIKET BERHASIL DIBUAT*\n\n🎫 ID Tiket: *${ticketId}*\n👤 Pelapor: ${name}\n📝 Keluhan: ${complaint}\n📅 Tanggal: ${date}\n⏱️ Status: PENDING\n\n_Tim teknisi akan segera menangani laporan Anda._",
                ticket_cancelled: "❌ Tiket *${ticketId}* telah dibatalkan.",
                ticket_resolved: "✅ Tiket *${ticketId}* telah diselesaikan.\n\nTerima kasih atas kesabaran Anda.",
                
                // Status messages
                ticket_status: "🎫 *STATUS TIKET*\n\nID: ${ticketId}\nStatus: ${status}\nPelapor: ${reporter}\nTeknisi: ${technician}\nKeluhan: ${complaint}\nTanggal: ${date}\nUpdate: ${lastUpdate}",
                
                // Error messages
                ticket_not_found: "❌ Tiket tidak ditemukan.\n\nPastikan ID tiket yang Anda masukkan benar.",
                ticket_already_resolved: "ℹ️ Tiket ini sudah diselesaikan.",
                ticket_already_cancelled: "ℹ️ Tiket ini sudah dibatalkan.",
                no_permission: "❌ Anda tidak memiliki izin untuk mengakses tiket ini."
            },
            
            payment: {
                // Processing messages
                processing_request: "⏳ Sedang memproses request pembayaran...",
                processing_verification: "⏳ Sedang memverifikasi pembayaran...",
                
                // Success messages
                request_created: "✅ *REQUEST PEMBAYARAN BERHASIL*\n\nRequest Anda telah dikirim ke admin untuk diproses.\n\n📋 Detail:\n👤 Pelanggan: ${name}\n💰 Jumlah: Rp ${amount}\n📅 Tanggal: ${date}\n\n_Admin akan segera memproses request Anda._",
                payment_verified: "✅ Pembayaran Anda telah diverifikasi!",
                payment_success: "✅ *PEMBAYARAN BERHASIL*\n\nTerima kasih atas pembayaran Anda.\n\n📋 Detail:\n👤 Nama: ${name}\n💰 Jumlah: Rp ${amount}\n📅 Tanggal: ${date}\n\nInternet Anda akan segera aktif kembali.",
                
                // Error messages
                request_pending: "⏳ Anda memiliki request pembayaran yang masih pending.\n\nMohon tunggu hingga diproses oleh admin.",
                payment_failed: "❌ Pembayaran gagal diproses.\n\nSilakan coba lagi atau hubungi admin.",
                insufficient_balance: "❌ Saldo tidak mencukupi.\n\nSaldo Anda: Rp ${balance}\nDibutuhkan: Rp ${required}"
            },
            
            speed: {
                // Processing messages
                processing_request: "⏳ Sedang memproses request speed boost...",
                processing_check: "⏳ Sedang memeriksa status speed boost...",
                
                // Success messages
                boost_active: "⚡ *SPEED BOOST AKTIF*\n\n📦 Paket: ${package}\n⚡ Speed: ${speed}\n⏱️ Durasi: ${duration}\n📅 Berakhir: ${endDate}",
                boost_requested: "✅ *REQUEST SPEED BOOST*\n\n📦 Paket: ${package}\n⚡ Speed: ${speed}\n⏱️ Durasi: ${duration}\n💰 Harga: Rp ${price}\n\n_Menunggu pembayaran untuk aktivasi._",
                
                // Error messages
                no_active_boost: "ℹ️ Tidak ada speed boost yang aktif.",
                already_active: "⚠️ Anda sudah memiliki speed boost aktif.\n\nTunggu hingga selesai untuk request baru.",
                payment_required: "💳 Pembayaran diperlukan untuk mengaktifkan speed boost.\n\nSilakan lakukan pembayaran: Rp ${amount}"
            },
            
            general: {
                // Common messages
                user_not_found: "❌ Pelanggan dengan ID \"${id}\" tidak ditemukan.",
                error_occurred: "❌ Terjadi kesalahan. Silakan coba lagi.",
                permission_denied: "🚫 Anda tidak memiliki izin untuk menggunakan perintah ini.",
                feature_disabled: "⚠️ Fitur ini sedang tidak tersedia.",
                maintenance_mode: "🔧 Sistem sedang dalam maintenance.\n\nMohon maaf atas ketidaknyamanannya.",
                
                // Confirmation messages
                confirm_action: "⚠️ *KONFIRMASI*\n\nAnda akan ${action}.\n\nKetik *ya* untuk melanjutkan atau *batal* untuk membatalkan.",
                action_cancelled: "❌ Aksi dibatalkan.",
                
                // Help messages
                help_text: "📚 *BANTUAN*\n\n${helpContent}\n\nKetik *menu* untuk melihat menu utama."
            }
        };
    }

    getMessage(path, variables = {}) {
        const keys = path.split('.');
        let message = this.messages;
        
        for (const key of keys) {
            if (message && message[key]) {
                message = message[key];
            } else {
                console.warn(`Message not found: ${path}`);
                return null;
            }
        }
        
        if (typeof message !== 'string') {
            return null;
        }
        
        // Replace variables
        return this.replaceVariables(message, variables);
    }

    replaceVariables(text, variables) {
        let result = text;
        
        for (const [key, value] of Object.entries(variables)) {
            const pattern = new RegExp(`\\$\\{${key}\\}`, 'g');
            result = result.replace(pattern, value || '');
        }
        
        return result;
    }

    saveMessages() {
        try {
            fs.writeFileSync(this.messagesPath, JSON.stringify(this.messages, null, 2), 'utf8');
            return true;
        } catch (error) {
            console.error('Error saving handler messages:', error);
            return false;
        }
    }

    updateMessage(path, message) {
        const keys = path.split('.');
        let target = this.messages;
        
        for (let i = 0; i < keys.length - 1; i++) {
            const key = keys[i];
            if (!target[key]) {
                target[key] = {};
            }
            target = target[key];
        }
        
        target[keys[keys.length - 1]] = message;
        this.saveMessages();
    }

    getAllMessages() {
        return this.messages;
    }
}

// Singleton instance
const handlerMessages = new HandlerMessages();

module.exports = handlerMessages;
