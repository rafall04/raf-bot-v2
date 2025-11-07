#!/usr/bin/env node

/**
 * Test Script: Verify Menu Pelanggan Integration After Merge
 */

const path = require('path');
const fs = require('fs');

console.log("🔍 TEST: Menu Pelanggan Integration After Merge\n");
console.log("=".repeat(50));

// Set up globals
global.config = {
    nama: 'RAF WiFi',
    namabot: 'RAF Bot'
};

// Test 1: Check customermenu removed from wifi_menu_templates.json
console.log("\n📋 Test 1: Verify customermenu removed...");
console.log("-".repeat(50));

const wifiMenuTemplates = JSON.parse(fs.readFileSync('database/wifi_menu_templates.json', 'utf8'));

if (!wifiMenuTemplates.customermenu) {
    console.log("  ✅ customermenu successfully removed from wifi_menu_templates.json");
} else {
    console.log("  ❌ customermenu still exists in wifi_menu_templates.json!");
}

// Test 2: Check menu_pelanggan exists in command_templates.json
console.log("\n" + "=".repeat(50));
console.log("📋 Test 2: Verify menu_pelanggan updated...");
console.log("-".repeat(50));

const commandTemplates = JSON.parse(fs.readFileSync('database/command_templates.json', 'utf8'));

if (commandTemplates.menu_pelanggan) {
    const template = commandTemplates.menu_pelanggan;
    console.log("  ✅ menu_pelanggan exists in command_templates.json");
    console.log("  - Name:", template.name);
    console.log("  - Length:", template.template.length, "characters");
    console.log("  - Has SPEED BOOST section:", template.template.includes('SPEED BOOST') ? '✅' : '❌');
    console.log("  - Has AGENT/OUTLET section:", template.template.includes('AGENT/OUTLET') ? '✅' : '❌');
    console.log("  - Has PENGATURAN WIFI section:", template.template.includes('PENGATURAN WIFI') ? '✅' : '❌');
} else {
    console.log("  ❌ menu_pelanggan NOT FOUND in command_templates.json!");
}

// Test 3: Check wifi.js no longer exports customermenu
console.log("\n" + "=".repeat(50));
console.log("📋 Test 3: Check wifi.js exports...");
console.log("-".repeat(50));

const wifiModule = require('../message/wifi');

if (!wifiModule.customermenu) {
    console.log("  ✅ customermenu no longer exported from wifi.js");
} else {
    console.log("  ❌ customermenu still exported from wifi.js!");
}

// Test 4: Check template-manager can access menu_pelanggan
console.log("\n" + "=".repeat(50));
console.log("📋 Test 4: Template Manager Integration...");
console.log("-".repeat(50));

const templateManager = require('../lib/template-manager');

if (templateManager.hasTemplate('menu_pelanggan')) {
    console.log("  ✅ Template Manager can access menu_pelanggan");
    
    // Test with placeholder values
    const rendered = templateManager.getTemplate('menu_pelanggan', {
        pushname: 'Test User',
        sender: '6285233047094@s.whatsapp.net'
    });
    
    console.log("  ✅ Template renders successfully");
    console.log("  - Output length:", rendered.length, "characters");
    console.log("  - Contains ${nama_wifi}:", rendered.includes('RAF WiFi') ? '✅' : '❌');
    console.log("  - Contains ${nama_bot}:", rendered.includes('RAF Bot') ? '✅' : '❌');
} else {
    console.log("  ❌ Template Manager cannot find menu_pelanggan!");
}

// Test 5: Check menu-handler.js integration
console.log("\n" + "=".repeat(50));
console.log("📋 Test 5: Menu Handler Integration...");
console.log("-".repeat(50));

const menuHandlerPath = path.join(__dirname, '..', 'message', 'handlers', 'menu-handler.js');
const menuHandlerContent = fs.readFileSync(menuHandlerPath, 'utf8');

// Check imports
if (!menuHandlerContent.includes('customermenu')) {
    console.log("  ✅ customermenu import removed from menu-handler.js");
} else {
    console.log("  ❌ customermenu still imported in menu-handler.js");
}

// Check template usage
if (menuHandlerContent.includes("templateManager.hasTemplate('menu_pelanggan')")) {
    console.log("  ✅ menu-handler.js uses menu_pelanggan template");
} else {
    console.log("  ❌ menu-handler.js not using menu_pelanggan template correctly");
}

// Test 6: No duplicate references
console.log("\n" + "=".repeat(50));
console.log("📋 Test 6: Check for duplicate references...");
console.log("-".repeat(50));

// Count templates across files
let menuCount = 0;
const templates = [];

// Check command_templates
if (commandTemplates.menu_pelanggan) {
    menuCount++;
    templates.push("menu_pelanggan in command_templates.json");
}

// Check wifi_menu_templates
if (wifiMenuTemplates.customermenu) {
    menuCount++;
    templates.push("customermenu in wifi_menu_templates.json");
}

console.log(`  Found ${menuCount} customer menu template(s):`);
templates.forEach(t => console.log(`    - ${t}`));

if (menuCount === 1) {
    console.log("  ✅ No duplicates - only one customer menu exists");
} else {
    console.log("  ❌ Duplicates found - cleanup needed!");
}

// Summary
console.log("\n" + "=".repeat(50));
console.log("📊 SUMMARY:");
console.log("-".repeat(50));

const tests = {
    "customermenu removed from wifi_menu_templates": !wifiMenuTemplates.customermenu,
    "menu_pelanggan exists in command_templates": !!commandTemplates.menu_pelanggan,
    "customermenu not exported from wifi.js": !wifiModule.customermenu,
    "Template Manager can access menu_pelanggan": templateManager.hasTemplate('menu_pelanggan'),
    "menu-handler.js properly integrated": !menuHandlerContent.includes('customermenu'),
    "No duplicates exist": menuCount === 1
};

let allPassed = true;
Object.entries(tests).forEach(([test, passed]) => {
    console.log(`  ${passed ? '✅' : '❌'} ${test}`);
    if (!passed) allPassed = false;
});

console.log("\n" + "=".repeat(50));
console.log(allPassed ? 
    "✅ ALL TESTS PASSED - Menu Pelanggan properly merged!" : 
    "❌ SOME TESTS FAILED - Please check the issues above");
console.log("=".repeat(50));

// Clean up temp files
if (fs.existsSync('test/customermenu-extracted.txt')) {
    fs.unlinkSync('test/customermenu-extracted.txt');
}
if (fs.existsSync('test/extract-customermenu.js')) {
    fs.unlinkSync('test/extract-customermenu.js');
}

process.exit(allPassed ? 0 : 1);
