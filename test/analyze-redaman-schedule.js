#!/usr/bin/env node

/**
 * Test Script: Analyze Redaman Check Schedule System
 */

const fs = require('fs');
const path = require('path');

console.log("🔍 ANALISIS SISTEM JADWAL CEK REDAMAN\n");
console.log("=".repeat(50));

// 1. Check cron.json structure
console.log("\n📋 1. Checking cron.json...");
console.log("-".repeat(50));

const cronPath = path.join(__dirname, '..', 'database', 'cron.json');
const cronConfig = JSON.parse(fs.readFileSync(cronPath, 'utf8'));

console.log("Cron schedules found:");
Object.keys(cronConfig).forEach(key => {
    if (key.includes('schedule') || key.includes('Schedule')) {
        console.log(`  - ${key}: "${cronConfig[key]}"`);
    }
});

// Check if check_schedule exists in cron.json
if (!cronConfig.check_schedule) {
    console.log("\n⚠️ PROBLEM: 'check_schedule' NOT FOUND in cron.json!");
    console.log("  This means it's stored in config.json (gitignored)");
    console.log("  This creates INCONSISTENCY in configuration management");
}

// 2. Analyze startCheck() function logic
console.log("\n" + "=".repeat(50));
console.log("📋 2. Analyzing startCheck() logic...");
console.log("-".repeat(50));

const cronLibPath = path.join(__dirname, '..', 'lib', 'cron.js');
const cronLibContent = fs.readFileSync(cronLibPath, 'utf8');

// Find the problematic logic
const lines = cronLibContent.split('\n');
const startCheckLine = lines.findIndex(line => line.includes('function startCheck()'));

if (startCheckLine > -1) {
    console.log(`Found startCheck() at line ${startCheckLine + 1}`);
    
    // Check for the problematic logic
    const problematicLine = lines.findIndex(line => 
        line.includes("global.config.check_schedule.startsWith('#')") &&
        line.includes("substring(1)")
    );
    
    if (problematicLine > -1) {
        console.log("\n❌ CRITICAL BUG FOUND at line " + (problematicLine + 1) + ":");
        console.log("  The logic is INVERTED!");
        console.log("  Current: If starts with '#', REMOVE '#' and RUN");
        console.log("  Should be: If starts with '#', task is DISABLED");
        console.log("\n  Code snippet:");
        console.log("  " + lines[problematicLine]);
        console.log("  " + lines[problematicLine + 1]);
        console.log("  " + lines[problematicLine + 2]);
    }
}

// 3. Check initializeAllCronTasks
console.log("\n" + "=".repeat(50));
console.log("📋 3. Checking initializeAllCronTasks...");
console.log("-".repeat(50));

const initTasksLine = lines.findIndex(line => line.includes('startCheck()'));
if (initTasksLine > -1) {
    console.log(`startCheck() is called at line ${initTasksLine + 1}`);
    console.log("Context:");
    for (let i = Math.max(0, initTasksLine - 3); i <= Math.min(lines.length - 1, initTasksLine + 3); i++) {
        console.log(`  ${i + 1}: ${lines[i]}`);
    }
}

// 4. Check admin panel integration
console.log("\n" + "=".repeat(50));
console.log("📋 4. Admin Panel Integration...");
console.log("-".repeat(50));

const configPhpPath = path.join(__dirname, '..', 'views', 'sb-admin', 'config.php');
if (fs.existsSync(configPhpPath)) {
    const configPhpContent = fs.readFileSync(configPhpPath, 'utf8');
    
    if (configPhpContent.includes('check_schedule')) {
        console.log("✅ check_schedule field exists in config.php");
        
        // Check if it has proper help text
        if (!configPhpContent.includes('Jadwal Cek redaman')) {
            console.log("⚠️ Missing proper label for check_schedule field");
        }
        
        // Check if there's validation
        if (!configPhpContent.includes('cron') && configPhpContent.includes('check_schedule')) {
            console.log("⚠️ No cron validation visible for check_schedule field");
        }
    } else {
        console.log("❌ check_schedule field NOT FOUND in config.php");
    }
}

// 5. Check admin routes
console.log("\n" + "=".repeat(50));
console.log("📋 5. Admin API Routes...");
console.log("-".repeat(50));

const adminRoutesPath = path.join(__dirname, '..', 'routes', 'admin.js');
const adminRoutesContent = fs.readFileSync(adminRoutesPath, 'utf8');

// Check if check_schedule is handled
if (!adminRoutesContent.includes("check_schedule")) {
    console.log("⚠️ 'check_schedule' not explicitly handled in admin routes");
    console.log("  It's probably saved to config.json through generic handler");
}

// Check if there's validation for check_schedule
const hasValidation = adminRoutesContent.includes("isValidCron") && adminRoutesContent.includes("check_schedule");
if (!hasValidation) {
    console.log("❌ No cron validation for check_schedule in admin routes!");
}

// SUMMARY
console.log("\n" + "=".repeat(50));
console.log("🔴 PROBLEMS FOUND:");
console.log("-".repeat(50));

const problems = [
    {
        severity: "CRITICAL",
        issue: "Logic INVERTED in startCheck()",
        description: "If schedule starts with '#', it REMOVES '#' and RUNS (should be DISABLED)",
        file: "lib/cron.js",
        line: "627-629"
    },
    {
        severity: "HIGH",
        issue: "Configuration inconsistency",
        description: "check_schedule in config.json, not cron.json",
        impact: "Cannot manage through cron API endpoint"
    },
    {
        severity: "MEDIUM",
        issue: "No validation in admin API",
        description: "check_schedule not validated when saved",
        file: "routes/admin.js"
    },
    {
        severity: "MEDIUM",
        issue: "Missing status toggle",
        description: "No status_check_schedule to enable/disable",
        impact: "Must use '#' prefix to disable (confusing)"
    }
];

problems.forEach((problem, index) => {
    console.log(`\n${index + 1}. [${problem.severity}] ${problem.issue}`);
    console.log(`   Description: ${problem.description}`);
    if (problem.file) console.log(`   File: ${problem.file}`);
    if (problem.line) console.log(`   Line: ${problem.line}`);
    if (problem.impact) console.log(`   Impact: ${problem.impact}`);
});

// RECOMMENDATIONS
console.log("\n" + "=".repeat(50));
console.log("✅ RECOMMENDATIONS:");
console.log("-".repeat(50));

const recommendations = [
    "1. FIX inverted logic in startCheck() - lines 627-629",
    "2. ADD check_schedule to cron.json with status_check_schedule flag",
    "3. ADD validation for check_schedule in admin routes",
    "4. UPDATE admin panel to show enable/disable toggle",
    "5. ADD default schedule if missing (e.g., '0 */6 * * *' for every 6 hours)",
    "6. ADD logging to track when redaman checks run"
];

recommendations.forEach(rec => console.log(rec));

console.log("\n" + "=".repeat(50));
console.log("ANALYSIS COMPLETE");
console.log("=".repeat(50));
