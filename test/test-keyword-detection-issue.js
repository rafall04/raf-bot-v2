/**
 * Test Keyword Detection Issue
 * Diagnose why "cek wifi" works for admin but not pelanggan
 */

const { getIntentFromKeywords } = require('../lib/wifi_template_handler');

console.log('🔍 DIAGNOSING KEYWORD DETECTION ISSUE');
console.log('='.repeat(70));

// Test all variations
const testCases = [
    { input: 'cekwifi', user: 'pelanggan' },
    { input: 'cek wifi', user: 'pelanggan' },
    { input: 'CEK WIFI', user: 'pelanggan' },
    { input: 'cek wifi saya', user: 'pelanggan' },
    { input: 'cekwifi', user: 'admin' },
    { input: 'cek wifi', user: 'admin' },
    { input: 'ganti nama wifi', user: 'pelanggan' },
    { input: 'gantinamawifi', user: 'pelanggan' },
    { input: 'ganti password wifi', user: 'pelanggan' },
    { input: 'gantipassword', user: 'pelanggan' },
];

console.log('\n📋 KEYWORD HANDLER TEST (getIntentFromKeywords):');
console.log('-'.repeat(70));

testCases.forEach(test => {
    const result = getIntentFromKeywords(test.input);
    const status = result ? '✅' : '❌';
    
    console.log(`${status} "${test.input}" (${test.user})`);
    if (result) {
        console.log(`   → Intent: ${result.intent} | Matched: "${result.matchedKeyword}"`);
    } else {
        console.log(`   → NOT DETECTED by keyword handler`);
    }
});

// Check static intents
const staticIntents = {
    'menu': 'MENU_UTAMA',
    'ceksaldo': 'CEK_SALDO',
    'lapor': 'LAPOR_GANGGUAN',
    // ... other static intents (not including WiFi commands)
};

console.log('\n📋 STATIC INTENTS CHECK:');
console.log('-'.repeat(70));

const wifiCommands = ['cekwifi', 'cek', 'wifi', 'gantinamawifi', 'gantipassword'];
wifiCommands.forEach(cmd => {
    const hasStatic = staticIntents[cmd] ? '✅' : '❌';
    console.log(`${hasStatic} "${cmd}" in staticIntents: ${staticIntents[cmd] || 'NOT FOUND'}`);
});

console.log('\n🔴 PROBLEM IDENTIFIED:');
console.log('-'.repeat(70));
console.log('1. Single-word WiFi commands (cekwifi, gantinamawifi) are in wifi_templates.json');
console.log('2. But they are NOT in staticIntents');
console.log('3. getIntentFromKeywords should detect them from wifi_templates.json');
console.log('4. If not detected, they fall back to staticIntents (where they don\'t exist)');

console.log('\n💡 SOLUTION NEEDED:');
console.log('-'.repeat(70));
console.log('Ensure ALL keywords from wifi_templates.json work for ALL users:');
console.log('1. Fix getIntentFromKeywords to properly match single-word keywords');
console.log('2. OR add WiFi commands to staticIntents as fallback');
console.log('3. OR ensure keyword matching works consistently for all user types');

// Simulate the full flow
console.log('\n🔄 SIMULATING FULL DETECTION FLOW:');
console.log('-'.repeat(70));

function detectIntent(message) {
    // Step 1: Try keyword handler
    const keywordResult = getIntentFromKeywords(message);
    if (keywordResult) {
        return { source: 'keywords', ...keywordResult };
    }
    
    // Step 2: Try static intents (single word only)
    const command = message.toLowerCase().split(' ')[0];
    const staticIntent = staticIntents[command];
    if (staticIntent) {
        return { source: 'static', intent: staticIntent, command };
    }
    
    return null;
}

const flowTests = [
    'cekwifi',
    'cek wifi',
    'gantinamawifi',
    'ganti nama wifi',
    'menu',
    'lapor'
];

flowTests.forEach(test => {
    const result = detectIntent(test);
    if (result) {
        console.log(`✅ "${test}" → ${result.intent} (via ${result.source})`);
    } else {
        console.log(`❌ "${test}" → NOT DETECTED`);
    }
});

process.exit(0);
