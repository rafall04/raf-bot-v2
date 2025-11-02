/**
 * Complete test untuk memverifikasi deteksi nama dengan data real dari SQLite
 */

console.log('🧪 COMPLETE FLOW TEST - SQLite + accounts.json\n');
console.log('=' .repeat(50) + '\n');

// Import database initialization
const { initializeDatabase } = require('../lib/database');

async function runTest() {
    try {
        // Initialize database (loads SQLite users and JSON files)
        console.log('📂 Initializing database...\n');
        await initializeDatabase();
        
        console.log('✅ Database initialized\n');
        
        // Check what was loaded
        console.log('━'.repeat(50));
        console.log('\n📊 DATA LOADED:\n');
        
        console.log(`• Users from SQLite: ${global.users ? global.users.length : 0}`);
        console.log(`• Accounts from JSON: ${global.accounts ? global.accounts.length : 0}`);
        
        // Show users
        console.log('\n📋 USERS (from SQLite):\n');
        if (global.users && global.users.length > 0) {
            global.users.forEach(user => {
                console.log(`  ID: ${user.id}`);
                console.log(`  Name: ${user.name || 'NO NAME'}`);
                console.log(`  Phone: ${user.phone_number || 'NO PHONE'}`);
                console.log(`  Device: ${user.device_id || 'NO DEVICE'}`);
                console.log('');
            });
        } else {
            console.log('  ❌ No users loaded!');
        }
        
        // Show teknisi accounts
        console.log('📋 TEKNISI (from accounts.json):\n');
        const teknisiAccounts = global.accounts ? global.accounts.filter(a => a.role === 'teknisi') : [];
        if (teknisiAccounts.length > 0) {
            teknisiAccounts.forEach(teknisi => {
                console.log(`  ID: ${teknisi.id}`);
                console.log(`  Name: ${teknisi.name || 'NO NAME'}`);
                console.log(`  Username: ${teknisi.username}`);
                console.log(`  Phone: ${teknisi.phone_number}`);
                console.log('');
            });
        } else {
            console.log('  ❌ No teknisi accounts found!');
        }
        
        // Test user finding
        console.log('━'.repeat(50));
        console.log('\n🧪 TEST USER FINDING:\n');
        
        const testSender = '6285233047094@s.whatsapp.net';
        const senderPhone = testSender.replace('@s.whatsapp.net', '');
        
        console.log(`WhatsApp sender: ${testSender}`);
        console.log(`Phone extracted: ${senderPhone}\n`);
        
        // Simulate the logic from smart-report-handler.js
        const user = global.users.find(u => {
            if (!u.phone_number) return false;
            
            const phones = u.phone_number.split("|");
            
            return phones.some(phone => {
                const cleanPhone = phone.trim();
                
                // If sender has 62 prefix (6285233047094)
                if (senderPhone.startsWith('62')) {
                    if (cleanPhone.startsWith('0')) {
                        // Convert 085233047094 to 6285233047094
                        return `62${cleanPhone.substring(1)}` === senderPhone;
                    } else if (cleanPhone.startsWith('62')) {
                        // Already has 62 prefix
                        return cleanPhone === senderPhone;
                    } else {
                        // No prefix, add 62
                        return `62${cleanPhone}` === senderPhone;
                    }
                }
                
                return cleanPhone === senderPhone;
            });
        });
        
        if (user) {
            console.log(`✅ USER FOUND!`);
            console.log(`  Name: ${user.name}`);
            console.log(`  ID: ${user.id}`);
            console.log(`  Phone: ${user.phone_number}`);
        } else {
            console.log(`❌ USER NOT FOUND!`);
            console.log('\nDEBUG: Checking each user...');
            global.users.forEach(u => {
                console.log(`  User ${u.id}: phone="${u.phone_number}", matches=${u.phone_number === senderPhone}`);
            });
        }
        
        // Test teknisi finding
        console.log('\n━'.repeat(50));
        console.log('\n🧪 TEST TEKNISI FINDING:\n');
        
        const teknisiSender = '6289685645956@s.whatsapp.net';
        const teknisiPhone = teknisiSender.replace('@s.whatsapp.net', '');
        
        console.log(`Teknisi sender: ${teknisiSender}`);
        console.log(`Phone extracted: ${teknisiPhone}\n`);
        
        // Remove 62 prefix if exists
        let phoneToMatch = teknisiPhone;
        if (teknisiPhone.startsWith('62')) {
            phoneToMatch = teknisiPhone.substring(2);
        }
        
        const teknisi = global.accounts.find(acc => {
            if (acc.role !== 'teknisi') return false;
            
            return acc.phone_number === phoneToMatch || 
                   acc.phone_number === teknisiPhone ||
                   `62${acc.phone_number}` === teknisiPhone;
        });
        
        if (teknisi) {
            console.log(`✅ TEKNISI FOUND!`);
            console.log(`  Name: ${teknisi.name || teknisi.username}`);
            console.log(`  Username: ${teknisi.username}`);
            console.log(`  Phone: ${teknisi.phone_number}`);
        } else {
            console.log(`❌ TEKNISI NOT FOUND!`);
        }
        
        // Summary
        console.log('\n' + '═'.repeat(50));
        console.log('\n📊 SUMMARY:\n');
        
        const issues = [];
        
        if (!user) {
            issues.push('User detection failed - check phone format in SQLite');
        }
        
        if (!teknisi) {
            issues.push('Teknisi detection failed - check phone format in accounts.json');
        }
        
        if (user && !user.name) {
            issues.push('User found but has no name field');
        }
        
        if (teknisi && !teknisi.name) {
            issues.push('Teknisi found but has no name field (will use username)');
        }
        
        if (issues.length === 0) {
            console.log('✅ ALL SYSTEMS WORKING CORRECTLY!');
            console.log('\nNames will be detected as:');
            console.log(`  • Pelanggan: "${user.name}"`);
            console.log(`  • Teknisi: "${teknisi.name || teknisi.username}"`);
        } else {
            console.log('❌ ISSUES FOUND:\n');
            issues.forEach(issue => {
                console.log(`  • ${issue}`);
            });
        }
        
        console.log('\n✅ TEST COMPLETED!');
        
        // Close database connection
        if (global.db) {
            global.db.close();
        }
        
        process.exit(0);
        
    } catch (error) {
        console.error('\n❌ TEST FAILED:', error);
        process.exit(1);
    }
}

// Run the test
runTest();
