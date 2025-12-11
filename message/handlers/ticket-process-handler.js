/**
 * Ticket Process Handler
 * Handle teknisi processing tickets with verification
 * 
 * DEPRECATED: Handler ini sebagian besar sudah tidak digunakan.
 * - handleProsesTicket, handleVerifikasiOTP, handleCompleteTicket sudah diganti dengan teknisi-workflow-handler.js
 * - handleRemoteResponse masih digunakan untuk CUSTOMER_CONFIRM_DONE
 * - handleFinalConfirmation masih digunakan untuk final confirmation flow
 * 
 * TODO: Migrate handleRemoteResponse dan handleFinalConfirmation ke teknisi-workflow-handler.js
 * TODO: Hapus handler yang tidak digunakan setelah migration selesai
 */

const fs = require('fs');
const path = require('path');
const { setUserState, getUserState, deleteUserState } = require('./conversation-handler');

/**
 * Format phone number to WhatsApp format
 */
function formatPhoneNumber(phone) {
    if (!phone) return '';
    phone = phone.trim();
    if (phone.endsWith('@s.whatsapp.net')) {
        return phone;
    }
    if (phone.startsWith('0')) {
        phone = `62${phone.substring(1)}`;
    } else if (!phone.startsWith('62')) {
        phone = `62${phone}`;
    }
    return `${phone}@s.whatsapp.net`;
}

/**
 * Handle PROSES command from teknisi
 * 
 * @deprecated Handler ini sudah diganti dengan handleProsesTicket dari teknisi-workflow-handler.js
 * Handler ini tidak digunakan di routing message/raf.js
 * TODO: Hapus handler ini setelah memastikan tidak ada dependencies
 */
