/**
 * Speed Boost Status Handler
 * Handle status checking and reporting for speed boost
 */

const convertRupiah = require('rupiah-format');

/**
 * Check speed boost status for user
 */
async function checkSpeedBoostStatus(msg, user, sender, isAdmin = false, targetUserId = null) {
    try {
        // Determine which user to check
        const checkUserId = targetUserId || user.id;
        const checkUser = targetUserId ? 
            global.users?.find(u => u.id == targetUserId) : 
            user;
        
        if (!checkUser) {
            await global.conn.sendMessage(msg.key.remoteJid, {
                text: '❌ User tidak ditemukan.'
            });
            return;
        }
        
        // Get all speed requests for this user
        const userRequests = global.speed_requests?.filter(req => 
            req.userId == checkUserId
        ) || [];
        
        if (userRequests.length === 0) {
            await global.conn.sendMessage(msg.key.remoteJid, {
                text: `ℹ️ ${isAdmin ? `User ${checkUser.name}` : 'Anda'} tidak memiliki riwayat Speed Boost.`
            });
            return;
        }
        
        // Sort by date (newest first)
        userRequests.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        
        // Build status message
        let statusMsg = `📊 *STATUS SPEED BOOST*\n`;
        statusMsg += `━━━━━━━━━━━━━━━━━━━━━\n\n`;
        
        if (isAdmin) {
            statusMsg += `👤 User: ${checkUser.name}\n`;
            statusMsg += `📱 No. HP: ${checkUser.phone_number}\n`;
            statusMsg += `🆔 User ID: ${checkUser.id}\n\n`;
        }
        
        // Find active/pending requests
        const activeRequest = userRequests.find(r => r.status === 'active');
        const pendingRequest = userRequests.find(r => r.status === 'pending');
        
        if (activeRequest) {
            statusMsg += `✅ *SPEED BOOST AKTIF*\n`;
            statusMsg += `├ ID: ${activeRequest.id}\n`;
            statusMsg += `├ Paket: ${activeRequest.requestedPackageName}\n`;
            statusMsg += `├ Kecepatan: ${activeRequest.requestedPackageProfile}\n`;
            statusMsg += `├ Durasi: ${activeRequest.durationLabel}\n`;
            statusMsg += `├ Harga: ${convertRupiah.convert(activeRequest.price)}\n`;
            statusMsg += `├ Mulai: ${formatDate(activeRequest.activatedAt || activeRequest.createdAt)}\n`;
            
            if (activeRequest.expirationDate) {
                const expDate = new Date(activeRequest.expirationDate);
                const now = new Date();
                const hoursLeft = Math.max(0, (expDate - now) / (1000 * 60 * 60));
                
                statusMsg += `├ Berakhir: ${formatDate(activeRequest.expirationDate)}\n`;
                statusMsg += `└ Sisa Waktu: ${hoursLeft.toFixed(1)} jam\n\n`;
                
                if (hoursLeft <= 0) {
                    statusMsg += `⚠️ *Speed Boost sudah expired, akan segera di-revert*\n\n`;
                }
            } else {
                statusMsg += `└ Status: Aktif (tanpa batas waktu)\n\n`;
            }
        }
        
        if (pendingRequest) {
            statusMsg += `⏳ *SPEED BOOST PENDING*\n`;
            statusMsg += `├ ID: ${pendingRequest.id}\n`;
            statusMsg += `├ Paket: ${pendingRequest.requestedPackageName}\n`;
            statusMsg += `├ Durasi: ${pendingRequest.durationLabel}\n`;
            statusMsg += `├ Harga: ${convertRupiah.convert(pendingRequest.price)}\n`;
            statusMsg += `├ Metode: ${getPaymentMethodLabel(pendingRequest.paymentMethod)}\n`;
            statusMsg += `├ Status Bayar: ${getPaymentStatusLabel(pendingRequest.paymentStatus)}\n`;
            statusMsg += `├ Dibuat: ${formatDate(pendingRequest.createdAt)}\n`;
            
            // Calculate days since created
            const createdDate = new Date(pendingRequest.createdAt);
            const daysSinceCreated = (new Date() - createdDate) / (1000 * 60 * 60 * 24);
            
            if (daysSinceCreated > 5) {
                statusMsg += `└ ⚠️ Akan dibatalkan otomatis dalam ${(7 - daysSinceCreated).toFixed(1)} hari\n\n`;
            } else {
                statusMsg += `└ Menunggu: ${pendingRequest.paymentMethod === 'transfer' ? 'Verifikasi pembayaran' : 'Approval admin'}\n\n`;
            }
        }
        
        if (!activeRequest && !pendingRequest) {
            statusMsg += `ℹ️ Tidak ada Speed Boost aktif atau pending.\n\n`;
        }
        
        // Show recent history (last 3)
        statusMsg += `📜 *RIWAYAT TERAKHIR*\n`;
        statusMsg += `━━━━━━━━━━━━━━━━━━━━━\n`;
        
        const recentRequests = userRequests.slice(0, 3);
        recentRequests.forEach((req, index) => {
            const statusEmoji = getStatusEmoji(req.status);
            statusMsg += `\n${index + 1}. ${statusEmoji} ${req.status.toUpperCase()}\n`;
            statusMsg += `   Paket: ${req.requestedPackageName}\n`;
            statusMsg += `   Durasi: ${req.durationLabel || '-'}\n`;
            statusMsg += `   Tanggal: ${formatDate(req.createdAt)}\n`;
        });
        
        if (isAdmin) {
            statusMsg += `\n\n💡 *Admin Commands:*\n`;
            statusMsg += `• clearspeed ${checkUserId} - Clear status\n`;
            statusMsg += `• /speed-requests - Lihat di web`;
        }
        
        await global.conn.sendMessage(msg.key.remoteJid, { text: statusMsg });
        
    } catch (error) {
        console.error('[CHECK_SPEED_STATUS_ERROR]', error);
        await global.conn.sendMessage(msg.key.remoteJid, {
            text: '❌ Terjadi kesalahan saat mengecek status Speed Boost.'
        });
    }
}

/**
 * Format date to readable string
 */
function formatDate(dateStr) {
    if (!dateStr) return '-';
    
    const date = new Date(dateStr);
    const options = {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Jakarta'
    };
    
    return date.toLocaleString('id-ID', options);
}

/**
 * Get payment method label
 */
function getPaymentMethodLabel(method) {
    const labels = {
        'cash': '💵 Cash',
        'transfer': '🏦 Transfer',
        'double_billing': '📋 Double Billing',
        'free': '🎁 Gratis'
    };
    return labels[method] || method;
}

/**
 * Get payment status label
 */
function getPaymentStatusLabel(status) {
    const labels = {
        'unpaid': '❌ Belum Bayar',
        'pending': '⏳ Menunggu Verifikasi',
        'paid': '✅ Lunas',
        'verified': '✅ Terverifikasi',
        'rejected': '❌ Ditolak'
    };
    return labels[status] || status;
}

/**
 * Get status emoji
 */
function getStatusEmoji(status) {
    const emojis = {
        'pending': '⏳',
        'active': '✅',
        'expired': '⏰',
        'completed': '✔️',
        'cancelled': '❌',
        'cancelled_auto': '🔄',
        'cancelled_admin': '🚫',
        'reverted': '↩️',
        'rejected': '❌'
    };
    return emojis[status] || '•';
}

module.exports = {
    checkSpeedBoostStatus
};
