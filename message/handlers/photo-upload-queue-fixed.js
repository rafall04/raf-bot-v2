/**
 * Photo Upload Queue Manager - FIXED VERSION
 * Prevents close connection with smart rate limiting
 */

const path = require('path');
const fs = require('fs');

// Queue configuration
const CONFIG = {
    BATCH_COLLECT_TIME: 2000,      // 2 seconds to collect photos
    MIN_REPLY_INTERVAL: 1500,      // Minimum 1.5 sec between replies
    MAX_PHOTOS_PER_BATCH: 10,      // Max photos to process at once
    ACKNOWLEDGMENT_DELAY: 500,     // Delay before first acknowledgment
    QUEUE_PROCESS_DELAY: 1000,     // Delay between queue processing
    MAX_CONCURRENT_BATCHES: 3      // Max concurrent batch processing
};

// Global queue manager
class PhotoUploadQueue {
    constructor() {
        this.userQueues = new Map();
        this.lastReplyTime = new Map();
        this.processingCount = 0;
    }
    
    /**
     * Add photo to queue with smart batching
     */
    async addPhoto({
        sender,
        buffer,
        state,
        teknisiName,
        ticketId,
        reply
    }) {
        try {
            // Initialize queue for user if not exists
            if (!this.userQueues.has(sender)) {
                this.userQueues.set(sender, {
                    photos: [],
                    timer: null,
                    ticketId: ticketId,
                    state: state,
                    reply: reply,
                    teknisiName: teknisiName,
                    isProcessing: false,
                    acknowledged: false,
                    startTime: Date.now()
                });
            }
            
            const queue = this.userQueues.get(sender);
            
            // Check if different ticket
            if (queue.ticketId !== ticketId) {
                // Process old queue first
                if (queue.photos.length > 0) {
                    await this.processQueue(sender);
                }
                
                // Reset queue
                this.userQueues.set(sender, {
                    photos: [],
                    timer: null,
                    ticketId: ticketId,
                    state: state,
                    reply: reply,
                    teknisiName: teknisiName,
                    isProcessing: false,
                    acknowledged: false,
                    startTime: Date.now()
                });
                queue.photos = [];
            }
            
            // Generate filename
            const timestamp = Date.now();
            const fileName = `photo_${teknisiName}_${timestamp}.jpg`;
            
            // Add photo to queue
            queue.photos.push({
                buffer: buffer,
                fileName: fileName,
                timestamp: timestamp,
                size: buffer.length
            });
            
            // Update queue info
            queue.state = state;
            queue.reply = reply;
            
            // Smart acknowledgment - only once and with delay
            if (!queue.acknowledged && queue.photos.length === 1) {
                queue.acknowledged = true;
                
                // Check rate limit
                const canReply = await this.checkRateLimit(sender);
                
                if (canReply) {
                    // Delayed acknowledgment to prevent instant flood
                    setTimeout(async () => {
                        try {
                            const minPhotos = state.otpVerifiedAt ? 2 : 1;
                            const { getPhotoResponse } = require('./photo-workflow-handler');
                            const message = getPhotoResponse(1, minPhotos, true);
                            await reply(message);
                            this.updateLastReplyTime(sender);
                        } catch (err) {
                            console.error('[QUEUE_ACK_ERROR]', err);
                        }
                    }, CONFIG.ACKNOWLEDGMENT_DELAY);
                }
            }
            
            // Clear existing timer
            if (queue.timer) {
                clearTimeout(queue.timer);
            }
            
            // Set timer for batch processing
            queue.timer = setTimeout(async () => {
                await this.processQueue(sender);
            }, CONFIG.BATCH_COLLECT_TIME);
            
            // If reached max photos, schedule processing
            if (queue.photos.length >= CONFIG.MAX_PHOTOS_PER_BATCH) {
                clearTimeout(queue.timer);
                // Don't process immediately, schedule it
                queue.timer = setTimeout(async () => {
                    await this.processQueue(sender);
                }, CONFIG.QUEUE_PROCESS_DELAY);
            }
            
            return {
                success: true,
                queued: true,
                count: queue.photos.length,
                willProcess: queue.photos.length >= CONFIG.MAX_PHOTOS_PER_BATCH
            };
            
        } catch (error) {
            console.error('[QUEUE_ADD_ERROR]', error);
            return {
                success: false,
                message: 'Failed to queue photo'
            };
        }
    }
    
