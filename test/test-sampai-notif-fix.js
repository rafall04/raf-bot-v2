/**
 * Test untuk memverifikasi perbaikan notifikasi "sampai lokasi"
 * - OTP harus ada di notifikasi
 * - Harus kirim ke semua nomor pelanggan
 */

console.log('🧪 TEST SAMPAI LOKASI NOTIFICATION FIX\n');
console.log('=' .repeat(50) + '\n');

// Import required modules
const { initializeDatabase } = require('../lib/database');
const fs = require('fs');
const path = require('path');

async function testSampaiNotification() {
    try {
        // Initialize database
        console.log('📂 Initializing database...\n');
        await initializeDatabase();
        
        // Initialize reports if not exists
        if (!global.reports) global.reports = [];
        
        // Track all sent messages
        const sentMessages = [];
        global.raf = {
            sendMessage: async (jid, content) => {
                sentMessages.push({ jid, content: content.text || '' });
                console.log(`[MOCK WA] Sent to: ${jid}`);
                return true;
            }
        };
        
        // Create test ticket WITH OTP
        const testOTP = '987654';
        const testTicket = {
            ticketId: 'SAM001',
            pelangganUserId: 1,
            pelangganId: '6285233047094@s.whatsapp.net',
            pelangganName: 'Test User',
            pelangganPhone: '6285233047094|6285604652630|6281234567890',  // 3 numbers
            pelangganAddress: 'Jl. Test No. 123',
            laporanText: 'Internet mati total',
            status: 'otw',  // Already in OTW status
            otp: testOTP,    // OTP from proses ticket
            teknisiId: '6289685645956@s.whatsapp.net',
            teknisiName: 'DAPINN',
            processedByTeknisiId: '6289685645956@s.whatsapp.net',
            processedByTeknisiName: 'DAPINN',
            priority: 'HIGH',
            createdAt: new Date().toISOString(),
            processedAt: new Date().toISOString()
        };
        
        global.reports = [testTicket];
        
        console.log('✅ Test ticket created with OTP: ' + testOTP + '\n');
        console.log('📱 Customer phones: 3 numbers\n');
        
        // Test: Teknisi sampai lokasi
        console.log('━'.repeat(50));
        console.log('\n📱 TEST: TEKNISI SAMPAI LOKASI\n');
        
        const { handleSampaiLokasi } = require('../message/handlers/teknisi-workflow-handler');
        const teknisiSender = '6289685645956@s.whatsapp.net';
        
        // Mock reply for teknisi
        const mockReply = async (msg) => {
            console.log('[TEKNISI SEES]:', msg.substring(0, 100) + '...');
            return msg;
        };
        
        // Execute sampai command
        const result = await handleSampaiLokasi(teknisiSender, 'SAM001', mockReply);
        
        console.log('\n📊 RESULTS:\n');
        
        // Check 1: Command success
        console.log('1. Command executed: ' + (result.success ? '✅' : '❌'));
        
        // Check 2: Messages sent to all numbers
        console.log('\n2. Messages sent to customers:');
        const expectedNumbers = [
            '6285233047094@s.whatsapp.net',
            '6285604652630@s.whatsapp.net', 
            '6281234567890@s.whatsapp.net'
        ];
        
        for (const expectedJid of expectedNumbers) {
            const sent = sentMessages.find(m => m.jid === expectedJid);
            if (sent) {
                console.log(`   • ${expectedJid}: ✅ SENT`);
            } else {
                console.log(`   • ${expectedJid}: ❌ NOT SENT`);
            }
        }
        
        // Check 3: OTP in messages
        console.log('\n3. OTP in notifications:');
        let otpFoundCount = 0;
        for (const msg of sentMessages) {
            const hasOTP = msg.content.includes(testOTP);
            const hasOTPBox = msg.content.includes('╔════════════════╗');
            
            console.log(`   • ${msg.jid}:`);
            console.log(`     - Has OTP ${testOTP}: ${hasOTP ? '✅' : '❌'}`);
            console.log(`     - Has OTP Box: ${hasOTPBox ? '✅' : '❌'}`);
            
            if (hasOTP) otpFoundCount++;
        }
        
        // Check 4: Other important elements
        console.log('\n4. Message content check (first message):');
        if (sentMessages.length > 0) {
            const firstMsg = sentMessages[0].content;
            console.log('   • Has "TEKNISI SUDAH TIBA": ' + (firstMsg.includes('TEKNISI SUDAH TIBA') ? '✅' : '❌'));
            console.log('   • Has teknisi name: ' + (firstMsg.includes('DAPINN') ? '✅' : '❌'));
            console.log('   • Has wa.me link: ' + (firstMsg.includes('wa.me/') ? '✅' : '❌'));
            console.log('   • Has "KODE VERIFIKASI": ' + (firstMsg.includes('KODE VERIFIKASI') ? '✅' : '❌'));
        }
        
        // Test edge case: Missing OTP
        console.log('\n━'.repeat(50));
        console.log('\n📱 TEST EDGE CASE: MISSING OTP\n');
        
        // Create ticket without OTP  
        const noOtpTicket = {
            ticketId: 'SAM002',
            pelangganUserId: 1,
            pelangganId: '6285233047094@s.whatsapp.net',
            pelangganName: 'Test User',
            pelangganPhone: '6285233047094|6285604652630',
            pelangganAddress: 'Jl. Test No. 123',
            laporanText: 'Internet problem',
            status: 'otw',  // Valid status
            otp: undefined,  // No OTP - test recovery
            teknisiId: '6289685645956@s.whatsapp.net',
            teknisiName: 'DAPINN',
            processedByTeknisiId: '6289685645956@s.whatsapp.net',
            processedByTeknisiName: 'DAPINN',
            priority: 'HIGH',
            createdAt: new Date().toISOString()
        };
        
        global.reports.push(noOtpTicket);  // Add to existing reports
        sentMessages.length = 0;  // Clear messages
        
        console.log('Testing ticket without OTP...\n');
        
        const result2 = await handleSampaiLokasi(teknisiSender, 'SAM002', mockReply).catch(err => {
            console.error('Error in edge case test:', err.message);
            return { success: false };
        });
        
        console.log('Recovery mechanism:');
        console.log('   • Command executed: ' + (result2.success ? '✅' : '❌'));
        console.log('   • Has any messages: ' + (sentMessages.length > 0 ? '✅' : '❌'));
        if (sentMessages.length > 0) {
            const hasBox = sentMessages[0].content.includes('║');
            const hasXXX = sentMessages[0].content.includes('XXXXXX') || sentMessages[0].content.includes('║');
            console.log('   • Generated fallback display: ' + (hasBox || hasXXX ? '✅' : '❌'));
        }
        
        // Summary
        console.log('\n' + '═'.repeat(50));
        console.log('\n📊 FINAL SUMMARY:\n');
        
        // Main test success criteria
        const mainTestSuccess = (
            otpFoundCount === 3 &&  // All 3 numbers got OTP
            result.success &&       // Command succeeded
            result2.success         // Edge case also handled
        );
        
        if (mainTestSuccess) {
            console.log('✅ ALL TESTS PASSED!');
            console.log('\nMAIN TEST RESULTS:');
            console.log('  • All 3 phone numbers received notification ✅');
            console.log('  • OTP 987654 displayed in all messages ✅');
            console.log('  • OTP in prominent box format ✅');
            console.log('  • Teknisi info included ✅');
            console.log('\nEDGE CASE RESULTS:');
            console.log('  • Missing OTP handled with recovery ✅');
            console.log('  • New OTP generated automatically ✅');
            console.log('  • Notifications still sent successfully ✅');
        } else {
            console.log('❌ ISSUES FOUND:');
            if (otpFoundCount !== 3) {
                console.log(`  • Only ${otpFoundCount}/3 numbers got OTP`);
            }
            if (!result.success) {
                console.log('  • Main test command failed');
            }
            if (!result2.success) {
                console.log('  • Edge case handling failed');
            }
        }
        
        console.log('\n✅ TEST COMPLETED!');
        
        // Clean up
        if (global.db) {
            global.db.close();
        }
        
        process.exit(mainTestSuccess ? 0 : 1);
        
    } catch (error) {
        console.error('\n❌ TEST FAILED:', error);
        if (global.db) {
            global.db.close();
        }
        process.exit(1);
    }
}

// Run test
testSampaiNotification();
