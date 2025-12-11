/**
 * Simple Location Handler - Tracking Teknisi Tanpa Kalkulasi Jarak
 * Pelanggan bisa cek posisi teknisi saat ini
 */

const { setUserState, getUserState, deleteUserState } = require('./conversation-handler');
const { sendCustomerNotification } = require('./teknisi-workflow-handler');
const fs = require('fs');
const path = require('path');

// Simple in-memory storage untuk lokasi teknisi
const teknisiLocations = new Map();

/**
 * Teknisi mulai perjalanan dan share lokasi
 */
async function handleMulaiPerjalanan(sender, ticketId, teknisiInfo, reply) {
    try {
        // Validate ticket exists
        const report = global.reports.find(r => r.ticketId === ticketId.toUpperCase());
        
        if (!report) {
            return {
                success: false,
                message: `❌ Tiket *${ticketId}* tidak ditemukan.`
            };
        }
        
        // Check if ticket is being processed by this teknisi (check all possible field names)
        const assignedTeknisi = report.teknisiId || report.processedByTeknisiId || report.processedByTeknisi;
        if (assignedTeknisi && assignedTeknisi !== sender) {
            return {
                success: false,
                message: `❌ Tiket ini bukan ditangani oleh Anda.`
            };
        }
        
        // Get existing state to preserve OTP data
        const existingState = getUserState(sender);
        
        // Update report status to 'otw' and save (SAMA DENGAN handleOTW)
        report.status = 'otw';
        report.otwAt = new Date().toISOString();
        
        // Make sure teknisi fields are set for compatibility
        if (!report.teknisiId) report.teknisiId = sender;
        if (!report.processedByTeknisiId) report.processedByTeknisiId = sender;
        if (!report.processedByTeknisi) report.processedByTeknisi = sender;
        
        // Save updated report to file
        const reportsPath = path.join(__dirname, '../../database/reports.json');
        const reportsToSave = global.reports || [];
        fs.writeFileSync(reportsPath, JSON.stringify(reportsToSave, null, 2));
        
        // Set state untuk menunggu lokasi while preserving OTP data
        setUserState(sender, {
            step: 'AWAITING_LOCATION_FOR_JOURNEY',
            ticketId: ticketId.toUpperCase(),
            reportData: report,
            // Preserve OTP data if exists
            otp: existingState?.otp || report.otp,
            otpCreatedAt: existingState?.otpCreatedAt,
            isProcessing: true // Mark that this ticket is being processed
        });
        
        // Notify customer that teknisi is on the way
        // PENTING: Cek connection state dan gunakan error handling sesuai rules
        if (report.pelangganId && global.whatsappConnectionState === 'open' && global.raf && global.raf.sendMessage) {
            const customerNotif = `🚗 *TEKNISI BERANGKAT*

Teknisi sedang menuju lokasi Anda.

Tiket: *${ticketId.toUpperCase()}*
Teknisi: ${report.processedByTeknisiName}

Anda dapat cek posisi teknisi dengan mengetik:
*lokasi ${ticketId.toUpperCase()}*

Estimasi tiba: 30-60 menit
_Waktu dapat berubah tergantung kondisi lalu lintas_`;
            
            try {
                await global.raf.sendMessage(report.pelangganId, { text: customerNotif });
            } catch (err) {
                console.error('[SEND_MESSAGE_ERROR]', {
                    pelangganId: report.pelangganId,
                    error: err.message
                });
                console.error('[JOURNEY_NOTIF] Failed to notify customer:', err);
            }
            
            // Also notify other registered numbers
            if (report.pelangganPhone) {
                const phones = report.pelangganPhone.split('|').map(p => p.trim()).filter(p => p);
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
                    
                    if (phoneJid === report.pelangganId) continue;
                    
                    // PENTING: Cek connection state untuk setiap recipient
                    if (global.whatsappConnectionState === 'open' && global.raf && global.raf.sendMessage) {
                        try {
                            await global.raf.sendMessage(phoneJid, { text: customerNotif });
                        } catch (err) {
                            console.error('[SEND_MESSAGE_ERROR]', {
                                phoneJid,
                                error: err.message
                            });
                            console.error(`[JOURNEY_NOTIF] Failed to notify ${phoneJid}:`, err);
                            // Continue to next recipient
                        }
                    } else {
                        console.warn('[SEND_MESSAGE_SKIP] WhatsApp not connected, skipping send to', phoneJid);
                    }
                }
            }
        } else {
            console.warn('[SEND_MESSAGE_SKIP] WhatsApp not connected, skipping send to', report.pelangganId);
        }
        
        return {
            success: true,
            message: `🚗 *MULAI PERJALANAN*
            
Tiket: *${ticketId.toUpperCase()}*
Pelanggan: ${report.pelangganName}

✅ Pelanggan telah diberitahu Anda berangkat.

📍 *WAJIB SHARE LOKASI:*

1️⃣ Klik icon 📎 (Attachment)
2️⃣ Pilih 📍 *Location*
3️⃣ Pilih *Share Live Location*
4️⃣ Pilih durasi *1 jam*
5️⃣ Kirim

💡 *PENTING:*
• Pelanggan dapat tracking posisi Anda
• Update otomatis setiap beberapa menit
• Saat tiba, ketik: *sampai ${ticketId.toUpperCase()}*`
        };
        
    } catch (error) {
        console.error('[MULAI_PERJALANAN_ERROR]', error);
        return {
            success: false,
            message: '❌ Terjadi kesalahan. Silakan coba lagi.'
        };
    }
}

