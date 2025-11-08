#!/usr/bin/env node

/**
 * Test Script: Verify Redaman Schedule Fixes
 */

const fs = require('fs');
const path = require('path');

console.log("🧪 VERIFYING REDAMAN SCHEDULE FIXES\n");
console.log("=".repeat(50));

let allPassed = true;

// Test 1: Check cron.json has check_schedule
console.log("\n📋 Test 1: cron.json Configuration...");
console.log("-".repeat(50));

const cronPath = path.join(__dirname, '..', 'database', 'cron.json');
const cronConfig = JSON.parse(fs.readFileSync(cronPath, 'utf8'));

if (cronConfig.check_schedule) {
    console.log("✅ check_schedule exists in cron.json");
    console.log(`   Value: "${cronConfig.check_schedule}"`);
} else {
    console.log("❌ check_schedule NOT FOUND in cron.json");
    allPassed = false;
}

if ('status_check_schedule' in cronConfig) {
    console.log("✅ status_check_schedule exists in cron.json");
    console.log(`   Value: ${cronConfig.status_check_schedule}`);
} else {
    console.log("❌ status_check_schedule NOT FOUND in cron.json");
    allPassed = false;
}

// Test 2: Verify logic fix in cron.js
console.log("\n" + "=".repeat(50));
console.log("📋 Test 2: Logic Fix in cron.js...");
console.log("-".repeat(50));

const cronLibPath = path.join(__dirname, '..', 'lib', 'cron.js');
const cronLibContent = fs.readFileSync(cronLibPath, 'utf8');

// Check for the old problematic logic
if (cronLibContent.includes("global.config.check_schedule.startsWith('#')") &&
    cronLibContent.includes("substring(1)")) {
    console.log("❌ Old inverted logic still present!");
    allPassed = false;
} else {
    console.log("✅ Old inverted logic removed");
}

// Check for new correct logic
if (cronLibContent.includes("const cronConfig = loadCronConfig()") &&
    cronLibContent.includes("cronConfig.check_schedule || '0 */6 * * *'") &&
    cronLibContent.includes("cronConfig.status_check_schedule !== false")) {
    console.log("✅ New correct logic implemented");
    console.log("   - Loads from cron.json");
    console.log("   - Has default schedule (0 */6 * * *)");
    console.log("   - Checks status flag");
} else {
    console.log("❌ New logic not properly implemented");
    allPassed = false;
}

// Test 3: Admin routes validation
console.log("\n" + "=".repeat(50));
console.log("📋 Test 3: Admin Routes Validation...");
console.log("-".repeat(50));

const adminRoutesPath = path.join(__dirname, '..', 'routes', 'admin.js');
const adminRoutesContent = fs.readFileSync(adminRoutesPath, 'utf8');

// Check if check_schedule is in cronFields array
const cronFieldsMatch = adminRoutesContent.match(/const cronFields = \[([\s\S]*?)\]/);
if (cronFieldsMatch && cronFieldsMatch[0].includes("'check_schedule'")) {
    console.log("✅ check_schedule added to validation list");
} else {
    console.log("❌ check_schedule NOT in validation list");
    allPassed = false;
}

// Test 4: Admin panel integration (cron.php)
console.log("\n" + "=".repeat(50));
console.log("📋 Test 4: Admin Panel (cron.php)...");
console.log("-".repeat(50));

const cronPhpPath = path.join(__dirname, '..', 'views', 'sb-admin', 'cron.php');
const cronPhpContent = fs.readFileSync(cronPhpPath, 'utf8');

// Check HTML form fields
if (cronPhpContent.includes('id="check_schedule"') &&
    cronPhpContent.includes('name="check_schedule"')) {
    console.log("✅ check_schedule input field exists");
} else {
    console.log("❌ check_schedule input field missing");
    allPassed = false;
}

if (cronPhpContent.includes('id="status_check_schedule"') &&
    cronPhpContent.includes('name="status_check_schedule"')) {
    console.log("✅ status_check_schedule checkbox exists");
} else {
    console.log("❌ status_check_schedule checkbox missing");
    allPassed = false;
}

// Check JavaScript handling
if (cronPhpContent.includes('document.getElementById("check_schedule").value') &&
    cronPhpContent.includes('document.getElementById("status_check_schedule").checked')) {
    console.log("✅ JavaScript properly handles both fields");
} else {
    console.log("❌ JavaScript not properly handling fields");
    allPassed = false;
}

// Test 5: config.php cleanup
console.log("\n" + "=".repeat(50));
console.log("📋 Test 5: config.php Cleanup...");
console.log("-".repeat(50));

const configPhpPath = path.join(__dirname, '..', 'views', 'sb-admin', 'config.php');
const configPhpContent = fs.readFileSync(configPhpPath, 'utf8');

// Check that check_schedule was removed from config.php
const hasCheckScheduleInConfig = configPhpContent.includes('label for="check_schedule"') ||
                                 configPhpContent.includes('id="check_schedule"');

if (!hasCheckScheduleInConfig) {
    console.log("✅ check_schedule removed from config.php");
} else {
    console.log("⚠️ check_schedule still present in config.php");
    console.log("   (Should be in cron.php only)");
}

// Summary
console.log("\n" + "=".repeat(50));
console.log("📊 FIX VERIFICATION SUMMARY:");
console.log("-".repeat(50));

const fixes = {
    "Configuration moved to cron.json": cronConfig.check_schedule && 'status_check_schedule' in cronConfig,
    "Logic inverted bug fixed": !cronLibContent.includes("substring(1)"),
    "New logic properly implemented": cronLibContent.includes("cronConfig.check_schedule"),
    "Admin routes validation added": adminRoutesContent.includes("'check_schedule'"),
    "Admin panel fields added": cronPhpContent.includes('id="check_schedule"'),
    "JavaScript handling added": cronPhpContent.includes('document.getElementById("check_schedule")')
};

Object.entries(fixes).forEach(([test, passed]) => {
    console.log(`  ${passed ? '✅' : '❌'} ${test}`);
    if (!passed) allPassed = false;
});

// Final result
console.log("\n" + "=".repeat(50));
if (allPassed) {
    console.log("✅ ALL FIXES VERIFIED SUCCESSFULLY!");
    console.log("\nThe redaman check schedule system is now:");
    console.log("  • Properly configured in cron.json");
    console.log("  • Logic bug fixed (no more inverted behavior)");
    console.log("  • Validated when saved");
    console.log("  • Manageable through admin panel");
    console.log("  • Has enable/disable toggle");
    console.log("\nDefault schedule: Every 6 hours (0 */6 * * *)");
} else {
    console.log("❌ SOME FIXES INCOMPLETE - Review the issues above");
}
console.log("=".repeat(50));

process.exit(allPassed ? 0 : 1);
