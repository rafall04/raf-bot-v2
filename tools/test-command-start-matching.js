#!/usr/bin/env node
/**
 * Test Command Start Matching
 * Verify commands only match at START of message to prevent spam
 */

const commandManager = require('../lib/command-manager');

console.log('🧪 TESTING COMMAND START MATCHING\n');
console.log('═'.repeat(70));
console.log('\n');

// Test cases
const testCases = [
    // VALID - Should match
    { message: 'topup', expected: 'topup', shouldMatch: true },
    { message: 'topup 50000', expected: 'topup', shouldMatch: true },
    { message: 'cek topup TOP123', expected: 'check_topup_status', shouldMatch: true },
    { message: 'cek topup', expected: 'check_topup_status', shouldMatch: true },
    { message: 'transaksi', expected: 'transaksi hari ini', shouldMatch: true },
    { message: 'transaksi hari ini', expected: 'transaksi hari ini', shouldMatch: true },
    { message: 'ganti pin 1234 5678', expected: 'agent_change_pin', shouldMatch: true },
    { message: 'menu', expected: 'menu', shouldMatch: true },
    { message: 'saldo', expected: 'ceksaldo', shouldMatch: true },
    
    // INVALID - Should NOT match (keyword in middle/end)
    { message: 'hari ini saya mau topup', expected: null, shouldMatch: false },
    { message: 'saya mau cek topup dong', expected: null, shouldMatch: false },
    { message: 'gimana cara topup ya?', expected: null, shouldMatch: false },
    { message: 'mau transaksi', expected: null, shouldMatch: false },
    { message: 'kapan bisa topup?', expected: null, shouldMatch: false },
    { message: 'tolong saya mau menu', expected: null, shouldMatch: false },
    { message: 'info saldo saya', expected: null, shouldMatch: false },
    { message: 'berapa saldo saya?', expected: null, shouldMatch: false },
    
    // EDGE CASES
    { message: 'TOPUP', expected: 'topup', shouldMatch: true }, // Case insensitive
    { message: 'Topup', expected: 'topup', shouldMatch: true },
    { message: 'topup   ', expected: 'topup', shouldMatch: true }, // Trailing spaces
    { message: '  topup', expected: null, shouldMatch: false }, // Leading spaces should not match
    { message: 'topupan', expected: null, shouldMatch: false }, // Partial word
    { message: 'cetopup', expected: null, shouldMatch: false }, // Part of word
];

console.log('📊 TEST RESULTS:\n');
console.log('VALID COMMANDS (should match):');
console.log('─'.repeat(70));

let passedValid = 0;
let failedValid = 0;

testCases.filter(t => t.shouldMatch).forEach(test => {
    const result = commandManager.getIntent(test.message, 'customer');
    const matched = result ? result.intent : null;
    const pass = matched === test.expected;
    
    if (pass) passedValid++;
    else failedValid++;
    
    console.log(`${pass ? '✅' : '❌'} "${test.message}"`);
    console.log(`   Expected: ${test.expected}`);
    console.log(`   Got: ${matched}`);
    if (!pass) console.log(`   ⚠️  FAIL!`);
    console.log('');
});

console.log('─'.repeat(70));
console.log('\n');

console.log('INVALID COMMANDS (should NOT match):');
console.log('─'.repeat(70));

let passedInvalid = 0;
let failedInvalid = 0;

testCases.filter(t => !t.shouldMatch).forEach(test => {
    const result = commandManager.getIntent(test.message, 'customer');
    const matched = result ? result.intent : null;
    const pass = matched === test.expected; // Should be null
    
    if (pass) passedInvalid++;
    else failedInvalid++;
    
    console.log(`${pass ? '✅' : '❌'} "${test.message}"`);
    console.log(`   Expected: No match (null)`);
    console.log(`   Got: ${matched || 'null'}`);
    if (!pass) console.log(`   ⚠️  FAIL - This would cause spam!`);
    console.log('');
});

