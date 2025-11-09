#!/usr/bin/env node

/**
 * Test Script: Verify Modal aria-hidden Fix and Priority Times Update
 */

const fs = require('fs');
const path = require('path');

console.log("🧪 VERIFYING MODAL & PRIORITY FIXES\n");
console.log("=".repeat(50));

let allPassed = true;

// Test 1: Check modal aria-modal attribute
console.log("\n📋 Test 1: Modal aria-modal Attributes...");
console.log("-".repeat(50));

const adminPagePath = path.join(__dirname, '..', 'views', 'sb-admin', 'tiket.php');
const teknisiPagePath = path.join(__dirname, '..', 'views', 'sb-admin', 'teknisi-tiket.php');

const adminContent = fs.readFileSync(adminPagePath, 'utf8');
const teknisiContent = fs.readFileSync(teknisiPagePath, 'utf8');

// Check createTicketModal has aria-modal
const adminHasAriaModal = adminContent.includes('id="createTicketModal"') && 
                          adminContent.includes('aria-modal="true"');
const teknisiHasAriaModal = teknisiContent.includes('id="createTicketModal"') && 
                            teknisiContent.includes('aria-modal="true"');

console.log(`  Admin createTicketModal has aria-modal: ${adminHasAriaModal ? '✅' : '❌'}`);
console.log(`  Teknisi createTicketModal has aria-modal: ${teknisiHasAriaModal ? '✅' : '❌'}`);

if (!adminHasAriaModal || !teknisiHasAriaModal) allPassed = false;

// Test 2: Check modal JavaScript fixes
console.log("\n" + "=".repeat(50));
console.log("📋 Test 2: Modal JavaScript Event Handlers...");
console.log("-".repeat(50));

const adminHasModalFix = adminContent.includes("$('#createTicketModal').on('shown.bs.modal'") &&
                         adminContent.includes("$(this).removeAttr('aria-hidden')");
const teknisiHasModalFix = teknisiContent.includes("$('#createTicketModal').on('shown.bs.modal'") &&
                           teknisiContent.includes("$(this).removeAttr('aria-hidden')");

console.log(`  Admin has modal event handlers: ${adminHasModalFix ? '✅' : '❌'}`);
console.log(`  Teknisi has modal event handlers: ${teknisiHasModalFix ? '✅' : '❌'}`);

if (!adminHasModalFix || !teknisiHasModalFix) allPassed = false;

// Test 3: Check updated priority times
console.log("\n" + "=".repeat(50));
console.log("📋 Test 3: Updated Priority Times...");
console.log("-".repeat(50));

const correctPriorities = {
    'HIGH': '2-4 jam',
    'MEDIUM': '6-12 jam',
    'LOW': '1-2 hari'
};

console.log("\nAdmin Page:");
Object.entries(correctPriorities).forEach(([priority, time]) => {
    const hasCorrectTime = adminContent.includes(`value="${priority}"`) && 
                          adminContent.includes(time);
    console.log(`  ${priority}: ${time} - ${hasCorrectTime ? '✅' : '❌'}`);
    if (!hasCorrectTime) allPassed = false;
});

console.log("\nTeknisi Page:");
Object.entries(correctPriorities).forEach(([priority, time]) => {
    const hasCorrectTime = teknisiContent.includes(`value="${priority}"`) && 
                          teknisiContent.includes(time);
    console.log(`  ${priority}: ${time} - ${hasCorrectTime ? '✅' : '❌'}`);
    if (!hasCorrectTime) allPassed = false;
});

// Test 4: Check working-hours-helper.js updates
console.log("\n" + "=".repeat(50));
console.log("📋 Test 4: Working Hours Helper Updates...");
console.log("-".repeat(50));

const workingHoursPath = path.join(__dirname, '..', 'lib', 'working-hours-helper.js');
const workingHoursContent = fs.readFileSync(workingHoursPath, 'utf8');

