/**
 * Test Database Schema
 * Verifies that all required columns exist in the database
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Database path
const dbPath = path.join(__dirname, '..', 'database.sqlite');

console.log('');
console.log('DATABASE SCHEMA TEST');
console.log('=' .repeat(60));
console.log('');

// Check if database exists
if (!fs.existsSync(dbPath)) {
    console.error('❌ Database not found at:', dbPath);
    process.exit(1);
}

// Connect to database
const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
    if (err) {
        console.error('❌ Failed to connect to database:', err);
        process.exit(1);
    }
    console.log('✅ Connected to database');
});

// Required columns for user creation
const REQUIRED_COLUMNS = [
    'id', 'name', 'phone_number', 'address', 'latitude', 'longitude',
    'subscription', 'device_id', 'paid', 'send_invoice', 'is_corporate',
    'pppoe_username', 'pppoe_password', 'connected_odp_id', 'bulk',
    'corporate_name', 'corporate_address', 'corporate_npwp',
    'corporate_pic_name', 'corporate_pic_phone', 'corporate_pic_email'
];

// Test function
async function testSchema() {
    try {
        // Get current schema
        const columns = await new Promise((resolve, reject) => {
            db.all("PRAGMA table_info(users)", [], (err, columns) => {
                if (err) reject(err);
                else resolve(columns);
            });
        });
        
        console.log('');
        console.log('📋 CURRENT SCHEMA:');
        console.log('-' .repeat(60));
        
        const columnMap = {};
        columns.forEach(col => {
            columnMap[col.name.toLowerCase()] = col;
            console.log(`  ${col.name.padEnd(25)} ${col.type.padEnd(15)} ${col.notnull ? 'NOT NULL' : 'NULL'.padEnd(8)} ${col.dflt_value || ''}`);
        });
        
        console.log('');
        console.log('🔍 CHECKING REQUIRED COLUMNS:');
        console.log('-' .repeat(60));
        
        let missingColumns = [];
        let presentColumns = [];
        
        REQUIRED_COLUMNS.forEach(colName => {
            if (columnMap[colName.toLowerCase()]) {
                presentColumns.push(colName);
                console.log(`  ✅ ${colName}`);
            } else {
                missingColumns.push(colName);
                console.log(`  ❌ ${colName} - MISSING`);
            }
        });
        
        console.log('');
        console.log('📊 SUMMARY:');
        console.log('-' .repeat(60));
        console.log(`  Total columns in table: ${columns.length}`);
        console.log(`  Required columns present: ${presentColumns.length}/${REQUIRED_COLUMNS.length}`);
        console.log(`  Missing columns: ${missingColumns.length}`);
        
        if (missingColumns.length > 0) {
            console.log('');
            console.log('⚠️  MIGRATION NEEDED!');
            console.log('  Run: node tools\\smart-migrate-database.js');
            console.log('  Or: migrate-database.bat');
        } else {
            console.log('');
            console.log('✅ DATABASE SCHEMA IS COMPLETE!');
        }
        
        // Test a sample insert to see what errors we get
        console.log('');
        console.log('🧪 TESTING INSERT CAPABILITY:');
        console.log('-' .repeat(60));
        
        const testData = {
            name: 'TEST_USER_' + Date.now(),
            phone_number: '628' + Math.random().toString().slice(2, 12),
            address: 'Test Address',
            latitude: -7.251558,
            longitude: 111.856845,
            subscription: 'Paket-10Mbps',
            device_id: 'TEST_' + Date.now(),
            paid: 0,
            send_invoice: 1,
            is_corporate: 0,
            pppoe_username: 'test_pppoe',
            pppoe_password: 'test_pass',
            connected_odp_id: null,
            bulk: null
        };
        
        // Build INSERT statement based on existing columns
        const insertColumns = [];
        const insertValues = [];
        const insertPlaceholders = [];
        
        Object.keys(testData).forEach(key => {
            if (columnMap[key.toLowerCase()]) {
                insertColumns.push(key);
                insertValues.push(testData[key]);
                insertPlaceholders.push('?');
            }
        });
        
        const insertSQL = `INSERT INTO users (${insertColumns.join(', ')}) VALUES (${insertPlaceholders.join(', ')})`;
        
        await new Promise((resolve) => {
            db.run(insertSQL, insertValues, function(err) {
                if (err) {
                    console.log(`  ❌ Insert test failed: ${err.message}`);
                    
                    // Parse error to identify missing columns
                    if (err.message.includes('no column named')) {
                        const match = err.message.match(/no column named (\w+)/);
                        if (match) {
                            console.log(`     Missing column detected: ${match[1]}`);
                        }
                    }
                } else {
                    console.log(`  ✅ Insert test successful! (ID: ${this.lastID})`);
                    
                    // Clean up test data
                    db.run(`DELETE FROM users WHERE id = ?`, [this.lastID], (delErr) => {
                        if (!delErr) {
                            console.log(`  🧹 Test data cleaned up`);
                        }
                    });
                }
                resolve();
            });
        });
        
        console.log('');
        console.log('=' .repeat(60));
        console.log('TEST COMPLETE');
        console.log('');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    } finally {
        db.close();
    }
}

// Run test
testSchema();
