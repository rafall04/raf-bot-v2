/**
 * Photo Batch Upload Handler
 * Mengatasi close connection saat upload banyak foto
 */

const path = require('path');
const fs = require('fs');

// Store untuk batch uploads per user
const uploadBatches = new Map();

// Configuration
const BATCH_TIMEOUT = 3000; // 3 detik untuk collect semua foto
const MIN_DELAY_BETWEEN_RESPONSES = 1000; // 1 detik delay minimum
const MAX_PHOTOS_PER_BATCH = 10; // Maximum photos to process

/**
 * Process batch photo upload dengan smart acknowledgment
 */
async function handleBatchPhotoUpload({
    sender,
    buffer,
    msg,
    state,
    teknisiName,
    ticketId,
    reply,
    isFirstPhoto = false
}) {
    try {
        // Initialize batch for user if not exists
        if (!uploadBatches.has(sender)) {
            uploadBatches.set(sender, {
                photos: [],
                timer: null,
                isProcessing: false,
                ticketId: ticketId,
                state: state,
                replyFunc: reply,
                firstPhotoTime: Date.now()
            });
        }
        
        const batch = uploadBatches.get(sender);
        
        // Check if we're still within the same ticket
        if (batch.ticketId !== ticketId) {
            // Different ticket, process old batch first
            if (batch.photos.length > 0) {
                await processBatch(sender);
            }
            
            // Reset for new ticket
            uploadBatches.set(sender, {
                photos: [],
                timer: null,
                isProcessing: false,
                ticketId: ticketId,
                state: state,
                replyFunc: reply,
                firstPhotoTime: Date.now()
            });
            batch.photos = [];
        }
        
        // Generate filename
        const timestamp = Date.now();
        const fileName = `photo_${teknisiName}_${timestamp}.jpg`;
        
        // Add photo to batch
        batch.photos.push({
            buffer: buffer,
            fileName: fileName,
            timestamp: timestamp,
            size: buffer.length
        });
        
        // Update batch info
        batch.state = state;
        batch.replyFunc = reply;
        
        // Clear existing timer
        if (batch.timer) {
            clearTimeout(batch.timer);
        }
        
        // If this is the first photo, send immediate acknowledgment
        if (batch.photos.length === 1) {
            await reply(`📸 Menerima foto...\n\n_Silakan lanjut upload atau tunggu 3 detik untuk proses batch._`);
        }
        
        // Set new timer to process batch
        batch.timer = setTimeout(async () => {
            await processBatch(sender);
        }, BATCH_TIMEOUT);
        
        // If reached max photos, process immediately
        if (batch.photos.length >= MAX_PHOTOS_PER_BATCH) {
            clearTimeout(batch.timer);
            await processBatch(sender);
        }
        
        return {
            success: true,
            batched: true,
            count: batch.photos.length
        };
        
    } catch (error) {
        console.error('[BATCH_UPLOAD_ERROR]', error);
        return {
            success: false,
            message: '❌ Gagal memproses batch upload.'
        };
    }
}

/**
 * Process accumulated photos in batch
 */
