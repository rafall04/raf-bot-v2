/**
 * Check actual database column structure
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'database.sqlite');

console.log('🔍 Checking Database Column Structure\n');
console.log('Database:', dbPath);
console.log('=====================================\n');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ Failed to connect:', err);
        process.exit(1);
    }
    
    // Get table info
    db.all("PRAGMA table_info(users)", [], (err, columns) => {
        if (err) {
            console.error('❌ Error getting table info:', err);
            db.close();
            process.exit(1);
        }
        
        console.log(`📊 Found ${columns.length} columns in users table:\n`);
        
        // List all columns
        columns.forEach((col, index) => {
            console.log(`${(index + 1).toString().padStart(2, ' ')}. ${col.name.padEnd(25)} ${col.type.padEnd(15)} ${col.notnull ? 'NOT NULL' : 'NULL'}     ${col.dflt_value ? `DEFAULT: ${col.dflt_value}` : ''}`);
        });
        
        // Check for specific columns mentioned in the error
        console.log('\n🔍 Checking for columns used in INSERT query:\n');
        
        const requiredColumns = [
            'id', 'name', 'phone_number', 'subscription', 'device_id', 'paid',
            'pppoe_username', 'pppoe_password', 'connected_odp_id',
            'send_invoice', 'is_corporate', 'corporate_name',
            'corporate_address', 'corporate_npwp', 'corporate_pic_name',
            'corporate_pic_phone', 'corporate_pic_email'
        ];
        
        const columnNames = columns.map(c => c.name);
        const missing = [];
        const found = [];
        
        requiredColumns.forEach(col => {
            if (columnNames.includes(col)) {
                found.push(col);
                console.log(`✅ ${col.padEnd(25)} - FOUND`);
            } else {
                missing.push(col);
                console.log(`❌ ${col.padEnd(25)} - MISSING!`);
            }
        });
        
        if (missing.length > 0) {
            console.log(`\n⚠️ WARNING: ${missing.length} columns are MISSING from the database!`);
            console.log('Missing columns:', missing.join(', '));
            console.log('\n💡 Solution: Need to add these missing columns to the database.');
            
            // Generate ALTER TABLE statements
            console.log('\n📝 SQL statements to add missing columns:\n');
            missing.forEach(col => {
                let dataType = 'TEXT';
                let defaultValue = 'NULL';
                
                // Determine appropriate data type and default
                if (col === 'send_invoice' || col === 'is_corporate' || col === 'paid') {
                    dataType = 'INTEGER';
                    defaultValue = 'DEFAULT 0';
                } else if (col === 'connected_odp_id') {
                    dataType = 'INTEGER';
                    defaultValue = 'DEFAULT NULL';
                }
                
                console.log(`ALTER TABLE users ADD COLUMN ${col} ${dataType} ${defaultValue};`);
            });
        } else {
            console.log('\n✅ All required columns exist in the database!');
        }
        
        db.close(() => {
            console.log('\n✅ Database check complete.');
            process.exit(0);
        });
    });
});
