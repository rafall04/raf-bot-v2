# 📚 RAF Bot V2 - Production Deployment Guide

## 📋 Table of Contents
1. [Pre-Deployment Checklist](#pre-deployment-checklist)
2. [Server Requirements](#server-requirements)
3. [Initial Setup](#initial-setup)
4. [Database Migration](#database-migration)
5. [Production Configuration](#production-configuration)
6. [Deployment Methods](#deployment-methods)
7. [Update Workflow](#update-workflow)
8. [Monitoring & Maintenance](#monitoring-maintenance)
9. [Troubleshooting](#troubleshooting)

---

## 🔍 Pre-Deployment Checklist

### Critical Items ✅
- [ ] Server with Node.js 18+ installed
- [ ] PM2 process manager installed
- [ ] Git configured
- [ ] Domain/subdomain configured
- [ ] SSL certificate (for HTTPS)
- [ ] Database backup from development
- [ ] WhatsApp device ready for QR scan
- [ ] GenieACS server configured
- [ ] MikroTik router configured

### Security Checklist 🔒
- [ ] Change all default passwords
- [ ] Generate new JWT secret
- [ ] Configure firewall rules
- [ ] Setup fail2ban (optional)
- [ ] Configure nginx reverse proxy
- [ ] Enable HTTPS only
- [ ] Restrict database access
- [ ] Setup backup automation

---

## 💻 Server Requirements

### Minimum Requirements
- **OS**: Ubuntu 20.04+ / CentOS 8+ / Windows Server 2019+
- **CPU**: 2 cores
- **RAM**: 4GB
- **Storage**: 20GB SSD
- **Network**: Static IP, ports 3100 (app), 80/443 (web)

### Recommended Requirements
- **OS**: Ubuntu 22.04 LTS
- **CPU**: 4 cores
- **RAM**: 8GB
- **Storage**: 50GB SSD
- **Network**: Static IP with backup

### Software Dependencies
```bash
# Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# PM2
sudo npm install -g pm2

# Git
sudo apt-get install git

# Build tools (for bcrypt)
sudo apt-get install build-essential

# SQLite3
sudo apt-get install sqlite3

# Nginx (optional, for reverse proxy)
sudo apt-get install nginx
```

---

## 🚀 Initial Setup

### 1. Clone Repository
```bash
# Create app directory
sudo mkdir -p /var/www/raf-bot
cd /var/www

# Clone repository
sudo git clone https://github.com/yourusername/raf-bot-v2.git raf-bot
cd raf-bot

# Set permissions
sudo chown -R www-data:www-data /var/www/raf-bot
```

### 2. Install Dependencies
```bash
# Install production dependencies only
npm ci --production

# Or if package-lock.json doesn't exist
npm install --production
```

### 3. Setup Environment Variables
```bash
# Copy example environment file
cp .env.example .env

# Edit environment variables
nano .env
```

### 4. Configure Application
```bash
# Copy example config
cp config.example.json config.json

# Edit configuration
nano config.json
```

**Important Config Changes:**
```json
{
    "ownerNumber": ["YOUR_WHATSAPP_NUMBER@s.whatsapp.net"],
    "jwt": "GENERATE_RANDOM_32_CHAR_STRING",
    "genieacsBaseUrl": "http://YOUR_GENIEACS_IP:7557",
    "site_url_bot": "https://yourdomain.com",
    "tokopayKey": "YOUR_ACTUAL_KEY",
    "ipaymuSecret": "YOUR_ACTUAL_SECRET"
}
```

### 5. Setup Database
```bash
# Create database directory
mkdir -p database backups

# If migrating from old database
cp /path/to/old/database.sqlite database/

# Run migration
node tools/smart-migrate-database.js
```

### 6. Setup File Permissions
```bash
# Set proper permissions
chmod 755 /var/www/raf-bot
chmod -R 755 /var/www/raf-bot/uploads
chmod -R 755 /var/www/raf-bot/temp
chmod -R 755 /var/www/raf-bot/logs
chmod -R 755 /var/www/raf-bot/backups
chmod 600 /var/www/raf-bot/.env
chmod 600 /var/www/raf-bot/config.json
```

---

## 🗄️ Database Migration

### From Development to Production
```bash
# On development machine
cd c:\project\raf-bot-v2
node tools/backup-database.js

# Copy backup to server
scp backups/database-backup-*.sqlite user@server:/tmp/

# On production server
cd /var/www/raf-bot
cp /tmp/database-backup-*.sqlite database.sqlite
node tools/smart-migrate-database.js
```

### Migration Script
Create `migrate-production.js`:
```javascript
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

// Run migrations
db.serialize(() => {
    // Add any missing columns
    const migrations = [
        `ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login TEXT`,
        `ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TEXT DEFAULT CURRENT_TIMESTAMP`,
        `CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone_number)`,
        `CREATE INDEX IF NOT EXISTS idx_users_device ON users(device_id)`
    ];

    migrations.forEach(sql => {
        db.run(sql, (err) => {
            if (err && !err.message.includes('duplicate column')) {
                console.error('Migration error:', err);
            }
        });
    });
});

db.close();
console.log('✅ Database migration completed');
```

---

## ⚙️ Production Configuration

### PM2 Ecosystem File
Create `ecosystem.config.js`:
```javascript
module.exports = {
    apps: [{
        name: 'raf-bot',
        script: './index.js',
        instances: 1,
        exec_mode: 'fork',
        watch: false,
        max_memory_restart: '2G',
        env: {
            NODE_ENV: 'production',
            PORT: 3100
        },
        error_file: './logs/pm2-error.log',
        out_file: './logs/pm2-out.log',
        log_file: './logs/pm2-combined.log',
        time: true,
        autorestart: true,
        max_restarts: 10,
        min_uptime: '10s',
        restart_delay: 4000,
        kill_timeout: 5000,
        wait_ready: true,
        listen_timeout: 10000
    }]
};
```

### Nginx Configuration
Create `/etc/nginx/sites-available/raf-bot`:
```nginx
server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    client_max_body_size 50M;

    location / {
        proxy_pass http://localhost:3100;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /socket.io/ {
        proxy_pass http://localhost:3100;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

Enable site:
```bash
sudo ln -s /etc/nginx/sites-available/raf-bot /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## 🚢 Deployment Methods

### Method 1: Direct Deployment (Simple)
```bash
# Start with PM2
pm2 start ecosystem.config.js

# Save PM2 config
pm2 save

# Setup auto-start
pm2 startup
```

### Method 2: Docker Deployment
Create `Dockerfile`:
```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --production

COPY . .

EXPOSE 3100

CMD ["node", "index.js"]
```

Create `docker-compose.yml`:
```yaml
version: '3.8'
services:
  raf-bot:
    build: .
    ports:
      - "3100:3100"
    volumes:
      - ./database:/app/database
      - ./uploads:/app/uploads
      - ./logs:/app/logs
      - ./session:/app/session
    environment:
      - NODE_ENV=production
    restart: unless-stopped
```

### Method 3: GitHub Actions (CI/CD)
Create `.github/workflows/deploy.yml`:
```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - name: Deploy to server
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.HOST }}
          username: ${{ secrets.USERNAME }}
          key: ${{ secrets.SSH_KEY }}
          script: |
            cd /var/www/raf-bot
            git pull origin main
            npm ci --production
            pm2 reload raf-bot
```

---

## 🔄 Update Workflow

### Standard Update Process
```bash
# 1. Backup current version
cd /var/www/raf-bot
tar -czf ../backup-$(date +%Y%m%d).tar.gz .

# 2. Pull latest changes
git pull origin main

# 3. Install new dependencies
npm ci --production

# 4. Run migrations
node migrate-production.js

# 5. Restart application
pm2 reload raf-bot
```

### Automated Update Script
Create `update-production.sh`:
```bash
#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Starting RAF Bot update...${NC}"

# Navigate to app directory
cd /var/www/raf-bot || exit 1

# Create backup
echo -e "${YELLOW}Creating backup...${NC}"
BACKUP_NAME="backup-$(date +%Y%m%d-%H%M%S).tar.gz"
tar -czf "../$BACKUP_NAME" . --exclude=node_modules --exclude=logs
echo -e "${GREEN}Backup created: $BACKUP_NAME${NC}"

# Fetch latest changes
echo -e "${YELLOW}Fetching updates...${NC}"
git fetch origin main

# Check if updates available
LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/main)

if [ "$LOCAL" = "$REMOTE" ]; then
    echo -e "${GREEN}Already up to date!${NC}"
    exit 0
fi

# Pull updates
echo -e "${YELLOW}Pulling updates...${NC}"
git pull origin main || {
    echo -e "${RED}Failed to pull updates${NC}"
    exit 1
}

# Install dependencies
echo -e "${YELLOW}Installing dependencies...${NC}"
npm ci --production

# Run migrations
echo -e "${YELLOW}Running database migrations...${NC}"
node migrate-production.js

# Reload PM2
echo -e "${YELLOW}Reloading application...${NC}"
pm2 reload raf-bot

echo -e "${GREEN}Update completed successfully!${NC}"
```

Make executable:
```bash
chmod +x update-production.sh
```

---

## 📊 Monitoring & Maintenance

### PM2 Monitoring
```bash
# View status
pm2 status

# View logs
pm2 logs raf-bot

# Monitor resources
pm2 monit

# View detailed info
pm2 info raf-bot
```

### Log Rotation
Create `/etc/logrotate.d/raf-bot`:
```
/var/www/raf-bot/logs/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 640 www-data www-data
    sharedscripts
    postrotate
        pm2 reloadLogs
    endscript
}
```

### Backup Automation
Create cron job:
```bash
# Edit crontab
crontab -e

# Add daily backup at 2 AM
0 2 * * * /var/www/raf-bot/scripts/backup-daily.sh
```

Create `scripts/backup-daily.sh`:
```bash
#!/bin/bash

BACKUP_DIR="/var/backups/raf-bot"
BACKUP_NAME="raf-bot-$(date +%Y%m%d).tar.gz"
APP_DIR="/var/www/raf-bot"

# Create backup directory
mkdir -p $BACKUP_DIR

# Create backup
tar -czf "$BACKUP_DIR/$BACKUP_NAME" \
    -C $APP_DIR \
    database.sqlite \
    config.json \
    database/*.json \
    uploads/

# Delete backups older than 30 days
find $BACKUP_DIR -name "*.tar.gz" -mtime +30 -delete

echo "Backup completed: $BACKUP_NAME"
```

### Health Check Endpoint
Add to `routes/health.js`:
```javascript
router.get('/health', (req, res) => {
    const health = {
        uptime: process.uptime(),
        message: 'OK',
        timestamp: Date.now(),
        database: fs.existsSync('./database.sqlite'),
        whatsapp: global.sock ? 'Connected' : 'Disconnected'
    };
    res.status(200).json(health);
});
```

### Monitoring Services
```bash
# Using uptimerobot.com or pingdom.com
# Monitor: https://yourdomain.com/health
```

---

## 🔧 Troubleshooting

### Common Issues

#### 1. WhatsApp Connection Lost
```bash
# Delete session and rescan QR
rm -rf session/
pm2 restart raf-bot
pm2 logs raf-bot
```

#### 2. Database Locked
```bash
# Check processes using database
lsof | grep database.sqlite

# Kill stuck process
kill -9 [PID]

# Restart app
pm2 restart raf-bot
```

#### 3. High Memory Usage
```bash
# Check memory
pm2 info raf-bot

# Restart with memory clear
pm2 restart raf-bot --update-env
```

#### 4. Permission Issues
```bash
# Fix ownership
sudo chown -R www-data:www-data /var/www/raf-bot

# Fix permissions
find /var/www/raf-bot -type d -exec chmod 755 {} \;
find /var/www/raf-bot -type f -exec chmod 644 {} \;
```

---

## 📝 Post-Deployment Checklist

- [ ] WhatsApp connected and QR scanned
- [ ] Web interface accessible via HTTPS
- [ ] Database migrated successfully
- [ ] All API integrations working (GenieACS, MikroTik)
- [ ] Payment gateways configured
- [ ] Cron jobs running
- [ ] Backups automated
- [ ] Monitoring setup
- [ ] Team trained on update process
- [ ] Documentation shared with team

---

## 🆘 Support & Resources

### Log Locations
- Application logs: `/var/www/raf-bot/logs/`
- PM2 logs: `~/.pm2/logs/`
- Nginx logs: `/var/log/nginx/`

### Useful Commands
```bash
# View real-time logs
pm2 logs raf-bot --lines 100

# Check system resources
htop

# Check disk usage
df -h

# Check database size
du -h database.sqlite

# Test WhatsApp connection
curl http://localhost:3100/health
```

### Emergency Recovery
```bash
# Restore from backup
cd /var/www
tar -xzf /path/to/backup.tar.gz -C raf-bot/

# Restart services
pm2 restart raf-bot
sudo systemctl restart nginx
```

---

## 📋 Production Ready Indicators

✅ **Green Flags (Ready)**
- All dependencies installed
- Database migrated
- Config files secured
- PM2 configured
- Nginx proxy setup
- SSL certificate active
- Backups automated
- Monitoring active

⚠️ **Yellow Flags (Review)**
- High memory usage (>2GB)
- Slow response times (>2s)
- Database size >1GB
- Many error logs

🔴 **Red Flags (Not Ready)**
- Default passwords in use
- No SSL certificate
- Database errors
- WhatsApp disconnected frequently
- No backup strategy
- No monitoring

---

**Created by RAF Bot Team | Version 2.0.0**
