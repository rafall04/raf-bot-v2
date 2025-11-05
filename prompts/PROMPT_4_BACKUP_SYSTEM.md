# ✨ CREATE REQUEST: AUTOMATED BACKUP & RESTORE SYSTEM

## 📋 PREREQUISITES
1. Understand current data storage structure
2. Identify critical data that needs backup
3. Review available storage options
4. Check current manual backup processes

## 🎯 OBJECTIVE
Create an automated backup system with versioning, compression, cloud sync, and one-click restore capability to ensure zero data loss and quick disaster recovery.

## 📊 REQUIREMENTS

### Functional Requirements:
1. **Automated Backups**
   - Hourly incremental backups
   - Daily full backups at 2 AM
   - Weekly archives on Sunday
   - Monthly snapshots

2. **Data Coverage**
   - SQLite database
   - Configuration files
   - WiFi logs
   - User sessions
   - Media files
   - Templates

3. **Storage Strategy**
   - Local backups (7 days)
   - Cloud sync (Google Drive/S3)
   - Compressed archives
   - Encrypted sensitive data

4. **Restore Options**
   - Full system restore
   - Selective data restore
   - Point-in-time recovery
   - Cross-server migration

5. **Monitoring**
   - Backup success/failure alerts
   - Storage usage warnings
   - Integrity verification
   - Backup age tracking

### Technical Requirements:
- Use node-cron for scheduling
- tar/gzip for compression
- AES-256 for encryption
- Google Drive API for cloud
- Maximum 5GB local storage

## 🏗️ IMPLEMENTATION PLAN

### Phase 1: Backup Manager
```javascript
// lib/backup-manager.js
const fs = require('fs-extra');
const tar = require('tar');
const crypto = require('crypto');
const { google } = require('googleapis');

class BackupManager {
    constructor() {
        this.backupDir = './backups';
        this.config = {
            encryption: true,
            compression: true,
            maxLocalBackups: 7,
            cloudSync: true
        };
        
        this.backupTypes = {
            HOURLY: { interval: '0 * * * *', retention: 24 },
            DAILY: { interval: '0 2 * * *', retention: 7 },
            WEEKLY: { interval: '0 3 * * 0', retention: 4 },
            MONTHLY: { interval: '0 4 1 * *', retention: 12 }
        };
    }
    
    async createBackup(type = 'MANUAL') {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupName = `backup_${type}_${timestamp}`;
        const tempDir = `${this.backupDir}/temp/${backupName}`;
        
        try {
            // Create backup structure
            await fs.ensureDir(tempDir);
            
            // Collect data
            const manifest = await this.collectData(tempDir);
            
            // Create archive
            const archivePath = await this.createArchive(tempDir, backupName);
            
            // Encrypt if enabled
            if (this.config.encryption) {
                await this.encryptBackup(archivePath);
            }
            
            // Upload to cloud
            if (this.config.cloudSync) {
                await this.uploadToCloud(archivePath, type);
            }
            
            // Clean old backups
            await this.cleanOldBackups(type);
            
            // Log success
            await this.logBackup(backupName, manifest, 'SUCCESS');
            
            return {
                success: true,
                backup: backupName,
                size: fs.statSync(archivePath).size,
                items: manifest.totalItems
            };
            
        } catch (error) {
            await this.logBackup(backupName, null, 'FAILED', error);
            throw error;
        } finally {
            // Cleanup temp
            await fs.remove(tempDir);
        }
    }
    
    async collectData(targetDir) {
        const manifest = {
            timestamp: Date.now(),
            version: '2.0.0',
            items: [],
            totalItems: 0,
            totalSize: 0
        };
        
        // Database
        await fs.copy('./database.sqlite', `${targetDir}/database.sqlite`);
        manifest.items.push({ type: 'database', path: 'database.sqlite' });
        
        // Configuration
        await fs.copy('./config.json', `${targetDir}/config.json`);
        manifest.items.push({ type: 'config', path: 'config.json' });
        
        // WiFi logs
        await fs.copy('./database/wifi_change_logs.json', `${targetDir}/wifi_change_logs.json`);
        manifest.items.push({ type: 'logs', path: 'wifi_change_logs.json' });
        
        // Accounts
        await fs.copy('./database/accounts.json', `${targetDir}/accounts.json`);
        manifest.items.push({ type: 'accounts', path: 'accounts.json' });
        
        // Templates
        await fs.copy('./database/wifi_templates.json', `${targetDir}/wifi_templates.json`);
        manifest.items.push({ type: 'templates', path: 'wifi_templates.json' });
        
        // Session data (if exists)
        if (fs.existsSync('./session')) {
            await fs.copy('./session', `${targetDir}/session`);
            manifest.items.push({ type: 'session', path: 'session' });
        }
        
        // Calculate sizes
        manifest.totalItems = manifest.items.length;
        manifest.totalSize = await this.calculateSize(targetDir);
        
        // Save manifest
        await fs.writeJson(`${targetDir}/manifest.json`, manifest);
        
        return manifest;
    }
    
    async createArchive(sourceDir, archiveName) {
        const archivePath = `${this.backupDir}/${archiveName}.tar.gz`;
        
        await tar.create(
            {
                gzip: this.config.compression,
                file: archivePath,
                cwd: sourceDir
            },
            ['.']
        );
        
        return archivePath;
    }
}
```

