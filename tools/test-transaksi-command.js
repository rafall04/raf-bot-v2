#!/usr/bin/env node
/**
 * Test script untuk command "transaksi"
 * Test dengan nomor yang terdaftar sebagai agent dan customer
 */

const agentManager = require('../lib/agent-manager');
const agentTransactionManager = require('../lib/agent-transaction-manager');

console.log('🧪 TESTING "TRANSAKSI" COMMAND\n');
console.log('═'.repeat(70));
console.log('\n');

// Test cases
const testCases = [
    {
        name: 'Agent registered (AGT001)',
        whatsapp: '6285233047094@s.whatsapp.net',
        shouldWork: true
    },
    {
        name: 'Agent registered (AGT002)',
        whatsapp: '6285234567890@s.whatsapp.net',
        shouldWork: true
    },
    {
        name: 'Not an agent',
        whatsapp: '628123456789@s.whatsapp.net',
        shouldWork: false
    }
];

console.log('📋 TEST SCENARIOS:\n');

testCases.forEach((testCase, index) => {
    console.log(`${index + 1}. ${testCase.name}`);
    console.log(`   WhatsApp: ${testCase.whatsapp}`);
    
    // Test 1: Check if agent exists
    const agent = agentManager.getAgentByWhatsapp(testCase.whatsapp);
    
    if (testCase.shouldWork) {
        if (agent) {
            console.log(`   ✅ Agent found: ${agent.name} (${agent.id})`);
            
            // Test 2: Check transactions
            const transactions = agentTransactionManager.getTodayTransactions(agent.id);
            console.log(`   📊 Today's transactions: ${transactions.length}`);
            
            // Test 3: Check credentials
            const cred = agentTransactionManager.getAgentByWhatsapp(testCase.whatsapp);
            if (cred) {
                console.log(`   🔐 Credentials: ✅ Registered`);
                console.log(`   ✅ Command should work!`);
            } else {
                console.log(`   ❌ Credentials: Not found`);
                console.log(`   ⚠️  Agent exists but no credentials!`);
            }
        } else {
            console.log(`   ❌ Agent not found`);
            console.log(`   ⚠️  Expected to work but agent not found!`);
        }
    } else {
        if (!agent) {
            console.log(`   ✅ Correctly identified as not an agent`);
            console.log(`   ✅ Should show error message`);
        } else {
            console.log(`   ⚠️  Unexpected: Found as agent`);
        }
    }
    
    console.log('');
});

console.log('═'.repeat(70));
console.log('\n');

console.log('🔍 DEBUGGING INFO:\n');

// Check agent_credentials.json
const credentialsPath = require('path').join(__dirname, '../database/agent_credentials.json');
const credentials = JSON.parse(require('fs').readFileSync(credentialsPath, 'utf8'));

console.log(`Total registered credentials: ${credentials.length}`);
credentials.forEach(cred => {
    console.log(`  • ${cred.agentId}: ${cred.whatsappNumber} (Active: ${cred.active})`);
});

console.log('\n');

// Check agents.json
const agentsPath = require('path').join(__dirname, '../database/agents.json');
const agents = JSON.parse(require('fs').readFileSync(agentsPath, 'utf8'));

console.log(`Total agents in database: ${agents.length}`);
const activeAgents = agents.filter(a => a.active);
console.log(`Active agents: ${activeAgents.length}`);

activeAgents.forEach(agent => {
    const hasCred = credentials.find(c => c.agentId === agent.id);
    console.log(`  • ${agent.id} (${agent.name}): ${hasCred ? '✅' : '❌'} Credentials`);
});

console.log('\n');
console.log('═'.repeat(70));
console.log('\n');

console.log('💡 CARA TEST VIA WHATSAPP:\n');
console.log('1. Pastikan bot running: npm start');
console.log('2. Dari nomor agent yang registered, ketik: transaksi');
console.log('3. Expected response:');
console.log('   - Jika agent registered: Menampilkan list transaksi');
console.log('   - Jika bukan agent: Menampilkan error message yang informatif');
console.log('\n');

console.log('📝 JIKA TIDAK ADA RESPONSE:\n');
console.log('1. Check logs: tail -f logs/app-*.log');
console.log('2. Look for: "Transaksi command received"');
console.log('3. Look for: "Agent lookup result"');
console.log('4. Check for any errors in catch block');
console.log('\n');

console.log('✅ Test script complete!');
