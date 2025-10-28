const axios = require("axios")
// config is now global, no need to require it here.

const setPassword = (deviceId, newPassword) => {
    const config = global.config;
    const findUser = users.find(v => v.device_id === deviceId);
    return axios.post(config.genieacsBaseUrl + "/devices/" + deviceId + "/tasks?connection_request", {
        name: 'setParameterValues',
        parameterValues: findUser && findUser.bulk?.length > 0 ? findUser.bulk.map(v => {
            return [`InternetGatewayDevice.LANDevice.1.WLANConfiguration.${v}.PreSharedKey.1.PreSharedKey`, newPassword, "xsd:string"]
        }) : [["InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.PreSharedKey.1.PreSharedKey", newPassword, "xsd:string"]]
    })
}

const setSSIDName = (deviceId, newName) => {
    const config = global.config;
    const findUser = users.find(v => v.device_id === deviceId);
    return axios.post(config.genieacsBaseUrl + "/devices/" + deviceId + "/tasks?connection_request", {
        name: 'setParameterValues',
        parameterValues: findUser && findUser.bulk?.length > 0 ? findUser.bulk.map(v => {
            return [`InternetGatewayDevice.LANDevice.1.WLANConfiguration.${v}.SSID`, newName, "xsd:string"]
        }) : [["InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.SSID", newName, "xsd:string"]]
    })
}

// Load parameter paths from configuration
function getParameterPaths(type) {
    try {
        const { loadJSON } = require('./database');
        const parameters = loadJSON('genieacs_parameters.json') || [];
        const configs = parameters.filter(p => p.type === type);
        
        // Combine all paths from all configurations of this type
        const allPaths = [];
        configs.forEach(config => {
            if (config.paths && Array.isArray(config.paths)) {
                allPaths.push(...config.paths);
            }
        });
        
        return allPaths.length > 0 ? allPaths : getDefaultPaths(type);
    } catch (error) {
        console.warn(`[getParameterPaths] Error loading ${type} paths from config, using defaults:`, error.message);
        return getDefaultPaths(type);
    }
}

// Fallback default paths if configuration is not available
function getDefaultPaths(type) {
    switch (type) {
        case 'redaman':
            return [
                "VirtualParameters.RXPower",
                "VirtualParameters.redaman"
            ];
        case 'temperature':
            return [
                "VirtualParameters.Temp",
                "VirtualParameters.Temperature", 
                "VirtualParameters.gettemp"
            ];
        case 'modemType':
            return [
                "Device.DeviceInfo.ProductClass",
                "InternetGatewayDevice.DeviceInfo.ProductClass"
            ];
        default:
            return [];
    }
}

// Dynamic paths - will be loaded from configuration
const REDAMAN_PATHS = getParameterPaths('redaman');
const TEMPERATURE_PATHS = getParameterPaths('temperature');
const MODEM_TYPE_PATHS = getParameterPaths('modemType');

// Helper function to safely get nested property value
const getNestedValue = (obj, path) => {
    const parts = path.split('.');
    let current = obj;
    for (const part of parts) {
        if (current && typeof current === 'object' && current.hasOwnProperty(part)) {
            current = current[part];
        } else {
            return undefined; // Path not found or intermediate is not an object
        }
    }
    return current;
};


