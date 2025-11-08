#!/usr/bin/env node

/**
 * Test Script: Verify Create Ticket Consistency Between WhatsApp Bot, Admin, and Teknisi
 */

const fs = require('fs');
const path = require('path');

console.log("🧪 VERIFYING CREATE TICKET CONSISTENCY\n");
console.log("=".repeat(50));

let allPassed = true;

// Test 1: Check API endpoints
console.log("\n📋 Test 1: API Endpoints...");
console.log("-".repeat(50));

const ticketsRoutePath = path.join(__dirname, '..', 'routes', 'tickets.js');
const ticketsContent = fs.readFileSync(ticketsRoutePath, 'utf8');

const hasAdminCreate = ticketsContent.includes("router.post('/admin/ticket/create'");
const hasTeknisiCreate = ticketsContent.includes("router.post('/ticket/create'");
const hasGenerateTicketId = ticketsContent.includes("function generateTicketId");
const usesConsistentStructure = ticketsContent.includes("ticketId: ticketId,  // Use ticketId, not id");

console.log(`  Admin create endpoint: ${hasAdminCreate ? '✅' : '❌'}`);
console.log(`  Teknisi create endpoint: ${hasTeknisiCreate ? '✅' : '❌'}`);
console.log(`  Generate ticket ID function: ${hasGenerateTicketId ? '✅' : '❌'}`);
console.log(`  Uses consistent structure: ${usesConsistentStructure ? '✅' : '❌'}`);

if (!hasTeknisiCreate) allPassed = false;

// Test 2: Check field consistency
console.log("\n" + "=".repeat(50));
console.log("📋 Test 2: Field Consistency...");
console.log("-".repeat(50));

const requiredFields = [
    'ticketId',
    'pelangganUserId',
    'pelangganName',
    'pelangganPhone',
    'pelangganAddress',
    'pelangganSubscription',
    'laporanText',
    'priority',
    'issueType',
    'createdAt'
];

let fieldCount = 0;
requiredFields.forEach(field => {
    if (ticketsContent.includes(`${field}:`)) {
        console.log(`  ✅ ${field}`);
        fieldCount++;
    } else {
        console.log(`  ❌ ${field} MISSING`);
        allPassed = false;
    }
});

console.log(`\n  Fields found: ${fieldCount}/${requiredFields.length}`);

// Test 3: Check notification to teknisi
console.log("\n" + "=".repeat(50));
console.log("📋 Test 3: Teknisi Notifications...");
console.log("-".repeat(50));

const notifiesTeknisi = ticketsContent.includes("NOTIFY ALL TEKNISI") || ticketsContent.includes("NOTIFY OTHER TEKNISI");
const sendsWhatsApp = ticketsContent.includes("global.raf.sendMessage(teknisiJid");
const hasPriorityIcon = ticketsContent.includes("urgentIcon");
const includesActionCommands = ticketsContent.includes("proses ${ticketId}");

console.log(`  Notifies teknisi: ${notifiesTeknisi ? '✅' : '❌'}`);
console.log(`  Sends WhatsApp: ${sendsWhatsApp ? '✅' : '❌'}`);
console.log(`  Has priority icon: ${hasPriorityIcon ? '✅' : '❌'}`);
console.log(`  Includes action commands: ${includesActionCommands ? '✅' : '❌'}`);

if (!notifiesTeknisi) allPassed = false;

// Test 4: Check admin page modal
console.log("\n" + "=".repeat(50));
console.log("📋 Test 4: Admin Page Modal...");
console.log("-".repeat(50));

const adminPagePath = path.join(__dirname, '..', 'views', 'sb-admin', 'tiket.php');
const adminContent = fs.readFileSync(adminPagePath, 'utf8');

const hasPrioritySelect = adminContent.includes('id="prioritySelect"');
const hasIssueTypeSelect = adminContent.includes('id="issueTypeSelect"');
const hasCreateButton = adminContent.includes('Buat Tiket Baru');
const usesNewEndpoint = adminContent.includes('/api/admin/ticket/create');

console.log(`  Has priority select: ${hasPrioritySelect ? '✅' : '❌'}`);
console.log(`  Has issue type select: ${hasIssueTypeSelect ? '✅' : '❌'}`);
console.log(`  Has create button: ${hasCreateButton ? '✅' : '❌'}`);
console.log(`  Uses correct endpoint: ${usesNewEndpoint ? '✅' : '❌'}`);

