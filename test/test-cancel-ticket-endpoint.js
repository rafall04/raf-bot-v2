/**
 * Test Cancel Ticket Endpoint
 * Debug why /api/admin/ticket/cancel returns 404
 */

const axios = require('axios');

console.log('='.repeat(50));
console.log('   CANCEL TICKET ENDPOINT TEST');
console.log('='.repeat(50));
console.log('');

async function testCancelEndpoint() {
    console.log('1. TESTING ENDPOINT AVAILABILITY:');
    console.log('   Endpoint: POST /api/admin/ticket/cancel');
    console.log('');
    
    const baseUrl = 'http://localhost:3100';
    
    try {
        // Test if server is running
        console.log('2. CHECKING SERVER STATUS:');
        try {
            await axios.get(baseUrl, { timeout: 2000, validateStatus: () => true });
            console.log('   ✅ Server is running on port 3100');
        } catch (err) {
            console.log('   ❌ Server is not running');
            console.log('   Please start server with: npm start');
            return;
        }
        
        console.log('');
        console.log('3. TESTING CANCEL ENDPOINT:');
        
        // Test OPTIONS request first (CORS preflight)
        try {
            const optionsResponse = await axios({
                method: 'OPTIONS',
                url: `${baseUrl}/api/admin/ticket/cancel`,
                validateStatus: () => true,
                timeout: 5000
            });
            console.log(`   OPTIONS request status: ${optionsResponse.status}`);
        } catch (err) {
            console.log('   OPTIONS request error:', err.message);
        }
        
        // Test POST request
        try {
            const postResponse = await axios({
                method: 'POST',
                url: `${baseUrl}/api/admin/ticket/cancel`,
                headers: {
                    'Content-Type': 'application/json'
                },
                data: {
                    ticketId: 'TEST123',
                    cancellationReason: 'Test reason'
                },
                validateStatus: () => true,
                timeout: 5000
            });
            
            console.log(`   POST request status: ${postResponse.status}`);
            
            if (postResponse.status === 404) {
                console.log('   ❌ Endpoint NOT FOUND');
                console.log('');
                console.log('   POSSIBLE CAUSES:');
                console.log('   1. Route not registered properly');
                console.log('   2. Router not mounted on app');
                console.log('   3. Route path mismatch');
                console.log('   4. Middleware blocking the route');
            } else if (postResponse.status === 403) {
                console.log('   ⚠️ Authentication required (expected)');
                console.log('   Endpoint exists but needs admin login');
            } else if (postResponse.status === 401) {
                console.log('   ⚠️ Not logged in (expected)');
                console.log('   Endpoint exists but needs authentication');
            } else if (postResponse.status === 200) {
                console.log('   ✅ Endpoint working!');
            } else {
                console.log(`   Response data: ${JSON.stringify(postResponse.data)}`);
            }
            
        } catch (err) {
            console.log('   POST request error:', err.message);
        }
        
        console.log('');
        console.log('4. ROUTE CONFIGURATION CHECK:');
        console.log('   Expected route in routes/tickets.js:');
        console.log('   ```javascript');
        console.log("   router.post('/admin/ticket/cancel', ensureAdmin, async (req, res) => {");
        console.log('       // Handle cancel');
        console.log('   });');
        console.log('   ```');
        console.log('');
        console.log('   Expected mount in index.js:');
        console.log('   ```javascript');
        console.log("   app.use('/api', ticketsRouter);");
        console.log('   ```');
        console.log('');
        console.log('   Full path: /api + /admin/ticket/cancel = /api/admin/ticket/cancel');
        
        console.log('');
        console.log('5. DEBUGGING STEPS:');
        console.log('   1. Check server console for any error messages');
        console.log('   2. Add console.log at start of route handler');
        console.log('   3. Check if ensureAdmin middleware is blocking');
        console.log('   4. Verify route registration order');
        
    } catch (error) {
        console.error('Test error:', error.message);
    }
}

// Run the test
testCancelEndpoint().then(() => {
    console.log('');
    console.log('='.repeat(50));
    console.log('   TEST COMPLETE');
    console.log('='.repeat(50));
}).catch(console.error);
