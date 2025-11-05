/**
 * Test Complete Batalkan Tiket Flow
 * Simulates the full cancel ticket flow with mock data
 */

// Setup globals
global.reports = [];
global.config = {};

// Create mock ticket
const mockTicket = {
    ticketId: '9NK5MS8',
    pelangganId: '6285604652630@s.whatsapp.net',
    pelangganName: 'Test User',
    pelangganPhone: '6285604652630',
    laporanText: 'Wifi lemot tidak bisa browsing',
    status: 'baru',
    priority: 'MEDIUM',
    createdAt: new Date().toISOString()
};

global.reports.push(mockTicket);

console.log('🧪 TESTING COMPLETE BATALKAN TIKET FLOW\n');
console.log('Mock ticket created:');
console.log(`- ID: ${mockTicket.ticketId}`);
console.log(`- Status: ${mockTicket.status}`);
console.log(`- Owner: ${mockTicket.pelangganName}\n`);

// Mock the BATALKAN_TIKET handler logic
function processBatalkanTiket(sender, chats, pushname) {
    console.log(`\n📨 Processing: "${chats}"`);
    console.log(`   From: ${sender} (${pushname})\n`);
    
    // Extract ticket ID (mimics the actual code)
    let ticketId = '';
    const originalMessage = chats.trim();
    const cleanedMessage = originalMessage.replace(/^batalkan\s*tiket\s*/i, '').trim();
    
    if (cleanedMessage && cleanedMessage.length > 0) {
        ticketId = cleanedMessage.toUpperCase();
    }
    
    console.log(`   Extracted ticket ID: "${ticketId}"`);
    console.log(`   Available reports: ${global.reports.length}`);
    
    if (!ticketId || ticketId.length < 5) {
        // Show active tickets
        const userReports = global.reports.filter(
            r => r.pelangganId === sender && r.status === 'baru'
        );
        
        if (userReports.length === 0) {
            console.log('   ❌ No active tickets found for user');
            return { success: false, message: 'No active tickets' };
        }
        
        console.log(`   📋 Found ${userReports.length} active ticket(s):`);
        userReports.forEach(r => {
            console.log(`      - ${r.ticketId}: ${r.status}`);
        });
        return { success: true, action: 'list' };
    }
    
    // Find the specific ticket
    const activeReport = global.reports.find(r => r.ticketId === ticketId);
    
    if (!activeReport) {
        console.log(`   ❌ Ticket ${ticketId} not found`);
        return { success: false, message: 'Ticket not found' };
    }
    
    console.log(`   ✅ Found ticket ${ticketId}`);
    
    // Verify ownership
    if (activeReport.pelangganId !== sender) {
        console.log(`   ❌ Ticket doesn't belong to user`);
        console.log(`      Ticket owner: ${activeReport.pelangganId}`);
        console.log(`      Requester: ${sender}`);
        return { success: false, message: 'Not owner' };
    }
    
    console.log(`   ✅ Ownership verified`);
    
    // Check status
    if (activeReport.status !== 'baru') {
        console.log(`   ❌ Cannot cancel - Status: ${activeReport.status}`);
        return { success: false, message: `Cannot cancel status: ${activeReport.status}` };
    }
    
    console.log(`   ✅ Status allows cancellation`);
    console.log(`   Would show confirmation dialog`);
    
    return { success: true, action: 'confirm', ticketId: ticketId };
}

console.log('========== TEST SCENARIOS ==========');

// Test 1: Valid cancellation request
console.log('\n📌 TEST 1: Valid request with correct ID');
processBatalkanTiket(
    '6285604652630@s.whatsapp.net',
    'Batalkantiket 9NK5MS8',
    'Test User'
);

// Test 2: Request without ID
console.log('\n📌 TEST 2: Request without ID');
processBatalkanTiket(
    '6285604652630@s.whatsapp.net',
    'batalkantiket',
    'Test User'
);

// Test 3: Wrong ticket ID
console.log('\n📌 TEST 3: Wrong ticket ID');
processBatalkanTiket(
    '6285604652630@s.whatsapp.net',
    'batalkan tiket WRONG123',
    'Test User'
);

// Test 4: Different user trying to cancel
console.log('\n📌 TEST 4: Different user');
processBatalkanTiket(
    '6281234567890@s.whatsapp.net',
    'batalkantiket 9NK5MS8',
    'Other User'
);

// Test 5: With space format
console.log('\n📌 TEST 5: With space format');
processBatalkanTiket(
    '6285604652630@s.whatsapp.net',
    'batalkan tiket 9NK5MS8',
    'Test User'
);

console.log('\n✅ ALL TESTS COMPLETED');
console.log('\nExpected flow:');
console.log('1. User types "batalkantiket [ID]"');
console.log('2. System extracts ticket ID');
console.log('3. System finds ticket and verifies ownership');
console.log('4. System checks if status allows cancellation');
console.log('5. System shows confirmation dialog');
console.log('6. User confirms with "ya"');
console.log('7. Ticket status changes to "dibatalkan"');
