# 🔍 PROMPT: ANALISIS LENGKAP SISTEM WIFI MANAGEMENT

## 📋 KONTEKS
Saya perlu memahami secara mendalam seluruh logika WiFi management dalam sistem RAF Bot V2, termasuk alur kerja, state management, integrasi dengan GenieACS, dan semua edge cases.

## 🎯 TUJUAN ANALISIS
1. Dokumentasikan semua fitur WiFi yang ada
2. Petakan alur kerja lengkap dari user input hingga eksekusi
3. Identifikasi semua handler dan state yang terlibat
4. Temukan potential issues atau improvements
5. Buat diagram alur untuk setiap fitur

## 📂 SCOPE ANALISIS

### 1. FITUR YANG HARUS DIANALISIS:
- [ ] Ganti Nama WiFi (single, bulk manual, bulk auto)
- [ ] Ganti Password WiFi (single, bulk)
- [ ] Cek Status WiFi
- [ ] Adjust Power WiFi
- [ ] Reboot Modem
- [ ] Monitor WiFi Status

### 2. FILE YANG PERLU DIPERIKSA:
```
message/
├── raf.js                           # Router utama
└── handlers/
    ├── wifi-management-handler.js   # Ganti nama & password
    ├── wifi-check-handler.js        # Cek status
    ├── wifi-power-handler.js        # Adjust power
    ├── reboot-modem-handler.js      # Reboot
    └── states/
        ├── wifi-name-state-handler.js      # State ganti nama
        └── wifi-password-state-handler.js  # State ganti password

lib/
├── wifi.js                          # WiFi utility functions
└── database.js                      # User & device data
```

## 🔄 ANALISIS YANG DIMINTA

### A. GANTI NAMA WIFI - COMPLETE FLOW

#### 1. ENTRY POINTS
```
Tolong identifikasi:
- Command triggers apa saja? (exact keywords)
- Case mana di raf.js yang handle?
- Handler function yang dipanggil?
```

#### 2. MODE SELECTION
```
Analisis:
- Ada berapa mode ganti nama?
- Bagaimana user memilih mode?
- State apa yang di-set untuk setiap mode?
```

#### 3. SINGLE MODE FLOW
```
Step by step:
1. User pilih mode single → state?
2. System tampilkan SSID list → dari mana data?
3. User pilih SSID → validation?
4. User input nama baru → format rules?
5. System proses perubahan → GenieACS API?
6. Success/Error handling → notification?
```

#### 4. BULK MANUAL MODE FLOW
```
Step by step:
1. User pilih bulk manual → state?
2. System tampilkan device list → source?
3. User pilih devices → multiple selection?
4. Loop process → bagaimana handle?
5. Error handling per device?
```

#### 5. BULK AUTO MODE FLOW
```
Step by step:
1. Auto detection logic → kriteria?
2. Device filtering → rules?
3. Naming pattern → format template?
4. Batch processing → concurrent/sequential?
5. Progress tracking?
```

#### 6. STATE MANAGEMENT
```
Analisis temp state:
- State transitions diagram
- Data stored in each state
- Timeout handling
- State cleanup
```

#### 7. ERROR SCENARIOS
```
List semua error case:
- Device offline
- GenieACS unreachable
- Invalid name format
- Duplicate names
- Permission issues
- Timeout errors
```

### B. GANTI PASSWORD WIFI - COMPLETE FLOW

#### 1. ENTRY POINTS & MODES
```
Identifikasi:
- Command variations
- Available modes
- Mode differences
```

#### 2. PASSWORD VALIDATION
```
Rules:
- Minimum length?
- Maximum length?
- Character requirements?
- Special chars allowed?
- Security level check?
```

#### 3. SINGLE VS BULK FLOW
```
Compare:
- Single password flow
- Bulk password flow
- Different handling?
```

#### 4. SECURITY CONSIDERATIONS
```
Check:
- Password encryption?
- Logging safety?
- History storage?
- Recovery options?
```

### C. CEK STATUS WIFI - COMPLETE FLOW

#### 1. DATA COLLECTION
```
Sumber data:
- Database fields?
- GenieACS query?
- Real-time check?
- Cache usage?
```

#### 2. STATUS INFORMATION
```
Info yang ditampilkan:
- SSID names
- Password (masked?)
- Signal strength
- Connected devices
- Uptime
- IP address
- Device model
```

#### 3. FORMATTING
```
Output format:
- Message structure
- Use of emojis
- Line breaks
- Sections
```

### D. WIFI POWER ADJUSTMENT

#### 1. POWER LEVELS
```
Options:
- Available levels?
- dBm values?
- User-friendly names?
```

#### 2. IMPLEMENTATION
```
Technical:
- GenieACS parameter?
- Validation?
- Immediate effect?
```

### E. REBOOT MODEM

#### 1. CONFIRMATION FLOW
```
Safety:
- Confirmation required?
- Warning message?
- Expected downtime?
```

#### 2. REBOOT PROCESS
```
Technical:
- Command sent?
- Wait time?
- Status check after?
```

## 🔌 INTEGRATION POINTS

### 1. GENIEACS CONNECTION
```
Analisis:
- Connection parameters
- Authentication
- Error handling
- Retry logic
- Timeout settings
```

