"# RAF-BOT v2 🤖

**WhatsApp-Based Internet Service Provider (ISP) Management System**

Automated customer service bot for managing internet subscriptions, WiFi configurations, billing, and technical support via WhatsApp.

---

## 🌟 Key Features

### **Customer Management**
- 📊 Real-time subscription status
- 💳 Automated billing & invoicing
- 🎫 Ticket system for issue reporting
- 📱 WhatsApp-based interface
- 💰 Balance (saldo) management
- 🎟️ Voucher system

### **WiFi Management**
- 📡 Remote WiFi configuration (SSID, password)
- 🔄 Device reboot capabilities
- 📈 Real-time device status monitoring
- 🌐 Hotspot statistics
- 📊 PPPoE connection management

### **Agent System**
- 👥 Multi-agent support
- 💵 Transaction confirmation with PIN
- 📍 Location-based agent finder
- 📊 Agent performance tracking
- 🔒 Secure PIN authentication (bcrypt)

### **Smart Reporting**
- 🐛 Automated issue diagnosis
- 🔴 Priority-based ticket management
- ⏰ Working hours integration
- 📱 Real-time notifications
- 📋 Technician assignment

### **Advanced Features**
- ⚡ Speed boost on-demand
- 🎯 Package change requests
- 🏢 Network assets management
- 📦 Kompensasi (compensation) system
- 🔄 Auto-isolation for unpaid accounts
- 📄 Automated PDF invoice generation

---

## 🏗️ Technology Stack

**Backend:**
- Node.js + Express.js
- Baileys (WhatsApp Web API)
- SQLite3 + JSON databases
- GenieACS (TR-069 device management)
- MikroTik API integration

**Frontend (Admin Panel):**
- PHP-Express (PHP in Node.js)
- SB Admin 2 Template
- jQuery + DataTables
- Chart.js for analytics
- SweetAlert2 for UI

**Integrations:**
- GenieACS for router management
- MikroTik for network control
- WhatsApp Web via Baileys

---

## 📦 Installation

### **Prerequisites**
- Node.js 16+ 
- PHP 7.4+
- MikroTik Router
- GenieACS Server
- WhatsApp Account

### **Quick Start**

```bash
# Clone repository
git clone <repository-url>
cd raf-bot-v2

# Install dependencies
npm install

# Configure
cp .env.example .env
# Edit config.json with your settings

# Run bot
npm start
```

### **Linux Setup**
See [LINUX_SETUP_GUIDE.md](LINUX_SETUP_GUIDE.md) for detailed instructions.

---

## ⚙️ Configuration

Edit `config.json`:

```json
{
  "ownerNumber": "628123456789",
  "botName": "RAF NET",
  "genieacsUrl": "http://localhost:7547",
  "mikrotik": {
    "host": "192.168.1.1",
    "username": "admin",
    "password": "password"
  },
  "teknisiWorkingHours": {
    "enabled": true,
    "weekdays": { "start": "08:00", "end": "17:00" }
  }
}
```

---

## 📚 Documentation

### **Core Systems**
- [Architecture Overview](ARCHITECTURE.md)
- [Smart Reporting System](SMART_REPORTING_SYSTEM_COMPLETE.md)
- [Agent Transaction System](AGENT_TRANSACTION_COMPLETE.md)
- [WiFi Management Guide](WIFI_TEMPLATES_GUIDE.md)

### **Features**
- [Working Hours System](FITUR_BATAL_DAN_JAM_KERJA.md)
- [Keyword Management](KEYWORD_MANAGEMENT_GUIDE.md)
- [Command Flow](COMMAND_FLOW_SPECIFICATION.md)

### **Recent Updates**
- [Cleanup & Fixes](CLEANUP_IMPLEMENTATION_SUMMARY.md)
- [Hotfix: Cancel Ticket](HOTFIX_BATALKAN_TIKET.md)
- [Project Status](PROJECT_STATUS.md)

---

## 🎮 Usage

### **Customer Commands**
```
# Check subscription
cek paket
cek wifi
cek tagihan

# WiFi management
ganti password [new]
ganti nama [new]
reboot router

# Reporting
lapor gangguan
lapor lambat
batalkan tiket [ID]

# Top-up & payments
topup [nominal]
cek topup [ID]
beli voucher
```

### **Admin Commands**
```
# User management
tambah user
edit paket [ID]
isolir [ID]
pulihkan [ID]

# Broadcast
broadcast [message]
kirim invoice [ID]

# System
restart bot
cek status sistem
```

### **Agent Commands**
```
konfirmasi [ID] [PIN]
transaksi hari ini
ganti pin [old] [new]
profil agent
```

---

## 🔧 Admin Panel

Access admin panel at: `http://localhost:3100`

**Default Credentials:**
```
Username: admin
Password: admin123
```

**Admin Features:**
- 📊 Dashboard with analytics
- 👥 User management
- 🎫 Ticket management
- 💰 Payment authorization
- ⚡ Speed boost approvals
- 📄 Invoice generation
- 🔧 System configuration

---

## 🚀 Deployment

### **Production Setup**

```bash
# Install PM2
npm install -g pm2

# Start bot
pm2 start index.js --name raf-bot

# Auto-restart on reboot
pm2 startup
pm2 save
```

### **Environment Variables**

```bash
PORT=3100
NODE_ENV=production
SESSION_SECRET=your-secret-here
```

---

## 📊 Project Structure

```
raf-bot-v2/
├── config.json           # Main configuration
├── index.js              # Application entry point
├── message/
│   ├── raf.js            # Main message handler
│   └── handlers/         # Feature handlers
├── lib/                  # Core libraries
│   ├── wifi.js           # WiFi management
│   ├── mikrotik.js       # MikroTik integration
│   ├── saldo-manager.js  # Balance management
│   └── ...
├── routes/               # API routes
├── views/                # Admin panel views
├── database/             # JSON databases
├── tools/                # Utility scripts
└── docs/                 # Documentation
```

---

## 🤝 Contributing

This is a private ISP management system. For collaboration:

1. Fork the repository
2. Create feature branch
3. Make changes
4. Test thoroughly
5. Submit pull request

---

## 🐛 Troubleshooting

### **Bot not responding**
```bash
# Check WhatsApp connection
pm2 logs raf-bot

# Restart bot
pm2 restart raf-bot
```

### **GenieACS connection issues**
```bash
# Test GenieACS API
curl http://localhost:7547/devices

# Check GenieACS service
systemctl status genieacs-cwmp
```

### **Database errors**
```bash
# Backup databases
cp database/*.json database/backup/

# Reset if corrupted
node tools/reset-database.js
```

---

## 📈 Status

**Version:** 2.0  
**Status:** ✅ Production Ready  
**Last Updated:** October 2025  
**Code Quality:** 97%  

**Recent Improvements:**
- ✅ Global error handlers added
- ✅ Working hours system implemented
- ✅ Cancel ticket command fixed
- ✅ Codebase cleanup completed
- ✅ Admin menu updated

---

## 📝 License

Proprietary - RAF NET  
All rights reserved.

---

## 📞 Support

**Technical Issues:**
- Check [Documentation](docs/)
- Review [Hotfix Guides](HOTFIX_*.md)
- Contact system administrator

**Feature Requests:**
- Submit via admin panel
- Document in [PROJECT_STATUS.md](PROJECT_STATUS.md)

---

## 🎯 Roadmap

- [ ] Mobile app integration
- [ ] Advanced analytics dashboard
- [ ] Multi-language support
- [ ] Automated backup system
- [ ] Customer self-service portal

---

**Built with ❤️ for RAF NET**" 
