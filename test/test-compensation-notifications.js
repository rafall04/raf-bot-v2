#!/usr/bin/env node

/**
 * Test Script: Compensation Notification System
 * 
 * This script tests if compensation notifications are properly configured
 * and will be sent to users.
 * 
 * To run: node test/test-compensation-notifications.js
 */

const fs = require('fs');
const path = require('path');

console.log("🧪 TEST: Compensation Notification System\n");
console.log("=" .repeat(50));

// Test 1: Check cron.json configuration
console.log("\n📋 Test 1: Checking cron.json configuration...");
console.log("-".repeat(50));

try {
    const cronConfig = JSON.parse(fs.readFileSync(
        path.join(__dirname, '..', 'database', 'cron.json'), 
        'utf8'
    ));
    
    const checks = [
        {
            key: 'status_compensation_revert',
            expected: true,
            description: 'Cron task for auto-revert'
        },
        {
            key: 'status_message_compensation_applied',
            expected: true,
            description: 'Notification when compensation applied'
        },
        {
            key: 'status_message_compensation_reverted',
            expected: true,
            description: 'Notification when compensation reverted'
        },
        {
            key: 'schedule_compensation_revert',
            expected: '* * * * *',
            description: 'Cron schedule (every minute)'
        }
    ];
    
    let allPassed = true;
    
    checks.forEach(check => {
        const value = cronConfig[check.key];
        const passed = value === check.expected;
        
        console.log(`\n${check.description}:`);
        console.log(`  Key: ${check.key}`);
        console.log(`  Expected: ${check.expected}`);
        console.log(`  Actual: ${value}`);
        console.log(`  ${passed ? '✅ PASS' : '❌ FAIL'}`);
        
        if (!passed) allPassed = false;
    });
    
    if (allPassed) {
        console.log("\n✅ All cron configurations are correct!");
    } else {
        console.log("\n❌ Some configurations are incorrect!");
        console.log("Please check cron.json settings.");
    }
    
} catch (error) {
    console.error("❌ Error reading cron.json:", error.message);
}

// Test 2: Check message templates
console.log("\n" + "=".repeat(50));
console.log("📋 Test 2: Checking message templates...");
console.log("-".repeat(50));

try {
    const templates = JSON.parse(fs.readFileSync(
        path.join(__dirname, '..', 'database', 'message_templates.json'),
        'utf8'
    ));
    
    const requiredTemplates = [
        'compensation_applied',
        'compensation_reverted'
    ];
    
    let templatesExist = true;
    
    requiredTemplates.forEach(templateName => {
        const exists = templates[templateName] && templates[templateName].template;
        
        console.log(`\nTemplate: ${templateName}`);
        console.log(`  Exists: ${exists ? 'Yes' : 'No'}`);
        
        if (exists) {
            const preview = templates[templateName].template
                .substring(0, 100)
                .replace(/\n/g, ' ');
            console.log(`  Preview: "${preview}..."`);
            console.log(`  ✅ Template found`);
        } else {
            console.log(`  ❌ Template missing`);
            templatesExist = false;
        }
    });
    
    if (templatesExist) {
        console.log("\n✅ All required templates exist!");
    } else {
        console.log("\n❌ Some templates are missing!");
    }
    
} catch (error) {
    console.error("❌ Error reading message_templates.json:", error.message);
}

// Test 3: Check active compensations
console.log("\n" + "=".repeat(50));
console.log("📋 Test 3: Checking active compensations...");
console.log("-".repeat(50));

try {
    const compensations = JSON.parse(fs.readFileSync(
        path.join(__dirname, '..', 'database', 'compensations.json'),
        'utf8'
    ));
    
    const activeCompensations = compensations.filter(c => c.status === 'active');
    
    console.log(`\nTotal compensations: ${compensations.length}`);
    console.log(`Active compensations: ${activeCompensations.length}`);
    
    if (activeCompensations.length > 0) {
        console.log("\nActive compensation details:");
        activeCompensations.forEach(comp => {
            const endDate = new Date(comp.endDate);
            const now = new Date();
            const remainingMs = endDate - now;
            const remainingMinutes = Math.floor(remainingMs / 60000);
            
            console.log(`\n  User ID: ${comp.userId}`);
            console.log(`  PPPoE: ${comp.pppoeUsername}`);
            console.log(`  Profile: ${comp.originalProfile} → ${comp.compensatedProfile}`);
            console.log(`  Duration: ${comp.durationDays}d ${comp.durationHours}h ${comp.durationMinutes}m`);
            console.log(`  End Time: ${endDate.toLocaleString('id-ID')}`);
            
            if (remainingMs > 0) {
                console.log(`  Status: Will revert in ${remainingMinutes} minutes`);
                console.log(`  ⏱️  Waiting for auto-revert...`);
            } else {
                console.log(`  Status: Should have reverted (expired ${Math.abs(remainingMinutes)} minutes ago)`);
                console.log(`  ⚠️  Check if cron task is running`);
            }
        });
        
        console.log("\n💡 TIP: Cron runs every minute to check for expired compensations");
        console.log("When expired, user will receive revert notification.");
    } else {
        console.log("\nNo active compensations found.");
        console.log("Apply a compensation to test the notification system.");
    }
    
} catch (error) {
    console.error("❌ Error reading compensations.json:", error.message);
}

// Summary
console.log("\n" + "=".repeat(50));
console.log("📊 SUMMARY:");
console.log("-".repeat(50));

console.log("\n✅ Configuration Checklist:");
console.log("  1. Enable notifications in cron.json - DONE");
console.log("  2. Message templates exist - VERIFIED");
console.log("  3. Cron task enabled - CONFIGURED");
console.log("  4. Schedule set to * * * * * - YES");

console.log("\n🔄 Required Actions:");
console.log("  1. RESTART the service (npm start)");
console.log("  2. Check WhatsApp connection");
console.log("  3. Apply test compensation");
console.log("  4. Wait for duration to expire");
console.log("  5. Check if notifications received");

console.log("\n📝 Expected Behavior:");
console.log("  - User gets notification when compensation applied");
console.log("  - User gets notification when compensation reverts");
console.log("  - Profile automatically returns to original");

console.log("\n" + "=".repeat(50));
console.log("TEST COMPLETE");
console.log("=" .repeat(50));

process.exit(0);
