/**
 * Test for refactored handlers
 * Ensures all handlers are properly exported and working
 */

console.log('🧪 TESTING REFACTORED HANDLERS\n');
console.log('='.repeat(50) + '\n');

const testResults = [];

// Test each handler file
const handlers = [
    {
        name: 'Menu Handler',
        file: '../message/handlers/menu-handler',
        functions: [
            'handleMenuUtama',
            'handleMenuTeknisi',
            'handleMenuOwner',
            'handleTanyaCaraPasang',
            'handleTanyaPaketBulanan',
            'handleTutorialTopup',
            'handleMenuPelanggan'
        ]
    },
    {
        name: 'Monitoring Handler',
        file: '../message/handlers/monitoring-handler',
        functions: [
            'handleStatusPpp',
            'handleStatusHotspot',
            'handleStatusAp',
            'handleAllSaldo',
            'handleAllUser',
            'handleListProfStatik',
            'handleListProfVoucher',
            'handleMonitorWifi'
        ]
    },
    {
        name: 'Saldo Voucher Handler',
        file: '../message/handlers/saldo-voucher-handler',
        functions: [
            'handleCekSaldo',
            'handleTanyaHargaVoucher',
            'handleVc123',
            'handleTopupSaldo'
        ]
    },
    {
        name: 'Utility Handler',
        file: '../message/handlers/utility-handler',
        functions: [
            'handleAdminContact',
            'handleBantuan',
            'handleSapaanUmum',
            'handleCekTiket'
        ]
    },
    {
        name: 'WiFi Management Handler',
        file: '../message/handlers/wifi-management-handler',
        functions: [
            'handleGantiNamaWifi',
            'handleGantiSandiWifi'
        ]
    },
    {
        name: 'WiFi Check Handler',
        file: '../message/handlers/wifi-check-handler',
        functions: [
            'handleCekWifi'
        ]
    },
    {
        name: 'Payment Processor Handler',
        file: '../message/handlers/payment-processor-handler',
        functions: [
            'handleTopupSaldoPayment',
            'handleBeliVoucher'
        ]
    },
    {
        name: 'Access Management Handler',
        file: '../message/handlers/access-management-handler',
        functions: [
            'handleAccessManagement'
        ]
    },
    {
        name: 'Reboot Modem Handler',
        file: '../message/handlers/reboot-modem-handler',
        functions: [
            'handleRebootModem'
        ]
    }
];

// Test each handler
for (const handler of handlers) {
    console.log(`📁 Testing: ${handler.name}`);
    console.log('-'.repeat(40));
    
    try {
        const module = require(handler.file);
        let allFunctionsExist = true;
        let missingFunctions = [];
        
        for (const func of handler.functions) {
            if (typeof module[func] === 'function') {
                console.log(`  ✅ ${func}`);
            } else {
                console.log(`  ❌ ${func} - NOT FOUND`);
                allFunctionsExist = false;
                missingFunctions.push(func);
            }
        }
        
        testResults.push({
            handler: handler.name,
            success: allFunctionsExist,
            missing: missingFunctions
        });
        
        console.log('');
        
    } catch (error) {
        console.log(`  ❌ ERROR: ${error.message}`);
        testResults.push({
            handler: handler.name,
            success: false,
            error: error.message
        });
        console.log('');
    }
}

// Summary
console.log('='.repeat(50));
console.log('\n📊 TEST SUMMARY:\n');

const successCount = testResults.filter(r => r.success).length;
const totalCount = testResults.length;

if (successCount === totalCount) {
    console.log('🎉 ALL TESTS PASSED! 🎉\n');
    console.log('All handlers are properly refactored and exported.');
} else {
    console.log(`⚠️ SOME TESTS FAILED: ${successCount}/${totalCount} passed\n`);
    
    const failed = testResults.filter(r => !r.success);
    console.log('Failed handlers:');
    for (const fail of failed) {
        console.log(`  ❌ ${fail.handler}`);
        if (fail.missing) {
            console.log(`     Missing functions: ${fail.missing.join(', ')}`);
        }
        if (fail.error) {
            console.log(`     Error: ${fail.error}`);
        }
    }
}

console.log('\n✅ TEST COMPLETED!\n');
process.exit(successCount === totalCount ? 0 : 1);