async function handleProsesTicket(sender, ticketId, teknisiInfo, reply) {
    try {
        // Check teknisi workload (max 3 active tickets)
        const activeTickets = global.reports.filter(r => 
            r.processedByTeknisiId === sender && 
            r.status === 'diproses teknisi'
        );
        
        if (activeTickets.length >= 3) {
            const ticketList = activeTickets.map(t => `• ${t.ticketId} - ${t.pelangganName}`).join('\n');
            return {
                success: false,
                message: `⚠️ *MAKSIMAL TIKET TERCAPAI*

Anda sudah menangani 3 tiket:
${ticketList}

Selesaikan salah satu tiket terlebih dahulu sebelum mengambil tiket baru.

💡 Tip: Prioritaskan tiket HIGH priority atau yang sudah lama.`
            };
        }
        
        // Find the ticket
        const report = global.reports.find(r => r.ticketId === ticketId);
        
        if (!report) {
            return {
                success: false,
                message: `❌ Tiket dengan ID *${ticketId}* tidak ditemukan.\n\nPastikan ID tiket benar.`
            };
        }
        
        // Check if already being processed
        if (report.status === 'diproses teknisi') {
            return {
                success: false,
                message: `⚠️ Tiket *${ticketId}* sudah sedang diproses oleh *${report.processedByTeknisiName || 'Teknisi lain'}*.\n\nJika Anda ingin mengambil alih, hubungi admin.`
            };
        }
        
        // Check for completed status (support both 'completed' and 'selesai' for backward compatibility)
        if (report.status === 'completed' || report.status === 'selesai') {
            return {
                success: false,
                message: `✅ Tiket *${ticketId}* sudah selesai ditangani.`
            };
        }
        
        // Update ticket status - set all possible field names for compatibility
        report.status = 'diproses teknisi';
        report.processingStartedAt = new Date().toISOString();
        report.processedByTeknisiId = sender;
        report.processedByTeknisi = sender;     // For compatibility with general-steps
        report.teknisiId = sender;              // For compatibility with new workflow
        report.processedByTeknisiName = teknisiInfo ? (teknisiInfo.name || teknisiInfo.username) : 'Teknisi';
        report.teknisiName = teknisiInfo ? (teknisiInfo.name || teknisiInfo.username) : 'Teknisi';  // For new workflow
        
        // Save to file
        const reportsPath = path.join(__dirname, '../../database/reports.json');
        fs.writeFileSync(reportsPath, JSON.stringify(global.reports, null, 2));
        
        // Generate OTP for verification
        const otp = Math.floor(100000 + Math.random() * 900000).toString(); // 6 digit OTP
        
        // Store OTP in state
        setUserState(sender, {
            step: 'TICKET_PROCESSING',
            ticketId: ticketId,
            otp: otp,
            otpCreatedAt: Date.now(),
            reportData: report
        });
        
        // Get teknisi info
        const teknisiAccount = global.accounts.find(acc => 
            acc.phone_number && formatPhoneNumber(acc.phone_number) === sender
        );
        
        const teknisiName = teknisiAccount?.name || teknisiAccount?.username || report.processedByTeknisiName || 'Teknisi Kami';
        const teknisiPhone = teknisiAccount?.phone_number || sender.replace('@s.whatsapp.net', '');
        
        // Format teknisi phone for display
        let teknisiPhoneDisplay = teknisiPhone;
        if (teknisiPhoneDisplay.startsWith('62')) {
            teknisiPhoneDisplay = `0${teknisiPhoneDisplay.substring(2)}`;
        }
        
        // Get full laporan text without truncation
        const masalahText = report.laporanText.replace(/\n/g, '\n  ');
        
        // Send notification to customer with OTP (to all registered numbers)
        const customerMessage = `🔧 *TEKNISI SEDANG MENUJU LOKASI*

Halo ${report.pelangganName || 'Pelanggan'},

Teknisi kami akan segera menangani laporan Anda.

👷 *TEKNISI YANG DITUGASKAN:*
• Nama: *${teknisiName}*
• No. HP: *${teknisiPhoneDisplay}*

📋 *Detail Tiket:*
• ID: *${ticketId}*
• Masalah:
  ${masalahText}

🔐 *KODE VERIFIKASI: ${otp}*

⚠️ *PENTING:*
• Berikan kode ini HANYA ke teknisi *${teknisiName}*
• Pastikan nomor teknisi sesuai: *${teknisiPhoneDisplay}*
• JANGAN berikan ke orang lain
• Kode berlaku 4 jam

Teknisi akan menghubungi Anda segera.

_Jika teknisi tidak datang dalam 2 jam atau ada yang mencurigakan, segera hubungi kami._`;
        
        // Send to primary pelangganId
        // PENTING: Cek connection state dan gunakan error handling sesuai rules
        if (report.pelangganId && global.whatsappConnectionState === 'open' && global.raf && global.raf.sendMessage) {
            try {
                await global.raf.sendMessage(report.pelangganId, { text: customerMessage });
                console.log(`[TICKET_PROCESS] OTP sent to primary customer number: ${report.pelangganId}`);
            } catch (err) {
                console.error('[SEND_MESSAGE_ERROR]', {
                    pelangganId: report.pelangganId,
                    error: err.message
                });
                console.error(`[TICKET_PROCESS] Failed to send OTP to primary number:`, err);
            }
        } else {
            console.warn('[SEND_MESSAGE_SKIP] WhatsApp not connected, skipping send to', report.pelangganId);
        }
        
        // Also send to all registered phone numbers
        if (report.pelangganPhone) {
            const phones = report.pelangganPhone.split('|').map(p => p.trim()).filter(p => p);
            for (const phone of phones) {
                // Format phone to WhatsApp JID
                let phoneJid = phone;
                if (!phoneJid.endsWith('@s.whatsapp.net')) {
                    if (phoneJid.startsWith('0')) {
                        phoneJid = `62${phoneJid.substring(1)}@s.whatsapp.net`;
                    } else if (phoneJid.startsWith('62')) {
                        phoneJid = `${phoneJid}@s.whatsapp.net`;
                    } else {
                        phoneJid = `62${phoneJid}@s.whatsapp.net`;
                    }
                }
                
                // Skip if same as primary
                if (phoneJid === report.pelangganId) continue;
                
                // PENTING: Cek connection state dan gunakan error handling sesuai rules untuk multiple recipients
                if (global.whatsappConnectionState === 'open' && global.raf && global.raf.sendMessage) {
                    try {
                        await global.raf.sendMessage(phoneJid, { text: customerMessage });
                        console.log(`[TICKET_PROCESS] OTP also sent to: ${phoneJid}`);
                    } catch (err) {
                        console.error('[SEND_MESSAGE_ERROR]', {
                            phoneJid,
                            error: err.message
                        });
                        console.error(`[TICKET_PROCESS] Failed to send OTP to ${phoneJid}:`, err);
                        // Continue to next phone number
                    }
                } else {
                    console.warn('[SEND_MESSAGE_SKIP] WhatsApp not connected, skipping send to', phoneJid);
                }
            }
        }
        
        // Notify admins
        const adminNotif = `📊 *TIKET DIPROSES*

ID: *${ticketId}*
Teknisi: *${report.processedByTeknisiName}*
Pelanggan: ${report.pelangganName}
Prioritas: ${report.priority}

OTP telah dikirim ke pelanggan untuk verifikasi.`;
        
        // Send to admins
        const adminAccounts = global.accounts.filter(acc => 
            ['admin', 'owner', 'superadmin'].includes(acc.role) && 
            acc.phone_number && acc.phone_number.trim() !== ""
        );
        
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
                    await global.raf.sendMessage(adminJid, { text: adminNotif });
                } catch (err) {
                    console.error('[SEND_MESSAGE_ERROR]', {
                        adminJid: admin.phone_number,
                        error: err.message
                    });
                    console.error(`Failed to notify admin ${admin.username}:`, err);
                    // Continue to next admin
                }
            } else {
                console.warn('[SEND_MESSAGE_SKIP] WhatsApp not connected, skipping send to admin', admin.username);
            }
        }
        
        // Format multiple phone numbers nicely
        let phoneDisplay = 'N/A';
        if (report.pelangganPhone) {
            const phones = report.pelangganPhone.split('|').map(p => p.trim()).filter(p => p);
            if (phones.length > 1) {
                phoneDisplay = phones.map((phone, idx) => `${idx + 1}. ${phone}`).join('\n');
            } else if (phones.length === 1) {
                phoneDisplay = phones[0];
            }
        }
        
        return {
            success: true,
            message: `✅ *TIKET DIAMBIL*

ID: *${ticketId}*
Pelanggan: ${report.pelangganName}
Alamat: ${report.pelangganAddress || 'N/A'}

📞 *Nomor Telepon:*
${phoneDisplay}

📋 *Masalah:*
${report.laporanText}

━━━━━━━━━━━━━━━━━━━━━━
🗺️ *STEP BY STEP PERJALANAN:*

1️⃣ *SEBELUM BERANGKAT:*
   Ketik: *mulai perjalanan ${ticketId}*
   Lalu share live location 1 jam

2️⃣ *SAAT SAMPAI LOKASI:*
   Ketik: *sampai ${ticketId}*
   
3️⃣ *VERIFIKASI OTP:*
   Minta kode OTP ke pelanggan
   Ketik: *verifikasi ${ticketId} [OTP]*

4️⃣ *DOKUMENTASI FOTO:*
   Upload minimal 2 foto saat perbaikan
   
5️⃣ *SELESAIKAN:*
   Ketik: *done* setelah upload foto
   Tulis catatan perbaikan
   Dapatkan kode selesai dari pelanggan

━━━━━━━━━━━━━━━━━━━━━━
🔐 *OTP VERIFIKASI:*
• OTP telah dikirim ke pelanggan
• Wajib verifikasi sebelum mulai kerja

⚠️ *PENTING:*
• Pelanggan bisa tracking posisi Anda
• Pastikan pelanggan ada saat perbaikan
• Jika tidak ada, JANGAN lanjutkan

Selamat bekerja! 💪`
        };
        
    } catch (error) {
        console.error('[PROSES_TICKET_ERROR]', error);
        return {
            success: false,
            message: `❌ Terjadi kesalahan saat memproses tiket. Silakan coba lagi.`
        };
    }
}

