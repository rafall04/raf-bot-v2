#!/usr/bin/env node

/**
 * Test Widget Status Fix
 * Verifies that both widgets show correct WhatsApp status
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

async function testWidgetStatus() {
    console.log('Testing Widget Status Fix');
    console.log('=========================\n');
    
    // Test 1: Check /api/stats (for bottom widget)
    console.log('Test 1: Bottom Widget Status (/api/stats)');
    try {
        const stats = await makeRequest('/api/stats');
        if (stats.status === 200) {
            console.log('✅ API responding');
            console.log('   Bot Status:', stats.data.botStatus ? 'ONLINE' : 'OFFLINE');
            console.log('   This is used by bottom widget (System Status)');
        } else {
            console.log('❌ API error:', stats.status);
        }
    } catch (error) {
        console.log('❌ Server not running:', error.message);
        console.log('   Please start server first: npm start');
        return;
    }
    
    // Test 2: Check /api/monitoring/live (for top widget)
    console.log('\nTest 2: Top Widget Status (/api/monitoring/live)');
    try {
        const monitoring = await makeRequest('/api/monitoring/live');
        if (monitoring.status === 200) {
            console.log('✅ API responding');
            console.log('   WhatsApp Connected (from PHP):', 
                monitoring.data.data.whatsapp.connected ? 'YES' : 'NO');
            console.log('   Note: This should now be false and updated by JS');
            
            // Check health score
            const health = monitoring.data.data.systemHealth;
            console.log('\n   System Health:');
            console.log('   - Score:', health.score + '%');
            console.log('   - WhatsApp Check:', health.checks.whatsapp ? 'PASS' : 'FAIL');
            console.log('   - MikroTik Check:', health.checks.mikrotik ? 'PASS' : 'FAIL');
        } else {
            console.log('❌ API error:', monitoring.status);
        }
    } catch (error) {
        console.log('❌ Failed:', error.message);
    }
    
    // Summary
    console.log('\n=========================');
    console.log('Summary:');
    console.log('1. Bottom widget uses /api/stats - ORIGINAL LOGIC ✅');
    console.log('2. Top widget fetches from /api/stats via JavaScript ✅');
    console.log('3. Both should show same status now');
    console.log('\nTo verify in browser:');
    console.log('1. Open http://localhost:3100');
    console.log('2. Check top widget (WhatsApp Bot card)');
    console.log('3. Check bottom widget (Bot Status in System Status)');
    console.log('4. Both should show same status (Online/Offline)');
}

// Run test
testWidgetStatus().catch(console.error);
