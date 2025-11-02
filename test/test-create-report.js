/**
 * Test untuk simulasi pembuatan report dan check apakah nama terdeteksi
 */

console.log('🧪 TEST CREATE REPORT WITH NAMES\n');
console.log('=' .repeat(50) + '\n');

// Import required modules
const { initializeDatabase } = require('../lib/database');

async function testCreateReport() {
    try {
        // Initialize database
        console.log('📂 Initializing database...\n');
        await initializeDatabase();
        
        // Initialize reports if not exists
        if (!global.reports) global.reports = [];
        
        console.log(`✅ Database loaded with ${global.users.length} users\n`);
        
        // Simulate WhatsApp sender
        const sender = '6285233047094@s.whatsapp.net';
        const senderPhone = sender.replace('@s.whatsapp.net', '');
        
        console.log(`📱 Simulating message from: ${sender}`);
        console.log(`   Phone extracted: ${senderPhone}\n`);
        
        // Find user using exact logic from smart-report-handler.js
        console.log('🔍 Finding user...\n');
        
        const user = global.users.find(u => {
            if (!u.phone_number) return false;
            
            console.log(`  Checking user ${u.id}: phone="${u.phone_number}"`);
            
            const phones = u.phone_number.split("|");
            
            return phones.some(phone => {
                const cleanPhone = phone.trim();
                
                if (senderPhone.startsWith('62')) {
                    if (cleanPhone.startsWith('0')) {
                        const match = `62${cleanPhone.substring(1)}` === senderPhone;
                        if (match) console.log(`    ✅ Matched by converting 0 to 62`);
                        return match;
                    } else if (cleanPhone.startsWith('62')) {
                        const match = cleanPhone === senderPhone;
                        if (match) console.log(`    ✅ Direct match with 62`);
                        return match;
                    } else {
                        const match = `62${cleanPhone}` === senderPhone;
                        if (match) console.log(`    ✅ Matched by adding 62`);
                        return match;
                    }
                }
                
                const match = cleanPhone === senderPhone;
                if (match) console.log(`    ✅ Direct match`);
                return match;
            });
        });
        
        if (!user) {
            console.log('❌ USER NOT FOUND!\n');
            console.log('Available users:');
            global.users.forEach(u => {
                console.log(`  ID: ${u.id}, Phone: ${u.phone_number}`);
            });
            process.exit(1);
        }
        
        console.log(`\n✅ USER FOUND:`);
        console.log(`  ID: ${user.id}`);
        console.log(`  Name: ${user.name || 'NO NAME FIELD'}`);
        console.log(`  Username: ${user.username || 'NO USERNAME'}`);
        console.log(`  Phone: ${user.phone_number}`);
        console.log(`  Address: ${user.address || 'NO ADDRESS'}`);
        
        // Create sample report
        console.log('\n━'.repeat(50));
        console.log('\n📝 CREATING SAMPLE REPORT:\n');
        
        const ticketId = 'TEST' + Date.now();
        const newReport = {
            ticketId: ticketId,
            pelangganUserId: user.id,
            pelangganId: sender,
            pelangganName: user.name || user.username || 'Customer',
            pelangganPhone: user.phone_number || '',
            pelangganAddress: user.address || '',
            pelangganSubscription: user.subscription || 'Unknown',
            laporanText: 'Test report untuk check nama',
            status: 'baru',
            priority: 'HIGH',
            createdAt: new Date().toISOString(),
            deviceOnline: false,
            issueType: 'TEST'
        };
        
        console.log('Report created with:');
        console.log(`  Ticket ID: ${newReport.ticketId}`);
        console.log(`  Pelanggan Name: "${newReport.pelangganName}"`);
        console.log(`  Pelanggan Phone: ${newReport.pelangganPhone}`);
        console.log(`  Status: ${newReport.status}`);
        
        // Test teknisi processing
        console.log('\n━'.repeat(50));
        console.log('\n🔧 TESTING TEKNISI PROCESSING:\n');
        
        const teknisiSender = '6289685645956@s.whatsapp.net';
        const teknisiPhone = teknisiSender.replace('@s.whatsapp.net', '');
        
        console.log(`Teknisi sender: ${teknisiSender}`);
        console.log(`Phone extracted: ${teknisiPhone}\n`);
        
        // Find teknisi
        let phoneToMatch = teknisiPhone;
        if (teknisiPhone.startsWith('62')) {
            phoneToMatch = teknisiPhone.substring(2);
        }
        
        console.log(`Phone to match: ${phoneToMatch}\n`);
        
        const teknisi = global.accounts.find(acc => {
            if (acc.role !== 'teknisi') return false;
            
            console.log(`  Checking teknisi ${acc.username}: phone="${acc.phone_number}"`);
            
            const match1 = acc.phone_number === phoneToMatch;
            const match2 = acc.phone_number === teknisiPhone;
            const match3 = `62${acc.phone_number}` === teknisiPhone;
            
            if (match1) console.log(`    ✅ Matched with phoneToMatch`);
            if (match2) console.log(`    ✅ Direct match`);
            if (match3) console.log(`    ✅ Matched with 62 prefix`);
            
            return match1 || match2 || match3;
        });
        
        if (teknisi) {
            console.log(`\n✅ TEKNISI FOUND:`);
            console.log(`  ID: ${teknisi.id}`);
            console.log(`  Name: ${teknisi.name || 'NO NAME FIELD'}`);
            console.log(`  Username: ${teknisi.username}`);
            console.log(`  Phone: ${teknisi.phone_number}`);
            
            // Update report with teknisi
            newReport.processedByTeknisiName = teknisi.name || teknisi.username;
            newReport.teknisiName = teknisi.name || teknisi.username;
            newReport.teknisiId = teknisiSender;
            newReport.status = 'process';
            
            console.log(`\n📋 Report updated with teknisi:`);
            console.log(`  Teknisi Name: "${newReport.teknisiName}"`);
            console.log(`  Status: ${newReport.status}`);
        } else {
            console.log(`\n❌ TEKNISI NOT FOUND!`);
            console.log('Available teknisi:');
            global.accounts.filter(a => a.role === 'teknisi').forEach(t => {
                console.log(`  Username: ${t.username}, Phone: ${t.phone_number}`);
            });
        }
        
        // Summary
        console.log('\n' + '═'.repeat(50));
        console.log('\n📊 SUMMARY:\n');
        
        console.log('EXPECTED NAMES:');
        console.log(`  • Pelanggan: "Test User"`);
        console.log(`  • Teknisi: "DAPINN"`);
        console.log('');
        console.log('ACTUAL NAMES IN REPORT:');
        console.log(`  • Pelanggan: "${newReport.pelangganName}"`);
        console.log(`  • Teknisi: "${newReport.teknisiName || 'Not set'}"`);
        console.log('');
        
        if (newReport.pelangganName === 'Test User' && newReport.teknisiName === 'DAPINN') {
            console.log('✅ ALL NAMES DETECTED CORRECTLY!');
        } else {
            console.log('❌ NAME DETECTION FAILED!');
            if (newReport.pelangganName !== 'Test User') {
                console.log(`  • Pelanggan name wrong: got "${newReport.pelangganName}" instead of "Test User"`);
            }
            if (newReport.teknisiName !== 'DAPINN') {
                console.log(`  • Teknisi name wrong: got "${newReport.teknisiName}" instead of "DAPINN"`);
            }
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
testCreateReport();