/**
 * Handle OTP verification from teknisi
 * 
 * @deprecated Handler ini sudah diganti dengan handleVerifikasiOTP dari teknisi-workflow-handler.js
 * Handler ini tidak digunakan di routing message/raf.js
 * TODO: Hapus handler ini setelah memastikan tidak ada dependencies
 */
async function handleVerifikasiOTP(sender, ticketId, otp, reply) {
    try {
        const state = getUserState(sender);
        
        // Check if user has state with OTP data (multiple valid steps)
        const validSteps = [
            'TICKET_PROCESSING', 
            'AWAITING_LOCATION_FOR_JOURNEY',
            'TICKET_PROCESSING_WITH_LOCATION'
        ];
        if (!state || !state.otp) {
            return {
                success: false,
                message: `❌ Anda tidak sedang memproses tiket.\n\nGunakan: *proses [ID_TIKET]* terlebih dahulu.`
            };
        }
        
        // Normalize ticket IDs for comparison
        const stateTicketId = state.ticketId?.toUpperCase();
        const inputTicketId = ticketId?.toUpperCase();
        
        if (stateTicketId !== inputTicketId) {
            return {
                success: false,
                message: `❌ ID tiket tidak sesuai.\n\nAnda sedang memproses tiket *${stateTicketId}*.`
            };
        }
        
        // Check OTP expiry (4 hours)
        const otpAge = Date.now() - state.otpCreatedAt;
        if (otpAge > 4 * 60 * 60 * 1000) {
            deleteUserState(sender);
            return {
                success: false,
                message: `⏱️ Kode OTP sudah expired.\n\nSilakan proses ulang tiket.`
            };
        }
        
        // Verify OTP
        if (state.otp !== otp) {
            return {
                success: false,
                message: `❌ Kode OTP salah!\n\nPastikan Anda memasukkan kode yang diberikan pelanggan.`
            };
        }
        
        // OTP verified! Update state for photo upload
        state.step = 'TICKET_VERIFIED_AWAITING_PHOTOS';
        state.otpVerifiedAt = Date.now();
        state.uploadedPhotos = [];
        // IMPORTANT: Preserve ticketId and set ticketIdToResolve
        state.ticketIdToResolve = state.ticketId; // Add this to ensure ticketId is available later
        setUserState(sender, state);
        
        // Notify customer that teknisi is verified
        const report = state.reportData;
        // PENTING: Cek connection state dan gunakan error handling sesuai rules
        if (report.pelangganId && global.whatsappConnectionState === 'open' && global.raf && global.raf.sendMessage) {
            const customerMessage = `✅ *TEKNISI TERVERIFIKASI*

Teknisi telah tiba di lokasi dan terverifikasi.
Perbaikan sedang dilakukan.

Anda akan mendapat notifikasi setelah selesai.`;
            
            try {
                await global.raf.sendMessage(report.pelangganId, { text: customerMessage });
            } catch (err) {
                console.error('[SEND_MESSAGE_ERROR]', {
                    pelangganId: report.pelangganId,
                    error: err.message
                });
                console.error(`Failed to notify customer about verification:`, err);
            }
        } else {
            console.warn('[SEND_MESSAGE_SKIP] WhatsApp not connected, skipping send to', report.pelangganId);
        }
        
        return {
            success: true,
            message: `✅ *VERIFIKASI BERHASIL*

Pelanggan telah mengkonfirmasi kehadiran Anda.

💡 *TIPS TRACKING:*
Jika belum share lokasi, ketik:
*mulai perjalanan ${ticketId}*
Lalu share live location agar pelanggan bisa tracking.

📸 *DOKUMENTASI WAJIB:*

Silakan upload foto dokumentasi:
• Foto kondisi awal (sebelum perbaikan)
• Foto ONT/Router
• Foto kabel/instalasi
• Screenshot speedtest (jika ada)

📤 *Cara Upload:*
1. Kirim foto satu per satu
2. Setelah selesai, ketik *done* atau *lanjut*
3. Minimal 2 foto wajib

⚠️ *PENTING:*
• Foto HARUS diambil di lokasi pelanggan
• Timestamp akan dicatat otomatis
• JANGAN ketik "selesai" (itu untuk pelanggan)

Mulai kirim foto sekarang...`
        };
        
    } catch (error) {
        console.error('[VERIFY_OTP_ERROR]', error);
        return {
            success: false,
            message: `❌ Terjadi kesalahan saat verifikasi. Silakan coba lagi.`
        };
    }
}

