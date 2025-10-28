#!/usr/bin/env node
/**
 * Comprehensive Test for Agent Self-Service Features
 * Tests all agent commands systematically
 */

const fs = require('fs');
const path = require('path');
const agentTransactionManager = require('../lib/agent-transaction-manager');
const agentManager = require('../lib/agent-manager');

console.log('🧪 TESTING AGENT SELF-SERVICE FEATURES\n');
console.log('═'.repeat(70));
console.log('\n');

let testsPassed = 0;
let testsFailed = 0;
let testsSkipped = 0;

function test(name, fn, skip = false) {
    if (skip) {
        console.log(`⏭️  ${name} (SKIPPED)`);
        testsSkipped++;
        return;
    }
    
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

async function asyncTest(name, fn, skip = false) {
    if (skip) {
        console.log(`⏭️  ${name} (SKIPPED)`);
        testsSkipped++;
        return;
    }
    
    try {
        await fn();
        console.log(`✅ ${name}`);
        testsPassed++;
    } catch (error) {
        console.log(`❌ ${name}`);
        console.log(`   Error: ${error.message}`);
        testsFailed++;
    }
}

// Test data
const testAgentId = 'AGT001';
const testWhatsApp = '6285233047094@s.whatsapp.net';
const oldPin = '1234';
const newPin = '5678';
const testAddress = 'Jl. Test No. 123, RT 01/02, Tanjung';
const testHours = '08:00 - 22:00';
const testPhone = '085298765432';

console.log('📋 TEST CONFIGURATION\n');
console.log(`Agent ID: ${testAgentId}`);
console.log(`WhatsApp: ${testWhatsApp}`);
console.log(`Old PIN: ${oldPin}`);
console.log(`New PIN: ${newPin}\n`);
console.log('═'.repeat(70));
console.log('\n');

async function runTests() {
    // Test 1: Prerequisites
    console.log('1️⃣  PREREQUISITE CHECKS\n');
    
    test('Agent exists in database', () => {
        const agent = agentManager.getAgentById(testAgentId);
        if (!agent) throw new Error('Agent not found');
    });
    
    test('Agent has credentials', () => {
        const cred = agentTransactionManager.getAgentByWhatsapp(testWhatsApp);
        if (!cred) throw new Error('Agent credentials not found');
    });
    
    test('Agent is active', () => {
        const agent = agentManager.getAgentById(testAgentId);
        if (!agent.active) throw new Error('Agent is not active');
    });
    
    console.log('\n');
    
    // Test 2: Agent Info/Profile View
    console.log('2️⃣  AGENT INFO/PROFILE VIEW\n');
    
    test('Can get agent by WhatsApp', () => {
        const cred = agentTransactionManager.getAgentByWhatsapp(testWhatsApp);
        if (!cred) throw new Error('Cannot get agent credentials');
        if (cred.agentId !== testAgentId) throw new Error('Wrong agent returned');
    });
    
    test('Can get agent by ID', () => {
        const agent = agentManager.getAgentById(testAgentId);
        if (!agent) throw new Error('Cannot get agent data');
        if (agent.id !== testAgentId) throw new Error('Wrong agent returned');
    });
    
    test('Agent has required fields', () => {
        const agent = agentManager.getAgentById(testAgentId);
        if (!agent.name) throw new Error('Missing name');
        if (!agent.address) throw new Error('Missing address');
        if (!agent.phone) throw new Error('Missing phone');
        if (!agent.area) throw new Error('Missing area');
        if (!agent.services) throw new Error('Missing services');
        if (!agent.operational_hours) throw new Error('Missing operational_hours');
    });
    
    test('Can get agent statistics', () => {
        const stats = agentTransactionManager.getAgentStatistics(testAgentId, 'month');
        if (typeof stats.total !== 'number') throw new Error('Invalid stats.total');
        if (typeof stats.completed !== 'number') throw new Error('Invalid stats.completed');
        if (typeof stats.pending !== 'number') throw new Error('Invalid stats.pending');
        if (typeof stats.totalAmount !== 'number') throw new Error('Invalid stats.totalAmount');
    });
    
    console.log('\n');
    
    // Test 3: PIN Verification (before change)
    console.log('3️⃣  PIN VERIFICATION (Before Change)\n');
    
    await asyncTest('Can verify correct PIN', async () => {
        const result = await agentTransactionManager.verifyAgentCredentials(
            testAgentId,
            testWhatsApp,
            oldPin
        );
        if (!result.success) throw new Error('PIN verification failed');
    });
    
    await asyncTest('Cannot verify wrong PIN', async () => {
        const result = await agentTransactionManager.verifyAgentCredentials(
            testAgentId,
            testWhatsApp,
            'wrong_pin'
        );
        if (result.success) throw new Error('Wrong PIN was accepted');
    });
    
    console.log('\n');
    
    // Test 4: Update Agent Profile
    console.log('4️⃣  UPDATE AGENT PROFILE\n');
    
    // Store original values
    const originalAgent = agentManager.getAgentById(testAgentId);
    const originalAddress = originalAgent.address;
    const originalHours = originalAgent.operational_hours;
    const originalPhone = originalAgent.phone;
    
    test('Can update agent address', () => {
        const result = agentManager.updateAgent(testAgentId, {
            address: testAddress
        });
        if (!result.success) throw new Error('Update failed');
        
        const updated = agentManager.getAgentById(testAgentId);
        if (updated.address !== testAddress) throw new Error('Address not updated');
    });
    
    test('Can update agent operational hours', () => {
        const result = agentManager.updateAgent(testAgentId, {
            operational_hours: testHours
        });
        if (!result.success) throw new Error('Update failed');
        
        const updated = agentManager.getAgentById(testAgentId);
        if (updated.operational_hours !== testHours) throw new Error('Hours not updated');
    });
    
    test('Can update agent phone', () => {
        const result = agentManager.updateAgent(testAgentId, {
            phone: testPhone
        });
        if (!result.success) throw new Error('Update failed');
        
        const updated = agentManager.getAgentById(testAgentId);
        if (updated.phone !== testPhone) throw new Error('Phone not updated');
    });
    
    // Restore original values
    test('Can restore original values', () => {
        const result = agentManager.updateAgent(testAgentId, {
            address: originalAddress,
            operational_hours: originalHours,
            phone: originalPhone
        });
        if (!result.success) throw new Error('Restore failed');
    });
    
    console.log('\n');
    
    // Test 5: Status Toggle
    console.log('5️⃣  STATUS TOGGLE (Active/Inactive)\n');
    
    const originalStatus = agentManager.getAgentById(testAgentId).active;
    
    test('Can deactivate agent', () => {
        const result = agentManager.updateAgent(testAgentId, {
            active: false
        });
        if (!result.success) throw new Error('Deactivate failed');
        
        const updated = agentManager.getAgentById(testAgentId);
        if (updated.active !== false) throw new Error('Agent still active');
    });
    
    test('Can activate agent', () => {
        const result = agentManager.updateAgent(testAgentId, {
            active: true
        });
        if (!result.success) throw new Error('Activate failed');
        
        const updated = agentManager.getAgentById(testAgentId);
        if (updated.active !== true) throw new Error('Agent still inactive');
    });
    
    test('Can restore original status', () => {
        const result = agentManager.updateAgent(testAgentId, {
            active: originalStatus
        });
        if (!result.success) throw new Error('Restore failed');
    });
    
    console.log('\n');
    
    // Test 6: PIN Change
    console.log('6️⃣  PIN CHANGE\n');
    
    await asyncTest('Cannot change PIN with wrong old PIN', async () => {
        const result = await agentTransactionManager.updateAgentPin(
            testAgentId,
            testWhatsApp,
            'wrong_old_pin',
            newPin
        );
        if (result.success) throw new Error('PIN change accepted with wrong old PIN');
    });
    
    await asyncTest('Can change PIN with correct old PIN', async () => {
        const result = await agentTransactionManager.updateAgentPin(
            testAgentId,
            testWhatsApp,
            oldPin,
            newPin
        );
        if (!result.success) throw new Error(`PIN change failed: ${result.message}`);
    });
    
    await asyncTest('Can verify with new PIN', async () => {
        const result = await agentTransactionManager.verifyAgentCredentials(
            testAgentId,
            testWhatsApp,
            newPin
        );
        if (!result.success) throw new Error('New PIN verification failed');
    });
    
    await asyncTest('Cannot verify with old PIN anymore', async () => {
        const result = await agentTransactionManager.verifyAgentCredentials(
            testAgentId,
            testWhatsApp,
            oldPin
        );
        if (result.success) throw new Error('Old PIN still works');
    });
    
    await asyncTest('Can change PIN back to original', async () => {
        const result = await agentTransactionManager.updateAgentPin(
            testAgentId,
            testWhatsApp,
            newPin,
            oldPin
        );
        if (!result.success) throw new Error('PIN restore failed');
    });
    
    await asyncTest('Can verify with original PIN', async () => {
        const result = await agentTransactionManager.verifyAgentCredentials(
            testAgentId,
            testWhatsApp,
            oldPin
        );
        if (!result.success) throw new Error('Original PIN verification failed');
    });
    
    console.log('\n');
    
    // Test 7: Error Handling
    console.log('7️⃣  ERROR HANDLING\n');
    
    test('Update fails with invalid agent ID', () => {
        const result = agentManager.updateAgent('INVALID_ID', {
            address: 'Test'
        });
        if (result.success) throw new Error('Update accepted invalid agent ID');
    });
    
    await asyncTest('PIN change fails for non-existent agent', async () => {
        const result = await agentTransactionManager.updateAgentPin(
            'INVALID_ID',
            testWhatsApp,
            oldPin,
            newPin
        );
        if (result.success) throw new Error('PIN change accepted invalid agent');
    });
    
    await asyncTest('PIN verification fails for wrong WhatsApp', async () => {
        const result = await agentTransactionManager.verifyAgentCredentials(
            testAgentId,
            'wrong@s.whatsapp.net',
            oldPin
        );
        if (result.success) throw new Error('Verification accepted wrong WhatsApp');
    });
    
    test('Cannot get non-existent agent', () => {
        const agent = agentManager.getAgentById('INVALID_ID');
        if (agent) throw new Error('Got non-existent agent');
    });
    
    console.log('\n');
    
    // Test 8: Data Persistence
    console.log('8️⃣  DATA PERSISTENCE\n');
    
    test('Agents database file exists', () => {
        const filePath = path.join(__dirname, '../database/agents.json');
        if (!fs.existsSync(filePath)) throw new Error('agents.json not found');
    });
    
    test('Agent credentials database file exists', () => {
        const filePath = path.join(__dirname, '../database/agent_credentials.json');
        if (!fs.existsSync(filePath)) throw new Error('agent_credentials.json not found');
    });
    
    test('Can read agents database', () => {
        const filePath = path.join(__dirname, '../database/agents.json');
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        if (!Array.isArray(data)) throw new Error('Invalid agents database format');
    });
    
    test('Can read credentials database', () => {
        const filePath = path.join(__dirname, '../database/agent_credentials.json');
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        if (!Array.isArray(data)) throw new Error('Invalid credentials database format');
    });
    
    test('Test agent exists in agents database', () => {
        const filePath = path.join(__dirname, '../database/agents.json');
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        const agent = data.find(a => a.id === testAgentId);
        if (!agent) throw new Error('Test agent not found in database');
    });
    
    test('Test agent credentials exist in database', () => {
        const filePath = path.join(__dirname, '../database/agent_credentials.json');
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        const cred = data.find(c => c.agentId === testAgentId);
        if (!cred) throw new Error('Test agent credentials not found in database');
    });
    
    console.log('\n');
    
    // Summary
    console.log('═'.repeat(70));
    console.log('\n');
    
    console.log('📊 TEST SUMMARY\n');
    console.log(`✅ Passed:  ${testsPassed}`);
    console.log(`❌ Failed:  ${testsFailed}`);
    console.log(`⏭️  Skipped: ${testsSkipped}`);
    console.log(`📈 Total:   ${testsPassed + testsFailed + testsSkipped}`);
    console.log(`📊 Success Rate: ${((testsPassed / (testsPassed + testsFailed)) * 100).toFixed(1)}%`);
    console.log('\n');
    
    if (testsFailed === 0) {
        console.log('🎉 ALL TESTS PASSED!\n');
        console.log('✅ Agent self-service features are working correctly\n');
        console.log('📋 NEXT STEPS:\n');
        console.log('1. Test via WhatsApp with real agent number');
        console.log('2. Commands to test:');
        console.log('   • profil agent');
        console.log('   • ganti pin 1234 5678');
        console.log('   • update alamat Jl. Test No. 123');
        console.log('   • update jam 08:00-22:00');
        console.log('   • tutup sementara');
        console.log('   • buka kembali\n');
        console.log('3. Verify changes in database');
        console.log('4. Train agents on commands\n');
        process.exit(0);
    } else {
        console.log('❌ SOME TESTS FAILED\n');
        console.log('Please fix the errors above before deployment\n');
        process.exit(1);
    }
}

// Run tests
runTests().catch(error => {
    console.error('\n❌ Fatal error:', error.message);
    console.error(error.stack);
    process.exit(1);
});
