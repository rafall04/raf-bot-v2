const fs = require('fs').promises;
const path = require('path');

const WIFI_LOGS_FILE = path.join(__dirname, '../database/wifi_change_logs.json');

/**
 * Log WiFi/SSID changes with detailed information
 * @param {Object} logData - The log data object
 * @param {string} logData.userId - ID of the user whose WiFi was changed
 * @param {string} logData.deviceId - Device ID that was modified
 * @param {string} logData.changeType - Type of change: 'ssid_name', 'password', 'both', 'transmit_power'
 * @param {Object} logData.changes - Object containing old and new values
 * @param {string} logData.changedBy - Who made the change (admin username, technician, wa_bot, etc.)
 * @param {string} logData.changeSource - Source of change: 'web_admin', 'web_technician', 'wa_bot', 'api'
 * @param {string} logData.customerName - Name of the customer
 * @param {string} logData.customerPhone - Phone number of the customer
 * @param {string} [logData.reason] - Optional reason for the change
 * @param {string} [logData.notes] - Optional additional notes
 */
async function logWifiChange(logData) {
    try {
        // Validate required fields
        const requiredFields = ['userId', 'deviceId', 'changeType', 'changes', 'changedBy', 'changeSource', 'customerName'];
        for (const field of requiredFields) {
            if (!logData[field]) {
                throw new Error(`Missing required field: ${field}`);
            }
        }

        // Ensure password is stored properly for password changes
        if (logData.changeType === 'password' && logData.changes) {
            // Make sure newPassword is set if provided
            if (logData.newPassword && !logData.changes.newPassword) {
                logData.changes.newPassword = logData.newPassword;
            }
            // Ensure passwordChanged flag is set
            logData.changes.passwordChanged = true;
        }

        // Create log entry
        const logEntry = {
            id: generateLogId(),
            timestamp: new Date().toISOString(),
            userId: logData.userId,
            deviceId: logData.deviceId,
            customerName: logData.customerName,
            customerPhone: logData.customerPhone || 'N/A',
            changeType: logData.changeType,
            changes: logData.changes,
            changedBy: logData.changedBy,
            changeSource: logData.changeSource,
            reason: logData.reason || 'Tidak disebutkan',
            notes: logData.notes || '',
            ipAddress: logData.ipAddress || 'N/A',
            userAgent: logData.userAgent || 'N/A'
        };

        // Read existing logs
        let logs = [];
        try {
            const data = await fs.readFile(WIFI_LOGS_FILE, 'utf8');
            logs = JSON.parse(data);
        } catch (error) {
            if (error.code !== 'ENOENT') {
                console.warn('[WiFi Logger] Error reading existing logs:', error.message);
            }
            // File doesn't exist or is corrupted, start with empty array
            logs = [];
        }

        // Add new log entry
        logs.push(logEntry);

        // Keep only last 1000 entries to prevent file from growing too large
        if (logs.length > 1000) {
            logs = logs.slice(-1000);
        }

        // Write back to file
        await fs.writeFile(WIFI_LOGS_FILE, JSON.stringify(logs, null, 2));

        console.log(`[WiFi Logger] Logged WiFi change for user ${logData.userId}, device ${logData.deviceId}, type: ${logData.changeType}`);
        
        return logEntry;
    } catch (error) {
        console.error('[WiFi Logger] Error logging WiFi change:', error);
        throw error;
    }
}

/**
 * Get WiFi change logs with filtering options
 * @param {Object} filters - Filter options
 * @param {string} [filters.userId] - Filter by user ID
 * @param {string} [filters.deviceId] - Filter by device ID
 * @param {string} [filters.changeType] - Filter by change type
 * @param {string} [filters.changedBy] - Filter by who made the change
 * @param {string} [filters.changeSource] - Filter by change source
 * @param {string} [filters.dateFrom] - Filter from date (ISO string)
 * @param {string} [filters.dateTo] - Filter to date (ISO string)
 * @param {number} [filters.limit] - Limit number of results (default: 100)
 * @param {number} [filters.offset] - Offset for pagination (default: 0)
 */
