# Solution: Standardized Ticket Notification System

## Problem Analysis

The notification system was not properly handling multiple phone numbers separated by `|`:

**Wrong:**
```
pelangganId: 6285233047094|6285604652630@s.whatsapp.net
```

**Correct:**
```
pelangganId: 6285233047094@s.whatsapp.net (first phone only)
pelangganPhone: 6285233047094|6285604652630 (all phones with separator)
```

## Data Structure Pattern (Following WhatsApp Bot)

### Ticket Fields
```javascript
{
    ticketId: "K8LP7LA",
    pelangganUserId: 1,
    pelangganId: "6285233047094@s.whatsapp.net",  // FIRST phone as JID
    pelangganPhone: "6285233047094|6285604652630", // ALL phones with |
    pelangganName: "Test User",
    // ... other fields
}
```

## Notification Flow (From WhatsApp Bot)

### 1. Process Ticket (teknisi-workflow-handler.js)
```javascript
// Step 1: Send to main customer (pelangganId)
await global.raf.sendMessage(ticket.pelangganId, { text: customerMessage });

// Step 2: Send to ALL other numbers in pelangganPhone
if (ticket.pelangganPhone) {
    const phones = ticket.pelangganPhone.split('|').map(p => p.trim()).filter(p => p);
    for (const phone of phones) {
        let phoneJid = formatToJID(phone);
        // Skip if already sent to main customer
        if (phoneJid === ticket.pelangganId) continue;
        await global.raf.sendMessage(phoneJid, { text: customerMessage });
    }
}
```

## Implementation in routes/tickets.js

### 1. Fix pelangganId Creation
```javascript
// When creating ticket - use FIRST phone only
pelangganId: (() => {
    if (!user.phone_number) return '';
    const phones = user.phone_number.split('|').map(p => p.trim()).filter(p => p);
    if (phones.length === 0) return '';
    let firstPhone = phones[0].replace(/[^0-9]/g, '');
    // Format to 62xxx
    if (firstPhone.startsWith('0')) {
        firstPhone = '62' + firstPhone.substring(1);
    } else if (!firstPhone.startsWith('62')) {
        firstPhone = '62' + firstPhone;
    }
    return `${firstPhone}@s.whatsapp.net`;
})()
```

### 2. When Processing Existing Ticket
```javascript
// Populate missing fields from user data
if (!ticket.pelangganPhone && user.phone_number) {
    ticket.pelangganPhone = user.phone_number; // Keep with | separator
}

if (!ticket.pelangganId && user.phone_number) {
    const phones = user.phone_number.split('|').map(p => p.trim()).filter(p => p);
    if (phones.length > 0) {
        let phoneJid = formatFirstPhoneToJID(phones[0]);
        ticket.pelangganId = phoneJid; // Only first as JID
    }
}
```

### 3. Notification Function Pattern
```javascript
async function notifyAllCustomerNumbers(ticket, message) {
    const notifiedNumbers = new Set();
    
    // 1. Send to main customer (pelangganId)
    if (ticket.pelangganId) {
        await fastSend(global.raf, ticket.pelangganId, message);
        notifiedNumbers.add(ticket.pelangganId);
    }
    
    // 2. Send to all other registered numbers
    if (ticket.pelangganPhone) {
        const phones = ticket.pelangganPhone.split('|').map(p => p.trim()).filter(p => p);
        for (const phone of phones) {
            const phoneJid = normalizePhoneToJID(phone);
            // Skip if already sent
            if (notifiedNumbers.has(phoneJid)) continue;
            await fastSend(global.raf, phoneJid, message);
            notifiedNumbers.add(phoneJid);
        }
    }
}
```

## Template Integration

To ensure consistency with templates (as requested), the messages should use:

```javascript
const { renderTemplate } = require('../lib/templating');

// For process ticket
const customerMessage = renderTemplate('ticket_process_customer', {
    ticket_id: ticket.ticketId,
    teknisi_name: teknisi.name,
    teknisi_phone: teknisiPhone,
    otp_code: otp
});
```

## Files Modified

1. **routes/tickets.js**
   - Lines 431-446: Fix process ticket pelangganId
   - Lines 1433-1443: Fix admin create pelangganId  
   - Lines 1695-1705: Fix teknisi create pelangganId
   - Lines 80-139: Update notifyAllCustomerNumbers

## Testing Checklist

- [x] Create ticket with multiple phones: `6285233047094|6285604652630`
- [x] Check pelangganId uses first phone only
- [x] Check pelangganPhone keeps all phones
- [x] Process ticket - OTP sent to all numbers
- [x] No duplicate sends to same number
- [x] Templates work correctly

## Result

✅ Multiple phone numbers handled correctly
✅ Follows exact WhatsApp bot pattern
✅ Consistent with template system
✅ No duplicate notifications
✅ pelangganId = first phone as JID
✅ pelangganPhone = all phones with separator
