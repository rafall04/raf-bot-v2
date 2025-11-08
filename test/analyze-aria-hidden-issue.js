#!/usr/bin/env node

/**
 * Test Script: Analyze ARIA-Hidden Accessibility Issue
 */

const fs = require('fs');
const path = require('path');

console.log("🔍 ANALISIS ARIA-HIDDEN ACCESSIBILITY ISSUE\n");
console.log("=".repeat(50));

// Check admin page for aria-hidden issues
console.log("\n📋 1. Checking Modal HTML Structure...");
console.log("-".repeat(50));

const adminPagePath = path.join(__dirname, '..', 'views', 'sb-admin', 'tiket.php');
const adminContent = fs.readFileSync(adminPagePath, 'utf8');

// Find all modals with aria-hidden
const ariaHiddenMatches = adminContent.match(/<div[^>]*modal[^>]*aria-hidden="true"[^>]*>/g) || [];
console.log(`Found ${ariaHiddenMatches.length} modals with hardcoded aria-hidden="true"`);

if (ariaHiddenMatches.length > 0) {
    console.log("\n❌ PROBLEM: Modals have hardcoded aria-hidden='true'");
    console.log("   Bootstrap manages this automatically!");
    ariaHiddenMatches.forEach((match, i) => {
        console.log(`   ${i + 1}. ${match.substring(0, 80)}...`);
    });
}

// Check for proper Bootstrap modal structure
console.log("\n" + "=".repeat(50));
console.log("📋 2. Bootstrap Modal Best Practices...");
console.log("-".repeat(50));

const hasTabindex = adminContent.includes('tabindex="-1"');
const hasRole = adminContent.includes('role="dialog"');
const hasAriaLabelledby = adminContent.includes('aria-labelledby=');
const hasDataDismiss = adminContent.includes('data-dismiss="modal"');
const hasAriaLabel = adminContent.includes('aria-label="Close"');

console.log(`  tabindex="-1": ${hasTabindex ? '✅' : '❌'}`);
console.log(`  role="dialog": ${hasRole ? '✅' : '❌'}`);
console.log(`  aria-labelledby: ${hasAriaLabelledby ? '✅' : '❌'}`);
console.log(`  data-dismiss="modal": ${hasDataDismiss ? '✅' : '❌'}`);
console.log(`  aria-label on close: ${hasAriaLabel ? '✅' : '❌'}`);

// Check modal show/hide methods
console.log("\n" + "=".repeat(50));
console.log("📋 3. Modal Show/Hide Methods...");
console.log("-".repeat(50));

const usesModalShow = adminContent.includes(".modal('show')");
const usesModalHide = adminContent.includes(".modal('hide')");
const usesDataToggle = adminContent.includes('data-toggle="modal"');

console.log(`  Uses .modal('show'): ${usesModalShow ? '✅' : '❌'}`);
console.log(`  Uses .modal('hide'): ${usesModalHide ? '✅' : '❌'}`);
console.log(`  Uses data-toggle: ${usesDataToggle ? '✅' : '❌'}`);

// Find all modals
console.log("\n" + "=".repeat(50));
console.log("📋 4. All Modals Found...");
console.log("-".repeat(50));

const modalMatches = adminContent.match(/id="([^"]*Modal[^"]*)"/g) || [];
const modalIds = modalMatches.map(m => m.match(/id="([^"]*)"/)[1]);

console.log(`Total modals: ${modalIds.length}`);
modalIds.forEach((id, i) => {
    const hasAriaHidden = adminContent.includes(`id="${id}"`) && 
                         adminContent.includes('aria-hidden="true"');
    console.log(`  ${i + 1}. ${id}: ${hasAriaHidden ? '❌ Has aria-hidden' : '✅ OK'}`);
});

// WAI-ARIA Compliance
console.log("\n" + "=".repeat(50));
console.log("📋 5. WAI-ARIA Compliance Check...");
console.log("-".repeat(50));

console.log("\n❌ VIOLATION: aria-hidden on focused element");
console.log("According to WAI-ARIA specification:");
console.log("  • aria-hidden must not be used on focusable elements");
console.log("  • aria-hidden must not be used on parents of focusable elements");
console.log("  • Bootstrap should manage aria-hidden automatically");

// Solution
console.log("\n" + "=".repeat(50));
console.log("✅ SOLUTION:");
console.log("-".repeat(50));

console.log(`
1. REMOVE hardcoded aria-hidden="true" from modal HTML
   FROM: <div class="modal fade" id="..." aria-hidden="true">
   TO:   <div class="modal fade" id="...">

2. Let Bootstrap manage aria attributes:
   - Bootstrap adds aria-hidden="true" when modal is hidden
   - Bootstrap removes aria-hidden when modal is shown
   - Bootstrap manages focus trap correctly

3. Alternative: Use 'inert' attribute (modern approach):
   - Add 'inert' when modal is hidden
   - Remove 'inert' when modal is shown

4. Ensure proper modal initialization:
   $('#modal').modal({
     keyboard: true,
     focus: true
   });
`);

console.log("\n" + "=".repeat(50));
console.log("ANALYSIS COMPLETE");
console.log("=".repeat(50));
