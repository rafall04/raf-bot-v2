"use strict";

/**
 * Agent Transaction Handler
 * Handles agent confirmation and transaction management via WhatsApp
 */

const agentTransactionManager = require('../../lib/agent-transaction-manager');
const saldoManager = require('../../lib/saldo-manager');
const agentManager = require('../../lib/agent-manager');
const { logger } = require('../../lib/logger');

/**
 * Handle agent confirmation command
 * Format: konfirmasi [transaction_id] [pin]
 * Example: konfirmasi AGT_TRX_123456 1234
 */
async function handleAgentConfirmation(msg, sender, reply, args) {
    try {
        // Validate format
        if (args.length < 2) {
            return await reply(
                '❌ *Format salah!*\n\n' +
                '*Format:* konfirmasi [transaction_id] [pin]\n' +
                '*Contoh:* konfirmasi AGT_TRX_123456 1234\n\n' +
                '💡 Transaction ID ada di notifikasi yang Anda terima'
            );
        }
        
        const transactionId = args[0];
        const pin = args[1];
        
        logger.info('Agent confirmation attempt', {
            transactionId: transactionId,
            agent: sender
        });
        
        // Get transaction
        const transaction = agentTransactionManager.getTransactionById(transactionId);
        
        if (!transaction) {
            return await reply(
                '❌ *Transaction tidak ditemukan.*\n\n' +
                'Pastikan ID transaction benar.\n' +
                'Ketik *transaksi hari ini* untuk melihat list transaction.'
            );
        }
        
        if (transaction.status !== 'pending') {
            let statusText = transaction.status;
            if (transaction.status === 'confirmed') statusText = 'sudah dikonfirmasi';
            if (transaction.status === 'completed') statusText = 'sudah selesai';
            if (transaction.status === 'cancelled') statusText = 'dibatalkan';
            
            return await reply(
                `❌ *Transaction ${statusText}.*\n\n` +
                'Hanya transaction dengan status "pending" yang bisa dikonfirmasi.\n\n' +
                `Status saat ini: *${transaction.status}*` +
                (transaction.confirmedAt ? `\nDikonfirmasi pada: ${new Date(transaction.confirmedAt).toLocaleString('id-ID')}` : '')
            );
        }
        
        // Confirm transaction (this will verify PIN internally)
        const result = await agentTransactionManager.confirmTransaction(
            transactionId,
            sender,
            pin
        );
        
        if (!result.success) {
            logger.warn('Agent confirmation failed', {
                transactionId: transactionId,
                agent: sender,
                reason: result.message
            });
            
            // Check if it's a PIN error
            if (result.message.includes('PIN')) {
                return await reply(
                    `❌ *PIN salah.*\n\n` +
                    'Silakan coba lagi dengan PIN yang benar.\n\n' +
                    '💡 Lupa PIN? Hubungi admin untuk reset PIN.'
                );
            }
            
            return await reply(`❌ ${result.message}`);
        }
        
        logger.info('Agent confirmation successful', {
            transactionId: transactionId,
            agent: sender
        });
        
        // Process saldo addition
        const saldoResult = saldoManager.processAgentConfirmation(transactionId);
        
        if (!saldoResult.success) {
            logger.error('Failed to process saldo after agent confirmation', {
                transactionId: transactionId,
                error: saldoResult.message
            });
            
            return await reply(
                '❌ *Gagal memproses saldo.*\n\n' +
                'Transaction sudah dikonfirmasi tapi saldo belum bertambah.\n' +
                'Hubungi admin segera.'
            );
        }
        
        // Success notification to agent
        let agentMsg = `✅ *KONFIRMASI BERHASIL*\n\n`;
        agentMsg += `🆔 Transaction: ${transactionId}\n`;
        agentMsg += `👤 Customer: ${transaction.customerName}\n`;
        agentMsg += `📱 Nomor: ${transaction.customerId.replace('@s.whatsapp.net', '')}\n`;
        agentMsg += `💰 Jumlah: Rp ${transaction.amount.toLocaleString('id-ID')}\n`;
        agentMsg += `✅ Status: Confirmed\n\n`;
        agentMsg += `━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
        agentMsg += `Saldo customer telah ditambahkan.\n\n`;
        agentMsg += `Terima kasih! 🙏`;
        
        await reply(agentMsg);
        
        // Notify customer
        if (global.raf) {
            try {
                const customerMsg = `✅ *TOPUP BERHASIL*\n\n` +
                    `💰 Jumlah: Rp ${transaction.amount.toLocaleString('id-ID')}\n` +
                    `📍 Agent: ${transaction.agentName}\n` +
                    `💳 Saldo baru: Rp ${saldoResult.newSaldo.toLocaleString('id-ID')}\n\n` +
                    `━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
                    `Terima kasih telah menggunakan layanan kami! 🙏\n\n` +
                    `💡 Ketik *ceksaldo* untuk melihat saldo Anda`;
                
                await global.raf.sendMessage(transaction.customerId, { text: customerMsg });
                logger.info('Customer notified of successful topup', {
                    customerId: transaction.customerId
                });
            } catch (error) {
                logger.error('Failed to notify customer:', error);
            }
        }
        
        // Notify admin
        if (global.raf && global.config?.adminNumbers) {
            try {
                const adminMsg = `✅ *TOPUP DIKONFIRMASI*\n\n` +
                    `📄 ID: ${saldoResult.topupRequest.id}\n` +
                    `🆔 Transaction: ${transactionId}\n` +
                    `👤 Customer: ${transaction.customerName} (${transaction.customerId.replace('@s.whatsapp.net', '')})\n` +
                    `💰 Jumlah: Rp ${transaction.amount.toLocaleString('id-ID')}\n` +
                    `📍 Agent: ${transaction.agentName}\n` +
                    `✅ Status: Verified\n` +
                    `⏰ Waktu konfirmasi: ${new Date().toLocaleString('id-ID')}\n\n` +
                    `━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
                    `Saldo customer telah ditambahkan otomatis.`;
                
                // Send to all admins
                for (const adminNumber of global.config.adminNumbers) {
                    const adminJid = adminNumber.includes('@') ? adminNumber : `${adminNumber}@s.whatsapp.net`;
                    try {
                        await global.raf.sendMessage(adminJid, { text: adminMsg });
                    } catch (error) {
                        logger.error('Failed to notify admin:', error);
                    }
                }
            } catch (error) {
                logger.error('Failed to send admin notifications:', error);
            }
        }
        
    } catch (error) {
        logger.error('Error in handleAgentConfirmation:', error);
        await reply('❌ Terjadi kesalahan. Silakan coba lagi atau hubungi admin.');
    }
}

/**
 * Handle agent today transactions
 * Command: transaksi hari ini
 */
async function handleAgentTodayTransactions(msg, sender, reply) {
    try {
        logger.info('Transaksi command received', {
            sender: sender
        });
        
        // Get agent by WhatsApp number
        const agent = agentManager.getAgentByWhatsapp(sender);
        
        logger.info('Agent lookup result', {
            sender: sender,
            found: agent ? true : false,
            agentId: agent?.id
        });
        
        if (!agent) {
            logger.warn('Agent not found for transaksi command', {
                sender: sender
            });
            
            return await reply(
                '❌ *Nomor Anda tidak terdaftar sebagai agent.*\n\n' +
                'Untuk menggunakan command ini, nomor WhatsApp Anda harus:\n' +
                '1. Terdaftar sebagai agent di sistem\n' +
                '2. Sudah memiliki credential (PIN)\n\n' +
                '📞 Hubungi admin untuk registrasi:\n' +
                'wa.me/6289685645956\n\n' +
                '💡 *Tips:* Ketik *profil agent* untuk cek status registrasi'
            );
        }
        
        logger.info('Agent checking today transactions', {
            agentId: agent.id,
            agentName: agent.name
        });
        
        // Get today's transactions
        const transactions = agentTransactionManager.getTodayTransactions(agent.id);
        
        if (transactions.length === 0) {
            return await reply(
                `ℹ️ *TRANSAKSI HARI INI*\n\n` +
                `Agent: ${agent.name}\n\n` +
                `Belum ada transaksi hari ini.`
            );
        }
        
        // Calculate statistics
        let totalAmount = 0;
        let pendingCount = 0;
        let confirmedCount = 0;
        let completedCount = 0;
        
        // Format message
        let message = `📊 *TRANSAKSI HARI INI*\n\n`;
        message += `Agent: ${agent.name}\n`;
        message += `Total: ${transactions.length} transaksi\n\n`;
        message += `━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
        
        transactions.forEach((trx) => {
            const time = new Date(trx.created_at).toLocaleTimeString('id-ID', {
                hour: '2-digit',
                minute: '2-digit'
            });
            
            let icon = '⏳';
            let statusText = 'Pending';
            
            if (trx.status === 'completed') {
                icon = '✅';
                statusText = 'Selesai';
                totalAmount += trx.amount;
                completedCount++;
            } else if (trx.status === 'confirmed') {
                icon = '🔄';
                statusText = 'Dikonfirmasi';
                confirmedCount++;
            } else if (trx.status === 'pending') {
                icon = '⏳';
                statusText = 'Menunggu';
                pendingCount++;
            } else if (trx.status === 'cancelled') {
                icon = '❌';
                statusText = 'Batal';
            }
            
            message += `${icon} ${time} - Rp ${trx.amount.toLocaleString('id-ID')}\n`;
            message += `   ${trx.customerName} - ${statusText}\n`;
            
            if (trx.status === 'pending') {
                message += `   ID: ${trx.id}\n`;
                message += `   💡 Ketik: konfirmasi ${trx.id} [PIN]\n`;
            }
            
            message += `\n`;
        });
        
        message += `━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
        message += `💰 Total Selesai: Rp ${totalAmount.toLocaleString('id-ID')}\n`;
        message += `✅ Selesai: ${completedCount}\n`;
        message += `🔄 Dikonfirmasi: ${confirmedCount}\n`;
        message += `⏳ Pending: ${pendingCount}`;
        
        await reply(message);
        
    } catch (error) {
        logger.error('Error in handleAgentTodayTransactions:', {
            error: error.message,
            stack: error.stack,
            sender: sender
        });
        
        // Always try to send a reply even if there's an error
        try {
            await reply(
                '❌ *Terjadi kesalahan sistem.*\n\n' +
                'Error: ' + error.message + '\n\n' +
                'Silakan coba lagi atau hubungi admin jika masalah berlanjut.'
            );
        } catch (replyError) {
            logger.error('Failed to send error message:', {
                error: replyError.message
            });
        }
    }
}

/**
 * Handle check topup status
 * Command: cek topup (tanpa parameter, auto-detect by user)
 */
async function handleCheckTopupStatus(msg, sender, reply) {
    try {
        // Get all topup requests for this user that are still pending/processing
        const allRequests = saldoManager.getAllTopupRequests();
        const userRequests = allRequests.filter(r => 
            r.userId === sender && 
            (r.status === 'pending' || r.status === 'waiting_verification')
        );
        
        // If no pending requests found
        if (!userRequests || userRequests.length === 0) {
            return await reply(
                '📋 *STATUS TOPUP*\n\n' +
                '✅ Tidak ada proses topup yang sedang berjalan.\n\n' +
                '💡 Ketik *topup* untuk melakukan topup saldo\n' +
                '💡 Ketik *ceksaldo* untuk melihat saldo Anda'
            );
        }
        
        // Get the most recent pending request
        const topupRequest = userRequests.sort((a, b) => 
            new Date(b.created_at) - new Date(a.created_at)
        )[0];
        
        // If multiple pending requests, inform user
        let multipleNote = '';
        if (userRequests.length > 1) {
            multipleNote = `\n\n⚠️ Anda memiliki ${userRequests.length} request topup pending. Menampilkan yang terbaru.`;
        }
        
        // Format status message
        let statusIcon = '⏳';
        let statusText = 'Menunggu';
        let statusDetail = '';
        
        if (topupRequest.status === 'verified') {
            statusIcon = '✅';
            statusText = 'Verified';
            statusDetail = `Dikonfirmasi pada: ${new Date(topupRequest.verifiedAt).toLocaleString('id-ID')}\n`;
            statusDetail += `Saldo telah ditambahkan! ✅`;
        } else if (topupRequest.status === 'pending') {
            if (topupRequest.paymentMethod === 'transfer') {
                if (topupRequest.paymentProof) {
                    statusText = 'Menunggu verifikasi admin';
                    statusDetail = 'Bukti transfer sudah diterima.\nAdmin akan memverifikasi dalam 1x24 jam.';
                } else {
                    statusText = 'Menunggu bukti transfer';
                    statusDetail = 'Silakan kirim bukti transfer ke chat ini.';
                }
            } else if (topupRequest.paymentMethod === 'cash' && topupRequest.agentId) {
                const agent = agentManager.getAgentById(topupRequest.agentId);
                statusText = 'Menunggu konfirmasi agent';
                statusDetail = `Agent: ${agent?.name || 'Unknown'}\n`;
                statusDetail += `Hubungi agent untuk bayar tunai.`;
            }
        } else if (topupRequest.status === 'rejected') {
            statusIcon = '❌';
            statusText = 'Ditolak';
            statusDetail = topupRequest.notes || 'Hubungi admin untuk informasi lebih lanjut.';
        } else if (topupRequest.status === 'cancelled') {
            statusIcon = '❌';
            statusText = 'Dibatalkan';
            statusDetail = 'Request ini telah dibatalkan.';
        }
        
        let message = `📋 *STATUS TOPUP*\n\n`;
        message += `🆔 ID: ${topupRequest.id}\n`;
        message += `💰 Jumlah: Rp ${topupRequest.amount.toLocaleString('id-ID')}\n`;
        message += `🏦 Metode: ${topupRequest.paymentMethod === 'transfer' ? 'Transfer Bank' : 'Bayar ke Agent'}\n`;
        
        if (topupRequest.agentId) {
            const agent = agentManager.getAgentById(topupRequest.agentId);
            if (agent) {
                message += `📍 Agent: ${agent.name}\n`;
            }
        }
        
        message += `${statusIcon} Status: *${statusText}*\n\n`;
        message += `━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
        message += `${statusDetail}\n\n`;
        message += `Dibuat: ${new Date(topupRequest.created_at).toLocaleString('id-ID')}`;
        
        // Add multiple request note if applicable
        if (multipleNote) {
            message += multipleNote;
        }
        
        await reply(message);
        
    } catch (error) {
        logger.error('Error in handleCheckTopupStatus:', error);
        await reply('❌ Terjadi kesalahan. Silakan coba lagi.');
    }
}

module.exports = {
    handleAgentConfirmation,
    handleAgentTodayTransactions,
    handleCheckTopupStatus
};
