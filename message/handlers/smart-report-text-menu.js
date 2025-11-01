/**
 * Smart Report Handler with Interactive Text Menu
 * Solusi final karena WhatsApp button deprecated untuk personal account
 */

const { isDeviceOnline, getDeviceOfflineMessage } = require('../../lib/device-status');
const { setUserState, getUserState, deleteUserState } = require('./conversation-handler');
const { getResponseTimeMessage, isWithinWorkingHours } = require('../../lib/working-hours-helper');
const fs = require('fs');
const path = require('path');

// Generate ticket ID function
function generateTicketId(length = 7) {
    const characters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let result = '';
    const charactersLength = characters.length;
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
}

/**
 * Start report flow dengan menu interaktif
 */
async function startReportFlow({ sender, pushname, reply }) {
    try {
        // Check if user is registered
        const user = global.users.find(u => 
            u.phone_number && u.phone_number.split("|").some(num =>
                num.trim() === sender.replace('@s.whatsapp.net', '') || 
                `62${num.trim().substring(1)}` === sender.replace('@s.whatsapp.net', '')
            )
        );
        
        if (!user) {
            return { 
                success: false, 
                message: '❌ Nomor Anda belum terdaftar sebagai pelanggan.\n\nSilakan hubungi admin untuk mendaftar.' 
            };
        }

        // Check for existing active report
        const activeReport = global.reports.find(r => 
            r.pelangganUserId === user.id &&
            r.status !== 'selesai' &&
            r.status !== 'cancelled' &&
            r.status !== 'pending'
        );

        if (activeReport) {
            return {
                success: false,
                message: `⚠️ *LAPORAN AKTIF DITEMUKAN*

ID Tiket: *${activeReport.ticketId}*
Status: *${activeReport.status}*
Dibuat: ${new Date(activeReport.createdAt).toLocaleString('id-ID')}

Harap tunggu penyelesaian tiket ini.
Ketik *cektiket ${activeReport.ticketId}* untuk status.`
            };
        }

        // Set state for text-based flow
        setUserState(sender, {
            step: 'REPORT_MENU',
            userData: user
        });

        // Send interactive text menu
        return {
            success: true,
            message: `🔧 *LAPOR GANGGUAN INTERNET*

Silakan pilih jenis gangguan:

*1️⃣ WIFI MATI / KABEL PUTUS / OFFLINE*
   Internet tidak berfungsi sama sekali

*2️⃣ WIFI LEMOT*
   Internet lambat atau tidak stabil

*3️⃣ LAINNYA*
   Gangguan lain yang tidak termasuk di atas

━━━━━━━━━━━━━━━━
*Balas dengan angka pilihan Anda:*
Ketik *1*, *2*, atau *3*`
        };
        
    } catch (error) {
        console.error('[REPORT_START_ERROR]', error);
        return {
            success: false,
            message: '❌ Terjadi kesalahan. Silakan coba lagi.'
        };
    }
}

/**
 * Handle menu selection
 */
async function handleMenuSelection({ sender, choice, reply }) {
    const state = getUserState(sender);
    if (!state || state.step !== 'REPORT_MENU') {
        return { success: false };
    }
    
    const user = state.userData;
    const selection = choice.trim();
    
    if (selection === '1' || selection.includes('mati')) {
        return await handleInternetMati({ sender, pushname: user.username || user.full_name, reply });
    } else if (selection === '2' || selection.includes('lemot')) {
        return await handleInternetLemot({ sender, pushname: user.username || user.full_name, reply });
    } else if (selection === '3' || selection.includes('lain')) {
        deleteUserState(sender);
        return {
            success: true,
            message: `📞 *HUBUNGI CUSTOMER SERVICE*

Untuk gangguan lainnya, silakan hubungi:

📱 WhatsApp: 0812-3456-7890
☎️ Telepon: (0271) 123456

Jam Operasional:
• Senin-Jumat: 08:00 - 17:00
• Sabtu: 08:00 - 13:00

Terima kasih! 🙏`
        };
    } else {
        return {
            success: false,
            message: `⚠️ Pilihan tidak valid.

Silakan balas dengan:
• *1* untuk Internet Mati
• *2* untuk Internet Lemot
• *3* untuk Gangguan Lainnya`
        };
    }
}

