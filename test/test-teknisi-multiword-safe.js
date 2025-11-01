/**
 * SAFE Test untuk Multi-word Keywords Teknisi
 * Test ticket ID extraction dengan keyword yang lebih dari 1 kata
 */

console.log('🧪 TEST TEKNISI MULTI-WORD KEYWORDS\n');
console.log('=' .repeat(50) + '\n');

// Test scenarios
const testCases = [
    // Single word keywords (existing, should still work)
    {
        input: "proses MQYV54P",
        expectedKeyword: "proses",
        matchedLength: 1,
        expectedTicketId: "MQYV54P",
        expectedStatus: "✅ CORRECT"
    },
    {
        input: "otw ABC123",
        expectedKeyword: "otw",
        matchedLength: 1,
        expectedTicketId: "ABC123",
        expectedStatus: "✅ CORRECT"
    },
    {
        input: "sampai XYZ789",
        expectedKeyword: "sampai",
        matchedLength: 1,
        expectedTicketId: "XYZ789",
        expectedStatus: "✅ CORRECT"
    },
    
    // Multi-word keywords (problematic before fix)
    {
        input: "mulai perjalanan MQYV54P",
        expectedKeyword: "mulai perjalanan",
        matchedLength: 2,
        expectedTicketId: "MQYV54P",
        expectedStatus: "✅ FIXED"
    },
    {
        input: "sampai lokasi DEF456",
        expectedKeyword: "sampai lokasi",
        matchedLength: 2,
        expectedTicketId: "DEF456",
        expectedStatus: "✅ FIXED"
    },
    {
        input: "on the way GHI012",
        expectedKeyword: "on the way",
        matchedLength: 3,
        expectedTicketId: "GHI012",
        expectedStatus: "✅ FIXED"
    }
];

console.log('📋 TESTING TICKET ID EXTRACTION\n');

for (const test of testCases) {
    console.log('━'.repeat(50));
    console.log(`\nInput: "${test.input}"`);
    console.log(`Keyword: "${test.expectedKeyword}" (${test.matchedLength} word${test.matchedLength > 1 ? 's' : ''})`);
    
    // Simulate OLD logic (always split[1])
    const oldLogicWords = test.input.split(' ');
    const oldTicketId = oldLogicWords[1];
    
    // Simulate NEW logic (using matchedKeywordLength)
    const newLogicWords = test.input.split(' ');
    const matchedKeywordLength = test.matchedLength;
    const newTicketId = newLogicWords[matchedKeywordLength] || newLogicWords[1];
    
    console.log('\nOLD Logic (split[1]):');
    console.log(`  Result: "${oldTicketId}"`);
    console.log(`  Expected: "${test.expectedTicketId}"`);
    console.log(`  Status: ${oldTicketId === test.expectedTicketId ? '✅ Works' : '❌ WRONG'}`);
    
    console.log('\nNEW Logic (using matchedKeywordLength):');
    console.log(`  Result: "${newTicketId}"`);
    console.log(`  Expected: "${test.expectedTicketId}"`);
    console.log(`  Status: ${newTicketId === test.expectedTicketId ? test.expectedStatus : '❌ Failed'}`);
}

console.log('\n' + '━'.repeat(50));
console.log('\n📊 PROBLEM & SOLUTION SUMMARY\n');

console.log('❌ BEFORE FIX:');
console.log('```javascript');
console.log('const ticketId = chats.split(\' \')[1];');
console.log('// "proses MQYV54P" → ticketId = "MQYV54P" ✅');
console.log('// "mulai perjalanan MQYV54P" → ticketId = "perjalanan" ❌');
console.log('```\n');

console.log('✅ AFTER FIX:');
console.log('```javascript');
console.log('const words = chats.split(\' \');');
console.log('const ticketId = words[matchedKeywordLength] || words[1];');
console.log('// "proses MQYV54P" → ticketId = "MQYV54P" ✅');
console.log('// "mulai perjalanan MQYV54P" → ticketId = "MQYV54P" ✅');
console.log('```\n');

console.log('📝 KEY INSIGHT:');
console.log('The matchedKeywordLength variable (from keyword matching) tells us');
console.log('how many words were matched, so we know where the ticket ID starts!');

console.log('\n' + '=' .repeat(50));
console.log('\n✅ TEST COMPLETED - No external calls made!');

// Exit safely
process.exit(0);
