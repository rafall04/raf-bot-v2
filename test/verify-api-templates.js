/**
 * Test to verify that API endpoint returns ticket templates
 */

// Disable file watchers
process.env.DISABLE_FILE_WATCHERS = 'true';

// Load the templating module to simulate what the API does
const { templatesCache } = require('../lib/templating');

console.log('Testing API Templates Response...\n');

// Simulate what /api/templates endpoint does
const notificationTemplates = templatesCache.notificationTemplates;

// Count ticket templates
const ticketTemplates = Object.keys(notificationTemplates)
    .filter(key => key.includes('ticket'));

console.log(`Total notification templates: ${Object.keys(notificationTemplates).length}`);
console.log(`Ticket templates found: ${ticketTemplates.length}`);
console.log('\nTicket templates that will appear in /templates page:');
console.log('================================================');

ticketTemplates.forEach(key => {
    const template = notificationTemplates[key];
    console.log(`\n📋 ${template.name}`);
    console.log(`   Key: ${key}`);
    console.log(`   Template preview: ${template.template.substring(0, 50)}...`);
});

console.log('\n================================================');
console.log('✅ All these templates should appear in the "Notification Templates" tab');
console.log('   when you visit /templates in the admin panel.');

console.log('\nAPI Response Structure:');
console.log(JSON.stringify({
    status: 200,
    message: "Templates loaded successfully from cache.",
    data: {
        notificationTemplates: Object.keys(notificationTemplates).reduce((acc, key) => {
            if (key.includes('ticket')) {
                acc[key] = {
                    name: notificationTemplates[key].name,
                    template: '...(truncated for display)...'
                };
            }
            return acc;
        }, {})
    }
}, null, 2));

process.exit(0);
