#!/usr/bin/env node

/**
 * Test Script: Verify Menu Consistency
 * 
 * Tests that all menu commands are detected consistently via keyword handler
 */

const fs = require('fs');
const path = require('path');

console.log("🔍 TEST: Menu Consistency Check\n");
console.log("=" .repeat(50));

// Test 1: Check wifi_templates.json has menu keywords
console.log("\n📋 Test 1: Checking menu keywords in wifi_templates.json...");
console.log("-".repeat(50));

try {
    const templatesPath = path.join(__dirname, '..', 'database', 'wifi_templates.json');
    const templates = JSON.parse(fs.readFileSync(templatesPath, 'utf8'));
    
    const menuKeywords = [
        'menupelanggan',
        'menuteknisi', 
        'menuwifi',
        'menuowner'
    ];
    
    const foundMenus = {};
    
    templates.forEach(template => {
        menuKeywords.forEach(keyword => {
            if (template.keywords && template.keywords.includes(keyword)) {
                foundMenus[keyword] = template.intent;
            }
        });
    });
    
    console.log("\nMenu Keywords Found:");
    menuKeywords.forEach(keyword => {
        if (foundMenus[keyword]) {
            console.log(`  ✅ ${keyword} -> ${foundMenus[keyword]}`);
        } else {
            console.log(`  ❌ ${keyword} -> NOT FOUND`);
        }
    });
    
} catch (error) {
    console.error("Error reading wifi_templates.json:", error.message);
}

// Test 2: Check menu handlers exist
console.log("\n" + "=".repeat(50));
console.log("📋 Test 2: Checking menu handlers...");
console.log("-".repeat(50));

try {
    const menuHandlerPath = path.join(__dirname, '..', 'message', 'handlers', 'menu-handler.js');
    const menuHandlerContent = fs.readFileSync(menuHandlerPath, 'utf8');
    
    const handlers = [
        'handleMenuPelanggan',
        'handleMenuTeknisi',
        'handleMenuUtama',
        'handleMenuOwner'
    ];
    
    console.log("\nMenu Handlers:");
    handlers.forEach(handler => {
        if (menuHandlerContent.includes(`function ${handler}`) || 
            menuHandlerContent.includes(`${handler}:`)) {
            console.log(`  ✅ ${handler} exists`);
        } else {
            console.log(`  ❌ ${handler} missing`);
        }
    });
    
    // Check exports
    console.log("\nExported Handlers:");
    handlers.forEach(handler => {
        if (menuHandlerContent.includes(`exports.${handler}`) || 
            menuHandlerContent.includes(handler) && menuHandlerContent.includes('module.exports')) {
            console.log(`  ✅ ${handler} exported`);
        } else {
            console.log(`  ❌ ${handler} not exported`);
        }
    });
    
} catch (error) {
    console.error("Error checking menu handlers:", error.message);
}

// Test 3: Verify consistent flow in raf.js
console.log("\n" + "=".repeat(50));
console.log("📋 Test 3: Checking raf.js consistency...");
console.log("-".repeat(50));

try {
    const rafPath = path.join(__dirname, '..', 'message', 'raf.js');
    const rafContent = fs.readFileSync(rafPath, 'utf8');
    
    // Check no special handling for menupelanggan
    const hasSpecialMenuPelanggan = rafContent.includes(`chats.toLowerCase().replace(/\\s+/g, '') === 'menupelanggan'`);
    
    console.log("\nConsistency Checks:");
    if (!hasSpecialMenuPelanggan) {
        console.log("  ✅ No special handling for menupelanggan");
    } else {
        console.log("  ❌ Still has special handling for menupelanggan");
    }
    
    // Check case statements
    const menuCases = [
        { name: 'MENU_PELANGGAN', handler: 'handleMenuPelanggan' },
        { name: 'MENU_TEKNISI', handler: 'handleMenuTeknisi' },
        { name: 'MENU_UTAMA', handler: 'handleMenuUtama' }
    ];
    
    console.log("\nCase Handlers:");
    menuCases.forEach(menu => {
        const hasCase = rafContent.includes(`case '${menu.name}':`);
        const hasHandler = rafContent.includes(menu.handler);
        
        if (hasCase && hasHandler) {
            console.log(`  ✅ ${menu.name} uses ${menu.handler}`);
        } else {
            console.log(`  ❌ ${menu.name} issue (case: ${hasCase}, handler: ${hasHandler})`);
        }
    });
    
} catch (error) {
    console.error("Error checking raf.js:", error.message);
}

// Summary
console.log("\n" + "=".repeat(50));
console.log("📊 SUMMARY:");
console.log("-".repeat(50));

console.log("\n✅ Expected Behavior:");
console.log("  1. All menu commands detected via keyword handler");
console.log("  2. All show [KEYWORD_COMMAND] log");
console.log("  3. All simply call their handlers");
console.log("  4. No special cases or user checks");

console.log("\n📝 Test Commands:");
console.log("  - menupelanggan");
console.log("  - menuteknisi");
console.log("  - menuwifi");
console.log("  - menuowner");

console.log("\nAll should show: [KEYWORD_COMMAND] Phrase: \"[menu]\" -> Intent: [INTENT]");

console.log("\n" + "=".repeat(50));
console.log("TEST COMPLETE");
console.log("=" .repeat(50));

process.exit(0);
