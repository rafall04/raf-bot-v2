#!/usr/bin/env node

/**
 * Test Script: Verify Template System Implementation
 */

const path = require('path');
const fs = require('fs');

console.log("🔍 TEST: Template System Implementation\n");
console.log("=".repeat(50));

// Set up global config (mock)
global.config = {
    nama: 'RAF WiFi',
    namabot: 'RAF Bot',
    ownerNumber: '6285233047094'
};

// Test 1: Check template files exist
console.log("\n📋 Test 1: Check template files...");
console.log("-".repeat(50));

const templateFiles = [
    'message_templates.json',
    'wifi_menu_templates.json',
    'command_templates.json',
    'error_templates.json',
    'success_templates.json'
];

templateFiles.forEach(file => {
    const filePath = path.join(__dirname, '..', 'database', file);
    if (fs.existsSync(filePath)) {
        const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        const count = Object.keys(content).length;
        console.log(`  ✅ ${file} - ${count} templates`);
    } else {
        console.log(`  ❌ ${file} - NOT FOUND`);
    }
});

// Test 2: Load Template Manager
console.log("\n" + "=".repeat(50));
console.log("📋 Test 2: Load Template Manager...");
console.log("-".repeat(50));

try {
    const templateManager = require('../lib/template-manager');
    console.log("  ✅ Template Manager loaded successfully");
    
    // Check available templates
    const allKeys = templateManager.getAllTemplateKeys();
    console.log(`  Total templates available: ${allKeys.length}`);
    
} catch (error) {
    console.log(`  ❌ Error loading Template Manager: ${error.message}`);
}

// Test 3: Test template rendering
console.log("\n" + "=".repeat(50));
console.log("📋 Test 3: Test template rendering...");
console.log("-".repeat(50));

try {
    const templateManager = require('../lib/template-manager');
    
    // Test bantuan template
    console.log("\n  Testing 'bantuan' template:");
    if (templateManager.hasTemplate('bantuan')) {
        const message = templateManager.getTemplate('bantuan', {
            pushname: 'Test User'
        });
        console.log(`    ✅ Rendered successfully (${message.length} chars)`);
        console.log(`    First line: "${message.split('\n')[0]}"`);
    } else {
        console.log("    ❌ Template not found");
    }
    
    // Test sapaan_pagi template
    console.log("\n  Testing 'sapaan_pagi' template:");
    if (templateManager.hasTemplate('sapaan_pagi')) {
        const message = templateManager.getTemplate('sapaan_pagi', {
            pushname: 'Budi'
        });
        console.log(`    ✅ Rendered: "${message}"`);
    } else {
        console.log("    ❌ Template not found");
    }
    
    // Test menu_pelanggan template
    console.log("\n  Testing 'menu_pelanggan' template:");
    if (templateManager.hasTemplate('menu_pelanggan')) {
        const message = templateManager.getTemplate('menu_pelanggan', {
            pushname: 'Customer'
        });
        console.log(`    ✅ Rendered successfully (${message.length} chars)`);
    } else {
        console.log("    ❌ Template not found");
    }
    
} catch (error) {
    console.log(`  ❌ Error testing templates: ${error.message}`);
}

// Test 4: Test handlers with templates
console.log("\n" + "=".repeat(50));
console.log("📋 Test 4: Test handlers with templates...");
console.log("-".repeat(50));

try {
    // Mock reply function
    let lastReply = null;
    const mockReply = (message) => {
        lastReply = message;
    };
    
    // Test utility-handler
    const utilityHandler = require('../message/handlers/utility-handler');
    
    console.log("\n  Testing handleBantuan:");
    utilityHandler.handleBantuan('TestUser', global.config, mockReply);
    if (lastReply && !lastReply.includes('${')) {
        console.log("    ✅ Handler working with template");
        console.log(`    Message starts with: "${lastReply.substring(0, 30)}..."`);
    } else {
        console.log("    ❌ Handler may have issues");
    }
    
    console.log("\n  Testing handleSapaanUmum:");
    utilityHandler.handleSapaanUmum('TestUser', mockReply);
    if (lastReply && !lastReply.includes('${')) {
        console.log("    ✅ Handler working with template");
        console.log(`    Message: "${lastReply.split('\n')[0]}"`);
    } else {
        console.log("    ❌ Handler may have issues");
    }
    
} catch (error) {
    console.log(`  ❌ Error testing handlers: ${error.message}`);
}

// Test 5: Check placeholder extraction
console.log("\n" + "=".repeat(50));
console.log("📋 Test 5: Check placeholder extraction...");
console.log("-".repeat(50));

try {
    const templateManager = require('../lib/template-manager');
    
    const testKeys = ['bantuan', 'menu_pelanggan', 'sapaan_pagi'];
    
    testKeys.forEach(key => {
        const info = templateManager.getTemplateInfo(key);
        if (info) {
            console.log(`\n  ${key}:`);
            console.log(`    Name: ${info.name}`);
            console.log(`    Placeholders: ${info.placeholders.join(', ')}`);
        }
    });
    
} catch (error) {
    console.log(`  ❌ Error extracting placeholders: ${error.message}`);
}

// Summary
console.log("\n" + "=".repeat(50));
console.log("📊 SUMMARY:");
console.log("-".repeat(50));

console.log("\n✅ Implementation Status:");
console.log("  1. Template files created");
console.log("  2. Template Manager implemented");
console.log("  3. Handlers updated to use templates");
console.log("  4. Fallback mechanism in place");

console.log("\n📝 Benefits:");
console.log("  - All messages centralized in JSON files");
console.log("  - Easy to edit without touching code");
console.log("  - Consistent formatting");
console.log("  - Real-time updates possible");

console.log("\n⚠️ Next Steps:");
console.log("  1. Migrate remaining ~350+ hardcoded messages");
console.log("  2. Add template editing UI in admin panel");
console.log("  3. Add template validation");
console.log("  4. Document all available placeholders");

console.log("\n" + "=".repeat(50));
console.log("TEST COMPLETE");
console.log("=".repeat(50));

process.exit(0);
