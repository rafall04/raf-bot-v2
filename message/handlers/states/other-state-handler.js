/**
 * Other State Handler
 * Handles miscellaneous conversation states (cancel ticket, reboot, power, package selection)
 * 
 * CRITICAL: Contains state machines for various confirmation flows
 * DO NOT modify without understanding the complete flow
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

/**
 * Helper function to save reports to file
 */
function saveReportsToFile(reports) {
    try {
        const reportsPath = path.join(__dirname, '../../..', 'database', 'reports.json');
        fs.writeFileSync(reportsPath, JSON.stringify(reports, null, 2));
        console.log('[REPORT] Reports saved successfully');
    } catch (error) {
        console.error('[REPORT] Error saving reports:', error);
    }
}

/**
 * Handle CONFIRM_CANCEL_TICKET state
 */
async function handleConfirmCancelTicket(userState, userReply, reply, sender, temp, global, pushname) {
    if (['ya', 'ok', 'lanjut', 'iya', 'y'].includes(userReply)) {
        const { ticketIdToCancel } = userState;
        const reportIndex = global.reports.findIndex(r => r.ticketId === ticketIdToCancel);
        
        if (reportIndex === -1) {
            delete temp[sender];
            return reply("Maaf, tiket tersebut sepertinya sudah tidak ada. Mungkin sudah diproses atau dibatalkan sebelumnya.");
        }

        const report = global.reports[reportIndex];
        report.status = 'dibatalkan';
        report.cancellationReason = 'Dibatalkan oleh pelanggan via WhatsApp';
        report.cancellationTimestamp = new Date().toISOString();
        report.cancelledBy = { id: sender, name: pushname, type: 'pelanggan' };

        saveReportsToFile(global.reports);

        reply(`✅ *Tiket Berhasil Dibatalkan!*\n\nTiket laporan Anda dengan ID *${ticketIdToCancel}* telah berhasil Anda batalkan.`);

        // Hapus state setelah selesai
        delete temp[sender];

    } else {
        reply("Mohon balas *'ya'* untuk melanjutkan pembatalan, atau *'batal'* untuk membatalkan aksi ini.");
    }
}

/**
 * Handle CONFIRM_REBOOT state
 */
async function handleConfirmReboot(userState, userReply, reply, sender, temp, global, axios) {
    if (['ya', 'ok', 'lanjut', 'iya', 'y'].includes(userReply)) {
        const { targetUser } = userState;
        reply(`Baik, permintaan reboot untuk modem *${targetUser.name}* sedang diproses. Mohon tunggu sekitar 5-10 menit hingga modem menyala kembali dan semua lampu indikator stabil. Terima kasih atas kesabarannya! 🙏`);
        
        try {
            await axios.post(global.config.genieacsBaseUrl + "/devices/" + encodeURIComponent(targetUser.device_id) + "/tasks?connection_request", {
                name: "reboot"
            });
            
            setTimeout(() => {
                // Optional: send follow-up message after some time
                console.log(`[REBOOT] Modem ${targetUser.name} rebooted successfully`);
            }, 5000);
        } catch (error) {
            console.error("[REBOOT_ERROR]", error);
            reply(`⚠️ Maaf, terjadi kendala saat mencoba reboot modem. Silakan coba lagi nanti atau hubungi admin.`);
        }
        
        delete temp[sender];
    } else {
        reply("Silakan balas *'ya'* untuk melanjutkan reboot modem, atau *'batal'* untuk membatalkan.");
    }
}

/**
 * Handle ASK_POWER_LEVEL state
 */
async function handleAskPowerLevel(userState, chats, reply) {
    const newPowerLevel = chats.trim();
    
    if (!['100', '80', '60', '40', '20'].includes(newPowerLevel)) {
        return reply(`⚠️ Maaf, Kak. Level daya tidak valid. Mohon pilih salah satu dari: *100, 80, 60, 40, 20*.\n\nAtau ketik *batal* untuk membatalkan.`);
    }
    
    userState.step = 'CONFIRM_GANTI_POWER';
    userState.level_daya = newPowerLevel;
    return reply(`Siap. Saya konfirmasi ya, kekuatan sinyal WiFi akan diubah ke level *${newPowerLevel}%*. Sudah benar?\n\nBalas *'ya'* untuk melanjutkan, atau *'batal'* jika ada yang salah.`);
}

/**
 * Handle CONFIRM_GANTI_POWER state
 */
async function handleConfirmGantiPower(userState, userReply, reply, sender, temp, global, axios) {
    if (['ya', 'ok', 'lanjut', 'iya', 'y'].includes(userReply)) {
        const { targetUser, level_daya } = userState;
        reply(`Oke, ditunggu sebentar ya. Saya sedang mengatur kekuatan sinyal WiFi untuk *${targetUser.name}*... ⏳`);
        
        try {
            await axios.post(global.config.genieacsBaseUrl + "/devices/" + encodeURIComponent(targetUser.device_id) + "/tasks?connection_request", {
                name: 'setParameterValues',
                parameterValues: [
                    ["InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.TransmitPower", level_daya, "xsd:string"]
                ]
            });
            
            reply(`✅ Berhasil! Kekuatan sinyal WiFi Anda sudah diubah ke *${level_daya}%*.\n\n📝 *Penjelasan Level Power:*\n• *100%* = Jangkauan maksimal\n• *80%* = Jangkauan luas\n• *60%* = Jangkauan sedang\n• *40%* = Jangkauan terbatas\n• *20%* = Jangkauan minimal\n\nSilakan cek kembali kualitas sinyal WiFi Anda.`);
        } catch (error) {
            console.error("[GANTIPOWER_ERROR]", error);
            reply(`⚠️ Maaf, ada kendala saat mengubah kekuatan sinyal WiFi. Mohon coba lagi nanti atau hubungi admin.`);
        }
        
        delete temp[sender];
    } else {
        reply("Mohon balas *'ya'* untuk melanjutkan perubahan power WiFi, atau *'batal'* untuk membatalkan.");
    }
}