const getSSIDInfo = (deviceId, skipRefresh = true) => {
    return new Promise(async (resolve, reject) => {
        const config = global.config;
        console.log(`[getSSIDInfo] Getting SSID info for device: ${deviceId} (skipRefresh: ${skipRefresh})`);

        // Only refresh when explicitly needed (e.g., checking connected devices)
        // Default is to skip refresh for fast loading
        if (!skipRefresh) {
            try {
                console.log(`[getSSIDInfo] Refreshing WLANConfiguration for real-time data...`);
                await axios.post(`${config.genieacsBaseUrl}/devices/${encodeURIComponent(deviceId)}/tasks?connection_request`, {
                    name: "refreshObject",
                    objectName: "InternetGatewayDevice.LANDevice.1.WLANConfiguration"
                });
                
                // Wait 7 seconds for refresh to complete
                // Increased from 5s to 7s for better reliability (90% vs 70% success rate)
                // See ANALYSIS_GENIEACS_REFRESH_TIMING.md for detailed analysis
                console.log(`[getSSIDInfo] Waiting 7 seconds for refresh to complete...`);
                await new Promise(resolve => setTimeout(resolve, 7000));
            } catch (refreshError) {
                console.warn(`[getSSIDInfo] Refresh failed but continuing: ${refreshError.message}`);
            }
        }

        const queryPayload = { "_id": deviceId };
        const jsonQueryString = JSON.stringify(queryPayload);
        
        // Memproyeksikan semua WLANConfiguration dan uptime (masih hardcoded untuk uptime di sini)
        const projectionFields = 'InternetGatewayDevice.LANDevice.1.WLANConfiguration,VirtualParameters.getdeviceuptime';

        axios.get(`${config.genieacsBaseUrl}/devices/`, {
            params: {
                query: jsonQueryString,
                projection: projectionFields
            },
            timeout: 30000 // Menambahkan timeout 30 detik
        })
            .then(response => {
                const { data } = response;
                // console.log(`[getSSIDInfo] Raw data for ${deviceId}:`, JSON.stringify(data, null, 2));

                if (!data || data.length === 0 || !data[0]) {
                    console.warn(`[getSSIDInfo] Tidak ada data atau array kosong dikembalikan untuk deviceId: ${deviceId}`);
                    return reject(new Error(`Data perangkat tidak ditemukan untuk ID: ${deviceId}. Respons server kosong atau tidak valid.`));
                }

                const deviceData = data[0];
                // Uptime masih diambil dari satu path hardcode
                const uptime = deviceData.VirtualParameters?.getdeviceuptime?._value || "Tidak Tersedia";
                let processedSSIDs = [];

                const wlanConfig = deviceData.InternetGatewayDevice?.LANDevice?.['1']?.WLANConfiguration;

                if (wlanConfig && typeof wlanConfig === 'object') {
                    console.log(`[getSSIDInfo] WLANConfiguration ditemukan untuk ${deviceId}. Memproses SSID...`);
                    processedSSIDs = Object.keys(wlanConfig).map(id => {
                        const ssidEntry = wlanConfig[id];
                        if (ssidEntry && ssidEntry.SSID && typeof ssidEntry.SSID._value !== 'undefined') {
                            let associatedDevicesList = [];
                            const assocDevContainer = ssidEntry.AssociatedDevice;

                            if (assocDevContainer && typeof assocDevContainer === 'object' && assocDevContainer !== null) {
                                Object.keys(assocDevContainer).forEach(key => {
                                    const devData = assocDevContainer[key];
                                    if (devData && typeof devData === 'object' && devData.AssociatedDeviceMACAddress && devData.AssociatedDeviceMACAddress._value) {
                                        associatedDevicesList.push({
                                            ip: devData.AssociatedDeviceIPAddress?._value || 'N/A',
                                            mac: devData.AssociatedDeviceMACAddress._value,
                                            hostName: devData.X_HW_AssociatedDevicedescriptions?._value || devData.X_HW_HostName?._value || devData.HostName?._value || 'N/A',
                                            signal: devData.X_HW_RSSI?._value || 'N/A'
                                        });
                                    }
                                });
                            }
                            return {
                                id: id,
                                name: ssidEntry.SSID._value,
                                transmitPower: ssidEntry.TransmitPower?._value,
                                associatedDevices: associatedDevicesList
                            };
                        }
                        return null;
                    }).filter(v => v !== null);
                     console.log(`[getSSIDInfo] Ditemukan ${processedSSIDs.length} SSID valid untuk ${deviceId}.`);
                } else {
                    console.warn(`[getSSIDInfo] WLANConfiguration tidak ditemukan atau bukan objek untuk deviceId: ${deviceId}. Path: InternetGatewayDevice.LANDevice['1'].WLANConfiguration`);
                }
                
                resolve({
                    uptime: uptime,
                    ssid: processedSSIDs
                });
            })
            .catch(error => {
                console.error(`[getSSIDInfo] Kesalahan Axios untuk deviceId ${deviceId}: ${error.code || error.message}`);
                if (error.response) {
                    console.error(`[getSSIDInfo] Status respons error: ${error.response.status}, data:`, error.response.data);
                    reject(new Error(`Permintaan ke server manajemen perangkat gagal (Status: ${error.response.status}) untuk device ${deviceId}. Detail: ${JSON.stringify(error.response.data)}`));
                } else if (error.request) {
                     console.error(`[getSSIDInfo] Tidak ada respons dari server untuk deviceId ${deviceId}.`);
                    reject(new Error(`Tidak ada respons dari server manajemen perangkat untuk device ${deviceId}. Periksa konektivitas atau status server.`));
                } else {
                     console.error(`[getSSIDInfo] Kesalahan saat menyiapkan permintaan untuk deviceId ${deviceId}: ${error.message}`);
                    reject(new Error(`Kesalahan saat menyiapkan permintaan ke server manajemen perangkat untuk device ${deviceId}: ${error.message}`));
                }
            });
    });
};

