/**
 * Better Photo Upload Workflow Handler
 * Provides clear instructions and smart guidance
 */

const { setUserState, getUserState } = require('./conversation-handler');

// Photo tracking per user
const photoTracking = new Map();

/**
 * Initialize photo workflow tracking
 */
function initPhotoTracking(sender, ticketId, minPhotos = 2) {
    photoTracking.set(sender, {
        ticketId: ticketId,
        uploadedCount: 0,
        minPhotos: minPhotos,
        lastUploadTime: Date.now(),
        hasShownInstructions: false,
        pendingBatch: false
    });
}

/**
 * Get smart response based on photo count
 */
function getPhotoResponse(uploadedCount, minPhotos, isFirstPhoto = false) {
    const remaining = Math.max(0, minPhotos - uploadedCount);
    
    if (isFirstPhoto) {
        return `📸 *FOTO PERTAMA DITERIMA!*

✅ Foto 1 berhasil diupload

📊 *Status Dokumentasi:*
• Sudah upload: ${uploadedCount} foto
• Minimal perlu: ${minPhotos} foto
• Kurang: ${remaining} foto

🎯 *PILIHAN ANDA:*

1️⃣ *Upload foto lagi* 
   _Kirim ${remaining} foto atau lebih_

2️⃣ *Selesai upload*
   Ketik: *done* atau *lanjut*

3️⃣ *Skip foto*
   Ketik: *skip* (jika tidak bisa foto)

💡 *Tips:* Upload semua foto sekaligus lebih efisien!`;
    }
    
    if (uploadedCount >= minPhotos) {
        return `✅ *DOKUMENTASI LENGKAP!*

📸 Total: ${uploadedCount} foto
✨ Sudah melebihi minimal (${minPhotos} foto)

━━━━━━━━━━━━━━━━━━━━━━

🎯 *WAJIB! LANGKAH SELANJUTNYA:*

Ketik *done* atau *lanjut* untuk:
→ Menulis catatan perbaikan
→ Menyelesaikan tiket

⚠️ *PENTING:* 
Jangan lupa ketik *done* untuk lanjut!

_Atau upload foto tambahan jika perlu_`;
    }
    
    return `📸 *BATCH UPLOAD SELESAI*

📊 *Status Dokumentasi:*
• Sudah upload: ${uploadedCount} foto
• Minimal perlu: ${minPhotos} foto
• Kurang: ${remaining} foto

🎯 *PILIHAN:*
${remaining > 0 ? `• Upload ${remaining} foto lagi` : '• ✅ Dokumentasi cukup!'}
• Ketik *done* untuk lanjut
• Ketik *skip* jika tidak bisa foto

⚠️ Ketik *done* jika sudah selesai upload`;
}

/**
 * Handle photo upload completion
 */
async function handlePhotoUploadComplete({
    sender,
    successCount,
    failedCount,
    totalPhotos,
    minPhotos,
    reply
}) {
    try {
        const isComplete = totalPhotos >= minPhotos;
        const remaining = Math.max(0, minPhotos - totalPhotos);
        
        let message = `✅ *UPLOAD BATCH SELESAI*\n\n`;
        message += `📸 Berhasil: ${successCount} foto\n`;
        
        if (failedCount > 0) {
            message += `❌ Gagal: ${failedCount} foto\n`;
        }
        
        message += `📊 Total dokumentasi: ${totalPhotos} foto\n`;
        message += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;
        
        if (isComplete) {
            message += `✨ *DOKUMENTASI LENGKAP!*\n\n`;
            message += `🎯 *LANGKAH WAJIB SELANJUTNYA:*\n\n`;
            message += `Ketik salah satu:\n`;
            message += `• *done* - Lanjut tulis catatan\n`;
            message += `• *lanjut* - Sama dengan done\n`;
            message += `• *next* - Sama dengan done\n\n`;
            message += `⚠️ *PENTING:*\n`;
            message += `HARUS ketik *done* untuk lanjut!\n`;
            message += `Jangan lupa langkah ini!\n\n`;
            message += `_Atau upload foto tambahan jika perlu_`;
        } else {
            message += `⚠️ *DOKUMENTASI BELUM LENGKAP*\n\n`;
            message += `📊 Status:\n`;
            message += `• Minimal perlu: ${minPhotos} foto\n`;
            message += `• Anda punya: ${totalPhotos} foto\n`;
            message += `• Kurang: ${remaining} foto\n\n`;
            message += `🎯 *PILIHAN ANDA:*\n\n`;
            message += `1️⃣ Upload ${remaining} foto lagi\n`;
            message += `2️⃣ Ketik *skip* jika tidak bisa foto\n`;
            message += `3️⃣ Ketik *done* jika merasa cukup\n\n`;
            message += `_Rekomendasi: Upload minimal ${minPhotos} foto_`;
        }
        
        await reply(message);
        
        // Update tracking
        const tracking = photoTracking.get(sender);
        if (tracking) {
            tracking.uploadedCount = totalPhotos;
            tracking.lastUploadTime = Date.now();
            tracking.pendingBatch = false;
        }
        
        return { success: true };
        
    } catch (error) {
        console.error('[PHOTO_COMPLETE_ERROR]', error);
        return { 
            success: false, 
            message: '❌ Error processing photo completion' 
        };
    }
}

/**
 * Send reminder if user is idle after upload
 */
async function sendIdleReminder(sender, reply) {
    const tracking = photoTracking.get(sender);
    if (!tracking) return;
    
    const idleTime = Date.now() - tracking.lastUploadTime;
    
    // Send reminder after 30 seconds idle
    if (idleTime > 30000 && !tracking.hasShownReminder) {
        tracking.hasShownReminder = true;
        
        await reply(`💡 *REMINDER*

Upload foto sudah selesai?

Ketik *done* untuk lanjut ke tahap berikutnya
Atau upload foto tambahan jika perlu

_Jangan lupa ketik *done* ya!_`);
    }
}

/**
 * Clear tracking for user
 */
function clearPhotoTracking(sender) {
    photoTracking.delete(sender);
}

/**
 * Get tracking status
 */
function getPhotoTracking(sender) {
    return photoTracking.get(sender);
}

module.exports = {
    initPhotoTracking,
    getPhotoResponse,
    handlePhotoUploadComplete,
    sendIdleReminder,
    clearPhotoTracking,
    getPhotoTracking
};
