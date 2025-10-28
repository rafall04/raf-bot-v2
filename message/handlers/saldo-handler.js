const saldoManager = require('../../lib/saldo-manager');
const convertRupiah = require('rupiah-format');
const { logger } = require('../../lib/logger');

/**
 * Handle cek saldo command
 * Supports multiple keywords: saldo, ceksaldo, cek saldo, infosaldo, saldo saya
 */
async function handleCekSaldo(msg, sender, reply, pushname) {
    try {
        const userId = sender;
        
        // Create user saldo if not exists
        saldoManager.createUserSaldo(userId);
        
        const saldo = saldoManager.getUserSaldo(userId);
        const formattedSaldo = convertRupiah.convert(saldo);
        
        // Get recent transactions
        const transactions = saldoManager.getAllTransactions()
            .filter(tx => tx.userId === userId)
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
            .slice(0, 5);
        
        let message = `💰 *INFORMASI SALDO*\n\n`;
        message += `Nama: ${pushname || 'User'}\n`;
        message += `Nomor: ${sender.replace('@s.whatsapp.net', '')}\n`;
        message += `Saldo: *${formattedSaldo}*\n`;
        message += `\n`;
        
        if (transactions.length > 0) {
            message += `📜 *Riwayat Transaksi Terakhir:*\n`;
            transactions.forEach(tx => {
                const date = new Date(tx.created_at).toLocaleDateString('id-ID');
                const type = tx.type === 'credit' ? '✅' : '❌';
                const amount = convertRupiah.convert(tx.amount);
                message += `${type} ${date} - ${tx.description} (${amount})\n`;
            });
        } else {
            message += `_Belum ada transaksi_\n`;
        }
        
        message += `\n💡 Ketik *topup* untuk isi saldo`;
        
        await reply(message);
        logger.info(`Saldo check for ${userId}: ${saldo}`);
        
    } catch (error) {
        logger.error('Error in handleCekSaldo:', error);
        await reply('❌ Maaf, terjadi kesalahan saat mengecek saldo. Silakan coba lagi.');
    }
}

/**
 * Handle topup saldo initiation
 * Supports keywords: topup, isi saldo, tambah saldo, topup saldo
 */
async function handleTopupInit(msg, sender, reply, pushname, conversationHandler) {
    try {
        // Create user saldo if not exists
        saldoManager.createUserSaldo(sender);
        
        // Check if user already has pending topup (only active ones)
        const pendingTopup = saldoManager.getAllTopupRequests()
            .find(r => r.userId === sender && 
                  (r.status === 'pending' || r.status === 'waiting_verification'));
            
        if (pendingTopup) {
            const amount = convertRupiah.convert(pendingTopup.amount);
            let message = `⏳ *Anda memiliki request topup yang belum selesai*\n\n`;
            message += `Jumlah: ${amount}\n`;
            message += `Metode: ${pendingTopup.paymentMethod}\n`;
            message += `Status: ${pendingTopup.status === 'waiting_verification' ? 'Menunggu verifikasi admin' : 'Menunggu pembayaran'}\n\n`;
            
            if (pendingTopup.paymentMethod === 'transfer' && pendingTopup.status === 'pending') {
                // Show bank accounts
                if (global.config?.bankAccounts && global.config.bankAccounts.length > 0) {
                    message += `🏦 *Silakan transfer ke:*\n`;
                    global.config.bankAccounts.forEach(account => {
                        message += `${account.bank}: ${account.number}`;
                        if (account.name) message += ` a.n ${account.name}`;
                        message += `\n`;
                    });
                    message += `\n📸 Kirim bukti transfer setelah melakukan pembayaran`;
                }
            }
            
            message += `\n❌ Ketik *batal topup* untuk membatalkan request ini`;
            
            return await reply(message);
        }
        
        // Start topup conversation flow
        conversationHandler.setUserState(sender, {
            step: 'TOPUP_SELECT_METHOD',
            type: 'topup',
            pushname: pushname
        });
        
        let message = `💰 *TOPUP SALDO*\n\n`;
        message += `Hai ${pushname || 'Kak'}, silakan pilih metode pembayaran:\n\n`;
        message += `1️⃣ Transfer Bank\n`;
        message += `2️⃣ Bayar ke Agent/Datang ke Rumah\n\n`;
        message += `Balas dengan angka pilihan Anda (1-2)\n`;
        message += `Ketik *batal* untuk membatalkan`;
        
        await reply(message);
        
        // Don't notify admins yet - wait until user confirms the request
        
    } catch (error) {
        logger.error('Error in handleTopupInit:', error);
        await reply('❌ Maaf, terjadi kesalahan. Silakan coba lagi.');
    }
}

/**
 * Handle cancel topup request
 */
