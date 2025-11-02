/**
 * Teknisi Workflow Handler
 * Handles complete teknisi workflow as requested:
 * 1. Proses ticket (generate OTP)
 * 2. OTW (on the way) with location sharing
 * 3. Sampai (arrived) - request OTP
 * 4. Complete with photos (min 2)
 */

const fs = require('fs');
const path = require('path');
const { setUserState, getUserState, deleteUserState } = require('./conversation-handler');

/**
 * Generate random OTP
 */
function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString(); // 6 digit OTP
}

/**
 * Handle "proses" command - teknisi takes ticket
 */
async function handleProsesTicket(sender, ticketId, reply) {
    try {
        // Find ticket
        const ticket = global.reports.find(r => r.ticketId === ticketId.toUpperCase());
        
        if (!ticket) {
            return {
                success: false,
                message: `❌ Tiket *${ticketId}* tidak ditemukan.`
            };
        }
        
        if (ticket.status === 'process') {
            return {
                success: false,
                message: `⚠️ Tiket *${ticketId}* sudah diproses oleh teknisi lain.`
            };
        }
        
        if (ticket.status === 'completed' || ticket.status === 'selesai') {
            return {
                success: false,
                message: `✅ Tiket *${ticketId}* sudah selesai.`
            };
        }
        
        // Get teknisi info - handle phone number format
        const senderNumber = sender.replace('@s.whatsapp.net', '');
        
        // Remove 62 prefix if exists to match database format
        let phoneToMatch = senderNumber;
        if (senderNumber.startsWith('62')) {
            phoneToMatch = senderNumber.substring(2);
        }
        
        // Find teknisi by matching phone number (with or without 62)
        const teknisi = global.accounts.find(acc => {
            if (acc.role !== 'teknisi') return false;
            
            // Match either with or without 62 prefix
            return acc.phone_number === phoneToMatch || 
                   acc.phone_number === senderNumber ||
                   `62${acc.phone_number}` === senderNumber;
        });
        
        if (!teknisi) {
            console.error(`[TEKNISI_NOT_FOUND] Sender: ${senderNumber}, phoneToMatch: ${phoneToMatch}`);
            console.error(`[TEKNISI_NOT_FOUND] Available teknisi:`, global.accounts.filter(a => a.role === 'teknisi').map(a => a.phone_number));
            return {
                success: false,
                message: '❌ Anda tidak terdaftar sebagai teknisi.'
            };
        }
        
        console.log(`[TEKNISI_FOUND] Name: ${teknisi.name || teknisi.username}, Phone: ${teknisi.phone_number}`);
        
        // Generate OTP
        const otp = generateOTP();
        
        // Update ticket - set all possible field names for compatibility
        ticket.status = 'process';
        ticket.teknisiId = sender;
        ticket.processedByTeknisiId = sender;  // For old workflow compatibility
        ticket.processedByTeknisi = sender;     // For general-steps compatibility
        ticket.teknisiName = teknisi.name || teknisi.username;  // Use name field first
        ticket.processedByTeknisiName = teknisi.name || teknisi.username;  // For old workflow
        ticket.otp = otp;
        ticket.processedAt = new Date().toISOString();
        
        // Save to file
        const reportsPath = path.join(__dirname, '../../database/reports.json');
        fs.writeFileSync(reportsPath, JSON.stringify(global.reports, null, 2));
        
        // Get teknisi phone number for customer contact
        const teknisiPhone = (() => {
            const senderNum = sender.replace('@s.whatsapp.net', '');
            if (senderNum.startsWith('62')) {
                return senderNum;
            } else if (senderNum.startsWith('0')) {
                return '62' + senderNum.substring(1);
            } else {
                return '62' + senderNum;
            }
        })();
        
        // Notify customer with OTP - Send to ALL registered numbers
        const customerJid = ticket.pelangganId;
        const customerMessage = `✅ *TIKET DIPROSES*

━━━━━━━━━━━━━━━━
📋 ID Tiket: *${ticketId}*
🔧 Teknisi: *${teknisi.name || teknisi.username}*
📱 Kontak: wa.me/${teknisiPhone}
━━━━━━━━━━━━━━━━

🔐 *KODE OTP: ${otp}*

⚠️ *PENTING:*
• Simpan kode OTP ini
• Berikan ke teknisi saat tiba
• Jangan berikan ke orang lain
• Kode hanya untuk tiket ini

Teknisi akan segera menuju lokasi Anda.

_Estimasi kedatangan akan diinformasikan._`;

        // Send to main customer (yang lapor)
        if (global.raf && global.raf.sendMessage) {
            try {
                await global.raf.sendMessage(customerJid, { text: customerMessage });
                console.log(`[PROSES_NOTIF] OTP sent to main customer: ${customerJid}`);
            } catch (err) {
                console.error('[PROSES_NOTIF] Failed to notify main customer:', err);
            }
        }
        
        // IMPORTANT: Also send OTP to ALL registered phone numbers
        if (ticket.pelangganPhone) {
            const phones = ticket.pelangganPhone.split('|').map(p => p.trim()).filter(p => p);
            console.log(`[PROSES_NOTIF] Sending OTP to ${phones.length} phone numbers: ${phones.join(', ')}`);
            
            for (const phone of phones) {
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
                
                // Skip if this is the main customer (already sent)
                if (phoneJid === customerJid) {
                    console.log(`[PROSES_NOTIF] Skipping ${phoneJid} (already sent as main customer)`);
                    continue;
                }
                
                try {
                    await global.raf.sendMessage(phoneJid, { text: customerMessage });
                    console.log(`[PROSES_NOTIF] OTP sent to additional number: ${phoneJid}`);
                } catch (err) {
                    console.error(`[PROSES_NOTIF] Failed to notify ${phoneJid}:`, err);
                }
            }
        }
        
        return {
            success: true,
            message: `✅ *TIKET BERHASIL DIPROSES*

━━━━━━━━━━━━━━━━
📋 ID: *${ticketId}*
👤 Pelanggan: ${ticket.pelangganName}
📱 No: ${ticket.pelangganPhone}
📍 Alamat: ${ticket.pelangganAddress || 'Tidak ada'}
━━━━━━━━━━━━━━━━

✅ OTP telah dikirim ke pelanggan
🔐 *Minta OTP saat tiba di lokasi*

📌 *STEP SELANJUTNYA:*
➡️ Ketik: *otw ${ticketId}*
   Untuk update status mulai perjalanan

💡 *Opsional:* Share live location setelah ketik otw`
        };
        
    } catch (error) {
        console.error('[PROSES_TICKET_ERROR]', error);
        return {
            success: false,
            message: '❌ Gagal memproses tiket. Silakan coba lagi.'
        };
    }
}

