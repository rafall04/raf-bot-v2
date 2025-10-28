/**
 * Report Handler - Utilities for managing reports
 */

const fs = require('fs');
const path = require('path');

// Path to reports database
const reportsDbPath = path.join(__dirname, '../../database/reports.json');

/**
 * Save reports array to file
 * @param {Array} reports - Array of report objects
 */
function saveReportsToFile(reports) {
    try {
        // Ensure database directory exists
        const dbDir = path.dirname(reportsDbPath);
        if (!fs.existsSync(dbDir)) {
            fs.mkdirSync(dbDir, { recursive: true });
        }
        
        // Save reports to file with pretty formatting
        fs.writeFileSync(reportsDbPath, JSON.stringify(reports, null, 2), 'utf8');
        console.log(`[REPORTS_SAVED] ${reports.length} reports saved to database`);
        return true;
    } catch (error) {
        console.error('[REPORTS_SAVE_ERROR]', error);
        return false;
    }
}

/**
 * Load reports from file
 * @returns {Array} Array of report objects
 */
function loadReportsFromFile() {
    try {
        if (fs.existsSync(reportsDbPath)) {
            const data = fs.readFileSync(reportsDbPath, 'utf8');
            return JSON.parse(data);
        }
        return [];
    } catch (error) {
        console.error('[REPORTS_LOAD_ERROR]', error);
        return [];
    }
}

module.exports = {
    saveReportsToFile,
    loadReportsFromFile
};