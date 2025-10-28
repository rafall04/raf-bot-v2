# 🚀 AGENT TRANSACTION - QUICK START GUIDE

**Status:** ✅ Implementation Complete  
**Date:** 2025-10-19  
**Ready:** After agent credential setup

---

## ⚡ QUICK SETUP (3 Steps)

### **Step 1: Verify System** ✅

```bash
# Run verification test
node tools/test-agent-transaction-system.js
```

**Expected output:** All 27 tests passed ✅

---

### **Step 2: Check Agents** 📋

```bash
# Check which agents need credential setup
node tools/list-agents-status.js
```

**Example output:**
```
Agent Pusat - RAF NET
   🔐 Credentials: ❌ NOT REGISTERED
   💡 Register: node tools/register-agent-pin.js AGT001 628... [PIN]
```

---

### **Step 3: Register Agent Credentials** 🔐

For each active agent, run:

```bash
node tools/register-agent-pin.js AGT001 6285233047094 1234
```

**Format:**
- `AGT001` = Agent ID (dari agents.json)
- `6285233047094` = WhatsApp number (format 628xxx)
- `1234` = PIN (min 4 digit, akan di-hash otomatis)

**Repeat for all agents:**
```bash
node tools/register-agent-pin.js AGT001 6285233047094 1234
node tools/register-agent-pin.js AGT002 6285234567890 5678
node tools/register-agent-pin.js AGT003 6285245678901 9012
```

---

## ✅ VERIFY SETUP

```bash
# Check all agents now have credentials
node tools/list-agents-status.js
```

**Expected:** `Ready for Topup: 3/3` ✅

---

## 🎮 HOW TO USE

### **Customer Flow:**

1. **Start Topup:**
   ```
   Customer: topup
   Bot: Pilih metode (1: Transfer, 2: Cash)
   ```

2. **Select Cash Payment:**
   ```
   Customer: 2
   Bot: Masukkan jumlah (10000-1000000)
   ```

3. **Enter Amount:**
   ```
   Customer: 50000
   Bot: [Shows numbered list of available agents]
   ```

4. **Select Agent:**
   ```
   Customer: 1
   Bot: Konfirmasi - Agent details + instructions
   ```

5. **Confirm:**
   ```
   Customer: ya
   Bot: ✅ Request berhasil! ID: TOP123...
        📱 Hubungi: wa.me/628...
        🗺️ Lokasi: maps.google.com...
   ```

6. **Customer contacts agent and pays cash**

---

### **Agent Flow:**

1. **Agent receives notification:**
   ```
   🔔 REQUEST TOPUP BARU
   👤 Customer: John Doe
   💰 Rp 50.000
   🆔 AGT_TRX_123...
   
   ✅ CARA KONFIRMASI:
   konfirmasi AGT_TRX_123... 1234
   ```

2. **After receiving cash, agent confirms:**
   ```
   Agent: konfirmasi AGT_TRX_1760812345678XYZ 1234
   Bot: ✅ KONFIRMASI BERHASIL
        Saldo customer telah ditambahkan
   ```

3. **Check today's transactions:**
   ```
   Agent: transaksi hari ini
   Bot: [Shows all transactions for today]
   ```

---

## 💻 AVAILABLE COMMANDS

### **Customer Commands:**
| Command | Description |
|---------|-------------|
| `topup` | Start topup flow (with agent option) |
| `cek topup [ID]` | Check topup request status |
| `agent` | List all available agents |
| `agent tanjung` | Agents in Tanjung area |
| `cari agent [keyword]` | Search agents |

### **Agent Commands:**
| Command | Description |
|---------|-------------|
| `konfirmasi [ID] [PIN]` | Confirm cash payment received |
| `transaksi hari ini` | View today's transactions |
| `transaksi` | Same as above |

### **Monitoring Commands (Admin):**
| Command | Description |
|---------|-------------|
| `node tools/list-agents-status.js` | Check all agents status |
| `node tools/view-agent-transactions.js` | View all transactions |
| `node tools/view-agent-transactions.js AGT001` | View specific agent |
| `node tools/view-agent-transactions.js AGT001 today` | View today only |

---

## 🔐 SECURITY NOTES

✅ **PIN Security:**
- PINs are hashed with bcrypt (cost factor 10)
- No plain text storage
- Verification required for each confirmation

✅ **Transaction Security:**
- Unique transaction IDs
- Agent can only confirm own transactions
- Status tracking: pending → confirmed → completed

✅ **Audit Trail:**
- All transactions timestamped
- confirmedBy tracked
- Full history maintained

---

## 🐛 TROUBLESHOOTING

