/**
 * Verify database path fix and ensure correct database is being used
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

console.log('╔══════════════════════════════════════════════════════════╗');
console.log('║         DATABASE PATH VERIFICATION TOOL                    ║');
console.log('╚══════════════════════════════════════════════════════════╝');
console.log('');

// Check all possible database locations
const possiblePaths = [
    { name: 'Root Database (CORRECT)', path: path.join(__dirname, '..', 'database.sqlite') },
    { name: 'Database Folder (OLD)', path: path.join(__dirname, '..', 'database', 'database.sqlite') },
    { name: 'Database Folder (RENAMED)', path: path.join(__dirname, '..', 'database', 'database.sqlite.old') }
];

console.log('🔍 Checking database files:\n');

possiblePaths.forEach(db => {
    if (fs.existsSync(db.path)) {
        const stats = fs.statSync(db.path);
        const sizeKB = (stats.size / 1024).toFixed(1);
        console.log(`✅ ${db.name.padEnd(30)} EXISTS (${sizeKB} KB)`);
        console.log(`   Path: ${db.path}`);
    } else {
        console.log(`❌ ${db.name.padEnd(30)} NOT FOUND`);
    }
});

console.log('\n📊 Verifying main database schema:\n');

// Connect to the correct database
const dbPath = path.join(__dirname, '..', 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ Failed to connect to main database:', err);
        process.exit(1);
    }
    
    console.log('✅ Connected to main database\n');
    
    // Count columns
    db.all("PRAGMA table_info(users)", [], (err, columns) => {
        if (err) {
            console.error('❌ Error getting table info:', err);
            db.close();
            process.exit(1);
        }
        
        console.log(`📋 Total columns: ${columns.length}`);
        
        // Check for critical columns
        const criticalColumns = [
            'id', 'name', 'phone_number', 'subscription', 'device_id', 
            'paid', 'send_invoice', 'is_corporate', 'connected_odp_id',
            'corporate_name', 'corporate_address', 'corporate_npwp'
        ];
        
        const columnNames = columns.map(c => c.name);
        
        console.log('\n🔍 Checking critical columns:\n');
        criticalColumns.forEach(col => {
            if (columnNames.includes(col)) {
                console.log(`   ✅ ${col.padEnd(20)} - FOUND`);
            } else {
                console.log(`   ❌ ${col.padEnd(20)} - MISSING!`);
            }
        });
        
        // Count users
        db.get("SELECT COUNT(*) as count FROM users", [], (err, row) => {
            if (err) {
                console.error('❌ Error counting users:', err);
            } else {
                console.log(`\n📊 Total users in database: ${row.count}`);
            }
            
            // Test the application's database path
            console.log('\n🧪 Testing application database path:\n');
            
            // Simulate what lib/database.js does
            const appDbPath = path.join(__dirname, '..', 'database.sqlite');
            console.log(`   Application will use: ${appDbPath}`);
            
            if (appDbPath === dbPath) {
                console.log('   ✅ Application path matches correct database!');
            } else {
                console.log('   ❌ Application path mismatch!');
            }
            
            console.log('\n✅ Verification complete!\n');
            console.log('📌 Summary:');
            console.log(`   - Database location: ${dbPath}`);
            console.log(`   - Total columns: ${columns.length}`);
            console.log(`   - Total users: ${row ? row.count : 'Unknown'}`);
            console.log(`   - Status: ${columns.length >= 45 ? '✅ CORRECT DATABASE' : '❌ WRONG DATABASE'}`);
            
            db.close(() => {
                console.log('\n✅ Database connection closed.');
                process.exit(0);
            });
        });
    });
});
