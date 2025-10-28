/**
 * Test Script untuk Command dan Message System
 * Menguji fungsionalitas command manager dan message manager
 */

const commandManager = require('../lib/command-manager');
const messageManager = require('../lib/message-manager');
const MessageHelper = require('../lib/message-helper');

console.log('=== TESTING COMMAND AND MESSAGE SYSTEM ===\n');

// Test 1: Command Detection
console.log('1. TESTING COMMAND DETECTION:');
console.log('----------------------------------------');

const testCommands = [
    { message: 'menu', expectedIntent: 'MENU_UTAMA', role: 'customer' },
    { message: 'menupelanggan', expectedIntent: 'MENU_PELANGGAN', role: 'customer' },
    { message: 'lapor', expectedIntent: 'LAPOR_GANGGUAN', role: 'customer' },
    { message: 'cek wifi', expectedIntent: 'CEK_WIFI', role: 'customer' },
    { message: 'ganti nama wifi', expectedIntent: 'GANTI_NAMA_WIFI', role: 'customer' },
    { message: 'ganti password wifi', expectedIntent: 'GANTI_SANDI_WIFI', role: 'customer' },
    { message: 'history wifi', expectedIntent: 'HISTORY_WIFI', role: 'customer' },
    { message: 'speedboost', expectedIntent: 'REQUEST_SPEED_BOOST', role: 'customer' },
    { message: 'statusppp', expectedIntent: 'STATUS_PPP', role: 'teknisi' },
    { message: 'alluser', expectedIntent: 'ALL_USER', role: 'admin' }
];

let passedTests = 0;
let failedTests = 0;

testCommands.forEach(test => {
    const result = commandManager.getIntent(test.message, test.role);
    const passed = result && result.intent === test.expectedIntent;
    
    console.log(`Test: "${test.message}" (${test.role})`);
    console.log(`  Expected: ${test.expectedIntent}`);
    console.log(`  Got: ${result ? result.intent : 'null'}`);
    console.log(`  Status: ${passed ? '✅ PASSED' : '❌ FAILED'}`);
    console.log('');
    
    if (passed) passedTests++;
    else failedTests++;
});

console.log(`Command Detection Results: ${passedTests} passed, ${failedTests} failed\n`);

// Test 2: Permission Checking
console.log('2. TESTING PERMISSION CHECKING:');
console.log('----------------------------------------');

const permissionTests = [
    { command: 'menu', role: 'customer', shouldAllow: true },
    { command: 'statusppp', role: 'customer', shouldAllow: false },
    { command: 'statusppp', role: 'teknisi', shouldAllow: true },
    { command: 'alluser', role: 'customer', shouldAllow: false },
    { command: 'alluser', role: 'admin', shouldAllow: true }
];

let permPassedTests = 0;
let permFailedTests = 0;

permissionTests.forEach(test => {
    const result = commandManager.getIntent(test.command, test.role);
    const allowed = result !== null;
    const passed = allowed === test.shouldAllow;
    
    console.log(`Test: "${test.command}" for ${test.role}`);
    console.log(`  Should Allow: ${test.shouldAllow}`);
    console.log(`  Actually Allowed: ${allowed}`);
    console.log(`  Status: ${passed ? '✅ PASSED' : '❌ FAILED'}`);
    console.log('');
    
    if (passed) permPassedTests++;
    else permFailedTests++;
});

console.log(`Permission Results: ${permPassedTests} passed, ${permFailedTests} failed\n`);

// Test 3: Message Templates
console.log('3. TESTING MESSAGE TEMPLATES:');
console.log('----------------------------------------');

const messageTests = [
    {
        path: 'general.welcome',
        variables: { botName: 'RAF Bot' },
        shouldContain: 'RAF Bot'
    },
    {
        path: 'customer.notRegistered',
        variables: { adminNumber: '628123456789' },
        shouldContain: '628123456789'
    },
    {
        path: 'wifi.nameChangeSuccess',
        variables: { oldName: 'WiFi_Lama', newName: 'WiFi_Baru' },
        shouldContain: 'WiFi_Baru'
    },
    {
        path: 'ticket.createSuccess',
        variables: { ticketId: 'TKT123', name: 'John Doe' },
        shouldContain: 'TKT123'
    }
];

let msgPassedTests = 0;
let msgFailedTests = 0;

messageTests.forEach(test => {
    const message = messageManager.getMessage(test.path, test.variables);
    const passed = message && message.includes(test.shouldContain);
    
    console.log(`Test: "${test.path}"`);
    console.log(`  Variables: ${JSON.stringify(test.variables)}`);
    console.log(`  Should Contain: "${test.shouldContain}"`);
    console.log(`  Result: ${message ? (message.length > 50 ? message.substring(0, 50) + '...' : message) : 'null'}`);
    console.log(`  Status: ${passed ? '✅ PASSED' : '❌ FAILED'}`);
    console.log('');
    
    if (passed) msgPassedTests++;
    else msgFailedTests++;
});

console.log(`Message Template Results: ${msgPassedTests} passed, ${msgFailedTests} failed\n`);

// Test 4: Message Helper Functions
console.log('4. TESTING MESSAGE HELPER FUNCTIONS:');
console.log('----------------------------------------');