### **Agent tidak menerima notifikasi:**
**Cause:** Agent phone format salah atau WhatsApp tidak connect  
**Fix:**
1. Check phone format di agents.json (08xxx atau 628xxx)
2. Verify WhatsApp connection: `npm start` dan cek log
3. Test send message manual

### **PIN salah saat konfirmasi:**
**Cause:** PIN tidak match atau agent credentials tidak registered  
**Fix:**
```bash
# Check agent credentials
node tools/list-agents-status.js

# Re-register if needed
node tools/register-agent-pin.js AGT001 6285233047094 [NEW_PIN]
```

### **Saldo tidak bertambah setelah konfirmasi:**
**Cause:** Error di processAgentConfirmation  
**Fix:**
1. Check logs: look for `[SALDO-MANAGER]` errors
2. Verify topup_request status in database
3. Verify agent_transaction status
4. Check if customer has ATM record (saldo account)

### **"Transaction tidak ditemukan":**
**Cause:** ID salah atau transaction expired  
**Fix:**
1. Copy exact ID dari notifikasi (case-sensitive)
2. Check transaction di database: `node tools/view-agent-transactions.js`
3. Verify transaction belum expired atau cancelled

### **No agents available:**
**Cause:** Tidak ada agent aktif dengan service 'topup'  
**Fix:**
1. Add agents via admin panel: `/agent-management`
2. Ensure services includes "topup"
3. Set agent as active
4. Register credentials

---

## 📊 MONITORING

### **Check System Health:**
```bash
# Verify all components
node tools/test-agent-transaction-system.js

# Check agents status
node tools/list-agents-status.js

# View transactions
node tools/view-agent-transactions.js
```

### **Database Files:**
```
database/agent_transactions.json    → All transactions
database/agent_credentials.json     → Agent credentials (hashed PINs)
database/topup_requests.json        → Topup requests (includes agentId)
database/agents.json                → Agent master data
```

### **Log Files:**
```
logs/app-[date].log                 → Application logs
```

**Search patterns:**
- `[AGENT-TRX]` → Agent transaction operations
- `[SALDO-MANAGER]` → Saldo operations
- `[TOPUP]` → Topup flow operations

---

## 📈 SUCCESS METRICS

Track these metrics for system health:

| Metric | Target |
|--------|--------|
| Transaction Success Rate | > 95% |
| Average Confirmation Time | < 30 min |
| PIN Errors | < 5% |
| Agent Response Time | < 1 hour |
| Customer Complaints | < 1% |

---

## 🎯 PRODUCTION CHECKLIST

Before going live:

- [ ] All tests passed (27/27)
- [ ] All active agents have credentials
- [ ] agents.json has correct phone numbers
- [ ] agents.json has 'topup' in services
- [ ] Test complete flow end-to-end
- [ ] Admin notifications working
- [ ] Monitor first 5 transactions closely
- [ ] Document any issues
- [ ] Train agents on commands
- [ ] Prepare support documentation

---

## 📞 SUPPORT

**For Development Issues:**
- Check logs in `logs/` directory
- Run test: `node tools/test-agent-transaction-system.js`
- Review documentation in `docs/` folder

**For Agent Training:**
- Show agent the notification format
- Practice confirmation command
- Test with small amount first

**For Customer Support:**
- Guide through topup flow
- Provide agent contact info
- Track topup status via ID

---

## 🔄 MAINTENANCE

### **Monthly Tasks:**
1. Review transaction logs
2. Check agent performance metrics
3. Verify PIN security (no plain text)
4. Backup database files
5. Update agent list if needed

### **Weekly Tasks:**
1. Monitor transaction success rate
2. Check for stuck transactions
3. Verify agent response times
4. Review customer feedback

### **Daily Tasks:**
1. Check system logs for errors
2. Monitor active transactions
3. Respond to agent questions

---

## 📚 DOCUMENTATION

**Complete Documentation:**
- `docs/AGENT_TRANSACTION_FLOW_DETAIL.md` (500+ lines)
- `docs/AGENT_TRANSACTION_IMPLEMENTATION_SUMMARY.md` (400+ lines)
- `AGENT_TRANSACTION_QUICKSTART.md` (this file)

**Helper Scripts:**
- `tools/register-agent-pin.js` - Register agent credentials
- `tools/test-agent-transaction-system.js` - System verification
- `tools/list-agents-status.js` - Agent status checker
- `tools/view-agent-transactions.js` - Transaction viewer

---

## ✅ YOU'RE READY!

If all steps above are completed, your system is ready for production.

**Next Action:**
```bash
# Start the bot
npm start

# Test via WhatsApp
Type: topup
```

**Good luck! 🚀**

---

**Questions?** Review full documentation in `docs/` folder.