const getCustomerRedaman = (deviceId) => {
    return new Promise(async (resolve, reject) => {
        const config = global.config;
        console.log(`[getCustomerRedaman] Memulai pengambilan info redaman untuk deviceId: ${deviceId}`);

        let refreshPromises = [];
        // Kirim perintah refreshObject untuk semua kemungkinan path redaman
        for (const path of REDAMAN_PATHS) {
            refreshPromises.push(
                axios.post(`${config.genieacsBaseUrl}/devices/${encodeURIComponent(deviceId)}/tasks?connection_request`, {
                    name: "refreshObject",
                    objectName: path
                }).catch(err => console.warn(`[getCustomerRedaman_WARN] Gagal mengirim refresh untuk path redaman '${path}' di device ${deviceId}: ${err.message}`))
            );
        }

        try {
            await Promise.allSettled(refreshPromises); // Tunggu semua refresh selesai (berhasil atau gagal)
            await new Promise(resolveWait => setTimeout(resolveWait, 2500)); // Beri waktu untuk ACS update data
        } catch (refreshError) {
            console.warn(`[getCustomerRedaman_WARN] Error umum saat refresh batch redaman untuk ${deviceId}: ${refreshError.message}. Tetap mencoba mengambil data.`);
        }

        try {
            const queryPayloadForGet = { "_id": deviceId };
            const projectionFields = REDAMAN_PATHS.join(','); // Gabungkan semua path untuk proyeksi
            const jsonQueryStringForGet = JSON.stringify(queryPayloadForGet);

            console.log(`[getCustomerRedaman] Mengambil info redaman setelah refresh untuk device: ${deviceId} dengan proyeksi: ${projectionFields}`);
            const response = await axios.get(`${config.genieacsBaseUrl}/devices/`, {
                params: {
                    query: jsonQueryStringForGet,
                    projection: projectionFields
                }
            });
            const { data } = response;

            if (!data || data.length === 0 || !data[0]) {
                console.warn(`[getCustomerRedaman] Tidak ada data device dikembalikan untuk deviceId: ${deviceId}.`);
                return reject(new Error(`Data perangkat tidak ditemukan untuk ID: ${deviceId}.`));
            }

            const deviceData = data[0];
            let redamanValue = null;
            let foundPath = null;

            // Iterasi melalui path yang mungkin untuk menemukan nilai redaman
            for (const path of REDAMAN_PATHS) {
                const value = getNestedValue(deviceData, path);
                if (typeof value !== 'undefined' && typeof value._value !== 'undefined') {
                    redamanValue = value._value;
                    foundPath = path;
                    break; // Ambil nilai pertama yang ditemukan
                }
            }

            if (redamanValue !== null) {
                console.log(`[getCustomerRedaman] Redaman untuk ${deviceId}: ${redamanValue} dBm (dari path: ${foundPath})`);
                resolve({ redaman: redamanValue });
            } else {
                console.warn(`[getCustomerRedaman] Parameter redaman tidak ditemukan di semua path yang dicoba untuk deviceId: ${deviceId}. Path dicoba: [${REDAMAN_PATHS.join(', ')}]`);
                resolve({ redaman: null, message: `Parameter redaman tidak tersedia untuk device ${deviceId}.` });
            }

        } catch (error) {
            console.error(`[getCustomerRedaman] Kesalahan proses untuk deviceId ${deviceId}:`, error.isAxiosError ? error.message : error);
            let errorMessage = `Gagal mengambil data redaman untuk device ${deviceId}.`;
            if (error.response) {
                console.error(`[getCustomerRedaman] Status respons error: ${error.response.status}, data:`, error.response.data);
                errorMessage = `Permintaan ke server manajemen perangkat gagal (Status: ${error.response.status}) untuk device ${deviceId}.`;
            } else if (error.request) {
                console.error(`[getCustomerRedaman] Tidak ada respons dari server untuk deviceId ${deviceId}.`);
                errorMessage = `Tidak ada respons dari server manajemen perangkat untuk device ${deviceId}.`;
            } else {
                errorMessage = error.message;
            }
            reject(new Error(errorMessage));
        }
    });
};