/**
 * Handle ticket completion with customer confirmation
 * 
 * @deprecated Handler ini sudah diganti dengan handleCompleteTicket dari teknisi-workflow-handler.js
 * Handler ini tidak digunakan di routing message/raf.js
 * TODO: Hapus handler ini setelah memastikan tidak ada dependencies
 */
async function handleCompleteTicket({ sender, ticketId, resolutionNotes, uploadedPhotos, reply }) {
    try {
        const state = getUserState(sender);
        
        if (!state || !state.otpVerifiedAt) {
            return {
                success: false,
                message: `❌ Tiket belum diverifikasi pelanggan.\n\nPastikan Anda sudah mendapat OTP dari pelanggan.`
            };
        }
        
        const report = global.reports.find(r => r.ticketId === ticketId);
        if (!report) {
            return {
                success: false,
                message: `❌ Tiket tidak ditemukan.`
            };
        }
        
        // Check minimum photos (2)
        if (!uploadedPhotos || uploadedPhotos.length < 2) {
            return {
                success: false,
                message: `📸 Minimal 2 foto dokumentasi diperlukan.\n\nAnda baru upload ${uploadedPhotos ? uploadedPhotos.length : 0} foto.`
            };
        }
        
        // Generate completion code for customer
        const completionCode = Math.floor(1000 + Math.random() * 9000).toString(); // 4 digit
        
        // Update ticket
        report.status = 'menunggu_konfirmasi_selesai';
        report.resolvedAt = new Date().toISOString();
        report.resolvedByTeknisiId = sender;
        report.resolvedByTeknisiName = state.reportData.processedByTeknisiName;
        report.resolutionNotes = resolutionNotes;
        report.photoCount = uploadedPhotos.length;
        report.completionCode = completionCode;
        report.completionCodeCreatedAt = Date.now();
        
        // Save to file
        const reportsPath = path.join(__dirname, '../../database/reports.json');
        fs.writeFileSync(reportsPath, JSON.stringify(global.reports, null, 2));
        
        // Send completion code to customer
        if (report.pelangganId && global.raf) {
            const customerMessage = `🎯 *PERBAIKAN SELESAI*

Halo ${report.pelangganName || 'Pelanggan'},

Teknisi telah menyelesaikan perbaikan untuk laporan Anda.

📋 *Catatan Teknisi:*
${resolutionNotes}

✅ *KONFIRMASI SELESAI:*
Jika masalah sudah teratasi, berikan kode ini ke teknisi:

🔐 *KODE: ${completionCode}*

Atau Anda bisa langsung konfirmasi dengan mengetik:
*selesai ${ticketId} ${completionCode}*

⚠️ Jika masalah BELUM teratasi:
Ketik: *belum selesai ${ticketId}*

Kode berlaku 2 jam.`;
            
            try {
                await global.raf.sendMessage(report.pelangganId, { text: customerMessage });
            } catch (err) {
                console.error(`Failed to send completion code to customer:`, err);
            }
        }
        
        // Update teknisi state
        state.step = 'AWAITING_CUSTOMER_CONFIRMATION';
        state.completionCode = completionCode;
        setUserState(sender, state);
        
        return {
            success: true,
            message: `📝 *MENUNGGU KONFIRMASI PELANGGAN*

Kode konfirmasi telah dikirim ke pelanggan.

🔐 Minta pelanggan untuk:
1. Cek apakah masalah sudah teratasi
2. Berikan kode *${completionCode}* jika sudah OK

Atau tunggu pelanggan konfirmasi via WhatsApp.

⏱️ Timeout: 2 jam

Setelah mendapat kode, ketik:
*konfirmasi ${ticketId} ${completionCode}*`
        };
        
    } catch (error) {
        console.error('[COMPLETE_TICKET_ERROR]', error);
        return {
            success: false,
            message: `❌ Terjadi kesalahan. Silakan coba lagi.`
        };
    }
}

