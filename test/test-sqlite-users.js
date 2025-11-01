/**
 * Test to verify users are loaded from SQLite, not users.json
 * This test shows the actual database structure and data
 */

const path = require('path');
const sqlite3 = require('sqlite3').verbose();

console.log('🧪 TEST SQLite USERS LOADING\n');
console.log('=' .repeat(50) + '\n');

// Connect to SQLite database
const dbPath = path.join(__dirname, '../database/database.sqlite');
console.log(`📂 Database path: ${dbPath}\n`);

const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
    if (err) {
        console.error('❌ Error opening database:', err.message);
        process.exit(1);
    }
    
    console.log('✅ Connected to SQLite database\n');
    
    // Check schema
    console.log('━'.repeat(50));
    console.log('\n📋 USERS TABLE SCHEMA:\n');
    
    db.all("PRAGMA table_info(users)", [], (err, columns) => {
        if (err) {
            console.error('Error getting table info:', err.message);
            db.close();
            return;
        }
        
        console.log('Columns in users table:');
        columns.forEach(col => {
            console.log(`  • ${col.name} (${col.type})`);
        });
        
        // Get sample users
        console.log('\n━'.repeat(50));
        console.log('\n📋 SAMPLE USERS FROM DATABASE:\n');
        
        db.all('SELECT id, name, username, phone_number, address, device_id FROM users LIMIT 5', [], (err, rows) => {
            if (err) {
                console.error('Error loading users:', err.message);
                db.close();
                return;
            }
            
            console.log(`Found ${rows.length} users in database\n`);
            
            if (rows.length === 0) {
                console.log('⚠️ WARNING: No users found in database!');
                console.log('This is why pelanggan name shows as "Customer"\n');
                
                console.log('To add users, you need to:');
                console.log('1. Use the admin panel to add users');
                console.log('2. Or directly insert into SQLite database');
                console.log('3. Make sure each user has:');
                console.log('   - name: Display name');
                console.log('   - phone_number: Phone number(s) separated by |');
                console.log('   - device_id: For device status checking');
            } else {
                rows.forEach((user, index) => {
                    console.log(`User ${index + 1}:`);
                    console.log(`  ID: ${user.id}`);
                    console.log(`  Name: ${user.name || 'NULL'}`);
                    console.log(`  Username: ${user.username || 'NULL'}`);
                    console.log(`  Phone: ${user.phone_number || 'NULL'}`);
                    console.log(`  Address: ${user.address || 'NULL'}`);
                    console.log(`  Device: ${user.device_id || 'NULL'}`);
                    console.log('');
                });
            }
            
            // Test phone number matching
            console.log('━'.repeat(50));
            console.log('\n🧪 TEST PHONE MATCHING WITH SQLite DATA:\n');
            
            const testSender = '6285233047094';
            console.log(`Test WhatsApp sender: ${testSender}\n`);
            
            // Find user by phone
            const query = `
                SELECT * FROM users 
                WHERE phone_number LIKE '%' || ? || '%'
                   OR phone_number LIKE '%' || SUBSTR(?, 3) || '%'
                   OR phone_number = ?
            `;
            
            db.get(query, [testSender, testSender, testSender], (err, user) => {
                if (err) {
                    console.error('Error finding user:', err.message);
                } else if (!user) {
                    console.log(`❌ No user found for ${testSender}`);
                    console.log('\nPossible reasons:');
                    console.log('• Phone number not registered');
                    console.log('• Phone format mismatch (08 vs 628)');
                    console.log('• Phone stored differently in database');
                } else {
                    console.log(`✅ USER FOUND!`);
                    console.log(`  Name: ${user.name}`);
                    console.log(`  ID: ${user.id}`);
                    console.log(`  Phone: ${user.phone_number}`);
                }
                
                // Check how global.users is loaded
                console.log('\n━'.repeat(50));
                console.log('\n📊 HOW SYSTEM LOADS USERS:\n');
                
                console.log('1. System startup: initializeDatabase() in lib/database.js');
                console.log('2. SQLite query: SELECT * FROM users');
                console.log('3. Load into memory: global.users = rows');
                console.log('4. Handlers use: global.users.find() to search');
                console.log('');
                console.log('⚠️ IMPORTANT: Do NOT use users.json anymore!');
                console.log('All user data is in SQLite database.');
                
                // Summary
                console.log('\n' + '═'.repeat(50));
                console.log('\n💡 KEY FINDINGS:\n');
                
                if (rows.length === 0) {
                    console.log('❌ CRITICAL: SQLite users table is EMPTY!');
                    console.log('   This is why names show as "Customer"');
                    console.log('   You need to add users to the database.');
                } else {
                    const usersWithName = rows.filter(u => u.name).length;
                    const usersWithPhone = rows.filter(u => u.phone_number).length;
                    
                    console.log(`✅ ${rows.length} users in SQLite database`);
                    console.log(`   • ${usersWithName} have name field`);
                    console.log(`   • ${usersWithPhone} have phone_number field`);
                    
                    if (usersWithName < rows.length) {
                        console.log('\n⚠️ WARNING: Some users missing name field!');
                        console.log('   These will show as "Customer"');
                    }
                }
                
                console.log('\n✅ TEST COMPLETED!');
                db.close();
            });
        });
    });
});

// Timeout safety
setTimeout(() => {
    console.error('\n❌ Test timeout after 5 seconds');
    process.exit(1);
}, 5000);
