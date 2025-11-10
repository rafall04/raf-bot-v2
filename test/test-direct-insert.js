/**
 * Test direct INSERT to see the actual error
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'database.sqlite');

console.log('🧪 Testing Direct INSERT Query\n');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ Failed to connect:', err);
        process.exit(1);
    }
    
    console.log('✅ Connected to database\n');
    
    // Test INSERT query exactly as in the code
    const insertQuery = `
        INSERT INTO users (
            id, name, phone_number, subscription, device_id, paid, 
            pppoe_username, pppoe_password, connected_odp_id, 
            send_invoice, is_corporate, corporate_name, 
            corporate_address, corporate_npwp, corporate_pic_name,
            corporate_pic_phone, corporate_pic_email
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const testData = [
        999,                    // id
        'Test User',           // name
        '081234567890',        // phone_number
        'Paket 20 Mbps',       // subscription
        'TEST123',             // device_id
        0,                     // paid
        'test_pppoe',          // pppoe_username
        'test_pass',           // pppoe_password
        null,                  // connected_odp_id
        1,                     // send_invoice
        0,                     // is_corporate
        null,                  // corporate_name
        null,                  // corporate_address
        null,                  // corporate_npwp
        null,                  // corporate_pic_name
        null,                  // corporate_pic_phone
        null                   // corporate_pic_email
    ];
    
    console.log('📋 Columns count:', 17);
    console.log('📋 Values count:', testData.length);
    console.log('📋 Match:', testData.length === 17 ? '✅' : '❌');
    
    console.log('\n🚀 Executing INSERT query...\n');
    
    db.run(insertQuery, testData, function(err) {
        if (err) {
            console.error('❌ INSERT failed with error:');
            console.error('   Error code:', err.code);
            console.error('   Error message:', err.message);
            console.error('   Full error:', err);
            
            // Try to identify the problem
            console.log('\n🔍 Debugging the error:\n');
            
            if (err.message.includes('has no column named')) {
                const match = err.message.match(/has no column named (\w+)/);
                if (match) {
                    console.log(`   Problem column: "${match[1]}"`);
                    console.log('\n   Checking if column exists...');
                    
                    db.get("SELECT name FROM pragma_table_info('users') WHERE name = ?", [match[1]], (err2, row) => {
                        if (err2) {
                            console.error('   Error checking column:', err2);
                        } else if (row) {
                            console.log(`   ✅ Column "${match[1]}" EXISTS in table!`);
                            console.log('   This might be a database connection or cache issue.');
                        } else {
                            console.log(`   ❌ Column "${match[1]}" does NOT exist in table!`);
                        }
                        
                        // Clean up test user if it was created
                        db.run('DELETE FROM users WHERE id = 999', () => {
                            db.close();
                            process.exit(1);
                        });
                    });
                } else {
                    db.close();
                    process.exit(1);
                }
            } else {
                db.close();
                process.exit(1);
            }
        } else {
            console.log('✅ INSERT successful!');
            console.log('   Row ID:', this.lastID);
            console.log('   Changes:', this.changes);
            
            // Clean up test data
            console.log('\n🧹 Cleaning up test data...');
            db.run('DELETE FROM users WHERE id = 999', (err) => {
                if (err) {
                    console.error('❌ Failed to clean up:', err);
                } else {
                    console.log('✅ Test data cleaned up');
                }
                
                db.close(() => {
                    console.log('\n✅ Test complete!');
                    process.exit(0);
                });
            });
        }
    });
});
