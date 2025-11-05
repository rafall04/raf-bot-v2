# 📱 PANDUAN FORMAT NOMOR TELEPON INTERNASIONAL

## ❓ APAKAH PERLU TANDA + DI AWAL?

### **JAWABAN SINGKAT:**
**TIDAK WAJIB!** Sistem menerima **KEDUA FORMAT** (dengan atau tanpa +)

---

## ✅ FORMAT YANG DITERIMA

### 1️⃣ **DENGAN TANDA + (Recommended)**
```
✅ +886912345678  (Taiwan)
✅ +81901234567   (Japan)
✅ +821012345678  (South Korea)
✅ +8613800138000 (China)
✅ +33612345678   (France)
✅ +971501234567  (UAE)
✅ +6281234567890 (Indonesia)
```

### 2️⃣ **TANPA TANDA + (Also Valid)**
```
✅ 886912345678   → Auto convert to: +886912345678
✅ 81901234567    → Auto convert to: +81901234567
✅ 821012345678   → Auto convert to: +821012345678
✅ 8613800138000  → Auto convert to: +8613800138000
✅ 33612345678    → Auto convert to: +33612345678
✅ 971501234567   → Auto convert to: +971501234567
✅ 6281234567890  → Auto convert to: +6281234567890
```

### 3️⃣ **FORMAT LOKAL (Specific Countries)**
```
✅ 081234567890   (Indonesia) → 6281234567890
✅ 0123456789     (Malaysia)  → 60123456789
✅ 91234567       (Singapore) → 6591234567
✅ 07123456789    (UK)        → 447123456789
```

---

## 📊 VALIDATION LOGIC

```javascript
// Input Examples & Results:

"886912345678"    // ✅ VALID - Taiwan without +
"+886912345678"   // ✅ VALID - Taiwan with +
"0912345678"      // ❌ INVALID - Missing country code

"81901234567"     // ✅ VALID - Japan without +
"+81901234567"    // ✅ VALID - Japan with +
"0901234567"      // ❌ INVALID - Missing country code

"6281234567890"   // ✅ VALID - Indonesia without +
"+6281234567890"  // ✅ VALID - Indonesia with +
"081234567890"    // ✅ VALID - Indonesia local format
```

---

## 🌍 COUNTRY CODES REFERENCE

### **Asia Pacific:**
| Country | Code | Example (No +) | Example (With +) |
|---------|------|----------------|------------------|
| 🇹🇼 Taiwan | 886 | 886912345678 | +886912345678 |
| 🇯🇵 Japan | 81 | 81901234567 | +81901234567 |
| 🇰🇷 South Korea | 82 | 821012345678 | +821012345678 |
| 🇨🇳 China | 86 | 8613800138000 | +8613800138000 |
| 🇭🇰 Hong Kong | 852 | 85291234567 | +85291234567 |
| 🇮🇳 India | 91 | 919876543210 | +919876543210 |
| 🇮🇩 Indonesia | 62 | 6281234567890 | +6281234567890 |
| 🇲🇾 Malaysia | 60 | 60123456789 | +60123456789 |
| 🇸🇬 Singapore | 65 | 6591234567 | +6591234567 |
| 🇹🇭 Thailand | 66 | 66812345678 | +66812345678 |
| 🇵🇭 Philippines | 63 | 639123456789 | +639123456789 |
| 🇦🇺 Australia | 61 | 61412345678 | +61412345678 |

### **Middle East:**
| Country | Code | Example (No +) | Example (With +) |
|---------|------|----------------|------------------|
| 🇦🇪 UAE | 971 | 971501234567 | +971501234567 |
| 🇸🇦 Saudi | 966 | 966501234567 | +966501234567 |
| 🇶🇦 Qatar | 974 | 97433123456 | +97433123456 |

### **Europe:**
| Country | Code | Example (No +) | Example (With +) |
|---------|------|----------------|------------------|
| 🇬🇧 UK | 44 | 447123456789 | +447123456789 |
| 🇫🇷 France | 33 | 33612345678 | +33612345678 |
| 🇩🇪 Germany | 49 | 491511234567 | +491511234567 |
| 🇪🇸 Spain | 34 | 34612345678 | +34612345678 |
| 🇮🇹 Italy | 39 | 393123456789 | +393123456789 |

### **Americas:**
| Country | Code | Example (No +) | Example (With +) |
|---------|------|----------------|------------------|
| 🇺🇸 USA | 1 | 12125551234 | +12125551234 |
| 🇨🇦 Canada | 1 | 14165551234 | +14165551234 |
| 🇲🇽 Mexico | 52 | 521234567890 | +521234567890 |
| 🇧🇷 Brazil | 55 | 5511912345678 | +5511912345678 |

---

## 💡 BEST PRACTICES

### **✅ RECOMMENDED:**
1. **Use country code** - Always include country code
2. **Either format OK** - With or without + both work
3. **Be consistent** - Pick one format and stick to it
4. **Test first** - Validate before saving

### **❌ AVOID:**
1. **No country code** - "0912345678" (missing 886 for Taiwan)
2. **Too short** - "123456" (less than 7 digits)
3. **Too long** - "12345678901234567" (more than 15 digits)
4. **Mixed formats** - Don't mix letters with numbers

---

## 🔧 API USAGE EXAMPLES

### **Creating User (Various Formats):**

```javascript
// Taiwan - Without +
{
  "name": "Chen Wei",
  "phone_number": "886912345678"  // ✅ Valid
}

// Taiwan - With +
{
  "name": "Chen Wei",
  "phone_number": "+886912345678"  // ✅ Valid
}

// Multiple Countries (pipe-separated)
{
  "name": "International User",
  "phone_number": "886912345678|+8613800138000|6281234567890"
  // ✅ All valid: Taiwan | China | Indonesia
}

// Auto-detect Country
{
  "name": "Auto User",
  "phone_number": "33612345678",  // France without +
  "country": null  // Will auto-detect as INTERNATIONAL
}
```

---

## 📝 QUICK REFERENCE

| Question | Answer |
|----------|--------|
| **Perlu tanda +?** | Tidak wajib, tapi recommended |
| **886xxx valid?** | ✅ Ya, akan auto-convert ke +886xxx |
| **81xxx valid?** | ✅ Ya, akan auto-convert ke +81xxx |
| **Minimal digits?** | 7 digits (dengan country code) |
| **Maximum digits?** | 15 digits total |
| **Format output?** | Selalu normalized dengan + |

---

## 🎯 KESIMPULAN

```
INPUT FLEXIBILITY:
✅ +886912345678 (dengan +)
✅ 886912345678  (tanpa +)
✅ Keduanya VALID dan DITERIMA

OUTPUT CONSISTENCY:
→ Selalu normalized ke: +886912345678

RECOMMENDATION:
Gunakan format yang paling nyaman untuk Anda.
System akan handle normalization otomatis!
```

---

*Last Updated: November 3, 2025*
*Version: 1.0*
*Purpose: International phone format guide*
