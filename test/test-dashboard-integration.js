#!/usr/bin/env node

/**
 * Test Script for Dashboard Integration
 * Verifies that all monitoring components are properly integrated
 */

const fs = require('fs');
const path = require('path');

console.log('🧪 TESTING DASHBOARD INTEGRATION');
console.log('=' .repeat(70));

let testsPassed = 0;
let testsFailed = 0;

function checkFile(filePath, description) {
    const fullPath = path.join(__dirname, '..', filePath);
    console.log(`\n📁 Checking ${description}...`);
    console.log(`   Path: ${filePath}`);
    
    if (fs.existsSync(fullPath)) {
        console.log(`   ✅ File exists`);
        
        // Check file size
        const stats = fs.statSync(fullPath);
        console.log(`   📊 Size: ${stats.size} bytes`);
        
        // Check if readable
        try {
            const content = fs.readFileSync(fullPath, 'utf8');
            console.log(`   ✅ File is readable`);
            
            // Check for specific content markers
            if (filePath.includes('.php')) {
                if (content.includes('<?php')) {
                    console.log(`   ✅ Valid PHP file`);
                } else {
                    console.log(`   ⚠️ Warning: No PHP opening tag found`);
                }
            }
            
            if (filePath.includes('.js')) {
                if (content.includes('class') || content.includes('function')) {
                    console.log(`   ✅ Contains JavaScript code`);
                } else {
                    console.log(`   ⚠️ Warning: No functions or classes found`);
                }
            }
            
            testsPassed++;
            return true;
        } catch (error) {
            console.log(`   ❌ Error reading file: ${error.message}`);
            testsFailed++;
            return false;
        }
    } else {
        console.log(`   ❌ File does not exist`);
        testsFailed++;
        return false;
    }
}

function checkIntegration(filePath, searchStrings, description) {
    const fullPath = path.join(__dirname, '..', filePath);
    console.log(`\n🔍 Checking integration in ${description}...`);
    
    if (!fs.existsSync(fullPath)) {
        console.log(`   ❌ File does not exist`);
        testsFailed++;
        return false;
    }
    
    try {
        const content = fs.readFileSync(fullPath, 'utf8');
        let allFound = true;
        
        for (const searchString of searchStrings) {
            if (content.includes(searchString)) {
                console.log(`   ✅ Found: "${searchString}"`);
            } else {
                console.log(`   ❌ Not found: "${searchString}"`);
                allFound = false;
            }
        }
        
        if (allFound) {
            testsPassed++;
        } else {
            testsFailed++;
        }
        
        return allFound;
    } catch (error) {
        console.log(`   ❌ Error reading file: ${error.message}`);
        testsFailed++;
        return false;
    }
}

function checkConfig() {
    console.log(`\n⚙️ Checking configuration...`);
    const configPath = path.join(__dirname, '..', 'config.json');
    
    if (!fs.existsSync(configPath)) {
        console.log(`   ⚠️ config.json not found, checking config-example.json`);
        const examplePath = path.join(__dirname, '..', 'config-example.json');
        
        if (fs.existsSync(examplePath)) {
            const config = JSON.parse(fs.readFileSync(examplePath, 'utf8'));
            if (config.monitoring) {
                console.log(`   ✅ Monitoring configuration found in example`);
                console.log(`      - enabled: ${config.monitoring.enabled}`);
                console.log(`      - alert_level: ${config.monitoring.alert_level}`);
                testsPassed++;
                return true;
            }
        }
        testsFailed++;
        return false;
    }
    
    try {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        if (config.monitoring) {
            console.log(`   ✅ Monitoring configuration found`);
            console.log(`      - enabled: ${config.monitoring.enabled}`);
            if (config.monitoring.alert_level) {
                console.log(`      - alert_level: ${config.monitoring.alert_level}`);
            }
            testsPassed++;
            return true;
        } else {
            console.log(`   ⚠️ No monitoring configuration found`);
            console.log(`   💡 Add monitoring config to enable the feature`);
            testsPassed++; // Still pass as it's optional
            return true;
        }
    } catch (error) {
        console.log(`   ❌ Error reading config: ${error.message}`);
        testsFailed++;
        return false;
    }
}

// Run tests
console.log('\n📋 TESTING FILE EXISTENCE');
console.log('-'.repeat(70));

// Check core files
checkFile('views/monitoring-widget.php', 'Monitoring Widget PHP');
checkFile('static/js/monitoring-controller.js', 'Monitoring Controller JS');
checkFile('views/api-monitoring-wrapper.php', 'API Wrapper PHP');
checkFile('static/css/monitoring.css', 'Monitoring CSS');

// Check integration files
checkFile('routes/monitoring-dashboard.js', 'Monitoring Dashboard Routes');
checkFile('lib/error-recovery.js', 'Error Recovery Module');
checkFile('lib/monitoring-service.js', 'Monitoring Service');
checkFile('lib/alert-system.js', 'Alert System');

console.log('\n📋 TESTING INTEGRATION');
console.log('-'.repeat(70));

// Check index.php integration
checkIntegration('views/sb-admin/index.php', [
    'monitoring.css',
    'monitoring-widget.php',
    'monitoring-controller.js',
    '$monitoringEnabled'
], 'index.php');

// Check if monitoring routes are mounted
checkIntegration('index.js', [
    'monitoring-dashboard',
    'MonitoringService',
    'ErrorRecovery',
    'AlertSystem'
], 'index.js main file');

// Check configuration
checkConfig();

// Final summary
console.log('\n' + '='.repeat(70));
console.log('📊 TEST SUMMARY');
console.log('='.repeat(70));
console.log(`✅ Tests Passed: ${testsPassed}`);
console.log(`❌ Tests Failed: ${testsFailed}`);

if (testsFailed === 0) {
    console.log('\n🎉 ALL TESTS PASSED! Dashboard integration is complete.');
    console.log('\n📝 NEXT STEPS:');
    console.log('1. Update config.json with monitoring settings');
    console.log('2. Start the Node.js server: npm start');
    console.log('3. Access the dashboard: http://localhost:3100/views/sb-admin/index.php');
    console.log('4. Look for the monitoring section after dashboard header');
} else {
    console.log('\n⚠️ SOME TESTS FAILED! Please check the errors above.');
    console.log('\n💡 TROUBLESHOOTING:');
    console.log('1. Ensure all files were created successfully');
    console.log('2. Check file permissions');
    console.log('3. Verify Node.js modules are installed');
}

console.log('\n✨ Dashboard Integration Test Complete!\n');

// Exit with appropriate code
process.exit(testsFailed > 0 ? 1 : 0);
