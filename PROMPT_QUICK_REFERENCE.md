# 🚀 PROMPT QUICK REFERENCE CARD

## ⚡ FORMULA CEPAT

```
[KONTEKS] + [TUGAS] + [INSTRUKSI] + [BATASAN] + [OUTPUT]
```

---

## 📝 INSTANT TEMPLATES

### 🐛 FIX BUG
```
Bug: [apa]. Lokasi: [dimana]. 
Baca AI_MAINTENANCE_GUIDE.md, fix di [handler], test dengan [scenario].
Jangan ubah logic lain. Output: code fix + penjelasan.
```

### ✨ ADD FEATURE  
```
Tambah fitur [nama] untuk [tujuan].
Baca docs, tentukan handler, ikuti pattern.
Logic di handler, routing di raf.js. Output: implementation + test.
```

### 🔧 MODIFY
```
Ubah [apa] di [handler] karena [alasan].
Minimal changes, keep pattern. Output: code + impact analysis.
```

### 🔍 EXPLAIN
```
Jelaskan flow [fitur] dari WORKFLOW_DOCUMENTATION.md.
Include: handlers, states, data flow. Output: step-by-step + diagram.
```

### ⚡ OPTIMIZE
```
Optimasi [component] yang [issue].
Tanpa breaking changes. Output: optimized code + benchmark.
```

---

## ✅ CHECKLIST SEBELUM SEND

□ Spesifik? (bukan "fix bug" tapi "fix bug OTP di teknisi")  
□ Ada konteks? (kenapa, dimana, kapan)  
□ Mention docs? (AI_MAINTENANCE_GUIDE.md, dll)  
□ Ada instruksi? (langkah 1, 2, 3...)  
□ Ada batasan? (jangan ubah X, pertahankan Y)  
□ Output jelas? (code, test, docs)  

---

## 🎯 POWER PHRASES

### Untuk Mulai:
- "Baca [docs] terlebih dahulu..."
- "Berdasarkan pattern di [file]..."  
- "Ikuti flow existing di..."
- "Pertahankan consistency dengan..."

### Untuk Instruksi:
- "Identifikasi handler yang..."
- "Verify implementation of..."
- "Check multi-phone pattern..."
- "Test dengan scenario..."

### Untuk Batasan:
- "TANPA mengubah..."
- "Pertahankan backward compatibility..."
- "Jangan create handler baru jika..."
- "Minimal breaking changes..."

### Untuk Output:
- "Berikan code yang ready to run..."
- "Include test verification..."
- "Update dokumentasi relevan..."
- "Explain root cause..."

---

## 📊 SCORING CEPAT

```
Specificity:  [ ] Vague  [✓] Clear  
Context:      [ ] None   [✓] Given  
Instructions: [ ] None   [✓] Listed  
Constraints:  [ ] None   [✓] Stated  
Output:       [ ] Vague  [✓] Defined  

Total ✓ >= 4 = SEND IT! 🚀
```

---

## 🚫 RED FLAGS

❌ "Fix semua bug"  
❌ "Buat lebih baik"  
❌ "Kamu tahu lah"  
❌ "Seperti kemarin"  
❌ "Cepat aja"  

---

## 💎 GOLDEN RULES

1. **Specific > General**
2. **Context > Assumption**  
3. **Steps > Single command**
4. **Constraints > Freedom**
5. **Defined output > Surprise**

---

## 🔥 EXAMPLE COMPARISON

### ❌ BAD:
```
"otp error, fix"
```

### ✅ GOOD:
```
"Bug: OTP tidak muncul di notif sampai lokasi.
Check teknisi-workflow-handler.js handleSampaiLokasi().
Baca AI_MAINTENANCE_GUIDE.md dulu.
Add recovery jika OTP missing.
Keep box format, kirim ke semua nomor.
Output: fixed code + test steps."
```

---

## 📚 RESOURCES

**Full Guide:** PROMPT_ENGINEERING_GUIDE.md  
**AI Guide:** AI_MAINTENANCE_GUIDE.md  
**Workflows:** WORKFLOW_DOCUMENTATION.md  
**Templates:** AI_PROMPT_GUIDE.md  

---

*Print this for quick reference!* 🖨️

*Version: 1.0 | Updated: Nov 3, 2025*
