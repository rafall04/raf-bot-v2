#!/usr/bin/env node

/**
 * Test Script: Analyze Customer Name Field Inconsistency
 */

const fs = require('fs');
const path = require('path');

console.log("🔍 ANALISIS INKONSISTENSI FIELD NAMA PELANGGAN\n");
console.log("=".repeat(50));

// 1. Check how different handlers store customer name
console.log("\n📋 1. Handlers - How They Store Names...");
console.log("-".repeat(50));

const handlers = [
    'smart-report-handler.js',
    'smart-report-text-menu.js',
    'smart-report-hybrid.js',
    'ticket-creation-handler.js',
    'states/report-state-handler.js'
];

const nameFields = new Map();

handlers.forEach(handler => {
    const handlerPath = path.join(__dirname, '..', 'message', 'handlers', handler);
    if (fs.existsSync(handlerPath)) {
        const content = fs.readFileSync(handlerPath, 'utf8');
        
        // Check what name fields are used
        const fields = [];
        if (content.includes('pelangganName:')) fields.push('pelangganName');
        if (content.includes('pelangganPushName:')) fields.push('pelangganPushName');
        if (content.includes('pelangganDataSystem')) fields.push('pelangganDataSystem.name');
        
        if (fields.length > 0) {
            nameFields.set(handler, fields);
            console.log(`${handler}:`);
            fields.forEach(field => console.log(`  - ${field}`));
        }
    }
});

// 2. Check Admin Page
console.log("\n" + "=".repeat(50));
console.log("📋 2. Admin Page (tiket.php) - What It Checks...");
console.log("-".repeat(50));

const adminPagePath = path.join(__dirname, '..', 'views', 'sb-admin', 'tiket.php');
const adminContent = fs.readFileSync(adminPagePath, 'utf8');

const checksForFields = {
    'pelangganPushName': adminContent.includes('ticket.pelangganPushName'),
    'pelangganName': adminContent.includes('ticket.pelangganName') && !adminContent.includes('// ticket.pelangganName'),
    'pelangganDataSystem.name': adminContent.includes('pelangganDataSystem.name') || adminContent.includes('pelangganDataSystem?.name')
};

Object.entries(checksForFields).forEach(([field, checks]) => {
    console.log(`  ${field}: ${checks ? '✅ Checked' : '❌ NOT checked'}`);
});

// 3. Check Teknisi Page
console.log("\n" + "=".repeat(50));
console.log("📋 3. Teknisi Page - How It Shows Names...");
console.log("-".repeat(50));

const teknisiPagePath = path.join(__dirname, '..', 'views', 'sb-admin', 'teknisi-tiket.php');
if (fs.existsSync(teknisiPagePath)) {
    const teknisiContent = fs.readFileSync(teknisiPagePath, 'utf8');
    
    const teknisiChecks = {
        'pelangganPushName': teknisiContent.includes('.pelangganPushName'),
        'pelangganName': teknisiContent.includes('.pelangganName'),
        'pelangganDataSystem': teknisiContent.includes('.pelangganDataSystem')
    };
    
    Object.entries(teknisiChecks).forEach(([field, checks]) => {
        console.log(`  ${field}: ${checks ? '✅' : '❌'}`);
    });
}

// 4. Check utility-handler (reference implementation)
console.log("\n" + "=".repeat(50));
console.log("📋 4. Reference Implementation (utility-handler)...");
console.log("-".repeat(50));

const utilityPath = path.join(__dirname, '..', 'message', 'handlers', 'utility-handler.js');
if (fs.existsSync(utilityPath)) {
    const utilityContent = fs.readFileSync(utilityPath, 'utf8');
    
    // Find the smart name resolution
    const match = utilityContent.match(/namaPelanggan = ([^;]+);/);
    if (match) {
        console.log("Smart resolution found:");
        console.log(`  ${match[1]}`);
        console.log("\nThis checks in order:");
        console.log("  1. pelangganName");
        console.log("  2. pelangganPushName");
        console.log("  3. pelangganDataSystem.name");
    }
}

// 5. Check specific ticket creation
console.log("\n" + "=".repeat(50));
console.log("📋 5. Smart Report Handler (Line 758)...");
console.log("-".repeat(50));

const smartReportPath = path.join(__dirname, '..', 'message', 'handlers', 'smart-report-handler.js');
if (fs.existsSync(smartReportPath)) {
    const lines = fs.readFileSync(smartReportPath, 'utf8').split('\n');
    const line758 = lines[757]; // 0-indexed
    if (line758 && line758.includes('pelangganName')) {
        console.log("Line 758 creates ticket with:");
        console.log(`  ${line758.trim()}`);
        console.log("\nIf state.targetUser.name is undefined:");
        console.log("  pelangganName will be undefined");
        console.log("  Admin page shows '-' because it only checks pelangganPushName!");
    }
}

// Summary
console.log("\n" + "=".repeat(50));
console.log("🔴 INKONSISTENSI DITEMUKAN:");
console.log("-".repeat(50));

console.log("\n1. DIFFERENT HANDLERS USE DIFFERENT FIELDS:");
nameFields.forEach((fields, handler) => {
    console.log(`   ${handler}: ${fields.join(', ')}`);
});

console.log("\n2. ADMIN PAGE PROBLEM:");
console.log("   ❌ ONLY checks: pelangganPushName");
console.log("   ❌ NEVER checks: pelangganName");
console.log("   ❌ Result: Shows '-' for tickets with pelangganName!");

console.log("\n3. SMART SOLUTION (from utility-handler):");
console.log("   Check ALL fields in order:");
console.log("   pelangganName || pelangganPushName || pelangganDataSystem?.name || 'N/A'");

// Recommendations
console.log("\n" + "=".repeat(50));
console.log("✅ RECOMMENDATIONS:");
console.log("-".repeat(50));

console.log(`
1. IMMEDIATE FIX for Admin Page:
   Update line 458 and 630 to check ALL name fields:
   pelangganName || pelangganPushName || pelangganDataSystem?.name || '-'
   
2. PATTERN TO USE:
   const customerName = ticket.pelangganName || 
                       ticket.pelangganPushName || 
                       (ticket.pelangganDataSystem?.name) || 
                       'Customer';
   
3. LONG-TERM:
   Standardize to ONE primary field (pelangganName)
   Keep others for backward compatibility
`);

console.log("\n" + "=".repeat(50));
console.log("ANALYSIS COMPLETE");
console.log("=".repeat(50));