/**
 * Handle "otw" command - teknisi on the way
 */
async function handleOTW(sender, ticketId, locationUrl, reply) {
    try {
        // Find ticket
        const ticket = global.reports.find(r => r.ticketId === ticketId.toUpperCase());
        
        if (!ticket) {
            return {
                success: false,
                message: `❌ Tiket *${ticketId}* tidak ditemukan.`
            };
        }
        
        // Verify teknisi - check all possible field names (support old and new workflows)
        const assignedTeknisi = ticket.teknisiId || ticket.processedByTeknisiId || ticket.processedByTeknisi;
        if (assignedTeknisi && assignedTeknisi !== sender) {
            return {
                success: false,
                message: `❌ Anda bukan teknisi yang menangani tiket ini.`
            };
        }
        
        // Check status - support both new and old status values
        const validStatuses = ['process', 'diproses teknisi'];
        if (!validStatuses.includes(ticket.status)) {
            return {
                success: false,
                message: `⚠️ Status tiket tidak sesuai. Proses tiket dulu.`
            };
        }
        
        // Get existing state to preserve OTP data
        const existingState = getUserState(sender);
        
        // Set state untuk menunggu lokasi while preserving OTP data (SAMA DENGAN mulai perjalanan)
        setUserState(sender, {
            step: 'AWAITING_LOCATION_FOR_JOURNEY',
            ticketId: ticketId.toUpperCase(),
            reportData: ticket,
            // Preserve OTP data if exists
            otp: existingState?.otp || ticket.otp,
            otpCreatedAt: existingState?.otpCreatedAt,
            isProcessing: true // Mark that this ticket is being processed
        });
        
        // Update ticket
        ticket.status = 'otw';
        ticket.otwAt = new Date().toISOString();
        
        // Make sure teknisi fields are set if not already (for old workflows)
        if (!ticket.teknisiId) ticket.teknisiId = sender;
        if (!ticket.processedByTeknisiId) ticket.processedByTeknisiId = sender;
        if (!ticket.processedByTeknisi) ticket.processedByTeknisi = sender;
        
        // Save to file
        const reportsPath = path.join(__dirname, '../../database/reports.json');
        fs.writeFileSync(reportsPath, JSON.stringify(global.reports, null, 2));
        
        // Get teknisi phone for customer contact
        const teknisiPhone = (() => {
            const senderNum = sender.replace('@s.whatsapp.net', '');
            if (senderNum.startsWith('62')) {
                return senderNum;
            } else if (senderNum.startsWith('0')) {
                return '62' + senderNum.substring(1);
            } else {
                return '62' + senderNum;
            }
        })();
        
        // Notify customer with SAME MESSAGE as mulai perjalanan
        const customerMessage = `🚗 *TEKNISI BERANGKAT*

━━━━━━━━━━━━━━━━
📋 ID Tiket: *${ticketId.toUpperCase()}*
🔧 Teknisi: *${ticket.teknisiName || ticket.processedByTeknisiName || 'Teknisi'}*
📱 Kontak: wa.me/${teknisiPhone}
━━━━━━━━━━━━━━━━

Teknisi sedang menuju lokasi Anda.

⏱️ *Estimasi Tiba:* 30-60 menit
_Waktu dapat berubah tergantung kondisi_

📍 Cek posisi teknisi:
Ketik: *lokasi ${ticketId.toUpperCase()}*

🔐 *KODE VERIFIKASI:*
╔════════════════╗
║  *${ticket.otp}*  ║
╚════════════════╝

Berikan kode ini saat teknisi tiba.`;
        
        // Notify main customer
        if (global.raf && global.raf.sendMessage) {
            try {
                await global.raf.sendMessage(ticket.pelangganId, { text: customerMessage });
            } catch (err) {
                console.error('[OTW_NOTIF] Failed to notify customer:', err);
            }
        }
        
        // Also notify other registered numbers (SAMA DENGAN mulai perjalanan)
        if (ticket.pelangganPhone) {
            const phones = ticket.pelangganPhone.split('|').map(p => p.trim()).filter(p => p);
            for (const phone of phones) {
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
                
                if (phoneJid === ticket.pelangganId) continue;
                
                try {
                    await global.raf.sendMessage(phoneJid, { text: customerMessage });
                } catch (err) {
                    console.error(`[OTW_NOTIF] Failed to notify ${phoneJid}:`, err);
                }
            }
        }
        
        return {
            success: true,
            message: `🚗 *MULAI PERJALANAN*
            
Tiket: *${ticketId.toUpperCase()}*
Pelanggan: ${ticket.pelangganName}

✅ Pelanggan telah diberitahu Anda berangkat.

📑 *WAJIB SHARE LOKASI:*

1️⃣ Klik icon 📎 (Attachment)
2️⃣ Pilih 📑 *Location*
3️⃣ Pilih *Share Live Location*
4️⃣ Pilih durasi *1 jam*
5️⃣ Kirim

💡 *PENTING:*
• Pelanggan dapat tracking posisi Anda
• Update otomatis setiap beberapa menit
• Saat tiba, ketik: *sampai ${ticketId.toUpperCase()}*`
        };
        
    } catch (error) {
        console.error('[OTW_ERROR]', error);
        return {
            success: false,
            message: '❌ Gagal update status OTW. Silakan coba lagi.'
        };
    }
}

