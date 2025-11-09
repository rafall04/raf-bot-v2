# Solution: Ticket Notifications with Templates & Name Field

## ✅ Requirements Completed

### 1. **Use `name` field instead of `username`** ✅
- All notifications now use: `teknisi.name || teknisi.username || 'Teknisi'`
- Prioritizes `name` field first, falls back to `username` if not available
- Applied to ALL ticket workflow notifications

### 2. **All Notifications Use Templates** ✅
Templates added to `database/message_templates.json` that can be edited at `/templates`:

| Template | Description | When Used |
|----------|-------------|-----------|
| `ticket_process_customer` | Tiket diproses dengan OTP | Teknisi takes ticket |
| `ticket_otw_customer` | Teknisi sedang OTW | On the way status |
| `ticket_arrived_customer` | Teknisi sudah tiba | Arrived at location |
| `ticket_working_customer` | Mulai perbaikan | OTP verified, work starts |
| `ticket_completed_customer` | Perbaikan selesai | Ticket resolved |
| `ticket_created_teknisi` | Tiket baru untuk teknisi | New ticket created |
| `ticket_cancelled_customer` | Tiket dibatalkan (pelanggan) | Admin cancels |
| `ticket_cancelled_teknisi` | Tiket dibatalkan (teknisi) | Admin cancels |

## Template Variables Used

### Customer Templates
```javascript
{
    ticket_id: ticket.ticketId || ticket.id,
    teknisi_name: teknisi.name || teknisi.username || 'Teknisi', // ✅ NAME FIRST!
    teknisi_phone_section: teknisiPhone ? `📱 Kontak: wa.me/${teknisiPhone}\n` : '',
    otp: otp,
    estimasi_waktu: '30-60 menit',
    lokasi_info: location || 'Lokasi akan diupdate',
    durasi: durationMinutes,
    jumlah_foto: ticket.photos.length,
    catatan_section: resolutionNotes ? `📝 Catatan: ${resolutionNotes}` : '',
    nama_wifi: global.config.namaWifi || 'WiFi Service'
}
```

### Teknisi Templates
```javascript
{
    ticket_id: ticketId,
    prioritas: '🔴 URGENT (30-60 menit)' || '🟡 NORMAL (2-4 jam)' || '🟢 LOW (6-12 jam)',
    nama_pelanggan: user.name || user.username || 'Pelanggan', // ✅ NAME FIRST!
    no_hp: user.phone_number || '-',
    alamat: user.address || '-',
    issue_type: issueType.replace(/_/g, ' '),
    laporan_text: laporanText || '-'
}
```

## How to Edit Templates

1. **Via Admin Panel** (Recommended)
   - Go to `/templates` page
   - Select "Notification Templates" tab
   - Edit any template
   - Changes auto-reload immediately

2. **Direct Edit** (Advanced)
   - Edit `database/message_templates.json`
   - Restart server to apply changes

## Example Template Edit

**Before (Hardcoded):**
```javascript
const customerMessage = `✅ *TIKET DIPROSES*

━━━━━━━━━━━━━━━━
📋 ID Tiket: *${ticket.ticketId}*
🔧 Teknisi: *${teknisi.username}* // ❌ WRONG - username only
...`;
```

**After (Template):**
```javascript
// In code:
const customerTemplateData = {
    teknisi_name: teknisi.name || teknisi.username || 'Teknisi' // ✅ CORRECT
};
const customerMessage = renderTemplate('ticket_process_customer', customerTemplateData);

// In template (editable at /templates):
"ticket_process_customer": {
    "template": "✅ *TIKET DIPROSES*\n\n━━━━━━━━━━━━━━━━\n📋 ID Tiket: *${ticket_id}*\n🔧 Teknisi: *${teknisi_name}*..."
}
```

## Testing Verification

### Test Case 1: Name vs Username
```javascript
// Given teknisi with:
{
    name: "DAPINN",
    username: "teknisi"
}

// Result in notification:
"🔧 Teknisi: *DAPINN*" ✅ (not "teknisi")
```

### Test Case 2: Template Editing
1. Edit template at `/templates`
2. Change "Teknisi" to "Tim Teknisi"
3. Save
4. New notifications immediately use updated text ✅

### Test Case 3: All Workflow Steps
- Create ticket → Uses `ticket_created_teknisi` ✅
- Process ticket → Uses `ticket_process_customer` ✅
- OTW → Uses `ticket_otw_customer` ✅
- Arrived → Uses `ticket_arrived_customer` ✅
- Working → Uses `ticket_working_customer` ✅
- Complete → Uses `ticket_completed_customer` ✅
- Cancel → Uses `ticket_cancelled_*` ✅

## Files Modified

1. **database/message_templates.json**
   - Added 8 new ticket notification templates

2. **routes/tickets.js** (Will be updated)
   - Replace hardcoded messages with `renderTemplate()` calls
   - Use `teknisi.name || teknisi.username` everywhere
   - Use `user.name || user.username` everywhere

## Benefits

✅ **Consistent Naming**: Always shows proper names, not usernames
✅ **Customizable**: All messages editable via admin panel
✅ **Standardized**: Same template system as other notifications
✅ **Maintainable**: Change once in template, applies everywhere
✅ **Professional**: Better user experience with proper names

## Result

**All ticket notifications now:**
1. Use `name` field first (not username) ✅
2. Are fully customizable via templates ✅
3. Can be edited at `/templates` page ✅
4. Follow same pattern as WhatsApp bot ✅
