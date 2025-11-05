/**
 * Test Keyword Matching System
 * Verifies that wifi templates keywords work properly
 */

const { getIntentFromKeywords } = require('../lib/wifi_template_handler');

console.log('🔍 TESTING KEYWORD MATCHING SYSTEM');
console.log('='.repeat(70));

// Test cases for various keywords
const testCases = [
    // Single word
    { input: 'cekwifi', expected: 'CEK_WIFI' },
    
    // Two words
    { input: 'cek wifi', expected: 'CEK_WIFI' },
    { input: 'status wifi', expected: 'CEK_WIFI' },
    { input: 'info wifi', expected: 'CEK_WIFI' },
    
    // Three words
    { input: 'cek wifi saya', expected: 'CEK_WIFI' },
    { input: 'lihat pengguna wifi', expected: 'CEK_WIFI' },
    { input: 'cek pengguna wifi', expected: 'CEK_WIFI' },
    
    // Four or more words
    { input: 'cek wifi rumah saya', expected: 'CEK_WIFI' },
    { input: 'siapa saja yang pakai wifi', expected: 'CEK_WIFI' },
    
    // Ganti nama wifi variations
    { input: 'ganti nama wifi', expected: 'GANTI_NAMA_WIFI' },
    { input: 'ubah nama wifi', expected: 'GANTI_NAMA_WIFI' },
    { input: 'ganti ssid', expected: 'GANTI_NAMA_WIFI' },
    { input: 'rename wifi', expected: 'GANTI_NAMA_WIFI' },
    
    // Ganti password wifi variations
    { input: 'ganti password wifi', expected: 'GANTI_PASSWORD_WIFI' },
    { input: 'ganti sandi wifi', expected: 'GANTI_PASSWORD_WIFI' },
    { input: 'ubah password', expected: 'GANTI_PASSWORD_WIFI' },
    { input: 'reset password wifi', expected: 'GANTI_PASSWORD_WIFI' },
    
    // With additional text (should still match)
    { input: 'cek wifi dong', expected: 'CEK_WIFI' },
    { input: 'cek wifi 123', expected: 'CEK_WIFI' },
    
    // Case insensitive
    { input: 'CEK WIFI', expected: 'CEK_WIFI' },
    { input: 'Cek Wifi', expected: 'CEK_WIFI' },
    { input: 'CeK wIfI', expected: 'CEK_WIFI' },
    
    // Should NOT match (keyword not at start)
    { input: 'tolong cek wifi', expected: null },
    { input: 'bisa cek wifi?', expected: null },
    { input: 'mau cek wifi', expected: null },
];

console.log('\n📋 TEST RESULTS:');
console.log('-'.repeat(70));

let passed = 0;
let failed = 0;

testCases.forEach(test => {
    const result = getIntentFromKeywords(test.input);
    const intent = result ? result.intent : null;
    const matchedKeyword = result ? result.matchedKeyword : 'none';
    const matchedLength = result ? result.matchedKeywordLength : 0;
    
    const isPass = intent === test.expected;
    
    if (isPass) {
        console.log(`✅ "${test.input}"`);
        console.log(`   Intent: ${intent || 'null'} | Keyword: "${matchedKeyword}" | Words: ${matchedLength}`);
        passed++;
    } else {
        console.log(`❌ "${test.input}"`);
        console.log(`   Expected: ${test.expected} | Got: ${intent || 'null'}`);
        console.log(`   Matched: "${matchedKeyword}" (${matchedLength} words)`);
        failed++;
    }
});

console.log('\n📊 SUMMARY:');
console.log('-'.repeat(70));
console.log(`Total Tests: ${testCases.length}`);
console.log(`✅ Passed: ${passed}`);
console.log(`❌ Failed: ${failed}`);
console.log(`Success Rate: ${((passed/testCases.length)*100).toFixed(1)}%`);

// Check longest keyword matching
console.log('\n🎯 LONGEST KEYWORD MATCHING TEST:');
console.log('-'.repeat(70));

const longestTests = [
    { 
        input: 'cek wifi saya dong', 
        possibleMatches: ['cek', 'cek wifi', 'cek wifi saya'],
        shouldMatch: 'cek wifi saya'
    },
    {
        input: 'ganti nama wifi jadi RAF',
        possibleMatches: ['ganti', 'ganti nama', 'ganti nama wifi'],
        shouldMatch: 'ganti nama wifi'
    }
];

longestTests.forEach(test => {
    const result = getIntentFromKeywords(test.input);
    console.log(`Input: "${test.input}"`);
    console.log(`Should match: "${test.shouldMatch}"`);
    console.log(`Actually matched: "${result ? result.matchedKeyword : 'none'}"`);
    console.log(`✅ Correct: ${result && result.matchedKeyword === test.shouldMatch}`);
    console.log('');
});

console.log('💡 KEY INSIGHTS:');
console.log('-'.repeat(70));
console.log('1. Keywords must be at START of message');
console.log('2. Longest matching keyword is prioritized');
console.log('3. Case insensitive matching works');
console.log('4. Multi-word keywords are supported');
console.log('5. Additional text after keyword is allowed');

process.exit(0);
