/**
 * Test untuk verifikasi perbaikan deteksi nama teknisi
 */

console.log('🧪 TEST TEKNISI NAME DETECTION FIX\n');
console.log('=' .repeat(50) + '\n');

// Import required modules
const { initializeDatabase } = require('../lib/database');

async function testTeknisiNameFix() {
    try {
        // Initialize database
        console.log('📂 Initializing database...\n');
        await initializeDatabase();
        
        // Initialize reports if not exists
        if (!global.reports) global.reports = [];
        
        console.log(`✅ Database loaded\n`);
        console.log(`  Users: ${global.users.length}`);
        console.log(`  Accounts: ${global.accounts.length}\n`);
        
        // Show teknisi data
        console.log('📋 TEKNISI DATA FROM accounts.json:\n');
        const teknisiAccounts = global.accounts.filter(a => a.role === 'teknisi');
        teknisiAccounts.forEach(t => {
            console.log(`  ID: ${t.id}`);
            console.log(`  Name: "${t.name || 'NO NAME'}"`);
            console.log(`  Username: "${t.username}"`);
            console.log(`  Phone: ${t.phone_number}`);
            console.log(`  Role: ${t.role}`);
            console.log('');
        });
        
        // Test 1: Process ticket with teknisi
        console.log('━'.repeat(50));
        console.log('\n📱 TEST 1: PROCESS TICKET (ticket-process-handler)\n');
        
        const teknisiSender = '6289685645956@s.whatsapp.net';
        const senderNumber = teknisiSender.replace('@s.whatsapp.net', '');
        
        console.log(`Teknisi sender: ${teknisiSender}`);
        console.log(`Extracted number: ${senderNumber}\n`);
        
        // Get teknisi info as the handler does
        const teknisiInfo = global.accounts.find(acc => 
            acc.role === 'teknisi' && acc.phone_number === senderNumber
        );
        
        if (teknisiInfo) {
            const teknisiName = teknisiInfo.name || teknisiInfo.username;
            console.log(`✅ TEKNISI FOUND:`);
            console.log(`  Name field: "${teknisiInfo.name}"`);
            console.log(`  Username field: "${teknisiInfo.username}"`);
            console.log(`  Final name to use: "${teknisiName}"`);
        } else {
            console.log(`❌ TEKNISI NOT FOUND!`);
        }
        
        // Test 2: With 62 prefix handling
        console.log('\n━'.repeat(50));
        console.log('\n📱 TEST 2: WITH 62 PREFIX HANDLING\n');
        
        let phoneToMatch = senderNumber;
        if (senderNumber.startsWith('62')) {
            phoneToMatch = senderNumber.substring(2);
        }
        
        console.log(`Phone to match: ${phoneToMatch}\n`);
        
        const teknisiAccount = global.accounts.find(acc => {
            if (acc.role !== 'teknisi') return false;
            
            const match1 = acc.phone_number === phoneToMatch;
            const match2 = acc.phone_number === senderNumber;
            const match3 = `62${acc.phone_number}` === senderNumber;
            
            console.log(`  Checking: ${acc.username}`);
            console.log(`    DB phone: "${acc.phone_number}"`);
            console.log(`    Match phoneToMatch (${phoneToMatch}): ${match1}`);
            console.log(`    Match senderNumber (${senderNumber}): ${match2}`);
            console.log(`    Match with 62 prefix: ${match3}`);
            console.log(`    Result: ${match1 || match2 || match3 ? '✅' : '❌'}\n`);
            
            return match1 || match2 || match3;
        });
        
        if (teknisiAccount) {
            const teknisiName = teknisiAccount.name || teknisiAccount.username;
            console.log(`✅ TEKNISI FOUND WITH PREFIX HANDLING:`);
            console.log(`  Name: "${teknisiName}"`);
        } else {
            console.log(`❌ TEKNISI NOT FOUND!`);
        }
        
        // Test 3: Create a sample ticket
        console.log('\n━'.repeat(50));
        console.log('\n📱 TEST 3: CREATE SAMPLE TICKET\n');
        
        const ticketId = 'TEST' + Date.now();
        const mockReport = {
            ticketId: ticketId,
            pelangganUserId: 1,
            pelangganId: '6285233047094@s.whatsapp.net',
            pelangganName: 'Test User',
            status: 'pending'
        };
        
        // Simulate processing by teknisi
        if (teknisiAccount) {
            mockReport.status = 'diproses teknisi';
            mockReport.processedByTeknisiId = teknisiSender;
            mockReport.processedByTeknisiName = teknisiAccount.name || teknisiAccount.username;
            mockReport.teknisiName = teknisiAccount.name || teknisiAccount.username;
            
            console.log('✅ TICKET PROCESSED:');
            console.log(`  Ticket ID: ${mockReport.ticketId}`);
            console.log(`  Status: ${mockReport.status}`);
            console.log(`  Teknisi Name: "${mockReport.teknisiName}"`);
            console.log(`  ProcessedBy Name: "${mockReport.processedByTeknisiName}"`);
        }
        
        // Summary
        console.log('\n' + '═'.repeat(50));
        console.log('\n📊 SUMMARY:\n');
        
        console.log('EXPECTED:');
        console.log(`  • Teknisi Name: "DAPINN"`);
        console.log('');
        console.log('ACTUAL:');
        console.log(`  • Teknisi Name: "${mockReport.teknisiName || 'NOT SET'}"`);
        console.log('');
        
        if (mockReport.teknisiName === 'DAPINN') {
            console.log('✅ TEKNISI NAME DETECTION FIXED!');
        } else {
            console.log(`❌ STILL SHOWING: "${mockReport.teknisiName}" instead of "DAPINN"`);
            
            // Debug
            console.log('\n🔍 DEBUG INFO:');
            console.log('All teknisi accounts:');
            global.accounts.filter(a => a.role === 'teknisi').forEach(t => {
                console.log(`  - Username: ${t.username}, Name: ${t.name}, Phone: ${t.phone_number}`);
            });
        }
        
        console.log('\n✅ TEST COMPLETED!');
        
        // Close database
        if (global.db) {
            global.db.close();
        }
        
        process.exit(0);
        
    } catch (error) {
        console.error('\n❌ TEST FAILED:', error);
        process.exit(1);
    }
}

// Run test
testTeknisiNameFix();
