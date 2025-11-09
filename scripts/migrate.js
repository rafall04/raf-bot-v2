/**
 * Database Migration Runner
 * Handles SQLite database schema updates for production
 */

const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

// Database path
const DB_PATH = path.join(__dirname, '../database/database.sqlite');
const MIGRATIONS_DIR = path.join(__dirname, '../database/migrations');

// Initialize database
const db = new sqlite3.Database(DB_PATH);

// Promisify database methods
const runAsync = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
};

const allAsync = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

// Create migrations table if not exists
async function setupMigrationsTable() {
  await runAsync(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

// Get executed migrations
async function getExecutedMigrations() {
  const rows = await allAsync('SELECT name FROM _migrations ORDER BY name');
  return rows.map(r => r.name);
}

// Mark migration as executed
async function markMigrationExecuted(name) {
  await runAsync('INSERT INTO _migrations (name) VALUES (?)', [name]);
}

// Get pending migrations
async function getPendingMigrations() {
  // Ensure migrations directory exists
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    fs.mkdirSync(MIGRATIONS_DIR, { recursive: true });
    return [];
  }
  
  const executed = await getExecutedMigrations();
  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.js'))
    .sort();
  
  return files.filter(f => !executed.includes(f));
}

// Run a single migration
async function runMigration(filename) {
  const migrationPath = path.join(MIGRATIONS_DIR, filename);
  
  console.log(`\n🔄 Running migration: ${filename}`);
  
  try {
    const migration = require(migrationPath);
    
    if (!migration.up) {
      throw new Error(`Migration ${filename} does not have an 'up' method`);
    }
    
    // Run the migration
    await migration.up({ 
      context: { 
        run: runAsync, 
        all: allAsync,
        db: db 
      } 
    });
    
    // Mark as executed
    await markMigrationExecuted(filename);
    
    console.log(`✅ Migration ${filename} completed successfully`);
    
  } catch (error) {
    console.error(`❌ Migration ${filename} failed:`, error.message);
    throw error;
  }
}

// Run all pending migrations
async function runMigrations() {
  console.log('═══════════════════════════════════════════');
  console.log('    DATABASE MIGRATION RUNNER');
  console.log('═══════════════════════════════════════════\n');
  
  try {
    // Check if database exists
    if (!fs.existsSync(DB_PATH)) {
      console.log('❌ Database file not found at:', DB_PATH);
      console.log('Please ensure database.sqlite exists in the database/ directory');
      process.exit(1);
    }
    
    console.log('📂 Database location:', DB_PATH);
    console.log('📂 Migrations folder:', MIGRATIONS_DIR);
    
    // Setup migrations table
    await setupMigrationsTable();
    
    // Get pending migrations
    const pending = await getPendingMigrations();
    
    if (pending.length === 0) {
      console.log('\n✅ No pending migrations. Database is up to date!');
      return;
    }
    
    console.log(`\n📋 Found ${pending.length} pending migration(s):`);
    pending.forEach((m, i) => console.log(`   ${i + 1}. ${m}`));
    
    // Run each migration
    for (const migration of pending) {
      await runMigration(migration);
    }
    
    console.log('\n═══════════════════════════════════════════');
    console.log(`✅ All migrations completed successfully!`);
    console.log(`   Total migrations run: ${pending.length}`);
    console.log('═══════════════════════════════════════════');
    
  } catch (error) {
    console.error('\n❌ Migration process failed:', error);
    console.error('\nPlease fix the error and try again.');
    process.exit(1);
    
  } finally {
    // Close database connection
    db.close();
  }
}

// Command line interface
async function cli() {
  const command = process.argv[2];
  
  switch (command) {
    case 'status':
      await showStatus();
      break;
      
    case 'list':
      await listMigrations();
      break;
      
    case 'create':
      const name = process.argv[3];
      await createMigration(name);
      break;
      
    default:
      // Run migrations by default
      await runMigrations();
  }
}

// Show migration status
async function showStatus() {
  console.log('\n📊 MIGRATION STATUS\n');
  
  try {
    await setupMigrationsTable();
    
    const executed = await getExecutedMigrations();
    const pending = await getPendingMigrations();
    
    console.log(`✅ Executed migrations: ${executed.length}`);
    if (executed.length > 0) {
      executed.forEach(m => console.log(`   - ${m}`));
    }
    
    console.log(`\n⏳ Pending migrations: ${pending.length}`);
    if (pending.length > 0) {
      pending.forEach(m => console.log(`   - ${m}`));
    }
    
  } finally {
    db.close();
  }
}

// List all migrations
async function listMigrations() {
  console.log('\n📋 ALL MIGRATIONS\n');
  
  try {
    await setupMigrationsTable();
    
    const executed = await getExecutedMigrations();
    
    if (!fs.existsSync(MIGRATIONS_DIR)) {
      console.log('No migrations directory found');
      return;
    }
    
    const files = fs.readdirSync(MIGRATIONS_DIR)
      .filter(f => f.endsWith('.js'))
      .sort();
    
    files.forEach(f => {
      const status = executed.includes(f) ? '✅' : '⏳';
      console.log(`${status} ${f}`);
    });
    
    console.log(`\nTotal: ${files.length} migrations`);
    
  } finally {
    db.close();
  }
}

// Create a new migration file
async function createMigration(name) {
  if (!name) {
    console.error('Please provide a migration name');
    console.log('Usage: node migrate.js create <name>');
    process.exit(1);
  }
  
  // Ensure migrations directory exists
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    fs.mkdirSync(MIGRATIONS_DIR, { recursive: true });
  }
  
  // Generate timestamp
  const timestamp = new Date().toISOString()
    .replace(/[-:]/g, '')
    .replace('T', '')
    .replace(/\..+/, '');
  
  // Create filename
  const filename = `${timestamp}-${name.replace(/\s+/g, '-').toLowerCase()}.js`;
  const filepath = path.join(MIGRATIONS_DIR, filename);
  
  // Migration template
  const template = `/**
 * Migration: ${name}
 * Date: ${new Date().toISOString().split('T')[0]}
 * Description: [Add description here]
 */

module.exports = {
  up: async ({ context: db }) => {
    // Add your migration code here
    console.log('Running migration: ${name}');
    
    // Example: Add a column
    // await db.run("ALTER TABLE users ADD COLUMN new_field TEXT DEFAULT NULL");
    
    console.log('✅ Migration ${name} completed');
  },
  
  down: async ({ context: db }) => {
    // Add rollback code here (optional)
    console.log('⚠️ Rollback not implemented for ${name}');
  }
};`;
  
  // Write file
  fs.writeFileSync(filepath, template);
  
  console.log(`\n✅ Created migration: ${filename}`);
  console.log(`   Location: ${filepath}`);
  console.log('\nEdit the file to add your migration code.');
  
  db.close();
}

// Run CLI
if (require.main === module) {
  cli().catch(error => {
    console.error('Fatal error:', error);
    db.close();
    process.exit(1);
  });
}

module.exports = { runMigrations, getPendingMigrations };