/**
 * Handle Internet Mati with Troubleshooting Options
 */
async function handleInternetMati({ sender, pushname, reply }) {
    try {
        // Get user data first
        const user = global.users.find(u => 
            u.phone_number === sender.replace('@s.whatsapp.net', '') ||
            u.phone_number.includes(sender.replace('@s.whatsapp.net', ''))
        );
        
        if (!user) {
            return {
                success: false,
                message: '❌ Data pelanggan tidak ditemukan. Silakan hubungi admin.'
            };
        }
        
        // Check device status via GenieACS
        // Use device_id from user record, fallback to mock if not available
        const deviceId = user.device_id || `DEVICE-${user.id}`; // Proper device ID needed
        const deviceStatus = await isDeviceOnline(deviceId);
        
        // Format last online time - ALWAYS show in minutes for accuracy
        let lastOnlineText = '';
        let offlineMinutes = null;
        
        if (deviceStatus.lastInform) {
            const lastSeenDate = new Date(deviceStatus.lastInform);
            const now = new Date();
            offlineMinutes = Math.floor((now - lastSeenDate) / 1000 / 60);
            const diffHours = Math.floor(offlineMinutes / 60);
            const diffDays = Math.floor(diffHours / 24);
            
            if (diffDays > 0) {
                lastOnlineText = `${diffDays} hari yang lalu (${offlineMinutes} menit)`;
            } else if (diffHours > 0) {
                lastOnlineText = `${diffHours} jam ${offlineMinutes % 60} menit yang lalu`;
            } else if (offlineMinutes > 0) {
                lastOnlineText = `${offlineMinutes} menit yang lalu`;
            } else {
                lastOnlineText = 'Baru saja (< 1 menit)';
            }
        } else {
            lastOnlineText = 'Tidak diketahui';
        }
        
        // Build message with device status and troubleshooting options
        let message = `🔴 *GANGGUAN INTERNET MATI*\n\n`;
        
        if (deviceStatus.mockMode) {
            // When device check is not available (testing/no device_id)
            message += `📡 Status Modem: *Checking manual...*\n`;
            message += `ℹ️ *Catatan:* Teknisi akan cek langsung ke lokasi\n\n`;
        } else if (deviceStatus.online === false) {
            message += `📡 Status Modem: *OFFLINE* 🔴\n`;
            message += `⏰ Terakhir Online: *${lastOnlineText}*\n\n`;
        } else {
            message += `📡 Status Modem: *ONLINE* 🟢\n`;
            message += `⚠️ *Catatan:* Modem terdeteksi online, mungkin masalah di jaringan lokal\n\n`;
        }
        
        message += `🔧 *LANGKAH TROUBLESHOOTING*\n\n`;
        message += `Silakan pilih kondisi Anda:\n\n`;
        message += `*1️⃣ SUDAH COBA, MASIH MATI*\n`;
        message += `   Sudah restart modem tapi tetap tidak ada internet\n\n`;
        message += `*2️⃣ BELUM COBA RESTART*\n`;
        message += `   Belum sempat restart modem\n\n`;
        message += `*3️⃣ SUDAH NORMAL KEMBALI*\n`;
        message += `   Sudah restart dan internet kembali normal\n\n`;
        message += `━━━━━━━━━━━━━━━━\n`;
        message += `Balas dengan angka pilihan Anda (1/2/3)`;
        
        // Save state for next step
        setUserState(sender, {
            step: 'MATI_TROUBLESHOOT_OPTIONS',
            userData: user,
            deviceStatus: deviceStatus,
            issueType: 'MATI',
            lastOnlineText: lastOnlineText
        });
        
        return { success: true, message };
        
    } catch (error) {
        console.error('[HANDLE_MATI_ERROR]', error);
        deleteUserState(sender);
        return {
            success: false,
            message: '❌ Gagal memeriksa status perangkat. Silakan coba lagi.'
        };
    }
}