/**
 * Handle "sampai" command - teknisi arrived
 */
async function handleSampaiLokasi(sender, ticketId, reply) {
    try {
        // Find ticket
        const ticket = global.reports.find(r => r.ticketId === ticketId.toUpperCase());
        
        if (!ticket) {
            return {
                success: false,
                message: `❌ Tiket *${ticketId}* tidak ditemukan.`
            };
        }
        
        // Verify teknisi - check all possible field names
        const assignedTeknisi = ticket.teknisiId || ticket.processedByTeknisiId || ticket.processedByTeknisi;
        if (assignedTeknisi && assignedTeknisi !== sender) {
            return {
                success: false,
                message: `❌ Anda bukan teknisi yang menangani tiket ini.`
            };
        }
        
        if (ticket.status !== 'otw' && ticket.status !== 'process' && ticket.status !== 'diproses teknisi') {
            return {
                success: false,
                message: `⚠️ Status tiket tidak sesuai.`
            };
        }
        
        // Debug: Check if OTP exists
        console.log(`[SAMPAI_DEBUG] Ticket OTP: ${ticket.otp}`);
        console.log(`[SAMPAI_DEBUG] Ticket pelangganPhone: ${ticket.pelangganPhone}`);
        
        // Ensure OTP exists
        if (!ticket.otp) {
            console.error('[SAMPAI_ERROR] OTP not found in ticket!');
            // Try to generate OTP if missing (fallback)
            ticket.otp = generateOTP();
            console.log(`[SAMPAI_RECOVERY] Generated new OTP: ${ticket.otp}`);
        }
        
        // Update ticket
        ticket.status = 'arrived';
        ticket.arrivedAt = new Date().toISOString();
        
        // Save to file
        const reportsPath = path.join(__dirname, '../../database/reports.json');
        fs.writeFileSync(reportsPath, JSON.stringify(global.reports, null, 2));
        
        // Notify customer (same pattern as OTW notification)
        const customerJid = ticket.pelangganId;
        const teknisiName = ticket.teknisiName || ticket.processedByTeknisiName || 'Teknisi';
        
        // Get teknisi phone number for customer contact
        const teknisiPhone = (() => {
            const teknisiSender = sender.replace('@s.whatsapp.net', '');
            if (teknisiSender.startsWith('62')) {
                return teknisiSender; // Already in correct format
            } else if (teknisiSender.startsWith('0')) {
                return '62' + teknisiSender.substring(1);
            } else {
                return '62' + teknisiSender;
            }
        })();
        
        // Prepare OTP display with fallback
        const otpDisplay = ticket.otp || 'XXXXXX';
        
        const customerMessage = `🎉 *TEKNISI SUDAH TIBA*

━━━━━━━━━━━━━━━━
📋 ID Tiket: *${ticketId.toUpperCase()}*
🔧 Teknisi: *${teknisiName}*
📱 Kontak: wa.me/${teknisiPhone}
━━━━━━━━━━━━━━━━

✅ Teknisi sudah di lokasi Anda

🔐 *KODE VERIFIKASI:*
╔════════════════╗
║  *${otpDisplay}*  ║
╚════════════════╝

⚠️ *PENTING:*
• Berikan kode ini ke teknisi
• Untuk memverifikasi identitas
• Jangan berikan ke orang lain

_Perbaikan akan segera dimulai._`;

        // Send to main customer
        if (global.raf && global.raf.sendMessage) {
            try {
                await global.raf.sendMessage(customerJid, { text: customerMessage });
                console.log(`[SAMPAI_NOTIF] Sent arrival notification to ${customerJid}`);
            } catch (err) {
                console.error('[SAMPAI_NOTIF] Failed to notify main customer:', err);
            }
        }
        
        // Also notify other registered numbers (same as OTW)
        if (ticket.pelangganPhone) {
            const phones = ticket.pelangganPhone.split('|').map(p => p.trim()).filter(p => p);
            console.log(`[SAMPAI_NOTIF] Sending to ${phones.length} phone numbers: ${phones.join(', ')}`);
            
            for (const phone of phones) {
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
                
                if (phoneJid === customerJid) continue;
                
                try {
                    await global.raf.sendMessage(phoneJid, { text: customerMessage });
                    console.log(`[SAMPAI_NOTIF] Sent to additional number: ${phoneJid}`);
                } catch (err) {
                    console.error(`[SAMPAI_NOTIF] Failed to notify ${phoneJid}:`, err);
                }
            }
        }
        
        return {
            success: true,
            message: `📍 *STATUS: SAMPAI DI LOKASI*

━━━━━━━━━━━━━━━━
📋 Tiket: *${ticketId}*
🕒 Tiba: ${new Date().toLocaleTimeString('id-ID')}
✅ Status: ARRIVED AT LOCATION
━━━━━━━━━━━━━━━━

✅ Customer telah dinotifikasi kedatangan Anda

📌 *STEP SELANJUTNYA:*
1️⃣ Temui pelanggan
2️⃣ Minta kode OTP (6 digit) 
3️⃣ Verifikasi OTP dengan ketik:

➡️ *verifikasi ${ticketId} [KODE_OTP]*

📝 Contoh: verifikasi ${ticketId} 567890`
        };
        
    } catch (error) {
        console.error('[SAMPAI_ERROR]', error);
        return {
            success: false,
            message: '❌ Gagal update status kedatangan. Silakan coba lagi.'
        };
    }
}

