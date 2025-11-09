/**
 * Test migration readiness
 * Checks SQLite version and capabilities
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Database path
const DB_PATH = path.join(__dirname, '../database/database.sqlite');

console.log('═══════════════════════════════════════════');
console.log('    MIGRATION READINESS TEST');
console.log('═══════════════════════════════════════════');
console.log();

// Check if database exists
if (!fs.existsSync(DB_PATH)) {
  console.error('❌ Database not found at:', DB_PATH);
  process.exit(1);
}

console.log('✅ Database found at:', DB_PATH);

// Connect to database
const db = new sqlite3.Database(DB_PATH);

// Test functions
async function testDatabase() {
  return new Promise((resolve, reject) => {
    // Check SQLite version
    db.get('SELECT sqlite_version() as version', (err, row) => {
      if (err) {
        console.error('❌ Failed to get SQLite version:', err);
        reject(err);
        return;
      }
      
      console.log('✅ SQLite version:', row.version);
      
      // Check users table structure
      db.all("PRAGMA table_info(users)", (err, columns) => {
        if (err) {
          console.error('❌ Failed to get table info:', err);
          reject(err);
          return;
        }
        
        console.log('\n📋 Current users table structure:');
        console.log('   Total columns:', columns.length);
        
        // List all columns
        console.log('\n   Existing columns:');
        columns.forEach(col => {
          console.log(`   - ${col.name} (${col.type})${col.notnull ? ' NOT NULL' : ''}${col.dflt_value ? ` DEFAULT ${col.dflt_value}` : ''}`);
        });
        
        // Check for specific fields that might be missing
        const requiredFields = [
          'status', 'subscription_price', 'payment_due_date',
          'registration_date', 'created_at', 'updated_at',
          'is_paid', 'auto_isolir', 'compensation_minutes'
        ];
        
        const existingColumnNames = columns.map(col => col.name);
        const missingFields = requiredFields.filter(field => !existingColumnNames.includes(field));
        
        if (missingFields.length > 0) {
          console.log('\n⚠️ Missing fields that will be added:');
          missingFields.forEach(field => {
            console.log(`   - ${field}`);
          });
        } else {
          console.log('\n✅ All required fields already exist');
        }
        
        // Test ALTER TABLE capability
        console.log('\n🔧 Testing ALTER TABLE capability...');
        
        // Try to create a test table and add column
        db.run('CREATE TABLE IF NOT EXISTS _test_table (id INTEGER PRIMARY KEY)', (err) => {
          if (err) {
            console.error('❌ Failed to create test table:', err);
            reject(err);
            return;
          }
          
          // Try adding column with NULL default (should work)
          db.run('ALTER TABLE _test_table ADD COLUMN test_col TEXT DEFAULT NULL', (err) => {
            if (err) {
              console.error('❌ ALTER TABLE with NULL default failed:', err);
              reject(err);
              return;
            }
            
            console.log('✅ ALTER TABLE with NULL default: OK');
            
            // Try adding column with constant default (should work)
            db.run("ALTER TABLE _test_table ADD COLUMN test_col2 TEXT DEFAULT 'test'", (err) => {
              if (err) {
                console.error('❌ ALTER TABLE with constant default failed:', err);
                reject(err);
                return;
              }
              
              console.log('✅ ALTER TABLE with constant default: OK');
              
              // Clean up test table
              db.run('DROP TABLE IF EXISTS _test_table', (err) => {
                if (err) {
                  console.error('⚠️ Failed to clean up test table:', err);
                }
                
                console.log('\n✅ Database is ready for migration!');
                resolve();
              });
            });
          });
        });
      });
    });
  });
}

// Run tests
testDatabase()
  .then(() => {
    console.log('\n═══════════════════════════════════════════');
    console.log('    MIGRATION READINESS: PASSED ✅');
    console.log('═══════════════════════════════════════════');
    console.log('\nYou can now run: node scripts\\migrate.js');
    db.close();
  })
  .catch((err) => {
    console.error('\n═══════════════════════════════════════════');
    console.error('    MIGRATION READINESS: FAILED ❌');
    console.error('═══════════════════════════════════════════');
    console.error('\nPlease fix the issues above before running migration.');
    db.close();
    process.exit(1);
  });
