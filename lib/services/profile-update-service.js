/**
 * Profile Update Service
 * 
 * Service untuk handle profile update operations (Mikrotik).
 * Digunakan oleh Compensation dan Speed On Demand untuk apply profile changes.
 * 
 * Features:
 * - Update PPPoE profile
 * - Disconnect active session
 * - Reboot router (optional)
 * - Send notifications (optional)
 * - Comprehensive error handling
 * - Batch processing support
 */

const { updatePPPoEProfile, deleteActivePPPoEUser } = require('../mikrotik');
const { rebootRouter } = require('../wifi');
const { renderTemplate, templatesCache } = require('../templating');

class ProfileUpdateService {
    /**
     * Apply profile update untuk single user
     * 
     * @param {Object} user - User object dengan pppoe_username, device_id, phone_number, name
     * @param {string} newProfile - New profile name (Mikrotik profile)
     * @param {Object} options - Options untuk customize behavior
     * @param {boolean} options.rebootRouter - Reboot router setelah update (default: true)
     * @param {boolean} options.disconnectSession - Disconnect session setelah update (default: true)
     * @param {boolean} options.skipOnError - Skip user jika error (default: false)
     * @param {Object} options.notification - Notification config
     * @param {boolean} options.notification.enabled - Enable notification (default: false)
     * @param {string} options.notification.template - Template name (optional)
     * @param {Object} options.notification.data - Template data (optional)
     * @param {string} options.notification.message - Custom message (optional, jika tidak pakai template)
     * @param {string} options.context - Context untuk logging (default: 'PROFILE_UPDATE')
     * @returns {Promise<Object>} Result object dengan success, details, warnings, errors
     */
    static async applyProfileUpdate(user, newProfile, options = {}) {
        const {
            rebootRouter: shouldReboot = true,
            disconnectSession: shouldDisconnect = true,
            skipOnError = false,
            notification = {},
            context = 'PROFILE_UPDATE'
        } = options;

        const result = {
            success: false,
            details: [],
            warnings: [],
            errors: []
        };

        // Validate input
        if (!user) {
            result.errors.push('User object tidak ditemukan.');
            return result;
        }

        // Jika newProfile null/undefined, hanya kirim notification (untuk reject case)
        if (!newProfile) {
            // Hanya kirim notification jika enabled, tidak ada profile update
            if (notification.enabled && global.raf && user.phone_number && user.phone_number.trim() !== '') {
                try {
                    await this._sendNotification(user, notification);
                    result.details.push('Notifikasi berhasil dikirim.');
                    result.success = true;
                } catch (notifError) {
                    const errMsg = `Gagal mengirim notifikasi: ${notifError.message || notifError}`;
                    console.warn(`[${context}_WARN] [User: ${user.name || user.pppoe_username}] ${errMsg}`);
                    result.warnings.push(errMsg);
                }
            }
            return result;
        }

        if (!user.pppoe_username) {
            result.errors.push(`User ${user.name || user.id} tidak memiliki username PPPoE.`);
            return result;
        }

        try {
            // 1. Update PPPoE profile
            console.log(`[${context}] Updating profile untuk ${user.pppoe_username} ke ${newProfile}`);
            await updatePPPoEProfile(user.pppoe_username, newProfile);
            result.details.push(`Profil PPPoE berhasil diubah ke ${newProfile}.`);
            result.success = true;

            // 2. Disconnect active session (if enabled)
            if (shouldDisconnect) {
                try {
                    await deleteActivePPPoEUser(user.pppoe_username);
                    result.details.push(`Sesi aktif PPPoE berhasil dihapus.`);
                } catch (disconnectError) {
                    const errMsg = `Gagal menghapus sesi aktif PPPoE: ${disconnectError.message || disconnectError}`;
                    console.warn(`[${context}_WARN] [User: ${user.name || user.pppoe_username}] ${errMsg}`);
                    result.warnings.push(errMsg);
                }
            }

            // 3. Reboot router (if enabled and device_id exists)
            if (shouldReboot && user.device_id) {
                try {
                    await rebootRouter(user.device_id);
                    result.details.push(`Perintah reboot untuk router ${user.device_id} berhasil dikirim.`);
                } catch (rebootError) {
                    const errMsg = `Gagal me-reboot router ${user.device_id}: ${rebootError.message || rebootError}`;
                    console.warn(`[${context}_WARN] [User: ${user.name || user.pppoe_username}] ${errMsg}`);
                    result.warnings.push(errMsg);
                }
            } else if (shouldReboot && !user.device_id) {
                result.details.push(`Reboot router dilewati (tidak ada Device ID).`);
            }

            // 4. Send notification (if enabled)
            if (notification.enabled && global.raf && user.phone_number && user.phone_number.trim() !== '') {
                try {
                    await this._sendNotification(user, notification);
                    result.details.push(`Notifikasi berhasil dikirim.`);
                } catch (notifError) {
                    const errMsg = `Gagal mengirim notifikasi: ${notifError.message || notifError}`;
                    console.warn(`[${context}_WARN] [User: ${user.name || user.pppoe_username}] ${errMsg}`);
                    result.warnings.push(errMsg);
                }
            }

        } catch (mikrotikError) {
            const errMsg = `Gagal mengubah profil Mikrotik: ${mikrotikError.message || mikrotikError}`;
            console.error(`[${context}_ERROR] [User: ${user.name || user.pppoe_username}] ${errMsg}`);
            result.errors.push(errMsg);
            result.success = false;

            if (skipOnError) {
                // Return result dengan error, tidak throw
                return result;
            } else {
                // Throw error untuk single user operations
                throw mikrotikError;
            }
        }

        return result;
    }

