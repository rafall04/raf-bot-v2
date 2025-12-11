/**
 * State Manager
 * Prevents concurrent processing of messages from same sender
 */

const stateLocks = new Map();
const LOCK_TIMEOUT = 10000; // 10 seconds max processing time
const DEBUG = false; // Set to true for debugging

/**
 * Check if a sender is currently being processed
 * @param {string} sender - Sender ID to check
 * @returns {boolean} True if currently processing
 */
function isProcessing(sender) {
    if (!sender) return false;
    
    const lock = stateLocks.get(sender);
    if (!lock) return false;
    
    // Check if lock expired
    if (Date.now() - lock.timestamp > LOCK_TIMEOUT) {
        if (DEBUG) {
            console.log(`[STATE_MANAGER] Lock expired for ${sender}, clearing`);
        }
        stateLocks.delete(sender);
        return false;
    }
    
    if (DEBUG) {
        console.log(`[STATE_MANAGER] ${sender} is already being processed`);
    }
    return true;
}

/**
 * Set processing lock for a sender
 * @param {string} sender - Sender ID to lock
 * @returns {boolean} True if lock acquired, false if already locked
 */
function setProcessing(sender) {
    if (!sender) return false;
    
    if (isProcessing(sender)) {
        return false; // Already processing
    }
    
    stateLocks.set(sender, {
        timestamp: Date.now(),
        count: (stateLocks.get(sender)?.count || 0) + 1
    });
    
    if (DEBUG) {
        console.log(`[STATE_MANAGER] Lock acquired for ${sender}`);
    }
    
    // Auto cleanup after timeout
    setTimeout(() => {
        if (stateLocks.has(sender)) {
            const lock = stateLocks.get(sender);
            if (Date.now() - lock.timestamp >= LOCK_TIMEOUT) {
                if (DEBUG) {
                    console.log(`[STATE_MANAGER] Auto-clearing expired lock for ${sender}`);
                }
                stateLocks.delete(sender);
            }
        }
    }, LOCK_TIMEOUT + 1000);
    
    return true;
}

/**
 * Clear processing lock for a sender
 * @param {string} sender - Sender ID to unlock
 */
function clearProcessing(sender) {
    if (!sender) return;
    
    if (stateLocks.has(sender)) {
        if (DEBUG) {
            const lock = stateLocks.get(sender);
            const duration = Date.now() - lock.timestamp;
            console.log(`[STATE_MANAGER] Lock cleared for ${sender} after ${duration}ms`);
        }
        stateLocks.delete(sender);
    }
}

/**
 * Clear all locks (for cleanup)
 */
function clearAll() {
    const size = stateLocks.size;
    stateLocks.clear();
    if (DEBUG) {
        console.log(`[STATE_MANAGER] Cleared ${size} locks`);
    }
}

/**
 * Get statistics about current locks
 * @returns {object} Statistics
 */
function getStats() {
    const now = Date.now();
    const stats = {
        totalLocks: stateLocks.size,
        activeLocks: [],
        expiredLocks: []
    };
    
    stateLocks.forEach((lock, sender) => {
        const age = now - lock.timestamp;
        const lockInfo = {
            sender: sender.substring(0, 10) + '...', // Privacy
            age,
            count: lock.count
        };
        
        if (age > LOCK_TIMEOUT) {
            stats.expiredLocks.push(lockInfo);
        } else {
            stats.activeLocks.push(lockInfo);
        }
    });
    
    return stats;
}

module.exports = {
    isProcessing,
    setProcessing,
    clearProcessing,
    clearAll,
    getStats,
    LOCK_TIMEOUT
};
