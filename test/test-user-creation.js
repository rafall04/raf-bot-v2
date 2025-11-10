#!/usr/bin/env node

/**
 * Test User Creation with All Fields
 * Verifies that database has all required columns
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'database.sqlite');
const db = new sqlite3.Database(dbPath);

console.log('Testing User Creation with All Fields');
console.log('=====================================\n');

// Test user data matching what the frontend sends
const testUser = {
    name: 'Test User Migration',
    device_id: 'TEST123',
    subscription: 'Paket-10Mbps',
    address: 'Test Address',
    latitude: -7.24139,
    longitude: 111.83833,
    pppoe_username: 'test_pppoe',
    pppoe_password: 'test_pass',
    phone_number: '6285233047095',
    paid: false,
    send_invoice: false,  // Critical field that was missing
    is_corporate: false,
    connected_odp_id: null,
    bulk: JSON.stringify([])
};

// First, check table structure
console.log('Checking table structure...');
db.all("PRAGMA table_info(users)", [], (err, tableInfo) => {
    if (err) {
        console.error('Error getting table info:', err);
        process.exit(1);
    }
    
    const columns = tableInfo.map(col => col.name);
    console.log(`Total columns: ${columns.length}`);
    
    // Check for critical fields
    const criticalFields = ['send_invoice', 'paid', 'is_corporate', 'bulk'];
    const missingCritical = criticalFields.filter(f => !columns.includes(f));
    
    if (missingCritical.length > 0) {
        console.error(`❌ Missing critical fields: ${missingCritical.join(', ')}`);
        console.error('Please run: node scripts/migrate-database.js');
        process.exit(1);
    }
    
    console.log('✅ All critical fields present\n');
    
    // Try to insert test user
    console.log('Testing user insertion...');
    const sql = `
        INSERT INTO users (
            name, device_id, subscription, address,
            latitude, longitude, pppoe_username, pppoe_password,
            phone_number, paid, send_invoice, is_corporate,
            connected_odp_id, bulk, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `;
    
    const values = [
        testUser.name,
        testUser.device_id,
        testUser.subscription,
        testUser.address,
        testUser.latitude,
        testUser.longitude,
        testUser.pppoe_username,
        testUser.pppoe_password,
        testUser.phone_number,
        testUser.paid ? 1 : 0,
        testUser.send_invoice ? 1 : 0,  // Critical field
        testUser.is_corporate ? 1 : 0,
        testUser.connected_odp_id,
        testUser.bulk
    ];
    
    db.run(sql, values, function(err) {
        if (err) {
            console.error('❌ Failed to insert user:', err.message);
            if (err.message.includes('no column named send_invoice')) {
                console.error('\n⚠️  The send_invoice column is missing!');
                console.error('Run: node scripts/migrate-database.js');
            }
            db.close();
            process.exit(1);
        }
        
        console.log(`✅ User inserted successfully with ID: ${this.lastID}`);
        
        // Verify the user was created correctly
        db.get('SELECT * FROM users WHERE id = ?', [this.lastID], (err, row) => {
            if (err) {
                console.error('Error fetching user:', err);
                db.close();
                process.exit(1);
            }
            
            console.log('\nVerifying inserted data:');
            console.log(`  Name: ${row.name}`);
            console.log(`  Phone: ${row.phone_number}`);
            console.log(`  Send Invoice: ${row.send_invoice === 1 ? 'Yes' : 'No'}`);
            console.log(`  Paid: ${row.paid === 1 ? 'Yes' : 'No'}`);
            console.log(`  Is Corporate: ${row.is_corporate === 1 ? 'Yes' : 'No'}`);
            
            // Clean up test user
            db.run('DELETE FROM users WHERE id = ?', [this.lastID], (err) => {
                if (!err) {
                    console.log('\n✅ Test user cleaned up');
                }
                
                console.log('\n=====================================');
                console.log('✅ All tests passed! Database is ready.');
                console.log('You can now create users without errors.');
                
                db.close();
                process.exit(0);
            });
        });
    });
});
