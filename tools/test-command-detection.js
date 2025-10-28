#!/usr/bin/env node
/**
 * Test Command Detection Flow
 * Debug mengapa command "transaksi" tidak terdeteksi
 */

const commandManager = require('../lib/command-manager');
const fs = require('fs');
const path = require('path');

console.log('🔍 DEBUGGING COMMAND DETECTION - "transaksi"\n');
console.log('═'.repeat(70));
console.log('\n');

// Test message
const testMessage = 'transaksi';
const userRole = 'customer';

console.log('📱 TEST INPUT:\n');
console.log(`   Message: "${testMessage}"`);
console.log(`   Role: ${userRole}\n`);
console.log('─'.repeat(70));
console.log('\n');

// Step 1: Check commands.json
console.log('1️⃣ CHECK commands.json:\n');

const configPath = path.join(__dirname, '../config/commands.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

const transaksiCommand = config.commands.transaksi_agent;
if (transaksiCommand) {
    console.log('   ✅ transaksi_agent command found:');
    console.log(`      Keywords: ${transaksiCommand.keywords.join(', ')}`);
    console.log(`      Intent: "${transaksiCommand.intent}"`);
    console.log(`      Roles: ${transaksiCommand.roles.join(', ')}`);
    console.log(`      Category: ${transaksiCommand.category}\n`);
} else {
    console.log('   ❌ transaksi_agent command NOT found\n');
}

console.log('─'.repeat(70));
console.log('\n');

// Step 2: Test commandManager.getIntent()
console.log('2️⃣ TEST commandManager.getIntent():\n');

try {
    const result = commandManager.getIntent(testMessage, userRole);
    
    if (result) {
        console.log('   ✅ Intent detected:');
        console.log(`      Intent: "${result.intent}"`);
        console.log(`      Matched Keyword: "${result.matchedKeyword}"`);
        console.log(`      Exact Match: ${result.exactMatch}`);
        console.log(`      Command: ${JSON.stringify(result.command, null, 2)}\n`);
    } else {
        console.log('   ❌ No intent detected (returned null)\n');
    }
} catch (error) {
    console.log(`   ❌ ERROR: ${error.message}`);
    console.log(`      Stack: ${error.stack}\n`);
}

console.log('─'.repeat(70));
console.log('\n');

// Step 3: Test with different roles
console.log('3️⃣ TEST WITH DIFFERENT ROLES:\n');

const roles = ['customer', 'agent', 'admin', 'owner', 'teknisi'];

roles.forEach(role => {
    const result = commandManager.getIntent(testMessage, role);
    console.log(`   ${role.padEnd(10)}: ${result ? `✅ Intent="${result.intent}"` : '❌ No match'}`);
});

console.log('\n');
console.log('─'.repeat(70));
console.log('\n');

// Step 4: Check switch case matching
console.log('4️⃣ CHECK SWITCH CASE MATCHING:\n');

const switchCases = [
    'transaksi hari ini',
    'transaksi hariini',
    'today transactions',
    'transaksi',
    'my transactions'
];

console.log('   Valid switch cases:');
switchCases.forEach(c => console.log(`      • "${c}"`));

const result = commandManager.getIntent(testMessage, 'agent');
if (result) {
    const matchesCase = switchCases.includes(result.intent);
    console.log(`\n   Intent from command manager: "${result.intent}"`);
    console.log(`   Matches switch case: ${matchesCase ? '✅ YES' : '❌ NO'}`);
    
    if (!matchesCase) {
        console.log(`\n   ⚠️  PROBLEM FOUND!`);
        console.log(`   Intent "${result.intent}" tidak match dengan case apapun!`);
    }
} else {
    console.log(`\n   ❌ No intent detected for agent role`);
}

console.log('\n');
console.log('─'.repeat(70));
console.log('\n');

// Step 5: Manual keyword check
console.log('5️⃣ MANUAL KEYWORD CHECK:\n');

console.log('   Checking if "transaksi" in keywords...');
const keywords = transaksiCommand.keywords;
const hasExactMatch = keywords.includes('transaksi');
const hasExactMatchLower = keywords.includes(testMessage.toLowerCase());

console.log(`   Exact match "transaksi": ${hasExactMatch ? '✅' : '❌'}`);
console.log(`   Lowercase match: ${hasExactMatchLower ? '✅' : '❌'}`);

console.log('\n   All keywords:');
keywords.forEach((kw, i) => {
    const normalized = kw.toLowerCase().trim();
    const messageNormalized = testMessage.toLowerCase().trim();
    const matches = normalized === messageNormalized;
    console.log(`      ${i+1}. "${kw}" ${matches ? '✅ MATCH' : ''}`);
});

console.log('\n');
console.log('═'.repeat(70));
console.log('\n');

// Step 6: Full flow simulation
console.log('6️⃣ FULL FLOW SIMULATION:\n');

console.log('   Simulating raf.js flow:');
console.log('   -------------------------\n');

const chats = testMessage;
const sender = '6285233047094@s.whatsapp.net';

console.log(`   1. User sends: "${chats}"`);
console.log(`   2. Sender: ${sender}`);
console.log(`   3. userRole: customer (default)\n`);

// Intent detection
let intent = 'TIDAK_DIKENALI';

const commandResult = commandManager.getIntent(chats, 'customer');
if (commandResult && commandResult.intent) {
    intent = commandResult.intent;
    console.log(`   4. ✅ Intent detected: "${intent}"`);
} else {
    console.log(`   4. ❌ Intent NOT detected (remains TIDAK_DIKENALI)`);
}

// Switch case
console.log(`\n   5. Switch case check:`);
console.log(`      switch(intent) { // intent = "${intent}"`);

if (intent === 'transaksi hari ini' || 
    intent === 'transaksi hariini' || 
    intent === 'today transactions' ||
    intent === 'transaksi' ||
    intent === 'my transactions') {
    console.log(`      ✅ MATCH! Will execute handler`);
} else if (intent === 'TIDAK_DIKENALI') {
    console.log(`      ❌ NO MATCH - intent is TIDAK_DIKENALI`);
    console.log(`      Command will be ignored (no response)`);
} else {
    console.log(`      ❌ NO MATCH - intent "${intent}" not in switch cases`);
}

console.log('\n');
console.log('═'.repeat(70));
console.log('\n');

// Diagnosis
console.log('📊 DIAGNOSIS:\n');

if (!result) {
    console.log('❌ PROBLEM: commandManager.getIntent() returns null');
    console.log('\nPossible causes:');
    console.log('1. Keyword tidak ada di commands.json');
    console.log('2. Role permission tidak match');
    console.log('3. Command tidak aktif/disabled');
    console.log('4. Bug di command-manager.js\n');
} else if (result.intent !== 'transaksi hari ini' && !switchCases.includes(result.intent)) {
    console.log(`❌ PROBLEM: Intent "${result.intent}" tidak match switch case`);
    console.log('\nSolution:');
    console.log('Update switch case atau update intent di commands.json\n');
} else {
    console.log('✅ Command detection SHOULD work!');
    console.log('\nIf still no response, check:');
    console.log('1. Bot is running and connected');
    console.log('2. Check logs for actual intent detected');
    console.log('3. Check handler execution');
    console.log('4. Check for errors in handler\n');
}

console.log('═'.repeat(70));
console.log('\n');

console.log('💡 NEXT STEPS:\n');
console.log('1. Restart bot: npm start');
console.log('2. Send "transaksi" from agent phone');
console.log('3. Check logs immediately:');
console.log('   tail -f logs/app-*.log | grep -E "transaksi|Intent detected|Command executed"');
console.log('4. Look for:');
console.log('   • "Intent detected via command manager"');
console.log('   • "Command executed: transaksi hari ini"');
console.log('   • "Transaksi command received"');
console.log('   • Any errors\n');
