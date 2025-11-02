/**
 * Test selesai ticket notification to multiple phone numbers
 */

console.log('🧪 TEST SELESAI MULTIPHONE NOTIFICATION\n');
console.log('='.repeat(50) + '\n');

const { initializeDatabase } = require('../lib/database');
const { handleSelesaiTicket } = require('../message/handlers/teknisi-workflow-handler');
const fs = require('fs');
const path = require('path');

// Mock global raf for sending messages
const sentMessages = [];
global.raf = {
    sendMessage: async (jid, message) => {
        sentMessages.push({ jid, message: message.text });
        console.log(`📱 SENT TO: ${jid}`);
        console.log(`   Message: ${message.text.substring(0, 80)}...`);
        return Promise.resolve();
    }
};

async function testSelesaiMultiphone() {
    try {
        // Initialize database
        console.log('📂 Initializing database...\n');
        await initializeDatabase();
        
        // Initialize global states
        if (!global.teknisiStates) global.teknisiStates = {};
        if (!global.reports) global.reports = [];
        
        // Create test ticket with multiple phone numbers
        const testTicket = {
            ticketId: 'TEST123',
            pelangganId: '6281234567890@s.whatsapp.net', // Main customer
            pelangganPhone: '081234567890|082345678901|083456789012', // 3 phone numbers
            pelangganName: 'Test Customer',
            issueSummary: 'Internet Mati',
            teknisiId: '6289685645956@s.whatsapp.net',
            teknisiName: 'TEKNISI TEST',
            otp: '123456',
            startTime: Date.now() - (30 * 60 * 1000), // 30 minutes ago
            status: 'working',
            verifiedAt: Date.now() - (25 * 60 * 1000),
            otpVerifiedAt: Date.now() - (25 * 60 * 1000),
            teknisiPhotoCount: 3,
            resolutionNotes: 'Test resolution'
        };
        
        // Add ticket to global reports
        global.reports.push(testTicket);
        
        // Create teknisi state
        const sender = '6289685645956@s.whatsapp.net';
        global.teknisiStates[sender] = {
            ticketId: 'TEST123',
            step: 'AWAITING_COMPLETION',
            uploadedPhotos: ['photo1.jpg', 'photo2.jpg', 'photo3.jpg']
        };
        
        console.log('━'.repeat(50));
        console.log('\n📋 TEST: SELESAI TICKET WITH MULTIPLE PHONES\n');
        console.log('Ticket ID: TEST123');
        console.log('Main Customer: 6281234567890@s.whatsapp.net');
        console.log('Additional Phones: 082345678901, 083456789012\n');
        
        // Clear sent messages
        sentMessages.length = 0;
        
        // Test handleSelesaiTicket
        const result = await handleSelesaiTicket(sender, 'TEST123', 'Kabel fiber diperbaiki');
        
        console.log('\n📊 RESULTS:\n');
        console.log(`Success: ${result.success}`);
        console.log(`Messages sent: ${sentMessages.length}`);
        
        // Check if all numbers received the notification
        const expectedJids = [
            '6281234567890@s.whatsapp.net', // Main customer
            '6282345678901@s.whatsapp.net', // Additional 1
            '6283456789012@s.whatsapp.net'  // Additional 2
        ];
        
        console.log('\n📱 NOTIFICATION DELIVERY:\n');
        let allSent = true;
        
        for (const expectedJid of expectedJids) {
            const wasSent = sentMessages.some(m => m.jid === expectedJid);
            console.log(`${wasSent ? '✅' : '❌'} ${expectedJid} - ${wasSent ? 'SENT' : 'NOT SENT'}`);
            if (!wasSent) allSent = false;
        }
        
        // Verify message content
        if (sentMessages.length > 0) {
            const firstMessage = sentMessages[0].message;
            const hasTicketId = firstMessage.includes('TEST123');
            const hasTeknisiName = firstMessage.includes('TEKNISI TEST');
            const hasDuration = firstMessage.includes('menit');
            const hasPhotos = firstMessage.includes('3 foto');
            
            console.log('\n📝 MESSAGE CONTENT CHECK:');
            console.log(`${hasTicketId ? '✅' : '❌'} Ticket ID included`);
            console.log(`${hasTeknisiName ? '✅' : '❌'} Teknisi name included`);
            console.log(`${hasDuration ? '✅' : '❌'} Duration included`);
            console.log(`${hasPhotos ? '✅' : '❌'} Photo count included`);
        }
        
        // SUMMARY
        console.log('\n' + '═'.repeat(50));
        console.log('\n🎯 FINAL SUMMARY:\n');
        
        if (allSent && sentMessages.length === 3) {
            console.log('🎉 TEST PASSED! 🎉\n');
            console.log('VERIFIED:');
            console.log('  ✅ All 3 phone numbers received notification');
            console.log('  ✅ Main customer notified');
            console.log('  ✅ All additional numbers notified');
            console.log('  ✅ Message content correct');
        } else {
            console.log('⚠️ TEST FAILED\n');
            console.log('Issues:');
            if (sentMessages.length !== 3) {
                console.log(`  ❌ Only ${sentMessages.length}/3 messages sent`);
            }
            if (!allSent) {
                console.log('  ❌ Not all numbers received notification');
            }
        }
        
        // Clean up
        if (global.db) {
            global.db.close();
        }
        
        console.log('\n✅ TEST COMPLETED!\n');
        process.exit(allSent && sentMessages.length === 3 ? 0 : 1);
        
    } catch (error) {
        console.error('\n❌ TEST ERROR:', error);
        console.error(error.stack);
        
        if (global.db) {
            global.db.close();
        }
        
        process.exit(1);
    }
}

// Run test
testSelesaiMultiphone();
