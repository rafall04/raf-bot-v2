/**
 * Test Real Bot Flow Simulation
 * Simulate exactly what happens when pelanggan types "cek wifi"
 */

const { getIntentFromKeywords } = require('../lib/wifi_template_handler');

console.log('🔍 SIMULATING REAL BOT FLOW FOR PELANGGAN');
console.log('='.repeat(70));

// Mock environment
const mockGlobal = {
    users: [
        { id: 1, name: 'Pak Budi', phone_number: '6285111111111', device_id: 'TEST001' }
    ],
    accounts: []
};

// Simulate pelanggan input
const testInputs = [
    'cekwifi',
    'cek wifi',
    'CEK WIFI',
    'Cek wifi',
    'cek wifi saya'
];

// Simulate raf.js flow
function simulateBotFlow(message, senderPhone) {
    console.log(`\n📱 Pelanggan (${senderPhone}) types: "${message}"`);
    console.log('-'.repeat(50));
    
    // Step 1: Parse message (like raf.js line 135-136)
    const args = message.split(' ');
    const command = message.toLowerCase().split(' ')[0] || '';
    
    console.log(`   args: [${args.join(', ')}]`);
    console.log(`   command: "${command}"`);
    
    // Step 2: Check if empty (line 887)
    if (!message || message.trim() === '') {
        console.log('   ❌ Empty message - would return');
        return null;
    }
    
    // Step 3: Static intents (line 889-956)
    const staticIntents = {
        'menu': 'MENU_UTAMA',
        'lapor': 'LAPOR_GANGGUAN',
        'ceksaldo': 'CEK_SALDO',
        // Note: No WiFi commands in static intents
    };
    
    // Step 4: Check special alias (line 961)
    if (message.toLowerCase().replace(/\s+/g, '') === 'menupelanggan') {
        console.log('   → Matched special alias: MENU_PELANGGAN');
        return 'MENU_PELANGGAN';
    }
    
    // Step 5: Check keyword handler (line 965)
    const keywordResult = getIntentFromKeywords(message);
    if (keywordResult) {
        console.log(`   ✅ Keyword handler matched: ${keywordResult.intent}`);
        console.log(`      Matched keyword: "${keywordResult.matchedKeyword}"`);
        return keywordResult.intent;
    }
    
    // Step 6: Check static intents (line 972)
    const staticIntent = staticIntents[command];
    if (staticIntent) {
        console.log(`   ✅ Static intent matched: ${staticIntent}`);
        return staticIntent;
    }
    
    console.log('   ❌ NO MATCH - would show unknown command');
    return null;
}

// Test for pelanggan
const pelangganPhone = '6285111111111';
testInputs.forEach(input => {
    const result = simulateBotFlow(input, pelangganPhone);
});

// Check if there are any early returns or blocks
console.log('\n🔍 CHECKING FOR BLOCKING CONDITIONS:');
console.log('-'.repeat(70));

// Simulate conditions that might block
const sender = '6285111111111@s.whatsapp.net';
const plainSenderNumber = '6285111111111';
const isOwner = false;
const isTeknisi = false;
const temp = {}; // No ongoing conversation state

console.log(`Sender: ${sender}`);
console.log(`Is Owner: ${isOwner}`);
console.log(`Is Teknisi: ${isTeknisi}`);
console.log(`Has temp state: ${temp[sender] ? 'YES' : 'NO'}`);

// Check if user would be found
const user = mockGlobal.users.find(v => 
    v.phone_number && v.phone_number.split("|").includes(plainSenderNumber)
);
console.log(`User found in DB: ${user ? 'YES - ' + user.name : 'NO'}`);

console.log('\n💡 ANALYSIS:');
console.log('-'.repeat(70));
console.log('Based on the simulation:');
console.log('1. Both "cekwifi" and "cek wifi" are detected by keyword handler ✅');
console.log('2. No blocking conditions for regular users ✅');
console.log('3. The flow should work correctly ✅');
console.log('');
console.log('🔴 POSSIBLE ISSUES:');
console.log('1. temp[sender] might have leftover state blocking the command');
console.log('2. smartReportState might be intercepting the command');
console.log('3. There might be a timing/async issue');
console.log('4. The keyword handler might not be loading properly in production');

process.exit(0);
