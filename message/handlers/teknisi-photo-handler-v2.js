/**
 * Teknisi Photo Upload Handler V2 with Better Concurrency Control
 * Fixes race conditions and ensures all photos are properly saved
 */

const fs = require('fs');
const path = require('path');

// Photo upload manager with better concurrency control
class PhotoUploadManager {
    constructor() {
        this.sessions = new Map();
        this.locks = new Map();
    }
    
    /**
     * Get or create session for a sender
     */
    getSession(sender) {
        if (!this.sessions.has(sender)) {
            this.sessions.set(sender, {
                uploadedPhotos: [],
                pendingPhotos: [],
                processingCount: 0,
                responseTimeout: null,
                lastActivity: Date.now(),
                batchStartTime: null,
                totalReceived: 0
            });
        }
        return this.sessions.get(sender);
    }
    
    /**
     * Acquire lock for sender (async mutex pattern)
     */
    async acquireLock(sender) {
        while (this.locks.get(sender)) {
            await new Promise(resolve => setTimeout(resolve, 10));
        }
        this.locks.set(sender, true);
    }
    
    /**
     * Release lock for sender
     */
    releaseLock(sender) {
        this.locks.delete(sender);
    }
    
    /**
     * Add photo to session with proper locking
     */
    async addPhoto(sender, fileName, buffer) {
        await this.acquireLock(sender);
        try {
            const session = this.getSession(sender);
            
            // Track total received
            session.totalReceived++;
            
            // Add to pending queue
            session.pendingPhotos.push({
                fileName,
                buffer,
                timestamp: Date.now()
            });
            
            // Set batch start time on first photo
            if (session.totalReceived === 1) {
                session.batchStartTime = Date.now();
            }
            
            session.lastActivity = Date.now();
            
            console.log(`[PHOTO_MGR] Photo added: #${session.totalReceived}, Pending: ${session.pendingPhotos.length}, Uploaded: ${session.uploadedPhotos.length}`);
            
            return session;
        } finally {
            this.releaseLock(sender);
        }
    }
    
    /**
     * Process pending photos with proper locking
     */
    async processPendingPhotos(sender) {
        await this.acquireLock(sender);
        try {
            const session = this.getSession(sender);
            
            // Move all pending to uploaded
            while (session.pendingPhotos.length > 0) {
                const photo = session.pendingPhotos.shift();
                session.uploadedPhotos.push(photo.fileName);
                
                // Update teknisi state
                if (global.teknisiStates && global.teknisiStates[sender]) {
                    const state = global.teknisiStates[sender];
                    if (!state.uploadedPhotos) {
                        state.uploadedPhotos = [];
                    }
                    state.uploadedPhotos = [...session.uploadedPhotos];
                }
                
                console.log(`[PHOTO_MGR] Processed photo ${session.uploadedPhotos.length}`);
            }
            
            return session.uploadedPhotos.length;
        } finally {
            this.releaseLock(sender);
        }
    }
    
    /**
     * Clear session
     */
    clearSession(sender) {
        if (this.sessions.has(sender)) {
            const session = this.sessions.get(sender);
            if (session.responseTimeout) {
                clearTimeout(session.responseTimeout);
            }
            this.sessions.delete(sender);
            this.locks.delete(sender);
            console.log(`[PHOTO_MGR] Session cleared for ${sender}`);
        }
    }
    
    /**
     * Cleanup old sessions
     */
    cleanupOldSessions() {
        const now = Date.now();
        const timeout = 30 * 60 * 1000; // 30 minutes
        
        for (const [sender, session] of this.sessions.entries()) {
            if (now - session.lastActivity > timeout) {
                this.clearSession(sender);
            }
        }
    }
}

// Single instance of manager
const photoManager = new PhotoUploadManager();

/**
 * Get response message based on photo count
 */