### Phase 2: Restore Manager
```javascript
// lib/restore-manager.js
class RestoreManager {
    constructor() {
        this.restoreDir = './restore_temp';
    }
    
    async restore(backupName, options = {}) {
        const {
            selective = false,
            items = [],
            dryRun = false,
            createBackupFirst = true
        } = options;
        
        try {
            // Create safety backup first
            if (createBackupFirst && !dryRun) {
                await this.createSafetyBackup();
            }
            
            // Find backup file
            const backupPath = await this.findBackup(backupName);
            
            // Decrypt if needed
            const decryptedPath = await this.decryptIfNeeded(backupPath);
            
            // Extract archive
            const extractedDir = await this.extractArchive(decryptedPath);
            
            // Verify manifest
            const manifest = await this.verifyManifest(extractedDir);
            
            // Perform restore
            if (selective) {
                await this.selectiveRestore(extractedDir, items, dryRun);
            } else {
                await this.fullRestore(extractedDir, dryRun);
            }
            
            // Verify restore
            await this.verifyRestore(manifest);
            
            return {
                success: true,
                restored: selective ? items : manifest.items,
                timestamp: manifest.timestamp
            };
            
        } catch (error) {
            // Rollback on error
            await this.rollback();
            throw error;
        } finally {
            // Cleanup
            await fs.remove(this.restoreDir);
        }
    }
    
    async selectiveRestore(sourceDir, items, dryRun) {
        for (const item of items) {
            const sourcePath = `${sourceDir}/${item}`;
            const targetPath = `./${item}`;
            
            if (!fs.existsSync(sourcePath)) {
                throw new Error(`Item not found in backup: ${item}`);
            }
            
            if (!dryRun) {
                // Backup current version
                if (fs.existsSync(targetPath)) {
                    await fs.copy(targetPath, `${targetPath}.restore_backup`);
                }
                
                // Restore item
                await fs.copy(sourcePath, targetPath);
            }
            
            console.log(`${dryRun ? '[DRY RUN]' : ''} Restored: ${item}`);
        }
    }
}
```

### Phase 3: Cloud Sync
```javascript
// lib/backup-cloud-sync.js
class BackupCloudSync {
    constructor() {
        this.drive = null;
        this.authenticated = false;
    }
    
    async authenticate() {
        const auth = new google.auth.GoogleAuth({
            keyFile: './credentials/google-drive-key.json',
            scopes: ['https://www.googleapis.com/auth/drive.file']
        });
        
        this.drive = google.drive({ version: 'v3', auth });
        this.authenticated = true;
    }
    
    async upload(filePath, metadata) {
        if (!this.authenticated) {
            await this.authenticate();
        }
        
        const fileMetadata = {
            name: path.basename(filePath),
            parents: [process.env.GOOGLE_DRIVE_FOLDER_ID],
            description: JSON.stringify(metadata)
        };
        
        const media = {
            mimeType: 'application/gzip',
            body: fs.createReadStream(filePath)
        };
        
        const response = await this.drive.files.create({
            requestBody: fileMetadata,
            media: media,
            fields: 'id, webViewLink'
        });
        
        return response.data;
    }
    
    async download(fileId, destinationPath) {
        if (!this.authenticated) {
            await this.authenticate();
        }
        
        const dest = fs.createWriteStream(destinationPath);
        
        const response = await this.drive.files.get(
            { fileId, alt: 'media' },
            { responseType: 'stream' }
        );
        
        return new Promise((resolve, reject) => {
            response.data
                .on('end', resolve)
                .on('error', reject)
                .pipe(dest);
        });
    }
}
```

## 📁 FILES TO CREATE/MODIFY
- `lib/backup-manager.js` - Core backup engine
- `lib/restore-manager.js` - Restore functionality
- `lib/backup-cloud-sync.js` - Cloud integration
- `lib/backup-scheduler.js` - Cron scheduling
- `config/backup-config.json` - Backup configuration
- `credentials/google-drive-key.json` - Google credentials
- `scripts/backup-cli.js` - CLI tool
- `routes/backup-api.js` - REST API

## 🔗 INTEGRATION POINTS
```javascript
// In index.js - Schedule automated backups
const { BackupScheduler } = require('./lib/backup-scheduler');
const backupScheduler = new BackupScheduler();

// Start backup schedule
backupScheduler.start();

// In message/raf.js - Add admin commands
case 'BACKUP':
    if (!isOwner) return;
    const backup = await backupManager.createBackup('MANUAL');
    reply(`✅ Backup created: ${backup.backup}\nSize: ${formatBytes(backup.size)}`);
    break;

case 'RESTORE':
    if (!isOwner) return;
    const backupList = await backupManager.listBackups();
    // Show backup list and restore options
    break;

// REST API endpoints
app.get('/api/backups', authenticate, async (req, res) => {
    const backups = await backupManager.listBackups();
    res.json(backups);
});

app.post('/api/backup', authenticate, async (req, res) => {
    const result = await backupManager.createBackup('API');
    res.json(result);
});

app.post('/api/restore/:backupId', authenticate, async (req, res) => {
    const result = await restoreManager.restore(req.params.backupId);
    res.json(result);
});
```

## 🧪 ACCEPTANCE CRITERIA
1. ✅ Automatic daily backups at 2 AM
2. ✅ All critical data included in backups
3. ✅ Backups compressed to <50MB
4. ✅ Cloud sync within 5 minutes
5. ✅ Restore completes in <2 minutes
6. ✅ Zero data loss on restore
7. ✅ Admin notifications working

## 📈 SUCCESS METRICS
- Backup success rate: > 99%
- Compression ratio: > 70%
- Restore success rate: 100%
- Cloud sync reliability: > 95%
- Storage usage: < 5GB local

## 🔧 TESTING SCENARIOS
1. Create manual backup
2. Automatic backup at scheduled time
3. Restore full system
4. Selective restore (database only)
5. Corrupt backup handling
6. Cloud sync failure recovery
7. Storage limit exceeded
8. Concurrent backup/restore

## 📝 DOCUMENTATION
- Backup/restore procedures
- Disaster recovery plan
- Cloud setup guide
- Troubleshooting guide
