/**
 * Backup Script for RAF Bot V2
 * Creates automated backups of database and config files
 */

const fs = require('fs-extra');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

// Configuration
const BACKUP_DIR = process.env.BACKUP_DIR || path.join(__dirname, '../../backups');
const RETENTION_DAYS = parseInt(process.env.BACKUP_RETENTION_DAYS) || 30;
const PROJECT_DIR = path.join(__dirname, '..');

// Ensure backup directory exists
fs.ensureDirSync(BACKUP_DIR);

/**
 * Create timestamp string
 */
function getTimestamp() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hour = String(now.getHours()).padStart(2, '0');
  const minute = String(now.getMinutes()).padStart(2, '0');
  const second = String(now.getSeconds()).padStart(2, '0');
  
  return `${year}${month}${day}_${hour}${minute}${second}`;
}

/**
 * Create backup
 */
async function createBackup() {
  const timestamp = getTimestamp();
  const backupName = `backup-${timestamp}`;
  const backupPath = path.join(BACKUP_DIR, backupName);
  
  console.log('═══════════════════════════════════════════');
  console.log('    RAF BOT V2 - BACKUP UTILITY');
  console.log('═══════════════════════════════════════════');
  console.log();
  console.log(`📅 Timestamp: ${timestamp}`);
  console.log(`📁 Backup location: ${backupPath}`);
  console.log();
  
  try {
    // Create backup directory
    console.log('📦 Creating backup directory...');
    await fs.ensureDir(backupPath);
    
    // Backup database folder
    const dbSource = path.join(PROJECT_DIR, 'database');
    const dbDest = path.join(backupPath, 'database');
    
    if (await fs.pathExists(dbSource)) {
      console.log('💾 Backing up database files...');
      await fs.copy(dbSource, dbDest, {
        filter: (src) => {
          // Include all files except node_modules
          return !src.includes('node_modules');
        }
      });
      
      // Count backed up files
      const dbFiles = await fs.readdir(dbDest);
      console.log(`   ✓ Backed up ${dbFiles.length} database files`);
    }
    
    // Backup config files
    console.log('⚙️ Backing up configuration files...');
    const configFiles = ['.env', 'config.json', 'ecosystem.config.js'];
    let configCount = 0;
    
    for (const file of configFiles) {
      const filePath = path.join(PROJECT_DIR, file);
      if (await fs.pathExists(filePath)) {
        await fs.copy(filePath, path.join(backupPath, file));
        configCount++;
        console.log(`   ✓ ${file}`);
      }
    }
    
    if (configCount === 0) {
      console.log('   ⚠️ No config files found to backup');
    }
    
    // Backup sessions
    const sessionsSource = path.join(PROJECT_DIR, 'sessions');
    const sessionsDest = path.join(backupPath, 'sessions');
    
    if (await fs.pathExists(sessionsSource)) {
      console.log('🔐 Backing up WhatsApp sessions...');
      await fs.copy(sessionsSource, sessionsDest);
      const sessionFiles = await fs.readdir(sessionsDest);
      console.log(`   ✓ Backed up ${sessionFiles.length} session files`);
    }
    
    // Create archive (Windows/Linux compatible)
    console.log('🗜️ Creating compressed archive...');
    
    const isWindows = process.platform === 'win32';
    let archiveName;
    
    if (isWindows) {
      // Use PowerShell for compression on Windows
      archiveName = `${backupName}.zip`;
      const archivePath = path.join(BACKUP_DIR, archiveName);
      
      const command = `powershell -Command "Compress-Archive -Path '${backupPath}' -DestinationPath '${archivePath}' -Force"`;
      
      try {
        await execPromise(command);
        console.log(`   ✓ Created ${archiveName}`);
      } catch (error) {
        console.log('   ⚠️ Compression failed, keeping uncompressed backup');
        archiveName = backupName;
      }
    } else {
      // Use tar for compression on Linux/Mac
      archiveName = `${backupName}.tar.gz`;
      const archivePath = path.join(BACKUP_DIR, archiveName);
      
      try {
        await execPromise(`tar -czf "${archivePath}" -C "${BACKUP_DIR}" "${backupName}"`);
        console.log(`   ✓ Created ${archiveName}`);
      } catch (error) {
        console.log('   ⚠️ Compression failed, keeping uncompressed backup');
        archiveName = backupName;
      }
    }
    
    // Remove uncompressed backup if archive was created
    if (archiveName !== backupName && await fs.pathExists(path.join(BACKUP_DIR, archiveName))) {
      console.log('🗑️ Removing uncompressed backup...');
      await fs.remove(backupPath);
    }
    
    // Calculate backup size
    const stats = await fs.stat(path.join(BACKUP_DIR, archiveName));
    const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
    
    console.log();
    console.log('✅ Backup completed successfully!');
    console.log(`   📦 Archive: ${archiveName}`);
    console.log(`   💾 Size: ${sizeMB} MB`);
    console.log(`   📁 Location: ${BACKUP_DIR}`);
    
    // Clean old backups
    await cleanOldBackups();
    
  } catch (error) {
    console.error('❌ Backup failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

/**
 * Clean old backups based on retention policy
 */
async function cleanOldBackups() {
  console.log();
  console.log(`🧹 Cleaning old backups (retention: ${RETENTION_DAYS} days)...`);
  
  try {
    const files = await fs.readdir(BACKUP_DIR);
    const now = Date.now();
    const maxAge = RETENTION_DAYS * 24 * 60 * 60 * 1000;
    let deletedCount = 0;
    
    for (const file of files) {
      // Only process backup files
      if (!file.startsWith('backup-')) continue;
      
      const filePath = path.join(BACKUP_DIR, file);
      const stats = await fs.stat(filePath);
      const age = now - stats.mtimeMs;
      
      if (age > maxAge) {
        await fs.remove(filePath);
        console.log(`   ✓ Deleted: ${file}`);
        deletedCount++;
      }
    }
    
    if (deletedCount > 0) {
      console.log(`   ✓ Cleaned ${deletedCount} old backup(s)`);
    } else {
      console.log('   ✓ No old backups to clean');
    }
    
  } catch (error) {
    console.error('⚠️ Failed to clean old backups:', error.message);
  }
}

/**
 * List existing backups
 */
async function listBackups() {
  console.log('═══════════════════════════════════════════');
  console.log('    EXISTING BACKUPS');
  console.log('═══════════════════════════════════════════');
  console.log();
  
  try {
    const files = await fs.readdir(BACKUP_DIR);
    const backups = files.filter(f => f.startsWith('backup-'));
    
    if (backups.length === 0) {
      console.log('No backups found');
      return;
    }
    
    // Sort by date (newest first)
    backups.sort().reverse();
    
    console.log(`Found ${backups.length} backup(s):\n`);
    
    for (const backup of backups) {
      const filePath = path.join(BACKUP_DIR, backup);
      const stats = await fs.stat(filePath);
      const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
      const date = new Date(stats.mtime).toLocaleString();
      
      console.log(`📦 ${backup}`);
      console.log(`   Size: ${sizeMB} MB`);
      console.log(`   Date: ${date}`);
      console.log();
    }
    
  } catch (error) {
    console.error('❌ Failed to list backups:', error.message);
  }
}

/**
 * Restore backup
 */
async function restoreBackup(backupName) {
  console.log('═══════════════════════════════════════════');
  console.log('    RESTORE BACKUP');
  console.log('═══════════════════════════════════════════');
  console.log();
  
  if (!backupName) {
    console.error('❌ Please provide backup name to restore');
    console.log('Usage: node backup.js restore <backup-name>');
    process.exit(1);
  }
  
  const backupPath = path.join(BACKUP_DIR, backupName);
  
  if (!await fs.pathExists(backupPath)) {
    console.error(`❌ Backup not found: ${backupName}`);
    process.exit(1);
  }
  
  console.log(`⚠️ WARNING: This will overwrite current data!`);
  console.log(`Restoring from: ${backupName}`);
  console.log('Press Ctrl+C to cancel...');
  console.log();
  
  // Wait 5 seconds before proceeding
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  try {
    // Extract if compressed
    let extractPath = backupPath;
    
    if (backupName.endsWith('.zip') || backupName.endsWith('.tar.gz')) {
      console.log('📦 Extracting archive...');
      const tempDir = path.join(BACKUP_DIR, 'temp_restore');
      await fs.ensureDir(tempDir);
      
      if (backupName.endsWith('.zip')) {
        // Windows ZIP
        const command = `powershell -Command "Expand-Archive -Path '${backupPath}' -DestinationPath '${tempDir}' -Force"`;
        await execPromise(command);
      } else {
        // Linux/Mac tar.gz
        await execPromise(`tar -xzf "${backupPath}" -C "${tempDir}"`);
      }
      
      // Find extracted folder
      const extracted = await fs.readdir(tempDir);
      extractPath = path.join(tempDir, extracted[0]);
    }
    
    // Restore files
    console.log('🔄 Restoring files...');
    
    // Restore database
    const dbSource = path.join(extractPath, 'database');
    if (await fs.pathExists(dbSource)) {
      const dbDest = path.join(PROJECT_DIR, 'database');
      await fs.copy(dbSource, dbDest, { overwrite: true });
      console.log('   ✓ Database restored');
    }
    
    // Restore config files
    const configFiles = ['.env', 'config.json', 'ecosystem.config.js'];
    for (const file of configFiles) {
      const source = path.join(extractPath, file);
      if (await fs.pathExists(source)) {
        await fs.copy(source, path.join(PROJECT_DIR, file), { overwrite: true });
        console.log(`   ✓ ${file} restored`);
      }
    }
    
    // Restore sessions
    const sessionsSource = path.join(extractPath, 'sessions');
    if (await fs.pathExists(sessionsSource)) {
      const sessionsDest = path.join(PROJECT_DIR, 'sessions');
      await fs.copy(sessionsSource, sessionsDest, { overwrite: true });
      console.log('   ✓ Sessions restored');
    }
    
    // Clean up temp directory
    if (extractPath.includes('temp_restore')) {
      await fs.remove(path.join(BACKUP_DIR, 'temp_restore'));
    }
    
    console.log();
    console.log('✅ Restore completed successfully!');
    console.log('⚠️ Please restart the application');
    
  } catch (error) {
    console.error('❌ Restore failed:', error.message);
    process.exit(1);
  }
}

/**
 * Main CLI
 */
async function main() {
  const command = process.argv[2];
  
  switch (command) {
    case 'list':
      await listBackups();
      break;
      
    case 'restore':
      const backupName = process.argv[3];
      await restoreBackup(backupName);
      break;
      
    case 'clean':
      await cleanOldBackups();
      break;
      
    case 'help':
      console.log('RAF Bot V2 - Backup Utility\n');
      console.log('Usage:');
      console.log('  node backup.js              Create new backup');
      console.log('  node backup.js list          List all backups');
      console.log('  node backup.js restore <name> Restore specific backup');
      console.log('  node backup.js clean         Clean old backups');
      console.log('  node backup.js help          Show this help');
      console.log('\nEnvironment Variables:');
      console.log('  BACKUP_DIR              Backup directory (default: ../backups)');
      console.log('  BACKUP_RETENTION_DAYS   Days to keep backups (default: 30)');
      break;
      
    default:
      // Create backup by default
      await createBackup();
  }
}

// Run
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { createBackup, cleanOldBackups, restoreBackup };
