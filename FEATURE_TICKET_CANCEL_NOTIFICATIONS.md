# FEATURE: Ticket Cancel Notifications with Template Support

## Implementation Summary
Added comprehensive notification system for ticket cancellation with customizable templates.

## User Requirements
1. ✅ Send notifications to customers when ticket is cancelled
2. ✅ Send notifications to all teknisi when ticket is cancelled  
3. ✅ Templates must be customizable from admin panel
4. ✅ Consistent with other template standards

## Changes Made

### 1. New Templates Added (database/message_templates.json)

#### Customer Notification Template
```json
"ticket_cancelled_customer": {
    "name": "Notifikasi Pembatalan Tiket (Pelanggan)",
    "template": "❌ *TIKET LAPORAN DIBATALKAN* ❌\n\nHalo *${nama_pelanggan}*,\n\nTiket laporan Anda telah dibatalkan oleh Admin.\n\n📋 *Detail Tiket:*\n• ID Tiket: *${ticket_id}*\n• Masalah: ${issue_type}\n• Tanggal: ${tanggal}\n• Dibatalkan oleh: ${cancelled_by}\n\n${alasan_section}\n\nJika Anda masih mengalami kendala, silakan buat laporan baru atau hubungi kami di ${telfon}.\n\nTerima kasih. 🙏\n\n*${nama_wifi}*"
}
```

#### Teknisi Notification Template  
```json
"ticket_cancelled_teknisi": {
    "name": "Notifikasi Pembatalan Tiket (Teknisi)",
    "template": "🚫 *TIKET DIBATALKAN OLEH ADMIN* 🚫\n\n📋 *Detail Tiket:*\n• ID Tiket: *${ticket_id}*\n• Pelanggan: ${nama_pelanggan}\n• No. HP: ${no_hp}\n• Alamat: ${alamat}\n• Masalah: ${issue_type}\n• Prioritas: ${prioritas}\n\n⚠️ *Status:* DIBATALKAN\n• Dibatalkan oleh: ${cancelled_by}\n• Waktu pembatalan: ${waktu_pembatalan}\n\n${alasan_section}\n\n_Tiket ini tidak perlu diproses lagi._"
}
```

### 2. Updated Cancel Endpoint (routes/tickets.js)

#### Key Changes:
1. Import renderTemplate from templating module
2. Format issue type and priority for display
3. Create dynamic alasan section
4. Send to multiple phone numbers for customers
5. Notify all teknisi

#### Implementation Details:
```javascript
// Import template system
const { renderTemplate } = require('../lib/templating');

// Format display values
const issueTypeDisplay = report.issueType ? 
    report.issueType.replace(/_/g, ' ').toLowerCase()
        .replace(/wifi/g, 'WiFi')
        .replace(/\b\w/g, c => c.toUpperCase()) : 
    'Gangguan Internet';

// Create template data
const baseTemplateData = {
    ticket_id: report.ticketId || report.id,
    issue_type: issueTypeDisplay,
    tanggal: new Date(report.createdAt).toLocaleString('id-ID'),
    cancelled_by: req.user.username || 'Admin',
    waktu_pembatalan: new Date().toLocaleString('id-ID'),
    alasan_section: alasanSection,
    prioritas: priorityDisplay
};

// Send to customer (handles multiple phone numbers)
const customerMsg = renderTemplate('ticket_cancelled_customer', customerTemplateData);

// Send to all teknisi
const teknisiMsg = renderTemplate('ticket_cancelled_teknisi', teknisiTemplateData);
```

### 3. Features Implemented

#### Multiple Phone Number Support
- Splits phone numbers by `|` separator
- Sends to all customer phone numbers
- Proper error handling per number

#### Teknisi Broadcast
- Finds all active teknisi accounts
- Sends notification to each teknisi
- Includes customer details for context

#### Template Integration
- Uses standard renderTemplate function
- Consistent placeholder format `${placeholder}`
- Automatic global data injection (nama_wifi, telfon, etc.)
- Supports conditional sections (alasan_section)

### 4. Template Administration

Templates are automatically available in admin panel at `/templates`:
1. Navigate to Templates page
2. Select "Notification Templates" tab
3. Find `ticket_cancelled_customer` and `ticket_cancelled_teknisi`
4. Edit template text as needed
5. Save changes

#### Available Placeholders:
- `${ticket_id}` - Ticket ID
- `${nama_pelanggan}` - Customer name
- `${issue_type}` - Issue type (formatted)
- `${tanggal}` - Creation date
- `${cancelled_by}` - Admin who cancelled
- `${waktu_pembatalan}` - Cancellation time
- `${alasan_section}` - Cancellation reason (dynamic)
- `${prioritas}` - Priority level (with emoji)
- `${no_hp}` - Customer phone (teknisi only)
- `${alamat}` - Customer address (teknisi only)
- `${nama_wifi}` - WiFi service name (from config)
- `${telfon}` - Support phone (from config)

## Testing Instructions

### 1. Cancel a Ticket
1. Login as admin
2. Go to ticket page
3. Click "Batalkan" on any ticket
4. Fill cancellation reason
5. Submit

### 2. Verify Notifications
Check console logs:
```
[ADMIN_CANCEL_TICKET] Notified customer at 6285xxx@s.whatsapp.net
[ADMIN_CANCEL_TICKET] Notified teknisi DAPINN at 6289xxx@s.whatsapp.net
```

### 3. Edit Templates
1. Go to `/templates` page
2. Find notification templates
3. Edit text
4. Save and test again

## Code Quality

✅ **Consistent** with existing template system
✅ **Standardized** placeholder format
✅ **Multiple phone** support
✅ **Error handling** per recipient
✅ **Proper logging** for debugging
✅ **Admin editable** via web interface

## Files Modified
1. `database/message_templates.json` - Added 2 new templates
2. `routes/tickets.js` - Updated cancel endpoint
3. Templates auto-loaded by `lib/templating.js`
4. Editable via `views/sb-admin/templates.php`

## Result
- Customers receive clear cancellation notification
- All teknisi are informed to stop processing
- Templates fully customizable by admin
- Consistent with system standards
