/**
 * Customer Photo Upload Handler
 * Handle optional photo uploads from customers when reporting issues
 */

const fs = require('fs');
const path = require('path');
const { setUserState, getUserState, deleteUserState } = require('./conversation-handler');
const { getResponseTimeMessage } = require('../../lib/working-hours-helper');

/**
 * Handle photo upload state for customers
 */
async function handleCustomerPhotoUpload({ sender, state, chats, reply }) {
    const response = chats.toLowerCase().trim();
    
    // Check timeout (5 minutes)
    const elapsed = Date.now() - (state.startTime || Date.now());
    if (elapsed > 300000) { // 5 minutes
        // Timeout - save report without photos
        await saveReportAndNotify(state, reply);
        deleteUserState(sender);
        return {
            success: true,
            message: '⏱️ Timeout upload foto. Laporan tetap dibuat tanpa foto.\n\nTiket Anda telah dibuat. Teknisi akan segera menghubungi Anda.'
        };
    }
    
    // Handle skip
    if (response === 'skip' || response === 'lewati' || response === 'tidak') {
        await saveReportAndNotify(state, reply);
        deleteUserState(sender);
        
        // Get centralized response time
        const estimasiWaktu = getResponseTimeMessage('HIGH');
        
        return {
            success: true,
            message: `✅ *LAPORAN BERHASIL DIBUAT*

📋 ID Tiket: *${state.ticketData.ticketId}*
⚡ Prioritas: *HIGH - URGENT*
⏱️ Estimasi: ${estimasiWaktu}

Teknisi telah diberitahu dan akan segera menangani.

Anda akan menerima notifikasi saat teknisi dalam perjalanan.

_Terima kasih telah melaporkan gangguan ini._`
        };
    }
    
    // Handle continue/done
    if (response === 'lanjut' || response === 'done' || response === 'selesai') {
        const photoCount = state.uploadedPhotos ? state.uploadedPhotos.length : 0;
        
        if (photoCount === 0) {
            return {
                success: false,
                message: '⚠️ Belum ada foto yang diupload.\n\nSilakan upload foto atau ketik *skip* untuk lewati.'
            };
        }
        
        // Save report with photos
        await saveReportAndNotify(state, reply, true);
        deleteUserState(sender);
        
        // Get centralized response time
        const estimasiWaktu = getResponseTimeMessage('HIGH');
        
        return {
            success: true,
            message: `✅ *LAPORAN BERHASIL DIBUAT*

📋 ID Tiket: *${state.ticketData.ticketId}*
⚡ Prioritas: *HIGH - URGENT*
📸 Foto dilampirkan: ${photoCount} foto
⏱️ Estimasi: ${estimasiWaktu}

Teknisi telah menerima foto Anda dan akan:
• Analisis kondisi perangkat
• Siapkan spare part yang tepat
• Segera menuju lokasi

Anda akan menerima notifikasi saat teknisi dalam perjalanan.

_Terima kasih telah melaporkan dengan detail._`
        };
    }
    
    // Other responses - give guidance
    return {
        success: false,
        message: `📸 Silakan:
• Upload foto (kirim gambar)
• Ketik *lanjut* jika sudah selesai upload
• Ketik *skip* jika tidak ada foto

Foto tersisa: ${3 - (state.uploadedPhotos?.length || 0)} dari 3`
    };
}

/**
 * Save report and notify technicians
 */
