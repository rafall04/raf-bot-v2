/**
 * Tracking Handler for WhatsApp Bot
 * Handle tracking commands from teknisi and customers
 */

const SimpleTrackingService = require('../../lib/simple-tracking');
const { setUserState, getUserState, deleteUserState } = require('./conversation-handler');

const trackingService = new SimpleTrackingService();

/**
 * Handle tracking request from customer
 */
async function handleTrackingRequest(sender, ticketId, reply) {
    try {
        // Get current tracking info
        const tracking = trackingService.getTracking(ticketId);
        
        if (!tracking) {
            return {
                success: false,
                message: `📍 *TRACKING TIKET ${ticketId}*\n\n❌ Belum ada update lokasi dari teknisi.\n\nTeknisi akan share lokasi saat dalam perjalanan.`
            };
        }

        // Check if tracking is still active
        if (!trackingService.isTrackingActive(ticketId)) {
            return {
                success: false,
                message: `📍 *TRACKING TIKET ${ticketId}*\n\n⚠️ Update lokasi terakhir lebih dari 30 menit yang lalu.\n\nSilakan hubungi teknisi untuk update terbaru.`
            };
        }

        // Format and send tracking message
        const message = trackingService.formatTrackingMessage(tracking);
        
        return {
            success: true,
            message: message
        };
    } catch (error) {
        console.error('[TRACKING_ERROR]', error);
        return {
            success: false,
            message: '❌ Terjadi kesalahan saat mengambil data tracking.'
        };
    }
}

/**
 * Handle location update from teknisi
 */
async function handleTeknisiLocationUpdate(sender, message, reply) {
    try {
        // Check if message contains location
        if (!message.location) {
            return {
                success: false,
                message: '❌ Pesan tidak mengandung lokasi. Silakan share lokasi Anda.'
            };
        }

        // Get teknisi's active ticket
        const state = getUserState(sender);
        
        if (!state || !state.ticketId) {
            // Ask for ticket ID
            setUserState(sender, {
                step: 'TRACKING_AWAITING_TICKET_ID',
                location: message.location
            });
            
            return {
                success: true,
                message: '📍 Lokasi diterima. Silakan masukkan ID tiket yang sedang Anda kerjakan:'
            };
        }

        // Update location
        const tracking = await trackingService.updateLocation(
            sender,
            state.ticketId,
            message.location
        );

        // Get ticket info for customer notification
        const reports = require('../../database/reports.json');
        const report = reports.find(r => r.ticketId === state.ticketId);
        
        if (report && report.pelangganId) {
            // Notify customer
            const customerMessage = `📍 *UPDATE LOKASI TEKNISI*

Teknisi sedang dalam perjalanan ke lokasi Anda.

${tracking.distanceKm ? `📏 Jarak: ${tracking.distanceKm.toFixed(1)} km` : ''}
${tracking.etaMinutes ? `⏱️ Estimasi Tiba: ${tracking.etaMinutes} menit` : ''}

Untuk tracking real-time, ketik:
*tracking ${state.ticketId}*

_Update: ${new Date().toLocaleTimeString('id-ID')}_`;

            // Send to customer (implement this based on your WhatsApp integration)
            if (global.raf) {
                await global.raf.sendMessage(report.pelangganId, { text: customerMessage });
            }
        }

        deleteUserState(sender);
        
        return {
            success: true,
            message: `✅ *Lokasi Berhasil Diupdate*

Tiket: ${state.ticketId}
${tracking.distanceKm ? `Jarak ke pelanggan: ${tracking.distanceKm.toFixed(1)} km` : ''}
${tracking.etaMinutes ? `Estimasi tiba: ${tracking.etaMinutes} menit` : ''}

Pelanggan sudah dinotifikasi.

💡 Tips: Share *Live Location* (1 jam) untuk update otomatis.`
        };
        
    } catch (error) {
        console.error('[TEKNISI_LOCATION_UPDATE_ERROR]', error);
        return {
            success: false,
            message: '❌ Gagal update lokasi. Silakan coba lagi.'
        };
    }
}

/**
 * Handle teknisi starting journey
 */
async function handleTeknisiStartJourney(sender, ticketId, reply) {
    try {
        // Set state for location sharing
        setUserState(sender, {
            step: 'TRACKING_JOURNEY_STARTED',
            ticketId: ticketId,
            startTime: Date.now()
        });

        return {
            success: true,
            message: `🚗 *PERJALANAN DIMULAI*

Tiket: ${ticketId}

Silakan bagikan lokasi Anda:

📍 *Cara Share Lokasi:*
1. Klik icon 📎 (Attachment)
2. Pilih 📍 Location
3. Pilih *Share Live Location*
4. Pilih durasi *1 jam*
5. Kirim

Pelanggan akan dapat tracking real-time posisi Anda.`
        };
        
    } catch (error) {
        console.error('[START_JOURNEY_ERROR]', error);
        return {
            success: false,
            message: '❌ Gagal memulai tracking. Silakan coba lagi.'
        };
    }
}

/**
 * Handle customer checking all their tickets
 */
async function handleMyTickets(sender, reply) {
    try {
        const reports = require('../../database/reports.json');
        
        // Find all tickets for this customer
        const myTickets = reports.filter(r => 
            r.pelangganId === sender && 
            (r.status === 'baru' || r.status === 'diproses teknisi')
        );

        if (myTickets.length === 0) {
            return {
                success: true,
                message: '📋 Anda tidak memiliki tiket aktif saat ini.'
            };
        }

        let message = `📋 *TIKET AKTIF ANDA*\n\n`;
        
        for (const ticket of myTickets) {
            const tracking = trackingService.getTracking(ticket.ticketId);
            const hasTracking = tracking && trackingService.isTrackingActive(ticket.ticketId);
            
            message += `🎫 *ID: ${ticket.ticketId}*\n`;
            message += `📊 Status: ${ticket.status}\n`;
            
            if (ticket.processedByTeknisiName) {
                message += `👷 Teknisi: ${ticket.processedByTeknisiName}\n`;
            }
            
            if (hasTracking) {
                message += `📍 Tracking: Tersedia\n`;
                message += `⏱️ ETA: ${tracking.etaMinutes || 'N/A'} menit\n`;
            } else {
                message += `📍 Tracking: Belum tersedia\n`;
            }
            
            message += `\nKetik *tracking ${ticket.ticketId}* untuk detail\n`;
            message += `───────────────\n`;
        }

        return {
            success: true,
            message: message
        };
        
    } catch (error) {
        console.error('[MY_TICKETS_ERROR]', error);
        return {
            success: false,
            message: '❌ Gagal mengambil data tiket.'
        };
    }
}

/**
 * Process ticket ID input after location received
 */
async function processTicketIdForTracking(sender, ticketId, reply) {
    const state = getUserState(sender);
    
    if (!state || state.step !== 'TRACKING_AWAITING_TICKET_ID') {
        return {
            success: false,
            message: '❌ Sesi expired. Silakan share lokasi lagi.'
        };
    }

    // Update state with ticket ID
    state.ticketId = ticketId.toUpperCase();
    setUserState(sender, state);

    // Now process the location update
    return handleTeknisiLocationUpdate(sender, { location: state.location }, reply);
}

module.exports = {
    handleTrackingRequest,
    handleTeknisiLocationUpdate,
    handleTeknisiStartJourney,
    handleMyTickets,
    processTicketIdForTracking
};