/**
 * Handle Internet Lemot with Auto-Redirect if Device Offline
 */
async function handleInternetLemot({ sender, pushname, reply }) {
    try {
        // Get user data first
        const user = global.users.find(u => 
            u.phone_number === sender.replace('@s.whatsapp.net', '') ||
            u.phone_number.includes(sender.replace('@s.whatsapp.net', ''))
        );
        
        if (!user) {
            return {
                success: false,
                message: '❌ Data pelanggan tidak ditemukan. Silakan hubungi admin.'
            };
        }
        
        // Check device status FIRST
        const deviceId = user.device_id || `DEVICE-${user.id}`;
        const deviceStatus = await isDeviceOnline(deviceId);
        
        // IMPORTANT: Check if device is OFFLINE and auto-redirect to MATI flow
        if (deviceStatus.online === false) {
            console.log('[AUTO-REDIRECT] User selected LEMOT but device is OFFLINE - redirecting to MATI flow');
            
            // Get offline duration
            let lastOnlineText = 'Tidak diketahui';
            let offlineMinutes = null;
            
            if (deviceStatus.lastInform) {
                const lastSeenDate = new Date(deviceStatus.lastInform);
                const now = new Date();
                offlineMinutes = Math.floor((now - lastSeenDate) / 1000 / 60);
                const diffHours = Math.floor(offlineMinutes / 60);
                const diffDays = Math.floor(diffHours / 24);
                
                if (diffDays > 0) {
                    lastOnlineText = `${diffDays} hari yang lalu`;
                } else if (diffHours > 0) {
                    lastOnlineText = `${diffHours} jam ${offlineMinutes % 60} menit yang lalu`;
                } else if (offlineMinutes > 0) {
                    lastOnlineText = `${offlineMinutes} menit yang lalu`;
                } else {
                    lastOnlineText = 'Baru saja (< 1 menit)';
                }
            }
            
            // Get estimation time for HIGH priority
            const estimasi = getResponseTimeMessage('HIGH');
            const workingStatus = isWithinWorkingHours();
            let targetTime = '';
            
            if (workingStatus.isWithinHours) {
                const now = new Date();
                const target = new Date(now.getTime() + 2 * 60 * 60 * 1000);
                targetTime = `Hari ini sebelum ${String(target.getHours()).padStart(2, '0')}:${String(target.getMinutes()).padStart(2, '0')} WIB`;
            } else {
                if (workingStatus.nextWorkingTime) {
                    const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
                    const next = workingStatus.nextWorkingTime;
                    targetTime = `${dayNames[next.getDay()]} pukul ${String(next.getHours()).padStart(2, '0')}:${String(next.getMinutes()).padStart(2, '0')} WIB`;
                }
            }
            
            // Save state for MATI flow instead of LEMOT
            setUserState(sender, {
                step: 'MATI_TROUBLESHOOT_OPTIONS',
                userData: user,
                deviceStatus: deviceStatus,
                issueType: 'MATI',
                lastOnlineText: lastOnlineText,
                autoRedirected: true,
                originalSelection: 'LEMOT',
                estimatedTime: estimasi,
                targetTime: targetTime
            });
            
            // Return MATI flow message instead of LEMOT
            return {
                success: true,
                message: `🔴 *KOREKSI: DEVICE ANDA OFFLINE!*

Anda memilih "Internet Lemot", namun sistem mendeteksi perangkat Anda *OFFLINE TOTAL*.

📡 Status Modem: *OFFLINE* 🔴
⏰ Terakhir Online: *${lastOnlineText}*

📊 *Analisis Otomatis:*
• Gangguan: *Internet Mati Total*
• Prioritas: *HIGH (Urgent)* 🚨
• Estimasi: *${estimasi}*
${targetTime ? `• Target: *${targetTime}*` : ''}

🔧 *LANGKAH TROUBLESHOOTING*

Silakan pilih kondisi Anda:

*1️⃣ SUDAH COBA, MASIH MATI*
   Sudah restart modem tapi tetap tidak ada internet

*2️⃣ BELUM COBA RESTART*
   Belum sempat restart modem

*3️⃣ SUDAH NORMAL KEMBALI*
   Sudah restart dan internet kembali normal

━━━━━━━━━━━━━━━━
Balas dengan angka pilihan Anda (1/2/3)`
            };
        }
        
        // Device is ONLINE - continue with normal LEMOT flow
        // Get estimation for MEDIUM priority
        const estimasiLemot = getResponseTimeMessage('MEDIUM');
        
        // Initialize or get state
        let state = getUserState(sender) || {};
        state.step = 'TROUBLESHOOT_LEMOT';
        state.issueType = 'LEMOT';
        state.deviceStatus = deviceStatus;
        state.userData = user;
        state.estimatedTime = estimasiLemot;
        setUserState(sender, state);
        
        return {
            success: true,
            message: `🐌 *TROUBLESHOOTING INTERNET LEMOT*

📊 Status Device: *ONLINE* ✅
⚠️ Prioritas jika buat tiket: *MEDIUM*
⏰ Estimasi penanganan: *${estimasiLemot}*

Sebelum membuat laporan, mari coba langkah berikut:

*1. RESTART MODEM/ROUTER*
   • Cabut kabel power 10 detik
   • Pasang kembali & tunggu 2 menit

*2. CEK PENGGUNAAN*
   • Pastikan tidak ada download besar
   • Cek tidak ada streaming berlebih

*3. CEK FISIK*
   • Pastikan kabel LAN tidak longgar
   • Cek lampu indikator normal

━━━━━━━━━━━━━━━━
*Apakah masalah sudah teratasi?*

Balas:
• *SUDAH* - Masalah solved ✅
• *BELUM* - Buat laporan 📝`
        };
        
    } catch (error) {
        console.error('[HANDLE_LEMOT_ERROR]', error);
        deleteUserState(sender);
        return {
            success: false,
            message: '❌ Terjadi kesalahan. Silakan coba lagi.'
        };
    }
}

