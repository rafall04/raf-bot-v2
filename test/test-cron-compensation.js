#!/usr/bin/env node

/**
 * Test Script: Compensation Cron Task Debug
 * 
 * This script tests why the compensation cron task is not running every minute
 * 
 * To run: node test/test-cron-compensation.js
 */

const fs = require('fs');
const path = require('path');
const cronValidator = require('cron-validator');

console.log("🔍 DEBUG: Compensation Cron Task\n");
console.log("=" .repeat(50));

// Test 1: Check cron.json values
console.log("\n📋 Test 1: Checking cron.json values...");
console.log("-".repeat(50));

try {
    const cronConfig = JSON.parse(fs.readFileSync(
        path.join(__dirname, '..', 'database', 'cron.json'), 
        'utf8'
    ));
    
    console.log("\nCompensation settings:");
    console.log(`  schedule_compensation_revert: "${cronConfig.schedule_compensation_revert}"`);
    console.log(`  status_compensation_revert: ${cronConfig.status_compensation_revert}`);
    console.log(`  status_message_compensation_applied: ${cronConfig.status_message_compensation_applied}`);
    console.log(`  status_message_compensation_reverted: ${cronConfig.status_message_compensation_reverted}`);
    
} catch (error) {
    console.error("❌ Error reading cron.json:", error.message);
}

// Test 2: Test isValidCron function
console.log("\n" + "=".repeat(50));
console.log("📋 Test 2: Testing isValidCron function...");
console.log("-".repeat(50));

function isValidCron(cronExpression) {
    // If starts with #, it's commented out (disabled) - consider it valid format but disabled
    if (cronExpression && cronExpression.trim().startsWith('#')) {
        return false; // Valid format but disabled
    }
    return cronValidator.isValidCron(cronExpression, { alias: true, allowBlankDay: true });
}

const testExpressions = [
    "* * * * *",
    "# * * * * *",
    "*/5 * * * *",
    ""
];

testExpressions.forEach(expr => {
    const result = isValidCron(expr);
    console.log(`\n  Expression: "${expr}"`);
    console.log(`  isValidCron: ${result}`);
    console.log(`  ${result ? '✅ Will run' : '❌ Won\'t run'}`);
});

// Test 3: Check initCompensationRevertTask logic
console.log("\n" + "=".repeat(50));
console.log("📋 Test 3: Testing task initialization logic...");
console.log("-".repeat(50));

const cronConfig = JSON.parse(fs.readFileSync(
    path.join(__dirname, '..', 'database', 'cron.json'), 
    'utf8'
));

const willTaskRun = cronConfig.status_compensation_revert === true && 
                    isValidCron(cronConfig.schedule_compensation_revert);

console.log(`\nCondition check:`);
console.log(`  status_compensation_revert === true: ${cronConfig.status_compensation_revert === true}`);
console.log(`  isValidCron(schedule): ${isValidCron(cronConfig.schedule_compensation_revert)}`);
console.log(`  Combined (will task run): ${willTaskRun}`);

if (willTaskRun) {
    console.log("\n✅ Task SHOULD be running every minute!");
    console.log("\nExpected console output after restart:");
    console.log('  [CRON_COMPENSATION] Starting/Restarting compensation revert task with schedule: * * * * *');
    console.log('  [CRON_COMPENSATION] Compensation revert task triggered at: [timestamp]');
    console.log('  [CRON_COMPENSATION] Checking X compensations for expiry...');
} else {
    console.log("\n❌ Task will NOT run! Check the conditions above.");
}

// Test 4: Check compensations data
console.log("\n" + "=".repeat(50));
console.log("📋 Test 4: Checking compensations data...");
console.log("-".repeat(50));

try {
    const compensations = JSON.parse(fs.readFileSync(
        path.join(__dirname, '..', 'database', 'compensations.json'),
        'utf8'
    ));
    
    const now = new Date();
    console.log(`\nCurrent time: ${now.toISOString()}`);
    console.log(`Total compensations: ${compensations.length}`);
    
    compensations.forEach(comp => {
        const endDate = new Date(comp.endDate);
        const expired = endDate <= now;
        const timeRemaining = endDate - now;
        const minutesRemaining = Math.floor(timeRemaining / 60000);
        
        console.log(`\nCompensation ${comp.id}:`);
        console.log(`  Status: ${comp.status}`);
        console.log(`  End date: ${comp.endDate}`);
        console.log(`  Expired: ${expired ? 'YES ⚠️' : 'NO'}`);
        
        if (!expired && comp.status === 'active') {
            console.log(`  Time remaining: ${minutesRemaining} minutes`);
        } else if (expired && comp.status === 'active') {
            console.log(`  ⚠️ SHOULD HAVE BEEN REVERTED ${Math.abs(minutesRemaining)} minutes ago!`);
        }
    });
    
} catch (error) {
    console.error("❌ Error reading compensations.json:", error.message);
}

// Test 5: Check if service needs restart
console.log("\n" + "=".repeat(50));
console.log("📋 Test 5: Service restart check...");
console.log("-".repeat(50));

console.log("\n⚠️ IMPORTANT: After changing cron.json, you MUST restart the service!");
console.log("\nTo check if cron is running:");
console.log("1. Look for this in console after restart:");
console.log("   [CRON_COMPENSATION] Starting/Restarting compensation revert task with schedule: * * * * *");
console.log("\n2. Then every minute you should see:");
console.log("   [CRON_COMPENSATION] Compensation revert task triggered at: [timestamp]");
console.log("   [CRON_COMPENSATION] Checking X compensations for expiry...");
console.log("\n3. If you DON'T see these messages:");
console.log("   - Service was not restarted");
console.log("   - Or there's an issue with the cron task");

// Summary
console.log("\n" + "=".repeat(50));
console.log("📊 SUMMARY:");
console.log("-".repeat(50));

if (willTaskRun) {
    console.log("\n✅ Configuration is CORRECT!");
    console.log("🔄 ACTION REQUIRED: RESTART the service (npm start)");
    console.log("👀 THEN WATCH: Console for cron messages every minute");
} else {
    console.log("\n❌ Configuration has ISSUES!");
    console.log("Fix the problems shown above, then restart.");
}

console.log("\n" + "=".repeat(50));
console.log("DEBUG COMPLETE");
console.log("=" .repeat(50));

process.exit(0);
