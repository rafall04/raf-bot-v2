# BUGFIX: WhatsApp Session Timeout & "Closing Stale Open Session"

## Problem Description
When creating tickets from admin panel, WhatsApp notifications were failing with:
1. "WhatsApp send timeout" error
2. "Closing stale open session for new outgoing prekey bundle" message
3. Customer notifications failing but teknisi notifications working

## Root Cause
The issue was caused by WhatsApp's end-to-end encryption session management:
- WhatsApp creates new encrypted sessions with phone numbers not recently contacted
- This session creation can take 10-20 seconds for stale/new numbers
- The original 10-second timeout was too short
- No retry logic meant one failure = no notification

## Solution Applied

### 1. Better Phone Number Validation
```javascript
// Support multiple formats
if (phoneJid.startsWith('0')) {
    phoneJid = `62${phoneJid.substring(1)}@s.whatsapp.net`;
} else if (phoneJid.startsWith('62')) {
    phoneJid = `${phoneJid}@s.whatsapp.net`;
} else if (phoneJid.startsWith('+62')) {
    phoneJid = `${phoneJid.substring(1)}@s.whatsapp.net`;
}
```

### 2. Connection Status Check
```javascript
// Check WhatsApp is connected before sending
if (!global.raf || global.whatsappConnectionState !== 'open') {
    console.error('WhatsApp not connected, skipping notifications');
    return;
}
```

### 3. Retry Logic with Delays
```javascript
// Add delay to avoid session conflicts
await new Promise(resolve => setTimeout(resolve, 500));

// Retry up to 2 times
let retries = 2;
while (retries > 0 && !sent) {
    try {
        // 15-second timeout (increased from 10s)
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('WhatsApp send timeout')), 15000)
        );
        await Promise.race([
            global.raf.sendMessage(phoneJid, { text: customerMsg }),
            timeoutPromise
        ]);
        sent = true;
    } catch (sendErr) {
        retries--;
        if (retries > 0) {
            // Wait 2s before retry
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }
}
```

### 4. Better Debugging
```javascript
console.log(`[ADMIN_CREATE_TICKET] Processing customer phone: ${phoneJid}`);
console.log(`[ADMIN_CREATE_TICKET] Formatted phone JID: ${phoneJid}`);
console.log(`[ADMIN_CREATE_TICKET] Retry sending, attempts left: ${retries}`);
```

## Files Modified
- `routes/tickets.js` (lines 1326-1410, 1580-1660)

## Testing
Run the debug test to check WhatsApp status:
```bash
node test/test-whatsapp-session-fix.js
```

## Understanding Session Errors
The "Closing stale open session" message means:
1. WhatsApp is establishing a new encrypted session
2. This happens with numbers not communicated with recently
3. It's NORMAL behavior but can cause delays
4. First message to a number may take longer

## Recommendations
1. **Always check connection**: Ensure WhatsApp bot is connected
2. **Valid phone numbers**: Verify customer phone numbers are correct
3. **Patience on first message**: Initial messages may take 15-20 seconds
4. **Monitor logs**: Check console for retry attempts and failures

## Prevention
- Keep WhatsApp bot connection stable
- Use correct phone number formats
- Have reasonable timeout values (15s minimum)
- Implement retry logic for resilience

## Commit
Applied fixes for WhatsApp session timeout issues with retry logic and better error handling.