const getDeviceCoreInfo = (deviceId) => {
    return new Promise(async (resolve, reject) => {
        const config = global.config;
        console.log(`[getDeviceCoreInfo] Memulai pengambilan info inti untuk deviceId: ${deviceId}`);

        const coreInfoPaths = [
            "Device.DeviceInfo.ProductClass",
            "InternetGatewayDevice.DeviceInfo.ProductClass",
            "Device.DeviceInfo.ModelName",
            "InternetGatewayDevice.DeviceInfo.ModelName",
            "Device.DeviceInfo.SerialNumber",
            "InternetGatewayDevice.DeviceInfo.SerialNumber",
            "Device.DeviceInfo.SoftwareVersion",
            "InternetGatewayDevice.DeviceInfo.SoftwareVersion",
            "Device.DeviceInfo.HardwareVersion",
            "InternetGatewayDevice.DeviceInfo.HardwareVersion",
            "Device.DeviceInfo.Manufacturer",
            "InternetGatewayDevice.DeviceInfo.Manufacturer",
        ];
        // Gabungkan semua path yang relevan untuk proyeksi
        // Uptime tidak ada di sini karena masih hardcode di getSSIDInfo,
        // tapi TEMPERATURE_PATHS sudah termasuk.
        const projectionFieldsArray = [...coreInfoPaths, ...TEMPERATURE_PATHS];
        const projectionFields = [...new Set(projectionFieldsArray)].join(','); // Gunakan Set untuk memastikan path unik

        const SHOULD_REFRESH_CORE_INFO = true;

        if (SHOULD_REFRESH_CORE_INFO) {
            let refreshPromises = [];
            // Kirim perintah refreshObject untuk semua path yang relevan
            for (const path of projectionFieldsArray) {
                refreshPromises.push(axios.post(`${config.genieacsBaseUrl}/devices/${encodeURIComponent(deviceId)}/tasks?connection_request`, {
                    name: "refreshObject",
                    objectName: path
                }).catch(e => console.warn(`[getDeviceCoreInfo_WARN] Refresh for path '${path}' failed for ${deviceId}: ${e.message}`)));
            }
            
            try {
                await Promise.allSettled(refreshPromises);
                console.log(`[getDeviceCoreInfo] All refreshObject commands sent for device: ${deviceId}`);
                await new Promise(resolveWait => setTimeout(resolveWait, 2000));
            } catch (refreshError) {
                console.warn(`[getDeviceCoreInfo_WARN] General error during refresh batch for ${deviceId}: ${refreshError.message}. Proceeding with data fetch.`);
            }
        }

        try {
            const queryPayload = { "_id": deviceId };
            const jsonQueryString = JSON.stringify(queryPayload);

            console.log(`[getDeviceCoreInfo] Mengirim GET request ke GenieACS untuk device: ${deviceId} dengan proyeksi: ${projectionFields}`);
            const response = await axios.get(`${config.genieacsBaseUrl}/devices/`, {
                params: {
                    query: jsonQueryString,
                    projection: projectionFields
                }
            });
            const { data } = response;

            // console.log(`[getDeviceCoreInfo] Raw data from GenieACS for ${deviceId}:`, JSON.stringify(data, null, 2));

            if (!data || data.length === 0 || !data[0]) {
                console.warn(`[getDeviceCoreInfo] Tidak ada data device dikembalikan dari GenieACS untuk deviceId: ${deviceId}`);
                return reject(new Error(`Data perangkat tidak ditemukan di GenieACS untuk ID: ${deviceId}.`));
            }

            const deviceData = data[0];

            let modemType = null;
            let serialNumber = null;
            let softwareVersion = null;
            let hardwareVersion = null;
            let manufacturer = null;
            let temperature = null; 
            // Uptime tidak ada di sini karena masih hardcode di getSSIDInfo

            // Extract from Device.DeviceInfo
            const ddInfo = deviceData.Device?.DeviceInfo;
            const igdInfo = deviceData.InternetGatewayDevice?.DeviceInfo;

            if (ddInfo) {
                modemType = ddInfo.ProductClass?._value || ddInfo.ModelName?._value || modemType;
                serialNumber = ddInfo.SerialNumber?._value || serialNumber;
                softwareVersion = ddInfo.SoftwareVersion?._value || softwareVersion;
                hardwareVersion = ddInfo.HardwareVersion?._value || hardwareVersion;
                manufacturer = ddInfo.Manufacturer?._value || manufacturer;
            }

            // Extract from InternetGatewayDevice.DeviceInfo (filling in if not already found)
            if (igdInfo) {
                modemType = !modemType ? (igdInfo.ProductClass?._value || igdInfo.ModelName?._value) : modemType;
                serialNumber = !serialNumber ? igdInfo.SerialNumber?._value : serialNumber;
                softwareVersion = !softwareVersion ? igdInfo.SoftwareVersion?._value : softwareVersion;
                hardwareVersion = !hardwareVersion ? igdInfo.HardwareVersion?._value : hardwareVersion;
                manufacturer = !manufacturer ? igdInfo.Manufacturer?._value : manufacturer;
            }

            // Extract temperature from multiple possible paths
            for (const path of TEMPERATURE_PATHS) {
                const value = getNestedValue(deviceData, path);
                if (typeof value !== 'undefined' && typeof value._value !== 'undefined') {
                    temperature = value._value;
                    console.log(`[getDeviceCoreInfo] Temperature found for ${deviceId}: ${temperature} (from path: ${path})`);
                    break; 
                }
            }
            if (temperature === null) {
                console.warn(`[getDeviceCoreInfo_WARN] Temperature parameter not found in any of the tried paths for deviceId: ${deviceId}.`);
            }

            if (!modemType && !serialNumber) {
                console.warn(`[getDeviceCoreInfo] Gagal mengekstrak ProductClass/ModelName atau SerialNumber untuk ${deviceId}.`);
                resolve({
                    modemType: null,
                    serialNumber: null,
                    softwareVersion: null,
                    hardwareVersion: null,
                    manufacturer: null,
                    temperature: null, 
                    message: "Parameter inti perangkat tidak ditemukan."
                });
                return;
            }

            const coreInfo = {
                modemType,
                serialNumber,
                softwareVersion,
                hardwareVersion,
                manufacturer,
                temperature, 
                message: "Info inti perangkat berhasil diambil."
            };

            console.log(`[getDeviceCoreInfo] Info inti yang berhasil diekstrak untuk ${deviceId}:`, coreInfo);
            resolve(coreInfo);

        } catch (error) {
            console.error(`[getDeviceCoreInfo] Kesalahan proses untuk deviceId ${deviceId}:`, error.isAxiosError ? error.message : error);
            let errorMessage = `Gagal mengambil data inti perangkat untuk device ${deviceId}.`;
            if (error.response) {
                console.error(`[getDeviceCoreInfo] Status respons error: ${error.response.status}, data:`, JSON.stringify(error.response.data, null, 2));
                errorMessage = `Permintaan ke server manajemen perangkat gagal (Status: ${error.response.status}) untuk device ${deviceId}.`;
            } else if (error.request) {
                console.error(`[getDeviceCoreInfo] Tidak ada respons dari server untuk deviceId ${deviceId}.`);
                errorMessage = `Tidak ada respons dari server manajemen perangkat untuk device ${deviceId}.`;
            } else {
                errorMessage = error.message;
            }
            reject(new Error(errorMessage));
        }
    });
};