async function handleCancelTopup(msg, sender, reply) {
    try {
        const pendingTopup = saldoManager.getAllTopupRequests()
            .find(r => r.userId === sender && (r.status === 'pending' || r.status === 'waiting_verification'));
            
        if (!pendingTopup) {
            return await reply('ℹ️ Anda tidak memiliki request topup yang aktif untuk dibatalkan.');
        }
        
        // Check remaining time
        const { getRemainingTime } = require('../../lib/topup-expiry');
        const remaining = getRemainingTime(pendingTopup);
        
        // Cancel the topup request using the proper function
        const success = saldoManager.cancelTopupRequest(pendingTopup.id);
        
        if (!success) {
            return await reply('❌ Gagal membatalkan request topup. Silakan coba lagi.');
        }
        
        let message = `✅ *REQUEST TOPUP DIBATALKAN*\n\n`;
        message += `ID Request: ${pendingTopup.id}\n`;
        message += `Jumlah: Rp ${pendingTopup.amount.toLocaleString('id-ID')}\n`;
        if (!remaining.expired) {
            message += `Sisa waktu: ${remaining.text}\n`;
        }
        message += `\nAnda dapat membuat request topup baru kapan saja.`;
        
        await reply(message);
        
    } catch (error) {
        logger.error('Error in handleCancelTopup:', error);
        await reply('❌ Terjadi kesalahan saat membatalkan topup');
    }
}

/**
 * Handle voucher purchase with saldo
 */
async function handleBeliVoucher(msg, sender, reply, pushname) {
    try {
        const userId = sender;
        
        // Create user saldo if not exists
        saldoManager.createUserSaldo(userId);
        
        const currentSaldo = saldoManager.getUserSaldo(userId);
        
        if (currentSaldo <= 0) {
            return await reply('❌ Saldo Anda tidak mencukupi. Silakan topup terlebih dahulu.');
        }
        
        // Get available vouchers
        const vouchers = global.voucher || [];
        
        if (vouchers.length === 0) {
            return await reply('❌ Maaf, tidak ada voucher yang tersedia saat ini.');
        }
        
        let message = `🎫 *BELI VOUCHER DENGAN SALDO*\n\n`;
        message += `Saldo Anda: ${convertRupiah.convert(currentSaldo)}\n\n`;
        message += `📋 *Voucher Tersedia:*\n`;
        
        vouchers.forEach((v, index) => {
            const price = convertRupiah.convert(v.harga || 0);
            const canBuy = currentSaldo >= (v.harga || 0) ? '✅' : '❌';
            message += `${index + 1}. ${v.nama} - ${v.durasi}\n`;
            message += `   Harga: ${price} ${canBuy}\n`;
        });
        
        message += `\nBalas dengan nomor voucher yang ingin dibeli`;
        message += `\nKetik *batal* untuk membatalkan`;
        
        // Set conversation state for voucher purchase
        const conversationHandler = require('../handlers/conversation-handler');
        conversationHandler.setUserState(sender, {
            step: 'VOUCHER_SELECT',
            type: 'voucher_purchase',
            vouchers: vouchers
        });
        
        await reply(message);
        
    } catch (error) {
        logger.error('Error in handleBeliVoucher:', error);
        await reply('❌ Terjadi kesalahan. Silakan coba lagi.');
    }
}

/**
 * Handle transfer saldo between users
 */
async function handleTransferSaldo(msg, sender, reply, args) {
    try {
        if (args.length < 2) {
            return await reply('❌ Format: transfer [nomor] [jumlah]\nContoh: transfer 6281234567890 50000');
        }
        
        const targetNumber = args[0].replace(/[^0-9]/g, '');
        const amount = parseInt(args[1]);
        
        if (isNaN(amount) || amount <= 0) {
            return await reply('❌ Jumlah transfer tidak valid');
        }
        
        const senderId = sender;
        const targetId = targetNumber.startsWith('62') ? 
            `${targetNumber}@s.whatsapp.net` : 
            `62${targetNumber.substring(1)}@s.whatsapp.net`;
        
        const senderSaldo = saldoManager.getUserSaldo(senderId);
        
        if (senderSaldo < amount) {
            return await reply(`❌ Saldo tidak mencukupi\nSaldo Anda: ${convertRupiah.convert(senderSaldo)}`);
        }
        
        // Process transfer
        const success = saldoManager.transferSaldo(senderId, targetId, amount);
        
        if (success) {
            const newSaldo = saldoManager.getUserSaldo(senderId);
            await reply(`✅ Transfer berhasil!\n\nKe: ${targetNumber}\nJumlah: ${convertRupiah.convert(amount)}\nSisa saldo: ${convertRupiah.convert(newSaldo)}`);
            
            // Notify recipient if they have WhatsApp
            if (global.raf) {
                await global.raf.sendMessage(targetId, {
                    text: `💰 *SALDO MASUK*\n\nAnda menerima transfer saldo sebesar ${convertRupiah.convert(amount)}\nDari: ${sender.replace('@s.whatsapp.net', '')}\n\nSaldo Anda sekarang: ${convertRupiah.convert(saldoManager.getUserSaldo(targetId))}`
                });
            }
        } else {
            await reply('❌ Transfer gagal. Silakan coba lagi.');
        }
        
    } catch (error) {
        logger.error('Error in handleTransferSaldo:', error);
        await reply('❌ Terjadi kesalahan saat transfer. Silakan coba lagi.');
    }
}

module.exports = {
    handleCekSaldo,
    handleTopupInit,
    handleCancelTopup,
    handleBeliVoucher,
    handleTransferSaldo
};