/**
 * Handle troubleshoot result
 */
async function handleTroubleshootResult({ sender, response, reply }) {
    const state = getUserState(sender);
    if (!state || state.step !== 'TROUBLESHOOT_LEMOT') {
        return { success: false };
    }
    
    const answer = response.toLowerCase().trim();
    
    if (answer.includes('sudah') || answer.includes('solved') || answer.includes('teratasi')) {
        deleteUserState(sender);
        return {
            success: true,
            message: `✅ *PROBLEM SOLVED!*

Senang mendengar masalah Anda teratasi! 🎉

💡 *Tips Koneksi Stabil:*
• Restart router berkala (1x seminggu)
• Hindari overload saat jam sibuk
• Jaga ventilasi router tetap baik
• Update firmware jika tersedia

Jika masalah muncul lagi, jangan ragu lapor.
Terima kasih! 😊`
        };
    } else if (answer.includes('belum') || answer.includes('tidak')) {
        state.troubleshootingDone = true;
        state.step = 'CREATE_REPORT_LEMOT';
        setUserState(sender, state);
        
        return await createReportTicket({ sender, state, reply });
    } else {
        return {
            success: false,
            message: `⚠️ Mohon balas dengan:
• *SUDAH* jika teratasi
• *BELUM* jika masih bermasalah`
        };
    }
}

/**
 * Handle confirmation for MATI report
 */