    /**
     * Process queued photos with rate limiting
     */
    async processQueue(sender) {
        const queue = this.userQueues.get(sender);
        if (!queue || queue.photos.length === 0 || queue.isProcessing) {
            return;
        }
        
        // Check concurrent processing limit
        if (this.processingCount >= CONFIG.MAX_CONCURRENT_BATCHES) {
            // Reschedule
            queue.timer = setTimeout(async () => {
                await this.processQueue(sender);
            }, CONFIG.QUEUE_PROCESS_DELAY);
            return;
        }
        
        queue.isProcessing = true;
        this.processingCount++;
        
        const { photos, ticketId, state, reply, teknisiName } = queue;
        
        try {
            console.log(`[QUEUE_PROCESS] Processing ${photos.length} photos for ${sender}`);
            
            // Create upload directory
            const date = new Date();
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const uploadDir = path.join(__dirname, '../../uploads/tickets', String(year), month, ticketId);
            
            if (!fs.existsSync(uploadDir)) {
                fs.mkdirSync(uploadDir, { recursive: true });
            }
            
            // Process photos with slight delay between saves
            const successfulUploads = [];
            const failedUploads = [];
            
            for (let i = 0; i < photos.length; i++) {
                const photo = photos[i];
                try {
                    const filePath = path.join(uploadDir, photo.fileName);
                    
                    // Add small delay between file writes to prevent I/O flooding
                    if (i > 0) {
                        await new Promise(resolve => setTimeout(resolve, 50));
                    }
                    
                    fs.writeFileSync(filePath, photo.buffer);
                    
                    successfulUploads.push({
                        fileName: photo.fileName,
                        path: filePath,
                        uploadedAt: new Date(photo.timestamp).toISOString(),
                        uploadedBy: teknisiName,
                        size: photo.size,
                        verified: state.otpVerifiedAt ? true : false
                    });
                    
                } catch (err) {
                    console.error(`[QUEUE_SAVE_ERROR] ${photo.fileName}:`, err);
                    failedUploads.push(photo.fileName);
                }
            }
            
            // Update state
            state.uploadedPhotos = state.uploadedPhotos || [];
            state.uploadedPhotos.push(...successfulUploads);
            
            // Save state
            const { setUserState } = require('./conversation-handler');
            setUserState(sender, state);
            
            // Check rate limit before reply
            const canReply = await this.checkRateLimit(sender);
            
            if (canReply) {
                // Use better workflow handler for response
                const { handlePhotoUploadComplete } = require('./photo-workflow-handler');
                
                const totalPhotos = state.uploadedPhotos.length;
                const minPhotos = state.otpVerifiedAt ? 2 : 1;
                
                // Send response with delay
                setTimeout(async () => {
                    try {
                        await handlePhotoUploadComplete({
                            sender,
                            successCount: successfulUploads.length,
                            failedCount: failedUploads.length,
                            totalPhotos: totalPhotos,
                            minPhotos: minPhotos,
                            reply
                        });
                        this.updateLastReplyTime(sender);
                    } catch (err) {
                        console.error('[QUEUE_REPLY_ERROR]', err);
                    }
                }, CONFIG.QUEUE_PROCESS_DELAY);
            }
            
            console.log(`[QUEUE_PROCESS] Completed: ${successfulUploads.length}/${photos.length} photos`);
            
        } catch (error) {
            console.error('[QUEUE_PROCESS_ERROR]', error);
            
            // Try to send error message with rate limit check
            const canReply = await this.checkRateLimit(sender);
            if (canReply) {
                try {
                    await reply('❌ Error memproses foto. Silakan coba lagi.');
                    this.updateLastReplyTime(sender);
                } catch (err) {
                    console.error('[QUEUE_ERROR_REPLY]', err);
                }
            }
        } finally {
            // Clear queue and reduce counter
            this.userQueues.delete(sender);
            this.processingCount--;
        }
    }
    
    /**
     * Check if we can reply (rate limiting)
     */
    async checkRateLimit(sender) {
        const lastReply = this.lastReplyTime.get(sender) || 0;
        const timeSinceLastReply = Date.now() - lastReply;
        
        // Allow reply if enough time has passed
        return timeSinceLastReply >= CONFIG.MIN_REPLY_INTERVAL;
    }
    
    /**
     * Update last reply time
     */
    updateLastReplyTime(sender) {
        this.lastReplyTime.set(sender, Date.now());
        
        // Clean old entries after 1 minute
        setTimeout(() => {
            const age = Date.now() - (this.lastReplyTime.get(sender) || 0);
            if (age > 60000) {
                this.lastReplyTime.delete(sender);
            }
        }, 60000);
    }
    
    /**
     * Get queue status
     */
    getQueueStatus(sender) {
        const queue = this.userQueues.get(sender);
        if (!queue) return null;
        
        return {
            photoCount: queue.photos.length,
            ticketId: queue.ticketId,
            isProcessing: queue.isProcessing,
            timeInQueue: Date.now() - queue.startTime
        };
    }
    
    /**
     * Force process queue
     */
    async forceProcess(sender) {
        const queue = this.userQueues.get(sender);
        if (queue && queue.timer) {
            clearTimeout(queue.timer);
        }
        await this.processQueue(sender);
    }
    
    /**
     * Clear queue
     */
    clearQueue(sender) {
        const queue = this.userQueues.get(sender);
        if (queue && queue.timer) {
            clearTimeout(queue.timer);
        }
        this.userQueues.delete(sender);
        this.lastReplyTime.delete(sender);
    }
}

// Singleton instance
const uploadQueue = new PhotoUploadQueue();

module.exports = {
    uploadQueue,
    addPhotoToQueue: (params) => uploadQueue.addPhoto(params),
    getQueueStatus: (sender) => uploadQueue.getQueueStatus(sender),
    forceProcessQueue: (sender) => uploadQueue.forceProcess(sender),
    clearUploadQueue: (sender) => uploadQueue.clearQueue(sender)
};