/**
 * Handle OTP verification
 */
async function handleVerifikasiOTP(sender, ticketId, otp, reply) {
    try {
        // Find ticket
        const ticket = global.reports.find(r => r.ticketId === ticketId.toUpperCase());
        
        if (!ticket) {
            return {
                success: false,
                message: `❌ Tiket *${ticketId}* tidak ditemukan.`
            };
        }
        
        // Verify teknisi - check all possible field names
        const assignedTeknisi = ticket.teknisiId || ticket.processedByTeknisiId || ticket.processedByTeknisi;
        if (assignedTeknisi && assignedTeknisi !== sender) {
            return {
                success: false,
                message: `❌ Anda bukan teknisi yang menangani tiket ini.`
            };
        }
        
        // Check OTP
        if (ticket.otp !== otp) {
            return {
                success: false,
                message: `❌ Kode OTP salah! Minta kode yang benar ke pelanggan.`
            };
        }
        
        // Update ticket
        ticket.status = 'working';
        ticket.otpVerifiedAt = new Date().toISOString();
        ticket.workStartedAt = new Date().toISOString();
        
        // Save to file
        const reportsPath = path.join(__dirname, '../../database/reports.json');
        fs.writeFileSync(reportsPath, JSON.stringify(global.reports, null, 2));
        
        // Notify customer - Send to ALL registered numbers
        const customerJid = ticket.pelangganId;
        const customerMessage = `🔧 *PENGERJAAN DIMULAI*

━━━━━━━━━━━━━━━━
📋 ID Tiket: *${ticketId}*
🔧 Teknisi: *${ticket.teknisiName}*
━━━━━━━━━━━━━━━━

✅ Verifikasi OTP berhasil
🔧 Teknisi mulai melakukan perbaikan

_Anda akan diinformasikan saat selesai._`;

        // Send to main customer
        if (global.raf && global.raf.sendMessage) {
            try {
                await global.raf.sendMessage(customerJid, { text: customerMessage });
                console.log(`[VERIF_NOTIF] Sent to main customer: ${customerJid}`);
            } catch (err) {
                console.error('[VERIF_NOTIF] Failed to notify main customer:', err);
            }
        }
        
        // IMPORTANT: Also send to ALL registered phone numbers
        if (ticket.pelangganPhone) {
            const phones = ticket.pelangganPhone.split('|').map(p => p.trim()).filter(p => p);
            for (const phone of phones) {
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
                
                if (phoneJid === customerJid) continue;
                
                try {
                    await global.raf.sendMessage(phoneJid, { text: customerMessage });
                    console.log(`[VERIF_NOTIF] Sent to additional number: ${phoneJid}`);
                } catch (err) {
                    console.error(`[VERIF_NOTIF] Failed to notify ${phoneJid}:`, err);
                }
            }
        }
        
        // Set state for photo upload
        if (!global.teknisiStates) {
            global.teknisiStates = {};
        }
        
        global.teknisiStates[sender] = {
            step: 'AWAITING_COMPLETION_PHOTOS',
            ticketId: ticketId,
            uploadedPhotos: [],
            minPhotos: 2
        };
        
        return {
            success: true,
            message: `✅ *OTP TERVERIFIKASI - MULAI PERBAIKAN!*

━━━━━━━━━━━━━━━━
📋 Tiket: *${ticketId}*
✅ Lokasi Terverifikasi
🔧 Status: PERBAIKAN DIMULAI
━━━━━━━━━━━━━━━━

📌 *STEP SELANJUTNYA:*
📸 *UPLOAD DOKUMENTASI (Min. 2 Foto):*

1️⃣ Foto kondisi awal/masalah
2️⃣ Foto proses perbaikan
3️⃣ Foto hasil/selesai (opsional)

*Cara Upload:*
• Kirim foto satu per satu
• Bisa dengan jeda waktu
• Min 2 foto, maks 5 foto

➡️ Setelah semua foto terupload, ketik:
   *done* atau *lanjut* atau *next*

⚠️ Foto akan dikirim ke pelanggan sebagai bukti`
        };
        
    } catch (error) {
        console.error('[VERIFIKASI_ERROR]', error);
        return {
            success: false,
            message: '❌ Gagal verifikasi OTP. Silakan coba lagi.'
        };
    }
}

