/**
 * GenieACS Helper Functions
 * Helper functions for interacting with GenieACS TR-069 ACS
 */

const axios = require('axios');

/**
 * Set WiFi credentials (SSID and Password) for a specific SSID index on a device
 * @param {string} deviceId - GenieACS device ID
 * @param {number|string} ssidIndex - SSID index (1, 2, 3, etc.)
 * @param {string} ssidName - New SSID name
 * @param {string} password - New WiFi password
 * @returns {Promise<Object>} - Response from GenieACS
 */
async function setWifiCredentials(deviceId, ssidIndex, ssidName, password) {
    const config = global.config;
    
    if (!config?.genieacsBaseUrl) {
        throw new Error('GenieACS tidak dikonfigurasi');
    }
    
    if (!deviceId) {
        throw new Error('Device ID diperlukan');
    }
    
    const parameterValues = [
        [`InternetGatewayDevice.LANDevice.1.WLANConfiguration.${ssidIndex}.SSID`, ssidName, 'xsd:string'],
        [`InternetGatewayDevice.LANDevice.1.WLANConfiguration.${ssidIndex}.PreSharedKey.1.PreSharedKey`, password, 'xsd:string']
    ];
    
    console.log(`[GENIEACS_HELPER] Setting WiFi credentials for device ${deviceId}, SSID index ${ssidIndex}`);
    
    try {
        const response = await axios.post(
            `${config.genieacsBaseUrl}/devices/${encodeURIComponent(deviceId)}/tasks?connection_request`,
            {
                name: 'setParameterValues',
                parameterValues: parameterValues
            },
            { timeout: 30000 }
        );
        
        console.log(`[GENIEACS_HELPER] WiFi credentials set successfully for device ${deviceId}, SSID ${ssidIndex}`);
        return response.data;
    } catch (error) {
        console.error(`[GENIEACS_HELPER_ERROR] Failed to set WiFi credentials:`, error.message);
        throw new Error(`Gagal mengatur WiFi: ${error.message}`);
    }
}

/**
 * Set PPPoE credentials on a device via GenieACS
 * @param {string} deviceId - GenieACS device ID
 * @param {string} username - PPPoE username
 * @param {string} password - PPPoE password
 * @returns {Promise<Object>} - Response from GenieACS
 */
async function setPPPoECredentials(deviceId, username, password) {
    const config = global.config;
    
    if (!config?.genieacsBaseUrl) {
        throw new Error('GenieACS tidak dikonfigurasi');
    }
    
    if (!deviceId) {
        throw new Error('Device ID diperlukan');
    }
    
    // Common PPPoE parameter paths for different device types
    const parameterValues = [
        ['InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.Username', username, 'xsd:string'],
        ['InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.Password', password, 'xsd:string']
    ];
    
    console.log(`[GENIEACS_HELPER] Setting PPPoE credentials for device ${deviceId}, username: ${username}`);
    
    try {
        const response = await axios.post(
            `${config.genieacsBaseUrl}/devices/${encodeURIComponent(deviceId)}/tasks?connection_request`,
            {
                name: 'setParameterValues',
                parameterValues: parameterValues
            },
            { timeout: 30000 }
        );
        
        console.log(`[GENIEACS_HELPER] PPPoE credentials set successfully for device ${deviceId}`);
        return response.data;
    } catch (error) {
        console.error(`[GENIEACS_HELPER_ERROR] Failed to set PPPoE credentials:`, error.message);
        throw new Error(`Gagal mengatur PPPoE pada device: ${error.message}`);
    }
}

/**
 * Get device info from GenieACS
 * @param {string} deviceId - GenieACS device ID
 * @returns {Promise<Object|null>} - Device info or null if not found
 */
async function getDeviceInfo(deviceId) {
    const config = global.config;
    
    if (!config?.genieacsBaseUrl) {
        throw new Error('GenieACS tidak dikonfigurasi');
    }
    
    try {
        const query = { "_id": deviceId };
        const response = await axios.get(`${config.genieacsBaseUrl}/devices/`, {
            params: {
                query: JSON.stringify(query),
                projection: '_id,Device.DeviceInfo,InternetGatewayDevice.DeviceInfo'
            },
            timeout: 10000
        });
        
        if (response.data && response.data.length > 0) {
            return response.data[0];
        }
        return null;
    } catch (error) {
        console.error(`[GENIEACS_HELPER_ERROR] Failed to get device info:`, error.message);
        throw new Error(`Gagal mengambil info device: ${error.message}`);
    }
}

/**
 * Reboot device via GenieACS
 * @param {string} deviceId - GenieACS device ID
 * @returns {Promise<Object>} - Response from GenieACS
 */
async function rebootDevice(deviceId) {
    const config = global.config;
    
    if (!config?.genieacsBaseUrl) {
        throw new Error('GenieACS tidak dikonfigurasi');
    }
    
    try {
        const response = await axios.post(
            `${config.genieacsBaseUrl}/devices/${encodeURIComponent(deviceId)}/tasks?connection_request`,
            {
                name: 'reboot'
            },
            { timeout: 30000 }
        );
        
        console.log(`[GENIEACS_HELPER] Reboot command sent to device ${deviceId}`);
        return response.data;
    } catch (error) {
        console.error(`[GENIEACS_HELPER_ERROR] Failed to reboot device:`, error.message);
        throw new Error(`Gagal mereboot device: ${error.message}`);
    }
}

module.exports = {
    setWifiCredentials,
    setPPPoECredentials,
    getDeviceInfo,
    rebootDevice
};
