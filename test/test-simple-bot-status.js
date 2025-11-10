#!/usr/bin/env node

/**
 * Simple Test for Bot Status
 * Tests if the server can start and respond correctly
 */

const http = require('http');

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
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    resolve({ status: res.statusCode, data: json });
                } catch (e) {
                    resolve({ status: res.statusCode, data: data });
                }
            });
        });
        
        req.on('error', (error) => {
            reject(error);
        });
        
        req.end();
    });
}

async function testBotStatus() {
    console.log('Simple Bot Status Test');
    console.log('======================\n');
    
    // Test 1: Check if server is running
    console.log('Test 1: Server Check');
    try {
        const stats = await makeRequest('/api/stats');
        console.log('✅ Server is running');
        console.log('   Bot Status:', stats.data.botStatus ? 'ONLINE' : 'OFFLINE');
        console.log('   Users:', stats.data.users);
    } catch (error) {
        console.log('❌ Server not running:', error.message);
        console.log('   Run: npm start');
        return;
    }
    
    // Test 2: Check bot-status endpoint
    console.log('\nTest 2: Bot Status Endpoint');
    try {
        const status = await makeRequest('/api/bot-status');
        console.log('   Connection State:', status.data.connectionState);
        console.log('   Has RAF:', status.data.hasRafObject ? 'Yes' : 'No');
        console.log('   Has User:', status.data.userInfo ? 'Yes' : 'No');
        console.log('   Final Status:', status.data.botStatus ? '✅ ONLINE' : '❌ OFFLINE');
    } catch (error) {
        console.log('❌ Failed:', error.message);
    }
    
    // Test 3: Try sync
    console.log('\nTest 3: Sync Status');
    try {
        const sync = await makeRequest('/api/sync-status');
        if (sync.data.success) {
            console.log('✅ Sync successful');
            console.log('   State:', sync.data.status.connectionState);
        } else {
            console.log('❌ Sync failed:', sync.data.error);
        }
    } catch (error) {
        console.log('❌ Failed:', error.message);
    }
    
    console.log('\n======================');
    console.log('Test Complete');
}

// Run test
testBotStatus().catch(console.error);
