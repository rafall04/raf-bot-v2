/**
 * Migration Script: Create Users Table
 * Run this to create the users table in SQLite database
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Database path
const dbPath = path.join(__dirname, '..', 'database.sqlite');
const sqlFile = path.join(__dirname, 'create-users-table.sql');

console.log('🔧 SQLITE MIGRATION: Create Users Table');
console.log('=' .repeat(60));

// Read SQL file
const sql = fs.readFileSync(sqlFile, 'utf8');

// Connect to database
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ Failed to connect to database:', err);
        process.exit(1);
    }
    console.log('✅ Connected to database:', dbPath);
});

// Execute migration
db.exec(sql, (err) => {
    if (err) {
        console.error('❌ Migration failed:', err);
        db.close();
        process.exit(1);
    }
    
    console.log('✅ Migration successful!');
    console.log('\n📋 CREATED:');
    console.log('  - Table: users');
    console.log('  - Indexes: phone, device, username, pppoe');
    console.log('  - Sample data: 2 test users');
    
    // Verify table was created
    db.all("SELECT * FROM users", [], (err, users) => {
        if (err) {
            console.error('❌ Error verifying table:', err);
        } else {
            console.log(`\n📊 Users in database: ${users.length}`);
            users.forEach(user => {
                console.log(`  - ${user.name} (${user.username})`);
            });
        }
        
        db.close((err) => {
            if (err) {
                console.error('Error closing database:', err);
            }
            console.log('\n✅ MIGRATION COMPLETE!');
            console.log('\n🚀 NEXT STEPS:');
            console.log('1. Restart the application: npm start');
            console.log('2. Login to admin panel');
            console.log('3. Go to Users page to see the data');
        });
    });
});
