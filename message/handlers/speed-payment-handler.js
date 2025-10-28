/**
 * Speed Request Payment Handler
 * Handles payment proof upload for speed boost requests via WhatsApp
 */

const fs = require('fs');
const path = require('path');

/**
 * Check if user has pending speed request that needs payment proof
 */
function getUserPendingSpeedRequest(userId) {
    // Find pending speed request that needs payment proof
    const pendingRequest = global.speed_requests?.find(req => 
        req.userId == userId && 
        req.status === 'pending' &&
        ['cash', 'transfer'].includes(req.paymentMethod) &&
        req.paymentStatus === 'unpaid'
    );
    
    return pendingRequest;
}

/**
 * Handle payment proof upload for speed request
 */
async function handleSpeedPaymentProof(msg, user) {
    try {
        // Dynamic import for baileys
        const { downloadMediaMessage } = await import('@whiskeysockets/baileys');
        
        // Check if user has pending speed request
        const pendingRequest = getUserPendingSpeedRequest(user.id);
        
        if (!pendingRequest) {
            await global.conn.sendMessage(msg.key.remoteJid, {
                text: `❌ Anda tidak memiliki permintaan speed boost yang menunggu pembayaran.\n\n` +
                      `Untuk request speed boost, silakan hubungi admin atau gunakan aplikasi.`
            });
            return;
        }
        
        // Check if message contains image
        const messageType = Object.keys(msg.message)[0];
        if (!['imageMessage', 'documentMessage'].includes(messageType)) {
            await global.conn.sendMessage(msg.key.remoteJid, {
                text: `📸 *Upload Bukti Pembayaran Speed Boost*\n\n` +
                      `Anda memiliki permintaan speed boost yang menunggu pembayaran:\n` +
                      `• Paket: ${pendingRequest.requestedPackageName}\n` +
                      `• Durasi: ${pendingRequest.durationKey.replace('_', ' ')}\n` +
                      `• Harga: Rp ${Number(pendingRequest.price).toLocaleString('id-ID')}\n` +
                      `• Metode: ${pendingRequest.paymentMethod === 'cash' ? 'Cash' : 'Transfer'}\n\n` +
                      `Silakan kirim foto bukti pembayaran untuk melanjutkan.`
            });
            return;
        }
        
        // Download the media
        const buffer = await downloadMediaMessage(msg, 'buffer', {});
        
        // Create upload directory if not exists
        const uploadDir = path.join(__dirname, '..', '..', 'static', 'uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        
        // Generate filename
        const timestamp = Date.now();
        const extension = messageType === 'documentMessage' ? '.pdf' : '.jpg';
        const filename = `payment-speed-${timestamp}-${user.id}${extension}`;
        const filepath = path.join(uploadDir, filename);
        
        // Save file
        fs.writeFileSync(filepath, buffer);
        
        // Get caption if any
        const caption = msg.message[messageType]?.caption || '';
        
        // Update speed request with payment proof
        const requestIndex = global.speed_requests.findIndex(r => r.id === pendingRequest.id);
        if (requestIndex !== -1) {
            global.speed_requests[requestIndex].paymentProof = `/uploads/${filename}`;
            global.speed_requests[requestIndex].paymentStatus = 'pending'; // Waiting for verification
            global.speed_requests[requestIndex].paymentNotes = caption || 'Upload via WhatsApp';
            global.speed_requests[requestIndex].paymentDate = new Date().toISOString();
            global.speed_requests[requestIndex].updatedAt = new Date().toISOString();
            
            // Save to database
            const { saveSpeedRequests } = require('../../lib/database');
            saveSpeedRequests();
            
            // Send confirmation to user
            await global.conn.sendMessage(msg.key.remoteJid, {
                text: `✅ *Bukti Pembayaran Berhasil Diterima!*\n\n` +
                      `Bukti pembayaran untuk speed boost Anda telah kami terima.\n\n` +
                      `📋 *Detail Request:*\n` +
                      `• ID: ${pendingRequest.id}\n` +
                      `• Paket: ${pendingRequest.requestedPackageName}\n` +
                      `• Durasi: ${pendingRequest.durationKey.replace('_', ' ')}\n` +
                      `• Harga: Rp ${Number(pendingRequest.price).toLocaleString('id-ID')}\n\n` +
                      `⏳ Status: *Menunggu Verifikasi Admin*\n\n` +
                      `Kami akan segera memverifikasi pembayaran Anda. Anda akan menerima notifikasi setelah pembayaran diverifikasi.\n\n` +
                      `_Terima kasih atas kesabaran Anda._`
            });
            
            // Notify admin about payment proof upload
            if (global.config.ownerNumber && Array.isArray(global.config.ownerNumber)) {
                const notifMessage = `💰 *Bukti Pembayaran Speed Boost via WhatsApp* 💰\n\n` +
                    `Pelanggan telah mengupload bukti pembayaran.\n\n` +
                    `*Pelanggan:* ${user.name}\n` +
                    `*No. HP:* ${user.phone_number}\n` +
                    `*Paket Diminta:* ${pendingRequest.requestedPackageName}\n` +
                    `*Durasi:* ${pendingRequest.durationKey.replace('_', ' ')}\n` +
                    `*Harga:* Rp ${Number(pendingRequest.price).toLocaleString('id-ID')}\n` +
                    `*Metode:* ${pendingRequest.paymentMethod === 'cash' ? 'Cash' : 'Transfer'}\n` +
                    `*Catatan:* ${caption || '-'}\n\n` +
                    `Silakan verifikasi di halaman admin Speed Requests.`;
                
                for (const ownerNum of global.config.ownerNumber) {
                    const ownerJid = ownerNum.endsWith('@s.whatsapp.net') ? ownerNum : `${ownerNum}@s.whatsapp.net`;
                    try {
                        await global.conn.sendMessage(ownerJid, { text: notifMessage });
                        
                        // Also send the payment proof image to admin
                        if (messageType === 'imageMessage') {
                            await global.conn.sendMessage(ownerJid, {
                                image: buffer,
                                caption: `Bukti pembayaran dari ${user.name} untuk Speed Boost`
                            });
                        }
                    } catch (e) {
                        console.error(`[SPEED_PAYMENT_WA_NOTIF_ERROR] Failed to notify admin ${ownerJid}:`, e.message);
                    }
                }
            }
            
            console.log(`[SPEED_PAYMENT_WA] Payment proof uploaded via WhatsApp for request ${pendingRequest.id} by user ${user.name}`);
            return true;
        }
        
    } catch (error) {
        console.error('[SPEED_PAYMENT_WA_ERROR]', error);
        await global.conn.sendMessage(msg.key.remoteJid, {
            text: `❌ Maaf, terjadi kesalahan saat memproses bukti pembayaran.\n\nSilakan coba lagi atau hubungi admin.`
        });
        return false;
    }
}

/**
 * Check if user wants to check speed request status
 */
async function handleSpeedRequestStatus(msg, user) {
    try {
        // Find user's speed requests
        const userRequests = global.speed_requests?.filter(req => req.userId == user.id) || [];
        
        if (userRequests.length === 0) {
            await global.conn.sendMessage(msg.key.remoteJid, {
                text: `📊 Anda belum memiliki permintaan speed boost.`
            });
            return;
        }
        
        // Find active or latest request
        const activeRequest = userRequests.find(r => r.status === 'active');
        const pendingRequest = userRequests.find(r => r.status === 'pending');
        const latestRequest = userRequests[0]; // Assuming sorted by date
        
        let statusMessage = `📊 *Status Speed Boost Anda*\n\n`;
        
        if (activeRequest) {
            const expirationDate = new Date(activeRequest.expirationDate);
            const now = new Date();
            const hoursLeft = Math.max(0, Math.floor((expirationDate - now) / (1000 * 60 * 60)));
            
            statusMessage += `✅ *Speed Boost Aktif*\n` +
                `• Paket: ${activeRequest.requestedPackageName}\n` +
                `• Durasi: ${activeRequest.durationKey.replace('_', ' ')}\n` +
                `• Berakhir: ${expirationDate.toLocaleString('id-ID')}\n` +
                `• Sisa Waktu: ${hoursLeft} jam\n`;
        }
        
        if (pendingRequest) {
            statusMessage += `\n⏳ *Permintaan Pending*\n` +
                `• Paket: ${pendingRequest.requestedPackageName}\n` +
                `• Durasi: ${pendingRequest.durationKey.replace('_', ' ')}\n` +
                `• Harga: Rp ${Number(pendingRequest.price).toLocaleString('id-ID')}\n` +
                `• Status Bayar: ${getPaymentStatusText(pendingRequest.paymentStatus)}\n`;
                
            if (pendingRequest.paymentStatus === 'unpaid' && ['cash', 'transfer'].includes(pendingRequest.paymentMethod)) {
                statusMessage += `\n💡 *Tips:* Kirim foto bukti pembayaran untuk mempercepat proses verifikasi.`;
            }
        }
        
        if (!activeRequest && !pendingRequest && latestRequest) {
            statusMessage += `📝 *Request Terakhir*\n` +
                `• Paket: ${latestRequest.requestedPackageName}\n` +
                `• Status: ${getRequestStatusText(latestRequest.status)}\n` +
                `• Tanggal: ${new Date(latestRequest.createdAt).toLocaleString('id-ID')}\n`;
        }
        
        await global.conn.sendMessage(msg.key.remoteJid, { text: statusMessage });
        
    } catch (error) {
        console.error('[SPEED_STATUS_WA_ERROR]', error);
        await global.conn.sendMessage(msg.key.remoteJid, {
            text: `❌ Maaf, terjadi kesalahan saat mengecek status speed boost.`
        });
    }
}

/**
 * Get payment status text in Indonesian
 */
function getPaymentStatusText(status) {
    const statusMap = {
        'unpaid': '❌ Belum Bayar',
        'pending': '⏳ Menunggu Verifikasi',
        'verified': '✅ Terverifikasi',
        'paid': '✅ Lunas',
        'rejected': '❌ Ditolak'
    };
    return statusMap[status] || status;
}

/**
 * Get request status text in Indonesian
 */
function getRequestStatusText(status) {
    const statusMap = {
        'pending': '⏳ Menunggu',
        'active': '✅ Aktif',
        'completed': '✔️ Selesai',
        'expired': '⏰ Expired',
        'rejected': '❌ Ditolak',
        'reverted': '↩️ Dikembalikan'
    };
    return statusMap[status] || status;
}

module.exports = {
    handleSpeedPaymentProof,
    handleSpeedRequestStatus,
    getUserPendingSpeedRequest
};
