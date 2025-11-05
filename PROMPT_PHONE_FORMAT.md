# 📝 PROMPT TEMPLATE: PHONE NUMBER FORMAT GUIDANCE

## 🎯 PROMPT YANG KAMU MINTA:

```markdown
**KONTEKS:**
Saya ingin menambahkan user dengan nomor telepon internasional. Apakah nomor dengan awalan 886 (Taiwan) atau country code lainnya perlu tanda + di awal atau cukup nomor saja?

**PERTANYAAN SPESIFIK:**
1. Format mana yang valid: "886912345678" atau "+886912345678"?
2. Apakah sistem akan menerima nomor tanpa tanda +?
3. Bagaimana dengan country code lain seperti 81 (Japan), 86 (China), dll?

**YANG SAYA BUTUHKAN:**
- Penjelasan format yang diterima
- Contoh untuk berbagai negara
- Best practice untuk input nomor
- Cara sistem handle normalization
```

---

## ✅ JAWABAN LENGKAP:

### **1. KEDUA FORMAT VALID!**

```javascript
// TANPA TANDA + (Valid)
"886912345678"   ✅ → Auto-convert: "+886912345678"
"81901234567"    ✅ → Auto-convert: "+81901234567"  
"8613800138000"  ✅ → Auto-convert: "+8613800138000"

// DENGAN TANDA + (Valid)
"+886912345678"  ✅ → Stays: "+886912345678"
"+81901234567"   ✅ → Stays: "+81901234567"
"+8613800138000" ✅ → Stays: "+8613800138000"
```

### **2. SISTEM BEHAVIOR:**

| Input Type | Example | System Action | Final Result |
|------------|---------|---------------|--------------|
| Country code only | `886912345678` | Add + prefix | `+886912345678` |
| With + sign | `+886912345678` | Keep as-is | `+886912345678` |
| Local format | `0912345678` | ❌ Invalid | Error |
| Pre-configured local | `081234567890` | ✅ Convert | `6281234567890` |

### **3. SEMUA COUNTRY CODE SUPPORTED:**

```javascript
// Asian Countries
"886xxx"  // Taiwan     → +886xxx
"81xxx"   // Japan      → +81xxx
"82xxx"   // Korea      → +82xxx
"86xxx"   // China      → +86xxx
"852xxx"  // Hong Kong  → +852xxx
"65xxx"   // Singapore  → +65xxx

// Middle East
"971xxx"  // UAE        → +971xxx
"966xxx"  // Saudi      → +966xxx
"974xxx"  // Qatar      → +974xxx

// Europe
"44xxx"   // UK         → +44xxx
"33xxx"   // France     → +33xxx
"49xxx"   // Germany    → +49xxx

// ANY Country Code (1-999)
"XXXxxx"  // Any valid  → +XXXxxx
```

---

## 💡 IMPLEMENTATION EXAMPLES:

### **Example 1: Taiwan Number**
```javascript
// User input various formats
POST /api/users
{
  "name": "Chen Wei",
  "phone_number": "886912345678"  // WITHOUT +
}

// System accepts and normalizes
Response: {
  "phone_number": "+886912345678"  // WITH + in database
}
```

### **Example 2: Multiple Countries**
```javascript
// Mixed formats in one user
{
  "name": "International Business",
  "phone_number": "886912345678|+81901234567|6281234567890"
  //                Taiwan      | Japan       | Indonesia
  //                No +        | With +      | No +
}

// All normalized to:
"+886912345678|+81901234567|+6281234567890"
```

### **Example 3: Validation Check**
```javascript
// Test validation endpoint
GET /api/validate-phone?number=886912345678

Response: {
  "valid": true,
  "country": "INTERNATIONAL",
  "original": "886912345678",
  "normalized": "+886912345678",
  "message": "Valid Taiwan mobile number"
}
```

---

## 🎯 BEST PRACTICES:

### **DO:**
```javascript
✅ "886912345678"     // Country code clear
✅ "+886912345678"    // Explicit international
✅ "6281234567890"    // Indonesia without +
✅ "+1234567890123"   // Any country with +
```

### **DON'T:**
```javascript
❌ "0912345678"       // Missing country code
❌ "912345678"        // Ambiguous (which country?)
❌ "taiwan886912345"  // Mixed text and numbers
❌ "886-912-345-678"  // Dashes OK, but plain better
```

---

## 📊 VALIDATION RULES:

| Rule | Requirement |
|------|-------------|
| **Minimum Length** | 7 digits (with country code) |
| **Maximum Length** | 15 digits total |
| **Country Code** | 1-3 digits (1 to 999) |
| **Format** | Digits only (spaces/dashes removed) |
| **Output** | Always normalized with + |

---

## 🚀 QUICK ANSWER:

**Q: Nomor awalan 886 atau lainnya perlu tanda + atau tidak?**

**A: TIDAK PERLU! Kedua format diterima:**
- ✅ `886912345678` (tanpa +) → Valid
- ✅ `+886912345678` (dengan +) → Valid
- 🔄 System auto-normalize ke format dengan +
- 🌍 Berlaku untuk SEMUA country code (1-999)

---

## 📝 TESTING COMMAND:

```bash
# Test your implementation
node test/test-phone-with-without-plus.js

# Expected output:
✅ 886912345678  → +886912345678 (Taiwan)
✅ 81901234567   → +81901234567  (Japan)
✅ 8613800138000 → +8613800138000 (China)
✅ 971501234567  → +971501234567 (UAE)
```

---

*This prompt template demonstrates that country codes work with or without the + sign!*
