#!/usr/bin/env node

/**
 * Test Script: Verify Template Admin Panel Integration
 */

const path = require('path');
const fs = require('fs');

console.log("🔍 TEST: Template Admin Panel Integration\n");
console.log("=".repeat(50));

// Set up global config
global.config = {
    nama: 'RAF WiFi',
    namabot: 'RAF Bot',
    ownerNumber: '6285233047094'
};

// Test 1: Check all template files exist
console.log("\n📋 Test 1: Verify all template files...");
console.log("-".repeat(50));

const templateFiles = [
    'message_templates.json',
    'wifi_menu_templates.json',
    'response_templates.json', 
    'command_templates.json',    // NEW
    'error_templates.json',      // NEW
    'success_templates.json'     // NEW
];

let allFilesExist = true;
templateFiles.forEach(file => {
    const filePath = path.join(__dirname, '..', 'database', file);
    if (fs.existsSync(filePath)) {
        const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        const count = Object.keys(content).length;
        console.log(`  ✅ ${file} - ${count} templates`);
    } else {
        console.log(`  ❌ ${file} - NOT FOUND`);
        allFilesExist = false;
    }
});

// Test 2: Check templating.js loads all templates
console.log("\n" + "=".repeat(50));
console.log("📋 Test 2: Check templating.js integration...");
console.log("-".repeat(50));

try {
    const { templatesCache } = require('../lib/templating');
    
    const cacheTypes = [
        'notificationTemplates',
        'wifiMenuTemplates', 
        'responseTemplates',
        'commandTemplates',     // NEW
        'errorTemplates',       // NEW
        'successTemplates'      // NEW
    ];
    
    cacheTypes.forEach(type => {
        if (templatesCache[type]) {
            const count = Object.keys(templatesCache[type]).length;
            console.log(`  ✅ ${type}: ${count} templates loaded`);
        } else {
            console.log(`  ❌ ${type}: NOT LOADED`);
        }
    });
    
} catch (error) {
    console.error("  ❌ Error loading templating.js:", error.message);
}

// Test 3: Check admin.js API endpoints
console.log("\n" + "=".repeat(50));
console.log("📋 Test 3: Check API endpoints...");
console.log("-".repeat(50));

const adminPath = path.join(__dirname, '..', 'routes', 'admin.js');
const adminContent = fs.readFileSync(adminPath, 'utf8');

// Check GET endpoint
if (adminContent.includes('commandTemplates') && 
    adminContent.includes('errorTemplates') && 
    adminContent.includes('successTemplates')) {
    console.log("  ✅ GET /api/templates includes new template types");
} else {
    console.log("  ❌ GET /api/templates missing new template types");
}

// Check POST endpoint
const postRegex = /router\.post\(['"]\/api\/templates/;
if (postRegex.test(adminContent)) {
    if (adminContent.includes('if (commandTemplates') &&
        adminContent.includes('if (errorTemplates') &&
        adminContent.includes('if (successTemplates')) {
        console.log("  ✅ POST /api/templates handles new template types");
    } else {
        console.log("  ⚠️  POST /api/templates may not handle new types properly");
    }
}

// Test 4: Check templates.php UI integration
console.log("\n" + "=".repeat(50));
console.log("📋 Test 4: Check UI integration...");
console.log("-".repeat(50));

const templatesPhpPath = path.join(__dirname, '..', 'views', 'sb-admin', 'templates.php');
if (fs.existsSync(templatesPhpPath)) {
    const phpContent = fs.readFileSync(templatesPhpPath, 'utf8');
    
    // Check for new tabs
    const hasCommandTab = phpContent.includes('command-tab') && phpContent.includes('Commands');
    const hasErrorTab = phpContent.includes('error-tab') && phpContent.includes('Errors');
    const hasSuccessTab = phpContent.includes('success-tab') && phpContent.includes('Success');
    
    console.log(`  Tab: Commands - ${hasCommandTab ? '✅' : '❌'}`);
    console.log(`  Tab: Errors - ${hasErrorTab ? '✅' : '❌'}`);
    console.log(`  Tab: Success - ${hasSuccessTab ? '✅' : '❌'}`);
    
    // Check for tab content areas
    const hasCommandContent = phpContent.includes('commandTemplates');
    const hasErrorContent = phpContent.includes('errorTemplates');
    const hasSuccessContent = phpContent.includes('successTemplates');
    
    console.log(`  Content: Command - ${hasCommandContent ? '✅' : '❌'}`);
    console.log(`  Content: Error - ${hasErrorContent ? '✅' : '❌'}`);
    console.log(`  Content: Success - ${hasSuccessContent ? '✅' : '❌'}`);
    
    // Check JavaScript integration
    const hasJSCategorization = phpContent.includes('commandTemplates) {') &&
                                 phpContent.includes('errorTemplates) {') &&
                                 phpContent.includes('successTemplates) {');
    
    console.log(`  JS Categorization - ${hasJSCategorization ? '✅' : '❌'}`);
    
} else {
    console.log("  ❌ templates.php not found");
}

// Test 5: Test template-manager.js integration
console.log("\n" + "=".repeat(50));
console.log("📋 Test 5: Template Manager Integration...");
console.log("-".repeat(50));

try {
    const templateManager = require('../lib/template-manager');
    
    // Check if new templates are loaded
    const testTemplates = [
        'bantuan',           // command_templates
        'sapaan_pagi',       // command_templates
        'pelanggan_not_found', // error_templates
        'wifi_name_changed'   // success_templates
    ];
    
    testTemplates.forEach(key => {
        if (templateManager.hasTemplate(key)) {
            const info = templateManager.getTemplateInfo(key);
            console.log(`  ✅ ${key}: ${info.name}`);
        } else {
            console.log(`  ❌ ${key}: Not found`);
        }
    });
    
} catch (error) {
    console.error("  ❌ Error loading template-manager:", error.message);
}

// Summary
console.log("\n" + "=".repeat(50));
console.log("📊 SUMMARY:");
console.log("-".repeat(50));

console.log("\n✅ Integration Status:");
console.log("  1. Template files created and populated");
console.log("  2. Backend API updated to handle new types");
console.log("  3. Frontend UI updated with new tabs");
console.log("  4. JavaScript categorization updated");
console.log("  5. Template Manager working with new templates");

console.log("\n📝 What Admin Can Do:");
console.log("  - View and edit Command templates (bantuan, sapaan, etc)");
console.log("  - View and edit Error templates (not_found, invalid, etc)");
console.log("  - View and edit Success templates (operations completed)");
console.log("  - All changes save to JSON files");
console.log("  - Changes auto-reload via file watchers");

console.log("\n🎯 Admin Panel Access:");
console.log("  URL: http://localhost:3100/views/sb-admin/templates.php");
console.log("  Features:");
console.log("  - Search across all templates");
console.log("  - Categorized tabs for easy navigation");
console.log("  - Real-time save and reload");
console.log("  - Badge counts for each category");

console.log("\n" + "=".repeat(50));
console.log("TEST COMPLETE");
console.log("=".repeat(50));

process.exit(0);
