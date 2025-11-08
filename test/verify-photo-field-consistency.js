#!/usr/bin/env node

/**
 * Test Script: Verify Photo Field Consistency Fixes
 */

const fs = require('fs');
const path = require('path');

console.log("🧪 VERIFYING PHOTO FIELD CONSISTENCY FIXES\n");
console.log("=".repeat(50));

let allPassed = true;

// Test 1: Admin page checks both fields
console.log("\n📋 Test 1: Admin Page Photo Display...");
console.log("-".repeat(50));

const adminPagePath = path.join(__dirname, '..', 'views', 'sb-admin', 'tiket.php');
const adminContent = fs.readFileSync(adminPagePath, 'utf8');

const checksTeknisiPhotos = adminContent.includes('if (ticket.teknisiPhotos && ticket.teknisiPhotos.length > 0)');
const checksPhotosField = adminContent.includes('if (ticket.photos && ticket.photos.length > 0)');
const checksCompletionPhotos = adminContent.includes('if (ticket.completionPhotos && ticket.completionPhotos.length > 0)');
const mergesAllPhotos = adminContent.includes('let allPhotos = []');

console.log(`  Checks teknisiPhotos: ${checksTeknisiPhotos ? '✅' : '❌'}`);
console.log(`  Checks photos field: ${checksPhotosField ? '✅' : '❌'}`);
console.log(`  Checks completionPhotos: ${checksCompletionPhotos ? '✅' : '❌'}`);
console.log(`  Merges all photos: ${mergesAllPhotos ? '✅' : '❌'}`);

if (!checksPhotosField) {
    console.log("  ❌ Admin page doesn't check photos field!");
    allPassed = false;
}

// Test 2: Web upload stores in both fields
console.log("\n" + "=".repeat(50));
console.log("📋 Test 2: Web Upload Dual Storage...");
console.log("-".repeat(50));

const ticketsRoutePath = path.join(__dirname, '..', 'routes', 'tickets.js');
const ticketsContent = fs.readFileSync(ticketsRoutePath, 'utf8');

const initializesPhotos = ticketsContent.includes('if (!ticket.photos)');
const initializesTeknisiPhotos = ticketsContent.includes('if (!ticket.teknisiPhotos)');
const storesToPhotos = ticketsContent.includes('ticket.photos.push(photoInfo)');
const storesToTeknisiPhotos = ticketsContent.includes('ticket.teknisiPhotos.push(req.file.filename)');
const copiesFile = ticketsContent.includes('fs.copyFileSync(oldPath, newPath)');

console.log(`  Initializes photos array: ${initializesPhotos ? '✅' : '❌'}`);
console.log(`  Initializes teknisiPhotos: ${initializesTeknisiPhotos ? '✅' : '❌'}`);
console.log(`  Stores to photos: ${storesToPhotos ? '✅' : '❌'}`);
console.log(`  Stores to teknisiPhotos: ${storesToTeknisiPhotos ? '✅' : '❌'}`);
console.log(`  Copies file to teknisi folder: ${copiesFile ? '✅' : '❌'}`);

if (!storesToTeknisiPhotos) {
    console.log("  ❌ Web upload doesn't store to teknisiPhotos!");
    allPassed = false;
}

// Test 3: Photo path handling
console.log("\n" + "=".repeat(50));
console.log("📋 Test 3: Photo Path Handling...");
console.log("-".repeat(50));

const handlesWebPath = adminContent.includes('/uploads/tickets/');
const handlesWhatsAppPath = adminContent.includes('/uploads/teknisi/');
const hasErrorHandling = adminContent.includes('onerror=');
const hasFullPathViewer = adminContent.includes('viewPhotoFullPath');

console.log(`  Handles /uploads/tickets/: ${handlesWebPath ? '✅' : '❌'}`);
console.log(`  Handles /uploads/teknisi/: ${handlesWhatsAppPath ? '✅' : '❌'}`);
console.log(`  Has image error handling: ${hasErrorHandling ? '✅' : '❌'}`);
console.log(`  Has full path viewer: ${hasFullPathViewer ? '✅' : '❌'}`);

// Test 4: Object vs String handling
console.log("\n" + "=".repeat(50));
console.log("📋 Test 4: Photo Format Handling...");
console.log("-".repeat(50));

const handlesObjectFormat = adminContent.includes("typeof photo === 'object'");
const handlesStringFormat = adminContent.includes("// If it's a string, treat as filename");
const extractsPath = adminContent.includes('photo.path || `/uploads/tickets/${photo.filename}`');

console.log(`  Handles object format: ${handlesObjectFormat ? '✅' : '❌'}`);
console.log(`  Handles string format: ${handlesStringFormat ? '✅' : '❌'}`);
console.log(`  Extracts path correctly: ${extractsPath ? '✅' : '❌'}`);

// Test 5: Photo counting
console.log("\n" + "=".repeat(50));
console.log("📋 Test 5: Photo Counting...");
console.log("-".repeat(50));

const checksMaxFromBoth = ticketsContent.includes('Math.max(');
const updatesPhotoCount = ticketsContent.includes('ticket.teknisiPhotoCount =');

console.log(`  Checks max from both arrays: ${checksMaxFromBoth ? '✅' : '❌'}`);
console.log(`  Updates photoCount field: ${updatesPhotoCount ? '✅' : '❌'}`);

// Summary
console.log("\n" + "=".repeat(50));
console.log("📊 FIX VERIFICATION SUMMARY:");
console.log("-".repeat(50));

const fixes = {
    "Admin checks both fields": checksTeknisiPhotos && checksPhotosField,
    "Web stores to both fields": storesToPhotos && storesToTeknisiPhotos,
    "Handles all photo paths": handlesWebPath && handlesWhatsAppPath,
    "Handles all formats": handlesObjectFormat && handlesStringFormat,
    "Proper counting": checksMaxFromBoth && updatesPhotoCount
};

Object.entries(fixes).forEach(([test, passed]) => {
    console.log(`  ${passed ? '✅' : '❌'} ${test}`);
    if (!passed) allPassed = false;
});

// Final result
console.log("\n" + "=".repeat(50));
if (allPassed) {
    console.log("✅ ALL FIXES VERIFIED SUCCESSFULLY!");
    console.log("\nPhoto system now:");
    console.log("  • Admin page checks BOTH teknisiPhotos AND photos");
    console.log("  • Web upload stores to BOTH fields");
    console.log("  • Handles all photo formats (object/string)");
    console.log("  • Supports both upload paths");
    console.log("  • Backwards compatible");
    console.log("\n🎯 TICKET 6UAZM8Q PHOTOS SHOULD NOW BE VISIBLE!");
} else {
    console.log("❌ SOME FIXES INCOMPLETE - Review the issues above");
}
console.log("=".repeat(50));

process.exit(allPassed ? 0 : 1);
