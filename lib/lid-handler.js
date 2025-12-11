/**
 * LID Handler - Handles WhatsApp's new @lid format
 * 
 * WhatsApp is now using @lid (hidden ID) format for some messages,
 * which doesn't provide the actual phone number. This handler provides
 * workarounds to extract or map the real phone number.
 */

const fs = require('fs');
const path = require('path');

// Load/save LID mappings
const mappingsPath = path.join(__dirname, '..', 'database', 'lid-mappings.json');

function loadMappings() {
    try {
        if (fs.existsSync(mappingsPath)) {
            return JSON.parse(fs.readFileSync(mappingsPath, 'utf8'));
        }
    } catch (err) {
        console.error('[LID_HANDLER] Error loading mappings:', err);
    }
    return { mappings: {} };
}

function saveMappings(data) {
    try {
        fs.writeFileSync(mappingsPath, JSON.stringify(data, null, 2));
    } catch (err) {
        console.error('[LID_HANDLER] Error saving mappings:', err);
    }
}

// Store temporary verification codes
const verificationCodes = new Map();

/**
 * Extract the real phone number from a message with @lid format
 * @param {Object} msg - The WhatsApp message object from Baileys
 * @param {Boolean} isGroup - Whether message is from group
 * @returns {Object} - Object containing sender info and possible phone number
 */
function extractSenderInfo(msg, isGroup = false) {
    const result = {
        originalSender: msg.key.remoteJid,
        isLid: false,
        phoneNumber: null,
        pushname: msg.pushName || null,
        participant: null,
        method: 'direct'
    };
    
    // Determine if sender uses @lid format
    const senderJid = isGroup ? 
        (msg.key.participant || msg.participant) : 
        msg.key.remoteJid;
    
    // Check if it's @lid format
    if (senderJid && senderJid.endsWith('@lid')) {
        result.isLid = true;
        result.originalSender = senderJid;
        
        // Method 0 (BEST for DM): Check remoteJidAlt - Baileys v7
        if (!isGroup && msg.key.remoteJidAlt && msg.key.remoteJidAlt.includes('@s.whatsapp.net')) {
            result.phoneNumber = msg.key.remoteJidAlt.split('@')[0];
            result.participant = msg.key.remoteJidAlt;
            result.method = 'remoteJidAlt';
        }
        
        // Method 0.5 (BEST for Groups): Check participantAlt - Baileys v7
        else if (isGroup && msg.key.participantAlt && msg.key.participantAlt.includes('@s.whatsapp.net')) {
            result.phoneNumber = msg.key.participantAlt.split('@')[0];
            result.participant = msg.key.participantAlt;
            result.method = 'participantAlt';
        }
        
        // Method 1: Check for participant field (sometimes available)
        else if (msg.key.participant && msg.key.participant.includes('@s.whatsapp.net')) {
            result.phoneNumber = msg.key.participant.split('@')[0];
            result.participant = msg.key.participant;
            result.method = 'participant';
        }
        
        // Method 2: Check message.participant (alternative field)
        else if (msg.participant && msg.participant.includes('@s.whatsapp.net')) {
            result.phoneNumber = msg.participant.split('@')[0];
            result.participant = msg.participant;
            result.method = 'msg_participant';
        }
        
        // Method 3: Check for author field
        else if (msg.author && msg.author.includes('@s.whatsapp.net')) {
            result.phoneNumber = msg.author.split('@')[0];
            result.participant = msg.author;
            result.method = 'author';
        }
        
        // Method 4: Check phoneNumber field directly (some versions have this)
        else if (msg.phoneNumber) {
            result.phoneNumber = msg.phoneNumber.replace(/[^0-9]/g, '');
            result.method = 'phone_field';
        }
        
        // Method 5: Check userJid field (newsletter/channel messages)
        else if (msg.userJid && msg.userJid.includes('@s.whatsapp.net')) {
            result.phoneNumber = msg.userJid.split('@')[0];
            result.participant = msg.userJid;
            result.method = 'userJid';
        }
        
        // Method 6: Check verifiedBizName (for business accounts)
        else if (msg.verifiedBizName) {
            result.method = 'business';
        }
        
    } else if (msg.key.remoteJid && msg.key.remoteJid.includes('@s.whatsapp.net')) {
        // Standard WhatsApp format
        result.phoneNumber = msg.key.remoteJid.split('@')[0];
        result.method = 'standard';
    }
    
    return result;
}