function getResponseMessage(photoCount) {
    if (photoCount < 2) {
        return `✅ Foto ${photoCount} berhasil diterima!

📌 *STATUS UPLOAD:*
• Foto terupload: ${photoCount}/2 (minimum)
• Status: Perlu ${2 - photoCount} foto lagi

📌 *NEXT STEP:*
➡️ Kirim foto ke-${photoCount + 1}
   (minimal 2 foto dokumentasi)

💡 Tips: Ambil foto yang jelas menunjukkan:
• Kondisi perangkat/kabel
• Proses perbaikan yang dilakukan`;
        
    } else if (photoCount >= 2 && photoCount < 5) {
        return `✅ *${photoCount} FOTO DOKUMENTASI DITERIMA!*

📌 *STATUS:*
• Foto terupload: ${photoCount} ✅
• Minimum terpenuhi (2 foto)
• Siap lanjut ke tahap berikutnya

📌 *NEXT STEP:*
➡️ Ketik salah satu:
   • *done*
   • *lanjut* 
   • *next*

   Untuk melanjutkan ke pengisian catatan resolusi

💡 Atau kirim foto tambahan jika diperlukan (maks 5)`;
        
    } else {
        return `✅ *MAKSIMAL FOTO TERCAPAI (5)*

📌 *STATUS:*
• Total foto: ${photoCount} ✅
• Dokumentasi lengkap

📌 *LANJUT KE TAHAP BERIKUTNYA:*
➡️ Ketik salah satu:
   • *done*
   • *lanjut*
   • *next*

Untuk melanjutkan ke pengisian catatan perbaikan`;
    }
}

/**
 * Handle teknisi photo upload with improved concurrency
 */
async function handleTeknisiPhotoUpload(sender, fileName, buffer, reply) {
    try {
        // Check if teknisi is in correct state
        const state = global.teknisiStates && global.teknisiStates[sender];
        
        if (!state || state.step !== 'AWAITING_COMPLETION_PHOTOS') {
            return {
                success: false,
                message: null // Not in photo upload state
            };
        }
        
        // Add photo to session
        const session = await photoManager.addPhoto(sender, fileName, buffer);
        
        // Clear any existing response timeout
        if (session.responseTimeout) {
            clearTimeout(session.responseTimeout);
            session.responseTimeout = null;
        }
        
        // Determine batch timing
        const timeSinceBatchStart = Date.now() - session.batchStartTime;
        const isWithinBatchWindow = timeSinceBatchStart < 3000; // 3 second batch window
        
        // Set a response timeout
        return new Promise((resolve) => {
            // Set batch response timeout
            session.responseTimeout = setTimeout(async () => {
                try {
                    // Process all pending photos
                    const photoCount = await photoManager.processPendingPhotos(sender);
                    
                    console.log(`[PHOTO_BATCH] Batch complete. Total: ${photoCount} photos`);
                    
                    // Generate and send response
                    const message = getResponseMessage(photoCount);
                    
                    if (reply && message) {
                        await reply(message).catch(err => {
                            console.error('[PHOTO_REPLY_ERROR]', err);
                        });
                    }
                    
                    resolve({
                        success: true,
                        photoCount: photoCount,
                        message: null // Already sent via reply
                    });
                    
                } catch (error) {
                    console.error('[PHOTO_BATCH_ERROR]', error);
                    resolve({
                        success: false,
                        message: '❌ Error processing photos'
                    });
                }
            }, isWithinBatchWindow ? 1500 : 500); // Shorter wait if outside batch window
        });
        
    } catch (error) {
        console.error('[TEKNISI_PHOTO_ERROR]', error);
        return {
            success: false,
            message: '❌ Gagal menyimpan foto. Coba lagi.'
        };
    }
}

/**
 * Get photo upload status
 */
function getPhotoUploadStatus(sender) {
    const session = photoManager.sessions.get(sender);
    if (!session) {
        return {
            uploadedCount: 0,
            pendingCount: 0,
            totalReceived: 0
        };
    }
    
    return {
        uploadedCount: session.uploadedPhotos.length,
        pendingCount: session.pendingPhotos.length,
        totalReceived: session.totalReceived
    };
}

/**
 * Clear upload session
 */
function clearUploadQueue(sender) {
    photoManager.clearSession(sender);
}

/**
 * Get upload queue for compatibility
 */
function getUploadQueue(sender) {
    const session = photoManager.getSession(sender);
    return {
        uploadedPhotos: session.uploadedPhotos,
        queue: session.pendingPhotos,
        processing: false
    };
}

// Run cleanup every 10 minutes
setInterval(() => {
    photoManager.cleanupOldSessions();
}, 10 * 60 * 1000);

module.exports = {
    handleTeknisiPhotoUpload,
    getPhotoUploadStatus,
    clearUploadQueue,
    getUploadQueue
};
