#!/usr/bin/env node

/**
 * Script to clear all report/ticket data
 * Run this when you need a fresh start with tickets
 */

const fs = require('fs');
const path = require('path');

console.log('='.repeat(50));
console.log('   CLEAR REPORTS/TICKETS SCRIPT');
console.log('='.repeat(50));
console.log('');

const reportsPath = path.join(__dirname, '..', 'database', 'reports.json');

try {
    // Check if file exists
    if (fs.existsSync(reportsPath)) {
        // Read current data for backup
        const currentData = fs.readFileSync(reportsPath, 'utf8');
        const reports = JSON.parse(currentData);
        
        // Create backup
        const backupPath = path.join(__dirname, '..', 'database', `reports-backup-${Date.now()}.json`);
        fs.writeFileSync(backupPath, currentData, 'utf8');
        console.log(`✅ Backup created: ${backupPath}`);
        console.log(`   (${reports.length} tickets backed up)`);
        console.log('');
        
        // Clear reports
        fs.writeFileSync(reportsPath, '[]', 'utf8');
        console.log('✅ Reports cleared successfully');
        console.log('   database/reports.json now contains: []');
        console.log('');
        
        console.log('⚠️  IMPORTANT: You must restart the server for changes to take effect!');
        console.log('   1. Stop the server (Ctrl+C)');
        console.log('   2. Run: npm start');
        console.log('');
        console.log('   The server caches reports in memory as global.reports');
        console.log('   Restarting will reload from the empty file.');
        
    } else {
        // Create empty file
        fs.writeFileSync(reportsPath, '[]', 'utf8');
        console.log('✅ Created new empty reports.json file');
        console.log('');
        console.log('⚠️  Remember to restart the server if it\'s running!');
    }
    
    console.log('');
    console.log('='.repeat(50));
    console.log('   DONE');
    console.log('='.repeat(50));
    
} catch (error) {
    console.error('❌ Error clearing reports:', error.message);
    process.exit(1);
}
