#!/usr/bin/env node

/**
 * Test Script: Analyze Create Ticket Inconsistency Between WhatsApp Bot and Admin
 */

const fs = require('fs');
const path = require('path');

console.log("🔍 ANALISIS INKONSISTENSI CREATE TICKET\n");
console.log("=".repeat(50));

// 1. Analyze WhatsApp bot ticket structure
console.log("\n📋 1. WhatsApp Bot Ticket Structure...");
console.log("-".repeat(50));

console.log("Fields from smart-report handlers:");
const whatsappFields = [
    'ticketId',
    'pelangganUserId',
    'pelangganId (sender JID)',
    'pelangganName',
    'pelangganPhone',
    'pelangganAddress',
    'pelangganSubscription',
    'laporanText',
    'status (baru)',
    'priority (HIGH/MEDIUM/LOW)',
    'createdAt (ISO string)',
    'deviceOnline (boolean)',
    'issueType (MATI/LEMOT/etc)',
    'troubleshootingDone',
    'photos/photoCount',
    'estimatedTime',
    'targetTime'
];

whatsappFields.forEach((field, i) => {
    console.log(`  ${i + 1}. ${field}`);
});

// 2. Analyze admin create ticket structure
console.log("\n" + "=".repeat(50));
console.log("📋 2. Admin Create Ticket Structure (CURRENT)...");
console.log("-".repeat(50));

console.log("Fields from routes/tickets.js:");
const adminFields = [
    'id (ticketId)',
    'user_id',
    'description',
    'status (baru)',
    'created_at',
    'created_by',
    'created_by_admin (true)'
];

adminFields.forEach((field, i) => {
    console.log(`  ${i + 1}. ${field}`);
});

// 3. Missing fields analysis
console.log("\n" + "=".repeat(50));
console.log("📋 3. MISSING FIELDS IN ADMIN CREATE...");
console.log("-".repeat(50));

const missingInAdmin = [
    'pelangganName ❌',
    'pelangganPhone ❌',
    'pelangganAddress ❌',
    'pelangganSubscription ❌',
    'priority ❌',
    'issueType ❌',
    'deviceOnline ❌',
    'troubleshootingDone ❌',
    'estimatedTime ❌',
    'Consistent field naming ❌'
];

console.log("Admin is missing:");
missingInAdmin.forEach(field => {
    console.log(`  - ${field}`);
});

// 4. Field naming inconsistency
console.log("\n" + "=".repeat(50));
console.log("📋 4. FIELD NAMING INCONSISTENCY...");
console.log("-".repeat(50));

const namingIssues = {
    "WhatsApp": {
        "Ticket ID": "ticketId",
        "User ID": "pelangganUserId",
        "Description": "laporanText",
        "Timestamp": "createdAt"
    },
    "Admin": {
        "Ticket ID": "id",
        "User ID": "user_id",
        "Description": "description",
        "Timestamp": "created_at"
    }
};

console.table(namingIssues);

// 5. Notification differences
console.log("\n" + "=".repeat(50));
console.log("📋 5. NOTIFICATION DIFFERENCES...");
console.log("-".repeat(50));

console.log("\nWhatsApp Bot:");
console.log("  ✅ Sends to ALL teknisi");
console.log("  ✅ Includes priority icon (🚨/📢)");
console.log("  ✅ Shows full customer info");
console.log("  ✅ Shows device status");
console.log("  ✅ Includes action commands");
console.log("  ✅ Sends photos if available");

console.log("\nAdmin Create:");
console.log("  ❌ Only sends to customer");
console.log("  ❌ No notification to teknisi");
console.log("  ❌ No priority indication");
console.log("  ❌ No device status");
console.log("  ❌ No workflow guidance");

// 6. Teknisi page status
console.log("\n" + "=".repeat(50));
console.log("📋 6. TEKNISI PAGE STATUS...");
console.log("-".repeat(50));

const teknisiPagePath = path.join(__dirname, '..', 'views', 'sb-admin', 'teknisi-tiket.php');
const teknisiContent = fs.readFileSync(teknisiPagePath, 'utf8');

const hasCreateButton = teknisiContent.includes('Buat Tiket') || teknisiContent.includes('createTicket');
const hasCreateModal = teknisiContent.includes('createTicketModal');

console.log(`  Has create button: ${hasCreateButton ? '✅' : '❌ MISSING'}`);
console.log(`  Has create modal: ${hasCreateModal ? '✅' : '❌ MISSING'}`);
console.log("\n  ⚠️ Teknisi CANNOT create tickets from dashboard!");

// Summary
console.log("\n" + "=".repeat(50));
console.log("🔴 PROBLEMS FOUND:");
console.log("-".repeat(50));

const problems = [
    "1. Admin create uses DIFFERENT field structure",
    "2. Admin create MISSING critical fields (priority, phone, etc)",
    "3. Admin create doesn't notify teknisi",
    "4. Field names INCONSISTENT (id vs ticketId)",
    "5. Teknisi page has NO create ticket feature",
    "6. No device status checking",
    "7. No issue type selection",
    "8. No priority selection"
];

problems.forEach(problem => {
    console.log(`  ${problem}`);
});

// Recommendations
console.log("\n" + "=".repeat(50));
console.log("✅ RECOMMENDATIONS:");
console.log("-".repeat(50));

console.log(`
1. STANDARDIZE ticket structure:
   - Use SAME fields as WhatsApp bot
   - ticketId, pelangganName, pelangganPhone, etc.
   - Include priority, issueType, deviceStatus

2. UPDATE Admin Create Modal:
   - Add priority selection
   - Add issue type selection
   - Auto-fill customer info
   - Show device status if available

3. ADD Teknisi Create Feature:
   - Copy modal from admin page
   - Allow teknisi to create tickets
   - Same structure as WhatsApp

4. NOTIFY Teknisi:
   - When admin creates ticket
   - When teknisi creates ticket
   - Use same format as WhatsApp bot

5. CONSISTENT Field Names:
   - Always use: ticketId (not id)
   - Always use: pelangganName (not just name)
   - Always use: laporanText (not description)
`);

console.log("\n" + "=".repeat(50));
console.log("ANALYSIS COMPLETE");
console.log("=".repeat(50));
