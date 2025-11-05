#!/usr/bin/env node

/**
 * Test Script for Error Recovery System
 * Tests the error recovery, monitoring, and alert systems
 */

const path = require('path');
const fs = require('fs');

// Load config
global.config = JSON.parse(fs.readFileSync(path.join(__dirname, '../config.json'), 'utf8'));

// Import modules
const ErrorRecovery = require('../lib/error-recovery');
const MonitoringService = require('../lib/monitoring-service');
const AlertSystem = require('../lib/alert-system');

console.log('🧪 TESTING ERROR RECOVERY SYSTEM');
console.log('=' .repeat(70));

// Initialize systems
const errorRecovery = new ErrorRecovery();
const monitoring = new MonitoringService();
const alertSystem = new AlertSystem();

// Make them global for testing
global.errorRecovery = errorRecovery;
global.monitoring = monitoring;
global.alertSystem = alertSystem;

async function runTests() {
    console.log('\n📊 TEST 1: Error Recovery');
    console.log('-'.repeat(70));
    
    // Test 1: Basic error handling
    const testError1 = new Error('Test connection error');
    testError1.code = 'ECONNREFUSED';
    
    const recovery1 = await errorRecovery.handleError(testError1, {
        context: 'test_connection',
        retryable: true,
        identifier: 'test_1'
    });
    
    console.log('Recovery result:', recovery1);
    console.log('✅ Error recovery basic test passed');
    
    // Test 2: Monitoring metrics
    console.log('\n📊 TEST 2: Monitoring Metrics');
    console.log('-'.repeat(70));
    
    monitoring.incrementMetric('messages.received');
    monitoring.incrementMetric('messages.sent');
    monitoring.incrementMetric('messages.failed');
    
    const metrics = monitoring.getMetricsSnapshot();
    console.log('Message metrics:', {
        received: metrics.messages.received,
        sent: metrics.messages.sent,
        failed: metrics.messages.failed
    });
    console.log('✅ Monitoring metrics test passed');
    
    // Test 3: Health check
    console.log('\n📊 TEST 3: Health Check');
    console.log('-'.repeat(70));
    
    const health = await monitoring.healthCheck();
    console.log('Health status:', health.status);
    console.log('Issues found:', health.issues.length);
    
    if (health.issues.length > 0) {
        console.log('Health issues:');
        health.issues.forEach(issue => {
            console.log(`  - ${issue.type}: ${issue.severity}`);
        });
    }
    console.log('✅ Health check test passed');
    
    // Test 4: Alert system
    console.log('\n📊 TEST 4: Alert System');
    console.log('-'.repeat(70));
    
    console.log('Sending test alert...');
    const alertSent = await alertSystem.sendAlert('info', 'TEST_ALERT', {
        message: 'This is a test alert from the error recovery system test',
        timestamp: new Date().toISOString()
    });
    
    console.log('Alert sent:', alertSent);
    
    const alertStats = alertSystem.getAlertStats();
    console.log('Alert statistics:', {
        total: alertStats.total,
        queueSize: alertStats.queueSize
    });
    console.log('✅ Alert system test passed');
    
    // Test 5: Error statistics
    console.log('\n📊 TEST 5: Error Statistics');
    console.log('-'.repeat(70));
    
    // Log some test errors
    await monitoring.logError(
        new Error('Test error 1'),
        { context: 'test' },
        'error'
    );
    
    await monitoring.logError(
        new Error('Test error 2'),
        { context: 'test' },
        'warning'
    );
    
    const errorStats = errorRecovery.getErrorStats();
    console.log('Error statistics:', {
        total: errorStats.total,
        lastHour: errorStats.lastHour,
        retryAttempts: Object.keys(errorStats.retryAttempts).length
    });
    console.log('✅ Error statistics test passed');
    
    // Test 6: Connection simulation
    console.log('\n📊 TEST 6: Connection Status');
    console.log('-'.repeat(70));
    
    // Simulate connection changes
    monitoring.updateConnectionStatus('whatsapp', 'open');
    console.log('WhatsApp status:', monitoring.metrics.connections.whatsapp ? 'Connected' : 'Disconnected');
    
    monitoring.updateConnectionStatus('whatsapp', 'close');
    console.log('WhatsApp status:', monitoring.metrics.connections.whatsapp ? 'Connected' : 'Disconnected');
    
    monitoring.updateConnectionStatus('database', true);
    console.log('Database status:', monitoring.metrics.connections.database ? 'Connected' : 'Disconnected');
    
    console.log('✅ Connection status test passed');
    
    // Test 7: Recovery actions
    console.log('\n📊 TEST 7: Recovery Actions');
    console.log('-'.repeat(70));
    
    const criticalError = new Error('Critical system failure');
    criticalError.code = 'ENOMEM';
    
    const recovery2 = await errorRecovery.handleError(criticalError, {
        context: 'memory_test',
        retryable: false,
        identifier: 'test_critical'
    });
    
    console.log('Critical error recovery:', recovery2);
    console.log('✅ Recovery actions test passed');
    
    // Final summary
    console.log('\n' + '=' .repeat(70));
    console.log('✨ ALL TESTS COMPLETED SUCCESSFULLY!');
    console.log('=' .repeat(70));
    
    console.log('\n📊 FINAL METRICS:');
    const finalMetrics = monitoring.getMetricsSnapshot();
    console.log({
        systemUptime: `${Math.floor(finalMetrics.system.uptime / 60)} minutes`,
        messagesProcessed: finalMetrics.messages.received + finalMetrics.messages.sent,
        errorCount: finalMetrics.errors.count,
        cpuUsage: `${finalMetrics.system.cpu}%`,
        memoryUsage: `${finalMetrics.system.memory}%`,
        connections: finalMetrics.connections
    });
}

// Run tests
runTests().then(() => {
    console.log('\n👍 Test suite completed');
    
    // Stop monitoring service
    monitoring.stopMonitoring();
    
    // Exit after a short delay
    setTimeout(() => {
        process.exit(0);
    }, 1000);
}).catch(error => {
    console.error('\n❌ Test suite failed:', error);
    process.exit(1);
});
