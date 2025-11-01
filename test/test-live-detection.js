/**
 * Live test untuk verifikasi deteksi nama dengan data real
 * Test dengan data yang sebenarnya dari database
 */

console.log('🔴 LIVE TEST - NAME DETECTION WITH REAL DATA\n');
console.log('=' .repeat(50) + '\n');

// Load real database
const { loadJSON } = require('../lib/database');

// Load actual data from files
console.log('📂 Loading actual data from database files...\n');

const users = loadJSON('users.json');
const accounts = loadJSON('accounts.json');

console.log(`✅ Loaded ${users.length} users from users.json`);
console.log(`✅ Loaded ${accounts.length} accounts from accounts.json\n`);

// Set to globals as the system does
global.users = users;
global.accounts = accounts;

// Show sample data
console.log('━'.repeat(50));
console.log('\n📋 SAMPLE USERS DATA:\n');
if (users.length > 0) {
    const sampleUser = users[0];
    console.log('First user:');
    console.log(`  ID: ${sampleUser.id}`);
    console.log(`  Name: ${sampleUser.name || 'UNDEFINED'}`);
    console.log(`  Username: ${sampleUser.username || 'UNDEFINED'}`);  
    console.log(`  Full Name: ${sampleUser.full_name || 'UNDEFINED'}`);
    console.log(`  Phone: ${sampleUser.phone_number}`);
    console.log(`  Address: ${sampleUser.address || 'N/A'}`);
    
    // Check what name field actually exists
    console.log('\n  Available name fields:');
    if (sampleUser.name) console.log('    ✅ name: ' + sampleUser.name);
    if (sampleUser.username) console.log('    ✅ username: ' + sampleUser.username);
    if (sampleUser.full_name) console.log('    ✅ full_name: ' + sampleUser.full_name);
    if (!sampleUser.name && !sampleUser.username && !sampleUser.full_name) {
        console.log('    ❌ NO NAME FIELDS FOUND!');
    }
}

console.log('\n━'.repeat(50));
console.log('\n📋 SAMPLE ACCOUNTS DATA (Teknisi):\n');

const teknisiAccounts = accounts.filter(a => a.role === 'teknisi');
console.log(`Found ${teknisiAccounts.length} teknisi accounts\n`);

if (teknisiAccounts.length > 0) {
    const sampleTeknisi = teknisiAccounts[0];
    console.log('First teknisi:');
    console.log(`  ID: ${sampleTeknisi.id}`);
    console.log(`  Username: ${sampleTeknisi.username || 'UNDEFINED'}`);
    console.log(`  Name: ${sampleTeknisi.name || 'UNDEFINED'}`);
    console.log(`  Phone: ${sampleTeknisi.phone_number}`);
    console.log(`  Role: ${sampleTeknisi.role}`);
    
    // Check what name field actually exists
    console.log('\n  Available name fields:');
    if (sampleTeknisi.name) console.log('    ✅ name: ' + sampleTeknisi.name);
    if (sampleTeknisi.username) console.log('    ✅ username: ' + sampleTeknisi.username);
    if (!sampleTeknisi.name && !sampleTeknisi.username) {
        console.log('    ❌ NO NAME FIELDS FOUND!');
    }
}

// Test phone matching logic
console.log('\n━'.repeat(50));
console.log('\n🧪 TEST PHONE MATCHING LOGIC:\n');

// Simulate WhatsApp sender
const testSender = '6285233047094@s.whatsapp.net';
const senderPhone = testSender.replace('@s.whatsapp.net', '');

console.log(`WhatsApp sender: ${testSender}`);
console.log(`Extracted phone: ${senderPhone}\n`);

// Test user finding logic
const foundUser = global.users.find(u => {
    if (!u.phone_number) return false;
    
    const phones = u.phone_number.split("|");
    
    return phones.some(phone => {
        const cleanPhone = phone.trim();
        
        console.log(`  Checking user ${u.id}: phone "${cleanPhone}"`);
        
        if (senderPhone.startsWith('62')) {
            if (cleanPhone.startsWith('0')) {
                const converted = `62${cleanPhone.substring(1)}`;
                console.log(`    Converting 0xxx to 62xxx: "${converted}" === "${senderPhone}" = ${converted === senderPhone}`);
                return converted === senderPhone;
            } else if (cleanPhone.startsWith('62')) {
                console.log(`    Direct match 62xxx: "${cleanPhone}" === "${senderPhone}" = ${cleanPhone === senderPhone}`);
                return cleanPhone === senderPhone;
            } else {
                const with62 = `62${cleanPhone}`;
                console.log(`    Adding 62: "${with62}" === "${senderPhone}" = ${with62 === senderPhone}`);
                return with62 === senderPhone;
            }
        }
        
        return cleanPhone === senderPhone;
    });
});

