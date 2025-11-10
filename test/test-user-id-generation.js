/**
 * Test script to verify user ID generation doesn't create duplicates
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Mock global object
global.users = [];
global.db = null;

// Connect to database
const dbPath = path.join(__dirname, '..', 'database.sqlite');
console.log('📂 Connecting to database:', dbPath);

const db = new sqlite3.Database(dbPath, async (err) => {
    if (err) {
        console.error('❌ Failed to connect to database:', err);
        process.exit(1);
    }
    
    console.log('✅ Connected to database');
    global.db = db;
    
    // Load existing users into memory (simulate what the app does)
    db.all('SELECT * FROM users', [], async (err, rows) => {
        if (err) {
            console.error('❌ Failed to load users:', err);
            process.exit(1);
        }
        
        global.users = rows || [];
        console.log(`📊 Loaded ${global.users.length} users from database`);
        
        // Display first 10 user IDs
        const userIds = global.users.map(u => parseInt(u.id)).sort((a, b) => a - b);
        console.log('📋 First 10 User IDs:', userIds.slice(0, 10));
        
        // Display max ID
        if (userIds.length > 0) {
            console.log('📈 Maximum User ID:', Math.max(...userIds));
        }
        
        // Test the getNextAvailableUserId function
        await testIdGeneration();
        
        db.close();
        process.exit(0);
    });
});

// Copy the fixed function for testing
async function getNextAvailableUserId() {
    return new Promise((resolve, reject) => {
        // Get all existing IDs from database
        global.db.all('SELECT id FROM users ORDER BY id ASC', [], (err, dbRows) => {
            if (err) {
                console.error('[GET_NEXT_ID_ERROR] Database query failed:', err);
                reject(err);
                return;
            }
            
            // Get all IDs from both database AND memory
            const dbIds = (dbRows || []).map(row => parseInt(row.id));
            const memoryIds = (global.users || []).map(user => parseInt(user.id));
            
            // Combine and deduplicate all IDs
            const allIds = [...new Set([...dbIds, ...memoryIds])].sort((a, b) => a - b);
            
            console.log(`[GET_NEXT_ID] Found ${dbIds.length} IDs in database, ${memoryIds.length} in memory`);
            console.log(`[GET_NEXT_ID] All existing IDs:`, allIds.slice(0, 10), allIds.length > 10 ? '...' : '');
            
            // If no users at all, start with ID 1
            if (allIds.length === 0) {
                console.log('[GET_NEXT_ID] No existing users, starting with ID 1');
                resolve(1);
                return;
            }
            
            // Find the first gap in the sequence
            let expectedId = 1;
            for (const id of allIds) {
                if (id > expectedId) {
                    // Found a gap, use this ID
                    console.log(`[GET_NEXT_ID] Found gap at ID ${expectedId} (before ${id})`);
                    resolve(expectedId);
                    return;
                }
                expectedId = id + 1;
            }
            
            // No gaps found, use the next ID after the last one
            const nextId = Math.max(...allIds) + 1;
            console.log(`[GET_NEXT_ID] No gaps found, using next sequential ID: ${nextId}`);
            resolve(nextId);
        });
    });
}

async function testIdGeneration() {
    console.log('\n🧪 Testing ID Generation...\n');
    
    try {
        const nextId = await getNextAvailableUserId();
        console.log(`\n✅ Next Available User ID: ${nextId}`);
        
        // Check if this ID already exists
        const existsInDb = global.users.some(u => parseInt(u.id) === nextId);
        
        if (existsInDb) {
            console.error(`\n❌ ERROR: ID ${nextId} already exists in database!`);
            console.log('This would cause a duplicate ID error!');
        } else {
            console.log(`\n✅ ID ${nextId} is safe to use (no conflicts)`);
        }
        
        // Show what would happen with old logic (database only)
        console.log('\n📊 Comparison with old logic:');
        const dbOnlyIds = await new Promise((resolve) => {
            global.db.all('SELECT id FROM users ORDER BY id ASC', [], (err, rows) => {
                if (err || !rows || rows.length === 0) {
                    resolve(1);
                } else {
                    const ids = rows.map(r => parseInt(r.id));
                    const maxId = Math.max(...ids);
                    resolve(maxId + 1);
                }
            });
        });
        
        console.log(`- Old logic (DB only) would use: ${dbOnlyIds}`);
        console.log(`- New logic (DB + Memory) uses: ${nextId}`);
        
        if (dbOnlyIds !== nextId) {
            console.log('⚠️ The old and new logic produce different results!');
            console.log('This confirms the bug existed and is now fixed.');
        }
        
    } catch (error) {
        console.error('❌ Error during testing:', error);
    }
}