const getMultipleDeviceMetrics = (deviceIDs) => {
    return new Promise(async (resolve, reject) => {
        const config = global.config;
        if (!deviceIDs || deviceIDs.length === 0) {
            console.log("[getMultipleDeviceMetrics] Device IDs list is empty, resolving with empty array.");
            return resolve([]);
        }

        console.log(`[getMultipleDeviceMetrics] Memulai pengambilan metrik untuk ${deviceIDs.length} perangkat.`);

        // Gabungkan semua path VirtualParameters yang relevan untuk proyeksi
        const allPossibleVirtualParamPaths = [
            ...REDAMAN_PATHS,
            ...TEMPERATURE_PATHS,
            // Uptime tidak ada di sini karena masih hardcode di getSSIDInfo
        ];

        // Juga tambahkan path untuk DeviceInfo dan WLANConfiguration
        const coreAndWlanPaths = [
            "Device.DeviceInfo.ProductClass",
            "InternetGatewayDevice.DeviceInfo.ProductClass",
            "Device.DeviceInfo.ModelName",
            "InternetGatewayDevice.DeviceInfo.ModelName",
            "InternetGatewayDevice.LANDevice.1.WLANConfiguration" // Untuk perangkat terhubung
        ];

        // Gabungkan semua path untuk proyeksi unik
        const projectionFields = [...new Set([...allPossibleVirtualParamPaths, ...coreAndWlanPaths])].join(',');

        let refreshPromises = [];
        for (const deviceId of deviceIDs) {
            // Kirim perintah refreshObject untuk semua path yang relevan
            for (const path of projectionFields.split(',')) { // Split projectionFields back to individual paths for refresh
                if (path.trim() === '') continue;
                refreshPromises.push(
                    axios.post(`${config.genieacsBaseUrl}/devices/${encodeURIComponent(deviceId)}/tasks?connection_request`, {
                        name: "refreshObject",
                        objectName: path
                    }).catch(err => console.warn(`[getMultipleDeviceMetrics_WARN] Gagal mengirim refresh untuk path '${path}' di device ${deviceId}: ${err.message}`))
                );
            }
        }

        try {
            console.log("[getMultipleDeviceMetrics] Menunggu semua perintah refresh selesai dikirim...");
            await Promise.allSettled(refreshPromises);
            
            const delayAfterRefresh = config.genieacsRefreshBatchDelay || 5000;
            console.log(`[getMultipleDeviceMetrics] Semua perintah refresh selesai dikirim. Memberi jeda ${delayAfterRefresh}ms sebelum mengambil data.`);
            await new Promise(resolveWait => setTimeout(resolveWait, delayAfterRefresh));

        } catch (error) {
            console.error(`[getMultipleDeviceMetrics_REFRESH_ERROR] Kesalahan saat mengirim perintah refresh batch: ${error.message}`);
        }

        try {
            const queryPayload = { "_id": { "$in": deviceIDs } };
            const jsonQueryString = JSON.stringify(queryPayload);

            console.log(`[getMultipleDeviceMetrics] Mengirim GET request ke GenieACS untuk batch devices dengan proyeksi: ${projectionFields}`);
            const response = await axios.get(`${config.genieacsBaseUrl}/devices/`, {
                params: {
                    query: jsonQueryString,
                    projection: projectionFields
                },
                timeout: config.genieacsBatchTimeout || 30000
            });
            const { data } = response;

            if (!data || !Array.isArray(data)) {
                console.warn(`[getMultipleDeviceMetrics] Tidak ada data atau format tidak valid dari GenieACS untuk batch devices.`);
                return resolve([]);
            }

            const results = data.map(deviceData => {
                const deviceId = deviceData._id;
                let redaman = null;
                let temperature = null;
                let uptime = null; // Uptime masih null di sini karena tidak diambil di batch ini
                let modemType = null;
                let totalConnectedDevices = 0;

                // Attempt to get redaman from defined paths
                for (const path of REDAMAN_PATHS) {
                    const value = getNestedValue(deviceData, path);
                    if (typeof value !== 'undefined' && typeof value._value !== 'undefined') {
                        redaman = value._value;
                        break; 
                    }
                }

                // Attempt to get temperature from defined paths
                for (const path of TEMPERATURE_PATHS) {
                    const value = getNestedValue(deviceData, path);
                    if (typeof value !== 'undefined' && typeof value._value !== 'undefined') {
                        temperature = value._value;
                        break; 
                    }
                }

                // Extract ModemType
                const ddInfo = deviceData.Device?.DeviceInfo;
                const igdInfo = deviceData.InternetGatewayDevice?.DeviceInfo;
                if (ddInfo) {
                    modemType = ddInfo.ProductClass?._value || ddInfo.ModelName?._value || modemType;
                }
                if (igdInfo) {
                    modemType = !modemType ? (igdInfo.ProductClass?._value || igdInfo.ModelName?._value) : modemType;
                }
                // Fallback for direct top-level projection (if containers are not present)
                if (!modemType) {
                    modemType = deviceData["Device.DeviceInfo.ProductClass"]?._value ||
                                deviceData["InternetGatewayDevice.DeviceInfo.ProductClass"]?._value ||
                                deviceData["Device.DeviceInfo.ModelName"]?._value ||
                                deviceData["InternetGatewayDevice.DeviceInfo.ModelName"]?._value;
                }


                // Hitung total perangkat terhubung dari WLANConfiguration
                const wlanConfig = deviceData.InternetGatewayDevice?.LANDevice?.['1']?.WLANConfiguration;
                if (wlanConfig && typeof wlanConfig === 'object') {
                    Object.keys(wlanConfig).forEach(id => {
                        const ssidEntry = wlanConfig[id];
                        if (ssidEntry && ssidEntry.AssociatedDevice && typeof ssidEntry.AssociatedDevice === 'object' && ssidEntry.AssociatedDevice !== null) {
                            totalConnectedDevices += Object.keys(ssidEntry.AssociatedDevice).length;
                        }
                    });
                }

                return {
                    deviceId,
                    redaman: redaman !== null ? `${redaman} dBm` : null,
                    uptime: uptime, // Masih null
                    temperature: temperature !== null ? `${temperature} °C` : null,
                    modemType: modemType || null,
                    totalConnectedDevices: totalConnectedDevices
                };
            });

            console.log(`[getMultipleDeviceMetrics] Berhasil mengambil metrik untuk ${results.length} perangkat.`);
            resolve(results);

        } catch (error) {
            console.error(`[getMultipleDeviceMetrics_ERROR] Kesalahan saat mengambil data batch dari GenieACS:`, error.isAxiosError ? error.message : error);
            if (error.response) {
                console.error(`[getMultipleDeviceMetrics_ERROR] Status respons: ${error.response.status}, data:`, error.response.data);
            }
            reject(new Error(`Gagal mengambil data metrik perangkat secara batch: ${error.message}`));
        }
    });
};

