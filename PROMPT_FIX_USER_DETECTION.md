# PROMPT KOMPREHENSIF: FIX USER DETECTION ISSUE
## Nomor 6285233047094 Tidak Terdeteksi Meskipun Ada di Database

---

## 🔴 MASALAH UTAMA

### GEJALA:
1. **Nomor HP**: 6285233047094 sudah terdaftar di `database.sqlite`
2. **Command**: User ketik "cek wifi" 
3. **Response Bot**: "Anda belum terdaftar sebagai pelanggan. Untuk cek pelanggan lain, bisa sebutkan ID atau nama pelanggannya ya."
4. **Expected**: Bot seharusnya mendeteksi user dan menampilkan info WiFi

### ISSUES:
1. **Detection Failure**: Nomor ada di database tapi tidak terdeteksi
2. **Ambiguous Message**: Pesan error membingungkan (seolah-olah dia owner/teknisi)
3. **Logic Error**: Kemungkinan format nomor atau cara matching yang salah

---

## 📁 FILE-FILE YANG HARUS DIANALISIS

### 1. DATABASE STRUCTURE
```
Path: c:\project\raf-bot-v2\database.sqlite
Table: users
Columns yang relevan:
- id (INTEGER PRIMARY KEY)
- phone_number (TEXT) - Format? Multiple numbers?
- name (TEXT)
- device_id (TEXT)
- subscription (TEXT)
- ssid_id (TEXT)
- bulk (TEXT)
```

### 2. WIFI CHECK HANDLER
```
Path: c:\project\raf-bot-v2\message\handlers\wifi-check-handler.js
Functions:
- handleCekWifi()
- handleCekStatusWifi()
```

### 3. MAIN ROUTER
```
Path: c:\project\raf-bot-v2\message\raf.js
Lines to check:
- Line 140: plainSenderNumber extraction
- Line 141-142: isOwner & isTeknisi check
- Lines around CEK_WIFI case handling
```

### 4. DATABASE LIBRARY
```
Path: c:\project\raf-bot-v2\lib\database.js
Functions:
- How users are loaded
- Format of phone numbers
```

---

## 🔍 ANALISIS YANG DIPERLUKAN

### STEP 1: CHECK DATABASE FORMAT
```sql
-- Check exact format in database
SELECT id, phone_number, name FROM users WHERE phone_number LIKE '%6285233047094%';

-- Check if using pipe separator
SELECT id, phone_number, name FROM users WHERE phone_number LIKE '%85233047094%';

-- Check all formats
SELECT id, phone_number, name FROM users;
```

### STEP 2: TRACE PHONE NUMBER PROCESSING
```javascript
// Check these flows:

1. WhatsApp sends: 
   - sender = "6285233047094@s.whatsapp.net"

2. raf.js extracts:
   - plainSenderNumber = sender.split('@')[0] 
   - Result: "6285233047094"

3. User lookup:
   - users.find(v => v.phone_number.split("|").includes(plainSenderNumber))
   
4. Potential issues:
   - phone_number might be: "085233047094" (without 62)
   - phone_number might be: "85233047094" (without 0 or 62)
   - phone_number might have spaces/dashes
   - Case sensitivity issues
```

### STEP 3: CHECK CEK_WIFI HANDLER
```javascript
// In wifi-check-handler.js, check:

async function handleCekWifi({ sender, args, isOwner, isTeknisi, pushname, users, reply, global, axios, mess }) {
    // How is user found?
    let user;
    
    // For regular users
    const plainSenderNumber = sender.split('@')[0];
    user = users.find(v => v.phone_number && v.phone_number.split("|").includes(plainSenderNumber));
    
    // Error message
    if (!user) {
        // THIS IS THE PROBLEM MESSAGE
        return reply(mess.userNotRegister);
    }
}
```

### STEP 4: CHECK MESSAGE TEMPLATES
```javascript
// In message templates or mess object:
mess.userNotRegister = "Anda belum terdaftar sebagai pelanggan. Untuk cek pelanggan lain, bisa sebutkan ID atau nama pelanggannya ya."

// Should be different for:
1. Regular users not registered
2. Owner/Teknisi checking other users
```

---

## 🛠️ FIXES YANG DIPERLUKAN

### FIX 1: PHONE NUMBER NORMALIZATION
```javascript
// Create helper function
function normalizePhoneNumber(phone) {
    // Remove all non-digits
    let cleaned = phone.replace(/\D/g, '');
    
    // Handle various formats
    if (cleaned.startsWith('62')) {
        return cleaned; // Already in international format
    } else if (cleaned.startsWith('0')) {
        return '62' + cleaned.substring(1); // Convert 08xxx to 628xxx
    } else {
        return '62' + cleaned; // Assume it's without prefix
    }
}

// Update user lookup
const normalizedSender = normalizePhoneNumber(sender.split('@')[0]);
user = users.find(v => {
    if (!v.phone_number) return false;
    
    // Check all phone numbers (separated by |)
    const phones = v.phone_number.split('|').map(p => normalizePhoneNumber(p.trim()));
    return phones.includes(normalizedSender);
});
```

