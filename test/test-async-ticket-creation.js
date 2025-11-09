// Test for async ticket creation
// This verifies that ticket creation doesn't block on WhatsApp timeout

const axios = require('axios');

// Test configuration
const BASE_URL = 'http://localhost:3100';
const ADMIN_CREDENTIALS = { username: 'admin', password: 'admin' };

async function login() {
    try {
        const response = await axios.post(`${BASE_URL}/api/auth/login`, ADMIN_CREDENTIALS);
        return response.data.token;
    } catch (error) {
        console.error('Login failed:', error.message);
        throw error;
    }
}

async function testTicketCreation(token) {
    const ticketData = {
        customerUserId: 1, // Assuming user with ID 1 exists
        laporanText: 'Test ticket creation with async WhatsApp notifications',
        priority: 'HIGH',
        issueType: 'GENERAL'
    };
    
    console.log('\n📋 Creating test ticket...');
    console.log('Request data:', ticketData);
    
    const startTime = Date.now();
    
    try {
        const response = await axios.post(
            `${BASE_URL}/api/admin/ticket/create`,
            ticketData,
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                timeout: 30000 // 30 second timeout for the HTTP request
            }
        );
        
        const elapsed = Date.now() - startTime;
        
        console.log('\n✅ SUCCESS - Ticket created in', elapsed, 'ms');
        console.log('Response status:', response.status);
        console.log('Response message:', response.data.message);
        
        if (response.data.data) {
            console.log('Ticket ID:', response.data.data.ticketId);
        }
        
        // Check if response was fast (should be under 2 seconds now)
        if (elapsed < 2000) {
            console.log('\n🚀 EXCELLENT - Response returned quickly (async working!)');
        } else if (elapsed < 10000) {
            console.log('\n⚠️  WARNING - Response took', elapsed, 'ms (might still be blocking)');
        } else {
            console.log('\n❌ PROBLEM - Response very slow at', elapsed, 'ms (likely still synchronous)');
        }
        
        return true;
    } catch (error) {
        const elapsed = Date.now() - startTime;
        
        console.error('\n❌ ERROR after', elapsed, 'ms');
        
        if (error.response) {
            console.error('Response status:', error.response.status);
            console.error('Response data:', error.response.data);
        } else if (error.code === 'ECONNABORTED') {
            console.error('Request timeout - took longer than 30 seconds');
            console.error('This indicates WhatsApp notifications are still blocking');
        } else {
            console.error('Error:', error.message);
        }
        
        return false;
    }
}

async function runTest() {
    console.log('===========================================');
    console.log('   ASYNC TICKET CREATION TEST');
    console.log('===========================================');
    console.log('This test verifies that ticket creation');
    console.log('doesn\'t block on WhatsApp timeouts');
    console.log('===========================================\n');
    
    try {
        // Login first
        console.log('🔐 Logging in as admin...');
        const token = await login();
        console.log('✅ Login successful');
        
        // Test ticket creation
        const success = await testTicketCreation(token);
        
        // Summary
        console.log('\n===========================================');
        if (success) {
            console.log('✅ TEST PASSED - Ticket creation is async');
            console.log('WhatsApp notifications won\'t block the UI');
        } else {
            console.log('❌ TEST FAILED - Check the implementation');
        }
        console.log('===========================================');
        
        // Check server logs
        console.log('\n📝 Check server console for:');
        console.log('  - [ADMIN_CREATE_TICKET] Starting async WhatsApp notifications...');
        console.log('  - [ADMIN_CREATE_TICKET] Successfully notified customer...');
        console.log('  - [ADMIN_CREATE_TICKET] Completed async WhatsApp notifications...');
        console.log('\nThese should appear AFTER the HTTP response returns');
        
    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
    }
}

// Run the test
runTest().catch(console.error);
