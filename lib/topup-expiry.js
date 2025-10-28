const saldoManager = require('./saldo-manager');
const { logger } = require('./logger');

/**
 * Check and expire old pending topup requests
 * Requests older than 24 hours will be automatically cancelled
 */
function checkExpiredTopupRequests() {
    try {
        const requests = saldoManager.getAllTopupRequests();
        const now = new Date();
        const expiryTime = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
        let expiredCount = 0;
        
        requests.forEach(request => {
            if (request.status === 'pending' && !request.paymentProof) {
                const createdAt = new Date(request.created_at);
                const age = now - createdAt;
                
                if (age > expiryTime) {
                    // Expire the request
                    request.status = 'expired';
                    request.expired_at = now.toISOString();
                    request.expiry_reason = 'Tidak ada pembayaran dalam 24 jam';
                    expiredCount++;
                    
                    // Notify user if WhatsApp is available
                    if (global.raf && global.raf.sendMessage) {
                        const message = `⏰ *REQUEST TOPUP EXPIRED*\n\n` +
                            `ID Request: ${request.id}\n` +
                            `Jumlah: Rp ${request.amount.toLocaleString('id-ID')}\n\n` +
                            `Request topup Anda telah kadaluarsa karena tidak ada pembayaran dalam 24 jam.\n\n` +
                            `Silakan buat request baru jika masih ingin topup.`;
                        
                        global.raf.sendMessage(request.userId, { text: message })
                            .catch(err => logger.error('Failed to notify user about expired topup', err));
                    }
                    
                    logger.info(`Topup request ${request.id} expired after 24 hours`);
                }
            }
        });
        
        if (expiredCount > 0) {
            saldoManager.saveTopupRequests();
            logger.info(`Expired ${expiredCount} topup requests`);
        }
        
    } catch (error) {
        logger.error('Error checking expired topup requests:', error);
    }
}

/**
 * Get remaining time for a topup request
 * @param {Object} request - Topup request object
 * @returns {Object} Remaining time info
 */
function getRemainingTime(request) {
    const now = new Date();
    const createdAt = new Date(request.created_at);
    const expiryTime = 24 * 60 * 60 * 1000; // 24 hours
    const age = now - createdAt;
    const remaining = expiryTime - age;
    
    if (remaining <= 0) {
        return {
            expired: true,
            hours: 0,
            minutes: 0,
            text: 'Expired'
        };
    }
    
    const hours = Math.floor(remaining / (60 * 60 * 1000));
    const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
    
    return {
        expired: false,
        hours,
        minutes,
        text: `${hours} jam ${minutes} menit`
    };
}

/**
 * Send reminder to users with pending topup
 * Reminder sent after 12 hours if no payment proof
 */
function sendTopupReminders() {
    try {
        const requests = saldoManager.getAllTopupRequests();
        const now = new Date();
        const reminderTime = 12 * 60 * 60 * 1000; // 12 hours
        
        requests.forEach(request => {
            if (request.status === 'pending' && 
                !request.paymentProof && 
                !request.reminder_sent &&
                request.paymentMethod === 'transfer') {
                
                const createdAt = new Date(request.created_at);
                const age = now - createdAt;
                
                if (age > reminderTime) {
                    // Send reminder
                    if (global.raf && global.raf.sendMessage) {
                        const remaining = getRemainingTime(request);
                        const message = `⏰ *REMINDER TOPUP*\n\n` +
                            `ID Request: ${request.id}\n` +
                            `Jumlah: Rp ${request.amount.toLocaleString('id-ID')}\n` +
                            `Sisa waktu: ${remaining.text}\n\n` +
                            `Anda belum mengirim bukti transfer.\n` +
                            `Silakan segera transfer dan kirim bukti pembayaran.\n\n` +
                            `Request akan otomatis dibatalkan jika tidak ada pembayaran dalam 24 jam.`;
                        
                        global.raf.sendMessage(request.userId, { text: message })
                            .then(() => {
                                request.reminder_sent = true;
                                saldoManager.saveTopupRequests();
                                logger.info(`Reminder sent for topup request ${request.id}`);
                            })
                            .catch(err => logger.error('Failed to send topup reminder', err));
                    }
                }
            }
        });
        
    } catch (error) {
        logger.error('Error sending topup reminders:', error);
    }
}

/**
 * Initialize topup expiry checker
 * Runs every hour to check expired requests
 */
function initTopupExpiryChecker() {
    // Check immediately on startup
    checkExpiredTopupRequests();
    
    // Check every hour
    setInterval(() => {
        checkExpiredTopupRequests();
        sendTopupReminders();
    }, 60 * 60 * 1000); // 1 hour
    
    logger.info('Topup expiry checker initialized');
}

module.exports = {
    checkExpiredTopupRequests,
    getRemainingTime,
    sendTopupReminders,
    initTopupExpiryChecker
};