/**
 * Handle lokasi dari teknisi
 */
async function handleTeknisiShareLocation(sender, location, reply) {
    try {
        const state = getUserState(sender);
        
        // Check if teknisi is in valid state for location sharing
        const validStates = [
            'AWAITING_LOCATION_FOR_JOURNEY',
            'TICKET_PROCESSING_WITH_LOCATION'
        ];
        
        if (!state || !validStates.includes(state.step)) {
            // Check if teknisi has active ticket with various status
            const activeTicket = global.reports.find(r => 
                (r.processedByTeknisiId === sender || r.teknisiId === sender) && 
                (r.status === 'otw' || r.status === 'arrived' || r.status === 'process' || r.status === 'diproses teknisi' || r.status === 'working')
            );
            
            if (activeTicket) {
                // Auto-update untuk tiket aktif
                console.log(`[LOCATION] Auto-update for active ticket ${activeTicket.ticketId} status ${activeTicket.status}`);
                return updateTeknisiLocation(sender, activeTicket.ticketId, location, activeTicket);
            }
            
            return {
                success: false,
                message: `❌ Anda tidak sedang dalam perjalanan.\n\nGunakan: *mulai perjalanan [ID_TIKET]* terlebih dahulu.`
            };
        }
        
        // Update lokasi teknisi
        const result = await updateTeknisiLocation(sender, state.ticketId, location, state.reportData);
        
        // Update state instead of deleting - preserve OTP data
        if (state.otp) {
            setUserState(sender, {
                ...state,
                step: 'TICKET_PROCESSING_WITH_LOCATION',
                locationShared: true,
                locationSharedAt: Date.now()
            });
        } else {
            // Only delete if no OTP data to preserve
            deleteUserState(sender);
        }
        
        return result;
        
    } catch (error) {
        console.error('[TEKNISI_SHARE_LOCATION_ERROR]', error);
        return {
            success: false,
            message: '❌ Gagal update lokasi.'
        };
    }
}

/**
 * Update lokasi teknisi dan notify pelanggan
 */