/**
 * Handle completion with photos
 */
async function handleSelesaiTicket(sender, ticketId, reply) {
    try {
        // Check teknisi state
        const state = global.teknisiStates && global.teknisiStates[sender];
        
        if (!state || state.ticketId !== ticketId) {
            return {
                success: false,
                message: `❌ Verifikasi OTP dulu sebelum menyelesaikan tiket.`
            };
        }
        
        // Also check photo queue for accurate count
        const { getUploadQueue } = require('./teknisi-photo-handler');
        const queue = getUploadQueue(sender);
        
        // Sync uploaded photos from queue if exists
        if (queue && queue.uploadedPhotos.length > 0) {
            state.uploadedPhotos = [...queue.uploadedPhotos];
        }
        
        // Check minimum photos
        if (!state.uploadedPhotos || state.uploadedPhotos.length < 2) {
            return {
                success: false,
                message: `❌ *FOTO KURANG!*

Anda harus upload minimal 2 foto:
• Foto hasil perbaikan
• Foto perangkat

Foto saat ini: ${state.uploadedPhotos ? state.uploadedPhotos.length : 0}/2

Silakan kirim foto dulu.`
            };
        }
        
        // Find ticket
        const ticket = global.reports.find(r => r.ticketId === ticketId.toUpperCase());
        
        if (!ticket) {
            return {
                success: false,
                message: `❌ Tiket *${ticketId}* tidak ditemukan.`
            };
        }
        
        // Update ticket
        ticket.status = 'selesai';
        ticket.completedAt = new Date().toISOString();
        ticket.teknisiPhotos = state.uploadedPhotos;
        ticket.teknisiPhotoCount = state.uploadedPhotos.length;
        
        // Calculate duration
        const start = new Date(ticket.workStartedAt);
        const end = new Date();
        const durationMinutes = Math.floor((end - start) / 1000 / 60);
        ticket.workDuration = durationMinutes;
        
        // Save to file
        const reportsPath = path.join(__dirname, '../../database/reports.json');
        fs.writeFileSync(reportsPath, JSON.stringify(global.reports, null, 2));
        
        // Clear teknisi state and photo queue
        delete global.teknisiStates[sender];
        
        // Clear photo upload queue
        const { clearUploadQueue } = require('./teknisi-photo-handler');
        clearUploadQueue(sender);
        
        // Notify customer - Send to ALL registered numbers
        const customerJid = ticket.pelangganId;
        const customerMessage = `✅ *PERBAIKAN SELESAI*

━━━━━━━━━━━━━━━━
📋 ID Tiket: *${ticketId}*
🔧 Teknisi: *${ticket.teknisiName}*
⏱️ Durasi: ${durationMinutes} menit
━━━━━━━━━━━━━━━━

✅ Masalah telah diselesaikan
📸 Dokumentasi: ${ticket.teknisiPhotoCount} foto

*Terima kasih telah menunggu!*

Jika ada masalah lagi, silakan lapor kembali.

_Tiket telah ditutup._`;

        // Send to main customer
        if (global.raf && global.raf.sendMessage) {
            try {
                await global.raf.sendMessage(customerJid, { text: customerMessage });
                console.log(`[SELESAI_NOTIF] Sent completion to main customer: ${customerJid}`);
            } catch (err) {
                console.error('[SELESAI_NOTIF] Failed to notify main customer:', err);
            }
        }
        
        // IMPORTANT: Also send to ALL registered phone numbers
        if (ticket.pelangganPhone) {
            const phones = ticket.pelangganPhone.split('|').map(p => p.trim()).filter(p => p);
            console.log(`[SELESAI_NOTIF] Sending completion to ${phones.length} phone numbers`);
            
            for (const phone of phones) {
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
                
                // Skip if this is the main customer
                if (phoneJid === customerJid) continue;
                
                try {
                    await global.raf.sendMessage(phoneJid, { text: customerMessage });
                    console.log(`[SELESAI_NOTIF] Sent to additional number: ${phoneJid}`);
                } catch (err) {
                    console.error(`[SELESAI_NOTIF] Failed to notify ${phoneJid}:`, err);
                }
            }
        }
        
        return {
            success: true,
            message: `✅ *TIKET SELESAI*

━━━━━━━━━━━━━━━━
📋 Tiket: *${ticketId}*
⏱️ Durasi: ${durationMinutes} menit
📸 Foto: ${ticket.teknisiPhotoCount} dokumentasi
━━━━━━━━━━━━━━━━

✅ Pelanggan telah diinformasikan
✅ Tiket telah ditutup

Terima kasih atas kerja kerasnya! 💪`
        };
        
    } catch (error) {
        console.error('[SELESAI_ERROR]', error);
        return {
            success: false,
            message: '❌ Gagal menyelesaikan tiket. Silakan coba lagi.'
        };
    }
}

