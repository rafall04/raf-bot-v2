#!/usr/bin/env node

/**
 * Diagnostic script for Ubuntu WhatsApp status issue
 * Run this on your Ubuntu server to diagnose the problem
 */

const fs = require('fs');
const path = require('path');

console.log('Ubuntu WhatsApp Bot Status Diagnostic');
console.log('======================================\n');

// 1. Check Node.js version
console.log('1. Node.js Version:');
console.log('   ', process.version);
console.log('   Platform:', process.platform);
console.log('   Architecture:', process.arch);

// 2. Check current working directory
console.log('\n2. Working Directory:');
console.log('   CWD:', process.cwd());
console.log('   Script Dir:', __dirname);

// 3. Check config file
console.log('\n3. Config File:');
const configPath = path.join(process.cwd(), 'config.json');
if (fs.existsSync(configPath)) {
    try {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        console.log('   ✅ Config found');
        console.log('   Session Name:', config.sessionName || 'Not set');
        
        // 4. Check session directory
        console.log('\n4. Session Directory:');
        const sessionDir = path.join(process.cwd(), 'sessions', config.sessionName || 'raf');
        const sessionDirRelative = `sessions/${config.sessionName || 'raf'}`;
        
        console.log('   Checking (absolute):', sessionDir);
        console.log('   Checking (relative):', sessionDirRelative);
        
        if (fs.existsSync(sessionDir)) {
            console.log('   ✅ Session directory exists');
            
            // Check permissions
            try {
                fs.accessSync(sessionDir, fs.constants.R_OK);
                console.log('   ✅ Read permission: YES');
            } catch {
                console.log('   ❌ Read permission: NO');
            }
            
            try {
                fs.accessSync(sessionDir, fs.constants.W_OK);
                console.log('   ✅ Write permission: YES');
            } catch {
                console.log('   ❌ Write permission: NO');
            }
            
            // List session files
            const files = fs.readdirSync(sessionDir);
            console.log('   Files found:', files.length);
            if (files.length > 0) {
                console.log('   Session files:');
                files.slice(0, 10).forEach(f => {
                    const stats = fs.statSync(path.join(sessionDir, f));
                    console.log(`     - ${f} (${stats.size} bytes)`);
                });
            }
        } else {
            console.log('   ❌ Session directory NOT found');
            
            // Check if parent sessions directory exists
            const sessionsDir = path.join(process.cwd(), 'sessions');
            if (fs.existsSync(sessionsDir)) {
                console.log('   ✅ Sessions parent directory exists');
                const subdirs = fs.readdirSync(sessionsDir).filter(f => 
                    fs.statSync(path.join(sessionsDir, f)).isDirectory()
                );
                console.log('   Subdirectories:', subdirs.join(', ') || 'none');
            } else {
                console.log('   ❌ Sessions parent directory NOT found');
            }
        }
        
        // 5. Check process user
        console.log('\n5. Process Information:');
        console.log('   User ID:', process.getuid ? process.getuid() : 'N/A');
        console.log('   Group ID:', process.getgid ? process.getgid() : 'N/A');
        console.log('   Process ID:', process.pid);
        
        // 6. Check PM2 environment
        console.log('\n6. PM2 Environment:');
        if (process.env.PM2_HOME) {
            console.log('   ✅ Running under PM2');
            console.log('   PM2 Home:', process.env.PM2_HOME);
            console.log('   PM2 Instance:', process.env.pm_id);
        } else {
            console.log('   Not running under PM2');
        }
        
        // 7. Test global variable simulation
        console.log('\n7. Testing Global Variables:');
        global.raf = null;
        global.whatsappConnectionState = 'close';
        
        console.log('   Initial state:');
        console.log('     global.raf:', global.raf);
        console.log('     global.whatsappConnectionState:', global.whatsappConnectionState);
        
        // Simulate connection
        global.raf = { user: { id: 'test123' } };
        global.whatsappConnectionState = 'open';
        
        console.log('   After setting:');
        console.log('     global.raf:', !!global.raf);
        console.log('     global.whatsappConnectionState:', global.whatsappConnectionState);
        
        const botStatus = !!global.raf && global.whatsappConnectionState === 'open';
        console.log('   Bot Status would be:', botStatus ? 'ONLINE' : 'OFFLINE');
        
    } catch (error) {
        console.log('   ❌ Error reading config:', error.message);
    }
} else {
    console.log('   ❌ Config file not found at:', configPath);
}

// 8. Check if server is running
console.log('\n8. Checking Server Status:');
const http = require('http');

const options = {
    hostname: 'localhost',
    port: 3100,
    path: '/api/bot-status',
    method: 'GET'
};

const req = http.request(options, (res) => {
    let data = '';
    
    res.on('data', (chunk) => {
        data += chunk;
    });
    
    res.on('end', () => {
        try {
            const json = JSON.parse(data);
            console.log('   ✅ Server is running');
            console.log('   Bot Status:', json.botStatus ? 'ONLINE' : 'OFFLINE');
            console.log('   Connection State:', json.connectionState);
            console.log('   Has RAF Object:', json.hasRafObject);
            console.log('   Has User Info:', !!json.userInfo);
            
            if (!json.botStatus) {
                console.log('\n❌ PROBLEM IDENTIFIED:');
                if (!json.hasRafObject) {
                    console.log('   - global.raf is not set');
                }
                if (json.connectionState !== 'open') {
                    console.log('   - global.whatsappConnectionState is:', json.connectionState);
                }
            }
        } catch (e) {
            console.log('   ❌ Error parsing response:', e.message);
        }
        
        // Summary
        console.log('\n======================================');
        console.log('Diagnosis Complete!');
        console.log('\nCommon Issues on Ubuntu:');
        console.log('1. Session files in wrong location');
        console.log('2. Permission issues (especially with PM2)');
        console.log('3. Different working directory');
        console.log('4. Case-sensitive file paths');
        console.log('\nRecommended Fixes:');
        console.log('1. Check session directory exists and has correct permissions');
        console.log('2. Use absolute paths for session directory');
        console.log('3. Ensure PM2 runs with correct user');
        console.log('4. Check logs: pm2 logs');
        
        process.exit(0);
    });
});

req.on('error', (error) => {
    console.log('   ❌ Server not running or not accessible');
    console.log('   Error:', error.message);
    console.log('\n   Start server first:');
    console.log('   npm start');
    console.log('   OR');
    console.log('   pm2 start ecosystem.config.js');
    process.exit(1);
});

req.end();
