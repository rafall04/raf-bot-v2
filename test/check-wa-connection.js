#!/usr/bin/env node

/**
 * Check WhatsApp Connection Issue on Ubuntu
 * Run this AFTER server is running to check connection
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

console.log('WhatsApp Connection Checker');
console.log('===========================\n');

// Function to make HTTP request
function makeRequest(path) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 3100,
            path: path,
            method: 'GET'
        };
        
        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    resolve(data);
                }
            });
        });
        
        req.on('error', reject);
        req.end();
    });
}

async function checkConnection() {
    // 1. Check bot-status endpoint
    console.log('1. Checking /api/bot-status...');
    try {
        const status = await makeRequest('/api/bot-status');
        console.log('   Bot Status:', status.botStatus ? 'ONLINE' : 'OFFLINE');
        console.log('   Connection State:', status.connectionState || 'undefined');
        console.log('   Has RAF Object:', status.hasRafObject || false);
        console.log('   Has CONN Object:', status.hasConnObject || false);
        console.log('   Has WebSocket:', status.hasWebSocket || false);
        console.log('   WebSocket State:', status.webSocketStateText || 'UNKNOWN');
        
        if (status.userInfo) {
            console.log('   User Info:', status.userInfo);
        } else {
            console.log('   User Info: Not available (bot not connected)');
        }
    } catch (error) {
        console.log('   Error:', error.message);
    }
    
    // 2. Try to force start
    console.log('\n2. Attempting to force WhatsApp start...');
    try {
        const result = await makeRequest('/api/start');
        console.log('   Result:', result.message || JSON.stringify(result));
    } catch (error) {
        console.log('   Error:', error.message);
    }
    
    // Wait 5 seconds
    console.log('\n3. Waiting 5 seconds for connection...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // 4. Check status again
    console.log('\n4. Checking status after start attempt...');
    try {
        const status = await makeRequest('/api/bot-status');
        console.log('   Bot Status:', status.botStatus ? 'ONLINE' : 'OFFLINE');
        console.log('   Connection State:', status.connectionState || 'undefined');
        
        if (status.botStatus) {
            console.log('   ✅ Bot is now ONLINE!');
        } else {
            console.log('   ❌ Bot still OFFLINE');
            console.log('\n   Possible issues:');
            console.log('   - Session expired (need to scan QR again)');
            console.log('   - WhatsApp blocked or logged out');
            console.log('   - Network connectivity issues');
            console.log('   - Process needs full restart');
        }
    } catch (error) {
        console.log('   Error:', error.message);
    }
    
    // 5. Check session validity
    console.log('\n5. Checking session files...');
    const config = JSON.parse(fs.readFileSync('config.json', 'utf8'));
    const sessionDir = path.join(process.cwd(), 'sessions', config.sessionName);
    
    if (fs.existsSync(path.join(sessionDir, 'creds.json'))) {
        const creds = JSON.parse(fs.readFileSync(path.join(sessionDir, 'creds.json'), 'utf8'));
        console.log('   Session exists');
        console.log('   Has registration ID:', !!creds.registrationId);
        console.log('   Has identity key:', !!creds.identityKey);
        console.log('   Platform:', creds.platform || 'unknown');
        
        // Check if me object exists (indicates logged in)
        if (creds.me) {
            console.log('   Phone:', creds.me.id || 'unknown');
            console.log('   Name:', creds.me.name || 'unknown');
        } else {
            console.log('   ⚠️  No "me" object - session might be invalid');
        }
    } else {
        console.log('   ❌ No creds.json found');
    }
    
    console.log('\n===========================');
    console.log('Check Complete!\n');
    
    console.log('RECOMMENDATIONS:');
    console.log('1. If bot still offline, try full restart:');
    console.log('   killall node');
    console.log('   npm start');
    console.log('\n2. If session invalid, delete and rescan:');
    console.log('   rm -rf sessions/raf');
    console.log('   npm start');
    console.log('   # Then scan QR code');
    console.log('\n3. Check server logs for errors:');
    console.log('   tail -f logs/*.log');
    console.log('   # or console output if running directly');
}

// Run the check
checkConnection().catch(console.error);
