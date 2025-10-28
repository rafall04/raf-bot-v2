#!/usr/bin/env node
/**
 * Test Command Routing for "transaksi"
 * Simulate exact flow to find where it breaks
 */

const agentManager = require('../lib/agent-manager');
const agentTransactionManager = require('../lib/agent-transaction-manager');

console.log('🧪 TESTING COMMAND ROUTING - "transaksi"\n');
console.log('═'.repeat(70));
console.log('\n');

// Simulate WhatsApp message
const testSender = '6285233047094@s.whatsapp.net';  // AGT001
const testCommand = 'transaksi';

console.log('📱 SIMULATING WHATSAPP MESSAGE:\n');
console.log(`Sender: ${testSender}`);
console.log(`Command: ${testCommand}\n`);
console.log('─'.repeat(70));
console.log('\n');

// Step 1: Command parsing
console.log('1️⃣ COMMAND PARSING:\n');
const chats = testCommand.toLowerCase();
const args = chats.split(' ');
const intent = args[0];

console.log(`   chats: "${chats}"`);
console.log(`   args: [${args.join(', ')}]`);
console.log(`   intent: "${intent}"\n`);

// Step 2: Check switch case match
console.log('2️⃣ SWITCH CASE CHECK:\n');
const validCases = [
    'transaksi hari ini',
    'transaksi hariini',
    'today transactions',
    'transaksi',
    'my transactions'
];

const matchesCase = validCases.includes(intent);
console.log(`   Valid cases: ${validCases.join(', ')}`);
console.log(`   Intent matches: ${matchesCase ? '✅ YES' : '❌ NO'}`);

if (!matchesCase) {
    console.log('   ⚠️  Command will NOT be handled!\n');
} else {
    console.log('   ✅ Command will be handled\n');
}

console.log('─'.repeat(70));
console.log('\n');

// Step 3: Agent lookup
console.log('3️⃣ AGENT LOOKUP:\n');

try {
    const agent = agentManager.getAgentByWhatsapp(testSender);
    
    console.log(`   Sender: ${testSender}`);
    
    if (agent) {
        console.log(`   ✅ Agent found:`);
        console.log(`      ID: ${agent.id}`);
        console.log(`      Name: ${agent.name}`);
        console.log(`      Active: ${agent.active}`);
        console.log(`      Registered: ${agent.isRegistered}\n`);
        
        // Step 4: Get transactions
        console.log('4️⃣ TRANSACTION LOOKUP:\n');
        const transactions = agentTransactionManager.getTodayTransactions(agent.id);
        console.log(`   Today's transactions: ${transactions.length}`);
        
        if (transactions.length === 0) {
            console.log(`   ✅ Will show: "Belum ada transaksi hari ini"\n`);
        } else {
            console.log(`   ✅ Will show: List of ${transactions.length} transactions\n`);
        }
        
        // Expected response
        console.log('5️⃣ EXPECTED RESPONSE:\n');
        const expectedMsg = `📊 *TRANSAKSI HARI INI*\n\nAgent: ${agent.name}\n\nBelum ada transaksi hari ini.`;
        console.log(expectedMsg);
        console.log('\n');
        
    } else {
        console.log(`   ❌ Agent NOT found`);
        console.log(`   Will show: "Nomor Anda tidak terdaftar sebagai agent"\n`);
        
        // Debug why not found
        console.log('   🔍 DEBUG:\n');
        
        // Check credentials
        const cred = agentTransactionManager.getAgentByWhatsapp(testSender);
        console.log(`   Credentials lookup: ${cred ? '✅ Found' : '❌ Not found'}`);
        
        if (cred) {
            console.log(`      Agent ID: ${cred.agentId}`);
            console.log(`      WhatsApp: ${cred.whatsappNumber}`);
            console.log(`      Active: ${cred.active}\n`);
            
            // Check agent exists
            const agentById = agentManager.getAgentById(cred.agentId);
            console.log(`   Agent by ID lookup: ${agentById ? '✅ Found' : '❌ Not found'}`);
            
            if (agentById) {
                console.log(`      ID: ${agentById.id}`);
                console.log(`      Name: ${agentById.name}`);
                console.log(`      Phone: ${agentById.phone}`);
                console.log(`      Active: ${agentById.active}\n`);
            }
        }
    }
    
} catch (error) {
    console.log(`   ❌ ERROR: ${error.message}`);
    console.log(`   Stack: ${error.stack}\n`);
}

console.log('═'.repeat(70));
console.log('\n');

// Summary
console.log('📊 TEST SUMMARY:\n');
console.log('Expected flow:');
console.log('1. User sends "transaksi"');
console.log('2. Bot receives message');
console.log('3. Intent recognized as "transaksi"');
console.log('4. Switch case matches');
console.log('5. handleAgentTodayTransactions() called');
console.log('6. Agent lookup succeeds');
console.log('7. Transactions retrieved');
console.log('8. Response sent\n');

console.log('If no response:');
console.log('• Check bot is running: npm start');
console.log('• Check logs: tail -f logs/app-*.log | grep -i transaksi');
console.log('• Look for "Transaksi command received"');
console.log('• Look for "Agent lookup result"');
console.log('• Check for any errors in logs\n');

console.log('✅ Test script complete!');