    /**
     * Apply profile update untuk multiple users (batch processing)
     * 
     * @param {Array<Object>} users - Array of user objects
     * @param {string} newProfile - New profile name
     * @param {Object} options - Options (same as applyProfileUpdate)
     * @returns {Promise<Array<Object>>} Array of result objects (one per user)
     */
    static async applyProfileUpdateBatch(users, newProfile, options = {}) {
        if (!Array.isArray(users) || users.length === 0) {
            return [];
        }

        // Set skipOnError to true untuk batch processing
        const batchOptions = {
            ...options,
            skipOnError: true
        };

        const results = [];

        for (const user of users) {
            try {
                const result = await this.applyProfileUpdate(user, newProfile, batchOptions);
                results.push({
                    userId: user.id,
                    userName: user.name,
                    pppoeUsername: user.pppoe_username,
                    ...result
                });
            } catch (error) {
                // Should not happen karena skipOnError = true, tapi handle just in case
                results.push({
                    userId: user.id,
                    userName: user.name,
                    pppoeUsername: user.pppoe_username,
                    success: false,
                    details: [],
                    warnings: [],
                    errors: [`Unexpected error: ${error.message || error}`]
                });
            }
        }

        return results;
    }

    /**
     * Send notification to user
     * @private
     * @param {Object} user - User object
     * @param {Object} notification - Notification config
     */
    static async _sendNotification(user, notification) {
        const { delay } = await import('@whiskeysockets/baileys');

        let messageToSend = '';

        // Use template if provided
        if (notification.template && templatesCache.notificationTemplates[notification.template]) {
            messageToSend = renderTemplate(notification.template, notification.data || {});
        } else if (notification.message) {
            // Use custom message
            messageToSend = notification.message;
        } else {
            // Default message
            messageToSend = `Profil Anda telah diupdate.`;
        }

        // Send to all phone numbers
        const phoneNumbers = user.phone_number.split('|');
        for (const number of phoneNumbers) {
            if (!number || number.trim() === '') continue;

            let normalizedNumber = number.trim();
            
            // Normalize phone number
            if (normalizedNumber.startsWith('0')) {
                normalizedNumber = '62' + normalizedNumber.substring(1);
            }
            
            if (!normalizedNumber.endsWith('@s.whatsapp.net')) {
                normalizedNumber += '@s.whatsapp.net';
            }

            if (normalizedNumber.length > 8) {
                try {
                    // Check connection state before sending
                    if (global.whatsappConnectionState === 'open' && global.raf && global.raf.sendMessage) {
                        await delay(1000);
                        await global.raf.sendMessage(normalizedNumber, { text: messageToSend });
                    } else {
                        throw new Error('WhatsApp tidak terhubung, notifikasi tidak dapat dikirim');
                    }
                } catch (msgError) {
                    // Check if it's a WhatsApp connection error
                    const isConnectionError = msgError.message && 
                        (msgError.message.includes('Connection') || 
                         msgError.message.includes('closed') ||
                         msgError.message.includes('ENOTFOUND') ||
                         msgError.message.includes('tidak terhubung'));

                    const errMsg = isConnectionError 
                        ? `WhatsApp tidak terhubung, notifikasi tidak dapat dikirim ke ${normalizedNumber}` 
                        : `GAGAL mengirim notifikasi ke ${normalizedNumber}: ${msgError.message}`;

                    throw new Error(errMsg);
                }
            }
        }
    }
}

module.exports = { ProfileUpdateService };

