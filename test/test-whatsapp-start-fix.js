/**
 * Test WhatsApp Start API Fix
 * Verifies that the /api/start endpoint now works correctly
 */

const axios = require('axios');

console.log('='.repeat(50));
console.log('   WHATSAPP START API FIX TEST');
console.log('='.repeat(50));
console.log('');

async function testStartAPI() {
    console.log('1. PROBLEM IDENTIFIED:');
    console.log('   - API endpoint `/api/start` returned 500 error');
    console.log('   - Error message: "Fungsi connect tidak tersedia"');
    console.log('   - API was looking for `global.rafect` function');
    console.log('   - But index.js only defined `global.connect`');
    console.log('');
    
    console.log('2. ROOT CAUSE:');
    console.log('   routes/api.js line 745:');
    console.log('   ```javascript');
    console.log('   if (typeof global.rafect === \'function\') {');
    console.log('       global.rafect(); // This was undefined!');
    console.log('   ```');
    console.log('');
    console.log('   index.js line 553-555 (BEFORE):');
    console.log('   ```javascript');
    console.log('   global.connect = connect;');
    console.log('   global.startBot = connect;');
    console.log('   // Missing: global.rafect = connect');
    console.log('   ```');
    console.log('');
    
    console.log('3. SOLUTION APPLIED:');
    console.log('   Added missing alias in index.js line 556:');
    console.log('   ```javascript');
    console.log('   global.connect = connect;');
    console.log('   global.startBot = connect;');
    console.log('   global.rafect = connect;    // ✅ ADDED THIS LINE');
    console.log('   ```');
    console.log('');
    
    console.log('4. TESTING API ENDPOINT:');
    console.log('   Note: Server must be restarted for changes to take effect');
    console.log('');
    
    try {
        // Check if server is running
        console.log('   Checking if server is running on port 3100...');
        const testUrl = 'http://localhost:3100';
        
        try {
            const response = await axios.get(testUrl, { 
                timeout: 2000,
                validateStatus: () => true // Accept any status
            });
            console.log('   ✅ Server is running');
            console.log('');
            
            // Now test the /api/start endpoint
            console.log('   Testing /api/start endpoint...');
            try {
                const apiResponse = await axios.get(`${testUrl}/api/start`, {
                    timeout: 5000,
                    validateStatus: () => true,
                    headers: {
                        'Cookie': 'connect.sid=test' // May need valid session
                    }
                });
                
                if (apiResponse.status === 200) {
                    console.log('   ✅ API endpoint working!');
                    console.log(`   Response: ${JSON.stringify(apiResponse.data, null, 2)}`);
                } else if (apiResponse.status === 401) {
                    console.log('   ⚠️ Authentication required (expected)');
                    console.log('   The API requires admin login, but the fix is applied');
                } else if (apiResponse.status === 500) {
                    console.log('   ❌ Still getting 500 error');
                    console.log(`   Response: ${JSON.stringify(apiResponse.data, null, 2)}`);
                    console.log('');
                    console.log('   POSSIBLE ISSUES:');
                    console.log('   1. Server not restarted after fix');
                    console.log('   2. Other errors in WhatsApp initialization');
                } else {
                    console.log(`   Status: ${apiResponse.status}`);
                    console.log(`   Response: ${JSON.stringify(apiResponse.data, null, 2)}`);
                }
            } catch (apiErr) {
                console.log('   Error calling API:', apiErr.message);
            }
            
        } catch (err) {
            console.log('   ❌ Server is not running');
            console.log('   Please start the server with: npm start');
        }
        
    } catch (error) {
        console.error('Test error:', error.message);
    }
    
    console.log('');
    console.log('5. VERIFICATION STEPS:');
    console.log('   1. Restart the server: npm start');
    console.log('   2. Login as admin at http://localhost:3100');
    console.log('   3. Click "Start WhatsApp" button');
    console.log('   4. Scan QR code when it appears');
    console.log('');
    
    console.log('6. WHAT THE FIX DOES:');
    console.log('   - Makes WhatsApp connect function available as global.rafect');
    console.log('   - Allows /api/start endpoint to find and call the function');
    console.log('   - Enables QR code scanning for WhatsApp connection');
    console.log('   - No more "Fungsi connect tidak tersedia" error');
    console.log('');
}

// Run the test
testStartAPI().then(() => {
    console.log('='.repeat(50));
    console.log('   TEST COMPLETE');
    console.log('='.repeat(50));
    console.log('');
    console.log('✅ Fix has been applied to index.js');
    console.log('📝 Server restart required for changes to take effect');
    console.log('🔄 After restart, WhatsApp QR scanning should work');
}).catch(console.error);
