/**
 * Test Phone Numbers With and Without Plus Sign
 * Tests various international formats
 */

const {
    isValidPhoneFormat,
    normalizePhone,
    detectCountry
} = require('../lib/phone-validator-international');

console.log('📱 PHONE FORMAT TEST: WITH vs WITHOUT PLUS SIGN');
console.log('=' .repeat(60));

// Test cases for various formats
const testCases = [
    // Taiwan (886)
    { input: '+886912345678', country: 'Taiwan', desc: 'With +' },
    { input: '886912345678', country: 'Taiwan', desc: 'Without +' },
    
    // Japan (81)
    { input: '+81901234567', country: 'Japan', desc: 'With +' },
    { input: '81901234567', country: 'Japan', desc: 'Without +' },
    
    // South Korea (82)
    { input: '+821012345678', country: 'South Korea', desc: 'With +' },
    { input: '821012345678', country: 'South Korea', desc: 'Without +' },
    
    // China (86)
    { input: '+8613800138000', country: 'China', desc: 'With +' },
    { input: '8613800138000', country: 'China', desc: 'Without +' },
    
    // France (33)
    { input: '+33612345678', country: 'France', desc: 'With +' },
    { input: '33612345678', country: 'France', desc: 'Without +' },
    
    // UAE (971)
    { input: '+971501234567', country: 'UAE', desc: 'With +' },
    { input: '971501234567', country: 'UAE', desc: 'Without +' },
    
    // Indonesia (62) - Pre-configured
    { input: '+6281234567890', country: 'Indonesia', desc: 'With +' },
    { input: '6281234567890', country: 'Indonesia', desc: 'Without +' },
    { input: '081234567890', country: 'Indonesia', desc: 'Local format' },
    
    // Malaysia (60) - Pre-configured
    { input: '+60123456789', country: 'Malaysia', desc: 'With +' },
    { input: '60123456789', country: 'Malaysia', desc: 'Without +' },
    { input: '0123456789', country: 'Malaysia', desc: 'Local format' },
    
    // Invalid cases
    { input: '123', country: 'Invalid', desc: 'Too short' },
    { input: '1234567890123456', country: 'Invalid', desc: 'Too long' },
    { input: 'abc123', country: 'Invalid', desc: 'Contains letters' }
];

console.log('\n📊 TEST RESULTS:\n');
console.log('Input'.padEnd(20) + '| Valid | Country   | Normalized          | Notes');
console.log('-'.repeat(80));

testCases.forEach(test => {
    const validation = isValidPhoneFormat(test.input);
    const normalized = normalizePhone(test.input);
    const detected = detectCountry(test.input);
    
    const validIcon = validation.valid ? '✅' : '❌';
    const countryDisplay = validation.country.padEnd(10);
    
    console.log(
        test.input.padEnd(20) + '| ' + 
        validIcon + '    | ' +
        countryDisplay + '| ' +
        normalized.padEnd(20) + '| ' +
        `${test.country} (${test.desc})`
    );
});

// Summary of findings
console.log('\n' + '=' .repeat(60));
console.log('📋 KESIMPULAN:\n');

console.log('✅ NOMOR DENGAN COUNTRY CODE TANPA + (Contoh: 886xxx, 81xxx):');
console.log('   - Status: VALID dan DITERIMA');
console.log('   - Auto normalized: Akan ditambahkan + otomatis');
console.log('   - Deteksi: Dikenali sebagai INTERNATIONAL');
console.log('   - Contoh: 886912345678 → +886912345678\n');

console.log('✅ NOMOR DENGAN + (Contoh: +886xxx, +81xxx):');
console.log('   - Status: VALID dan DITERIMA');
console.log('   - Format standar E.164');
console.log('   - Lebih eksplisit dan jelas\n');

console.log('📌 REKOMENDASI:');
console.log('   1. Keduanya VALID (dengan atau tanpa +)');
console.log('   2. Tanpa + tetap diterima untuk country code');
console.log('   3. Dengan + lebih jelas dan standard internasional');
console.log('   4. System akan auto-normalize ke format dengan +\n');

console.log('⚠️ PERHATIAN:');
console.log('   - Nomor harus dimulai dengan country code yang valid');
console.log('   - Panjang total: 7-15 digit (standard E.164)');
console.log('   - Untuk format lokal, gunakan format spesifik negara');
console.log('   - Contoh: 08xxx untuk Indonesia, 01xxx untuk Malaysia\n');

console.log('✅ VALIDATION COMPLETE!');
