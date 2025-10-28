# 🚀 Setup PM2 untuk Auto-Commit (Production)

PM2 adalah process manager untuk Node.js yang membuat auto-commit berjalan 24/7 sebagai service.

## 📦 Install PM2

```bash
npm install -g pm2
```

## ⚡ Start Auto-Commit Service

```bash
# Start auto-commit dengan PM2
pm2 start auto-commit.js --name "raf-autocommit"

# Atau dengan lebih detail
pm2 start auto-commit.js --name "raf-autocommit" --time --log-date-format "YYYY-MM-DD HH:mm:ss"
```

## 📊 Monitoring

```bash
# Lihat status service
pm2 status

# Lihat logs real-time
pm2 logs raf-autocommit

# Lihat logs terakhir 100 baris
pm2 logs raf-autocommit --lines 100

# Monitor CPU & Memory
pm2 monit
```

## 🔄 Management Commands

```bash
# Stop service
pm2 stop raf-autocommit

# Restart service
pm2 restart raf-autocommit

# Delete service
pm2 delete raf-autocommit

# Reload tanpa downtime
pm2 reload raf-autocommit
```

## 💾 Save Configuration

```bash
# Save current PM2 list
pm2 save

# Auto-start PM2 saat Windows boot
pm2 startup

# Jika menggunakan Windows dengan admin:
npm install -g pm2-windows-startup
pm2-startup install
```

## 📝 View Details

```bash
# Info lengkap service
pm2 info raf-autocommit

# Lihat environment variables
pm2 env raf-autocommit
```

## 🔧 Troubleshooting

### Jika PM2 tidak jalan di Windows:
```bash
# Install PM2 Windows Service
npm install -g pm2-windows-service
pm2-service-install

# Start PM2 service
net start PM2
```

### Reset jika ada masalah:
```bash
pm2 kill              # Stop semua PM2 processes
pm2 resurrect        # Restore saved processes
```

## ✅ Verify Auto-Commit Working

1. Edit file apapun di project
2. Check logs: `pm2 logs raf-autocommit`
3. Lihat di GitHub: https://github.com/rafall04/raf-bot-v2/commits/main

## 📊 Dashboard Web (Optional)

```bash
# Install PM2 web dashboard
pm2 install pm2-webshell

# Access di browser
# http://localhost:8080
```

---

**Note:** PM2 akan menjaga auto-commit tetap berjalan meski:
- Terminal ditutup
- Windows restart
- Aplikasi crash (auto-restart)

Repository: https://github.com/rafall04/raf-bot-v2