/**
 * Handle teknisi photo upload
 */
async function handleTeknisiPhotoUpload(sender, photoPath) {
    try {
        // Get teknisi state
        const state = global.teknisiStates && global.teknisiStates[sender];
        
        if (!state || state.step !== 'AWAITING_COMPLETION_PHOTOS') {
            return {
                success: false,
                message: null // Not in photo upload state
            };
        }
        
        // Add photo to state
        if (!state.uploadedPhotos) {
            state.uploadedPhotos = [];
        }
        
        state.uploadedPhotos.push(photoPath);
        const photoCount = state.uploadedPhotos.length;
        
        if (photoCount < state.minPhotos) {
            return {
                success: true,
                message: `✅ Foto ${photoCount} berhasil diterima!

📌 *STATUS UPLOAD:*
• Foto terupload: ${photoCount}/2 (minimum)
• Status: Perlu ${2 - photoCount} foto lagi

📌 *STEP SELANJUTNYA:*
➡️ Kirim foto ke-${photoCount + 1}
   (minimal 2 foto dokumentasi)

💡 Tips: Ambil foto yang jelas menunjukkan:
• Kondisi perangkat/kabel
• Proses perbaikan yang dilakukan`
            };
        } else {
            return {
                success: true,
                message: `✅ *${photoCount} FOTO DOKUMENTASI DITERIMA!*

📌 *STATUS:*
• Foto terupload: ${photoCount} ✅
• Minimum terpenuhi (2 foto)
• Siap lanjut ke tahap berikutnya

📌 *STEP SELANJUTNYA:*
➡️ Ketik salah satu:
   • *done*
   • *lanjut* 
   • *next*

   Untuk melanjutkan ke pengisian catatan resolusi

💡 Atau kirim foto tambahan jika diperlukan (maks 5)`
            };
        }
        
    } catch (error) {
        console.error('[TEKNISI_PHOTO_ERROR]', error);
        return {
            success: false,
            message: '❌ Gagal menyimpan foto. Coba lagi.'
        };
    }
}

