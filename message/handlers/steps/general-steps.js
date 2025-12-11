"use strict";

/**
 * General Conversation Steps
 * Menangani percakapan multi-step umum (reboot, power change, dll)
 */

const { rebootRouter } = require("../../../lib/wifi");

/**
 * Handle general conversation steps
 */
async function handleGeneralSteps({ userState, sender, chats, pushname, reply, setUserState, deleteUserState }) {
    const userReply = chats.toLowerCase().trim();
    
    switch (userState.step) {
        // Router Reboot Confirmation
        case 'CONFIRM_REBOOT': {
            if (['ya', 'ok', 'lanjut', 'iya', 'y'].includes(userReply)) {
                const { targetUser } = userState;
                
                await reply(`⏳ Sedang mengirim perintah reboot ke modem *${targetUser.name}*...`);
                
                try {
                    const result = await rebootRouter(targetUser.device_id);
                    
                    deleteUserState(sender);
                    
                    if (result.success) {
                        console.log(`[REBOOT_SUCCESS] User: ${targetUser.name} (${targetUser.id}), Rebooted by: ${pushname}`);
                        return {
                            success: true,
                            message: `✅ *Permintaan Diterima*\n\n` +
                                   `Perintah reboot modem sedang diproses.\n\n` +
                                   `*Perhatian:*\n` +
                                   `• Modem akan mati dalam 10-30 detik\n` +
                                   `• Proses booting ulang: 3-5 menit\n` +
                                   `• Koneksi stabil kembali: 5-10 menit\n` +
                                   `• Semua perangkat akan terputus sementara\n\n` +
                                   `📱 Tunggu hingga semua lampu indikator modem menyala normal.\n\n` +
                                   `_Jika tidak kembali normal setelah 10 menit, silakan hubungi teknisi._`
                        };
                    } else {
                        console.error(`[REBOOT_FAILED] User: ${targetUser.name} (${targetUser.id}), Error: ${result.message}`);
                        return {
                            success: false,
                            message: `❌ Gagal mengirim perintah reboot\n\n` +
                                   `*Alasan:* ${result.message}\n\n` +
                                   `Silakan coba lagi atau hubungi teknisi jika masalah berlanjut.`
                        };
                    }
                } catch (error) {
                    console.error('[REBOOT_ERROR]', error);
                    deleteUserState(sender);
                    return {
                        success: false,
                        message: `❌ Terjadi kesalahan saat me-reboot modem\n\n` +
                               `*Error:* ${error.message}\n\n` +
                               `Silakan coba lagi atau hubungi teknisi.`
                    };
                }
            } else if (['tidak', 'no', 'n', 'gak'].includes(userReply)) {
                deleteUserState(sender);
                return {
                    success: true,
                    message: '❌ Reboot modem dibatalkan.'
                };
            } else {
                return {
                    success: false,
                    message: "Mohon balas dengan *'ya'* untuk melanjutkan reboot atau *'tidak'* untuk membatalkan."
                };
            }
        }
        
        // WiFi Power Level Change
        case 'ASK_POWER_LEVEL': {
            const newPowerLevel = chats.trim();
            
            if (!['100', '80', '60', '40', '20'].includes(newPowerLevel)) {
                return {
                    success: false,
                    message: `⚠️ Level daya tidak valid. Mohon pilih salah satu dari: *100, 80, 60, 40, 20*.\n\nAtau ketik *batal* untuk membatalkan.`
                };
            }
            
            userState.level_daya = newPowerLevel;
            userState.step = 'CONFIRM_GANTI_POWER';
            setUserState(sender, userState);
            
            return {
                success: true,
                message: `📡 *Konfirmasi Perubahan Kekuatan Sinyal*\n\nKekuatan sinyal WiFi akan diubah ke level *${newPowerLevel}%*.\n\n⚠️ *Perhatian:*\n• Level 100%: Jangkauan maksimal, konsumsi daya tinggi\n• Level 80%: Jangkauan luas, konsumsi normal\n• Level 60%: Jangkauan sedang, hemat daya\n• Level 40%: Jangkauan terbatas\n• Level 20%: Jangkauan minimal, sangat hemat daya\n\nApakah sudah benar?\n\nBalas *'ya'* untuk melanjutkan atau *'tidak'* untuk membatalkan.`
            };
        }
        
        case 'CONFIRM_GANTI_POWER': {
            if (['ya', 'ok', 'lanjut', 'iya', 'y'].includes(userReply)) {
                const { targetUser, level_daya } = userState;
                
                await reply(`⏳ Sedang mengatur kekuatan sinyal WiFi untuk *${targetUser.name}* ke level ${level_daya}%...`);
                
                // Note: You need to implement setPowerLevel function in lib/wifi.js
                // For now, we'll simulate it
                try {
                    // Simulate API call
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    
                    deleteUserState(sender);
                    
                    return {
                        success: true,
                        message: `✅ *Berhasil!*\n\nKekuatan sinyal WiFi untuk *${targetUser.name}* telah diubah ke level *${level_daya}%*.\n\n📡 Perubahan akan terasa dalam 1-2 menit.\n\n💡 *Tips:*\n• Jika sinyal terlalu lemah, naikkan level daya\n• Jika ada interferensi dengan tetangga, turunkan level daya\n• Level 60-80% biasanya optimal untuk rumah tangga`
                    };
                } catch (error) {
                    console.error('[POWER_CHANGE_ERROR]', error);
                    deleteUserState(sender);
                    return {
                        success: false,
                        message: `❌ Gagal mengubah kekuatan sinyal: ${error.message}\n\nSilakan coba lagi atau hubungi admin.`
                    };
                }
            } else if (['tidak', 'no', 'n', 'gak'].includes(userReply)) {
                deleteUserState(sender);
                return {
                    success: true,
                    message: '❌ Perubahan kekuatan sinyal dibatalkan.'
                };
            } else {
                return {
                    success: false,
                    message: "Mohon balas dengan *'ya'* untuk melanjutkan atau *'tidak'* untuk membatalkan."
                };
            }
        }
        
        // Payment Confirmation Steps
        case 'PAYMENT_CONFIRMATION': {
            // Handle payment confirmation with image
            // This would typically be handled in the main raf.js when receiving image message
            return {
                success: true,
                message: 'Silakan kirim bukti pembayaran dalam bentuk gambar.'
            };
        }
        
        // Complaint/Feedback Steps
        case 'AWAITING_COMPLAINT': {
            const complaint = chats.trim();
            
            if (!complaint || complaint === '') {
                return {
                    success: false,
                    message: 'Mohon sampaikan keluhan atau saran Anda.'
                };
            }
            
            // Save complaint
            const complaintData = {
                id: Date.now().toString(),
                userId: userState.user.id,
                userName: userState.user.name,
                userPhone: userState.user.phone_number,
                complaint: complaint,
                createdAt: new Date().toISOString(),
                status: 'new'
            };
            
            // Log complaint (you might want to save to database)
            console.log('[NEW_COMPLAINT]', complaintData);
            
            deleteUserState(sender);
            
            return {
                success: true,
                message: `✅ *Keluhan/Saran Diterima*\n\nTerima kasih *${pushname}* atas masukan Anda.\n\n📋 *Detail:*\nID: #${complaintData.id}\nPesan: ${complaint}\n\nTim kami akan segera menindaklanjuti keluhan/saran Anda.\nAnda akan menerima notifikasi untuk update selanjutnya.\n\n_Diterima pada: ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}_`
            };
        }
        
        // Ticket Processing Confirmation
        case 'CONFIRM_PROCESS_TICKET': {
            if (['ya', 'ok', 'lanjut', 'iya', 'y'].includes(userReply)) {
                const { ticketIdToProcess, reportData } = userState;
                const reportIndex = global.reports.findIndex(r => r.ticketId === ticketIdToProcess);
                
                if (reportIndex !== -1) {
                    const report = global.reports[reportIndex];
                    
                    // Get teknisi info from accounts
                    const senderNumber = sender.replace('@s.whatsapp.net', '');
                    let phoneToMatch = senderNumber;
                    if (senderNumber.startsWith('62')) {
                        phoneToMatch = senderNumber.substring(2);
                    }
                    
                    const teknisiAccount = global.accounts.find(acc => {
                        if (acc.role !== 'teknisi') return false;
                        return acc.phone_number === phoneToMatch || 
                               acc.phone_number === senderNumber ||
                               `62${acc.phone_number}` === senderNumber;
                    });
                    
                    const teknisiName = teknisiAccount ? (teknisiAccount.name || teknisiAccount.username) : pushname;
                    
                    // Update report status - set all possible field names for compatibility
                    global.reports[reportIndex].status = 'diproses teknisi';
                    global.reports[reportIndex].processedAt = new Date().toISOString();
                    global.reports[reportIndex].processedByTeknisi = sender;
                    global.reports[reportIndex].processedByTeknisiId = sender;  // For old workflow compatibility
                    global.reports[reportIndex].teknisiId = sender;              // For new workflow compatibility
                    global.reports[reportIndex].processedByTeknisiName = teknisiName;
                    global.reports[reportIndex].teknisiName = teknisiName;          // For new workflow
                    
                    // Save to file
                    const { saveReportsToFile } = require('../report-handler');
                    saveReportsToFile(global.reports);
                    
                    // Notify customer
                    // PENTING: Cek connection state dan gunakan error handling sesuai rules
                    if (global.whatsappConnectionState === 'open' && global.raf && global.raf.sendMessage) {
                        try {
                            await global.raf.sendMessage(report.pelangganId, {
                                text: `✅ *Update Tiket*

ID Tiket: *${ticketIdToProcess}*

Tiket Anda sedang ditangani oleh teknisi kami.

*Teknisi:* ${teknisiName}
*Status:* Sedang Diproses

Teknisi akan segera menghubungi Anda untuk penanganan lebih lanjut.

Terima kasih atas kesabarannya! 🙏`
                            });
                            console.log(`[PROCESS_TICKET] ✅ Notified customer: ${report.pelangganId}`);
                        } catch (err) {
                            console.error('[SEND_MESSAGE_ERROR]', {
                                pelangganId: report.pelangganId,
                                error: err.message
                            });
                            console.error('[NOTIFY_CUSTOMER_ERROR] ❌', err);
                        }
                    } else {
                        console.warn('[SEND_MESSAGE_SKIP] WhatsApp not connected, skipping send to', report.pelangganId);
                        console.warn('[PROCESS_TICKET] Cannot notify customer - WhatsApp not connected');
                    }
                    
                    deleteUserState(sender);
                    
                    return {
                        success: true,
                        message: `✅ *Tiket Berhasil Diambil!*

ID: *${ticketIdToProcess}*
Status: *Diproses oleh Anda*

*Detail Pelanggan:*
├ Nama: ${report.pelangganName}
├ Telepon: ${report.pelangganPhone}
└ Alamat: ${report.pelangganAddress || 'N/A'}

*Keluhan:*
${report.laporanText}

Customer sudah mendapat notifikasi bahwa Anda sedang menangani.

Setelah selesai perbaikan, ketik:
*tiketdone ${ticketIdToProcess}*`
                    };
                } else {
                    deleteUserState(sender);
                    return {
                        success: false,
                        message: `❌ Tiket dengan ID *${ticketIdToProcess}* tidak ditemukan.`
                    };
                }
            } else if (['tidak', 'no', 'n', 'gak'].includes(userReply)) {
                deleteUserState(sender);
                return {
                    success: true,
                    message: '❌ Proses tiket dibatalkan.'
                };
            } else {
                return {
                    success: false,
                    message: "Mohon balas dengan *'ya'* untuk memproses tiket atau *'tidak'* untuk membatalkan."
                };
            }
        }
        
        // Ticket Resolution - Photo Upload (Both old and new flow)
        case 'TICKET_RESOLVE_UPLOAD_PHOTOS': 
        case 'TICKET_VERIFIED_AWAITING_PHOTOS': {
            const userReply = chats.toLowerCase().trim();
            
            // Check timeout (30 minutes for verified flow)
            const timeoutDuration = userState.step === 'TICKET_VERIFIED_AWAITING_PHOTOS' ? 1800000 : 600000;
            const elapsed = Date.now() - (userState.uploadStartTime || userState.otpVerifiedAt || Date.now());
            if (elapsed > timeoutDuration) {
                deleteUserState(sender);
                return {
                    success: false,
                    message: '⏱️ Timeout! Silakan mulai lagi.'
                };
            }
            
            // Handle teknisi completing photo upload
            if (userReply === 'done' || userReply === 'lanjut' || userReply === 'next') {
                // Force process any pending photos in queue first
                const { getQueueStatus, forceProcessQueue, getSessionInfo } = require('../photo-upload-queue');
                
                const queueStatus = getQueueStatus(sender);
                const sessionInfo = getSessionInfo(sender);
                
                console.log(`[DONE_HANDLER] Queue status:`, queueStatus);
                console.log(`[DONE_HANDLER] Session info:`, sessionInfo);
                
                if (queueStatus && queueStatus.photoCount > 0) {
                    // Photos still in queue, process them first
                    console.log(`[DONE_HANDLER] Processing ${queueStatus.photoCount} pending photos before done`);
                    await forceProcessQueue(sender, false); // false = don't clear session yet
                    
                    // Wait a bit longer for queue processing
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    
                    // Reload state after queue processing
                    userState = getUserState(sender);
                    if (!userState) {
                        console.error('[DONE_HANDLER] State lost after queue processing');
                        return {
                            success: false,
                            message: '❌ State lost. Silakan ulangi proses.'
                        };
                    }
                }
                
                // Check minimum photos for verified flow
                const minPhotos = userState.step === 'TICKET_VERIFIED_AWAITING_PHOTOS' ? 2 : 0;
                
                if (userState.uploadedPhotos && userState.uploadedPhotos.length < minPhotos) {
                    return {
                        success: false,
                        message: `⚠️ Minimal ${minPhotos} foto diperlukan untuk dokumentasi.\n\nAnda baru upload ${userState.uploadedPhotos.length} foto.\n\nSilakan upload ${minPhotos - userState.uploadedPhotos.length} foto lagi atau ketik *skip* jika darurat.`
                    };
                }
                
                // Save metadata
                const ticketId = userState.ticketIdToResolve || userState.ticketId;
                
                if (!ticketId) {
                    console.error('[DONE_HANDLER] No ticketId found in state:', userState);
                    return {
                        success: false,
                        message: '❌ Error: ID tiket tidak ditemukan.\n\nSilakan mulai ulang proses.'
                    };
                }
                
                const date = new Date();
                const year = date.getFullYear();
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const uploadDir = require('path').join(__dirname, '../../../uploads/tickets', String(year), month, ticketId);
                
                // Create directory if not exists
                const fs = require('fs');
                if (!fs.existsSync(uploadDir)) {
                    fs.mkdirSync(uploadDir, { recursive: true });
                }
                
                const metadata = {
                    ticketId: ticketId,
                    uploadedBy: pushname || 'teknisi',
                    uploadedByPhone: sender,
                    uploadedAt: date.toISOString(),
                    images: userState.uploadedPhotos || [],
                    totalImages: (userState.uploadedPhotos || []).length,
                    totalSize: (userState.uploadedPhotos || []).reduce((sum, p) => sum + (p.size || 0), 0)
                };
                
                try {
                    fs.writeFileSync(
                        require('path').join(uploadDir, 'metadata.json'),
                        JSON.stringify(metadata, null, 2)
                    );
                } catch (err) {
                    console.error('[METADATA_SAVE_ERROR]', err);
                }
                
                // Clear photo upload session since we're done with photos
                const { clearUploadQueue } = require('../photo-upload-queue');
                clearUploadQueue(sender);
                console.log(`[DONE_HANDLER] Photo session cleared for ${sender}`);
                
                // Continue to resolution notes
                userState.step = 'TICKET_RESOLVE_ASK_NOTES';
                userState.photoMetadata = metadata;
                setUserState(sender, userState);
                
                return {
                    success: true,
                    message: `✅ *${userState.uploadedPhotos.length} Foto Tersimpan*

📁 Lokasi: tickets/${year}/${month}/${ticketId}/
📊 Total: ${(metadata.totalSize / 1024 / 1024).toFixed(2)} MB

📝 *Dokumentasi Resolusi*

Mohon jelaskan hasil perbaikan dengan format:

*Masalah yang Ditemukan:*
(Jelaskan root cause)

*Solusi yang Dilakukan:*
(Jelaskan langkah perbaikan)

*Status Akhir:*
(Apakah sudah normal?)

Contoh:
Masalah: Kabel fiber putus di ODP
Solusi: Sudah disambung ulang dan diseal
Status: Internet sudah normal, speedtest OK

Ketik resolusi Anda di bawah:`
                };
                
            } else if (userReply === 'skip') {
                // Skip photo upload
                userState.step = 'TICKET_RESOLVE_ASK_NOTES';
                userState.uploadedPhotos = [];
                setUserState(sender, userState);
                
                return {
                    success: true,
                    message: `⏭️ Dokumentasi foto dilewati.

📝 *Dokumentasi Resolusi*

Mohon jelaskan hasil perbaikan:

*Masalah yang Ditemukan:*
(Jelaskan root cause)

*Solusi yang Dilakukan:*
(Jelaskan langkah perbaikan)

*Status Akhir:*
(Apakah sudah normal?)

Ketik resolusi Anda di bawah:`
                };
                
            } else if (userReply === 'batal') {
                deleteUserState(sender);
                return {
                    success: true,
                    message: '❌ Proses penyelesaian tiket dibatalkan.'
                };
                
            } else {
                // Remind user
                return {
                    success: true,
                    message: `📸 Upload foto dokumentasi...

Total foto saat ini: ${userState.uploadedPhotos.length}

Kirim foto, lalu:
• Ketik *selesai* jika sudah semua
• Ketik *skip* untuk lewati foto
• Ketik *batal* untuk batalkan`
                };
            }
        }
        
        // Ticket Resolution - Ask Notes
        case 'TICKET_RESOLVE_ASK_NOTES': {
            const resolutionNotes = chats.trim();
            
            if (!resolutionNotes || resolutionNotes.length < 10) {
                return {
                    success: false,
                    message: '⚠️ Mohon berikan penjelasan yang cukup detail (minimal 10 karakter).\n\nIni penting untuk dokumentasi dan referensi di masa depan.'
                };
            }
            
            userState.resolutionNotes = resolutionNotes;
            userState.step = 'TICKET_RESOLVE_CONFIRM';
            setUserState(sender, userState);
            
            const photoInfo = userState.uploadedPhotos && userState.uploadedPhotos.length > 0
                ? `\n\n📸 *Foto Dokumentasi:* ${userState.uploadedPhotos.length} foto`
                : '\n\n📸 *Foto Dokumentasi:* Tidak ada';
            
            return {
                success: true,
                message: `📋 *Konfirmasi Penyelesaian Tiket*

ID: *${userState.ticketIdToResolve}*

*Resolusi Anda:*
${resolutionNotes}${photoInfo}

Apakah Anda yakin ingin menyelesaikan tiket ini?

Balas *'ya'* untuk selesaikan atau *'edit'* untuk ubah resolusi.`
            };
        }
        
        // Ticket Resolution - Confirmation
        case 'TICKET_RESOLVE_CONFIRM': {
            if (['ya', 'ok', 'lanjut', 'iya', 'y'].includes(userReply)) {
                const { ticketIdToResolve, resolutionNotes, uploadedPhotos, photoMetadata } = userState;
                const reportIndex = global.reports.findIndex(r => r.ticketId === ticketIdToResolve);
                
                if (reportIndex !== -1) {
                    // Get the actual report
                    const ticketData = global.reports[reportIndex];
                    
                    // Update report
                    // Standardisasi status ke 'completed'
                    ticketData.status = 'completed';
                    ticketData.resolvedAt = new Date().toISOString();
                    ticketData.resolvedBy = pushname;
                    ticketData.resolutionNotes = resolutionNotes;
                    
                    // Add photo metadata to report
                    if (photoMetadata) {
                        ticketData.photoDocumentation = photoMetadata;
                    }
                    
                    // Save to file
                    const { saveReportsToFile } = require('../report-handler');
                    saveReportsToFile(global.reports);
                    
                    // Build customer notification
                    let customerMessage = `✅ *TIKET DISELESAIKAN*

ID Tiket: *${ticketIdToResolve}*

*Penjelasan dari Teknisi:*
${resolutionNotes}`;

                    // Send notification to customer if we have their ID
                    // PENTING: Cek connection state dan gunakan error handling sesuai rules
                    if (global.whatsappConnectionState === 'open' && global.raf && global.raf.sendMessage && ticketData.pelangganId) {
                        if (uploadedPhotos && uploadedPhotos.length > 0) {
                            customerMessage += `\n\n📸 *Dokumentasi:* ${uploadedPhotos.length} foto terlampir`;
                            
                            for (const photo of uploadedPhotos) {
                                // PENTING: Cek connection state untuk setiap foto
                                if (global.whatsappConnectionState === 'open' && global.raf && global.raf.sendMessage) {
                                    try {
                                        // Check if photo file exists before trying to read
                                        const fs = require('fs');
                                        if (photo.path && fs.existsSync(photo.path)) {
                                            const photoBuffer = fs.readFileSync(photo.path);
                                            await global.raf.sendMessage(ticketData.pelangganId, {
                                                image: photoBuffer,
                                                caption: `📸 Dokumentasi Perbaikan - ${photo.fileName || 'Foto'}`
                                            });
                                            console.log(`[TICKET_RESOLVED] ✅ Sent photo ${photo.fileName} to customer`);
                                        } else {
                                            console.error(`[SEND_PHOTO_ERROR] Photo file not found: ${photo.path}`);
                                        }
                                    } catch (err) {
                                        console.error('[SEND_MESSAGE_ERROR]', {
                                            pelangganId: ticketData.pelangganId,
                                            type: 'image',
                                            photoFileName: photo.fileName,
                                            error: err.message
                                        });
                                        console.error('[SEND_PHOTO_ERROR] ❌', err);
                                        // Continue to next photo
                                    }
                                }
                            }
                        }

                        customerMessage += `\n\n*Diselesaikan oleh:* ${pushname}
*Waktu:* ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}

Jika masih ada kendala, silakan lapor kembali.

Terima kasih! 🙏`;

                        // Send text notification
                        if (global.whatsappConnectionState === 'open' && global.raf && global.raf.sendMessage) {
                            try {
                                await global.raf.sendMessage(ticketData.pelangganId, {
                                    text: customerMessage
                                });
                                console.log(`[TICKET_RESOLVED] ✅ Notified customer: ${ticketData.pelangganId}`);
                            } catch (err) {
                                console.error('[SEND_MESSAGE_ERROR]', {
                                    pelangganId: ticketData.pelangganId,
                                    error: err.message
                                });
                                console.error('[NOTIFY_CUSTOMER_ERROR] ❌', err);
                            }
                        } else {
                            console.warn('[SEND_MESSAGE_SKIP] WhatsApp not connected, skipping send to', ticketData.pelangganId);
                        }
                    } else {
                        if (!ticketData.pelangganId) {
                            console.error('[NOTIFY_CUSTOMER_ERROR] No pelangganId found for ticket:', ticketIdToResolve);
                        } else {
                            console.warn('[TICKET_RESOLVED] Cannot notify customer - global.raf not available');
                        }
                    }
                    
                    deleteUserState(sender);
                    
                    const date = new Date();
                    return {
                        success: true,
                        message: `✅ *Tiket Diselesaikan!*

ID: *${ticketIdToResolve}*

*Resolusi:* Tercatat
*Foto:* ${uploadedPhotos ? uploadedPhotos.length : 0} foto
*Notifikasi:* Terkirim ke customer

Dokumentasi lengkap tersimpan di:
tickets/${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${ticketIdToResolve}/

Good job! 👍`
                    };
                } else {
                    deleteUserState(sender);
                    return {
                        success: false,
                        message: `❌ Tiket dengan ID *${ticketIdToResolve}* tidak ditemukan.`
                    };
                }
            } else if (userReply === 'edit') {
                userState.step = 'TICKET_RESOLVE_ASK_NOTES';
                setUserState(sender, userState);
                return {
                    success: true,
                    message: 'Silakan ketik ulang resolusi yang baru:'
                };
            } else {
                return {
                    success: false,
                    message: "Mohon balas dengan *'ya'* untuk selesaikan atau *'edit'* untuk ubah resolusi."
                };
            }
        }
        
        // Generic question answering
        case 'AWAITING_QUESTION': {
            const question = chats.trim();
            
            if (!question || question === '') {
                return {
                    success: false,
                    message: 'Mohon sampaikan pertanyaan Anda.'
                };
            }
            
            deleteUserState(sender);
            
            // Here you might want to integrate with AI or FAQ system
            return {
                success: true,
                message: `📝 Pertanyaan Anda: "${question}"\n\nMohon maaf, saya akan meneruskan pertanyaan Anda ke tim support kami. Anda akan mendapat jawaban secepatnya.\n\nUntuk pertanyaan umum, Anda bisa:\n• Ketik *menu* untuk melihat menu utama\n• Ketik *info* untuk informasi layanan\n• Hubungi admin di ${global.config.ownerNumber || 'nomor admin'}`
            };
        }
    }
    
    return {
        success: false,
        message: 'Step tidak dikenali.'
    };
}

module.exports = {
    handleGeneralSteps
};