async function processBatch(sender) {
    const batch = uploadBatches.get(sender);
    if (!batch || batch.photos.length === 0 || batch.isProcessing) {
        return;
    }
    
    batch.isProcessing = true;
    const { photos, ticketId, state, replyFunc } = batch;
    
    try {
        console.log(`[BATCH_PROCESS] Processing ${photos.length} photos for ${sender}`);
        
        // Create upload directory
        const date = new Date();
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const uploadDir = path.join(__dirname, '../../uploads/tickets', String(year), month, ticketId);
        
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        
        // Process all photos
        const successfulUploads = [];
        const failedUploads = [];
        
        for (const photo of photos) {
            try {
                const filePath = path.join(uploadDir, photo.fileName);
                fs.writeFileSync(filePath, photo.buffer);
                
                successfulUploads.push({
                    fileName: photo.fileName,
                    path: filePath,
                    uploadedAt: new Date(photo.timestamp).toISOString(),
                    uploadedBy: state.uploadedBy || 'teknisi',
                    size: photo.size,
                    verified: state.otpVerifiedAt ? true : false
                });
                
            } catch (err) {
                console.error(`[BATCH_UPLOAD] Failed to save ${photo.fileName}:`, err);
                failedUploads.push(photo.fileName);
            }
        }
        
        // Update state with all uploaded photos
        state.uploadedPhotos = state.uploadedPhotos || [];
        state.uploadedPhotos.push(...successfulUploads);
        
        // Save state
        const { setUserState } = require('./conversation-handler');
        setUserState(sender, state);
        
        // Prepare response message
        const totalPhotos = state.uploadedPhotos.length;
        const minPhotos = state.otpVerifiedAt ? 2 : 1;
        const isComplete = totalPhotos >= minPhotos;
        
        let message = `✅ *BATCH UPLOAD SELESAI*\n\n`;
        message += `📸 Berhasil upload: ${successfulUploads.length} foto\n`;
        
        if (failedUploads.length > 0) {
            message += `❌ Gagal: ${failedUploads.length} foto\n`;
        }
        
        message += `📊 Total dokumentasi: ${totalPhotos} foto\n`;
        message += `✅ Status: ${isComplete ? 'Cukup' : `Perlu ${minPhotos - totalPhotos} foto lagi`}\n\n`;
        
        if (isComplete) {
            message += `✨ *Dokumentasi lengkap!*\n\n`;
            message += `Ketik *done* atau *lanjut* untuk melanjutkan ke tahap berikutnya.\n`;
        } else {
            message += `⚠️ *Minimal ${minPhotos} foto diperlukan*\n\n`;
            message += `Silakan upload ${minPhotos - totalPhotos} foto lagi atau ketik *skip* jika tidak bisa.`;
        }
        
        // Add processing time info
        const processingTime = Date.now() - batch.firstPhotoTime;
        message += `\n\n⏱️ _Proses: ${(processingTime / 1000).toFixed(1)} detik_`;
        
        // Send single response for all photos
        await replyFunc(message);
        
        // Clear batch
        uploadBatches.delete(sender);
        
        console.log(`[BATCH_PROCESS] Completed: ${successfulUploads.length} success, ${failedUploads.length} failed`);
        
    } catch (error) {
        console.error('[BATCH_PROCESS_ERROR]', error);
        
        try {
            await replyFunc('❌ Terjadi kesalahan saat memproses batch foto. Silakan coba lagi.');
        } catch (e) {
            console.error('[BATCH_REPLY_ERROR]', e);
        }
        
        // Clear batch on error
        uploadBatches.delete(sender);
    }
}

/**
 * Check if user has pending batch
 */
function hasPendingBatch(sender) {
    return uploadBatches.has(sender) && uploadBatches.get(sender).photos.length > 0;
}

/**
 * Force process any pending batch (for cleanup)
 */
async function forceProcessBatch(sender) {
    if (hasPendingBatch(sender)) {
        const batch = uploadBatches.get(sender);
        if (batch.timer) {
            clearTimeout(batch.timer);
        }
        await processBatch(sender);
    }
}

/**
 * Clear batch without processing (for cancellation)
 */
function clearBatch(sender) {
    const batch = uploadBatches.get(sender);
    if (batch && batch.timer) {
        clearTimeout(batch.timer);
    }
    uploadBatches.delete(sender);
}

/**
 * Get batch status
 */
function getBatchStatus(sender) {
    const batch = uploadBatches.get(sender);
    if (!batch) return null;
    
    return {
        count: batch.photos.length,
        ticketId: batch.ticketId,
        isProcessing: batch.isProcessing,
        timeElapsed: Date.now() - batch.firstPhotoTime
    };
}

module.exports = {
    handleBatchPhotoUpload,
    hasPendingBatch,
    forceProcessBatch,
    clearBatch,
    getBatchStatus,
    processBatch
};
