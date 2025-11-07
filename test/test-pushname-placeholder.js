#!/usr/bin/env node

/**
 * Test Script: Verify pushname placeholder now works in menu templates
 */

const fs = require('fs');
const path = require('path');

console.log("🔍 TEST: Pushname Placeholder in Menu Templates\n");
console.log("=".repeat(50));

// Test 1: Check wifi.js functions accept pushname
console.log("\n📋 Test 1: Check wifi.js function signatures...");
console.log("-".repeat(50));

try {
    const wifiPath = path.join(__dirname, '..', 'message', 'wifi.js');
    const wifiContent = fs.readFileSync(wifiPath, 'utf8');
    
    const menuFunctions = [
        'wifimenu',
        'customermenu',
        'technicianmenu',
        'menubelivoucher',
        'menuvoucher',
        'menupasang',
        'menuowner',
        'menupaket'
    ];
    
    console.log("\nFunction Signatures:");
    menuFunctions.forEach(func => {
        const regex = new RegExp(`exports\\.${func}\\s*=\\s*\\(([^)]+)\\)`, 'g');
        const match = regex.exec(wifiContent);
        if (match) {
            const params = match[1];
            const hasPushname = params.includes('pushname');
            const hasSender = params.includes('sender');
            
            console.log(`  ${func}(${params})`);
            console.log(`    pushname: ${hasPushname ? '✅' : '❌'}`);
            console.log(`    sender: ${hasSender ? '✅' : '❌'}`);
        } else {
            console.log(`  ${func}: NOT FOUND`);
        }
    });
    
} catch (error) {
    console.error("Error reading wifi.js:", error.message);
}

// Test 2: Check menu-handler.js functions
console.log("\n" + "=".repeat(50));
console.log("📋 Test 2: Check menu-handler.js signatures...");
console.log("-".repeat(50));

try {
    const handlerPath = path.join(__dirname, '..', 'message', 'handlers', 'menu-handler.js');
    const handlerContent = fs.readFileSync(handlerPath, 'utf8');
    
    const handlers = [
        'handleMenuUtama',
        'handleMenuTeknisi',
        'handleMenuOwner',
        'handleMenuPelanggan',
        'handleTanyaCaraPasang',
        'handleTanyaPaketBulanan',
        'handleTutorialTopup'
    ];
    
    console.log("\nHandler Signatures:");
    handlers.forEach(handler => {
        const regex = new RegExp(`function\\s+${handler}\\s*\\(([^)]+)\\)`, 'g');
        const match = regex.exec(handlerContent);
        if (match) {
            const params = match[1];
            const hasPushname = params.includes('pushname');
            const hasSender = params.includes('sender');
            
            console.log(`  ${handler}(${params})`);
            console.log(`    pushname: ${hasPushname ? '✅' : '❌'}`);
            console.log(`    sender: ${hasSender ? '✅' : '❌'}`);
        } else {
            console.log(`  ${handler}: NOT FOUND`);
        }
    });
    
} catch (error) {
    console.error("Error reading menu-handler.js:", error.message);
}

// Test 3: Check raf.js calls
console.log("\n" + "=".repeat(50));
console.log("📋 Test 3: Check raf.js menu handler calls...");
console.log("-".repeat(50));

try {
    const rafPath = path.join(__dirname, '..', 'message', 'raf.js');
    const rafContent = fs.readFileSync(rafPath, 'utf8');
    
    // Check if calls include pushname and sender
    const menuCalls = [
        'handleMenuUtama',
        'handleMenuPelanggan',
        'handleMenuTeknisi'
    ];
    
    console.log("\nHandler Calls in raf.js:");
    menuCalls.forEach(call => {
        const regex = new RegExp(`${call}\\([^)]+\\)`, 'g');
        const match = regex.exec(rafContent);
        if (match) {
            const callStr = match[0];
            const hasPushname = callStr.includes('pushname');
            const hasSender = callStr.includes('sender');
            
            console.log(`  ${call}:`);
            console.log(`    includes pushname: ${hasPushname ? '✅' : '❌'}`);
            console.log(`    includes sender: ${hasSender ? '✅' : '❌'}`);
        } else {
            console.log(`  ${call}: NOT FOUND`);
        }
    });
    
} catch (error) {
    console.error("Error reading raf.js:", error.message);
}

// Test 4: Simulate template rendering
console.log("\n" + "=".repeat(50));
console.log("📋 Test 4: Simulate template rendering...");
console.log("-".repeat(50));

// Mock templatesCache
global.templatesCache = {
    wifiMenuTemplates: {
        wifimenu: "Halo ${pushname}! Selamat datang di ${nama_wifi}!"
    }
};

// Load the actual wifi.js module
delete require.cache[require.resolve('../message/wifi')];
const { wifimenu } = require('../message/wifi');

// Test with pushname
const result = wifimenu('RAF Net', 'RAF Bot', 'Budi', '6285233047094@s.whatsapp.net');

console.log("\nTemplate Test:");
console.log("  Input: \"Halo ${pushname}! Selamat datang di ${nama_wifi}!\"");
console.log(`  Output: "${result}"`);

if (result.includes('${pushname}')) {
    console.log("  Result: ❌ FAILED - ${pushname} not replaced");
} else if (result.includes('Budi')) {
    console.log("  Result: ✅ SUCCESS - pushname replaced correctly");
} else {
    console.log("  Result: ⚠️ WARNING - pushname replaced but with different value");
}

// Summary
console.log("\n" + "=".repeat(50));
console.log("📊 SUMMARY:");
console.log("-".repeat(50));

console.log("\n✅ Expected Results:");
console.log("  1. All menu functions accept pushname & sender");
console.log("  2. All handlers receive pushname & sender");  
console.log("  3. raf.js passes pushname & sender");
console.log("  4. Templates can use ${pushname} successfully");

console.log("\n📝 Available Placeholders in Menus:");
console.log("  - ${nama_wifi} - WiFi provider name");
console.log("  - ${nama_bot} - Bot name");
console.log("  - ${pushname} - WhatsApp display name ✅ NEW!");
console.log("  - ${sender} - Full sender ID ✅ NEW!");
console.log("  - ${phone} - Clean phone number ✅ NEW!");

console.log("\n" + "=".repeat(50));
console.log("TEST COMPLETE");
console.log("=".repeat(50));

process.exit(0);
