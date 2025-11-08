#!/usr/bin/env node

/**
 * Test Script: Verify Admin Ticket Page Fixes
 */

const fs = require('fs');
const path = require('path');

console.log("🧪 VERIFYING ADMIN TICKET PAGE FIXES\n");
console.log("=".repeat(50));

let allPassed = true;

// Test 1: Check updated styles
console.log("\n📋 Test 1: Photo & Workflow Styles...");
console.log("-".repeat(50));

const adminPagePath = path.join(__dirname, '..', 'views', 'sb-admin', 'tiket.php');
const adminContent = fs.readFileSync(adminPagePath, 'utf8');

const requiredStyles = [
    'photo-gallery',
    'photo-thumbnail',
    'photo-count-badge',
    'workflow-progress',
    'workflow-step',
    'badge-status-baru',
    'badge-status-process',
    'badge-status-otw',
    'badge-status-arrived',
    'badge-status-working',
    'badge-status-resolved'
];

requiredStyles.forEach(style => {
    const hasStyle = adminContent.includes(style);
    console.log(`  ${style}: ${hasStyle ? '✅' : '❌'}`);
    if (!hasStyle) allPassed = false;
});

// Test 2: Check status options
console.log("\n" + "=".repeat(50));
console.log("📋 Test 2: Status Filter Options...");
console.log("-".repeat(50));

const requiredStatuses = [
    { value: 'baru', label: 'Baru' },
    { value: 'process', label: 'Process' },
    { value: 'otw', label: 'OTW' },
    { value: 'arrived', label: 'Arrived' },
    { value: 'working', label: 'Working' },
    { value: 'resolved', label: 'Resolved' }
];

requiredStatuses.forEach(status => {
    const hasStatus = adminContent.includes(`value="${status.value}"`);
    console.log(`  ${status.label} (${status.value}): ${hasStatus ? '✅' : '❌'}`);
    if (!hasStatus) allPassed = false;
});

// Test 3: Check JavaScript functions
console.log("\n" + "=".repeat(50));
console.log("📋 Test 3: JavaScript Functions...");
console.log("-".repeat(50));

const requiredFunctions = [
    'getStatusBadgeAdmin',
    'showTicketDetail',
    'updateWorkflowProgress',
    'viewPhoto'
];

requiredFunctions.forEach(func => {
    const hasFunction = adminContent.includes(`function ${func}`);
    console.log(`  ${func}: ${hasFunction ? '✅' : '❌'}`);
    if (!hasFunction) allPassed = false;
});

// Test 4: Check table structure
console.log("\n" + "=".repeat(50));
console.log("📋 Test 4: Table Structure...");
console.log("-".repeat(50));

const tableHeaders = [
    'ID Tiket',
    'Pelanggan (WA)',
    'Detail Pelanggan (Sistem)',
    'Isi Laporan',
    'Foto',
    'Status',
    'Tgl Dibuat',
    'Diproses Oleh',
    'Diselesaikan Oleh',
    'Dibatalkan Oleh',
    'Aksi Admin'
];

let headerCount = 0;
tableHeaders.forEach(header => {
    const hasHeader = adminContent.includes(`<th>${header}</th>`) || 
                     adminContent.includes(`<th style="min-width: 120px;">${header}</th>`);
    if (hasHeader) headerCount++;
});

console.log(`  Table headers: ${headerCount}/${tableHeaders.length} found ${headerCount === tableHeaders.length ? '✅' : '❌'}`);
if (headerCount !== tableHeaders.length) allPassed = false;

// Test 5: Check detail modal
console.log("\n" + "=".repeat(50));
console.log("📋 Test 5: Detail Modal...");
console.log("-".repeat(50));

const modalElements = {
    'Modal container': 'id="ticketDetailModal"',
    'Workflow progress': 'class="workflow-progress"',
    'Photo gallery': 'id="detail-photos"',
    'Ticket ID field': 'id="detail-ticketId"',
    'Status field': 'id="detail-status"',
    'OTP field': 'id="detail-otp"',
    'Teknisi field': 'id="detail-teknisi"'
};

Object.entries(modalElements).forEach(([name, selector]) => {
    const hasElement = adminContent.includes(selector);
    console.log(`  ${name}: ${hasElement ? '✅' : '❌'}`);
    if (!hasElement) allPassed = false;
});

// Test 6: Check photo display logic
console.log("\n" + "=".repeat(50));
console.log("📋 Test 6: Photo Display Logic...");
console.log("-".repeat(50));

const photoLogic = {
    'Check teknisiPhotos': adminContent.includes('ticket.teknisiPhotos'),
    'Photo count display': adminContent.includes('ticket.teknisiPhotos.length'),
    'Photo button': adminContent.includes('fa-camera'),
    'Photo URL path': adminContent.includes('/uploads/teknisi/'),
    'Photo onclick handler': adminContent.includes('onclick=\'showTicketDetail')
};

Object.entries(photoLogic).forEach(([test, passed]) => {
    console.log(`  ${test}: ${passed ? '✅' : '❌'}`);
    if (!passed) allPassed = false;
});

// Test 7: Check badge status mapping
console.log("\n" + "=".repeat(50));
console.log("📋 Test 7: Status Badge Mapping...");
console.log("-".repeat(50));

const statusMapping = [
    "s === 'process' || s === 'diproses teknisi'",
    "badge-status-process",
    "badge-status-otw",
    "badge-status-arrived",
    "badge-status-working",
    "badge-status-resolved"
];

statusMapping.forEach(mapping => {
    const hasMapping = adminContent.includes(mapping);
    console.log(`  ${mapping.substring(0, 30)}...: ${hasMapping ? '✅' : '❌'}`);
    if (!hasMapping) allPassed = false;
});

// Summary
console.log("\n" + "=".repeat(50));
console.log("📊 FIX VERIFICATION SUMMARY:");
console.log("-".repeat(50));

const fixes = {
    "Photo viewing capability": adminContent.includes('photo-gallery'),
    "Workflow visualization": adminContent.includes('workflow-progress'),
    "All status filters": requiredStatuses.every(s => adminContent.includes(`value="${s.value}"`)),
    "Detail modal": adminContent.includes('ticketDetailModal'),
    "OTP display": adminContent.includes('detail-otp'),
    "JavaScript functions": requiredFunctions.every(f => adminContent.includes(`function ${f}`))
};

Object.entries(fixes).forEach(([test, passed]) => {
    console.log(`  ${passed ? '✅' : '❌'} ${test}`);
    if (!passed) allPassed = false;
});

// Final result
console.log("\n" + "=".repeat(50));
if (allPassed) {
    console.log("✅ ALL FIXES VERIFIED SUCCESSFULLY!");
    console.log("\nThe admin ticket page now has:");
    console.log("  • Photo viewing capability with gallery");
    console.log("  • Complete workflow status options");
    console.log("  • Detail modal with all ticket info");
    console.log("  • OTP display for reference");
    console.log("  • Progress visualization");
    console.log("  • Consistent with TICKET_STATUS_STANDARD.md");
} else {
    console.log("❌ SOME FIXES INCOMPLETE - Review the issues above");
}
console.log("=".repeat(50));

process.exit(allPassed ? 0 : 1);