### FIX 2: IMPROVE ERROR MESSAGES
```javascript
// Separate messages for different contexts
if (!user) {
    if (isOwner || isTeknisi) {
        // For owner/teknisi without specifying customer
        return reply("Mohon sebutkan ID atau nama pelanggan yang ingin dicek. Contoh: cek wifi 1 atau cek wifi John");
    } else {
        // For unregistered regular users
        return reply("Maaf, nomor Anda belum terdaftar sebagai pelanggan. Silakan hubungi admin untuk mendaftar.");
    }
}
```

### FIX 3: DEBUG LOGGING
```javascript
// Add debug logs to trace the issue
console.log('[CEK_WIFI_DEBUG] Sender:', sender);
console.log('[CEK_WIFI_DEBUG] PlainSenderNumber:', plainSenderNumber);
console.log('[CEK_WIFI_DEBUG] Users count:', users.length);
console.log('[CEK_WIFI_DEBUG] First 3 users phone_number:', users.slice(0,3).map(u => u.phone_number));
console.log('[CEK_WIFI_DEBUG] User found:', user ? 'Yes' : 'No');
if (!user) {
    // Check if number exists in any format
    const searchNum = plainSenderNumber.replace('62', '');
    const possibleUser = users.find(v => v.phone_number && v.phone_number.includes(searchNum));
    console.log('[CEK_WIFI_DEBUG] Possible user with partial match:', possibleUser);
}
```

### FIX 4: DATABASE PHONE FORMAT STANDARDIZATION
```javascript
// When saving to database, always normalize
function saveUserPhone(phone) {
    return normalizePhoneNumber(phone);
}

// Migration script to fix existing data
async function migratePhoneNumbers() {
    const users = await db.all('SELECT id, phone_number FROM users');
    
    for (const user of users) {
        if (user.phone_number) {
            const phones = user.phone_number.split('|').map(p => normalizePhoneNumber(p.trim()));
            const normalized = phones.join('|');
            
            await db.run(
                'UPDATE users SET phone_number = ? WHERE id = ?',
                [normalized, user.id]
            );
        }
    }
}
```

---

## 🧪 TESTING CHECKLIST

### TEST CASE 1: Check Database
```bash
# Open SQLite
sqlite3 database.sqlite

# Check user
SELECT id, phone_number, name FROM users WHERE phone_number LIKE '%233047094%';
```

### TEST CASE 2: Test Various Formats
Test with these sender formats:
- `6285233047094@s.whatsapp.net` (standard)
- `085233047094@s.whatsapp.net` (local format)
- `85233047094@s.whatsapp.net` (no prefix)

### TEST CASE 3: Test Message Flow
1. Regular user (not in DB) → Should get: "Maaf, nomor Anda belum terdaftar"
2. Regular user (in DB) → Should get WiFi info
3. Owner/Teknisi (no args) → Should get: "Mohon sebutkan ID atau nama pelanggan"
4. Owner/Teknisi (with args) → Should get customer WiFi info

---

## 📝 IMPLEMENTATION PRIORITY

### HIGH PRIORITY:
1. **Check exact phone_number format in database** for user 6285233047094
2. **Add normalization function** for phone number matching
3. **Fix ambiguous error messages** - separate for regular users vs owner/teknisi

### MEDIUM PRIORITY:
4. Add comprehensive debug logging
5. Create migration script for existing data
6. Update save functions to normalize on input

### LOW PRIORITY:
7. Add unit tests for phone number matching
8. Document phone number format requirements
9. Add validation on user registration

---

## 🎯 ROOT CAUSE POSSIBILITIES

### MOST LIKELY:
1. **Format Mismatch**: Database has "085233047094" but bot checks for "6285233047094"
2. **Pipe Separator Issue**: Multiple numbers not split correctly
3. **Whitespace**: Extra spaces in phone_number field

### LESS LIKELY:
4. Database not loaded properly
5. Case sensitivity issue
6. Character encoding issue

---

## 💻 QUICK FIX COMMAND

```javascript
// Immediate fix - Add this to wifi-check-handler.js
function findUserByPhone(users, sender) {
    const senderNum = sender.split('@')[0];
    
    // Try multiple formats
    const formats = [
        senderNum,                    // 6285233047094
        senderNum.replace('62', '0'), // 085233047094  
        senderNum.replace('62', ''),  // 85233047094
    ];
    
    for (const format of formats) {
        const user = users.find(v => {
            if (!v.phone_number) return false;
            return v.phone_number.includes(format);
        });
        if (user) return user;
    }
    
    return null;
}

// Use it
const user = findUserByPhone(users, sender);
```

---

## ⚠️ IMPORTANT NOTES

1. **Don't forget**: Check if global.users is loaded correctly
2. **Consider**: Multiple phone numbers per user (pipe separated)
3. **Remember**: isOwner and isTeknisi logic affects message flow
4. **Test**: Both registered and unregistered users
5. **Verify**: Database content matches expected format

---

## 📞 CONTACT FOR TESTING
Test Number: 6285233047094
Expected: Should be detected as registered user
Current: Not detected

---

*END OF PROMPT - Use this comprehensive guide to fix the user detection issue*
