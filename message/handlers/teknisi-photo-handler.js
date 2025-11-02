/**
 * Teknisi Photo Upload Handler with Concurrent Upload Support
 * Handles multiple photo uploads simultaneously without race conditions
 */

const fs = require('fs');
const path = require('path');

// Photo upload queue to handle concurrent uploads
const uploadQueues = new Map();

/**
 * Initialize or get upload queue for a sender
 */
function getUploadQueue(sender) {
    if (!uploadQueues.has(sender)) {
        uploadQueues.set(sender, {
            processing: false,
            queue: [],
            uploadedPhotos: [],
            lastActivity: Date.now()
        });
    }
    return uploadQueues.get(sender);
}

/**
 * Process queued photos for a sender
 */
async function processPhotoQueue(sender) {
    const queue = getUploadQueue(sender);
    
    // Wait if another process is handling
    if (queue.processing) {
        // Wait for current processing to finish
        await new Promise((resolve) => {
            const checkInterval = setInterval(() => {
                if (!queue.processing) {
                    clearInterval(checkInterval);
                    resolve();
                }
            }, 50);
            
            // Safety timeout
            setTimeout(() => {
                clearInterval(checkInterval);
                resolve();
            }, 5000);
        });
    }
    
    // Check again if there's something to process
    if (queue.queue.length === 0) {
        return;
    }
    
    queue.processing = true;
    
    try {
        while (queue.queue.length > 0) {
            const photoData = queue.queue.shift();
            
            // Add to uploaded photos
            queue.uploadedPhotos.push(photoData.fileName);
            
            // Update state
            if (global.teknisiStates && global.teknisiStates[sender]) {
                const state = global.teknisiStates[sender];
                if (!state.uploadedPhotos) {
                    state.uploadedPhotos = [];
                }
                
                // Sync with queue
                state.uploadedPhotos = [...queue.uploadedPhotos];
                
                console.log(`[PHOTO_QUEUE] Processed photo ${queue.uploadedPhotos.length} for ${sender}`);
            }
            
            queue.lastActivity = Date.now();
        }
    } finally {
        queue.processing = false;
    }
}

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
 * Handle teknisi photo upload with queue support
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
        
        // Get or create upload queue
        const queue = getUploadQueue(sender);
        
        // Add photo to queue
        queue.queue.push({
            fileName,
            buffer,
            timestamp: Date.now()
        });
        
        const totalQueued = queue.queue.length;
        const totalUploaded = queue.uploadedPhotos.length;
        console.log(`[PHOTO_QUEUE] Added photo. Queue: ${totalQueued}, Uploaded: ${totalUploaded}`);
        
        // Process the queue (will wait if already processing)
        const processPromise = processPhotoQueue(sender);
        
        // Determine response timing
        const photoCount = queue.uploadedPhotos.length;
        const pendingCount = queue.queue.length;
        
        // Clear existing response timeout if any
        if (queue.responseTimeout) {
            clearTimeout(queue.responseTimeout);
            queue.responseTimeout = null;
        }
        
        // Only send response for the last photo in a batch
        const isFirstPhoto = photoCount === 0 && pendingCount === 1;
        
        if (isFirstPhoto) {
            // This is the first photo, wait for more
            console.log('[PHOTO_QUEUE] First photo, waiting for batch...');
        } else if (queue.uploadedPhotos.length >= 5) {
            // Max photos reached, respond immediately after processing
            await processPromise;
            
            const message = getResponseMessage(queue.uploadedPhotos.length);
            if (reply && message) {
                reply(message).catch(err => {
                    console.error('[PHOTO_REPLY_ERROR]', err);
                });
            }
            
            return Promise.resolve({
                success: true,
                photoCount: queue.uploadedPhotos.length,
                message: null
            });
        }
        
        // Set timeout for batch response (wait 2 seconds for more photos)
        return new Promise((resolve, reject) => {
            // Add safety timeout to prevent hanging
            const safetyTimeout = setTimeout(() => {
                resolve({
                    success: true,
                    photoCount: queue.uploadedPhotos.length,
                    message: null
                });
            }, 10000); // 10 second safety timeout
            
            queue.responseTimeout = setTimeout(async () => {
                try {
                    clearTimeout(safetyTimeout);
                    
                    // Wait for any ongoing processing to complete
                    await processPromise;
                    
                    // Process any remaining photos that might have been added
                    await processPhotoQueue(sender);
                    
                    const finalCount = queue.uploadedPhotos.length;
                    console.log(`[PHOTO_QUEUE] Batch complete. Total photos: ${finalCount}`);
                    const message = getResponseMessage(finalCount);
                
                    // Send response only once for batch upload
                    if (reply && message) {
                        await reply(message).catch(err => {
                            console.error('[PHOTO_REPLY_ERROR]', err);
                        });
                    }
                    
                    resolve({
                        success: true,
                        photoCount: finalCount,
                        message: message || null
                    });
                    
                } catch (error) {
                    console.error('[PHOTO_BATCH_ERROR]', error);
                    reject(error);
                }
            }, 2000); // Wait 2 seconds for batch uploads
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
 * Get photo upload status for teknisi
 */
function getPhotoUploadStatus(sender) {
    const queue = uploadQueues.get(sender);
    if (!queue) {
        return {
            uploadedCount: 0,
            pendingCount: 0,
            isProcessing: false
        };
    }
    
    return {
        uploadedCount: queue.uploadedPhotos.length,
        pendingCount: queue.queue.length,
        isProcessing: queue.processing
    };
}

/**
 * Clear upload queue for a sender
 */
function clearUploadQueue(sender) {
    if (uploadQueues.has(sender)) {
        const queue = uploadQueues.get(sender);
        if (queue.responseTimeout) {
            clearTimeout(queue.responseTimeout);
        }
        uploadQueues.delete(sender);
        console.log(`[PHOTO_QUEUE] Cleared queue for ${sender}`);
    }
}

/**
 * Cleanup old queues (called periodically)
 */
function cleanupOldQueues() {
    const now = Date.now();
    const timeout = 30 * 60 * 1000; // 30 minutes
    
    for (const [sender, queue] of uploadQueues.entries()) {
        if (now - queue.lastActivity > timeout) {
            clearUploadQueue(sender);
        }
    }
}

// Run cleanup every 10 minutes
setInterval(cleanupOldQueues, 10 * 60 * 1000);

module.exports = {
    handleTeknisiPhotoUpload,
    getPhotoUploadStatus,
    clearUploadQueue,
    getUploadQueue
};
