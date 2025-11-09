/**
 * Test Multiple Phone Numbers Handling
 * Verifies that notifications are sent to all phone numbers
 */

console.log('='.repeat(50));
console.log('   MULTIPLE PHONE NUMBERS TEST');
console.log('='.repeat(50));
console.log('');

// Test phone number splitting logic
function testPhoneSplitting() {
    console.log('1. TESTING PHONE NUMBER SPLITTING:');
    console.log('');
    
    const testCases = [
        {
            input: '6285233047094',
            expected: ['6285233047094'],
            description: 'Single number'
        },
        {
            input: '6285233047094|6285604652630',
            expected: ['6285233047094', '6285604652630'],
            description: 'Two numbers with pipe'
        },
        {
            input: '6285233047094 | 6285604652630',
            expected: ['6285233047094', '6285604652630'],
            description: 'Two numbers with spaces'
        },
        {
            input: '6285233047094|6285604652630|6285123456789',
            expected: ['6285233047094', '6285604652630', '6285123456789'],
            description: 'Three numbers'
        },
        {
            input: '6285233047094||6285604652630',
            expected: ['6285233047094', '6285604652630'],
            description: 'Double pipe (empty element)'
        },
        {
            input: '|6285233047094|',
            expected: ['6285233047094'],
            description: 'Leading/trailing pipes'
        },
        {
            input: '',
            expected: [],
            description: 'Empty string'
        },
        {
            input: '|||',
            expected: [],
            description: 'Only pipes'
        }
    ];
    
    testCases.forEach(test => {
        const result = test.input.split('|').map(p => p.trim()).filter(p => p);
        const passed = JSON.stringify(result) === JSON.stringify(test.expected);
        
        console.log(`   ${test.description}:`);
        console.log(`   Input: "${test.input}"`);
        console.log(`   Expected: [${test.expected.join(', ')}]`);
        console.log(`   Got: [${result.join(', ')}]`);
        console.log(`   Result: ${passed ? '✅ PASS' : '❌ FAIL'}`);
        console.log('');
    });
}

// Test phone number formatting
function testPhoneFormatting() {
    console.log('2. TESTING PHONE NUMBER FORMATTING:');
    console.log('');
    
    function formatPhone(phoneJid) {
        if (!phoneJid.endsWith('@s.whatsapp.net')) {
            if (phoneJid.startsWith('0')) {
                phoneJid = `62${phoneJid.substring(1)}@s.whatsapp.net`;
            } else if (phoneJid.startsWith('62')) {
                phoneJid = `${phoneJid}@s.whatsapp.net`;
            } else if (phoneJid.startsWith('+62')) {
                phoneJid = `${phoneJid.substring(1)}@s.whatsapp.net`;
            } else {
                phoneJid = `62${phoneJid}@s.whatsapp.net`;
            }
        }
        return phoneJid;
    }
    
    const formatTests = [
        { input: '085233047094', expected: '6285233047094@s.whatsapp.net' },
        { input: '6285233047094', expected: '6285233047094@s.whatsapp.net' },
        { input: '+6285233047094', expected: '6285233047094@s.whatsapp.net' },
        { input: '85233047094', expected: '6285233047094@s.whatsapp.net' },
        { input: '6285233047094@s.whatsapp.net', expected: '6285233047094@s.whatsapp.net' }
    ];
    
    formatTests.forEach(test => {
        const result = formatPhone(test.input);
        const passed = result === test.expected;
        
        console.log(`   Input: ${test.input}`);
        console.log(`   Expected: ${test.expected}`);
        console.log(`   Got: ${result}`);
        console.log(`   Result: ${passed ? '✅ PASS' : '❌ FAIL'}`);
        console.log('');
    });
}

// Simulate notification sending
async function simulateNotificationSending() {
    console.log('3. SIMULATING NOTIFICATION SENDING:');
    console.log('');
    
    const userPhone = '6285233047094|6285604652630|085123456789';
    const phoneNumbers = userPhone.split('|').map(p => p.trim()).filter(p => p);
    
    console.log(`   Customer has ${phoneNumbers.length} phone number(s): ${phoneNumbers.join(', ')}`);
    console.log('');
    
    // Mock sending function
    async function mockSend(phoneJid, message) {
        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Simulate success/failure randomly
        if (Math.random() > 0.8) {
            throw new Error('WhatsApp send timeout');
        }
        
        return { status: 'sent', phoneJid };
    }
    
    // Process each phone number
    const results = [];
    for (let phoneNum of phoneNumbers) {
        let phoneJid = phoneNum.trim();
        
        // Format phone number
        if (!phoneJid.endsWith('@s.whatsapp.net')) {
            if (phoneJid.startsWith('0')) {
                phoneJid = `62${phoneJid.substring(1)}@s.whatsapp.net`;
            } else if (phoneJid.startsWith('62')) {
                phoneJid = `${phoneJid}@s.whatsapp.net`;
            } else if (phoneJid.startsWith('+62')) {
                phoneJid = `${phoneJid.substring(1)}@s.whatsapp.net`;
            } else {
                phoneJid = `62${phoneJid}@s.whatsapp.net`;
            }
        }
        
        console.log(`   Processing: ${phoneNum} -> ${phoneJid}`);
        
        try {
            const result = await mockSend(phoneJid, 'Test message');
            console.log(`   ✅ Success: Sent to ${phoneJid}`);
            results.push({ phoneNum, phoneJid, status: 'success' });
        } catch (error) {
            console.log(`   ❌ Failed: ${error.message} for ${phoneJid}`);
            results.push({ phoneNum, phoneJid, status: 'failed', error: error.message });
        }
        console.log('');
    }
    
    // Summary
    console.log('   SUMMARY:');
    console.log(`   Total numbers: ${phoneNumbers.length}`);
    console.log(`   Successful: ${results.filter(r => r.status === 'success').length}`);
    console.log(`   Failed: ${results.filter(r => r.status === 'failed').length}`);
    console.log('');
    
    return results;
}

// Main test execution
async function runTests() {
    testPhoneSplitting();
    testPhoneFormatting();
    await simulateNotificationSending();
    
    console.log('='.repeat(50));
    console.log('   KEY FINDINGS');
    console.log('='.repeat(50));
    console.log('');
    console.log('IMPLEMENTATION PATTERN:');
    console.log('```javascript');
    console.log('// Split phone numbers');
    console.log("const phoneNumbers = userPhone.split('|').map(p => p.trim()).filter(p => p);");
    console.log('');
    console.log('// Send to each number');
    console.log('for (let phoneNum of phoneNumbers) {');
    console.log('    try {');
    console.log('        // Format and send to phoneNum');
    console.log('    } catch (err) {');
    console.log('        // Log error but continue with next number');
    console.log('    }');
    console.log('}');
    console.log('```');
    console.log('');
    console.log('BENEFITS:');
    console.log('✅ All customer numbers receive notifications');
    console.log('✅ Errors on one number don\'t affect others');
    console.log('✅ Clear logging per number');
    console.log('✅ Backward compatible with single numbers');
    console.log('');
}

// Run all tests
runTests().then(() => {
    console.log('='.repeat(50));
    console.log('   TEST COMPLETE');
    console.log('='.repeat(50));
}).catch(console.error);
