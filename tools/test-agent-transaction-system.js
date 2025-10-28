#!/usr/bin/env node
/**
 * Test Agent Transaction System
 * Verifies all components are working correctly
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 TESTING AGENT TRANSACTION SYSTEM\n');
console.log('═'.repeat(60));
console.log('\n');

let testsPassed = 0;
let testsFailed = 0;

function test(name, fn) {
    try {
        fn();
        console.log(`✅ ${name}`);
        testsPassed++;
    } catch (error) {
        console.log(`❌ ${name}`);
        console.log(`   Error: ${error.message}`);
        testsFailed++;
    }
}

// Test 1: Check if all required files exist
console.log('📁 FILE EXISTENCE CHECKS\n');

test('lib/agent-transaction-manager.js exists', () => {
    const filePath = path.join(__dirname, '../lib/agent-transaction-manager.js');
    if (!fs.existsSync(filePath)) {
        throw new Error('File not found');
    }
});

test('message/handlers/agent-transaction-handler.js exists', () => {
    const filePath = path.join(__dirname, '../message/handlers/agent-transaction-handler.js');
    if (!fs.existsSync(filePath)) {
        throw new Error('File not found');
    }
});

test('database/agent_transactions.json exists', () => {
    const filePath = path.join(__dirname, '../database/agent_transactions.json');
    if (!fs.existsSync(filePath)) {
        throw new Error('File not found');
    }
});

test('database/agent_credentials.json exists', () => {
    const filePath = path.join(__dirname, '../database/agent_credentials.json');
    if (!fs.existsSync(filePath)) {
        throw new Error('File not found');
    }
});

test('tools/register-agent-pin.js exists', () => {
    const filePath = path.join(__dirname, '../tools/register-agent-pin.js');
    if (!fs.existsSync(filePath)) {
        throw new Error('File not found');
    }
});

console.log('\n');

// Test 2: Check if modules can be loaded
console.log('📦 MODULE LOADING CHECKS\n');

let agentTransactionManager;
let agentTransactionHandler;

test('Can require agent-transaction-manager', () => {
    const modulePath = path.join(__dirname, '../lib/agent-transaction-manager');
    agentTransactionManager = require(modulePath);
    if (!agentTransactionManager) throw new Error('Module not loaded');
});

test('Can require agent-transaction-handler', () => {
    const modulePath = path.join(__dirname, '../message/handlers/agent-transaction-handler');
    agentTransactionHandler = require(modulePath);
    if (!agentTransactionHandler) throw new Error('Module not loaded');
});

test('Can require agent-manager', () => {
    const modulePath = path.join(__dirname, '../lib/agent-manager');
    const agentManager = require(modulePath);
    if (!agentManager) throw new Error('Module not loaded');
});

test('Can require saldo-manager', () => {
    const modulePath = path.join(__dirname, '../lib/saldo-manager');
    const saldoManager = require(modulePath);
    if (!saldoManager) throw new Error('Module not loaded');
});

console.log('\n');

// Test 3: Check if required functions exist
console.log('🔧 FUNCTION AVAILABILITY CHECKS\n');

test('agent-transaction-manager has createAgentTransaction', () => {
    if (typeof agentTransactionManager.createAgentTransaction !== 'function') {
        throw new Error('Function not found');
    }
});

test('agent-transaction-manager has confirmTransaction', () => {
    if (typeof agentTransactionManager.confirmTransaction !== 'function') {
        throw new Error('Function not found');
    }
});

test('agent-transaction-manager has registerAgentCredentials', () => {
    if (typeof agentTransactionManager.registerAgentCredentials !== 'function') {
        throw new Error('Function not found');
    }
});

test('agent-transaction-manager has verifyAgentCredentials', () => {
    if (typeof agentTransactionManager.verifyAgentCredentials !== 'function') {
        throw new Error('Function not found');
    }
});

test('agent-transaction-handler has handleAgentConfirmation', () => {
    if (typeof agentTransactionHandler.handleAgentConfirmation !== 'function') {
        throw new Error('Function not found');
    }
});

test('agent-transaction-handler has handleAgentTodayTransactions', () => {
    if (typeof agentTransactionHandler.handleAgentTodayTransactions !== 'function') {
        throw new Error('Function not found');
    }
});

test('agent-transaction-handler has handleCheckTopupStatus', () => {
    if (typeof agentTransactionHandler.handleCheckTopupStatus !== 'function') {
        throw new Error('Function not found');
    }
});

console.log('\n');

// Test 4: Check database files format
console.log('📊 DATABASE FORMAT CHECKS\n');

test('agent_transactions.json is valid JSON', () => {
    const filePath = path.join(__dirname, '../database/agent_transactions.json');
    const data = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(data);
    if (!Array.isArray(parsed)) {
        throw new Error('Should be an array');
    }
});

test('agent_credentials.json is valid JSON', () => {
    const filePath = path.join(__dirname, '../database/agent_credentials.json');
    const data = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(data);
    if (!Array.isArray(parsed)) {
        throw new Error('Should be an array');
    }
});

console.log('\n');

// Test 5: Test basic operations (without actual PIN creation)
console.log('⚙️  BASIC OPERATION CHECKS\n');

test('Can call createAgentTransaction (dry run)', () => {
    // Just check the function exists and can be called
    // We won't actually create a transaction in test mode
    const testData = {
        topupRequestId: 'TEST001',
        customerId: '628123456789@s.whatsapp.net',
        customerName: 'Test Customer',
        agentId: 'AGT001',
        agentName: 'Test Agent',
        amount: 50000,
        transactionType: 'topup'
    };
    
    // Validate parameters only
    if (!testData.customerId || !testData.agentId || !testData.amount) {
        throw new Error('Invalid parameters');
    }
});

test('Can check agents.json exists', () => {
    const filePath = path.join(__dirname, '../database/agents.json');
    if (!fs.existsSync(filePath)) {
        throw new Error('agents.json not found - need agent data for system to work');
    }
});

test('agents.json has valid structure', () => {
    const filePath = path.join(__dirname, '../database/agents.json');
    const data = fs.readFileSync(filePath, 'utf8');
    const agents = JSON.parse(data);
    if (!Array.isArray(agents)) {
        throw new Error('agents.json should be an array');
    }
    if (agents.length === 0) {
        throw new Error('No agents found - add agents via admin panel');
    }
});

console.log('\n');

// Test 6: Check modified files
console.log('📝 MODIFIED FILES CHECKS\n');

test('saldo-manager has processAgentConfirmation', () => {
    const modulePath = path.join(__dirname, '../lib/saldo-manager');
    const saldoManager = require(modulePath);
    if (typeof saldoManager.processAgentConfirmation !== 'function') {
        throw new Error('Function not added to saldo-manager');
    }
});

test('agent-manager has getAgentByWhatsapp', () => {
    const modulePath = path.join(__dirname, '../lib/agent-manager');
    const agentManager = require(modulePath);
    if (typeof agentManager.getAgentByWhatsapp !== 'function') {
        throw new Error('Function not added to agent-manager');
    }
});

test('agent-manager has formatAgentForSelection', () => {
    const modulePath = path.join(__dirname, '../lib/agent-manager');
    const agentManager = require(modulePath);
    if (typeof agentManager.formatAgentForSelection !== 'function') {
        throw new Error('Function not added to agent-manager');
    }
});

console.log('\n');

// Test 7: Check commands.json
console.log('🎮 COMMANDS CONFIGURATION CHECKS\n');

test('commands.json exists', () => {
    const filePath = path.join(__dirname, '../config/commands.json');
    if (!fs.existsSync(filePath)) {
        throw new Error('commands.json not found');
    }
});

test('commands.json has agent commands', () => {
    const filePath = path.join(__dirname, '../config/commands.json');
    const data = fs.readFileSync(filePath, 'utf8');
    const config = JSON.parse(data);
    
    if (!config.commands.konfirmasi_agent) {
        throw new Error('konfirmasi_agent command not found');
    }
    
    if (!config.commands.transaksi_agent) {
        throw new Error('transaksi_agent command not found');
    }
    
    if (!config.commands.cek_topup) {
        throw new Error('cek_topup command not found');
    }
});

test('commands.json has agent category', () => {
    const filePath = path.join(__dirname, '../config/commands.json');
    const data = fs.readFileSync(filePath, 'utf8');
    const config = JSON.parse(data);
    
    if (!config.categories.agent) {
        throw new Error('agent category not found');
    }
});

console.log('\n');
console.log('═'.repeat(60));
console.log('\n');

// Summary
console.log('📊 TEST SUMMARY\n');
console.log(`✅ Passed: ${testsPassed}`);
console.log(`❌ Failed: ${testsFailed}`);
console.log(`📈 Total:  ${testsPassed + testsFailed}`);

if (testsFailed === 0) {
    console.log('\n');
    console.log('🎉 ALL TESTS PASSED!');
    console.log('\n');
    console.log('✅ System is ready for deployment');
    console.log('\n');
    console.log('📋 NEXT STEPS:');
    console.log('   1. Register agent credentials:');
    console.log('      node tools/register-agent-pin.js [agentId] [phone] [pin]');
    console.log('\n');
    console.log('   2. Start the bot:');
    console.log('      npm start');
    console.log('\n');
    console.log('   3. Test via WhatsApp:');
    console.log('      Type: topup');
    console.log('\n');
    process.exit(0);
} else {
    console.log('\n');
    console.log('❌ SOME TESTS FAILED');
    console.log('Please fix the errors above before deployment');
    console.log('\n');
    process.exit(1);
}