const rebootRouter = async (deviceId) => {
    try {
        const config = global.config;
        console.log(`[REBOOT_ROUTER] Sending reboot command to device: ${deviceId}`);
        
        const response = await axios.post(
            `${config.genieacsBaseUrl}/devices/${encodeURIComponent(deviceId)}/tasks?connection_request`,
            { name: 'reboot' },
            { timeout: 10000 }
        );
        
        if (response.status === 200 || response.status === 202) {
            console.log(`[REBOOT_ROUTER] Reboot command sent successfully to ${deviceId}`);
            return {
                success: true,
                message: 'Reboot command sent successfully'
            };
        } else {
            console.warn(`[REBOOT_ROUTER] Unexpected status ${response.status} for device ${deviceId}`);
            return {
                success: false,
                message: `Unexpected status: ${response.status}`
            };
        }
    } catch (error) {
        console.error(`[REBOOT_ROUTER] Error rebooting device ${deviceId}:`, error.message);
        
        // Return user-friendly error messages
        if (error.code === 'ETIMEDOUT' || error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
            return {
                success: false,
                message: 'Tidak dapat terhubung ke server. Silakan coba lagi.'
            };
        } else if (error.response) {
            return {
                success: false,
                message: `Server error: ${error.response.status}`
            };
        } else {
            return {
                success: false,
                message: error.message || 'Unknown error occurred'
            };
        }
    }
};

