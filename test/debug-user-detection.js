/**
 * Debug Script: User Detection Issue
 * Check why 6285233047094 is not detected
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

console.log('🔍 DEBUG USER DETECTION ISSUE');
console.log('='.repeat(70));

// Test number
const testNumber = '6285233047094';
console.log(`\nTest Number: ${testNumber}`);
console.log('-'.repeat(50));

// Open database
const dbPath = path.join(__dirname, '../database.sqlite');
const db = new sqlite3.Database(dbPath);

// Function to normalize phone number
function normalizePhone(phone) {
    if (!phone) return '';
    
    // Remove all non-digits
    let cleaned = phone.replace(/\D/g, '');
    
    // Handle various formats
    if (cleaned.startsWith('62')) {
        return cleaned; // Already international
    } else if (cleaned.startsWith('0')) {
        return '62' + cleaned.substring(1); // Convert 08xx to 628xx
    } else {
        return '62' + cleaned; // Assume needs 62 prefix
    }
}

// Check database
db.all('SELECT id, phone_number, name, device_id FROM users', (err, users) => {
    if (err) {
        console.error('❌ Database error:', err);
        db.close();
        return;
    }
    
    console.log(`\n📊 Total users in database: ${users.length}`);
    console.log('-'.repeat(50));
    
    // Search for the test number in various formats
    const searchFormats = [
        testNumber,                    // 6285233047094
        testNumber.replace('62', '0'), // 085233047094
        testNumber.replace('62', ''),  // 85233047094
        testNumber.substring(2),       // 85233047094
        '0' + testNumber.substring(2), // 085233047094
    ];
    
    console.log('\n🔍 Searching for user with these formats:');
    searchFormats.forEach(format => {
        console.log(`   - ${format}`);
    });
    
    console.log('\n📝 Users with matching phone numbers:');
    console.log('-'.repeat(50));
    
    let foundUsers = [];
    
    users.forEach(user => {
        if (!user.phone_number) return;
        
        // Check if any format matches
        for (const format of searchFormats) {
            if (user.phone_number.includes(format)) {
                foundUsers.push(user);
                console.log(`\n✅ FOUND USER #${user.id}`);
                console.log(`   Name: ${user.name}`);
                console.log(`   Phone (raw): "${user.phone_number}"`);
                console.log(`   Device ID: ${user.device_id || 'N/A'}`);
                
                // Check for multiple numbers
                if (user.phone_number.includes('|')) {
                    const phones = user.phone_number.split('|');
                    console.log(`   Multiple numbers: ${phones.length}`);
                    phones.forEach((p, idx) => {
                        console.log(`     ${idx + 1}. "${p.trim()}"`);
                    });
                }
                
                // Show what the bot would look for
                const botLookup = testNumber; // What bot has: 6285233047094
                const userPhones = user.phone_number.split('|').map(p => p.trim());
                const wouldMatch = userPhones.includes(botLookup);
                
                console.log(`\n   🤖 Bot lookup: "${botLookup}"`);
                console.log(`   ❓ Would match: ${wouldMatch ? '✅ YES' : '❌ NO'}`);
                
                if (!wouldMatch) {
                    console.log('\n   ⚠️ FORMAT MISMATCH DETECTED!');
                    console.log(`   Bot has: "${botLookup}"`);
                    console.log(`   DB has: "${user.phone_number}"`);
                    
                    // Suggest normalized format
                    const normalizedUserPhones = userPhones.map(p => normalizePhone(p));
                    console.log(`\n   💡 Normalized DB phones:`);
                    normalizedUserPhones.forEach((p, idx) => {
                        console.log(`     ${idx + 1}. "${p}"`);
                    });
                    
                    const wouldMatchNormalized = normalizedUserPhones.includes(normalizePhone(botLookup));
                    console.log(`   ✨ Would match with normalization: ${wouldMatchNormalized ? '✅ YES' : '❌ NO'}`);
                }
                
                break;
            }
        }
    });
    
    if (foundUsers.length === 0) {
        console.log('❌ NO USERS FOUND with test number in any format!');
        
        // Show first 5 users for reference
        console.log('\n📋 Sample users in database:');
        users.slice(0, 5).forEach(user => {
            console.log(`   ID ${user.id}: ${user.name} - Phone: "${user.phone_number}"`);
        });
    }
    
    // Simulate bot logic
    console.log('\n🤖 SIMULATING BOT LOGIC:');
    console.log('-'.repeat(50));
    
    const sender = testNumber + '@s.whatsapp.net';
    const plainSenderNumber = sender.split('@')[0];
    
    console.log(`Sender (WhatsApp): ${sender}`);
    console.log(`PlainSenderNumber: ${plainSenderNumber}`);
    
    // Bot's current logic
    const userFound = users.find(v => 
        v.phone_number && v.phone_number.split("|").includes(plainSenderNumber)
    );
    
    console.log(`\nBot's current logic result: ${userFound ? '✅ User found' : '❌ User NOT found'}`);
    
    if (!userFound && foundUsers.length > 0) {
        console.log('\n🔴 PROBLEM CONFIRMED: User exists but bot can\'t find them!');
        console.log('   Reason: Phone number format mismatch');
        
        // Try with normalization
        const userFoundNormalized = users.find(v => {
            if (!v.phone_number) return false;
            const phones = v.phone_number.split('|').map(p => normalizePhone(p.trim()));
            return phones.includes(normalizePhone(plainSenderNumber));
        });
        
        console.log(`\n✅ With normalization: ${userFoundNormalized ? 'User would be found!' : 'Still not found'}`);
    }
    
    // Show fix
    console.log('\n💡 RECOMMENDED FIX:');
    console.log('-'.repeat(50));
    console.log('Add phone number normalization to wifi-check-handler.js:');
    console.log(`
function normalizePhone(phone) {
    if (!phone) return '';
    let cleaned = phone.replace(/\\D/g, '');
    
    if (cleaned.startsWith('62')) {
        return cleaned;
    } else if (cleaned.startsWith('0')) {
        return '62' + cleaned.substring(1);
    } else {
        return '62' + cleaned;
    }
}

// Update user lookup:
const normalizedSender = normalizePhone(plainSenderNumber);
user = users.find(v => {
    if (!v.phone_number) return false;
    const phones = v.phone_number.split('|').map(p => normalizePhone(p.trim()));
    return phones.includes(normalizedSender);
});
    `);
    
    db.close();
});

console.log('\n⏳ Checking database...');
