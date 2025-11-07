#!/usr/bin/env node

/**
 * Test Script: Compensation API Routes
 * 
 * This script tests if the compensation routes are properly configured
 * after the fix for 404 errors.
 * 
 * To run: node test/test-compensation-routes.js
 */

const http = require('http');

console.log("🧪 TEST: Compensation API Routes\n");
console.log("=" .repeat(50));

const testRoutes = [
    {
        path: '/api/compensations/active',
        method: 'GET',
        description: 'Get active compensations'
    },
    {
        path: '/api/compensation/apply',
        method: 'POST',
        description: 'Apply compensation',
        body: JSON.stringify({
            customerIds: [],
            speedProfile: '',
            durationDays: 0,
            durationHours: 0,
            durationMinutes: 0,
            notes: ''
        })
    },
    {
        path: '/api/speed-requests',
        method: 'GET',
        description: 'Get speed requests'
    }
];

function testRoute(route) {
    return new Promise((resolve) => {
        const options = {
            hostname: 'localhost',
            port: 3000,
            path: route.path,
            method: route.method,
            headers: {
                'Content-Type': 'application/json'
            },
            // Don't follow redirects
            followRedirect: false
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                // For our test, we just want to ensure it's not 404
                // 401/403 means route exists but needs auth
                // 400 means route exists but bad request
                const routeExists = res.statusCode !== 404;
                resolve({
                    path: route.path,
                    method: route.method,
                    description: route.description,
                    statusCode: res.statusCode,
                    exists: routeExists,
                    message: res.statusCode === 404 ? 'Route not found' : 'Route exists'
                });
            });
        });

        req.on('error', (error) => {
            resolve({
                path: route.path,
                method: route.method,
                description: route.description,
                statusCode: 0,
                exists: false,
                message: `Connection error: ${error.message}`
            });
        });

        if (route.body) {
            req.write(route.body);
        }
        req.end();
    });
}

async function runTests() {
    console.log("\n📋 Testing Compensation Routes:");
    console.log("-".repeat(50));

    const results = [];
    
    for (const route of testRoutes) {
        console.log(`\nTesting: ${route.method} ${route.path}`);
        console.log(`Purpose: ${route.description}`);
        
        const result = await testRoute(route);
        results.push(result);
        
        if (result.exists) {
            console.log(`✅ Route exists (Status: ${result.statusCode})`);
            if (result.statusCode === 401 || result.statusCode === 403) {
                console.log("   (Auth required - this is expected)");
            } else if (result.statusCode === 400) {
                console.log("   (Bad request - route exists but needs valid data)");
            }
        } else if (result.statusCode === 0) {
            console.log(`⚠️  ${result.message}`);
            console.log("   (Make sure the server is running on port 3000)");
        } else {
            console.log(`❌ Route NOT FOUND (404)`);
        }
    }

    // Summary
    console.log("\n" + "=".repeat(50));
    console.log("📊 SUMMARY:");
    console.log("-".repeat(50));

    const existingRoutes = results.filter(r => r.exists);
    const notFoundRoutes = results.filter(r => !r.exists && r.statusCode === 404);
    const errorRoutes = results.filter(r => !r.exists && r.statusCode === 0);

    console.log(`Total routes tested: ${results.length}`);
    console.log(`Routes that exist: ${existingRoutes.length}`);
    console.log(`Routes not found (404): ${notFoundRoutes.length}`);
    console.log(`Connection errors: ${errorRoutes.length}`);

    if (notFoundRoutes.length > 0) {
        console.log("\n❌ FAILED ROUTES:");
        notFoundRoutes.forEach(r => {
            console.log(`   - ${r.method} ${r.path}`);
        });
    }

    if (errorRoutes.length > 0) {
        console.log("\n⚠️  CONNECTION ISSUES:");
        console.log("Make sure the server is running: npm start");
    }

    if (existingRoutes.length === testRoutes.length) {
        console.log("\n✅ ALL ROUTES CONFIGURED CORRECTLY!");
        console.log("\nThe compensation API endpoints are properly set up.");
        console.log("Any 401/403 errors are expected (authentication required).");
    } else if (errorRoutes.length === testRoutes.length) {
        console.log("\n⚠️  SERVER NOT RUNNING");
        console.log("Please start the server first: npm start");
    } else {
        console.log("\n❌ SOME ROUTES ARE MISSING!");
        console.log("Please check the route configuration in routes/compensation.js");
    }

    console.log("\n" + "=".repeat(50));
    console.log("TEST COMPLETE");
    console.log("=" .repeat(50));
}

// Run the tests
runTests().catch(console.error);
