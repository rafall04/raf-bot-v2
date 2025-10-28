"use strict";

/**
 * Simplified WiFi Handler
 * Clean and maintainable code for WiFi management
 */

const axios = require('axios');
const { findUserByPhone } = require('./utils');
const { getSSIDInfo } = require('../../lib/wifi');
const { saveWifiChangeLog } = require('./wifi-logger');
const handlerMessages = require('../../lib/handler-messages');

/**
 * Apply WiFi changes to all bulk SSIDs
 * @param {Object} user - User object with bulk SSIDs
 * @param {string} type - Change type: 'name' or 'password'
 * @param {string} value - New value to set
 * @returns {Promise<Object>} Result of the operation
 */
async function applyBulkWifiChanges(user, type, value) {
    const results = [];
    const ssidsToChange = user.bulk && user.bulk.length > 0 ? user.bulk : ['1'];
    
    console.log(`[BULK_WIFI_CHANGE] Applying ${type} change to SSIDs: ${ssidsToChange.join(', ')}`);
    
    // Get current WiFi info for logging and display
    let currentInfo = null;
    try {
        currentInfo = await getSSIDInfo(user.device_id, true); // Skip refresh
    } catch (err) {
        console.warn(`[BULK_WIFI_CHANGE] Could not get current info: ${err.message}`);
    }
    
    // Apply changes to each SSID in bulk
    for (const ssidId of ssidsToChange) {
        try {
            let parameterPath;
            let parameterValue;
            
            if (type === 'name') {
                parameterPath = `InternetGatewayDevice.LANDevice.1.WLANConfiguration.${ssidId}.SSID`;
                parameterValue = value;
            } else if (type === 'password') {
                // For password, we need to set multiple parameters
                parameterPath = `InternetGatewayDevice.LANDevice.1.WLANConfiguration.${ssidId}.PreSharedKey.1.PreSharedKey`;
                parameterValue = value;
            }
            
            const response = await axios.post(
                `${global.config.genieacsBaseUrl}/devices/${encodeURIComponent(user.device_id)}/tasks?connection_request`,
                {
                    name: 'setParameterValues',
                    parameterValues: [
                        [parameterPath, parameterValue, "xsd:string"]
                    ]
                }
            );
            
            if (response.status >= 200 && response.status < 300) {
                // Get old SSID name for display
                let oldSsidName = 'Unknown';
                if (currentInfo && currentInfo.ssid) {
                    const ssidInfo = currentInfo.ssid.find(s => String(s.id) === String(ssidId));
                    if (ssidInfo && ssidInfo.name) {
                        oldSsidName = ssidInfo.name;
                    }
                }
                
                results.push({
                    ssidId: ssidId,
                    ssidName: oldSsidName, // Add SSID name for display
                    success: true,
                    oldValue: type === 'name' ? oldSsidName : 'hidden',
                    newValue: value
                });
            } else {
                // Get SSID name even for failed attempts
                let ssidName = `SSID ${ssidId}`;
                if (currentInfo && currentInfo.ssid) {
                    const ssidInfo = currentInfo.ssid.find(s => String(s.id) === String(ssidId));
                    if (ssidInfo && ssidInfo.name) {
                        ssidName = ssidInfo.name;
                    }
                }
                
                results.push({
                    ssidId: ssidId,
                    ssidName: ssidName,
                    success: false,
                    error: `GenieACS returned status ${response.status}`
                });
            }
        } catch (error) {
            // Get SSID name for error display
            let ssidName = `SSID ${ssidId}`;
            if (currentInfo && currentInfo.ssid) {
                const ssidInfo = currentInfo.ssid.find(s => String(s.id) === String(ssidId));
                if (ssidInfo && ssidInfo.name) {
                    ssidName = ssidInfo.name;
                }
            }
            
            results.push({
                ssidId: ssidId,
                ssidName: ssidName,
                success: false,
                error: error.message
            });
        }
    }
    
    return results;
}

/**
 * Handle WiFi name change
 */
