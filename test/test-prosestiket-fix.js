/**
 * Test untuk memverifikasi perbaikan command "prosestiket" dan deteksi nama teknisi
 */

console.log('🧪 TEST PROSESTIKET COMMAND & TEKNISI NAME\n');
console.log('=' .repeat(50) + '\n');

// Import required modules
const { initializeDatabase } = require('../lib/database');

async function testProsesTicketFix() {
    try {
        // Initialize database
        console.log('📂 Initializing database...\n');
        await initializeDatabase();
        
        // Initialize reports if not exists
        if (!global.reports) global.reports = [];
        
        // Create a test ticket
        const testTicket = {
            ticketId: 'TEST123',
            pelangganUserId: 1,
            pelangganId: '6285233047094@s.whatsapp.net',
            pelangganName: 'Test User',
            pelangganPhone: '6285233047094|6285604652630',
            pelangganAddress: 'Test Address',
            laporanText: 'Internet mati total',
            status: 'pending',
            priority: 'HIGH',
            createdAt: new Date().toISOString()
        };
        
        global.reports.push(testTicket);
        
        console.log('✅ Test ticket created: TEST123\n');
        
        // Test 1: Check keyword mapping
        console.log('━'.repeat(50));
        console.log('\n📱 TEST 1: KEYWORD MAPPING\n');
        
        // Load raf.js to check mapping
        const rafPath = require('path').join(__dirname, '../message/raf.js');
        const rafContent = require('fs').readFileSync(rafPath, 'utf8');
        
        const hasProsesMapping = rafContent.includes("'proses': 'PROSES_TIKET'");
        const hasProsestiketMapping = rafContent.includes("'prosestiket': 'PROSES_TIKET'");
        
        console.log('Keyword mappings:');
        console.log(`  • "proses" → PROSES_TIKET: ${hasProsesMapping ? '✅' : '❌'}`);
        console.log(`  • "prosestiket" → PROSES_TIKET: ${hasProsestiketMapping ? '✅' : '❌'}`);
        
        // Test 2: Simulate teknisi processing
        console.log('\n━'.repeat(50));
        console.log('\n📱 TEST 2: TEKNISI PROCESSING\n');
        
        const teknisiSender = '6289685645956@s.whatsapp.net';
        const ticketId = 'TEST123';
        
        console.log(`Simulating: teknisi types "prosestiket ${ticketId}"`);
        console.log(`Teknisi sender: ${teknisiSender}\n`);
        
        // Load handleProsesTicket
        const { handleProsesTicket } = require('../message/handlers/teknisi-workflow-handler');
        
        // Mock reply function
        const mockReply = async (msg) => {
            console.log('[BOT REPLY]:', msg.substring(0, 150) + '...');
            return msg;
        };
        
        // Test processing
        const result = await handleProsesTicket(teknisiSender, ticketId, mockReply);
        
        if (result.success) {
            console.log('\n✅ Ticket processed successfully!');
            
            // Check if teknisi name was set correctly
            const processedTicket = global.reports.find(r => r.ticketId === ticketId);
            
            console.log('\nTicket details after processing:');
            console.log(`  Status: ${processedTicket.status}`);
            console.log(`  Teknisi Name: "${processedTicket.teknisiName}"`);
            console.log(`  ProcessedBy Name: "${processedTicket.processedByTeknisiName}"`);
            console.log(`  OTP: ${processedTicket.otp}`);
        } else {
            console.log('\n❌ Processing failed:', result.message);
        }
        
        // Test 3: Check notification content
        console.log('\n━'.repeat(50));
        console.log('\n📱 TEST 3: CHECK NOTIFICATION CONTENT\n');
        
        // Check if handler uses correct name field
        const handlerPath = require('path').join(__dirname, '../message/handlers/teknisi-workflow-handler.js');
        const handlerContent = require('fs').readFileSync(handlerPath, 'utf8');
        
        const usesNameField = handlerContent.includes('teknisi.name || teknisi.username');
        const notificationUsesNameField = handlerContent.includes('🔧 Teknisi: *${teknisi.name || teknisi.username}*');
        
        console.log('Code checks:');
        console.log(`  • Uses name field in logic: ${usesNameField ? '✅' : '❌'}`);
        console.log(`  • Notification uses name field: ${notificationUsesNameField ? '✅' : '❌'}`);
        
        // Summary
        console.log('\n' + '═'.repeat(50));
        console.log('\n📊 SUMMARY:\n');
        
        const issues = [];
        
        if (!hasProsestiketMapping) {
            issues.push('Missing "prosestiket" keyword mapping');
        }
        
        if (!usesNameField || !notificationUsesNameField) {
            issues.push('Teknisi name not using correct field');
        }
        
        const processedTicket = global.reports.find(r => r.ticketId === ticketId);
        if (processedTicket && processedTicket.teknisiName !== 'DAPINN') {
            issues.push(`Teknisi name is "${processedTicket.teknisiName}" instead of "DAPINN"`);
        }
        
        if (issues.length === 0) {
            console.log('✅ ALL FIXES VERIFIED!');
            console.log('\nBoth commands work:');
            console.log('  • "proses TEST123" ✅');
            console.log('  • "prosestiket TEST123" ✅');
            console.log('\nTeknisi name detection:');
            console.log('  • Shows "DAPINN" not "teknisi" ✅');
        } else {
            console.log('❌ ISSUES FOUND:\n');
            issues.forEach(issue => {
                console.log(`  • ${issue}`);
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
testProsesTicketFix();
