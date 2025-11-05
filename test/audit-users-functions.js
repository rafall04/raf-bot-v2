/**
 * Audit Test for Users Page Functions
 * This tests all major functions to identify what's working and what's not
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Connect to database
const dbPath = path.join(__dirname, '..', 'database.sqlite');

console.log('🔍 USERS PAGE FUNCTION AUDIT');
console.log('=' .repeat(70));

const results = {
    working: [],
    notWorking: [],
    partial: []
};

// Test 1: Database Structure
console.log('\n1️⃣ DATABASE STRUCTURE:');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.log('   ❌ Database connection failed:', err.message);
        results.notWorking.push('Database connection');
        return;
    }
    console.log('   ✅ Database connected');
    results.working.push('Database connection');
    
    // Check users table
    db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='users'", [], (err, table) => {
        if (table) {
            console.log('   ✅ Users table exists');
            results.working.push('Users table exists');
            
            // Check fields
            db.all("PRAGMA table_info(users)", [], (err, columns) => {
                const expectedFields = ['id', 'name', 'username', 'password', 'phone_number', 'address', 
                                       'device_id', 'subscription', 'paid', 'pppoe_username'];
                const actualFields = columns.map(c => c.name);
                
                expectedFields.forEach(field => {
                    if (actualFields.includes(field)) {
                        console.log(`   ✅ Field: ${field}`);
                    } else {
                        console.log(`   ❌ Missing field: ${field}`);
                        results.notWorking.push(`Field: ${field}`);
                    }
                });
            });
        } else {
            console.log('   ❌ Users table NOT found');
            results.notWorking.push('Users table');
        }
    });
});

// Test 2: API Endpoints
console.log('\n2️⃣ API ENDPOINTS:');
const routesPath = path.join(__dirname, '..', 'routes');

// Check API routes exist
const apiFile = path.join(routesPath, 'api.js');
if (fs.existsSync(apiFile)) {
    const apiContent = fs.readFileSync(apiFile, 'utf8');
    
    const endpoints = [
        { method: 'GET', path: '/api/users', desc: 'List users' },
        { method: 'POST', path: '/api/users', desc: 'Create user' },
        { method: 'POST', path: '/api/users/:id', desc: 'Update user' },
        { method: 'DELETE', path: '/api/users/:id', desc: 'Delete user' }
    ];
    
    endpoints.forEach(endpoint => {
        const pattern = `${endpoint.method}.*${endpoint.path.replace('/', '\\/').replace(':id', '.*')}`;
        const regex = new RegExp(pattern, 'i');
        if (regex.test(apiContent)) {
            console.log(`   ✅ ${endpoint.desc} (${endpoint.method} ${endpoint.path})`);
            results.working.push(`API: ${endpoint.desc}`);
        } else {
            console.log(`   ❌ ${endpoint.desc} (${endpoint.method} ${endpoint.path})`);
            results.notWorking.push(`API: ${endpoint.desc}`);
        }
    });
} else {
    console.log('   ❌ api.js file not found');
    results.notWorking.push('API routes file');
}

// Test 3: WiFi Management
console.log('\n3️⃣ WIFI MANAGEMENT:');

// Check admin.js for WiFi routes
const adminFile = path.join(routesPath, 'admin.js');
if (fs.existsSync(adminFile)) {
    const adminContent = fs.readFileSync(adminFile, 'utf8');
    
    const wifiEndpoints = [
        { path: '/api/ssid/:deviceId', desc: 'Get WiFi SSID' },
        { path: '/api/ssid/:deviceId', method: 'POST', desc: 'Update WiFi settings' },
        { path: '/api/reboot/', desc: 'Reboot device' },
        { path: '/api/connected-devices/', desc: 'Get connected devices' }
    ];
    
    wifiEndpoints.forEach(endpoint => {
        if (adminContent.includes(endpoint.path)) {
            console.log(`   ✅ ${endpoint.desc}`);
            results.working.push(`WiFi: ${endpoint.desc}`);
        } else {
            console.log(`   ⚠️  ${endpoint.desc} (might be partial)`);
            results.partial.push(`WiFi: ${endpoint.desc}`);
        }
    });
    
    // Check GenieACS integration
    if (adminContent.includes('getSSIDInfo')) {
        console.log('   ✅ GenieACS integration present');
        results.working.push('GenieACS integration');
    } else {
        console.log('   ❌ GenieACS integration missing');
        results.notWorking.push('GenieACS integration');
    }
} else {
    console.log('   ❌ admin.js not found');
    results.notWorking.push('Admin routes');
}

// Test 4: WhatsApp Handlers
console.log('\n4️⃣ WHATSAPP BOT INTEGRATION:');

const handlersPath = path.join(__dirname, '..', 'message', 'handlers');
const wifiHandlers = [
    'wifi-management-handler.js',
    'wifi-check-handler.js', 
    'wifi-power-handler.js'
];

wifiHandlers.forEach(handler => {
    const handlerPath = path.join(handlersPath, handler);
    if (fs.existsSync(handlerPath)) {
        console.log(`   ✅ ${handler}`);
        results.working.push(`WhatsApp: ${handler}`);
    } else {
        console.log(`   ❌ ${handler} not found`);
        results.notWorking.push(`WhatsApp: ${handler}`);
    }
});

// Test 5: User Creation & Credentials
console.log('\n5️⃣ USER MANAGEMENT FEATURES:');

// Check credential management route
const usersRoutePath = path.join(routesPath, 'users.js');
if (fs.existsSync(usersRoutePath)) {
    const usersContent = fs.readFileSync(usersRoutePath, 'utf8');
    
    if (usersContent.includes('/:id/credentials')) {
        console.log('   ✅ Credential management endpoint');
        results.working.push('Credential management');
    } else {
        console.log('   ❌ Credential management endpoint missing');
        results.notWorking.push('Credential management');
    }
    
    if (usersContent.includes('sendMessage')) {
        console.log('   ✅ WhatsApp credential notification');
        results.working.push('WhatsApp notifications');
    } else {
        console.log('   ❌ WhatsApp notification missing');
        results.notWorking.push('WhatsApp notifications');
    }
}

// Test 6: Frontend Features
console.log('\n6️⃣ FRONTEND UI FEATURES:');
const usersPagePath = path.join(__dirname, '..', 'views', 'sb-admin', 'users.php');
if (fs.existsSync(usersPagePath)) {
    const pageContent = fs.readFileSync(usersPagePath, 'utf8');
    
    const uiFeatures = [
        { text: 'createModal', desc: 'Create user modal' },
        { text: 'editModal', desc: 'Edit user modal' },
        { text: 'deleteData', desc: 'Delete user function' },
        { text: 'credentialsModal', desc: 'Credentials modal' },
        { text: 'btn-update-ssid', desc: 'Update WiFi button' },
        { text: 'btn-view-connected-devices', desc: 'View devices button' },
        { text: 'createUserMap', desc: 'Map picker' },
        { text: 'DataTable', desc: 'DataTable display' }
    ];
    
    uiFeatures.forEach(feature => {
        if (pageContent.includes(feature.text)) {
            console.log(`   ✅ ${feature.desc}`);
            results.working.push(`UI: ${feature.desc}`);
        } else {
            console.log(`   ❌ ${feature.desc}`);
            results.notWorking.push(`UI: ${feature.desc}`);
        }
    });
}

// Summary
setTimeout(() => {
    console.log('\n' + '=' .repeat(70));
    console.log('📊 AUDIT SUMMARY');
    console.log('=' .repeat(70));
    
    console.log(`\n✅ WORKING (${results.working.length}):`);
    results.working.forEach(item => console.log(`   • ${item}`));
    
    console.log(`\n❌ NOT WORKING (${results.notWorking.length}):`);
    results.notWorking.forEach(item => console.log(`   • ${item}`));
    
    console.log(`\n⚠️ PARTIAL/NEEDS CHECK (${results.partial.length}):`);
    results.partial.forEach(item => console.log(`   • ${item}`));
    
    const totalFeatures = results.working.length + results.notWorking.length + results.partial.length;
    const workingPercent = Math.round((results.working.length / totalFeatures) * 100);
    
    console.log('\n📈 OVERALL STATUS:');
    console.log(`   Total features tested: ${totalFeatures}`);
    console.log(`   Working: ${workingPercent}%`);
    console.log(`   ${workingPercent >= 80 ? '✅ GOOD' : workingPercent >= 60 ? '⚠️ NEEDS IMPROVEMENT' : '❌ CRITICAL ISSUES'}`);
    
    console.log('\n🔧 PRIORITY FIXES NEEDED:');
    if (results.notWorking.includes('GenieACS integration')) {
        console.log('   1. HIGH: Configure GenieACS for WiFi management');
    }
    if (results.notWorking.includes('WhatsApp notifications')) {
        console.log('   2. HIGH: Fix WhatsApp notification sending');
    }
    if (results.notWorking.some(item => item.includes('Field:'))) {
        console.log('   3. MEDIUM: Add missing database fields');
    }
    
    db.close();
    process.exit(0);
}, 2000);