async function handleMatiConfirmation({ sender, response, reply }) {
    const state = getUserState(sender);
    if (!state || state.step !== 'CONFIRM_MATI_REPORT') {
        return { success: false };
    }
    
    const answer = response.toLowerCase().trim();
    
    if (answer === 'ya' || answer === 'y' || answer === 'yes' || answer.includes('lanjut')) {
        return await createReportTicket({ sender, state, reply });
    } else if (answer === 'tidak' || answer === 'no' || answer === 'n' || answer.includes('batal')) {
        deleteUserState(sender);
        return {
            success: true,
            message: '❌ Pembuatan laporan dibatalkan.\n\nJika butuh bantuan, ketik *lapor* kapan saja.'
        };
    } else {
        return {
            success: false,
            message: `⚠️ Mohon balas dengan *YA* atau *TIDAK*`
        };
    }
}

/**
 * Handle MATI Troubleshooting Options (1/2/3)
 */
async function handleMatiTroubleshootOptions({ sender, response, reply }) {
    const state = getUserState(sender);
    if (!state || state.step !== 'MATI_TROUBLESHOOT_OPTIONS') {
        return { success: false };
    }
    
    const choice = response.trim();
    
    if (choice === '1') {
        // Sudah coba restart, masih mati - Ask for photo first
        // IMPORTANT: Preserve all existing state data
        const updatedState = {
            ...state,  // Keep all existing data (deviceStatus, lastOnlineText, etc)
            step: 'MATI_AWAITING_PHOTO',
            troubleshootingDone: true,
            troubleshootingResult: 'failed'
        };
        setUserState(sender, updatedState);
        
        return {
            success: true,
            message: `📸 *UPLOAD BUKTI FOTO (Opsional)*\n\n` +
                    `Untuk mempercepat penanganan teknisi, silakan kirim foto:\n\n` +
                    `📷 *Yang bisa difoto:*\n` +
                    `• Lampu indikator modem/router\n` +
                    `• Kabel yang terpasang\n` +
                    `• Pesan error di layar (jika ada)\n` +
                    `• Kondisi perangkat\n\n` +
                    `━━━━━━━━━━━━━━━━\n` +
                    `✅ *Kirim foto* untuk melampirkan\n` +
                    `⏩ Ketik *SKIP* untuk lewati\n\n` +
                    `_Foto sangat membantu teknisi mendiagnosa masalah_`
        };
        
    } else if (choice === '2') {
        // Belum coba restart - Guide untuk restart
        deleteUserState(sender);
        
        return {
            success: true,
            message: `🔧 *PANDUAN RESTART MODEM*\n\n` +
                    `Silakan ikuti langkah berikut:\n\n` +
                    `1️⃣ *CABUT POWER MODEM*\n` +
                    `   Cabut kabel power dari modem\n\n` +
                    `2️⃣ *TUNGGU 10-30 DETIK*\n` +
                    `   Biarkan modem mati total\n\n` +
                    `3️⃣ *PASANG KEMBALI*\n` +
                    `   Colokkan kembali kabel power\n\n` +
                    `4️⃣ *TUNGGU 2-3 MENIT*\n` +
                    `   Modem akan restart otomatis\n\n` +
                    `5️⃣ *CEK KONEKSI*\n` +
                    `   Test internet di perangkat\n\n` +
                    `━━━━━━━━━━━━━━━━\n` +
                    `Setelah restart:\n` +
                    `• Jika *BERHASIL* - Selamat! 🎉\n` +
                    `• Jika *MASIH MATI* - Ketik *lapor* untuk buat tiket\n\n` +
                    `💡 Tips: Restart rutin 1x/minggu untuk performa optimal`
        };
        
    } else if (choice === '3') {
        // Sudah normal kembali
        deleteUserState(sender);
        
        return {
            success: true,
            message: `✅ *GREAT! MASALAH TERATASI*\n\n` +
                    `Senang mendengar internet Anda sudah normal kembali! 🎉\n\n` +
                    `💡 *TIPS MENJAGA KONEKSI STABIL:*\n\n` +
                    `1️⃣ *Restart Rutin*\n` +
                    `   Restart modem 1x seminggu\n\n` +
                    `2️⃣ *Posisi Modem*\n` +
                    `   Letakkan di tempat terbuka & sejuk\n\n` +
                    `3️⃣ *Hindari Overload*\n` +
                    `   Batasi device yang terhubung\n\n` +
                    `4️⃣ *Update Firmware*\n` +
                    `   Perbarui jika ada notifikasi\n\n` +
                    `Terima kasih telah menggunakan layanan kami! 🙏\n\n` +
                    `Jika ada masalah lagi, ketik *lapor* kapan saja.`
        };
        
    } else {
        return {
            success: false,
            message: `⚠️ Pilihan tidak valid.\n\n` +
                    `Silakan balas dengan:\n` +
                    `• *1* - Sudah coba, masih mati\n` +
                    `• *2* - Belum coba restart\n` +
                    `• *3* - Sudah normal kembali`
        };
    }
}