async function handleWifiNameChange({ sender, pushname, args, argsClean, matchedKeywordLength, isOwner, isTeknisi, reply }) {
    try {
        // Prioritize argsClean (cleaned args from raf.js) if available
        const workingArgs = argsClean || args;
        
        // SAFEGUARD: Validate command is at START of message (only if using original args)
        if (!argsClean) {
            const fullMessage = args.join(' ').toLowerCase();
            const commandKeywords = ['ganti nama', 'ganti ssid', 'ubah nama', 'ubah ssid'];
            const startsWithCommand = commandKeywords.some(kw => fullMessage.startsWith(kw));
            
            if (!startsWithCommand) {
                return {
                    success: false,
                    message: '❌ Command tidak valid. Gunakan format: *ganti nama [nama baru]*'
                };
            }
        }
        
        // Find user
        let user;
        let newName;
        
        // Check if admin changing for specific user
        if ((isOwner || isTeknisi) && workingArgs && workingArgs.length > 2) {
            const possibleId = workingArgs[workingArgs.length - 2];
            if (!isNaN(parseInt(possibleId, 10))) {
                user = global.users.find(u => u.id == possibleId);
                newName = workingArgs[workingArgs.length - 1];
            }
        }
        
        if (!user) {
            user = findUserByPhone(sender);
            // If using argsClean, args are already cleaned, just join them
            // Otherwise, use matchedKeywordLength to skip command words
            if (argsClean) {
                newName = workingArgs.join(' ');
            } else {
                const keywordLength = matchedKeywordLength || 2; // Default 2 for "ganti nama"
                newName = workingArgs.slice(keywordLength).join(' ');
            }
        }
        
        if (!user) {
            return {
                success: false,
                message: handlerMessages.getMessage('wifi.user_not_registered')
            };
        }
        
        if (!user.device_id) {
            return {
                success: false,
                message: handlerMessages.getMessage('wifi.device_not_registered')
            };
        }
        
        if (!newName || newName.trim() === '') {
            return {
                success: false,
                message: handlerMessages.getMessage('wifi.prompt_name_input')
            };
        }
        
        if (newName.length > 32) {
            return {
                success: false,
                message: handlerMessages.getMessage('wifi.name_too_long')
            };
        }
        
        reply(handlerMessages.getMessage('wifi.processing_name_change'));
        
        // Apply changes to all bulk SSIDs
        const results = await applyBulkWifiChanges(user, 'name', newName);
        
        // Check results
        const successful = results.filter(r => r.success);
        const failed = results.filter(r => !r.success);
        
        if (successful.length > 0) {
            // Log the changes
            const changeDetails = successful.map(r => 
                `SSID ${r.ssidId}: "${r.oldValue}" → "${r.newValue}"`
            ).join('; ');
            
            await saveWifiChangeLog({
                type: 'name_change',
                userId: user.id,
                userName: user.name,
                userPhone: user.phone_number || user.phone,
                deviceId: user.device_id,
                changes: {
                    oldSsidName: successful.map(r => r.oldValue).join(', '),
                    newSsidName: newName,
                    details: changeDetails
                },
                changedBy: pushname || 'User',
                changedBySender: sender,
                notes: `Nama WiFi diubah untuk ${successful.length} SSID`,
                timestamp: new Date().toISOString()
            });
            
            let message = `✅ *Berhasil mengubah nama WiFi!*\n\n`;
            message += `📶 Nama baru: *${newName}*\n`;
            message += `📡 WiFi yang diubah:\n`;
            successful.forEach(r => {
                message += `• ${r.ssidName} → ${r.newValue}\n`;
            });
            message += `\n`;
            
            if (failed.length > 0) {
                message += `⚠️ *Gagal mengubah:*\n`;
                failed.forEach(f => {
                    message += `• ${f.ssidName}: ${f.error}\n`;
                });
                message += `\n`;
            }
            
            message += `\n⚠️ *Penting:* Semua perangkat akan terputus. Silakan reconnect dengan nama WiFi baru.`;
            
            return {
                success: true,
                message: message
            };
        } else {
            return {
                success: false,
                message: `❌ Gagal mengubah nama WiFi.\n\nError: ${failed[0]?.error || 'Unknown error'}`
            };
        }
        
    } catch (error) {
        console.error('[WIFI_NAME_CHANGE_ERROR]', error);
        return {
            success: false,
            message: handlerMessages.getMessage('wifi.error_occurred', { action: 'mengubah nama WiFi' })
        };
    }
}

/**
 * Handle WiFi password change
 */