async function getWifiChangeLogs(filters = {}) {
    try {
        // Read logs
        let logs = [];
        try {
            const data = await fs.readFile(WIFI_LOGS_FILE, 'utf8');
            logs = JSON.parse(data);
        } catch (error) {
            if (error.code !== 'ENOENT') {
                console.warn('[WiFi Logger] Error reading logs:', error.message);
            }
            return { logs: [], total: 0 };
        }

        // Apply filters
        let filteredLogs = logs;

        if (filters.userId) {
            filteredLogs = filteredLogs.filter(log => log.userId === filters.userId);
        }

        if (filters.deviceId) {
            filteredLogs = filteredLogs.filter(log => log.deviceId === filters.deviceId);
        }

        if (filters.changeType) {
            filteredLogs = filteredLogs.filter(log => log.changeType === filters.changeType);
        }

        if (filters.changedBy) {
            filteredLogs = filteredLogs.filter(log => log.changedBy.toLowerCase().includes(filters.changedBy.toLowerCase()));
        }

        if (filters.changeSource) {
            filteredLogs = filteredLogs.filter(log => log.changeSource === filters.changeSource);
        }

        if (filters.dateFrom) {
            const fromDate = new Date(filters.dateFrom);
            filteredLogs = filteredLogs.filter(log => new Date(log.timestamp) >= fromDate);
        }

        if (filters.dateTo) {
            const toDate = new Date(filters.dateTo);
            filteredLogs = filteredLogs.filter(log => new Date(log.timestamp) <= toDate);
        }

        // Sort by timestamp (newest first)
        filteredLogs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        const total = filteredLogs.length;

        // Apply pagination
        const limit = filters.limit || 100;
        const offset = filters.offset || 0;
        const paginatedLogs = filteredLogs.slice(offset, offset + limit);

        return {
            logs: paginatedLogs,
            total: total,
            limit: limit,
            offset: offset
        };
    } catch (error) {
        console.error('[WiFi Logger] Error getting WiFi logs:', error);
        throw error;
    }
}

/**
 * Get WiFi change statistics
 */
async function getWifiChangeStats() {
    try {
        const { logs } = await getWifiChangeLogs();
        
        const stats = {
            totalChanges: logs.length,
            changesByType: {},
            changesBySource: {},
            changesByUser: {},
            recentChanges: logs.slice(0, 10),
            changesLast24h: 0,
            changesLast7d: 0,
            changesLast30d: 0
        };

        const now = new Date();
        const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

        logs.forEach(log => {
            const logDate = new Date(log.timestamp);
            
            // Count by type
            stats.changesByType[log.changeType] = (stats.changesByType[log.changeType] || 0) + 1;
            
            // Count by source
            stats.changesBySource[log.changeSource] = (stats.changesBySource[log.changeSource] || 0) + 1;
            
            // Count by user (changed by)
            stats.changesByUser[log.changedBy] = (stats.changesByUser[log.changedBy] || 0) + 1;
            
            // Count time-based stats
            if (logDate >= oneDayAgo) stats.changesLast24h++;
            if (logDate >= sevenDaysAgo) stats.changesLast7d++;
            if (logDate >= thirtyDaysAgo) stats.changesLast30d++;
        });

        return stats;
    } catch (error) {
        console.error('[WiFi Logger] Error getting WiFi stats:', error);
        throw error;
    }
}

/**
 * Generate unique log ID
 */
function generateLogId() {
    return `wifi_log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Format change description for display
 */
function formatChangeDescription(log) {
    const { changeType, changes } = log;
    
    switch (changeType) {
        case 'ssid_name':
            return `SSID: ${changes.newSsidName}`;
        case 'password':
            return `Password: ${changes.newPassword}`;
        case 'both':
            return `SSID: ${changes.newSsidName} | Password: ${changes.newPassword}`;
        case 'transmit_power':
            return `Transmit power: ${changes.oldTransmitPower || 'N/A'} → ${changes.newTransmitPower}`;
        default:
            return `Perubahan WiFi: ${changeType}`;
    }
}

/**
 * Get change source display name
 */
function getChangeSourceDisplay(source) {
    const sourceMap = {
        'web_admin': 'Web Admin',
        'web_technician': 'Web Teknisi',
        'wa_bot': 'WhatsApp Bot',
        'api': 'API'
    };
    return sourceMap[source] || source;
}

module.exports = {
    logWifiChange,
    getWifiChangeLogs,
    getWifiChangeStats,
    formatChangeDescription,
    getChangeSourceDisplay
};