/**
 * Handle Photo Upload for MATI Report
 */
async function handleMatiPhotoUpload({ sender, response, photoPath, photoBuffer, reply }) {
    const state = getUserState(sender);
    if (!state || state.step !== 'MATI_AWAITING_PHOTO') {
        return { success: false };
    }
    
    // Handle text response (SKIP)
    if (response && response.toLowerCase().trim() === 'skip') {
        console.log('[PHOTO_UPLOAD] User skipped photo upload');
        state.photoSkipped = true;
        
        // Create ticket without photo
        const ticketResult = await createReportTicket({ sender, state, reply });
        
        return {
            success: true,
            message: `⏩ Upload foto dilewati.\n\n` + ticketResult.message
        };
    }
    
    // Handle photo upload
    if (photoPath) {
        console.log('[PHOTO_UPLOAD] Photo received:', photoPath);
        
        // Save photo info in state (path and buffer)
        if (!state.uploadedPhotos) {
            state.uploadedPhotos = [];
        }
        // Store both filename and buffer for later sending
        state.uploadedPhotos.push({
            fileName: photoPath,
            buffer: photoBuffer  // Store buffer for sending to teknisi
        });
        
        // Check if user wants to add more photos (max 3)
        if (state.uploadedPhotos.length < 3) {
            // Update state and ask if want to add more
            // IMPORTANT: Use spread operator to preserve all existing state
            setUserState(sender, { ...state });
            
            return {
                success: true,
                message: `✅ Foto ${state.uploadedPhotos.length} berhasil diterima!\n\n` +
                        `📸 Anda bisa kirim foto lagi (maks 3 foto)\n` +
                        `⏩ Atau ketik *LANJUT* untuk buat laporan`
            };
        } else {
            // Max photos reached, create ticket
            const ticketResult = await createReportTicket({ sender, state, reply });
            
            return {
                success: true,
                message: `✅ 3 foto berhasil diterima (maksimal).\n\n` + ticketResult.message
            };
        }
    }
    
    // Handle "LANJUT" command after uploading photos
    if (response && response.toLowerCase().trim() === 'lanjut' && state.uploadedPhotos && state.uploadedPhotos.length > 0) {
        const ticketResult = await createReportTicket({ sender, state, reply });
        
        return {
            success: true,
            message: `✅ ${state.uploadedPhotos.length} foto berhasil dilampirkan.\n\n` + ticketResult.message
        };
    }
    
    return {
        success: false,
        message: `⚠️ Silakan:\n• Kirim foto gangguan\n• Ketik *SKIP* untuk lewati\n• Ketik *LANJUT* jika sudah kirim foto`
    };
}

/**
 * Create report ticket
 */
