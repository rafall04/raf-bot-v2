/**
 * Test Monitoring Endpoints
 * Verifies all monitoring API endpoints are working
 */

const http = require('http');

const endpoints = [
    '/api/monitoring/live',
    '/api/monitoring/health', 
    '/api/monitoring/traffic',
    '/api/monitoring/users',
    '/api/monitoring/history',
    '/api/monitoring/live-data',    // Backward compatibility
    '/api/monitoring/traffic-history' // Backward compatibility
];

const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    reset: '\x1b[0m'
};

function testEndpoint(path) {
    return new Promise((resolve) => {
        const options = {
            hostname: 'localhost',
            port: 3100,
            path: path,
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
                    resolve({
                        path,
                        status: res.statusCode,
                        success: res.statusCode === 200,
                        hasData: json && json.data,
                        dataKeys: json.data ? Object.keys(json.data).length : 0,
                        error: json.error || null
                    });
                } catch (e) {
                    resolve({
                        path,
                        status: res.statusCode,
                        success: false,
                        error: 'Invalid JSON response',
                        rawData: data.substring(0, 100)
                    });
                }
            });
        });
        
        req.on('error', (error) => {
            resolve({
                path,
                status: 0,
                success: false,
                error: error.message
            });
        });
        
        req.end();
    });
}

async function runTests() {
    console.log('🔍 Testing Monitoring Endpoints...\n');
    
    const results = [];
    
    for (const endpoint of endpoints) {
        const result = await testEndpoint(endpoint);
        results.push(result);
        
        const statusIcon = result.success ? '✅' : '❌';
        const statusColor = result.success ? colors.green : colors.red;
        
        console.log(`${statusIcon} ${endpoint}`);
        console.log(`   Status: ${statusColor}${result.status}${colors.reset}`);
        
        if (result.hasData) {
            console.log(`   Data Keys: ${result.dataKeys}`);
        }
        
        if (result.error) {
            console.log(`   ${colors.red}Error: ${result.error}${colors.reset}`);
        }
        
        console.log('');
    }
    
    // Summary
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    
    console.log('═══════════════════════════════════');
    console.log('📊 TEST SUMMARY:');
    console.log(`   ${colors.green}Passed: ${successful}${colors.reset}`);
    console.log(`   ${colors.red}Failed: ${failed}${colors.reset}`);
    console.log(`   Total: ${results.length}`);
    
    if (failed === 0) {
        console.log(`\n${colors.green}✨ ALL TESTS PASSED!${colors.reset}`);
    } else {
        console.log(`\n${colors.red}⚠️  SOME TESTS FAILED${colors.reset}`);
        console.log('\nFailed endpoints:');
        results.filter(r => !r.success).forEach(r => {
            console.log(`   - ${r.path}: ${r.error}`);
        });
    }
    
    console.log('\n💡 TIP: Make sure server is running with: npm start');
}

// Check if server is running first
const checkServer = http.get('http://localhost:3100/', (res) => {
    runTests();
}).on('error', (err) => {
    console.log(`${colors.red}❌ Server not running on port 3100${colors.reset}`);
    console.log('   Run: npm start');
    process.exit(1);
});