/**
 * Find user by various methods including @lid support
 * @param {Array} users - Array of users from database
 * @param {Object} msg - WhatsApp message object
 * @param {string} plainSenderNumber - The plain sender number (may be from @lid)
 * @param {Object} raf - WhatsApp socket instance (optional)
 * @returns {Object|null} - The found user or null
 */
async function findUserWithLidSupport(users, msg, plainSenderNumber, raf = null) {
    // Add null safety check for msg parameter
    if (!msg || !msg.key) {
        console.error('[LID_HANDLER] Invalid msg parameter:', msg);
        return null;
    }
    
    // Check if message is from group
    const isGroup = msg.key.remoteJid && msg.key.remoteJid.endsWith('@g.us');
    
    // First, try to extract real phone number from @lid
    const senderInfo = extractSenderInfo(msg, isGroup);
    
    // If phone not found from message fields, try signal repository
    if (senderInfo.isLid && !senderInfo.phoneNumber && raf && raf.signalRepository) {
        const lidJid = senderInfo.originalSender;
        
        try {
            if (raf.signalRepository.lidMapping && raf.signalRepository.lidMapping.getPNForLID) {
                const phoneNumber = await raf.signalRepository.lidMapping.getPNForLID(lidJid);
                if (phoneNumber) {
                    senderInfo.phoneNumber = phoneNumber.split('@')[0];
                    senderInfo.method = 'signal_repository';
                    
                    if (raf.signalRepository.lidMapping.storeLIDPNMapping) {
                        await raf.signalRepository.lidMapping.storeLIDPNMapping(lidJid, phoneNumber);
                    }
                }
            }
        } catch (error) {
            // Signal repository not available, continue with other methods
        }
    }
    
    // Check stored mapping as fallback
    if (senderInfo.isLid) {
        const lidId = msg.key.remoteJid.split('@')[0];
        const mappings = loadMappings();
        
        if (mappings.mappings[lidId]) {
            const userId = mappings.mappings[lidId];
            const user = users.find(u => u.id == userId);
            if (user) {
                console.log(`[LID_HANDLER] User found via stored mapping: ${user.name} (ID: ${user.id})`);
                return user;
            }
        }
    }
    
    if (senderInfo.phoneNumber) {
        // Normalize the extracted number
        let normalizedExtracted = senderInfo.phoneNumber;
        if (normalizedExtracted.startsWith('0')) {
            normalizedExtracted = '62' + normalizedExtracted.substring(1);
        }
        
        // Find user with the extracted number
        const user = users.find(v => {
            if (!v.phone_number) return false;
            
            const phoneNumbers = v.phone_number.split("|").map(p => p.trim());
            
            for (const phone of phoneNumbers) {
                // Direct match
                if (phone === senderInfo.phoneNumber || phone === normalizedExtracted) {
                    return true;
                }
                
                // Normalize stored phone and compare
                let normalizedPhone = phone;
                if (phone.startsWith('0')) {
                    normalizedPhone = '62' + phone.substring(1);
                } else if (phone.startsWith('+62')) {
                    normalizedPhone = phone.substring(1);
                }
                
                if (normalizedPhone === senderInfo.phoneNumber || normalizedPhone === normalizedExtracted) {
                    return true;
                }
            }
            
            return false;
        });
        
        if (user) {
            console.log(`[LID_HANDLER] User found: ${user.name} (ID: ${user.id})`);
            
            // Save mapping for @lid format
            if (senderInfo.isLid) {
                const lidId = msg.key.remoteJid.split('@')[0];
                const mappings = loadMappings();
                if (!mappings.mappings[lidId]) {
                    mappings.mappings[lidId] = user.id;
                    saveMappings(mappings);
                    console.log(`[LID_HANDLER] Saved mapping: ${lidId} -> User ID ${user.id}`);
                }
            }
            
            return user;
        }
    }
    
    // Don't use pushname matching - unreliable as user mentioned
    if (senderInfo.isLid) {
        console.log(`[LID_HANDLER] No phone number found for @lid: ${msg.key.remoteJid}`);
        console.log(`[LID_HANDLER] User needs to verify their account first.`);
        return null;
    }
    
    // Standard fallback to original logic
    if (!senderInfo.isLid) {
        // Use the original phone matching logic for non-@lid messages
        let normalizedSender = plainSenderNumber;
        if (normalizedSender && normalizedSender.startsWith('0')) {
            normalizedSender = '62' + normalizedSender.substring(1);
        }
        
        const user = users.find(v => {
            if (!v.phone_number) return false;
            
            const phoneNumbers = v.phone_number.split("|").map(p => p.trim());
            
            for (const phone of phoneNumbers) {
                if (phone === plainSenderNumber || phone === normalizedSender) {
                    return true;
                }
                
                let normalizedPhone = phone;
                if (phone.startsWith('0')) {
                    normalizedPhone = '62' + phone.substring(1);
                } else if (phone.startsWith('+62')) {
                    normalizedPhone = phone.substring(1);
                }
                
                if (normalizedPhone === plainSenderNumber || normalizedPhone === normalizedSender) {
                    return true;
                }
            }
            
            return false;
        });
        
        return user;
    }
    
    return null;
}

