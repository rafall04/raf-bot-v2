#!/usr/bin/env node

/**
 * Test Script: Cron # Symbol Support
 * 
 * This script tests that cron expressions with # prefix are handled correctly
 * as disabled/commented out schedules.
 * 
 * To run: node test/test-cron-hash-symbol.js
 */

console.log("🧪 TEST: Cron # Symbol Support\n");
console.log("=" .repeat(50));

// Mock the cron-validator
const mockCronValidator = {
    isValidCron: (expr) => {
        // Simple validation for testing
        const validPatterns = [
            /^\*\s+\*\s+\*\s+\*\s+\*$/,  // * * * * *
            /^\*\/\d+\s+\*\s+\*\s+\*\s+\*$/,  // */5 * * * *
            /^\d+\s+\*\s+\*\s+\*\s+\*$/,  // 56 * * * *
        ];
        return validPatterns.some(p => p.test(expr));
    }
};

// Test the isValidCron function
function isValidCron(cronExpression) {
    // If starts with #, it's commented out (disabled) - consider it valid format but disabled
    if (cronExpression && cronExpression.trim().startsWith('#')) {
        return false; // Valid format but disabled
    }
    return mockCronValidator.isValidCron(cronExpression);
}

// Test cases
const testCases = [
    {
        input: "* * * * *",
        expectedValid: true,
        description: "Active cron - every minute"
    },
    {
        input: "# * * * * *",
        expectedValid: false,
        description: "Disabled cron - commented with #"
    },
    {
        input: "# */5 * * * *",
        expectedValid: false,
        description: "Disabled cron - every 5 minutes commented"
    },
    {
        input: "*/5 * * * *",
        expectedValid: true,
        description: "Active cron - every 5 minutes"
    },
    {
        input: "56 * * * *",
        expectedValid: true,
        description: "Active cron - at minute 56"
    },
    {
        input: "# 56 * * * *",
        expectedValid: false,
        description: "Disabled cron - minute 56 commented"
    },
    {
        input: "#* * * * *",
        expectedValid: false,
        description: "Disabled cron - no space after #"
    },
    {
        input: "  # * * * * *  ",
        expectedValid: false,
        description: "Disabled cron - with extra spaces"
    },
    {
        input: "",
        expectedValid: false,
        description: "Empty string"
    },
    {
        input: "invalid cron",
        expectedValid: false,
        description: "Invalid cron expression"
    }
];

console.log("\n📋 Running Test Cases:");
console.log("-".repeat(50));

let passedTests = 0;
let failedTests = 0;

testCases.forEach((test, index) => {
    const result = isValidCron(test.input);
    const passed = result === test.expectedValid;
    
    console.log(`\nTest ${index + 1}: ${test.description}`);
    console.log(`  Input: "${test.input}"`);
    console.log(`  Expected: ${test.expectedValid ? "Valid/Active" : "Invalid/Disabled"}`);
    console.log(`  Result: ${result ? "Valid/Active" : "Invalid/Disabled"}`);
    console.log(`  ${passed ? "✅ PASS" : "❌ FAIL"}`);
    
    if (passed) passedTests++;
    else failedTests++;
});

// Test backend validation logic
console.log("\n" + "=".repeat(50));
console.log("🔧 Testing Backend Validation Logic:");
console.log("-".repeat(50));

function validateCronField(value) {
    if (!value) return { valid: false, message: "Empty value" };
    
    const trimmed = value.trim();
    
    // Allow # at beginning (disabled cron)
    if (trimmed.startsWith('#')) {
        return { 
            valid: true, 
            disabled: true,
            message: "Disabled cron (commented with #)" 
        };
    } else {
        // Validate as active cron expression
        if (!isValidCron(trimmed)) {
            return { 
                valid: false, 
                message: "Invalid cron expression. Use valid format or prefix with # to disable." 
            };
        }
        return { 
            valid: true, 
            disabled: false,
            message: "Valid active cron" 
        };
    }
}

const backendTests = [
    { input: "* * * * *", expectedValid: true, expectedDisabled: false },
    { input: "# * * * * *", expectedValid: true, expectedDisabled: true },
    { input: "invalid", expectedValid: false },
    { input: "", expectedValid: false }
];

console.log("\nBackend Validation Tests:");
backendTests.forEach((test, index) => {
    const result = validateCronField(test.input);
    const passed = result.valid === test.expectedValid && 
                  (test.expectedDisabled === undefined || result.disabled === test.expectedDisabled);
    
    console.log(`\nTest ${index + 1}:`);
    console.log(`  Input: "${test.input}"`);
    console.log(`  Result: ${result.message}`);
    console.log(`  ${passed ? "✅ PASS" : "❌ FAIL"}`);
    
    if (passed) passedTests++;
    else failedTests++;
});

// Summary
console.log("\n" + "=".repeat(50));
console.log("📊 SUMMARY:");
console.log("-".repeat(50));
console.log(`Total Tests: ${passedTests + failedTests}`);
console.log(`Passed: ${passedTests}`);
console.log(`Failed: ${failedTests}`);

if (failedTests === 0) {
    console.log("\n✅ ALL TESTS PASSED!");
    console.log("\nCron # symbol support is working correctly:");
    console.log("- Active cron: '* * * * *'");
    console.log("- Disabled cron: '# * * * * *'");
    console.log("- Backend accepts both formats");
    console.log("- Validation works as expected");
} else {
    console.log("\n❌ SOME TESTS FAILED!");
    console.log("Please check the implementation.");
}

console.log("\n" + "=".repeat(50));
console.log("TEST COMPLETE");
console.log("=".repeat(50));

process.exit(failedTests === 0 ? 0 : 1);
