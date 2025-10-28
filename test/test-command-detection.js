/**
 * Test Command Detection Logic
 * Memastikan command hanya dideteksi di awal pesan, bukan di tengah/akhir
 */

const commandManager = require('../lib/command-manager');
const { getIntentFromKeywords } = require('../lib/wifi_template_handler');

console.log('='.repeat(70));
console.log('TEST COMMAND DETECTION - Prevent False Positives');
console.log('='.repeat(70));

const testCases = [
    // ===== SHOULD MATCH (Command di awal) =====
    {
        message: 'topup',
        shouldMatch: true,
        expectedIntent: 'TOPUP_SALDO',
        description: 'Command saja'
    },
    {
        message: 'topup 50000',
        shouldMatch: true,
        expectedIntent: 'TOPUP_SALDO',
        description: 'Command dengan parameter'
    },
    {
        message: 'lapor gangguan internet',
        shouldMatch: true,
        expectedIntent: 'LAPOR_GANGGUAN',
        description: 'Multi-word command di awal'
    },
    {
        message: 'cek saldo',
        shouldMatch: true,
        expectedIntent: 'CEK_SALDO',
        description: 'Command 2 kata'
    },
    {
        message: 'ganti nama wifi',
        shouldMatch: true,
        expectedIntent: 'GANTI_NAMA_WIFI',
        description: 'Command 3 kata'
    },
    {
        message: 'TOPUP',
        shouldMatch: true,
        expectedIntent: 'TOPUP_SALDO',
        description: 'Command uppercase'
    },
    
    // ===== SHOULD NOT MATCH (Command di tengah/akhir) =====
    {
        message: 'masmau konsultasi tentang topup',
        shouldMatch: false,
        expectedIntent: 'TIDAK_DIKENALI',
        description: 'Command di akhir kalimat'
    },
    {
        message: 'saya mau topup tapi bingung caranya',
        shouldMatch: false,
        expectedIntent: 'TIDAK_DIKENALI',
        description: 'Command di tengah kalimat'
    },
    {
        message: 'bagaimana cara lapor gangguan?',
        shouldMatch: false,
        expectedIntent: 'TIDAK_DIKENALI',
        description: 'Command di tengah pertanyaan'
    },
    {
        message: 'mau tanya tentang cek saldo',
        shouldMatch: false,
        expectedIntent: 'TIDAK_DIKENALI',
        description: 'Command di akhir pertanyaan'
    },
    {
        message: 'gimana kalau mau ganti nama wifi',
        shouldMatch: false,
        expectedIntent: 'TIDAK_DIKENALI',
        description: 'Multi-word command di akhir'
    },
    {
        message: 'kemarin saya sudah topup kok belum masuk',
        shouldMatch: false,
        expectedIntent: 'TIDAK_DIKENALI',
        description: 'Command di tengah komplain'
    },
    {
        message: 'mas admin, saya butuh bantuan topup',
        shouldMatch: false,
        expectedIntent: 'TIDAK_DIKENALI',
        description: 'Command di akhir request bantuan'
    }
];

let passed = 0;
let failed = 0;

console.log('\n🔍 Testing Command Manager...\n');

testCases.forEach((testCase, index) => {
    const result = commandManager.getIntent(testCase.message, 'customer');
    const detectedIntent = result ? result.intent : 'TIDAK_DIKENALI';
    const isMatch = result !== null;
    
    const testPassed = (isMatch === testCase.shouldMatch);
    
    if (testPassed) {
        console.log(`✅ Test ${index + 1}: PASS`);
        passed++;
    } else {
        console.log(`❌ Test ${index + 1}: FAIL`);
        failed++;
    }
    
    console.log(`   Message: "${testCase.message}"`);
    console.log(`   Expected: ${testCase.shouldMatch ? 'MATCH' : 'NO MATCH'} (${testCase.expectedIntent})`);
    console.log(`   Got: ${isMatch ? 'MATCH' : 'NO MATCH'} (${detectedIntent})`);
    console.log(`   Description: ${testCase.description}`);
    console.log('');
});

console.log('='.repeat(70));
console.log('📊 COMMAND MANAGER TEST RESULTS');
console.log('='.repeat(70));
console.log(`✅ Passed: ${passed}/${testCases.length}`);
console.log(`❌ Failed: ${failed}/${testCases.length}`);
console.log(`📈 Success Rate: ${((passed/testCases.length)*100).toFixed(1)}%`);
console.log('='.repeat(70));

console.log('\n🔍 Testing WiFi Template Handler (Legacy)...\n');

let passedLegacy = 0;
let failedLegacy = 0;

testCases.forEach((testCase, index) => {
    const result = getIntentFromKeywords(testCase.message);
    const detectedIntent = result ? result.intent : 'TIDAK_DIKENALI';
    const isMatch = result !== null;
    
    const testPassed = (isMatch === testCase.shouldMatch);
    
    if (testPassed) {
        console.log(`✅ Test ${index + 1}: PASS`);
        passedLegacy++;
    } else {
        console.log(`❌ Test ${index + 1}: FAIL`);
        failedLegacy++;
    }
    
    console.log(`   Message: "${testCase.message}"`);
    console.log(`   Expected: ${testCase.shouldMatch ? 'MATCH' : 'NO MATCH'}`);
    console.log(`   Got: ${isMatch ? 'MATCH' : 'NO MATCH'} (${detectedIntent})`);
    console.log(`   Description: ${testCase.description}`);
    console.log('');
});

console.log('='.repeat(70));
console.log('📊 WIFI TEMPLATE HANDLER TEST RESULTS');
console.log('='.repeat(70));
console.log(`✅ Passed: ${passedLegacy}/${testCases.length}`);
console.log(`❌ Failed: ${failedLegacy}/${testCases.length}`);
console.log(`📈 Success Rate: ${((passedLegacy/testCases.length)*100).toFixed(1)}%`);
console.log('='.repeat(70));

// Summary
console.log('\n' + '='.repeat(70));
console.log('🎯 FINAL SUMMARY');
console.log('='.repeat(70));
console.log(`Total Tests: ${testCases.length}`);
console.log(`Command Manager: ${passed} passed, ${failed} failed`);
console.log(`WiFi Template Handler: ${passedLegacy} passed, ${failedLegacy} failed`);
console.log('='.repeat(70));

if (failed === 0 && failedLegacy === 0) {
    console.log('\n🎉 ALL TESTS PASSED! Command detection working correctly.');
    console.log('✅ Commands are only detected at START of message.');
    process.exit(0);
} else {
    console.log('\n⚠️ SOME TESTS FAILED! Please review the logic.');
    process.exit(1);
}
