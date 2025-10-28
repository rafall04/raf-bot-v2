/**
 * Speed Boost Cleanup Utility
 * Auto cleanup expired and old pending speed boost requests
 */

const fs = require('fs');
const path = require('path');

/**
 * Clean up expired and old speed boost requests
 */
function cleanupSpeedBoostRequests() {
    try {
        const speedRequestsPath = path.join(__dirname, '..', 'database', 'speed_requests.json');
        
        if (!fs.existsSync(speedRequestsPath)) {
            console.log('[SPEED_BOOST_CLEANUP] No speed_requests.json found');
            return;
        }
        
        const speedRequests = JSON.parse(fs.readFileSync(speedRequestsPath, 'utf8'));
        const now = new Date();
        let cleanedCount = 0;
        
        speedRequests.forEach(request => {
            // Clean expired active requests
            if (request.status === 'active' && request.expirationDate) {
                const expDate = new Date(request.expirationDate);
                if (expDate <= now) {
                    request.status = 'expired';
                    request.expiredAt = now.toISOString();
                    cleanedCount++;
                    console.log(`[SPEED_BOOST_CLEANUP] Marked request ${request.id} as expired`);
                }
            }
            
            // Clean old pending requests (older than 7 days)
            if (request.status === 'pending' && request.createdAt) {
                const createdDate = new Date(request.createdAt);
                const daysSinceCreated = (now - createdDate) / (1000 * 60 * 60 * 24);
                
                if (daysSinceCreated > 7) {
                    request.status = 'cancelled_auto';
                    request.cancelledAt = now.toISOString();
                    request.cancelReason = 'Expired after 7 days';
                    cleanedCount++;
                    console.log(`[SPEED_BOOST_CLEANUP] Cancelled old pending request ${request.id}`);
                }
            }
            
            // Clean reverted requests that are still marked as active
            if (request.status === 'reverted' && request.revertedAt) {
                // Already reverted, ensure it's not counted as active
                const revertedDate = new Date(request.revertedAt);
                const hoursSinceReverted = (now - revertedDate) / (1000 * 60 * 60);
                
                // If reverted more than 1 hour ago but still causing issues
                if (hoursSinceReverted > 1) {
                    request.status = 'completed';
                    request.completedAt = request.revertedAt;
                    cleanedCount++;
                    console.log(`[SPEED_BOOST_CLEANUP] Marked reverted request ${request.id} as completed`);
                }
            }
        });
        
        if (cleanedCount > 0) {
            // Save cleaned data
            fs.writeFileSync(speedRequestsPath, JSON.stringify(speedRequests, null, 2));
            console.log(`[SPEED_BOOST_CLEANUP] Cleaned ${cleanedCount} speed boost requests`);
            
            // Update global if exists
            if (global.speed_requests) {
                global.speed_requests = speedRequests;
            }
        } else {
            console.log('[SPEED_BOOST_CLEANUP] No speed boost requests need cleaning');
        }
        
        return cleanedCount;
    } catch (error) {
        console.error('[SPEED_BOOST_CLEANUP_ERROR]', error);
        return 0;
    }
}

/**
 * Schedule periodic cleanup (every hour)
 */
function scheduleSpeedBoostCleanup() {
    // Run immediately on start
    cleanupSpeedBoostRequests();
    
    // Then run every hour
    setInterval(() => {
        console.log('[SPEED_BOOST_CLEANUP] Running scheduled cleanup...');
        cleanupSpeedBoostRequests();
    }, 60 * 60 * 1000); // Every hour
}

module.exports = {
    cleanupSpeedBoostRequests,
    scheduleSpeedBoostCleanup
};