/**
 * Handle final confirmation from customer
 */
async function handleFinalConfirmation({ ticketId, completionCode, isFromCustomer = false, sender }) {
    try {
        const report = global.reports.find(r => r.ticketId === ticketId);
        
        if (!report) {
            return {
                success: false,
                message: `❌ Tiket tidak ditemukan.`
            };
        }
        
        // Check if code matches
        if (report.completionCode !== completionCode) {
            return {
                success: false,
                message: `❌ Kode konfirmasi salah!`
            };
        }
        
        // Check expiry (2 hours)
        const codeAge = Date.now() - report.completionCodeCreatedAt;
        if (codeAge > 2 * 60 * 60 * 1000) {
            return {
                success: false,
                message: `⏱️ Kode konfirmasi sudah expired.`
            };
        }
        
        // Mark as complete - Standardisasi status ke 'completed'
        report.status = 'completed';
        report.customerConfirmedAt = new Date().toISOString();
        report.confirmedByCustomer = isFromCustomer;
        
        // Calculate resolution time
        const startTime = new Date(report.processingStartedAt || report.createdAt);
        const endTime = new Date(report.customerConfirmedAt);
        const durationMinutes = Math.round((endTime - startTime) / (1000 * 60));
        report.resolutionDurationMinutes = durationMinutes;
        
        // Save to file
        const reportsPath = path.join(__dirname, '../../database/reports.json');
        fs.writeFileSync(reportsPath, JSON.stringify(global.reports, null, 2));
        
        // Notify all parties
        const successMessage = `✅ *TIKET SELESAI*

ID: *${ticketId}*
Durasi: ${durationMinutes} menit
Status: Dikonfirmasi pelanggan

Terima kasih atas kerja kerasnya! 🎉`;
        
        // Clear teknisi state
        const teknisiState = global.accounts.find(acc => 
            acc.phone_number && sender.includes(acc.phone_number.replace(/^0/, '62'))
        );
        if (teknisiState) {
            deleteUserState(sender);
        }
        
        return {
            success: true,
            message: successMessage
        };
        
    } catch (error) {
        console.error('[FINAL_CONFIRMATION_ERROR]', error);
        return {
            success: false,
            message: `❌ Terjadi kesalahan saat konfirmasi.`
        };
    }
}

module.exports = {
    handleProsesTicket,
    handleVerifikasiOTP,
    handleCompleteTicket,
    handleFinalConfirmation
};
