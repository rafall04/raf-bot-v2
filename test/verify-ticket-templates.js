/**
 * Test to verify that ticket templates are loaded correctly
 */

// Disable file watchers to prevent test from hanging
process.env.DISABLE_FILE_WATCHERS = 'true';

const path = require('path');

// Load templating module (this will load all templates)
const { renderTemplate, templatesCache } = require('../lib/templating');

console.log('Testing Ticket Templates Loading...\n');

// Check if notification templates are loaded
const notificationTemplates = templatesCache.notificationTemplates;

console.log(`Total templates loaded: ${Object.keys(notificationTemplates).length}`);
console.log('Template keys:', Object.keys(notificationTemplates));

// Check for ticket templates specifically
const ticketTemplates = [
    'ticket_process_customer',
    'ticket_otw_customer', 
    'ticket_arrived_customer',
    'ticket_working_customer',
    'ticket_completed_customer',
    'ticket_created_teknisi',
    'ticket_cancelled_customer',
    'ticket_cancelled_teknisi'
];

console.log('\n--- Checking Ticket Templates ---');
let foundCount = 0;
ticketTemplates.forEach(templateKey => {
    if (notificationTemplates[templateKey]) {
        console.log(`✅ Found: ${templateKey}`);
        console.log(`   Name: ${notificationTemplates[templateKey].name}`);
        foundCount++;
    } else {
        console.log(`❌ Missing: ${templateKey}`);
    }
});

console.log(`\n✅ Found ${foundCount}/${ticketTemplates.length} ticket templates`);

// Test rendering one template
console.log('\n--- Testing Template Rendering ---');
try {
    const testData = {
        ticket_id: 'TEST123',
        teknisi_name: 'John Doe',
        teknisi_phone_section: '📱 Kontak: wa.me/6281234567890\n',
        otp: '123456'
    };
    
    const result = renderTemplate('ticket_process_customer', testData);
    console.log('✅ Template rendering successful!');
    console.log('Sample output (first 200 chars):');
    console.log(result.substring(0, 200) + '...');
} catch (error) {
    console.log('❌ Template rendering failed:', error.message);
}

// Test that templates would be available via API
console.log('\n--- API Structure Check ---');
const apiData = {
    notificationTemplates: templatesCache.notificationTemplates,
    // Other template types would be here
};

const ticketTemplatesInAPI = Object.keys(apiData.notificationTemplates)
    .filter(key => key.includes('ticket'));

console.log(`Templates with "ticket" in name: ${ticketTemplatesInAPI.length}`);
console.log('Available ticket templates for API:', ticketTemplatesInAPI);

console.log('\n✅ Test complete!');
console.log('\nNOTE: These templates should now appear in /templates page under "Notification Templates" tab.');

// Exit process to prevent hanging
process.exit(0);
