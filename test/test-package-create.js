#!/usr/bin/env node

/**
 * Test Package Creation via API
 * Verifies that package creation works without page redirect
 */

const axios = require('axios');

async function testPackageCreate() {
    console.log('Testing Package Creation API');
    console.log('============================\n');
    
    const testPackage = {
        name: 'Test Package ' + Date.now(),
        price: 150000,
        profile: '10Mbps',
        displayProfile: 'Up to 10 Mbps',
        description: 'Test package for verification',
        showInMonthly: true,
        whitelist: false
    };
    
    console.log('Creating test package:', testPackage.name);
    
    try {
        const response = await axios.post('http://localhost:3100/api/packages', testPackage, {
            headers: {
                'Content-Type': 'application/json',
                // Add auth cookie if needed
            },
            validateStatus: function (status) {
                return true; // Accept any status code for testing
            }
        });
        
        console.log('Response status:', response.status);
        console.log('Response type:', response.headers['content-type']);
        
        if (response.status === 200 || response.status === 201) {
            console.log('✅ Package created successfully');
            console.log('Response data:', JSON.stringify(response.data, null, 2));
            
            // The response should be JSON, not HTML
            if (response.headers['content-type'].includes('application/json')) {
                console.log('✅ Response is JSON (correct)');
            } else {
                console.log('❌ Response is not JSON (incorrect)');
            }
        } else if (response.status === 401) {
            console.log('⚠️  Authentication required - this is expected if not logged in');
            console.log('    Test the fix through the web interface instead');
        } else {
            console.log('❌ Failed to create package');
            console.log('Response:', response.data);
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        if (error.code === 'ECONNREFUSED') {
            console.log('\n⚠️  Server not running. Start the server first:');
            console.log('    npm start');
        }
    }
    
    console.log('\n============================');
    console.log('Manual Test Instructions:');
    console.log('1. Open browser: http://localhost:3100/packages');
    console.log('2. Login as admin');
    console.log('3. Click "Tambah Paket"');
    console.log('4. Fill the form and click "Simpan Paket"');
    console.log('5. Should see success notification (NOT JSON page)');
    console.log('6. Table should refresh automatically');
}

// Check if axios is installed
try {
    require('axios');
} catch (error) {
    console.error('axios not installed. Run: npm install axios');
    process.exit(1);
}

testPackageCreate();
