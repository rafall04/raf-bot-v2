/**
 * Fast WhatsApp Sender
 * Similar to broadcast approach - simple and direct
 */

// Simple delay function instead of importing from baileys
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Send WhatsApp message with minimal overhead
 * @param {Object} raf - WhatsApp connection
 * @param {string} phoneJid - Phone JID
 * @param {string} message - Message text
 * @returns {Object} Result
 */
async function fastSend(raf, phoneJid, message) {
    console.log(`[FAST_SEND] Attempting to send to ${phoneJid}`);
    console.log(`[FAST_SEND] WhatsApp state: ${global.whatsappConnectionState}`);
    console.log(`[FAST_SEND] RAF exists: ${!!raf}`);
    
    if (!raf || global.whatsappConnectionState !== 'open') {
        console.error('[FAST_SEND] WhatsApp not connected or not open');
        return { success: false, error: 'WhatsApp not connected' };
    }

    try {
        await raf.sendMessage(phoneJid, { text: message });
        console.log(`[FAST_SEND] Successfully sent to ${phoneJid}`);
        return { success: true, phoneJid };
    } catch (error) {
        console.error(`[FAST_SEND] Failed to send to ${phoneJid}:`, error.message);
        return { success: false, phoneJid, error: error.message };
    }
}

/**
 * Send to multiple recipients with minimal delay (like broadcast)
 * @param {Object} raf - WhatsApp connection
 * @param {Array} phoneNumbers - Array of phone numbers
 * @param {string} message - Message text
 * @param {number} delayMs - Delay between messages in ms (default: 500)
 * @returns {Object} Results
 */
async function fastSendMultiple(raf, phoneNumbers, message, delayMs = 500) {
    if (!raf || global.whatsappConnectionState !== 'open') {
        console.error('[FAST_SEND_MULTIPLE] WhatsApp not connected');
        return { success: false, error: 'WhatsApp not connected', results: [] };
    }

    const results = [];
    
    for (let i = 0; i < phoneNumbers.length; i++) {
        const phone = phoneNumbers[i];
        const phoneJid = formatPhoneJid(phone);
        
        if (!phoneJid) {
            results.push({ success: false, phone, error: 'Invalid phone number' });
            continue;
        }
        
        try {
            await raf.sendMessage(phoneJid, { text: message });
            results.push({ success: true, phoneJid });
            console.log(`[FAST_SEND_MULTIPLE] Sent to ${phoneJid} (${i + 1}/${phoneNumbers.length})`);
            
            // Small delay between messages to avoid rate limiting (like broadcast)
            if (i < phoneNumbers.length - 1) {
                await delay(delayMs);
            }
        } catch (error) {
            console.error(`[FAST_SEND_MULTIPLE] Failed to send to ${phoneJid}:`, error.message);
            results.push({ success: false, phoneJid, error: error.message });
        }
    }
    
    const successCount = results.filter(r => r.success).length;
    console.log(`[FAST_SEND_MULTIPLE] Sent to ${successCount}/${phoneNumbers.length} recipients`);
    
    return {
        success: successCount > 0,
        successCount,
        totalCount: phoneNumbers.length,
        results
    };
}

/**
 * Format phone number to WhatsApp JID
 */
function formatPhoneJid(phone) {
    if (!phone) return null;
    
    phone = phone.toString().trim();
    
    // Already formatted
    if (phone.endsWith('@s.whatsapp.net')) {
        return phone;
    }
    
    // Remove non-numeric
    phone = phone.replace(/[^0-9]/g, '');
    
    // Convert to international format
    if (phone.startsWith('0')) {
        phone = '62' + phone.substring(1);
    } else if (!phone.startsWith('62')) {
        phone = '62' + phone;
    }
    
    return phone + '@s.whatsapp.net';
}

/**
 * Send notification for ticket - fast version
 */
async function sendTicketNotification(raf, ticket, message) {
    // Extract phone numbers
    const phoneNumbers = [];
    
    if (ticket.user?.phone_number) {
        const phones = ticket.user.phone_number.split('|').map(p => p.trim()).filter(p => p);
        phoneNumbers.push(...phones);
    }
    
    if (ticket.pelanggan?.phone_number) {
        const phones = ticket.pelanggan.phone_number.split('|').map(p => p.trim()).filter(p => p);
        phoneNumbers.push(...phones);
    }
    
    if (phoneNumbers.length === 0) {
        return { success: false, error: 'No phone numbers found' };
    }
    
    // Remove duplicates
    const uniqueNumbers = [...new Set(phoneNumbers)];
    
    // Send with small delay between messages (like broadcast)
    return await fastSendMultiple(raf, uniqueNumbers, message, 500);
}

module.exports = {
    fastSend,
    fastSendMultiple,
    sendTicketNotification,
    formatPhoneJid
};