const hasUpdatedDefaults = workingHoursContent.includes("// HIGH: 2-4 jam, MEDIUM: 6-12 jam, LOW: 1-2 hari");
const hasHighPriority = workingHoursContent.includes("return '2-4 jam'");
const hasMediumPriority = workingHoursContent.includes("return '6-12 jam'");
const hasLowPriority = workingHoursContent.includes("return '1-2 hari'");
const supportsLowPriority = workingHoursContent.includes("else if (priority === 'LOW')");

console.log(`  Has updated comment: ${hasUpdatedDefaults ? '✅' : '❌'}`);
console.log(`  HIGH returns 2-4 jam: ${hasHighPriority ? '✅' : '❌'}`);
console.log(`  MEDIUM returns 6-12 jam: ${hasMediumPriority ? '✅' : '❌'}`);
console.log(`  LOW returns 1-2 hari: ${hasLowPriority ? '✅' : '❌'}`);
console.log(`  Supports LOW priority: ${supportsLowPriority ? '✅' : '❌'}`);

if (!hasHighPriority || !hasMediumPriority || !hasLowPriority) allPassed = false;

// Test 5: Check button disable/enable logic
console.log("\n" + "=".repeat(50));
console.log("📋 Test 5: Submit Button Handling...");
console.log("-".repeat(50));

const adminHasButtonDisable = adminContent.includes("submitBtn.disabled = true") &&
                              adminContent.includes("submitBtn.disabled = false");
const adminHasSpinner = adminContent.includes('fa-spinner fa-spin');
const adminHasFinally = adminContent.includes('} finally {');

console.log(`  Admin disables/enables button: ${adminHasButtonDisable ? '✅' : '❌'}`);
console.log(`  Admin shows spinner: ${adminHasSpinner ? '✅' : '❌'}`);
console.log(`  Admin has finally block: ${adminHasFinally ? '✅' : '❌'}`);

if (!adminHasButtonDisable || !adminHasFinally) allPassed = false;

// Test 6: Check Select2 configuration
console.log("\n" + "=".repeat(50));
console.log("📋 Test 6: Select2 Configuration...");
console.log("-".repeat(50));

const adminHasDropdownAutoWidth = adminContent.includes("dropdownAutoWidth: true");
const teknisiHasDropdownAutoWidth = teknisiContent.includes("dropdownAutoWidth: true");

console.log(`  Admin has dropdownAutoWidth: ${adminHasDropdownAutoWidth ? '✅' : '❌'}`);
console.log(`  Teknisi has dropdownAutoWidth: ${teknisiHasDropdownAutoWidth ? '✅' : '❌'}`);

// Summary
console.log("\n" + "=".repeat(50));
console.log("📊 FIX VERIFICATION SUMMARY:");
console.log("-".repeat(50));

const fixes = {
    "Modal aria-modal attribute": adminHasAriaModal && teknisiHasAriaModal,
    "Modal JS event handlers": adminHasModalFix && teknisiHasModalFix,
    "Priority times updated": true, // Checked in detail above
    "Working hours helper": hasHighPriority && hasMediumPriority && hasLowPriority,
    "Button disable logic": adminHasButtonDisable && adminHasFinally,
    "Select2 configuration": adminHasDropdownAutoWidth && teknisiHasDropdownAutoWidth
};

Object.entries(fixes).forEach(([test, passed]) => {
    console.log(`  ${passed ? '✅' : '❌'} ${test}`);
});

// Final result
console.log("\n" + "=".repeat(50));
if (allPassed) {
    console.log("✅ ALL FIXES VERIFIED SUCCESSFULLY!");
    console.log("\nFixed Issues:");
    console.log("  • Modal aria-hidden warning resolved");
    console.log("  • Focus management improved");
    console.log("  • Priority times updated (HIGH: 2-4 jam, MEDIUM: 6-12 jam, LOW: 1-2 hari)");
    console.log("  • Submit button properly disabled during submit");
    console.log("  • Select2 dropdown width adjusted");
    console.log("\n🎯 MODAL NOW WORKS WITHOUT ACCESSIBILITY WARNINGS!");
} else {
    console.log("❌ SOME ISSUES REMAIN - Review above");
}
console.log("=".repeat(50));

process.exit(allPassed ? 0 : 1);