### 2. DATABASE INTEGRATION
```
Check:
- User device mapping
- Device info storage
- Update triggers
- Data consistency
```

### 3. NOTIFICATION SYSTEM
```
Verify:
- Success messages
- Error messages
- Multi-phone support
- Message formatting
```

## 🐛 EDGE CASES & BUGS

### POTENTIAL ISSUES TO CHECK:
```
1. Race conditions in bulk operations
2. State not cleared after timeout
3. Duplicate SSID handling
4. Special characters in WiFi names
5. Concurrent user operations
6. GenieACS connection drops
7. Partial bulk operation failures
8. Memory leaks in state storage
```

## 📊 OUTPUT YANG DIHARAPKAN

### 1. FLOW DIAGRAMS
```mermaid
graph TD
    A[User Command] --> B{Parse Intent}
    B --> C[GANTI_NAMA_WIFI]
    C --> D{Select Mode}
    D --> E[Single]
    D --> F[Bulk Manual]
    D --> G[Bulk Auto]
    // ... complete the diagram
```

### 2. STATE TRANSITION MATRIX
```
| Current State | Input | Next State | Action |
|--------------|-------|------------|---------|
| IDLE | "ganti nama wifi" | SELECT_MODE | Show menu |
| SELECT_MODE | "1" | SELECT_SSID | List SSIDs |
| ... | ... | ... | ... |
```

### 3. API CALL SEQUENCE
```
1. User: "ganti nama wifi"
2. Bot: Query user devices from DB
3. Bot: Get device status from GenieACS
4. Bot: Display options
5. User: Selects option
6. Bot: Validate selection
7. Bot: Send change to GenieACS
8. GenieACS: Apply changes
9. Bot: Confirm to user
```

### 4. ERROR HANDLING MATRIX
```
| Error Type | Handler | User Message | Recovery |
|------------|---------|--------------|----------|
| Device Offline | wifi-management | "Device tidak online" | Suggest reboot |
| ... | ... | ... | ... |
```

## 🔍 DEEP DIVE QUESTIONS

1. **Multi-tenancy**: Bagaimana sistem ensure user hanya bisa ubah WiFi mereka sendiri?
2. **Concurrency**: Apa yang terjadi jika 2 user ubah WiFi bersamaan?
3. **Rollback**: Ada mekanisme rollback jika gagal?
4. **Audit Trail**: Apakah perubahan di-log?
5. **Performance**: Berapa lama typical operation?
6. **Scalability**: Bagaimana handle 1000+ devices?
7. **Security**: Bagaimana protect sensitive data?
8. **Monitoring**: Ada health check untuk GenieACS?

## 📈 METRICS TO ANALYZE

```
- Average response time per operation
- Success rate per feature
- Most common error types
- User retry patterns
- Peak usage times
- Device type distribution
```

## 🎯 SPECIFIC FOCUS AREAS

### 1. BULK OPERATIONS
```
DEEP ANALYSIS NEEDED:
- How many devices can be processed in one bulk operation?
- Is there a queue system?
- How are failures handled in bulk?
- Can user cancel mid-operation?
- Progress indication mechanism?
```

### 2. STATE PERSISTENCE
```
INVESTIGATE:
- Where is temp state stored?
- How long before timeout?
- What triggers state cleanup?
- Can state survive bot restart?
- Memory usage implications?
```

### 3. GENIEACS INTEGRATION
```
TECHNICAL REVIEW:
- Connection pooling?
- Request queuing?
- Rate limiting?
- Error recovery?
- Fallback mechanisms?
```

## ✅ VALIDATION CHECKLIST

After analysis, verify:
- [ ] All user flows documented
- [ ] All error cases handled
- [ ] State transitions complete
- [ ] API integrations stable
- [ ] Performance acceptable
- [ ] Security measures adequate
- [ ] Code follows patterns
- [ ] Documentation updated

## 📝 EXPECTED DELIVERABLES

1. **Complete Flow Documentation** (Markdown)
2. **State Diagrams** (Mermaid)
3. **Error Handling Guide** (Table)
4. **API Integration Map** (Sequence Diagram)
5. **Test Scenarios** (Test Cases)
6. **Improvement Recommendations** (Priority List)
7. **Security Audit** (Checklist)
8. **Performance Report** (Metrics)

## 🚀 ANALYSIS EXECUTION STEPS

```bash
# Step 1: Read all WiFi handlers
Read wifi-management-handler.js
Read wifi-check-handler.js
Read wifi-power-handler.js
Read reboot-modem-handler.js

# Step 2: Read state handlers
Read wifi-name-state-handler.js
Read wifi-password-state-handler.js

# Step 3: Trace flows in raf.js
Search "GANTI_NAMA_WIFI"
Search "GANTI_SANDI_WIFI"
Search "CEK_WIFI"
Search "GANTI_POWER_WIFI"
Search "REBOOT_MODEM"

# Step 4: Check lib functions
Read lib/wifi.js
Check GenieACS functions

# Step 5: Test each flow
Create test cases for each feature
Run tests
Document results

# Step 6: Create diagrams
Draw flow diagrams
Create state machines
Map API calls

# Step 7: Write documentation
Compile findings
Create user guide
Update technical docs
```

---

*This comprehensive prompt will guide the analysis of the entire WiFi management system in RAF Bot V2*
