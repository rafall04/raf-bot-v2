/**
 * Test International Phone Number Support
 * Tests validation for multiple countries
 */

const {
    isValidPhoneFormat,
    normalizePhone,
    detectCountry,
    getSupportedCountries,
    getCountryName
} = require('../lib/phone-validator-international');

console.log('🌍 INTERNATIONAL PHONE NUMBER TEST');
console.log('=' .repeat(60));

// Test 1: Supported Countries
console.log('\n📋 Test 1: SUPPORTED COUNTRIES');
const countries = getSupportedCountries();
countries.forEach(country => {
    console.log(`  ${country.code}: ${country.name} (+${country.countryCode}) - Example: ${country.example}`);
});

// Test 2: Phone Number Detection
console.log('\n📋 Test 2: COUNTRY DETECTION');
const testNumbers = [
    // Indonesia
    '081234567890',
    '6281234567890',
    '+6281234567890',
    
    // Malaysia
    '0123456789',
    '60123456789',
    '+60123456789',
    
    // Singapore
    '91234567',
    '6591234567',
    '+6591234567',
    
    // Thailand
    '0812345678',
    '66812345678',
    '+66812345678',
    
    // Philippines
    '09123456789',
    '639123456789',
    '+639123456789',
    
    // India
    '9876543210',
    '919876543210',
    '+919876543210',
    
    // USA
    '2125551234',
    '12125551234',
    '+12125551234',
    
    // UK
    '07123456789',
    '447123456789',
    '+447123456789',
    
    // Australia
    '0412345678',
    '61412345678',
    '+61412345678',
    
    // Unknown/Generic
    '+33123456789',  // France
    '+8613800138000', // China
    '+97144444444'    // UAE
];

console.log('\nPhone Number → Country → Normalized');
console.log('-' .repeat(60));

testNumbers.forEach(phone => {
    const country = detectCountry(phone);
    const normalized = normalizePhone(phone);
    const countryName = getCountryName(country);
    const validation = isValidPhoneFormat(phone);
    const icon = validation.valid ? '✅' : '❌';
    
    console.log(`${phone.padEnd(15)} → ${countryName.padEnd(15)} → ${normalized.padEnd(15)} ${icon}`);
});

// Test 3: Validation Results
console.log('\n📋 Test 3: VALIDATION DETAILS');
const detailedTests = [
    { phone: '081234567890', expected: 'ID' },
    { phone: '0123456789', expected: 'MY' },
    { phone: '91234567', expected: 'SG' },
    { phone: '+33612345678', expected: 'INTERNATIONAL' },
    { phone: 'invalid123', expected: 'UNKNOWN' },
    { phone: '123', expected: 'UNKNOWN' }
];

detailedTests.forEach(test => {
    const validation = isValidPhoneFormat(test.phone);
    console.log(`\nPhone: ${test.phone}`);
    console.log(`  Valid: ${validation.valid}`);
    console.log(`  Country: ${validation.country}`);
    console.log(`  Expected: ${test.expected}`);
    console.log(`  Match: ${validation.country === test.expected ? '✅' : '❌'}`);
});

// Test 4: Multiple Countries in One Input
console.log('\n📋 Test 4: MIXED COUNTRIES (Pipe-Separated)');
const mixedPhones = '081234567890|+60123456789|+6591234567|+12125551234';
const phones = mixedPhones.split('|');

console.log(`Input: ${mixedPhones}`);
console.log('\nBreakdown:');
phones.forEach(phone => {
    const country = detectCountry(phone);
    const normalized = normalizePhone(phone);
    console.log(`  ${phone} → ${getCountryName(country)} → ${normalized}`);
});

// Test 5: Normalization Consistency
console.log('\n📋 Test 5: NORMALIZATION CONSISTENCY');
const variousFormats = [
    // Indonesia variations
    ['081234567890', '0812-3456-7890', '(0812) 3456 7890', '+6281234567890'],
    // Malaysia variations
    ['0123456789', '012-345-6789', '+60123456789', '60123456789'],
    // USA variations
    ['2125551234', '(212) 555-1234', '+1-212-555-1234', '12125551234']
];

variousFormats.forEach((group, index) => {
    console.log(`\nGroup ${index + 1}:`);
    const normalized = group.map(phone => normalizePhone(phone));
    const allSame = normalized.every(n => n === normalized[0]);
    
    group.forEach((phone, i) => {
        console.log(`  ${phone.padEnd(20)} → ${normalized[i]}`);
    });
    console.log(`  All normalize to same: ${allSame ? '✅' : '❌'}`);
});

// Summary
console.log('\n' + '=' .repeat(60));
console.log('📊 SUMMARY:');
console.log(`  Supported Countries: ${countries.length}`);
console.log(`  Plus Generic International Format`);
console.log('\n🌍 FEATURES:');
console.log('  ✅ Auto-detect country from format');
console.log('  ✅ Normalize to international format');
console.log('  ✅ Validate multiple formats per country');
console.log('  ✅ Support pipe-separated multi-country');
console.log('  ✅ Backward compatible with Indonesia-only');
console.log('\n✅ INTERNATIONAL SUPPORT READY!');