async function createReportTicket({ sender, state, reply }) {
    try {
        const user = state.userData;
        const ticketId = generateTicketId();
        const now = new Date();
        
        // Determine priority
        const issueType = state.issueType || 'LEMOT';
        const priority = issueType === 'MATI' ? 'HIGH' : 'MEDIUM';
        
        let laporanText = issueType === 'MATI' ? 
            'Internet mati total - Device OFFLINE' : 
            'Internet lambat/lemot';
            
        // Use lastOnlineText from state instead of deviceStatus
        if (state.lastOnlineText && state.lastOnlineText !== 'Tidak diketahui') {
            laporanText += `\nTerakhir online: ${state.lastOnlineText}`;
        } else if (state.deviceStatus && state.deviceStatus.minutesAgo) {
            laporanText += `\nTerakhir online: ${state.deviceStatus.minutesAgo} menit yang lalu`;
        }
        
        if (state.troubleshootingDone) {
            laporanText += '\nTroubleshooting sudah dilakukan.';
        }

        // Create report
        const newReport = {
            ticketId: ticketId,
            pelangganUserId: user.id,
            pelangganId: sender,
            pelangganName: user.full_name || user.username || 'Customer',
            pelangganPhone: user.phone_number || '',
            pelangganAddress: user.address || '',
            pelangganSubscription: user.subscription || 'Tidak terinfo',  // Add subscription/paket info
            laporanText: laporanText,
            status: 'pending',
            priority: priority,
            createdAt: now.toISOString(),
            deviceOnline: state.deviceStatus?.online !== false,
            issueType: issueType,
            troubleshootingDone: state.troubleshootingDone || false,
            // Extract just filenames for storage, keep buffers in state
            photos: state.uploadedPhotos ? state.uploadedPhotos.map(p => p.fileName || p) : [],
            photoCount: state.uploadedPhotos ? state.uploadedPhotos.length : 0,
            // Keep photo buffers temporarily for sending
            photoBuffers: state.uploadedPhotos ? state.uploadedPhotos.filter(p => p.buffer).map(p => p.buffer) : []
        };

        // Add to reports
        global.reports.push(newReport);

        // Save to file (remove photoBuffers before saving to avoid large database)
        const reportsPath = path.join(__dirname, '../../database/reports.json');
        const reportsToSave = global.reports.map(r => {
            const { photoBuffers, ...reportWithoutBuffers } = r;
            return reportWithoutBuffers;
        });
        fs.writeFileSync(reportsPath, JSON.stringify(reportsToSave, null, 2));

        // Get response time
        const estimasi = getResponseTimeMessage(priority);

        // Clear state
        deleteUserState(sender);

        // Notify technicians (this will use photoBuffers from memory before they're cleared)
        await notifyTechnicians(newReport);
        
        // Clear photoBuffers from memory after sending to save RAM
        delete newReport.photoBuffers;

        // Build success message
        let successMsg = `✅ *LAPORAN BERHASIL DIBUAT*

━━━━━━━━━━━━━━━━
📋 *ID TIKET:* ${ticketId}
━━━━━━━━━━━━━━━━

⚡ *Prioritas:* ${priority === 'HIGH' ? '🔴 URGENT' : '🟡 NORMAL'}
⏱️ *Estimasi:* ${estimasi}
📍 *Status:* Pending`;

        // Add photo status
        if (newReport.photoCount > 0) {
            successMsg += `\n📸 *Foto:* ${newReport.photoCount} foto dilampirkan`;
        } else {
            successMsg += `\n📸 *Foto:* Tidak ada`;
        }

        successMsg += `\n\n*Apa Selanjutnya:*
1. Tim teknisi akan segera menangani
2. Anda akan dapat notifikasi update
3. Cek status: *cektiket ${ticketId}*

Terima kasih telah melapor! 🙏`;

        return { 
            success: true,
            message: successMsg
        };
        
    } catch (error) {
        console.error('[CREATE_REPORT_ERROR]', error);
        deleteUserState(sender);
        return {
            success: false,
            message: '❌ Gagal membuat laporan. Silakan coba lagi.'
        };
    }
}

/**
 * Notify technicians with delay to prevent spam
 */
