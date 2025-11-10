/**
 * Test the /api/users endpoint to ensure it creates users with unique IDs
 */

const http = require('http');

function makeRequest(data) {
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify(data);
        
        const options = {
            hostname: 'localhost',
            port: 3100,
            path: '/api/users',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData),
                // Add auth headers if needed (simulate admin user)
                'Cookie': 'connect.sid=test-session'
            }
        };
        
        const req = http.request(options, (res) => {
            let responseBody = '';
            
            res.on('data', (chunk) => {
                responseBody += chunk;
            });
            
            res.on('end', () => {
                try {
                    const response = JSON.parse(responseBody);
                    resolve({ status: res.statusCode, data: response });
                } catch (error) {
                    resolve({ status: res.statusCode, data: responseBody });
                }
            });
        });
        
        req.on('error', reject);
        req.write(postData);
        req.end();
    });
}

async function testCreateUser() {
    console.log('🧪 Testing User Creation API\n');
    console.log('Note: This test requires the server to be running on port 3100');
    console.log('Note: You must be logged in as admin\n');
    
    const testUser = {
        name: 'Test User ' + Date.now(),
        phone_number: '081234567' + Math.floor(Math.random() * 1000),
        subscription: 'Paket 20 Mbps',
        device_id: 'TEST_' + Date.now(),
        paid: false,
        send_invoice: false
    };
    
    console.log('📤 Creating test user:', testUser.name);
    
    try {
        const response = await makeRequest(testUser);
        
        if (response.status === 201 || response.status === 200) {
            console.log('✅ User created successfully!');
            console.log('📋 Response:', response.data);
            
            if (response.data.data && response.data.data.id) {
                console.log(`\n🆔 New User ID: ${response.data.data.id}`);
                console.log('✅ ID generation is working correctly!');
            }
        } else if (response.status === 403) {
            console.error('❌ Error: Not authorized. Please login as admin first.');
        } else {
            console.error('❌ Error creating user:');
            console.error('Status:', response.status);
            console.error('Response:', response.data);
        }
    } catch (error) {
        console.error('❌ Request failed:', error.message);
        console.log('\nMake sure:');
        console.log('1. The server is running (npm start)');
        console.log('2. You are logged in as admin');
        console.log('3. The server is on port 3100');
    }
}

// Run the test
testCreateUser().then(() => {
    console.log('\n✅ Test completed');
    process.exit(0);
}).catch(error => {
    console.error('❌ Test failed:', error);
    process.exit(1);
});
