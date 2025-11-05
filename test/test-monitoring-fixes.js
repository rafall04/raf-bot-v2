/**
 * Test All Monitoring Fixes
 * Verifies interface switching, PPPoE traffic, and interface statistics
 */

const http = require('http');

const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m', 
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    reset: '\x1b[0m'
};

async function testEndpoint(interface = 'ether1') {
    return new Promise((resolve) => {
        const options = {
            hostname: 'localhost',
            port: 3100,
            path: `/api/monitoring/live?interface=${interface}`,
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
                    resolve(null);
                }
            });
        });
        
        req.on('error', (error) => {
            resolve(null);
        });
        
        req.end();
    });
}

async function runTests() {
    console.log('🔍 Testing Monitoring Fixes...\n');
    
    // Test 1: Interface Switching
    console.log('═══════════════════════════════════');
    console.log('TEST 1: Interface Switching');
    console.log('═══════════════════════════════════\n');
    
    const interfaces = ['ether1', 'ether2', 'ether3'];
    
    for (const iface of interfaces) {
        const response = await testEndpoint(iface);
        
        if (response && response.data) {
            const data = response.data;
            const selectedIface = data.selectedInterface;
            const traffic = data.traffic;
            
            if (selectedIface === iface) {
                console.log(`${colors.green}✅ Interface ${iface}:${colors.reset}`);
                console.log(`   Selected: ${selectedIface}`);
                console.log(`   Download: ${traffic.download.current} Mbps (Total: ${traffic.download.total} GB)`);
                console.log(`   Upload: ${traffic.upload.current} Mbps (Total: ${traffic.upload.total} GB)\n`);
            } else {
                console.log(`${colors.red}❌ Interface ${iface} - Selection mismatch${colors.reset}`);
                console.log(`   Expected: ${iface}, Got: ${selectedIface}\n`);
            }
        } else {
            console.log(`${colors.red}❌ Failed to get data for ${iface}${colors.reset}\n`);
        }
    }
    
    // Test 2: PPPoE Traffic Data
    console.log('═══════════════════════════════════');
    console.log('TEST 2: PPPoE User Traffic');
    console.log('═══════════════════════════════════\n');
    
    const response = await testEndpoint('ether1');
    
    if (response && response.data && response.data.users) {
        const pppoeUsers = response.data.users.pppoe;
        
        console.log(`Total PPPoE users: ${pppoeUsers.active}`);
        
        if (pppoeUsers.sessions && pppoeUsers.sessions.length > 0) {
            console.log('\nFirst 3 PPPoE users with traffic:');
            pppoeUsers.sessions.slice(0, 3).forEach((session, i) => {
                const hasTraffic = session.rx_bytes > 0 || session.tx_bytes > 0;
                const status = hasTraffic ? colors.green + '✅' : colors.yellow + '⚠️';
                
                console.log(`\n${status} User ${i + 1}: ${session.name}${colors.reset}`);
                console.log(`   IP: ${session.address}`);
                console.log(`   Uptime: ${session.uptime}`);
                console.log(`   Download: ${session.rx_mb} MB (${session.rx_bytes} bytes)`);
                console.log(`   Upload: ${session.tx_mb} MB (${session.tx_bytes} bytes)`);
            });
            
            // Check how many users have traffic data
            const usersWithTraffic = pppoeUsers.sessions.filter(s => s.rx_bytes > 0 || s.tx_bytes > 0).length;
            const percentage = Math.round((usersWithTraffic / pppoeUsers.sessions.length) * 100);
            
            console.log(`\n${colors.blue}📊 Traffic Data Coverage: ${usersWithTraffic}/${pppoeUsers.sessions.length} users (${percentage}%)${colors.reset}`);
        } else {
            console.log(`${colors.yellow}⚠️ No PPPoE sessions found${colors.reset}`);
        }
    }
    
    // Test 3: Interface List
    console.log('\n═══════════════════════════════════');
    console.log('TEST 3: Interface Statistics');
    console.log('═══════════════════════════════════\n');
    
    if (response && response.data && response.data.interfaces) {
        const interfaces = response.data.interfaces;
        
        console.log(`Total interfaces: ${interfaces.length}\n`);
        
        interfaces.slice(0, 5).forEach(iface => {
            const status = iface.running ? colors.green + 'UP' : colors.red + 'DOWN';
            console.log(`${status} ${iface.name} (${iface.type})${colors.reset}`);
            console.log(`   RX: ${(iface.rx_bytes / 1073741824).toFixed(2)} GB`);
            console.log(`   TX: ${(iface.tx_bytes / 1073741824).toFixed(2)} GB\n`);
        });
    }
    
    // Summary
    console.log('═══════════════════════════════════');
    console.log('SUMMARY');
    console.log('═══════════════════════════════════\n');
    
    console.log('✅ Tests completed!');
    console.log('\nKey points to verify in browser:');
    console.log('1. Interface selector dropdown shows all interfaces');
    console.log('2. Changing interface updates traffic immediately');
    console.log('3. PPPoE users show actual traffic data');
    console.log('4. Interface statistics table has data and Monitor buttons work');
}

// Run tests
runTests().catch(console.error);