/**
 * Complete ticket with resolution notes
 */
async function handleCompleteTicket(sender, state, reply) {
    try {
        const ticketId = state.ticketId;
        const reportIndex = global.reports.findIndex(r => r.ticketId === ticketId);
        
        if (reportIndex === -1) {
            return {
                success: false,
                message: '❌ Tiket tidak ditemukan!'
            };
        }
        
        const ticket = global.reports[reportIndex];
        
        // Update ticket
        ticket.status = 'completed';
        ticket.completedAt = new Date().toISOString();
        ticket.completedBy = sender;
        ticket.resolutionNotes = state.resolutionNotes;
        ticket.completionPhotos = state.uploadedPhotos;
        
        // Save to database
        const reportsPath = path.join(__dirname, '../../database/reports.json');
        fs.writeFileSync(reportsPath, JSON.stringify(global.reports, null, 2));
        
        // Notify customer
        const customerJid = ticket.pelangganId;
        const customerMessage = `✅ *PERBAIKAN SELESAI!*
━━━━━━━━━━━━━━━━

Halo ${ticket.pelangganName},

Tiket *${ticketId}* telah selesai diperbaiki.

📝 *Catatan Teknisi:*
${state.resolutionNotes}

━━━━━━━━━━━━━━━━
Terima kasih atas kesabaran Anda.

Jika ada masalah, silakan laporkan kembali.

_${global.config.nama || 'Layanan Internet'}_`;
        
        await global.raf.sendMessage(customerJid, { text: customerMessage });
        
        // Send completion photos to customer
        if (state.uploadedPhotos && state.uploadedPhotos.length > 0) {
            for (const photo of state.uploadedPhotos) {
                const photoPath = path.join(__dirname, '../../uploads/teknisi', photo);
                if (fs.existsSync(photoPath)) {
                    await global.raf.sendMessage(customerJid, {
                        image: { url: photoPath },
                        caption: `📸 Dokumentasi perbaikan - ${ticketId}`
                    });
                }
            }
        }
        
        return {
            success: true,
            message: `🎉 *PERBAIKAN SELESAI - TIKET CLOSED!*
━━━━━━━━━━━━━━━━

📋 ID Tiket: *${ticketId}*
✅ Status: *COMPLETED*
📝 Catatan: Tersimpan
📸 Dokumentasi: ${state.uploadedPhotos.length} foto
👤 Pelanggan: Sudah dinotifikasi

━━━━━━━━━━━━━━━━
✅ *SEMUA TAHAP SELESAI:*
• Proses ✅
• OTW ✅ 
• Sampai ✅
• Verifikasi OTP ✅
• Upload Foto ✅
• Catatan Resolusi ✅
• Kirim ke Pelanggan ✅

━━━━━━━━━━━━━━━━
📌 *TIKET INI SUDAH SELESAI*

Anda bisa ambil tiket baru dengan:
➡️ Cek tiket tersedia: *list tiket*
➡️ Ambil tiket: *proses [ID_TIKET]*

Terima kasih atas kerja keras Anda! 💪`
        };
        
    } catch (error) {
        console.error('[COMPLETE_TICKET_ERROR]', error);
        return {
            success: false,
            message: '❌ Gagal menyelesaikan tiket. Coba lagi.'
        };
    }
}

module.exports = {
    handleProsesTicket,
    handleOTW,
    handleSampaiLokasi,
    handleVerifikasiOTP,
    handleSelesaiTicket,
    handleTeknisiPhotoUpload,
    handleCompleteTicket,
    generateOTP
};