if (foundUser) {
    console.log(`\n✅ USER FOUND!`);
    console.log(`  Name: ${foundUser.name || foundUser.username || foundUser.full_name || 'NO NAME FIELD'}`);
    console.log(`  ID: ${foundUser.id}`);
} else {
    console.log(`\n❌ USER NOT FOUND for ${senderPhone}`);
}

// Test teknisi finding
console.log('\n━'.repeat(50));
console.log('\n🧪 TEST TEKNISI MATCHING:\n');

const teknisiSender = '6289685645956@s.whatsapp.net';
const teknisiPhone = teknisiSender.replace('@s.whatsapp.net', '');

console.log(`Teknisi sender: ${teknisiSender}`);
console.log(`Extracted phone: ${teknisiPhone}\n`);

// Remove 62 prefix if exists
let phoneToMatch = teknisiPhone;
if (teknisiPhone.startsWith('62')) {
    phoneToMatch = teknisiPhone.substring(2);
    console.log(`Phone without 62: ${phoneToMatch}`);
}

const foundTeknisi = global.accounts.find(acc => {
    if (acc.role !== 'teknisi') return false;
    
    console.log(`  Checking teknisi: "${acc.phone_number}"`);
    
    const match1 = acc.phone_number === phoneToMatch;
    const match2 = acc.phone_number === teknisiPhone;
    const match3 = `62${acc.phone_number}` === teknisiPhone;
    
    console.log(`    phoneToMatch: ${match1}`);
    console.log(`    direct: ${match2}`);
    console.log(`    with 62: ${match3}`);
    
    return match1 || match2 || match3;
});

if (foundTeknisi) {
    console.log(`\n✅ TEKNISI FOUND!`);
    console.log(`  Name: ${foundTeknisi.name || foundTeknisi.username || 'NO NAME FIELD'}`);
    console.log(`  Username: ${foundTeknisi.username}`);
} else {
    console.log(`\n❌ TEKNISI NOT FOUND for ${teknisiPhone}`);
}

// DIAGNOSIS
console.log('\n' + '═'.repeat(50));
console.log('\n🔬 DIAGNOSIS:\n');

const issues = [];

// Check user name fields
const usersWithoutName = users.filter(u => !u.name && !u.username && !u.full_name);
if (usersWithoutName.length > 0) {
    issues.push({
        type: 'CRITICAL',
        issue: `${usersWithoutName.length} users have NO name fields`,
        fix: 'Add name field to users in users.json'
    });
}

// Check which name field is most common
const nameFieldCount = {
    name: users.filter(u => u.name).length,
    username: users.filter(u => u.username).length,
    full_name: users.filter(u => u.full_name).length
};

console.log('User name field usage:');
console.log(`  • name: ${nameFieldCount.name} users`);
console.log(`  • username: ${nameFieldCount.username} users`);
console.log(`  • full_name: ${nameFieldCount.full_name} users`);

// Check teknisi name fields
const teknisiWithoutName = teknisiAccounts.filter(t => !t.name && !t.username);
if (teknisiWithoutName.length > 0) {
    issues.push({
        type: 'CRITICAL',
        issue: `${teknisiWithoutName.length} teknisi have NO name fields`,
        fix: 'Add name field to teknisi in accounts.json'
    });
}

if (issues.length > 0) {
    console.log('\n❌ ISSUES FOUND:');
    issues.forEach(issue => {
        console.log(`\n  ${issue.type}: ${issue.issue}`);
        console.log(`  FIX: ${issue.fix}`);
    });
} else {
    console.log('\n✅ No critical issues found');
}

// RECOMMENDATION
console.log('\n' + '═'.repeat(50));
console.log('\n💡 RECOMMENDATIONS:\n');

console.log('1. STANDARDIZE NAME FIELDS:');
console.log('   Users should use: "name" field');
console.log('   Teknisi should use: "name" field (fallback to username)');
console.log('');
console.log('2. CHECK YOUR DATA:');
console.log('   Run: node test/test-live-detection.js');
console.log('   To see what fields actually exist in your database');
console.log('');
console.log('3. FIX HANDLERS TO USE CORRECT FIELDS:');
console.log('   pelangganName: user.name || user.username || user.full_name');
console.log('   teknisiName: teknisi.name || teknisi.username');

console.log('\n✅ TEST COMPLETED!');

// Exit
process.exit(0);