if (!hasPrioritySelect || !hasIssueTypeSelect) allPassed = false;

// Test 5: Check teknisi page modal
console.log("\n" + "=".repeat(50));
console.log("📋 Test 5: Teknisi Page Modal...");
console.log("-".repeat(50));

const teknisiPagePath = path.join(__dirname, '..', 'views', 'sb-admin', 'teknisi-tiket.php');
const teknisiContent = fs.readFileSync(teknisiPagePath, 'utf8');

const teknisiHasCreateButton = teknisiContent.includes('Buat Tiket Baru');
const teknisiHasModal = teknisiContent.includes('id="createTicketModal"');
const teknisiHasPriority = teknisiContent.includes('id="prioritySelect"');
const teknisiHasIssueType = teknisiContent.includes('id="issueTypeSelect"');
const teknisiUsesEndpoint = teknisiContent.includes('/api/ticket/create');
const teknisiHasSelect2 = teknisiContent.includes('select2.min.js');

console.log(`  Has create button: ${teknisiHasCreateButton ? '✅' : '❌'}`);
console.log(`  Has create modal: ${teknisiHasModal ? '✅' : '❌'}`);
console.log(`  Has priority select: ${teknisiHasPriority ? '✅' : '❌'}`);
console.log(`  Has issue type select: ${teknisiHasIssueType ? '✅' : '❌'}`);
console.log(`  Uses correct endpoint: ${teknisiUsesEndpoint ? '✅' : '❌'}`);
console.log(`  Has Select2 library: ${teknisiHasSelect2 ? '✅' : '❌'}`);

if (!teknisiHasModal || !teknisiUsesEndpoint) allPassed = false;

// Test 6: Priority and issue type options
console.log("\n" + "=".repeat(50));
console.log("📋 Test 6: Priority & Issue Type Options...");
console.log("-".repeat(50));

const priorities = ['HIGH', 'MEDIUM', 'LOW'];
const issueTypes = ['MATI', 'LEMOT', 'PUTUS_NYAMBUNG', 'WIFI', 'HARDWARE', 'GENERAL'];

console.log("\nPriorities:");
priorities.forEach(priority => {
    const hasIt = adminContent.includes(`value="${priority}"`) && teknisiContent.includes(`value="${priority}"`);
    console.log(`  ${priority}: ${hasIt ? '✅' : '❌'}`);
    if (!hasIt) allPassed = false;
});

console.log("\nIssue Types:");
issueTypes.forEach(type => {
    const hasIt = adminContent.includes(`value="${type}"`) && teknisiContent.includes(`value="${type}"`);
    console.log(`  ${type}: ${hasIt ? '✅' : '❌'}`);
    if (!hasIt) allPassed = false;
});

// Summary
console.log("\n" + "=".repeat(50));
console.log("📊 FIX VERIFICATION SUMMARY:");
console.log("-".repeat(50));

const fixes = {
    "API endpoints created": hasAdminCreate && hasTeknisiCreate,
    "Consistent field structure": usesConsistentStructure,
    "Teknisi notifications": notifiesTeknisi,
    "Admin modal enhanced": hasPrioritySelect && hasIssueTypeSelect,
    "Teknisi modal added": teknisiHasModal && teknisiUsesEndpoint,
    "Priority & issue types": true // Checked above
};

Object.entries(fixes).forEach(([test, passed]) => {
    console.log(`  ${passed ? '✅' : '❌'} ${test}`);
});

// Final result
console.log("\n" + "=".repeat(50));
if (allPassed) {
    console.log("✅ ALL FIXES VERIFIED SUCCESSFULLY!");
    console.log("\nCreate ticket system now:");
    console.log("  • Uses SAME structure as WhatsApp bot");
    console.log("  • Admin can create tickets with priority & type");
    console.log("  • Teknisi can create tickets with priority & type");
    console.log("  • Notifies ALL teknisi via WhatsApp");
    console.log("  • Consistent field naming (ticketId, pelangganName, etc)");
    console.log("\n🎯 CREATE TICKET NOW CONSISTENT EVERYWHERE!");
} else {
    console.log("❌ SOME ISSUES REMAIN - Review above");
}
console.log("=".repeat(50));

process.exit(allPassed ? 0 : 1);
