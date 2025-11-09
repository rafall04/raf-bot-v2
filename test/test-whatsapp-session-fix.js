/**
 * Test script to debug WhatsApp session issues
 * Run this to check WhatsApp connection status
 */

const path = require('path');

console.log('='.repeat(50));
console.log('   WHATSAPP SESSION DEBUG TEST');  
console.log('='.repeat(50));
console.log('');

async function checkWhatsAppStatus() {
    try {
        // Load database to get global.raf
        const { initializeDatabase } = require(path.join(__dirname, '..', 'lib', 'database'));
        await initializeDatabase();
        
        console.log('1. CHECKING WHATSAPP CONNECTION:');
        console.log('   global.raf exists:', !!global.raf);
        
        if (global.raf) {
            console.log('   ✅ WhatsApp bot object exists');
            
            // Check if sendMessage function exists
            if (typeof global.raf.sendMessage === 'function') {
                console.log('   ✅ sendMessage function available');
            } else {
                console.log('   ❌ sendMessage function NOT available');
            }
            
            // Check connection state
            if (global.whatsappConnectionState) {
                console.log('   Connection state:', global.whatsappConnectionState);
            } else {
                console.log('   ⚠️ Connection state unknown');
            }
        } else {
            console.log('   ❌ WhatsApp bot NOT initialized');
            console.log('   Make sure the WhatsApp bot is running!');
        }
        
        console.log('');
        console.log('2. TESTING PHONE NUMBER FORMATTING:');
        
        const testNumbers = [
            '085233047094',
            '6285233047094', 
            '+6285233047094',
            '85233047094',
            '6285233047094@s.whatsapp.net'
        ];
        
        testNumbers.forEach(num => {
            let formatted = formatPhoneNumber(num);
            console.log(`   ${num} → ${formatted}`);
        });
        
        console.log('');
        console.log('3. SESSION ISSUE EXPLANATION:');
        console.log('   "Closing stale open session" means:');
        console.log('   - WhatsApp is creating a new encrypted session');
        console.log('   - This happens with numbers not recently contacted');
        console.log('   - Can cause delays/timeouts on first message');
        console.log('');
        console.log('   SOLUTION APPLIED:');
        console.log('   ✅ Added retry logic (2 attempts)');
        console.log('   ✅ Increased timeout to 15 seconds');
        console.log('   ✅ Added 500ms delay before sending');
        console.log('   ✅ Added 2s delay between retries');
        console.log('   ✅ Better phone number validation');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

function formatPhoneNumber(phone) {
    if (!phone) return 'INVALID';
    
    phone = phone.trim();
    
    if (phone.endsWith('@s.whatsapp.net')) {
        return phone;
    }
    
    if (phone.startsWith('0')) {
        return `62${phone.substring(1)}@s.whatsapp.net`;
    } else if (phone.startsWith('62')) {
        return `${phone}@s.whatsapp.net`;
    } else if (phone.startsWith('+62')) {
        return `${phone.substring(1)}@s.whatsapp.net`;
    } else {
        return `62${phone}@s.whatsapp.net`;
    }
}

console.log('4. RECOMMENDATIONS:');
console.log('   If notifications still fail:');
console.log('   1. Check if WhatsApp bot is connected');
console.log('   2. Verify customer phone numbers are valid');
console.log('   3. Try restarting WhatsApp bot connection');
console.log('   4. Check if customer has WhatsApp installed');
console.log('   5. Ensure no firewall blocking WhatsApp');
console.log('');

checkWhatsAppStatus().then(() => {
    console.log('='.repeat(50));
    console.log('   TEST COMPLETE');
    console.log('='.repeat(50));
}).catch(console.error);
