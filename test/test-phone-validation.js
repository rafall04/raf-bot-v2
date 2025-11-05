/**
 * Test Phone Number Validation
 * Verifies that duplicate phone numbers are prevented
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { validatePhoneNumbers, normalizePhone, getAllPhoneNumbers } = require('../lib/phone-validator');

// Test database path
const dbPath = path.join(__dirname, '..', 'database.sqlite');

console.log('📱 PHONE NUMBER VALIDATION TEST');
console.log('=' .repeat(60));

// Connect to database
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ Failed to connect to database:', err);
        process.exit(1);
    }
    console.log('✅ Connected to database');
});

async function runTests() {
    try {
        // Test 1: Get all existing phone numbers
        console.log('\n📋 Test 1: Getting all existing phone numbers...');
        const phoneMap = await getAllPhoneNumbers(db);
        console.log(`Found ${phoneMap.size} phone numbers in database`);
        
        // Show first 5 entries
        let count = 0;
        for (const [phone, data] of phoneMap.entries()) {
            if (count++ < 5) {
                console.log(`  ${phone} → User: ${data.userName} (ID: ${data.userId})`);
            }
        }
        
        // Test 2: Validate new phone number
        console.log('\n📋 Test 2: Validating new phone number...');
        const newPhone = '081234567890';
        const result1 = await validatePhoneNumbers(db, newPhone, null);
        console.log(`  Input: ${newPhone}`);
        console.log(`  Valid: ${result1.valid}`);
        console.log(`  Message: ${result1.message}`);
        
        // Test 3: Try to validate existing phone
        console.log('\n📋 Test 3: Validating existing phone number...');
        // Get first phone from database
        const firstPhone = phoneMap.keys().next().value;
        if (firstPhone) {
            const result2 = await validatePhoneNumbers(db, firstPhone, null);
            console.log(`  Input: ${firstPhone}`);
            console.log(`  Valid: ${result2.valid}`);
            console.log(`  Message: ${result2.message}`);
            if (result2.conflictUser) {
                console.log(`  Conflict: ${result2.conflictUser.name} (ID: ${result2.conflictUser.id})`);
            }
        }
        
        // Test 4: Validate multiple phone numbers (pipe-separated)
        console.log('\n📋 Test 4: Validating multiple phone numbers...');
        const multiplePhones = '081234567890|082345678901|083456789012';
        const result3 = await validatePhoneNumbers(db, multiplePhones, null);
        console.log(`  Input: ${multiplePhones}`);
        console.log(`  Valid: ${result3.valid}`);
        console.log(`  Message: ${result3.message}`);
        
        // Test 5: Validate with duplicate in input
        console.log('\n📋 Test 5: Validating with duplicate in input...');
        const duplicatePhones = '081234567890|082345678901|081234567890';
        const result4 = await validatePhoneNumbers(db, duplicatePhones, null);
        console.log(`  Input: ${duplicatePhones}`);
        console.log(`  Valid: ${result4.valid}`);
        console.log(`  Message: ${result4.message}`);
        
        // Test 6: Validate update (exclude own ID)
        console.log('\n📋 Test 6: Validating update (exclude own ID)...');
        // Get first user
        const firstUser = await new Promise((resolve, reject) => {
            db.get('SELECT id, phone_number FROM users LIMIT 1', (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
        
        if (firstUser) {
            // Try to update with own phone number (should be valid)
            const result5 = await validatePhoneNumbers(db, firstUser.phone_number, firstUser.id);
            console.log(`  User ID: ${firstUser.id}`);
            console.log(`  Phone: ${firstUser.phone_number}`);
            console.log(`  Valid: ${result5.valid}`);
            console.log(`  Message: ${result5.message}`);
        }
        
        // Test 7: Phone normalization
        console.log('\n📋 Test 7: Phone normalization...');
        const testNumbers = [
            '081234567890',
            '6281234567890',
            '+6281234567890',
            '0812-3456-7890',
            '(0812) 3456 7890'
        ];
        
        testNumbers.forEach(num => {
            const normalized = normalizePhone(num);
            console.log(`  ${num} → ${normalized}`);
        });
        
        console.log('\n' + '=' .repeat(60));
        console.log('✅ ALL TESTS COMPLETED!');
        
    } catch (error) {
        console.error('❌ Test failed:', error);
    } finally {
        db.close();
        process.exit(0);
    }
}

// Run tests
runTests();
