/**
 * Test untuk simulasi flow lapor menu dan cek apakah nama terdeteksi
 */

console.log('🧪 TEST REPORT MENU FLOW WITH NAME DETECTION\n');
console.log('=' .repeat(50) + '\n');

// Import required modules
const { initializeDatabase } = require('../lib/database');
const { startReportFlow, handleInternetMati } = require('../message/handlers/smart-report-text-menu');

async function testReportMenuFlow() {
    try {
        // Initialize database
        console.log('📂 Initializing database...\n');
        await initializeDatabase();
        
        // Initialize reports if not exists
        if (!global.reports) global.reports = [];
        
        console.log(`✅ Database loaded with ${global.users.length} users\n`);
        console.log(`✅ Accounts loaded with ${global.accounts.length} accounts\n`);
        
        // Show user data
        console.log('📋 USER DATA:');
        global.users.forEach(u => {
            console.log(`  ID: ${u.id}, Name: "${u.name}", Phone: ${u.phone_number}`);
        });
        console.log('');
        
        // Simulate WhatsApp sender (using phone from database)
        const sender = '6285604652630@s.whatsapp.net';  // Using second phone number
        const pushname = 'Test Push Name';
        const mockReply = async (msg) => console.log('[BOT REPLY]:', msg);
        
        console.log('━'.repeat(50));
        console.log(`\n📱 TEST 1: START REPORT FLOW\n`);
        console.log(`Sender: ${sender}`);
        
        const result1 = await startReportFlow({ 
            sender, 
            pushname, 
            reply: mockReply 
        });
        
        if (result1.success) {
            console.log('✅ Report flow started successfully');
            console.log('Message:', result1.message.substring(0, 100) + '...');
            
            // Check state
            const { getUserState } = require('../message/handlers/conversation-handler');
            const state = getUserState(sender);
            
            if (state && state.userData) {
                console.log('\n✅ USER DATA IN STATE:');
                console.log(`  ID: ${state.userData.id}`);
                console.log(`  Name: "${state.userData.name}"`);
                console.log(`  Phone: ${state.userData.phone_number}`);
            } else {
                console.log('\n❌ No user data in state!');
            }
        } else {
            console.log('❌ Failed to start report flow:', result1.message);
        }
        
        // Test 2: Handle Internet Mati
        console.log('\n━'.repeat(50));
        console.log(`\n📱 TEST 2: HANDLE INTERNET MATI\n`);
        
        const result2 = await handleInternetMati({ 
            sender, 
            pushname, 
            reply: mockReply 
        });
        
        if (result2.success) {
            console.log('✅ Internet Mati handler executed');
            console.log('Message preview:', result2.message.substring(0, 100) + '...');
            
            // Check state after
            const { getUserState } = require('../message/handlers/conversation-handler');
            const state2 = getUserState(sender);
            
            if (state2 && state2.userData) {
                console.log('\n✅ USER DATA PRESERVED:');
                console.log(`  ID: ${state2.userData.id}`);
                console.log(`  Name: "${state2.userData.name}"`);
                console.log(`  Phone: ${state2.userData.phone_number}`);
            }
        } else {
            console.log('❌ Failed:', result2.message);
        }
        
        // Test 3: Simulate creating a ticket
        console.log('\n━'.repeat(50));
        console.log(`\n📱 TEST 3: SIMULATE TICKET CREATION\n`);
        
        // Manually simulate ticket data as it would be created
        const ticketData = {
            ticketId: 'TEST123',
            pelangganUserId: 1,
            pelangganId: sender,
            pelangganName: null, // Will be set below
            pelangganPhone: null,
            pelangganAddress: null
        };
        
        // Find user using the fixed logic
        const senderPhone = sender.replace('@s.whatsapp.net', '');
        const user = global.users.find(u => {
            if (!u.phone_number) return false;
            
            const phones = u.phone_number.split("|");
            
            return phones.some(phone => {
                const cleanPhone = phone.trim();
                
                if (senderPhone.startsWith('62')) {
                    if (cleanPhone.startsWith('0')) {
                        return `62${cleanPhone.substring(1)}` === senderPhone;
                    } else if (cleanPhone.startsWith('62')) {
                        return cleanPhone === senderPhone;
                    } else {
                        return `62${cleanPhone}` === senderPhone;
                    }
                }
                
                return cleanPhone === senderPhone;
            });
        });
        
        if (user) {
            ticketData.pelangganName = user.name || user.username || 'Customer';
            ticketData.pelangganPhone = user.phone_number || '';
            ticketData.pelangganAddress = user.address || '';
            
            console.log('✅ USER FOUND FOR TICKET:');
            console.log(`  Ticket ID: ${ticketData.ticketId}`);
            console.log(`  Pelanggan Name: "${ticketData.pelangganName}"`);
            console.log(`  Pelanggan Phone: ${ticketData.pelangganPhone}`);
            console.log(`  Pelanggan Address: ${ticketData.pelangganAddress}`);
        } else {
            console.log('❌ USER NOT FOUND!');
        }
        
        // Summary
        console.log('\n' + '═'.repeat(50));
        console.log('\n📊 SUMMARY:\n');
        
        console.log('EXPECTED:');
        console.log(`  • Pelanggan Name: "Test User"`);
        console.log(`  • From Phone: 6285604652630`);
        console.log('');
        console.log('ACTUAL:');
        console.log(`  • Pelanggan Name: "${ticketData.pelangganName}"`);
        console.log(`  • User Found: ${user ? 'YES' : 'NO'}`);
        console.log('');
        
        if (ticketData.pelangganName === 'Test User') {
            console.log('✅ NAME DETECTION WORKS CORRECTLY!');
        } else {
            console.log(`❌ NAME DETECTION FAILED!`);
            console.log(`   Got "${ticketData.pelangganName}" instead of "Test User"`);
            
            // Debug
            console.log('\n🔍 DEBUGGING:');
            console.log(`Sender phone: ${senderPhone}`);
            console.log('Users in database:');
            global.users.forEach(u => {
                console.log(`  ID ${u.id}: phone="${u.phone_number}", name="${u.name}"`);
            });
        }
        
        console.log('\n✅ TEST COMPLETED!');
        
        // Close database
        if (global.db) {
            global.db.close();
        }
        
        process.exit(0);
        
    } catch (error) {
        console.error('\n❌ TEST FAILED:', error);
        process.exit(1);
    }
}

// Run test
testReportMenuFlow();
