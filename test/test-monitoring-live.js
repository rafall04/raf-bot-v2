/**
 * Test Monitoring Live Data
 * Verifies the structure of monitoring data
 */

const http = require('http');

const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    reset: '\x1b[0m'
};

function testMonitoringLive() {
    return new Promise((resolve) => {
        const options = {
            hostname: 'localhost',
            port: 3100,
            path: '/api/monitoring/live',
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            }
        };

        const req = http.request(options, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    resolve(json);
                } catch (e) {
                    console.error(`${colors.red}Failed to parse JSON${colors.reset}`);
                    resolve(null);
                }
            });
        });
        
        req.on('error', (error) => {
            console.error(`${colors.red}Request error: ${error.message}${colors.reset}`);
            resolve(null);
        });
        
        req.end();
    });
}

async function runTest() {
    console.log('🔍 Testing Monitoring Live Data Structure...\n');
    
    const response = await testMonitoringLive();
    
    if (!response) {
        console.log(`${colors.red}❌ Failed to get response${colors.reset}`);
        console.log('Make sure server is running: npm start');
        return;
    }
    
    if (!response.data) {
        console.log(`${colors.red}❌ No data in response${colors.reset}`);
        return;
    }
    
    const data = response.data;
    const tests = [];
    
    // Test system health
    tests.push({
        name: 'System Health',
        pass: data.systemHealth && 
              typeof data.systemHealth.score === 'number' &&
              data.systemHealth.status,
        details: data.systemHealth ? `Score: ${data.systemHealth.score}` : 'Missing'
    });
    
    // Test WhatsApp status
    tests.push({
        name: 'WhatsApp Status',
        pass: data.whatsapp && 
              typeof data.whatsapp.connected === 'boolean' &&
              data.whatsapp.uptime,
        details: data.whatsapp ? `Connected: ${data.whatsapp.connected}` : 'Missing'
    });
    
    // Test MikroTik data
    tests.push({
        name: 'MikroTik Data',
        pass: data.mikrotik &&
              typeof data.mikrotik.cpu === 'number' &&
              typeof data.mikrotik.temperature === 'number',
        details: data.mikrotik ? `CPU: ${data.mikrotik.cpu}%, Temp: ${data.mikrotik.temperature}°C` : 'Missing'
    });
    
    // Test Traffic data
    tests.push({
        name: 'Traffic Data',
        pass: data.traffic &&
              data.traffic.download &&
              data.traffic.upload &&
              typeof data.traffic.download.current === 'number',
        details: data.traffic ? `Download: ${data.traffic.download.current} Mbps` : 'Missing'
    });
    
    // Test Users data with sessions
    tests.push({
        name: 'Hotspot Sessions',
        pass: data.users &&
              data.users.hotspot &&
              Array.isArray(data.users.hotspot.sessions),
        details: data.users?.hotspot ? 
            `Active: ${data.users.hotspot.active}, Sessions: ${data.users.hotspot.sessions?.length || 0}` : 
            'Missing'
    });
    
    tests.push({
        name: 'PPPoE Sessions',
        pass: data.users &&
              data.users.pppoe &&
              Array.isArray(data.users.pppoe.sessions),
        details: data.users?.pppoe ? 
            `Active: ${data.users.pppoe.active}, Sessions: ${data.users.pppoe.sessions?.length || 0}` : 
            'Missing'
    });
    
    // Test Resources
    tests.push({
        name: 'Resources',
        pass: data.resources &&
              typeof data.resources.cpu === 'number' &&
              typeof data.resources.memory === 'number' &&
              typeof data.resources.disk === 'number',
        details: data.resources ? 
            `CPU: ${data.resources.cpu}%, Memory: ${data.resources.memory}%, Disk: ${data.resources.disk}%` : 
            'Missing'
    });
    
    // Test Interfaces
    tests.push({
        name: 'Interfaces',
        pass: data.interfaces &&
              Array.isArray(data.interfaces) &&
              data.interfaces.length > 0,
        details: data.interfaces ? `Count: ${data.interfaces.length}` : 'Missing'
    });
    
    // Display results
    console.log('═══════════════════════════════════');
    console.log('TEST RESULTS:\n');
    
    tests.forEach(test => {
        const icon = test.pass ? '✅' : '❌';
        const color = test.pass ? colors.green : colors.red;
        console.log(`${icon} ${test.name}`);
        console.log(`   ${color}${test.details}${colors.reset}\n`);
    });
    
    const passed = tests.filter(t => t.pass).length;
    const failed = tests.filter(t => !t.pass).length;
    
    console.log('═══════════════════════════════════');
    console.log('SUMMARY:');
    console.log(`   ${colors.green}Passed: ${passed}${colors.reset}`);
    console.log(`   ${colors.red}Failed: ${failed}${colors.reset}`);
    
    if (failed === 0) {
        console.log(`\n${colors.green}✨ ALL DATA STRUCTURES CORRECT!${colors.reset}`);
        
        // Show sample session data
        if (data.users?.hotspot?.sessions?.length > 0) {
            console.log('\n📊 Sample Hotspot Session:');
            console.log(JSON.stringify(data.users.hotspot.sessions[0], null, 2));
        }
        
        if (data.users?.pppoe?.sessions?.length > 0) {
            console.log('\n📊 Sample PPPoE Session:');
            console.log(JSON.stringify(data.users.pppoe.sessions[0], null, 2));
        }
        
        if (data.interfaces?.length > 0) {
            console.log('\n📊 Sample Interface:');
            console.log(JSON.stringify(data.interfaces[0], null, 2));
        }
    } else {
        console.log(`\n${colors.red}⚠️  SOME DATA MISSING${colors.reset}`);
        console.log('\nFull response data:');
        console.log(JSON.stringify(data, null, 2));
    }
}

// Run test
runTest();
