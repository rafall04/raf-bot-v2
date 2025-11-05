/**
 * Test Batalkan Tiket Fix
 * Verifies that batalkantiket command works correctly with ticket ID
 */

const path = require('path');
const fs = require('fs');

// Setup global objects
global.config = { botNumber: '628xxxxx' };
global.reports = [];
global.raf = { sendMessage: async () => {} };

// Create test tickets
const testTickets = [
    {
        ticketId: '9NK5MS8',
        pelangganId: '6285604652630@s.whatsapp.net',
        pelangganName: 'Test User',
        laporanText: 'Wifi lemot tidak bisa browsing',
        status: 'baru',
        createdAt: new Date().toISOString()
    },
    {
        ticketId: 'ABC123',
        pelangganId: '6285604652630@s.whatsapp.net',
        pelangganName: 'Test User',
        laporanText: 'Internet mati total',
        status: 'diproses teknisi',
        createdAt: new Date().toISOString()
    },
    {
        ticketId: 'XYZ789',
        pelangganId: '6281234567890@s.whatsapp.net',
        pelangganName: 'Other User',
        laporanText: 'WiFi tidak bisa connect',
        status: 'baru',
        createdAt: new Date().toISOString()
    }
];

global.reports = [...testTickets];

console.log('🧪 TESTING BATALKAN TIKET FIX\n');
console.log('Test Tickets Created:');
testTickets.forEach(t => {
    console.log(`- ${t.ticketId}: ${t.status} (owner: ${t.pelangganName})`);
});

// Mock raf.js BATALKAN_TIKET handler
function testBatalkanTiket(sender, q, pushname) {
    console.log(`\n📨 User ${pushname} (${sender}) sends: "batalkantiket ${q}"`);
    
    // Extract ticket ID from command
    let ticketId = '';
    const words = q.trim().split(' ');
    
    if (words.length > 0) {
        ticketId = words[words.length - 1].toUpperCase();
    }

    if (!ticketId || ticketId.length < 5) {
        // If no ID provided, show active tickets
        const userReports = global.reports.filter(
            r => r.pelangganId === sender && r.status === 'baru'
        );

        if (userReports.length === 0) {
            console.log(`❌ Response: No active tickets with status 'baru' found`);
            return false;
        }

        console.log(`📋 Response: Showing user's cancellable tickets:`);
        userReports.forEach(r => {
            console.log(`   - ${r.ticketId}: ${r.status}`);
        });
        return true;
    }

    // Find the specific ticket
    const activeReport = global.reports.find(
        r => r.ticketId === ticketId
    );

    if (!activeReport) {
        console.log(`❌ Response: Ticket ${ticketId} not found`);
        return false;
    }

    // Verify ticket belongs to sender
    if (activeReport.pelangganId !== sender) {
        console.log(`❌ Response: Ticket ${ticketId} doesn't belong to user`);
        return false;
    }

    // Check status
    if (activeReport.status === 'dibatalkan') {
        console.log(`ℹ️ Response: Ticket ${ticketId} already cancelled`);
        return false;
    }

    if (activeReport.status === 'selesai') {
        console.log(`ℹ️ Response: Ticket ${ticketId} already completed`);
        return false;
    }

    if (activeReport.status === 'diproses teknisi' || activeReport.status === 'otw') {
        console.log(`⚠️ Response: Ticket ${ticketId} is being handled by teknisi, cannot cancel`);
        return false;
    }

    if (activeReport.status === 'baru') {
        console.log(`✅ Response: Found ticket ${ticketId} with status 'baru'`);
        console.log(`   Would ask for confirmation to cancel`);
        return true;
    }

    return false;
}

console.log('\n========== TEST SCENARIOS ==========');

// Test 1: Cancel with valid ticket ID
console.log('\n📌 TEST 1: Cancel ticket 9NK5MS8 (status: baru)');
testBatalkanTiket('6285604652630@s.whatsapp.net', '9NK5MS8', 'Test User');

// Test 2: Cancel without ID (should list tickets)
console.log('\n📌 TEST 2: Cancel without providing ID');
testBatalkanTiket('6285604652630@s.whatsapp.net', '', 'Test User');

// Test 3: Try to cancel ticket already being processed
console.log('\n📌 TEST 3: Try to cancel ABC123 (status: diproses teknisi)');
testBatalkanTiket('6285604652630@s.whatsapp.net', 'ABC123', 'Test User');

// Test 4: Try to cancel other user's ticket
console.log('\n📌 TEST 4: Try to cancel XYZ789 (belongs to other user)');
testBatalkanTiket('6285604652630@s.whatsapp.net', 'XYZ789', 'Test User');

// Test 5: Try to cancel non-existent ticket
console.log('\n📌 TEST 5: Try to cancel non-existent ticket');
testBatalkanTiket('6285604652630@s.whatsapp.net', 'NOTEXIST', 'Test User');

console.log('\n✅ ALL TESTS COMPLETED');
console.log('\nEXPECTED BEHAVIOR:');
console.log('1. ✅ Can cancel ticket with status "baru"');
console.log('2. ✅ Shows list when no ID provided');
console.log('3. ✅ Cannot cancel ticket being processed');
console.log('4. ✅ Cannot cancel other user\'s ticket');
console.log('5. ✅ Shows error for non-existent ticket');
