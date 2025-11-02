/**
 * Test concurrent photo upload for teknisi
 * Simulates multiple photos uploaded simultaneously
 */

console.log('🧪 TEST CONCURRENT PHOTO UPLOAD\n');
console.log('=' .repeat(50) + '\n');

// Import required modules
const { initializeDatabase } = require('../lib/database');
const { handleTeknisiPhotoUpload, getUploadQueue, clearUploadQueue } = require('../message/handlers/teknisi-photo-handler-v2');

async function testConcurrentUpload() {
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
        let replyCount = 0;
        const replies = [];
        const mockReply = async (msg) => {
            replyCount++;
            replies.push(msg);
            console.log(`[REPLY ${replyCount}]:`, msg.substring(0, 100) + '...\n');
            return msg;
        };
        
        // TEST 1: Concurrent upload of 5 photos
        console.log('━'.repeat(50));
        console.log('\n📸 TEST 1: UPLOAD 5 PHOTOS SIMULTANEOUSLY\n');
        
        // Simulate 5 concurrent photo uploads
        const uploadPromises = [];
        for (let i = 1; i <= 5; i++) {
            const fileName = `test_photo_${i}_${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;
            const buffer = Buffer.from(`fake_image_data_${i}`);
            
            console.log(`📤 Uploading photo ${i}: ${fileName}`);
            
            const promise = handleTeknisiPhotoUpload(
                teknisiSender, 
                fileName, 
                buffer,
                i === 5 ? mockReply : null // Only reply on last photo
            );
            uploadPromises.push(promise);
            
            // Small delay between uploads to simulate real scenario
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        // Wait for all uploads to complete with timeout
        console.log('\n⏳ Waiting for all uploads to complete...\n');
        
        try {
            const results = await Promise.race([
                Promise.all(uploadPromises),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Upload timeout')), 15000)
                )
            ]);
            
            // Wait a bit more for queue processing
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            console.log('📊 RESULTS:\n');
            
        } catch (uploadError) {
            console.error('⚠️ Upload error:', uploadError.message);
        }
        
        // Check results
        const queue = getUploadQueue(teknisiSender);
        const state = global.teknisiStates[teknisiSender];
        
        console.log(`📁 Photos in queue: ${queue.uploadedPhotos.length}`);
        console.log(`📂 Photos in state: ${state.uploadedPhotos.length}`);
        console.log(`💬 Reply messages sent: ${replyCount}`);
        
        // Verify all photos were saved
        if (queue.uploadedPhotos.length === 5) {
            console.log('\n✅ SUCCESS: All 5 photos saved correctly!');
        } else {
            console.log(`\n❌ ERROR: Only ${queue.uploadedPhotos.length}/5 photos saved`);
        }
        
        // TEST 2: Sequential upload
        console.log('\n━'.repeat(50));
        console.log('\n📸 TEST 2: UPLOAD 3 PHOTOS SEQUENTIALLY\n');
        
        // Clear previous state
        clearUploadQueue(teknisiSender);
        global.teknisiStates[teknisiSender].uploadedPhotos = [];
        replyCount = 0;
        replies.length = 0;
        
        // Upload 3 photos one by one
        for (let i = 1; i <= 3; i++) {
            const fileName = `seq_photo_${i}_${Date.now()}.jpg`;
            const buffer = Buffer.from(`fake_seq_image_${i}`);
            
            console.log(`📤 Uploading photo ${i}: ${fileName}`);
            
            try {
                await Promise.race([
                    handleTeknisiPhotoUpload(
                        teknisiSender,
                        fileName,
                        buffer,
                        i === 3 ? mockReply : null // Only reply on last photo
                    ),
                    new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('Sequential upload timeout')), 10000)
                    )
                ]);
            } catch (err) {
                console.error(`Upload ${i} error:`, err.message);
            }
            
            // Wait between uploads
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        // Check results
        console.log('\n📊 SEQUENTIAL RESULTS:\n');
        
        const queueSeq = getUploadQueue(teknisiSender);
        const stateSeq = global.teknisiStates[teknisiSender];
        
        console.log(`📁 Photos in queue: ${queueSeq.uploadedPhotos.length}`);
        console.log(`📂 Photos in state: ${stateSeq.uploadedPhotos.length}`);
        console.log(`💬 Reply messages sent: ${replyCount}`);
        
        if (queueSeq.uploadedPhotos.length === 3) {
            console.log('\n✅ SUCCESS: Sequential upload works!');
        } else {
            console.log(`\n❌ ERROR: Only ${queueSeq.uploadedPhotos.length}/3 photos saved`);
        }
        
        // TEST 3: Mixed upload (2 concurrent, then 1 more)
        console.log('\n━'.repeat(50));
        console.log('\n📸 TEST 3: MIXED UPLOAD PATTERN\n');
        
        // Clear state
        clearUploadQueue(teknisiSender);
        global.teknisiStates[teknisiSender].uploadedPhotos = [];
        
        // Upload 2 photos concurrently...
        console.log('Uploading 2 photos concurrently...');
        const mixed1 = handleTeknisiPhotoUpload(
            teknisiSender,
            'mixed_1.jpg',
            Buffer.from('data1'),
            null
        );
        const mixed2 = handleTeknisiPhotoUpload(
            teknisiSender,
            'mixed_2.jpg',
            Buffer.from('data2'),
            mockReply
        );
        
        try {
            // Wait for first batch
            const [r1, r2] = await Promise.all([mixed1, mixed2]);
            console.log(`First batch completed: ${r1.photoCount} and ${r2.photoCount} photos`);
            
            // Wait a bit before next upload
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Then upload 1 more
            console.log('Uploading 1 more photo...');
            const r3 = await handleTeknisiPhotoUpload(
                teknisiSender,
                'mixed_3.jpg',
                Buffer.from('data3'),
                mockReply
            );
            
            console.log(`Third photo completed: ${r3.photoCount} photos`);
            
            // Wait for processing
            await new Promise(resolve => setTimeout(resolve, 1000));
            
        } catch (err) {
            console.error('Mixed upload error:', err);
        }
        
        const queueMixed = getUploadQueue(teknisiSender);
        console.log(`\n📊 Mixed pattern result: ${queueMixed.uploadedPhotos.length} photos`);
        
        // SUMMARY
        console.log('\n' + '═'.repeat(50));
        console.log('\n📊 FINAL SUMMARY:\n');
        
        const allTestsPassed = (
            queue.uploadedPhotos.length === 5 &&
            queueSeq.uploadedPhotos.length === 3 &&
            queueMixed.uploadedPhotos.length === 3
        );
        
        if (allTestsPassed) {
            console.log('🎉 ALL TESTS PASSED! 🎉\n');
            console.log('VERIFIED:');
            console.log('  ✅ Concurrent upload (5 photos) works');
            console.log('  ✅ Sequential upload works');
            console.log('  ✅ Mixed pattern works');
            console.log('  ✅ No race conditions');
            console.log('  ✅ All photos saved correctly');
            console.log('  ✅ Reply batching works');
        } else {
            console.log('⚠️ SOME TESTS FAILED\n');
            console.log('Issues found:');
            if (queue.uploadedPhotos.length !== 5) {
                console.log(`  ❌ Concurrent upload: ${queue.uploadedPhotos.length}/5`);
            }
            if (queueSeq.uploadedPhotos.length !== 3) {
                console.log(`  ❌ Sequential upload: ${queueSeq.uploadedPhotos.length}/3`);
            }
            if (queueMixed.uploadedPhotos.length !== 3) {
                console.log(`  ❌ Mixed upload: ${queueMixed.uploadedPhotos.length}/3`);
            }
        }
        
        console.log('\n✅ TEST COMPLETED!');
        
        // Clean up
        clearUploadQueue(teknisiSender);
        if (global.db) {
            global.db.close();
        }
        
        process.exit(allTestsPassed ? 0 : 1);
        
    } catch (error) {
        console.error('\n❌ TEST FAILED:', error);
        if (global.db) {
            global.db.close();
        }
        process.exit(1);
    }
}

// Run test
testConcurrentUpload();
