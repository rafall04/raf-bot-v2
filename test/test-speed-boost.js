/**
 * Test Script for Speed Boost Request Feature
 * Run this to verify all functions are working correctly
 */

const { 
    handleSpeedBoostRequest,
    handleSpeedBoostConversation,
    canRequestSpeedBoost,
    getAvailableSpeedBoosts
} = require('../message/handlers/speed-boost-handler');

// Mock global objects
global.packages = [
    {
        id: '1',
        name: 'PAKET-200K',
        price: 200000,
        profile: '10Mbps',
        isSpeedBoost: true,
        speedBoostPrices: {
            '1_day': 15000,
            '3_days': 40000,
            '7_days': 80000
        }
    },
    {
        id: '2',
        name: 'PAKET-220K',
        price: 220000,
        profile: '20Mbps',
        isSpeedBoost: true,
        speedBoostPrices: {
            '1_day': 20000,
            '3_days': 50000,
            '7_days': 100000
        }
    },
    {
        id: '3',
        name: 'PAKET-250K',
        price: 250000,
        profile: '25Mbps',
        isSpeedBoost: true,
        speedBoostPrices: {
            '1_day': 25000,
            '3_days': 60000,
            '7_days': 120000
        }
    }
];

global.speed_requests = [];
global.compensations = [];
global.tempStates = {};
global.config = {
    ownerNumber: ['6285233047095@s.whatsapp.net'],
    bankAccounts: [
        { bank: 'BCA', number: '1234567890', name: 'RAF NET' },
        { bank: 'Mandiri', number: '0987654321', name: 'RAF NET' }
    ]
};

// Mock WhatsApp connection
global.conn = {
    sendMessage: async (jid, content) => {
        console.log('\n📱 Bot Response to', jid);
        console.log('─'.repeat(50));
        console.log(content.text || '[Non-text message]');
        console.log('─'.repeat(50));
        return Promise.resolve();
    }
};

// Test user
const testUser = {
    id: 1,
    name: 'John Doe',
    phone_number: '6285233047094',
    subscription: 'PAKET-200K',
    paid: true,
    pppoe_username: 'john_pppoe',
    device_id: 'DEVICE001'
};

// Test functions
async function testCanRequestSpeedBoost() {
    console.log('\n🧪 Testing canRequestSpeedBoost()...');
    
    // Test 1: Valid user
    let result = canRequestSpeedBoost(testUser);
    console.log('✅ Valid user:', result);
    
    // Test 2: User hasn't paid
    let unpaidUser = { ...testUser, paid: false };
    result = canRequestSpeedBoost(unpaidUser);
    console.log('❌ Unpaid user:', result);
    
    // Test 3: User with active speed request
    global.speed_requests.push({
        id: 'test1',
        userId: 1,
        status: 'active'
    });
    result = canRequestSpeedBoost(testUser);
    console.log('❌ User with active request:', result);
    
    // Clean up
    global.speed_requests = [];
}

async function testGetAvailableSpeedBoosts() {
    console.log('\n🧪 Testing getAvailableSpeedBoosts()...');
    
    const packages = getAvailableSpeedBoosts(testUser);
    console.log('Available packages for PAKET-200K user:');
    packages.forEach(pkg => {
        console.log(`  - ${pkg.name} (${pkg.profile}): Rp ${pkg.price}`);
    });
}

async function testRequestFlow() {
    console.log('\n🧪 Testing complete request flow...');
    
    // Mock message object
    const mockMsg = {
        key: {
            remoteJid: '6285233047094@s.whatsapp.net',
            fromMe: false,
            id: 'MSG001'
        },
        message: {
            conversation: 'speedboost'
        }
    };
    
    const sender = '6285233047094@s.whatsapp.net';
    
    console.log('\n1️⃣ Starting speed boost request...');
    await handleSpeedBoostRequest(mockMsg, testUser, sender);
    
    // Simulate package selection
    console.log('\n2️⃣ Selecting package 1...');
    await handleSpeedBoostConversation(mockMsg, testUser, sender, '1');
    
    // Simulate duration selection
    console.log('\n3️⃣ Selecting duration 2 (3 days)...');
    await handleSpeedBoostConversation(mockMsg, testUser, sender, '2');
    
    // Simulate payment method selection
    console.log('\n4️⃣ Selecting payment method 2 (Transfer)...');
    await handleSpeedBoostConversation(mockMsg, testUser, sender, '2');
    
    // Simulate confirmation
    console.log('\n5️⃣ Confirming order...');
    await handleSpeedBoostConversation(mockMsg, testUser, sender, 'ya');
    
    // Check created request
    console.log('\n📋 Created Speed Request:');
    if (global.speed_requests.length > 0) {
        const request = global.speed_requests[0];
        console.log({
            id: request.id,
            package: request.requestedPackageName,
            duration: request.durationLabel,
            price: request.price,
            paymentMethod: request.paymentMethod,
            status: request.status
        });
    }
}

async function testCancelFlow() {
    console.log('\n🧪 Testing cancel flow...');
    
    const mockMsg = {
        key: {
            remoteJid: '6285233047094@s.whatsapp.net',
            fromMe: false,
            id: 'MSG002'
        }
    };
    
    const sender = '6285233047094@s.whatsapp.net';
    
    // Start request
    await handleSpeedBoostRequest(mockMsg, testUser, sender);
    
    // Cancel at package selection
    console.log('\n❌ Canceling at package selection...');
    await handleSpeedBoostConversation(mockMsg, testUser, sender, 'batal');
    
    console.log('State cleared:', !global.tempStates[sender]);
}

// Run all tests
async function runAllTests() {
    console.log('=' .repeat(60));
    console.log('🚀 SPEED BOOST FEATURE TEST SUITE');
    console.log('=' .repeat(60));
    
    await testCanRequestSpeedBoost();
    await testGetAvailableSpeedBoosts();
    await testRequestFlow();
    await testCancelFlow();
    
    console.log('\n' + '=' .repeat(60));
    console.log('✅ All tests completed!');
    console.log('=' .repeat(60));
}

// Run tests
runAllTests().catch(console.error);