async function notifyTechnicians(report) {
    const teknisiAccounts = global.accounts.filter(acc => acc.role === 'teknisi');
    
    for (let i = 0; i < teknisiAccounts.length; i++) {
        const teknisi = teknisiAccounts[i];
        if (!teknisi.phone_number) continue;
        
        // Add delay between notifications to prevent spam (2 seconds between each)
        if (i > 0) {
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
        const teknisiJid = teknisi.phone_number.includes('@') ? 
            teknisi.phone_number : 
            `${teknisi.phone_number}@s.whatsapp.net`;

        let message = `🚨 *TIKET BARU - ${report.priority === 'HIGH' ? 'URGENT!' : 'Normal'}*

━━━━━━━━━━━━━━━━
📋 ID: *${report.ticketId}*
👤 Pelanggan: ${report.pelangganName}
📱 No: ${report.pelangganPhone}
📍 Alamat: ${report.pelangganAddress || 'Tidak ada'}
━━━━━━━━━━━━━━━━

*Masalah:* ${report.laporanText}
*Device:* ${report.deviceOnline ? '🟢 Online' : '🔴 Offline'}
*Troubleshoot:* ${report.troubleshootingDone ? '✅ Sudah' : '❌ Belum'}`;

        // Add photo info if available with actual photos
        if (report.photoCount > 0) {
            message += `\n*Foto Pelanggan:* 📸 ${report.photoCount} foto tersedia`;
            
            // Send text message first
            await global.raf.sendMessage(teknisiJid, { text: message });
            
            // Send photos if available using buffers or file paths
            if (report.photoBuffers && report.photoBuffers.length > 0) {
                // Send each photo using buffer
                for (let j = 0; j < report.photoBuffers.length; j++) {
                    await global.raf.sendMessage(teknisiJid, {
                        image: report.photoBuffers[j],
                        caption: `📸 Foto ${j + 1} dari ${report.photoCount} - Tiket ${report.ticketId}\nDari: ${report.pelangganName}`
                    });
                    // Small delay between photos
                    if (j < report.photoBuffers.length - 1) {
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    }
                }
            } else if (report.photos && report.photos.length > 0) {
                // Fallback: try to read from disk if buffers not available
                for (let j = 0; j < report.photos.length; j++) {
                    const photoPath = path.join(__dirname, '../../uploads', report.photos[j]);
                    if (fs.existsSync(photoPath)) {
                        await global.raf.sendMessage(teknisiJid, {
                            image: { url: photoPath },
                            caption: `📸 Foto ${j + 1} dari ${report.photoCount} - Tiket ${report.ticketId}`
                        });
                        if (j < report.photos.length - 1) {
                            await new Promise(resolve => setTimeout(resolve, 1000));
                        }
                    }
                }
            }
            
            // Send action message after photos
            const actionMessage = `\n*AKSI YANG TERSEDIA:*
━━━━━━━━━━━━━━━━
1️⃣ Untuk memproses tiket:
   Ketik: *proses ${report.ticketId}*
   
2️⃣ Setelah proses, mulai perjalanan:
   Ketik: *otw ${report.ticketId}*
   
3️⃣ Saat sampai lokasi:
   Ketik: *sampai ${report.ticketId}*
   
━━━━━━━━━━━━━━━━
⚠️ *PENTING:* Minta kode OTP ke pelanggan saat tiba di lokasi`;
            
            await global.raf.sendMessage(teknisiJid, { text: actionMessage });
        } else {
            message += `\n*Foto:* ❌ Tidak ada`;
            message += `\n\n*AKSI YANG TERSEDIA:*
━━━━━━━━━━━━━━━━
1️⃣ Untuk memproses tiket:
   Ketik: *proses ${report.ticketId}*
   
2️⃣ Setelah proses, mulai perjalanan:
   Ketik: *otw ${report.ticketId}*
   
3️⃣ Saat sampai lokasi:
   Ketik: *sampai ${report.ticketId}*
   
━━━━━━━━━━━━━━━━
⚠️ *PENTING:* Minta kode OTP ke pelanggan saat tiba di lokasi`;
            
            // Send message without photos
            await global.raf.sendMessage(teknisiJid, { text: message });
        }
    }
}

module.exports = {
    startReportFlow,
    handleMenuSelection,
    handleInternetMati,
    handleInternetLemot,
    handleTroubleshootResult,
    handleMatiConfirmation,
    handleMatiTroubleshootOptions,
    handleMatiPhotoUpload
};