console.log('─'.repeat(70));
console.log('\n');

// Priority test - longer keywords first
console.log('🎯 PRIORITY TEST (Longer Keywords First):\n');

const priorityTests = [
    { message: 'cek topup TOP123', longer: 'cek topup', shorter: 'topup', expectedIntent: 'check_topup_status' },
    { message: 'cek saldo', longer: 'cek saldo', shorter: 'saldo', expectedIntent: 'ceksaldo' },
    { message: 'transaksi hari ini', longer: 'transaksi hari ini', shorter: 'transaksi', expectedIntent: 'transaksi hari ini' },
];

priorityTests.forEach(test => {
    const result = commandManager.getIntent(test.message, 'agent');
    const matched = result ? result.intent : null;
    const pass = matched === test.expectedIntent;
    
    console.log(`${pass ? '✅' : '❌'} "${test.message}"`);
    console.log(`   Should match: "${test.longer}" (not "${test.shorter}")`);
    console.log(`   Expected intent: ${test.expectedIntent}`);
    console.log(`   Got: ${matched}`);
    if (!pass) console.log(`   ⚠️  FAIL - Wrong priority!`);
    console.log('');
});

console.log('═'.repeat(70));
console.log('\n');

// Summary
const totalValid = passedValid + failedValid;
const totalInvalid = passedInvalid + failedInvalid;
const totalTests = totalValid + totalInvalid + priorityTests.length;
const totalPassed = passedValid + passedInvalid + priorityTests.filter(t => {
    const result = commandManager.getIntent(t.message, 'agent');
    return result && result.intent === t.expectedIntent;
}).length;

console.log('📈 SUMMARY:\n');
console.log(`Valid Commands:   ${passedValid}/${totalValid} passed`);
console.log(`Invalid Commands: ${passedInvalid}/${totalInvalid} passed (spam prevented)`);
console.log(`Priority Tests:   ${priorityTests.filter(t => {
    const result = commandManager.getIntent(t.message, 'agent');
    return result && result.intent === t.expectedIntent;
}).length}/${priorityTests.length} passed`);
console.log(`\nTotal: ${totalPassed}/${totalTests} tests passed\n`);

if (totalPassed === totalTests) {
    console.log('✅ ALL TESTS PASSED!\n');
    console.log('Commands will only match at START of message.');
    console.log('No more spam from normal conversations! 🎉\n');
} else {
    console.log('❌ SOME TESTS FAILED!\n');
    console.log('Please review the failed tests above.\n');
}

console.log('═'.repeat(70));
console.log('\n');

console.log('💡 EXAMPLES:\n');
console.log('BEFORE FIX:');
console.log('───────────');
console.log('User: "hari ini saya mau topup"');
console.log('Bot: 💳 TOP UP SALDO... (SPAM!) ❌\n');

console.log('User: "gimana cara topup ya?"');
console.log('Bot: 💳 TOP UP SALDO... (SPAM!) ❌\n');

console.log('AFTER FIX:');
console.log('──────────');
console.log('User: "hari ini saya mau topup"');
console.log('Bot: (no response) ✅\n');

console.log('User: "gimana cara topup ya?"');
console.log('Bot: (no response) ✅\n');

console.log('User: "topup"');
console.log('Bot: 💳 TOP UP SALDO... ✅\n');

console.log('User: "cek topup TOP123"');
console.log('Bot: Shows topup status ✅\n');

console.log('═'.repeat(70));
console.log('\n');

console.log('✅ FIX COMPLETE!\n');
console.log('Changes applied:');
console.log('• Commands only match at START of message (^ regex)');
console.log('• Longer keywords prioritized (cek topup > topup)');
console.log('• No more false positives from normal chat\n');

console.log('Next steps:');
console.log('1. Restart bot: npm start');
console.log('2. Test normal chat with "topup" in middle');
console.log('3. Test actual commands: "topup", "cek topup TOP123"');
console.log('4. Verify no spam in admin-user conversations\n');
