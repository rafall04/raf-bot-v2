#!/usr/bin/env node

/**
 * Test Script: Analyze Photo Field Inconsistency
 */

const fs = require('fs');
const path = require('path');

console.log("🔍 ANALISIS INKONSISTENSI FIELD FOTO\n");
console.log("=".repeat(50));

// 1. Check WhatsApp handler
console.log("\n📋 1. WhatsApp Bot Handler...");
console.log("-".repeat(50));

const teknisiHandlerPath = path.join(__dirname, '..', 'message', 'handlers', 'teknisi-workflow-handler.js');
const teknisiContent = fs.readFileSync(teknisiHandlerPath, 'utf8');

// Find where photos are stored
if (teknisiContent.includes('ticket.teknisiPhotos = ')) {
    console.log("✅ WhatsApp saves to: teknisiPhotos");
    const line = teknisiContent.split('\n').findIndex(l => l.includes('ticket.teknisiPhotos = '));
    console.log(`   Line ${line + 1}: ticket.teknisiPhotos = state.uploadedPhotos`);
} else {
    console.log("❌ teknisiPhotos assignment not found");
}

// 2. Check Web Dashboard routes
console.log("\n" + "=".repeat(50));
console.log("📋 2. Web Dashboard Routes...");
console.log("-".repeat(50));

const ticketsRoutePath = path.join(__dirname, '..', 'routes', 'tickets.js');
const ticketsContent = fs.readFileSync(ticketsRoutePath, 'utf8');

// Check photo upload endpoint
if (ticketsContent.includes('ticket.photos.push(')) {
    console.log("❌ Web saves to: photos (DIFFERENT!)");
    const line = ticketsContent.split('\n').findIndex(l => l.includes('ticket.photos.push('));
    console.log(`   Line ${line + 1}: ticket.photos.push(photoInfo)`);
} else {
    console.log("✅ photos.push not found");
}

// Check if teknisiPhotos is used in web
if (ticketsContent.includes('ticket.teknisiPhotos')) {
    console.log("✅ Web also uses teknisiPhotos somewhere");
} else {
    console.log("❌ Web NEVER uses teknisiPhotos field!");
}

// 3. Check Admin Page
console.log("\n" + "=".repeat(50));
console.log("📋 3. Admin Page (tiket.php)...");
console.log("-".repeat(50));

const adminPagePath = path.join(__dirname, '..', 'views', 'sb-admin', 'tiket.php');
const adminContent = fs.readFileSync(adminPagePath, 'utf8');

// Check which fields admin page checks
const checksTeknisiPhotos = adminContent.includes('ticket.teknisiPhotos');
const checksPhotos = adminContent.includes('ticket.photos') && 
                    !adminContent.includes('// ticket.photos'); // Not commented

console.log(`Checks teknisiPhotos: ${checksTeknisiPhotos ? '✅' : '❌'}`);
console.log(`Checks photos: ${checksPhotos ? '✅' : '❌ MISSING!'}`);

if (checksTeknisiPhotos && !checksPhotos) {
    console.log("\n🚨 PROBLEM: Admin page ONLY checks teknisiPhotos!");
    console.log("   Photos from web (stored in 'photos') are INVISIBLE!");
}

// 4. Check Teknisi Page
console.log("\n" + "=".repeat(50));
console.log("📋 4. Teknisi Page (teknisi-tiket.php)...");
console.log("-".repeat(50));

const teknisiPagePath = path.join(__dirname, '..', 'views', 'sb-admin', 'teknisi-tiket.php');
if (fs.existsSync(teknisiPagePath)) {
    const teknisiPageContent = fs.readFileSync(teknisiPagePath, 'utf8');
    
    const teknisiChecksPhotos = teknisiPageContent.includes('.photos');
    const teknisiChecksTeknisiPhotos = teknisiPageContent.includes('.teknisiPhotos');
    
    console.log(`Checks photos: ${teknisiChecksPhotos ? '✅' : '❌'}`);
    console.log(`Checks teknisiPhotos: ${teknisiChecksTeknisiPhotos ? '✅' : '❌'}`);
}

// 5. Check ticket complete endpoint
console.log("\n" + "=".repeat(50));
console.log("📋 5. Ticket Complete Endpoint...");
console.log("-".repeat(50));

// Check if complete endpoint uses consistent field
const completeMatch = ticketsContent.match(/ticket\.(\w+Photos?) = req\.body\./g);
if (completeMatch) {
    console.log("Fields used in complete:", completeMatch);
}

// Summary
console.log("\n" + "=".repeat(50));
console.log("🔴 INKONSISTENSI DITEMUKAN:");
console.log("-".repeat(50));

const issues = [
    {
        source: "WhatsApp Bot",
        field: "teknisiPhotos",
        format: "Array of filenames"
    },
    {
        source: "Web Dashboard",
        field: "photos",
        format: "Array of objects with path, filename, etc"
    },
    {
        source: "Admin Page",
        checks: "ONLY teknisiPhotos",
        problem: "Cannot see photos from web!"
    }
];

console.log("\nField Usage:");
console.table(issues);

// Recommendations
console.log("\n" + "=".repeat(50));
console.log("✅ RECOMMENDATIONS:");
console.log("-".repeat(50));

console.log(`
1. IMMEDIATE FIX for Admin Page:
   Check BOTH fields: teknisiPhotos AND photos
   
2. LONG-TERM FIX:
   Standardize to ONE field name everywhere
   Recommended: Use 'photos' for all
   
3. MIGRATION:
   Update existing tickets to merge fields
   
4. UPDATE Web Upload:
   Store in teknisiPhotos for consistency
   OR update all pages to check both
`);

console.log("\n" + "=".repeat(50));
console.log("ANALYSIS COMPLETE");
console.log("=".repeat(50));
