# 🚀 RAF Bot V2 - Production Quick Start Guide

## 📋 Quick Deployment Steps (15 minutes)

### 1️⃣ **Clone & Setup (On Production Server)**
```bash
# Clone repository
cd /var/www
git clone https://github.com/yourusername/raf-bot-v2.git raf-bot
cd raf-bot

# Install dependencies
npm install --production

# Install PM2 globally
npm install -g pm2
```

### 2️⃣ **Configure Application**
```bash
# Copy configuration templates
cp config.example.json config.json
cp .env.example .env
cp ecosystem.config.example.js ecosystem.config.js

# Edit configuration (IMPORTANT!)
nano config.json
```

**Essential config.json changes:**
```json
{
    "ownerNumber": ["628123456789@s.whatsapp.net"],  // Your WhatsApp
    "jwt": "generate_random_32_characters_here",      // Security key
    "genieacsBaseUrl": "http://192.168.1.100:7557",  // Your GenieACS
    "site_url_bot": "https://yourdomain.com"         // Your domain
}
```

### 3️⃣ **Database Setup**
```bash
# If you have existing database from development
scp user@dev-server:/path/to/database.sqlite ./database.sqlite

# Run migration to ensure all columns exist
node tools/smart-migrate-database.js
```

### 4️⃣ **Start Application**
```bash
# Start with PM2
pm2 start ecosystem.config.js

# Save PM2 config
pm2 save

# Setup auto-start on reboot
pm2 startup
# Follow the command it outputs
```

### 5️⃣ **Connect WhatsApp**
```bash
# View logs to see QR code
pm2 logs raf-bot

# Or access web interface
# http://your-server-ip:3100
# Login and scan QR code from dashboard
```

---

## 🔄 Update Workflow

### **For Linux/Mac:**
```bash
./deploy.sh
```

### **For Windows:**
```batch
deploy.bat
```

### **Manual Update:**
```bash
# Backup first
pm2 stop raf-bot
tar -czf backup-$(date +%Y%m%d).tar.gz . --exclude=node_modules

# Pull updates
git pull origin main
npm install --production

# Run migrations if needed
node tools/smart-migrate-database.js

# Restart
pm2 restart raf-bot
```

---

## ⚡ Common Commands

### **PM2 Management:**
```bash
pm2 status          # Check status
pm2 logs raf-bot    # View logs
pm2 monit           # Monitor resources
pm2 restart raf-bot # Restart app
pm2 stop raf-bot    # Stop app
pm2 delete raf-bot  # Remove from PM2
```

### **Backup & Restore:**
```bash
# Create backup
./deploy.sh backup

# Rollback to previous version
./deploy.sh rollback
```

---

## 🔧 Troubleshooting

### **WhatsApp Not Connecting:**
```bash
# Delete session and rescan
rm -rf session/
pm2 restart raf-bot
pm2 logs raf-bot  # Watch for QR code
```

### **Database Errors:**
```bash
# Check database integrity
sqlite3 database.sqlite "PRAGMA integrity_check;"

# Run migrations
node tools/smart-migrate-database.js

# Restore from backup if needed
cp backups/database.backup.*.sqlite database.sqlite
pm2 restart raf-bot
```

### **High Memory Usage:**
```bash
# Check memory
pm2 info raf-bot

# Restart with clear
pm2 restart raf-bot --update-env

# Adjust memory limit in ecosystem.config.js
# max_memory_restart: '1G'  # Lower the limit
```

### **Application Won't Start:**
```bash
# Check for errors
pm2 logs raf-bot --err

# Check port availability
netstat -tulpn | grep 3100

# Check Node version (need 18+)
node --version

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install --production
```

---

## 📁 Important Files & Directories

```
/var/www/raf-bot/
├── config.json          # Main configuration
├── .env                 # Environment variables
├── ecosystem.config.js  # PM2 configuration
├── database.sqlite      # User database
├── database/           # JSON databases
│   ├── accounts.json   # Admin/teknisi accounts
│   ├── reports.json    # Tickets/reports
│   └── *.json          # Other data files
├── uploads/            # Uploaded files
├── session/            # WhatsApp session
├── logs/               # Application logs
└── backups/            # Automatic backups
```

---

## 🔐 Security Checklist

- [ ] Changed JWT secret in config.json
- [ ] Changed default admin password
- [ ] Configured firewall (allow only 3100, 80, 443)
- [ ] Enabled HTTPS with SSL certificate
- [ ] Restricted database file permissions
- [ ] Setup automatic backups
- [ ] Configured fail2ban (optional)
- [ ] Limited API rate limiting

---

## 📞 Need Help?

1. **Check logs first:**
   ```bash
   pm2 logs raf-bot --lines 100
   ```

2. **Check application health:**
   ```bash
   curl http://localhost:3100/health
   ```

3. **Review configuration:**
   ```bash
   cat config.json | grep -E "jwt|ownerNumber|genieacs"
   ```

4. **Check system resources:**
   ```bash
   htop  # or top
   df -h
   free -m
   ```

---

## 🎯 Production Ready Checklist

Before going live, ensure:

- [x] All dependencies installed
- [x] Configuration files properly set
- [x] Database migrated
- [x] WhatsApp connected
- [x] PM2 configured and saved
- [x] Backups automated
- [x] SSL certificate installed
- [x] Domain configured
- [x] GenieACS integrated
- [x] Payment gateways configured

---

**Ready to deploy!** 🚀