const helperTests = [
    {
        name: 'Format Currency',
        test: () => MessageHelper.formatCurrency(100000),
        expected: '100.000'
    },
    {
        name: 'Format Date',
        test: () => {
            const date = new Date('2024-01-15');
            return MessageHelper.formatDate(date);
        },
        expected: '15/01/2024'
    },
    {
        name: 'Get Bill Info',
        test: () => {
            const user = {
                name: 'John Doe',
                subscription: 'Paket 10Mbps',
                bill_amount: 150000,
                due_date: '2024-01-15',
                paid: false
            };
            const result = MessageHelper.getBillInfo(user);
            return result ? 'Generated' : 'Failed';
        },
        expected: 'Generated'
    },
    {
        name: 'Get WiFi Info',
        test: () => {
            const wifiData = {
                ssid: 'MyWiFi',
                password: 'password123',
                status: 'Aktif'
            };
            const result = MessageHelper.getWifiInfo(wifiData);
            return result && result.includes('MyWiFi') ? 'Contains SSID' : 'Missing SSID';
        },
        expected: 'Contains SSID'
    }
];

let helperPassedTests = 0;
let helperFailedTests = 0;

helperTests.forEach(test => {
    try {
        const result = test.test();
        const passed = result && result.toString().includes(test.expected);
        
        console.log(`Test: ${test.name}`);
        console.log(`  Expected: ${test.expected}`);
        console.log(`  Got: ${result}`);
        console.log(`  Status: ${passed ? '✅ PASSED' : '❌ FAILED'}`);
        console.log('');
        
        if (passed) helperPassedTests++;
        else helperFailedTests++;
    } catch (error) {
        console.log(`Test: ${test.name}`);
        console.log(`  Error: ${error.message}`);
        console.log(`  Status: ❌ FAILED`);
        console.log('');
        helperFailedTests++;
    }
});

console.log(`Helper Function Results: ${helperPassedTests} passed, ${helperFailedTests} failed\n`);

// Test 5: Available Commands by Role
console.log('5. TESTING AVAILABLE COMMANDS BY ROLE:');
console.log('----------------------------------------');

const roles = ['customer', 'teknisi', 'admin', 'owner'];

roles.forEach(role => {
    const availableCommands = commandManager.getAvailableCommands(role);
    const categories = Object.keys(availableCommands);
    let totalCommands = 0;
    
    for (const category of categories) {
        totalCommands += availableCommands[category].length;
    }
    
    console.log(`Role: ${role}`);
    console.log(`  Categories: ${categories.join(', ')}`);
    console.log(`  Total Commands: ${totalCommands}`);
    console.log('');
});

// Test 6: Menu Building
console.log('6. TESTING MENU BUILDING:');
console.log('----------------------------------------');

const menuItems = [
    { text: 'Cek Tagihan', command: 'cektagihan', emoji: '📋' },
    { text: 'Info Paket', command: 'infopaket', emoji: '📦' },
    { text: 'Lapor Gangguan', command: 'lapor', emoji: '🎫' },
    { text: 'Cek WiFi', command: 'cekwifi', emoji: '📶' }
];

const menu = MessageHelper.buildMenu(menuItems, 'customer');
console.log('Generated Menu:');
console.log(menu ? (menu.length > 200 ? menu.substring(0, 200) + '...' : menu) : 'Failed to generate menu');
console.log('');

// Test 7: Message with Footer
console.log('7. TESTING MESSAGE WITH FOOTER:');
console.log('----------------------------------------');

const messageWithFooter = MessageHelper.getMessageWithFooter(
    'general.success',
    {},
    'support'
);

console.log('Message with Footer:');
console.log(messageWithFooter ? messageWithFooter : 'Failed to generate message with footer');
console.log('');

// Summary
console.log('=== TEST SUMMARY ===');
console.log('----------------------------------------');
const totalPassed = passedTests + permPassedTests + msgPassedTests + helperPassedTests;
const totalFailed = failedTests + permFailedTests + msgFailedTests + helperFailedTests;
const totalTests = totalPassed + totalFailed;

console.log(`Total Tests: ${totalTests}`);
console.log(`Passed: ${totalPassed} (${Math.round(totalPassed/totalTests*100)}%)`);
console.log(`Failed: ${totalFailed} (${Math.round(totalFailed/totalTests*100)}%)`);
console.log('');

if (totalFailed === 0) {
    console.log('✅ ALL TESTS PASSED! System is ready for production.');
} else {
    console.log('⚠️ Some tests failed. Please review and fix the issues.');
}

// Test 8: Command Categories
console.log('\n8. TESTING COMMAND CATEGORIES:');
console.log('----------------------------------------');

const categories = commandManager.getAllCategories();
console.log('Available Categories:');
for (const [key, category] of Object.entries(categories)) {
    console.log(`  - ${key}: ${category.name} (${category.description})`);
}

// Test 9: Settings
console.log('\n9. TESTING SETTINGS:');
console.log('----------------------------------------');

const commandSettings = commandManager.settings;
const messageSettings = messageManager.getSettings();

console.log('Command Settings:');
console.log(`  Case Sensitive: ${commandSettings.caseSensitive}`);
console.log(`  Enable Aliases: ${commandSettings.enableAliases}`);
console.log(`  Default Category: ${commandSettings.defaultCategory}`);
console.log('');

console.log('Message Settings:');
console.log(`  Language: ${messageSettings.language}`);
console.log(`  Timezone: ${messageSettings.timezone}`);
console.log(`  Date Format: ${messageSettings.dateFormat}`);
console.log(`  Enable Emoji: ${messageSettings.enableEmoji}`);
console.log('');

console.log('=== END OF TESTS ===');