async function handleWifiPasswordChange({ sender, pushname, args, argsClean, matchedKeywordLength, isOwner, isTeknisi, reply }) {
    try {
        // Prioritize argsClean (cleaned args from raf.js) if available
        const workingArgs = argsClean || args;
        
        // SAFEGUARD: Validate command is at START of message (only if using original args)
        if (!argsClean) {
            const fullMessage = args.join(' ').toLowerCase();
            const commandKeywords = ['ganti sandi', 'ganti password', 'ubah sandi', 'ubah password', 'ganti pw'];
            const startsWithCommand = commandKeywords.some(kw => fullMessage.startsWith(kw));
            
            if (!startsWithCommand) {
                return {
                    success: false,
                    message: '❌ Command tidak valid. Gunakan format: *ganti sandi [password baru]*'
                };
            }
        }
        
        // Find user
        let user;
        let newPassword;
        
        // Check if admin changing for specific user
        if ((isOwner || isTeknisi) && workingArgs && workingArgs.length > 2) {
            const possibleId = workingArgs[workingArgs.length - 2];
            if (!isNaN(parseInt(possibleId, 10))) {
                user = global.users.find(u => u.id == possibleId);
                newPassword = workingArgs[workingArgs.length - 1];
            }
        }
        
        if (!user) {
            user = findUserByPhone(sender);
            // If using argsClean, args are already cleaned, just join them
            // Otherwise, use matchedKeywordLength to skip command words
            if (argsClean) {
                newPassword = workingArgs.join(' ');
            } else {
                const keywordLength = matchedKeywordLength || 2; // Default 2 for "ganti sandi"
                newPassword = workingArgs.slice(keywordLength).join(' ');
            }
        }
        
        if (!user) {
            return {
                success: false,
                message: handlerMessages.getMessage('wifi.user_not_registered')
            };
        }
        
        if (!user.device_id) {
            return {
                success: false,
                message: handlerMessages.getMessage('wifi.device_not_registered')
            };
        }
        
        if (!newPassword || newPassword.trim() === '') {
            return {
                success: false,
                message: handlerMessages.getMessage('wifi.prompt_password_input')
            };
        }
        
        if (newPassword.length < 8) {
            return {
                success: false,
                message: handlerMessages.getMessage('wifi.password_too_short')
            };
        }
        
        reply(handlerMessages.getMessage('wifi.processing_password_change'));
        
        // Apply changes to all bulk SSIDs
        const results = await applyBulkWifiChanges(user, 'password', newPassword);
        
        // Check results
        const successful = results.filter(r => r.success);
        const failed = results.filter(r => !r.success);
        
        if (successful.length > 0) {
            // Log the changes
            await saveWifiChangeLog({
                type: 'password_change',
                userId: user.id,
                userName: user.name,
                userPhone: user.phone_number || user.phone,
                deviceId: user.device_id,
                changes: {
                    oldPassword: 'hidden',
                    newPassword: newPassword,
                    ssidsChanged: successful.map(r => r.ssidId).join(', ')
                },
                changedBy: pushname || 'User',
                changedBySender: sender,
                notes: `Password WiFi diubah untuk ${successful.length} SSID`,
                timestamp: new Date().toISOString()
            });
            
            let message = `✅ *Berhasil mengubah password WiFi!*\n\n`;
            message += `🔐 Password baru: *${newPassword}*\n`;
            message += `📡 WiFi yang diubah:\n`;
            successful.forEach(r => {
                message += `• ${r.ssidName}\n`;
            });
            message += `\n`;
            
            if (failed.length > 0) {
                message += `⚠️ *Gagal mengubah:*\n`;
                failed.forEach(f => {
                    message += `• ${f.ssidName}: ${f.error}\n`;
                });
                message += `\n`;
            }
            
            message += `\n⚠️ *Penting:* Semua perangkat akan terputus. Silakan reconnect dengan password baru.`;
            
            return {
                success: true,
                message: message
            };
        } else {
            return {
                success: false,
                message: `❌ Gagal mengubah password WiFi.\n\nError: ${failed[0]?.error || 'Unknown error'}`
            };
        }
        
    } catch (error) {
        console.error('[WIFI_PASSWORD_CHANGE_ERROR]', error);
        return {
            success: false,
            message: handlerMessages.getMessage('wifi.error_occurred', { action: 'mengubah password WiFi' })
        };
    }
}

module.exports = {
    handleWifiNameChange,
    handleWifiPasswordChange,
    applyBulkWifiChanges
};