async function updateTeknisiLocation(teknisiId, ticketId, location, reportData) {
    try {
        // Validate location data
        if (!location || !location.degreesLatitude || !location.degreesLongitude) {
            console.error('[LOCATION_UPDATE_ERROR] Invalid location data:', location);
            return {
                success: false,
                message: '❌ Data lokasi tidak valid. Pastikan Anda share location dengan benar.'
            };
        }
        
        // Validate coordinates are numbers
        const lat = parseFloat(location.degreesLatitude);
        const lng = parseFloat(location.degreesLongitude);
        
        if (isNaN(lat) || isNaN(lng)) {
            console.error('[LOCATION_UPDATE_ERROR] Invalid coordinates:', { lat, lng });
            return {
                success: false,
                message: '❌ Koordinat lokasi tidak valid.'
            };
        }
        
        // Simpan lokasi teknisi
        const locationData = {
            ticketId: ticketId,
            teknisiId: teknisiId,
            latitude: lat,
            longitude: lng,
            accuracy: location.accuracyInMeters || null,
            timestamp: Date.now(),
            lastUpdate: new Date().toISOString(),
            googleMapsUrl: `https://maps.google.com/?q=${lat},${lng}`
        };
        
        // Store in memory
        teknisiLocations.set(ticketId, locationData);
        
        // Also save to file for persistence
        saveLocationToFile(ticketId, locationData);
        
        // Get teknisi name and OTP
        const teknisiName = reportData.processedByTeknisiName || reportData.teknisiName || 'Teknisi';
        const otp = reportData.otp || 'XXXXXX';
        
        // Notify pelanggan
        if (reportData.pelangganId && global.raf) {
            const customerMessage = `📍 *LOKASI TEKNISI TERBARU*

━━━━━━━━━━━━━━━━
📋 ID Tiket: *${ticketId}*
🔧 Teknisi: *${teknisiName}*
━━━━━━━━━━━━━━━━

Teknisi sedang dalam perjalanan ke lokasi Anda.

📱 *Lihat di Google Maps:*
${locationData.googleMapsUrl}

⏱️ Update: ${new Date().toLocaleTimeString('id-ID')}

🔐 *KODE VERIFIKASI:*
╔════════════════╗
║  *${otp}*  ║
╚════════════════╝

⚠️ *PENTING:*
• Siapkan kode ini untuk teknisi
• Untuk cek lokasi terbaru, ketik:
  *lokasi ${ticketId}*`;

            // Send location notification without duplicates using consistent helper
            await sendCustomerNotification(reportData, customerMessage);
        }
        
        return {
            success: true,
            message: `✅ *LOKASI BERHASIL DIBAGIKAN*

Tiket: *${ticketId}*
Pelanggan: ${reportData.pelangganName}

Pelanggan sudah dinotifikasi dengan link Google Maps.

💡 Jika menggunakan *Live Location*, lokasi akan update otomatis.

Untuk update manual, share lokasi lagi kapan saja.

📍 *NEXT STEP:*
Setelah sampai di lokasi, ketik:
*sampai ${ticketId}*`
        };
        
    } catch (error) {
        console.error('[UPDATE_LOCATION_ERROR]', error);
        throw error;
    }
}

/**
 * Pelanggan cek lokasi teknisi
 */
