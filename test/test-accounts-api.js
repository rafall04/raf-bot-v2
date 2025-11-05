/**
 * Test Accounts API
 */

// Mock environment
global.config = {
    jwt: 'test-secret-key'
};

// Load accounts
const fs = require('fs');
const path = require('path');
const accountsPath = path.join(__dirname, '../database/accounts.json');
const accountsData = JSON.parse(fs.readFileSync(accountsPath, 'utf8'));

console.log('📊 ACCOUNTS DATA FROM FILE:');
console.log('=' .repeat(50));
accountsData.forEach(acc => {
    console.log(`ID: ${acc.id}`);
    console.log(`Username: ${acc.username}`);
    console.log(`Name: ${acc.name}`);
    console.log(`Phone: ${acc.phone_number}`);
    console.log(`Role: ${acc.role}`);
    console.log('-'.repeat(30));
});

// Set global accounts
global.accounts = accountsData;

// Test the API data transformation
console.log('\n📡 API RESPONSE FORMAT:');
console.log('=' .repeat(50));

// This is what the API returns (from routes/accounts.js line 24-29)
const accountsWithoutPassword = global.accounts.map(account => ({
    id: account.id,
    username: account.username,
    name: account.name || account.username, // This should include name
    phone_number: account.phone_number || '',
    role: account.role
}));

console.log(JSON.stringify({
    draw: 1,
    recordsTotal: accountsWithoutPassword.length,
    recordsFiltered: accountsWithoutPassword.length,
    data: accountsWithoutPassword
}, null, 2));

console.log('\n✅ TEST COMPLETE');
console.log('Name field should be:', accountsData[0].name ? '✅ PRESENT' : '❌ MISSING');