/**
 * Handle SELECT_SOD_CHOICE state
 */
async function handleSelectSodChoice(userState, userReply, reply, convertRupiah) {
    const chosenIndex = parseInt(userReply, 10);
    const selectedOption = userState.options.find(opt => opt.index === chosenIndex);

    if (!selectedOption) {
        return reply(`⚠️ Pilihan tidak valid. Silakan pilih nomor 1-${userState.options.length} sesuai paket yang tersedia.`);
    }

    userState.selectedOption = selectedOption;
    userState.step = 'CONFIRM_SOD_CHOICE';
    
    const durationText = selectedOption.duration === 1 ? '1 Hari' : `${selectedOption.duration} Hari`;

    return reply(`Anda memilih Speed on Demand:\n*Paket:* ${selectedOption.package.name}\n*Durasi:* ${durationText}\n*Harga:* ${convertRupiah.convert(selectedOption.price)}\n\nApakah Anda yakin ingin melanjutkan? Balas *'ya'* untuk konfirmasi.`);
}

/**
 * Handle CONFIRM_SOD_CHOICE state
 */
async function handleConfirmSodChoice(userState, userReply, reply, sender, temp, global) {
    if (['ya', 'ok', 'lanjut', 'iya', 'y'].includes(userReply)) {
        const { user, selectedOption } = userState;

        // Generate payment instructions (simplified version)
        const paymentCode = `SOD${Date.now().toString().slice(-6)}`;
        
        const paymentInstructions = `✅ *PESANAN SPEED ON DEMAND BERHASIL!*\n\n📋 *Detail Pesanan:*\n├ Paket: ${selectedOption.package.name}\n├ Durasi: ${selectedOption.duration} Hari\n├ Harga: ${selectedOption.price}\n└ Kode: ${paymentCode}\n\n💳 *CARA PEMBAYARAN:*\n\n1️⃣ *Transfer Bank:*\n├ BCA: 1234567890\n├ Mandiri: 9876543210\n└ BRI: 0987654321\n\n2️⃣ *E-Wallet:*\n├ DANA: 08123456789\n├ OVO: 08123456789\n└ GoPay: 08123456789\n\n📝 *Catatan Penting:*\n• Sertakan kode ${paymentCode} saat transfer\n• Kirim bukti transfer ke admin\n• Paket aktif setelah pembayaran dikonfirmasi\n\nTerima kasih! 🙏`;
        
        reply(paymentInstructions);
        delete temp[sender];
        
    } else {
        reply("Pemesanan Speed on Demand dibatalkan. Ada yang bisa saya bantu lagi?");
        delete temp[sender];
    }
}

/**
 * Handle ASK_PACKAGE_CHOICE state
 */
async function handleAskPackageChoice(userState, userReply, reply, convertRupiah) {
    const chosenIndex = parseInt(userReply, 10);
    // Adjust index to be 0-based
    const selectedPackage = userState.options[chosenIndex - 1];

    if (!selectedPackage) {
        return reply(`⚠️ Pilihan tidak valid. Silakan pilih nomor 1-${userState.options.length} sesuai paket yang tersedia.`);
    }

    userState.selectedPackage = selectedPackage;
    userState.step = 'CONFIRM_PACKAGE_CHOICE';
    
    // Calculate new price (example: 10% discount)
    const newPrice = selectedPackage.price * 0.9;
    const newPriceFormatted = convertRupiah.convert(Math.floor(newPrice));

    return reply(`Anda telah memilih *${selectedPackage.name}* dengan harga *${newPriceFormatted}* per bulan.\n\nApakah Anda yakin ingin melanjutkan? Balas *'ya'* untuk konfirmasi.`);
}

/**
 * Handle CONFIRM_PACKAGE_CHOICE state
 */
async function handleConfirmPackageChoice(userState, userReply, reply, sender, temp, global) {
    if (['ya', 'ok', 'lanjut', 'iya', 'y'].includes(userReply)) {
        const { user, selectedPackage } = userState;

        // Here you would normally update the user's package in the database
        // For now, just send confirmation
        
        const confirmationMessage = `✅ *PERUBAHAN PAKET BERHASIL!*\n\n📋 *Detail Perubahan:*\n├ Paket Lama: ${user.subscription || 'Belum ada'}\n├ Paket Baru: ${selectedPackage.name}\n├ Harga Baru: ${selectedPackage.priceFormatted}\n└ Status: Menunggu Aktivasi\n\n📞 *LANGKAH SELANJUTNYA:*\n1. Admin akan menghubungi Anda\n2. Proses aktivasi 1x24 jam\n3. Anda akan menerima notifikasi saat paket aktif\n\nTerima kasih telah upgrade paket! 🎉`;
        
        reply(confirmationMessage);
        delete temp[sender];
        
    } else {
        reply("Perubahan paket dibatalkan. Anda tetap menggunakan paket saat ini. Ada yang bisa saya bantu lagi?");
        delete temp[sender];
    }
}

module.exports = {
    handleConfirmCancelTicket,
    handleConfirmReboot,
    handleAskPowerLevel,
    handleConfirmGantiPower,
    handleSelectSodChoice,
    handleConfirmSodChoice,
    handleAskPackageChoice,
    handleConfirmPackageChoice
};