/**
 * Handle @lid verification process
 * @param {string} lidId - The @lid ID
 * @param {number} userId - The user ID to link
 * @param {string} code - Verification code (optional)
 * @returns {Object} - Result of verification
 */
function handleLidVerification(lidId, userId, code = null) {
    if (code) {
        // Verify the code
        const expectedCode = verificationCodes.get(lidId);
        if (expectedCode && expectedCode === code) {
            // Save mapping
            const mappings = loadMappings();
            mappings.mappings[lidId] = userId;
            saveMappings(mappings);
            
            // Clear verification code
            verificationCodes.delete(lidId);
            
            console.log(`[LID_HANDLER] Verification successful: ${lidId} -> User ID ${userId}`);
            return { success: true, message: 'Verifikasi berhasil! Akun Anda telah terhubung.' };
        } else {
            return { success: false, message: 'Kode verifikasi salah. Silakan coba lagi.' };
        }
    } else {
        // Generate verification code
        const verifyCode = Math.floor(100000 + Math.random() * 900000).toString();
        verificationCodes.set(lidId, verifyCode);
        
        // Auto-delete after 5 minutes
        setTimeout(() => {
            verificationCodes.delete(lidId);
        }, 5 * 60 * 1000);
        
        console.log(`[LID_HANDLER] Generated verification code for ${lidId}: ${verifyCode}`);
        return { success: true, code: verifyCode, message: 'Kode verifikasi telah dibuat.' };
    }
}

/**
 * Create request for phone number from @lid users
 * @param {Object} raf - WhatsApp connection instance
 * @param {string} jid - The @lid JID
 * @returns {Object} - Request result
 */
