# BUGFIX: Bad MAC Error in WhatsApp Notifications

## Problem Description
When creating tickets from admin panel, WhatsApp notifications were failing with cryptographic errors:
```
Failed to decrypt message with any known session...
Session error: Error: Bad MAC Error: Bad MAC
    at Object.verifyMAC (libsignal/src/crypto.js:87:15)
    at SessionCipher.doDecryptWhisperMessage (libsignal/src/session_cipher.js:250:16)
```

## What is "Bad MAC Error"?
- **MAC** = Message Authentication Code
- Part of WhatsApp's end-to-end encryption (Signal Protocol)
- Occurs when the encryption session between bot and recipient is corrupted
- Can happen when:
  - Session keys are out of sync
  - Session was interrupted during creation
  - Recipient reinstalled WhatsApp
  - Long time since last message to that number

## Root Cause
1. **Corrupted Encryption Session**: The stored session keys don't match what's expected
2. **No Recovery Mechanism**: Original code just failed on Bad MAC error
3. **Session State Conflicts**: Multiple messages sent quickly can corrupt sessions

## Solution Implemented

### 1. Created Session Manager (lib/whatsapp-session-manager.js)
```javascript
class WhatsAppSessionManager {
    // Cleans corrupted session files
    async cleanSession(phoneJid) { ... }
    
    // Sends message with automatic recovery
    async sendMessageWithRecovery(raf, phoneJid, message, maxRetries) {
        try {
            // Try normal send
            await raf.sendMessage(phoneJid, message);
        } catch (error) {
            if (error.message.includes('Bad MAC')) {
                // Clean corrupted session
                await this.cleanSession(phoneJid);
                // Wait for new session
                await new Promise(resolve => setTimeout(resolve, 3000));
                // Retry with fresh session
                return this.sendMessageWithRecovery(...);
            }
        }
    }
}
```

### 2. Updated Ticket Creation (routes/tickets.js)
```javascript
// Detect Bad MAC errors and use recovery
const errorMsg = lastError?.message || '';
if (errorMsg.includes('Bad MAC') || errorMsg.includes('decrypt')) {
    console.log(`Using session recovery for ${phoneJid}`);
    await sessionManager.sendMessageWithRecovery(
        global.raf, 
        phoneJid, 
        { text: customerMsg },
        3  // Max retries
    );
} else {
    // Regular send with timeout
    await Promise.race([
        global.raf.sendMessage(phoneJid, { text: customerMsg }),
        timeoutPromise
    ]);
}
```

### 3. Recovery Process
1. **First Attempt**: Try normal send
2. **Bad MAC Detected**: Clean session files
3. **Wait 3 seconds**: Allow new session to establish
4. **Retry**: Send with fresh session
5. **Max 3 retries**: Prevent infinite loops

## Session Files Cleaned
When Bad MAC error occurs, these files are removed:
- `session/session-{phoneNumber}.json`
- `session/app-state-sync-key-{phoneNumber}.json`
- `session/app-state-sync-version-{phoneNumber}.json`
- `session/pre-keys-{phoneNumber}.json`
- `session/sender-keys-{phoneNumber}.json`

## Files Modified
1. **lib/whatsapp-session-manager.js** (NEW)
   - Session cleanup logic
   - Recovery mechanism
   - Retry management

2. **routes/tickets.js**
   - Lines 1380-1420: Admin customer notification
   - Lines 1465-1507: Admin teknisi notification
   - Lines 1664-1704: Teknisi customer notification
   - Lines 1756-1786: Teknisi to teknisi notification

## Testing
Monitor console for:
```
[ADMIN_CREATE_TICKET] Using session recovery for 628xxx@s.whatsapp.net
[SESSION_CLEANUP] Cleaning session for 628xxx
[SESSION_CLEANUP] Session cleaned for 628xxx
[SESSION_RECOVERY] Message sent successfully to 628xxx@s.whatsapp.net
[ADMIN_CREATE_TICKET] Successfully notified customer
```

## Prevention Tips
1. **Avoid Rapid Messages**: Space out messages to same recipient
2. **Monitor Logs**: Watch for Bad MAC patterns
3. **Regular Testing**: Test with numbers that haven't been contacted recently
4. **Session Maintenance**: Consider periodic session cleanup for inactive numbers

## Recovery Statistics
The session manager tracks retry attempts per number to prevent abuse:
- Max 3 retries for customer notifications
- Max 2 retries for teknisi notifications  
- Retry counters reset after successful send
- 2-3 second delays between retries

## Understanding the Errors
1. **"Closing stale open session"**: Normal, creating new session
2. **"Failed to decrypt message"**: Session mismatch, needs cleanup
3. **"Bad MAC Error"**: Corrupted session, auto-recovery triggered
4. **"Decrypted message with closed session"**: Using backup session

## Result
✅ Automatic session recovery on Bad MAC errors
✅ No manual intervention needed
✅ Notifications retry with fresh sessions
✅ Better error logging and tracking
✅ Robust against encryption issues

## Commit Message
Fixed Bad MAC encryption errors in WhatsApp notifications with automatic session recovery
