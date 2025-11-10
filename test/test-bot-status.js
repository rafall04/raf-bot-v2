#!/usr/bin/env node

/**
 * Test Bot Status Detection
 * Verifies WhatsApp bot status is correctly reported
 */

const axios = require('axios');

async function testBotStatus() {
    console.log('Testing WhatsApp Bot Status Detection');
    console.log('=====================================\n');
    
    const baseUrl = 'http://localhost:3100';
    
    try {
        // Test 1: Check /api/bot-status endpoint
        console.log('Test 1: Checking /api/bot-status endpoint...');
        try {
            const statusResponse = await axios.get(`${baseUrl}/api/bot-status`);
            const status = statusResponse.data;
            
            console.log('Bot Status Details:');
            console.log('  Status:', status.botStatus ? '✅ ONLINE' : '❌ OFFLINE');
            console.log('  Connection State:', status.connectionState);
            console.log('  Has RAF Object:', status.hasRafObject ? 'Yes' : 'No');
            console.log('  Has WebSocket:', status.hasWebSocket ? 'Yes' : 'No');
            console.log('  WebSocket State:', status.webSocketStateText);
            
            if (status.userInfo) {
                console.log('  User Info:');
                console.log('    ID:', status.userInfo.id);
                console.log('    Name:', status.userInfo.name);
            } else {
                console.log('  User Info: Not available');
            }
            console.log('');
            
        } catch (error) {
            console.log('❌ Failed to get bot status:', error.message);
        }
        
        // Test 2: Check /api/stats endpoint
        console.log('Test 2: Checking /api/stats endpoint...');
        try {
            const statsResponse = await axios.get(`${baseUrl}/api/stats`);
            const stats = statsResponse.data;
            
            console.log('Dashboard Stats:');
            console.log('  Bot Status:', stats.botStatus ? '✅ ONLINE' : '❌ OFFLINE');
            console.log('  Total Users:', stats.users);
            console.log('  Paid Users:', stats.paidUsers);
            console.log('  Unpaid Users:', stats.unpaidUsers);
            
            if (stats.mikrotikStatus) {
                console.log('  Mikrotik:', stats.mikrotikStatus.connected ? '✅ Connected' : '❌ Offline');
            }
            console.log('');
            
        } catch (error) {
            console.log('❌ Failed to get stats:', error.message);
        }
        
        // Test 3: Check consistency
        console.log('Test 3: Checking consistency...');
        try {
            const [status1, stats1] = await Promise.all([
                axios.get(`${baseUrl}/api/bot-status`),
                axios.get(`${baseUrl}/api/stats`)
            ]);
            
            const botStatusFromDebug = status1.data.botStatus;
            const botStatusFromStats = stats1.data.botStatus;
            
            if (botStatusFromDebug === botStatusFromStats) {
                console.log('✅ Status is CONSISTENT across endpoints');
            } else {
                console.log('❌ Status is INCONSISTENT!');
                console.log('  /api/bot-status says:', botStatusFromDebug ? 'ONLINE' : 'OFFLINE');
                console.log('  /api/stats says:', botStatusFromStats ? 'ONLINE' : 'OFFLINE');
            }
            console.log('');
            
        } catch (error) {
            console.log('❌ Failed consistency check:', error.message);
        }
        
        console.log('=====================================');
        console.log('Summary:');
        console.log('1. Check dashboard at http://localhost:3100');
        console.log('2. Bot status should match console output');
        console.log('3. If offline but should be online, restart app');
        console.log('4. Check for WebSocket connection issues');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        if (error.code === 'ECONNREFUSED') {
            console.log('\n⚠️  Server not running. Start with: npm start');
        }
    }
}

// Check if axios is installed
try {
    require('axios');
} catch (error) {
    console.error('axios not installed. Run: npm install axios');
    process.exit(1);
}

// Run test
testBotStatus();
