/**
 * Check SQLite Tables
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Connect to database
const dbPath = path.join(__dirname, '..', 'database.sqlite');
const db = new sqlite3.Database(dbPath);

console.log('🗄️  CHECKING SQLITE DATABASE');
console.log('=' .repeat(60));
console.log(`Database path: ${dbPath}`);

// List all tables
db.all("SELECT name FROM sqlite_master WHERE type='table'", [], (err, tables) => {
    if (err) {
        console.error('❌ Error listing tables:', err);
        db.close();
        return;
    }
    
    console.log('\n📋 TABLES FOUND:');
    console.log('-'.repeat(40));
    
    if (tables.length === 0) {
        console.log('⚠️  NO TABLES FOUND! Database is empty.');
        console.log('\n🔧 SOLUTION:');
        console.log('1. Run migration script to create tables');
        console.log('2. Or manually create users table');
    } else {
        tables.forEach(table => {
            console.log(`  - ${table.name}`);
        });
    }
    
    db.close();
    
    console.log('\n✅ CHECK COMPLETE');
});
