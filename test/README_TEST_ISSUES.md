# Test Script Issues & Solutions

## ⚠️ PENTING: Masalah Script Test Stuck/Hang

### Penyebab Stuck:
Script test bisa stuck/hang karena:

1. **HTTP Request ke Server yang Tidak Ada**
   - Module `device-status.js` melakukan axios request ke GenieACS
   - Jika server tidak ada, axios bisa stuck pada:
     - DNS resolution
     - TCP handshake
     - Connection timeout (meski sudah set timeout, bisa tetap hang)

2. **Import Chain Problem**
   ```
   test-script.js
       ↓ import
   smart-report-handler.js
       ↓ import
   device-status.js
       ↓ uses
   axios.get() → STUCK!
   ```

3. **Mock Terlambat**
   - Mock axios setelah import sudah terlambat
   - Module sudah loaded dengan axios asli

### ✅ Solusi:

#### Cara 1: Mock Axios SEBELUM Import (RECOMMENDED)
```javascript
// Mock axios SEBELUM import apapun
const mockAxios = {
    get: async () => ({ data: mockData })
};
require.cache[require.resolve('axios')] = {
    exports: mockAxios
};

// Baru import modules
const { handleFunction } = require('../module');
```

#### Cara 2: Avoid Real Module Import
```javascript
// Jangan import module yang ada HTTP call
// Buat fungsi simulasi sendiri
function simulateFunction() {
    // Logic tanpa HTTP call
}
```

#### Cara 3: Set Environment Variable
```javascript
// Set flag untuk skip HTTP calls
process.env.TEST_MODE = 'true';

// Di module, check flag
if (process.env.TEST_MODE === 'true') {
    return mockData;
}
```

### 📋 Checklist Sebelum Run Test:

- [ ] Pastikan tidak ada HTTP/Network calls
- [ ] Mock semua external dependencies
- [ ] Set timeout untuk test script
- [ ] Gunakan `process.exit()` di akhir test
- [ ] Test dulu dengan console.log sederhana

### 💡 Tips Mencegah Stuck:

1. **Selalu Mock External Services**
   - Database connections
   - HTTP requests
   - File system operations yang besar
   - WebSocket connections

2. **Use Safe Test Pattern**
   ```javascript
   // Set timeout untuk whole script
   setTimeout(() => {
       console.error('Test timeout!');
       process.exit(1);
   }, 10000); // 10 seconds max
   
   // Run tests
   runTests().then(() => {
       process.exit(0);
   });
   ```

3. **Avoid Real Module Dependencies**
   - Buat test isolated
   - Mock di level paling awal
   - Gunakan dependency injection

### 🚫 Yang Harus Dihindari:

- Import module yang punya side effects
- HTTP calls tanpa timeout
- Infinite loops atau recursive calls
- Database connections tanpa mock
- WebSocket atau real-time connections

### ✅ Test Script yang Aman:

Gunakan: `test-lapor-workflow-safe.js`
- Tidak ada HTTP calls
- Semua di-mock
- Ada process.exit()
- Isolated testing

---
**Note:** Setiap test stuck = kehilangan credit. Selalu gunakan safe pattern!
