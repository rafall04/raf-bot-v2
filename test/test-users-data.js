/**
 * Test Users Data Loading
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Connect to database
const dbPath = path.join(__dirname, '..', 'database.sqlite');
const db = new sqlite3.Database(dbPath);

console.log('🔍 CHECKING USERS TABLE IN SQLITE');
console.log('=' .repeat(60));

// Check table structure
db.all("PRAGMA table_info(users)", [], (err, columns) => {
    if (err) {
        console.error('❌ Error checking table structure:', err);
        return;
    }
    
    console.log('\n📋 TABLE STRUCTURE:');
    console.log('-'.repeat(40));
    columns.forEach(col => {
        console.log(`  ${col.name} (${col.type})${col.pk ? ' [PRIMARY KEY]' : ''}`);
    });
    
    // Check data
    db.all("SELECT * FROM users LIMIT 5", [], (err, users) => {
        if (err) {
            console.error('❌ Error loading users:', err);
            db.close();
            return;
        }
        
        console.log('\n📊 USERS DATA (First 5):');
        console.log('-'.repeat(40));
        
        if (users.length === 0) {
            console.log('⚠️  NO USERS FOUND IN DATABASE!');
        } else {
            users.forEach(user => {
                console.log(`\nID: ${user.id}`);
                console.log(`Name: ${user.name || '❌ MISSING'}`);
                console.log(`Username: ${user.username || '❌ MISSING'}`);
                console.log(`Phone: ${user.phone_number || '❌ MISSING'}`);
                console.log(`Address: ${user.address || '-'}`);
                console.log(`Device ID: ${user.device_id || '-'}`);
                console.log(`Subscription: ${user.subscription || '-'}`);
                console.log(`Status: ${user.status || '-'}`);
                console.log('-'.repeat(30));
            });
        }
        
        // Count total
        db.get("SELECT COUNT(*) as count FROM users", [], (err, result) => {
            if (!err) {
                console.log(`\n📈 TOTAL USERS: ${result.count}`);
            }
            
            db.close();
            
            console.log('\n✅ TEST COMPLETE');
            console.log('\nISSUES TO CHECK:');
            console.log('1. If "Name" is missing → Need to add/populate name field');
            console.log('2. If no users → Need to insert test data');
            console.log('3. Check field names match DataTable columns');
        });
    });
});
