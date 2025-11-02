/**
 * Debug test untuk phone matching dengan data real dari database
 */

const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const { loadJSON } = require('../lib/database');

console.log('🔍 DEBUG PHONE MATCHING TEST\n');
console.log('=' .repeat(50) + '\n');

// Test various phone formats
const testPhones = [
    '6285233047094',      // With 62 prefix
    '085233047094',       // With 0 prefix  
    '85233047094',        // No prefix
    '6285604652630',      // Second phone
    '6289685645956',      // Teknisi phone
    '089685645956',       // Teknisi with 0
    '89685645956'         // Teknisi no prefix
];

// Load accounts for teknisi
const accounts = loadJSON('accounts.json');
const teknisiAccounts = accounts.filter(a => a.role === 'teknisi');

console.log('📋 TEKNISI DATA FROM accounts.json:\n');
teknisiAccounts.forEach(t => {
    console.log(`  Username: ${t.username}`);
    console.log(`  Name: ${t.name || 'NO NAME'}`);
    console.log(`  Phone: ${t.phone_number}`);
    console.log('');
});

// Connect to SQLite
const dbPath = path.join(__dirname, '../database/database.sqlite');
const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
    if (err) {
        console.error('❌ Error opening database:', err.message);
        process.exit(1);
    }
    
    console.log('📋 USER DATA FROM SQLite:\n');
    
    // Get all users
    db.all('SELECT id, name, phone_number FROM users', [], (err, users) => {
        if (err) {
            console.error('Error:', err);
            db.close();
            return;
        }
        
        users.forEach(u => {
            console.log(`  ID: ${u.id}`);
            console.log(`  Name: ${u.name || 'NO NAME'}`);
            console.log(`  Phone: ${u.phone_number || 'NO PHONE'}`);
            console.log('');
        });
        
        console.log('━'.repeat(50));
        console.log('\n🧪 TESTING PHONE MATCHING:\n');
        
        // Test each phone format
        testPhones.forEach(testPhone => {
            console.log(`\nTesting: "${testPhone}"`);
            console.log('-'.repeat(30));
            
            // Test against users
            const matchedUser = users.find(u => {
                if (!u.phone_number) return false;
                
                const phones = u.phone_number.split('|');
                
                return phones.some(phone => {
                    const cleanPhone = phone.trim();
                    
                    // Debug each comparison
                    const match1 = cleanPhone === testPhone;
                    const match2 = testPhone.startsWith('62') && cleanPhone.startsWith('0') && 
                                  `62${cleanPhone.substring(1)}` === testPhone;
                    const match3 = testPhone.startsWith('62') && cleanPhone === testPhone;
                    const match4 = testPhone.startsWith('0') && cleanPhone.startsWith('62') &&
                                  cleanPhone === `62${testPhone.substring(1)}`;
                    const match5 = !testPhone.startsWith('0') && !testPhone.startsWith('62') &&
                                  (cleanPhone === `62${testPhone}` || cleanPhone === `0${testPhone}`);
                    
                    if (match1 || match2 || match3 || match4 || match5) {
                        console.log(`  ✅ MATCHED with user phone: "${cleanPhone}"`);
                        console.log(`     Match type: ${
                            match1 ? 'Direct match' :
                            match2 ? 'Convert 0 to 62' :
                            match3 ? '62 prefix match' :
                            match4 ? 'Convert 62 to 0' :
                            match5 ? 'No prefix match' : 'Unknown'
                        }`);
                        return true;
                    }
                    
                    return false;
                });
            });
            
            if (matchedUser) {
                console.log(`  → USER FOUND: ${matchedUser.name} (ID: ${matchedUser.id})`);
            } else {
                console.log(`  → No user found`);
            }
            
            // Test against teknisi
            // Handle teknisi phone format
            let phoneToMatch = testPhone;
            if (testPhone.startsWith('62')) {
                phoneToMatch = testPhone.substring(2);
            } else if (testPhone.startsWith('0')) {
                phoneToMatch = testPhone.substring(1);
            }
            
            const matchedTeknisi = teknisiAccounts.find(acc => {
                const match1 = acc.phone_number === phoneToMatch;
                const match2 = acc.phone_number === testPhone;
                const match3 = acc.phone_number === `62${phoneToMatch}`;
                const match4 = `62${acc.phone_number}` === testPhone;
                
                if (match1 || match2 || match3 || match4) {
                    console.log(`  ✅ MATCHED with teknisi phone: "${acc.phone_number}"`);
                    console.log(`     Match type: ${
                        match1 ? 'phoneToMatch' :
                        match2 ? 'Direct' :
                        match3 ? 'With 62 prefix' :
                        match4 ? 'Add 62 to db phone' : 'Unknown'
                    }`);
                    return true;
                }
                return false;
            });
            
            if (matchedTeknisi) {
                console.log(`  → TEKNISI FOUND: ${matchedTeknisi.name || matchedTeknisi.username}`);
            } else {
                console.log(`  → No teknisi found`);
            }
        });
        
        // Test real WhatsApp format
        console.log('\n' + '═'.repeat(50));
        console.log('\n🎯 REAL WHATSAPP FORMAT TEST:\n');
        
        const realSenders = [
            '6285233047094@s.whatsapp.net',  // Test User phone 1
            '6285604652630@s.whatsapp.net',  // Test User phone 2
            '6289685645956@s.whatsapp.net'   // DAPINN teknisi
        ];
        
        realSenders.forEach(sender => {
            const senderPhone = sender.replace('@s.whatsapp.net', '');
            console.log(`\nWhatsApp sender: ${sender}`);
            console.log(`Extracted: ${senderPhone}`);
            
            // Find user using exact logic from smart-report-handler.js
            const user = users.find(u => {
                if (!u.phone_number) return false;
                
                const phones = u.phone_number.split("|");
                
                return phones.some(phone => {
                    const cleanPhone = phone.trim();
                    
                    if (senderPhone.startsWith('62')) {
                        if (cleanPhone.startsWith('0')) {
                            return `62${cleanPhone.substring(1)}` === senderPhone;
                        } else if (cleanPhone.startsWith('62')) {
                            return cleanPhone === senderPhone;
                        } else {
                            return `62${cleanPhone}` === senderPhone;
                        }
                    }
                    
                    return cleanPhone === senderPhone;
                });
            });
            
            if (user) {
                console.log(`✅ USER FOUND: ${user.name} (ID: ${user.id})`);
            } else {
                console.log(`❌ USER NOT FOUND`);
                
                // Debug why not found
                console.log('\nDEBUG - Checking each user:');
                users.forEach(u => {
                    console.log(`  User ${u.id} phones: "${u.phone_number}"`);
                    if (u.phone_number) {
                        u.phone_number.split('|').forEach(p => {
                            const clean = p.trim();
                            console.log(`    • "${clean}" vs "${senderPhone}" = ${clean === senderPhone}`);
                        });
                    }
                });
            }
        });
        
        console.log('\n✅ TEST COMPLETED!');
        db.close();
    });
});
