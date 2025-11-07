#!/usr/bin/env node

/**
 * Test Script: Debug Menu Issues
 * 
 * Tests:
 * 1. User detection for MENU_PELANGGAN
 * 2. Menu teknisi function name issue
 * 3. Keyword detection flow
 */

const fs = require('fs');
const path = require('path');

console.log("🔍 DEBUG: Menu Issues\n");
console.log("=" .repeat(50));

// Test 1: Check techinisionmenu vs technicianmenu
console.log("\n📋 Test 1: Menu function names...");
console.log("-".repeat(50));

const wifiPath = path.join(__dirname, '..', 'message', 'wifi.js');
const menuHandlerPath = path.join(__dirname, '..', 'message', 'handlers', 'menu-handler.js');

try {
    const wifiContent = fs.readFileSync(wifiPath, 'utf8');
    const menuHandlerContent = fs.readFileSync(menuHandlerPath, 'utf8');
    
    // Check what's exported from wifi.js
    const technicianExport = wifiContent.match(/exports\.(\w*technician\w*)/gi);
    const techinisionExport = wifiContent.match(/exports\.(\w*techinision\w*)/gi);
    
    console.log("\nExported from wifi.js:");
    if (technicianExport) {
        console.log("  ✅ Found:", technicianExport.join(', '));
    }
    if (techinisionExport) {
        console.log("  ❌ Found (wrong spelling):", techinisionExport.join(', '));
    }
    
    // Check what's imported in menu-handler.js
    const imports = menuHandlerContent.match(/techinisionmenu|technicianmenu/g);
    console.log("\nImported in menu-handler.js:");
    if (imports) {
        console.log("  Used:", imports.join(', '));
    }
    
    if (menuHandlerContent.includes('techinisionmenu') && !wifiContent.includes('techinisionmenu')) {
        console.log("\n❌ PROBLEM: menu-handler imports 'techinisionmenu' but wifi.js exports 'technicianmenu'");
        console.log("   FIX: Change 'techinisionmenu' to 'technicianmenu' in menu-handler.js");
    }
    
} catch (error) {
    console.error("Error reading files:", error.message);
}

// Test 2: Check user detection regex
console.log("\n" + "=".repeat(50));
console.log("📋 Test 2: User detection regex...");
console.log("-".repeat(50));

// Simulate WhatsApp sender format
const testSenders = [
    "6285233047094@s.whatsapp.net",
    "628123456789@s.whatsapp.net",
    "62812345678900@s.whatsapp.net" // longer number
];

console.log("\nTesting regex extraction:");
testSenders.forEach(sender => {
    try {
        const extracted = (/^([^:@]+)[:@]?.*$/.exec(sender))[1];
        console.log(`  ${sender} -> ${extracted}`);
    } catch (err) {
        console.log(`  ${sender} -> ERROR: ${err.message}`);
    }
});

// Test 3: Check database format
console.log("\n" + "=".repeat(50));
console.log("📋 Test 3: Database phone format...");
console.log("-".repeat(50));

try {
    const usersDbPath = path.join(__dirname, '..', 'database', 'users.db');
    
    if (fs.existsSync(usersDbPath)) {
        // Load global users like the bot does
        require('../lib/database').initializeDatabase().then(() => {
            console.log("\nSample users from database:");
            if (global.users && global.users.length > 0) {
                global.users.slice(0, 3).forEach(user => {
                    console.log(`  ID: ${user.id}, Phone: ${user.phone_number}`);
                });
                
                // Test matching
                console.log("\nTest matching with 6285233047094:");
                const testPhone = "6285233047094";
                const user = global.users.find(v => {
                    const phones = v.phone_number.split("|");
                    return phones.find(vv => vv == testPhone);
                });
                
                if (user) {
                    console.log("  ✅ User found:", user.name);
                } else {
                    console.log("  ❌ User NOT found");
                    
                    // Check if any user has this phone
                    const anyMatch = global.users.some(u => 
                        u.phone_number.includes(testPhone)
                    );
                    console.log("  Contains check:", anyMatch ? "Found" : "Not found");
                }
            } else {
                console.log("  No users in database");
            }
            
            process.exit(0);
        });
    } else {
        console.log("  users.db not found");
        process.exit(0);
    }
} catch (error) {
    console.error("Error checking database:", error.message);
    process.exit(0);
}

// Set timeout to prevent hanging
setTimeout(() => {
    console.error("\nTest timeout!");
    process.exit(1);
}, 5000);
