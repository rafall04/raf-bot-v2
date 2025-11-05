/**
 * Test Batalkan Tiket Parsing
 * Verifies ticket ID extraction from various formats
 */

console.log('🧪 TESTING TICKET ID EXTRACTION\n');

// Test function that mimics the extraction logic
function extractTicketId(chats) {
    const originalMessage = chats.trim();
    
    // Remove "batalkantiket" or "batalkan tiket" from the beginning (case insensitive)
    const cleanedMessage = originalMessage.replace(/^batalkan\s*tiket\s*/i, '').trim();
    
    // The remaining part should be the ticket ID
    if (cleanedMessage && cleanedMessage.length > 0) {
        return cleanedMessage.toUpperCase();
    }
    
    return '';
}

// Test cases
const testCases = [
    { input: 'Batalkantiket 9NK5MS8', expected: '9NK5MS8' },
    { input: 'batalkantiket 9nk5ms8', expected: '9NK5MS8' },
    { input: 'BatalkanTiket ABC123', expected: 'ABC123' },
    { input: 'batalkan tiket XYZ789', expected: 'XYZ789' },
    { input: 'Batalkan Tiket test456', expected: 'TEST456' },
    { input: 'batalkantiket', expected: '' },
    { input: 'batalkan tiket', expected: '' },
    { input: 'BATALKANtiket DEF111', expected: 'DEF111' }
];

console.log('Testing various input formats:\n');
let allPassed = true;

testCases.forEach((test, index) => {
    const result = extractTicketId(test.input);
    const passed = result === test.expected;
    
    console.log(`Test ${index + 1}: "${test.input}"`);
    console.log(`  Expected: "${test.expected}"`);
    console.log(`  Got: "${result}"`);
    console.log(`  Status: ${passed ? '✅ PASSED' : '❌ FAILED'}\n`);
    
    if (!passed) allPassed = false;
});

if (allPassed) {
    console.log('🎉 ALL TESTS PASSED!');
} else {
    console.log('❌ SOME TESTS FAILED - Please review the extraction logic');
}

console.log('\nEXPECTED BEHAVIOR:');
console.log('- Extract ticket ID regardless of case');
console.log('- Handle "batalkantiket" (no space) format');
console.log('- Handle "batalkan tiket" (with space) format');
console.log('- Return empty string if no ID provided');
console.log('- Convert ID to uppercase');