async function handleCekLokasiTeknisi(sender, ticketId, reply) {
    try {
        // Normalize ticket ID
        ticketId = ticketId.toUpperCase();
        
        // Get location from memory first
        let locationData = teknisiLocations.get(ticketId);
        
        // If not in memory, try to load from file
        if (!locationData) {
            locationData = loadLocationFromFile(ticketId);
            if (locationData) {
                teknisiLocations.set(ticketId, locationData);
            }
        }
        
        if (!locationData) {
            return {
                success: false,
                message: `📍 *LOKASI TEKNISI*

Tiket: *${ticketId}*

❌ Teknisi belum membagikan lokasi.

Teknisi akan share lokasi saat mulai perjalanan ke lokasi Anda.`
            };
        }
        
        // Check if location is recent (less than 2 hours old)
        const ageMinutes = Math.round((Date.now() - locationData.timestamp) / 60000);
        const isRecent = ageMinutes < 120;
        
        // Get teknisi info
        const report = global.reports.find(r => r.ticketId === ticketId);
        const teknisiName = report?.processedByTeknisiName || 'Teknisi';
        
        let message = `📍 *LOKASI TEKNISI*

Tiket: *${ticketId}*
Teknisi: *${teknisiName}*

📱 *Posisi Saat Ini:*
${locationData.googleMapsUrl}

⏱️ Update Terakhir: ${ageMinutes} menit yang lalu
🕐 Jam: ${new Date(locationData.timestamp).toLocaleTimeString('id-ID')}`;

        if (!isRecent) {
            message += `

⚠️ _Lokasi ini mungkin tidak akurat karena sudah lama tidak diupdate._`;
        } else if (ageMinutes < 5) {
            message += `

✅ _Lokasi baru saja diupdate._`;
        }
        
        // Add tip for refresh
        message += `

💡 Untuk cek lokasi terbaru, ketik:
*lokasi ${ticketId}*`;
        
        return {
            success: true,
            message: message
        };
        
    } catch (error) {
        console.error('[CEK_LOKASI_ERROR]', error);
        return {
            success: false,
            message: '❌ Terjadi kesalahan saat mengambil lokasi.'
        };
    }
}

/**
 * Helper: Format phone to WhatsApp JID
 */
function formatPhoneToJid(phone) {
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
 * Save location to file for persistence
 */
function saveLocationToFile(ticketId, locationData) {
    try {
        const locationsDir = path.join(__dirname, '../../database/locations');
        if (!fs.existsSync(locationsDir)) {
            fs.mkdirSync(locationsDir, { recursive: true });
        }
        
        const filePath = path.join(locationsDir, `${ticketId}.json`);
        fs.writeFileSync(filePath, JSON.stringify(locationData, null, 2));
    } catch (error) {
        console.error('Error saving location to file:', error);
    }
}

/**
 * Load location from file
 */
function loadLocationFromFile(ticketId) {
    try {
        const filePath = path.join(__dirname, '../../database/locations', `${ticketId}.json`);
        if (fs.existsSync(filePath)) {
            return JSON.parse(fs.readFileSync(filePath, 'utf8'));
        }
    } catch (error) {
        console.error('Error loading location from file:', error);
    }
    return null;
}

/**
 * Pelanggan cek semua tiket aktif
 */
async function handleTiketSaya(sender, reply) {
    try {
        // Find active tickets for this customer
        const myTickets = global.reports.filter(r => 
            r.pelangganId === sender && 
            (r.status === 'baru' || r.status === 'diproses teknisi')
        );
        
        if (myTickets.length === 0) {
            return {
                success: true,
                message: `📋 *TIKET ANDA*

Anda tidak memiliki tiket aktif saat ini.

Untuk membuat laporan baru, ketik:
*lapor*`
            };
        }
        
        let message = `📋 *TIKET AKTIF ANDA*\n\n`;
        
        for (const ticket of myTickets) {
            const hasLocation = teknisiLocations.has(ticket.ticketId) || 
                               loadLocationFromFile(ticket.ticketId);
            
            message += `🎫 Tiket: *${ticket.ticketId}*\n`;
            message += `📊 Status: ${ticket.status}\n`;
            
            if (ticket.processedByTeknisiName) {
                message += `👷 Teknisi: ${ticket.processedByTeknisiName}\n`;
            }
            
            if (ticket.status === 'diproses teknisi') {
                if (hasLocation) {
                    message += `📍 Lokasi: *Tersedia* (ketik: lokasi ${ticket.ticketId})\n`;
                } else {
                    message += `📍 Lokasi: Belum tersedia\n`;
                }
            }
            
            message += `\n`;
        }
        
        return {
            success: true,
            message: message
        };
        
    } catch (error) {
        console.error('[TIKET_SAYA_ERROR]', error);
        return {
            success: false,
            message: '❌ Gagal mengambil data tiket.'
        };
    }
}

module.exports = {
    handleMulaiPerjalanan,
    handleTeknisiShareLocation,
    handleCekLokasiTeknisi,
    handleTiketSaya
};