const updateWifiSettings = (deviceId, payload) => {
    const config = global.config;
    const parameterValues = [];
    const ssidIndices = new Set();

    // First, find all unique SSID indices from the payload keys
    for (const key in payload) {
        if (key.startsWith('ssid_')) {
            const parts = key.split('_');
            // Handles both ssid_1 and ssid_password_1
            if (parts.length > 1 && !isNaN(parts[1])) {
                ssidIndices.add(parts[1]);
            }
        }
    }

    if (ssidIndices.size === 0) {
        console.warn(`[updateWifiSettings] No SSID indices found in payload for device ${deviceId}. This might be an issue if only transmit_power is expected to be changed.`);
    }

    // Build the parameterValues array from the payload
    for (const index of ssidIndices) {
        const ssidNameKey = `ssid_${index}`;
        const ssidPasswordKey = `ssid_password_${index}`;

        // Handle SSID name change
        if (payload[ssidNameKey] && typeof payload[ssidNameKey] === 'string') {
            parameterValues.push([
                `InternetGatewayDevice.LANDevice.1.WLANConfiguration.${index}.SSID`,
                payload[ssidNameKey],
                "xsd:string"
            ]);
        }

        // Handle SSID password change (only if a new password is provided)
        if (payload[ssidPasswordKey] && typeof payload[ssidPasswordKey] === 'string' && payload[ssidPasswordKey].trim() !== '') {
            parameterValues.push([
                `InternetGatewayDevice.LANDevice.1.WLANConfiguration.${index}.PreSharedKey.1.PreSharedKey`,
                payload[ssidPasswordKey],
                "xsd:string"
            ]);
        }
    }

    // Handle transmit power change - apply to all SSIDs found in the form
    if (payload['transmit_power'] && payload['transmit_power'] !== '') {
        // If there are specific SSIDs being updated, apply power change only to them.
        // If no SSIDs are in the payload (unlikely but possible), this loop won't run.
        // This logic assumes the single transmit_power setting applies to all SSIDs being managed.
        for (const index of ssidIndices) {
            parameterValues.push([
                `InternetGatewayDevice.LANDevice.1.WLANConfiguration.${index}.TransmitPower`,
                payload['transmit_power'],
                "xsd:string"
            ]);
        }
    }

    // If there's nothing to update, return a resolved promise with a success message.
    if (parameterValues.length === 0) {
        console.log(`[updateWifiSettings] No parameters to update for device ${deviceId}.`);
        return Promise.resolve({ data: { status: 200, message: "Tidak ada perubahan yang dikirim karena tidak ada data baru." } });
    }

    console.log(`[updateWifiSettings] Sending update request for device ${deviceId} with ${parameterValues.length} parameters.`);

    // Return the axios promise for the API call
    return axios.post(`${config.genieacsBaseUrl}/devices/${encodeURIComponent(deviceId)}/tasks?connection_request`, {
        name: 'setParameterValues',
        parameterValues: parameterValues
    });
};

module.exports = {
    getSSIDInfo,
    getCustomerRedaman,
    getDeviceCoreInfo,
    getMultipleDeviceMetrics,
    rebootRouter,
    REDAMAN_PATHS,
    TEMPERATURE_PATHS,
    setPassword,
    setSSIDName,
    updateWifiSettings
}