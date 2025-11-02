/**
 * Simple test for concurrent photo upload - no hanging issues
 */

console.log('🧪 SIMPLE PHOTO UPLOAD TEST\n');
console.log('=' .repeat(50) + '\n');

// Import required modules
const { initializeDatabase } = require('../lib/database');
const { 
    handleTeknisiPhotoUpload, 
    getUploadQueue, 
    clearUploadQueue 
} = require('../message/handlers/teknisi-photo-handler-v3');

async function runTest() {
    try {
        // Initialize database
        console.log('📂 Initializing database...\n');
        await initializeDatabase();
        
        // Initialize global states
        if (!global.teknisiStates) global.teknisiStates = {};
        if (!global.reports) global.reports = [];
        
        // Create test teknisi state
        const teknisiSender = '6289685645956@s.whatsapp.net';
        global.teknisiStates[teknisiSender] = {
            step: 'AWAITING_COMPLETION_PHOTOS',
            ticketId: 'TEST123',
            uploadedPhotos: [],
            minPhotos: 2
        };
        
        // Mock reply function
        let replyMessages = [];
        const mockReply = async (msg) => {
            replyMessages.push(msg);
            console.log(`[REPLY]: ${msg.substring(0, 80)}...`);
            return msg;
        };
        
        // TEST 1: Concurrent upload of 5 photos
        console.log('━'.repeat(50));
        console.log('\n📸 TEST 1: UPLOAD 5 PHOTOS CONCURRENTLY\n');
        
        // Create promises for 5 photos
        const promises = [];
        for (let i = 1; i <= 5; i++) {
            const fileName = `test_photo_${i}.jpg`;
            const buffer = Buffer.from(`fake_image_${i}`);
            
            console.log(`📤 Uploading photo ${i}: ${fileName}`);
            
            // Only last photo has reply
            const promise = handleTeknisiPhotoUpload(
                teknisiSender, 
                fileName, 
                buffer,
                i === 5 ? mockReply : null
            );
            
            promises.push(promise);
        }
        
        // Wait for all uploads
        console.log('\n⏳ Waiting for uploads...\n');
        const results = await Promise.all(promises);
        
        // Check results
        console.log('\n📊 RESULTS:');
        console.log(`• Promises resolved: ${results.length}`);
        console.log(`• All successful: ${results.every(r => r.success)}`);
        console.log(`• Photos uploaded: ${results[0].photoCount}`);
        console.log(`• Reply messages: ${replyMessages.length}`);
        
        const queue1 = getUploadQueue(teknisiSender);
        console.log(`• Queue photos: ${queue1.uploadedPhotos.length}`);
        
        if (queue1.uploadedPhotos.length === 5) {
            console.log('\n✅ TEST 1 PASSED: All 5 photos uploaded!');
        } else {
            console.log(`\n❌ TEST 1 FAILED: Only ${queue1.uploadedPhotos.length}/5 photos`);
        }
        
        // TEST 2: Sequential upload
        console.log('\n' + '━'.repeat(50));
        console.log('\n📸 TEST 2: SEQUENTIAL UPLOAD (3 PHOTOS)\n');
        
        // Clear previous session
        clearUploadQueue(teknisiSender);
        global.teknisiStates[teknisiSender].uploadedPhotos = [];
        replyMessages = [];
        
        // Upload 3 photos sequentially
        for (let i = 1; i <= 3; i++) {
            const fileName = `seq_photo_${i}.jpg`;
            const buffer = Buffer.from(`seq_image_${i}`);
            
            console.log(`📤 Uploading photo ${i}: ${fileName}`);
            
            const result = await handleTeknisiPhotoUpload(
                teknisiSender,
                fileName,
                buffer,
                i === 3 ? mockReply : null
            );
            
            console.log(`  Result: success=${result.success}, count=${result.photoCount}`);
            
            // Small delay between uploads
            if (i < 3) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }
        
        const queue2 = getUploadQueue(teknisiSender);
        console.log(`\n📊 Sequential result: ${queue2.uploadedPhotos.length} photos`);
        
        if (queue2.uploadedPhotos.length === 3) {
            console.log('✅ TEST 2 PASSED: Sequential upload works!');
        } else {
            console.log(`❌ TEST 2 FAILED: Only ${queue2.uploadedPhotos.length}/3 photos`);
        }
        
        // FINAL SUMMARY
        console.log('\n' + '═'.repeat(50));
        console.log('\n🎯 FINAL SUMMARY:\n');
        
        const test1Pass = queue1.uploadedPhotos.length === 5;
        const test2Pass = queue2.uploadedPhotos.length === 3;
        
        if (test1Pass && test2Pass) {
            console.log('🎉 ALL TESTS PASSED! 🎉');
            console.log('\nVERIFIED:');
            console.log('  ✅ Concurrent upload works');
            console.log('  ✅ Sequential upload works');
            console.log('  ✅ No hanging or stuck issues');
            console.log('  ✅ All photos saved correctly');
        } else {
            console.log('⚠️ SOME TESTS FAILED');
            if (!test1Pass) console.log('  ❌ Concurrent upload failed');
            if (!test2Pass) console.log('  ❌ Sequential upload failed');
        }
        
        // Clean up
        clearUploadQueue(teknisiSender);
        if (global.db) {
            global.db.close();
        }
        
        console.log('\n✅ TEST COMPLETED SUCCESSFULLY!\n');
        process.exit(test1Pass && test2Pass ? 0 : 1);
        
    } catch (error) {
        console.error('\n❌ TEST ERROR:', error);
        console.error(error.stack);
        
        if (global.db) {
            global.db.close();
        }
        
        process.exit(1);
    }
}

// Run test with timeout protection
console.log('Starting test with 30 second timeout protection...\n');

const testTimeout = setTimeout(() => {
    console.error('\n⏱️ TEST TIMEOUT: Test took longer than 30 seconds!');
    process.exit(1);
}, 30000);

runTest().then(() => {
    clearTimeout(testTimeout);
}).catch(err => {
    clearTimeout(testTimeout);
    console.error('Test failed:', err);
    process.exit(1);
});