async function requestPhoneNumberFromLid(raf, jid) {
    try {
        // PENTING: Cek connection state dan gunakan error handling sesuai rules
        if (global.whatsappConnectionState === 'open' && raf && raf.sendMessage) {
            try {
                // Request phone number using WhatsApp's official method
                await raf.sendMessage(jid, {
                    text: '📱 *Permintaan Nomor Telepon*\n\nUntuk melanjutkan layanan, kami perlu verifikasi nomor Anda.',
                    contextInfo: {
                        requestPhoneNumber: true  // WhatsApp official request
                    }
                }, { skipDuplicateCheck: true });
                
                console.log(`[LID_HANDLER] Phone number request sent to ${jid}`);
                
                return {
                    success: true,
                    jid: jid,
                    message: 'Permintaan nomor telepon telah dikirim. Silakan bagikan nomor Anda.'
                };
            } catch (error) {
                console.error('[SEND_MESSAGE_ERROR]', {
                    jid,
                    error: error.message
                });
                console.error(`[LID_HANDLER] Failed to request phone number:`, error);
                return {
                    success: false,
                    error: error.message
                };
            }
        } else {
            console.warn('[SEND_MESSAGE_SKIP] WhatsApp not connected, skipping send to', jid);
            return {
                success: false,
                error: 'WhatsApp not connected'
            };
        }
    } catch (error) {
        console.error('[LID_HANDLER] Error in requestPhoneNumberFromLid:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Create verification instructions for @lid users
 * @param {string} lidId - The @lid ID 
 * @param {Array} users - Array of users from database
 * @returns {Object} - Verification instructions
 */
function createLidVerification(lidId, users) {
    return {
        needsVerification: true,
        message: `🔐 *AKUN PERLU VERIFIKASI*\n\n` +
                 `WhatsApp Anda menggunakan format privacy baru (@lid) yang menyembunyikan nomor telepon.\n\n` +
                 `Untuk menggunakan layanan:\n\n` +
                 `1. Ketik: *share* - untuk membagikan nomor Anda\n` +
                 `2. Atau hubungi admin untuk bantuan\n\n` +
                 `_Ini adalah fitur privacy WhatsApp yang baru._`
    };
}

/**
 * Process verification for @lid users
 * @param {string} lidId - The @lid ID
 * @param {string} input - User input (code or phone number)
 * @param {Array} users - Array of users
 * @returns {Object} - Verification result
 */
function processLidVerification(lidId, input, users) {
    const storedData = verificationCodes.get(lidId);
    
    // Check if verification code matches
    if (storedData && storedData.code === input) {
        // This is a verification code, but we need phone number
        return {
            success: false,
            message: `⚠️ Silakan ketik *link [nomor_hp_terdaftar]* untuk melanjutkan.\n` +
                    `Contoh: *link 6285233047094*`
        };
    }
    
    // Check if input is a phone number
    const cleanPhone = input.replace(/[^0-9]/g, '');
    if (cleanPhone.length >= 10) {
        // Normalize phone number
        let normalizedPhone = cleanPhone;
        if (normalizedPhone.startsWith('0')) {
            normalizedPhone = '62' + normalizedPhone.substring(1);
        }
        
        // Find user with this phone number
        const user = users.find(u => {
            if (!u.phone_number) return false;
            const phones = u.phone_number.split('|').map(p => p.trim());
            
            for (const phone of phones) {
                let normalizedDbPhone = phone;
                if (phone.startsWith('0')) {
                    normalizedDbPhone = '62' + phone.substring(1);
                } else if (phone.startsWith('+62')) {
                    normalizedDbPhone = phone.substring(1);
                }
                
                if (normalizedDbPhone === normalizedPhone || normalizedDbPhone === cleanPhone) {
                    return true;
                }
            }
            
            return false;
        });
        
        if (user) {
            // Save mapping
            const mappings = loadMappings();
            mappings.mappings[lidId] = user.id;
            saveMappings(mappings);
            
            // Clear verification code
            verificationCodes.delete(lidId);
            
            console.log(`[LID_HANDLER] Verification successful: ${lidId} -> User ID ${user.id}`);
            
            return {
                success: true,
                user,
                message: `✅ *VERIFIKASI BERHASIL!*\n\n` +
                        `Akun Anda telah terhubung:\n` +
                        `• Nama: ${user.name}\n` +
                        `• ID: ${user.id}\n` +
                        `• Paket: ${user.subscription || 'N/A'}\n\n` +
                        `Silakan lanjutkan menggunakan layanan.`
            };
        } else {
            return {
                success: false,
                message: `❌ Nomor ${cleanPhone} tidak terdaftar dalam database.\n` +
                        `Silakan hubungi admin untuk bantuan.`
            };
        }
    }
    
    return {
        success: false,
        message: `❌ Format tidak valid. Silakan ketik:\n` +
                `*link [nomor_hp_terdaftar]*\n` +
                `Contoh: *link 6285233047094*`
    };
}

/**
 * Normalize JID untuk operasi saldo dan database
 * Mengkonversi @lid format ke format JID standar (628xxx@s.whatsapp.net)
 * Jika tidak bisa dikonversi, return null atau original JID tergantung useCase
 * 
 * @param {string} jid - JID yang akan dinormalisasi (bisa @lid atau @s.whatsapp.net)
 * @param {Object} options - Opsi normalisasi
 * @param {boolean} options.allowLid - Jika true, return @lid as-is jika tidak bisa dikonversi (default: false)
 * @param {Object} options.raf - WhatsApp socket instance untuk akses signalRepository (optional)
 * @returns {Promise<string|null>} - JID yang sudah dinormalisasi atau null jika tidak valid
 */
async function normalizeJidForSaldo(jid, options = {}) {
    if (!jid) return null;
    
    const { allowLid = false, raf = null } = options;
    
    // Jika sudah format standar, return as-is
    if (jid.endsWith('@s.whatsapp.net')) {
        // Pastikan tidak ada :0 atau format aneh
        if (jid.includes(':')) {
            const cleanJid = jid.split(':')[0];
            if (cleanJid.endsWith('@s.whatsapp.net')) {
                return cleanJid;
            }
        }
        return jid;
    }
    
    // Jika @lid format, coba ekstrak nomor HP
    if (jid.endsWith('@lid')) {
        const lidId = jid.split('@')[0];
        
        // Method 1: Cek stored mapping (lid-mappings.json) - HANYA untuk user terdaftar
        const mappings = loadMappings();
        if (mappings.mappings && mappings.mappings[lidId]) {
            const userId = mappings.mappings[lidId];
            try {
                const users = global.users || [];
                if (users.length > 0) {
                    const user = users.find(u => u.id == userId || u.id === userId || String(u.id) === String(userId));
                    if (user && user.phone_number) {
                        let phoneNumber = user.phone_number.split('|')[0].trim();
                        phoneNumber = phoneNumber.split('@')[0];
                        phoneNumber = phoneNumber.split(':')[0];
                        let normalizedPhone = phoneNumber.replace(/[^0-9]/g, '');
                        
                        if (normalizedPhone.startsWith('0')) {
                            normalizedPhone = '62' + normalizedPhone.substring(1);
                        } else if (normalizedPhone.startsWith('+62')) {
                            normalizedPhone = normalizedPhone.substring(1);
                        } else if (!normalizedPhone.startsWith('62')) {
                            normalizedPhone = '62' + normalizedPhone;
                        }
                        
                        if (normalizedPhone.length >= 10 && normalizedPhone.length <= 15) {
                            return `${normalizedPhone}@s.whatsapp.net`;
                        }
                    }
                }
            } catch (error) {
                // Silent fail, try next method
            }
        }
        
        // Method 2: Coba signal repository (jika raf tersedia) - UNTUK SEMUA USER (terdaftar atau tidak)
        if (raf && raf.signalRepository) {
            try {
                if (raf.signalRepository.lidMapping && raf.signalRepository.lidMapping.getPNForLID) {
                    const phoneNumberJid = await raf.signalRepository.lidMapping.getPNForLID(jid);
                    if (phoneNumberJid && phoneNumberJid.endsWith('@s.whatsapp.net')) {
                        let cleanJid = phoneNumberJid.split(':')[0];
                        
                        if (!cleanJid.endsWith('@s.whatsapp.net')) {
                            const phoneNumber = cleanJid.replace(/[^0-9]/g, '');
                            let normalizedPhone = phoneNumber;
                            if (normalizedPhone.startsWith('0')) {
                                normalizedPhone = '62' + normalizedPhone.substring(1);
                            } else if (normalizedPhone.startsWith('+62')) {
                                normalizedPhone = normalizedPhone.substring(1);
                            } else if (!normalizedPhone.startsWith('62')) {
                                normalizedPhone = '62' + normalizedPhone;
                            }
                            cleanJid = `${normalizedPhone}@s.whatsapp.net`;
                        }
                        
                        if (cleanJid.endsWith('@s.whatsapp.net')) {
                            return cleanJid;
                        }
                    }
                }
            } catch (error) {
                // Silent fail, try next method
            }
        }
        
        // Method 3: Cek di database users untuk mencari user dengan @lid di phone_number
        try {
            const users = global.users || [];
            if (users.length > 0) {
                const user = users.find(u => u.phone_number && u.phone_number.includes(jid));
                if (user && user.phone_number) {
                    const phoneNumbers = user.phone_number.split('|').map(p => p.trim());
                    const realPhone = phoneNumbers.find(p => p.endsWith('@s.whatsapp.net'));
                    if (realPhone) {
                        let cleanPhone = realPhone.split(':')[0];
                        if (cleanPhone.endsWith('@s.whatsapp.net')) {
                            return cleanPhone;
                        }
                    }
                }
            }
        } catch (error) {
            // Silent fail
        }
        
        // Jika tidak bisa dikonversi
        if (allowLid) {
            return jid;
        } else {
            return null;
        }
    }
    
    // Jika format tidak dikenal, coba normalisasi sebagai nomor HP
    let phoneNumber = jid.split('@')[0];
    
    // Hapus format aneh seperti :0 atau :1 (biasanya dari broadcast atau group)
    phoneNumber = phoneNumber.split(':')[0];
    
    // Hanya ambil angka
    phoneNumber = phoneNumber.replace(/[^0-9]/g, '');
    
    if (/^[0-9]+$/.test(phoneNumber) && phoneNumber.length >= 10) {
        let normalizedPhone = phoneNumber;
        if (normalizedPhone.startsWith('0')) {
            normalizedPhone = '62' + normalizedPhone.substring(1);
        } else if (normalizedPhone.startsWith('+62')) {
            normalizedPhone = normalizedPhone.substring(1);
        } else if (!normalizedPhone.startsWith('62')) {
            normalizedPhone = '62' + normalizedPhone;
        }
        
        // Validasi: nomor HP harus minimal 10 digit (62 + 8-9 digit)
        if (normalizedPhone.length >= 10 && normalizedPhone.length <= 15) {
            return `${normalizedPhone}@s.whatsapp.net`;
        }
    }
    
    // Format tidak valid
    return null;
}

module.exports = {
    extractSenderInfo,
    findUserWithLidSupport,
    createLidVerification,
    processLidVerification,
    normalizeJidForSaldo
};
