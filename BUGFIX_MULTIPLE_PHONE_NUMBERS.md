# BUGFIX: Multiple Phone Numbers Support in Ticket Notifications

## Problem Description
When customers have multiple phone numbers (separated by `|`), the system was trying to send WhatsApp to the entire string as one number:
```
Processing customer phone: 6285233047094|6285604652630
Formatted phone JID: 6285233047094|6285604652630@s.whatsapp.net  ❌
```

## User Feedback
"apa kamu tidak sadar. itu process 2 nomor di 1 sesi? itu kan ada tanda | yang berarti pemisah bahwa pelanggan itu memiliki 2 nomor"

## Root Cause
The notification code was treating the entire phone field as a single phone number, not recognizing that `|` is used as a separator for multiple phone numbers.

## Solution Implemented

### Before (WRONG):
```javascript
let phoneJid = notificationData.userPhone.trim();
// Directly processes "6285233047094|6285604652630" as one number
```

### After (CORRECT):
```javascript
// Handle multiple phone numbers separated by |
const phoneNumbers = notificationData.userPhone.split('|').map(p => p.trim()).filter(p => p);
console.log(`[ADMIN_CREATE_TICKET] Customer has ${phoneNumbers.length} phone number(s): ${phoneNumbers.join(', ')}`);

// Send to all phone numbers
for (let phoneNum of phoneNumbers) {
    try {
        let phoneJid = phoneNum.trim();
        // Process each phone number individually
        // Send notification with retry logic
    } catch (err) {
        console.error(`Error processing notification for ${phoneNum}:`, err.message);
    }
}
```

## Implementation Details

### 1. Phone Number Splitting
```javascript
const phoneNumbers = notificationData.userPhone
    .split('|')           // Split by pipe character
    .map(p => p.trim())   // Remove whitespace
    .filter(p => p);      // Remove empty strings
```

### 2. Individual Processing
- Each phone number is processed separately
- Each gets its own formatting and validation
- Each gets its own retry logic
- Errors on one number don't affect others

### 3. Logging Enhanced
```
[ADMIN_CREATE_TICKET] Customer has 2 phone number(s): 6285233047094, 6285604652630
[ADMIN_CREATE_TICKET] Processing customer phone: 6285233047094
[ADMIN_CREATE_TICKET] Formatted phone JID: 6285233047094@s.whatsapp.net
[ADMIN_CREATE_TICKET] Successfully notified customer 6285233047094@s.whatsapp.net
[ADMIN_CREATE_TICKET] Processing customer phone: 6285604652630
[ADMIN_CREATE_TICKET] Formatted phone JID: 6285604652630@s.whatsapp.net
[ADMIN_CREATE_TICKET] Successfully notified customer 6285604652630@s.whatsapp.net
```

## Files Modified
- **routes/tickets.js**
  - Lines 1354-1432: Admin ticket creation endpoint
  - Lines 1648-1726: Teknisi ticket creation endpoint

## Testing Scenarios
1. **Single phone number**: `6285233047094`
   - Should work as before
   
2. **Two phone numbers**: `6285233047094|6285604652630`
   - Should send to both numbers
   
3. **Three+ phone numbers**: `6285233047094|6285604652630|6285123456789`
   - Should send to all numbers
   
4. **With spaces**: `6285233047094 | 6285604652630`
   - Should trim and process correctly
   
5. **One invalid**: `6285233047094|invalid|6285604652630`
   - Should send to valid numbers, log error for invalid

## Benefits
✅ All customer phone numbers receive notifications
✅ No more failed notifications due to malformed JIDs
✅ Better customer reach (primary and backup numbers)
✅ Graceful error handling per number
✅ Clear logging for debugging

## Database Structure
The users table supports multiple phone numbers in the `phone_number` field:
```sql
phone_number TEXT -- Can contain "number1|number2|number3"
```

## Backward Compatibility
- Single phone numbers still work exactly as before
- No database changes required
- Existing tickets unaffected

## Future Improvements
Consider:
1. Separate phone_numbers table for normalized data
2. Priority ordering (primary, secondary, etc.)
3. Phone number validation before saving
4. Configurable retry per number
5. Notification status tracking per number

## Commit Message
Fixed multiple phone number support in ticket notifications - properly split and send to all customer phone numbers