async function saveReportAndNotify(state, reply, withPhotos = false) {
    const report = state.ticketData;
    
    // Add photo information if available (but NO BUFFERS!)
    if (withPhotos && state.uploadedPhotos && state.uploadedPhotos.length > 0) {
        // Clean photos - remove buffers before saving
        report.customerPhotos = state.uploadedPhotos.map(photo => ({
            fileName: photo.fileName,
            path: photo.path,
            uploadedAt: photo.uploadedAt,
            size: photo.size,
            uploadedBy: photo.uploadedBy
            // NO buffer field!
        }));
        report.hasCustomerPhotos = true;
        report.photoCount = state.uploadedPhotos.length;
    }
    
    // Save to global reports
    if (!global.reports) global.reports = [];
    global.reports.push(report);
    
    // Save to file
    try {
        const reportsPath = path.join(__dirname, '../../database/reports.json');
        fs.writeFileSync(reportsPath, JSON.stringify(global.reports, null, 2));
        console.log('[SAVE_REPORT] Report saved with ID:', report.ticketId);
    } catch (error) {
        console.error('[SAVE_REPORT_ERROR]', error);
    }
    
    // Format phone numbers for display
    let phoneDisplay = 'N/A';
    if (report.pelangganPhone) {
        const phones = report.pelangganPhone.split('|').map(p => p.trim()).filter(p => p);
        if (phones.length > 1) {
            phoneDisplay = phones.map((phone, idx) => `${idx + 1}. ${phone}`).join('\n');
        } else if (phones.length === 1) {
            phoneDisplay = phones[0];
        }
    }
    
    // Create notification message for technicians
    let notifMessage = `🚨 *TIKET PRIORITAS TINGGI*

ID: *${report.ticketId}*
Prioritas: *🔴 HIGH*

Pelanggan: ${report.pelangganName}
📞 Telepon:
${phoneDisplay}
Alamat: ${report.pelangganAddress || 'N/A'}
Paket: ${state.targetUser?.subscription || 'N/A'}

📋 *Masalah:* Internet mati total
⚠️ *Device Status:* OFFLINE ❌
🕐 *Terakhir Online:* ${state.deviceStatus?.minutesAgo || '30+'} menit lalu

✅ *Troubleshooting:* Sudah dilakukan pelanggan`;

    // Add photo information to notification
    if (withPhotos && state.uploadedPhotos && state.uploadedPhotos.length > 0) {
        notifMessage += `

📸 *FOTO DARI PELANGGAN TERSEDIA*
Jumlah: ${state.uploadedPhotos.length} foto
_Lihat foto untuk pre-diagnosis_`;
        
        // Send photos to teknisi (if implementation allows)
        // This would need additional implementation for sending media
    } else {
        notifMessage += `

📸 *Foto:* Tidak ada (pelanggan skip)`;
    }
    
    notifMessage += `

💡 *Kemungkinan Penyebab:*
• Fiber optik putus
• Listrik mati/modem tidak nyala
• Modem/ONT rusak
• Gangguan jaringan area

⚠️ *Action Required:*
Untuk ambil tiket, ketik:
*proses ${report.ticketId}*`;
    
    // Send to all teknisi
    const teknisiAccounts = global.accounts?.filter(acc => 
        acc.role === 'teknisi' && acc.phone_number && acc.phone_number.trim() !== ""
    ) || [];
    
    // PENTING: Cek connection state dan gunakan error handling sesuai rules untuk multiple recipients
    for (const teknisi of teknisiAccounts) {
        if (global.whatsappConnectionState === 'open' && global.raf && global.raf.sendMessage) {
            try {
                let teknisiJid = teknisi.phone_number.trim();
                if (!teknisiJid.endsWith('@s.whatsapp.net')) {
                    if (teknisiJid.startsWith('0')) {
                        teknisiJid = `62${teknisiJid.substring(1)}@s.whatsapp.net`;
                    } else if (teknisiJid.startsWith('62')) {
                        teknisiJid = `${teknisiJid}@s.whatsapp.net`;
                    } else {
                        teknisiJid = `62${teknisiJid}@s.whatsapp.net`;
                    }
                }
                
                // Send text notification
                await global.raf.sendMessage(teknisiJid, { text: notifMessage });
                
                // Send photos if available
                if (withPhotos && state.uploadedPhotos) {
                    // Use photoBuffers array if available, or read from disk
                    if (state.photoBuffers && state.photoBuffers.length > 0) {
                        // Use buffers from memory
                        for (let i = 0; i < state.uploadedPhotos.length; i++) {
                            const photo = state.uploadedPhotos[i];
                            const buffer = state.photoBuffers[i];
                            if (buffer && global.whatsappConnectionState === 'open' && global.raf && global.raf.sendMessage) {
                                try {
                                    await global.raf.sendMessage(teknisiJid, {
                                        image: buffer,
                                        caption: `📸 Foto dari pelanggan - ${report.pelangganName}\nTiket: ${report.ticketId}\nFoto ${i + 1} dari ${state.uploadedPhotos.length}`
                                    });
                                } catch (photoErr) {
                                    console.error('[SEND_MESSAGE_ERROR]', {
                                        teknisiJid,
                                        type: 'image',
                                        photoIndex: i + 1,
                                        error: photoErr.message
                                    });
                                    // Continue to next photo
                                }
                            }
                        }
                    } else {
                        // Read from disk as fallback
                        const fs = require('fs');
                        for (let i = 0; i < state.uploadedPhotos.length; i++) {
                            const photo = state.uploadedPhotos[i];
                            if (photo.path && fs.existsSync(photo.path) && global.whatsappConnectionState === 'open' && global.raf && global.raf.sendMessage) {
                                try {
                                    const buffer = fs.readFileSync(photo.path);
                                    await global.raf.sendMessage(teknisiJid, {
                                        image: buffer,
                                        caption: `📸 Foto dari pelanggan - ${report.pelangganName}\nTiket: ${report.ticketId}\nFoto ${i + 1} dari ${state.uploadedPhotos.length}`
                                    });
                                } catch (photoErr) {
                                    console.error('[SEND_MESSAGE_ERROR]', {
                                        teknisiJid,
                                        type: 'image',
                                        photoIndex: i + 1,
                                        error: photoErr.message
                                    });
                                    // Continue to next photo
                                }
                            }
                        }
                    }
                }
                
                console.log(`[REPORT] Notified teknisi: ${teknisi.username} (${teknisiJid})`);
            } catch (error) {
                console.error('[SEND_MESSAGE_ERROR]', {
                    teknisiJid: teknisi.phone_number,
                    error: error.message
                });
                console.error(`Failed to notify teknisi ${teknisi.username}:`, error);
                // Continue to next teknisi
            }
        } else {
            console.warn('[SEND_MESSAGE_SKIP] WhatsApp not connected, skipping send to teknisi', teknisi.username);
        }
    }
    
    // Also notify admins
    const adminAccounts = global.accounts?.filter(acc => 
        ['admin', 'owner', 'superadmin'].includes(acc.role) && 
        acc.phone_number && acc.phone_number.trim() !== ""
    ) || [];
    
    // PENTING: Cek connection state dan gunakan error handling sesuai rules untuk multiple recipients
    for (const admin of adminAccounts) {
        if (global.whatsappConnectionState === 'open' && global.raf && global.raf.sendMessage) {
            try {
                let adminJid = admin.phone_number.trim();
                if (!adminJid.endsWith('@s.whatsapp.net')) {
                    if (adminJid.startsWith('0')) {
                        adminJid = `62${adminJid.substring(1)}@s.whatsapp.net`;
                    } else if (adminJid.startsWith('62')) {
                        adminJid = `${adminJid}@s.whatsapp.net`;
                    } else {
                        adminJid = `62${adminJid}@s.whatsapp.net`;
                    }
                }
                await global.raf.sendMessage(adminJid, { text: notifMessage });
            } catch (error) {
                console.error('[SEND_MESSAGE_ERROR]', {
                    adminJid: admin.phone_number,
                    error: error.message
                });
                console.error(`Failed to notify admin ${admin.username}:`, error);
                // Continue to next admin
            }
        } else {
            console.warn('[SEND_MESSAGE_SKIP] WhatsApp not connected, skipping send to admin', admin.username);
        }
    }
}

module.exports = {
    handleCustomerPhotoUpload,
    saveReportAndNotify
};
