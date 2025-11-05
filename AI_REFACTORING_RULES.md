# 🤖 AI REFACTORING RULES - V2.0 POST-REFACTORING

## 🎆 REFACTORING COMPLETE (November 3, 2025)

**Current State:**
- ✅ File reduced from 3,093 to 1,866 lines (39.7%)
- ✅ 36 handlers created and organized
- ✅ All business logic extracted
- ✅ Zero axios calls in main file
- ✅ Clean architecture achieved

## ⚠️ MANDATORY PRE-FLIGHT CHECKLIST

Before making ANY changes to the codebase, AI MUST:

1. ✅ **READ** `AI_MAINTENANCE_GUIDE.md` FIRST
2. ✅ **READ** `WORKFLOW_DOCUMENTATION.md` for complete flow
3. ✅ **READ** `REFACTORING_SUMMARY.md` for current status
4. ✅ **CHECK** which handler to modify (NOT raf.js)
5. ✅ **VERIFY** handler exists before creating new
6. ✅ **TEST** after each change

## 🚫 ABSOLUTE DO NOT's

1. **DO NOT** break existing functionality
2. **DO NOT** create duplicate handlers
3. **DO NOT** leave partial logic in raf.js
4. **DO NOT** mix concerns in a single handler
5. **DO NOT** forget to export functions
6. **DO NOT** forget to test
7. **DO NOT** refactor without understanding the flow

## ✅ MANDATORY DO's

### 1. When Extracting a Case Block:
```javascript
// BEFORE in raf.js:
case 'SOME_CASE': {
    // 50 lines of logic
    break;
}

// AFTER in raf.js:
case 'SOME_CASE': {
    const { handleSomeCase } = require('./handlers/appropriate-handler');
    handleSomeCase(/* pass ALL needed params */);
    break;
}

// In new handler file:
function handleSomeCase(params) {
    // ALL 50 lines moved here
}
module.exports = { handleSomeCase };
```

### 2. Parameter Passing Pattern:
```javascript
// ALWAYS pass parameters as object for clarity
handleSomeCase({
    sender,
    pushname, 
    message,
    isOwner,
    isTeknisi,
    global,
    temp,
    reply,
    // ... all other needed params
});
```

### 3. Handler File Naming:
- `menu-handler.js` - Menu related functions
- `ticket-handler.js` - Ticket operations
- `conversation-handler.js` - Multi-step flows
- `admin-handler.js` - Admin operations
- Use kebab-case, descriptive names

### 4. Function Naming:
- Start with `handle` prefix
- Descriptive name: `handleCreateTicket`, `handleWifiNameChange`
- Async functions: `async function handleAsyncOperation()`

## 📋 REFACTORING SEQUENCE

### Step 1: Identify Target
- Find a large case block or function
- Count lines it uses
- Check dependencies

### Step 2: Create/Update Handler
```bash
# Check if handler exists
grep_search "handler-name.js" 

# Create or update handler
write_to_file or multi_edit
```

### Step 3: Move Logic
- Copy ENTIRE logic (including error handling)
- Preserve ALL functionality
- Include necessary imports

### Step 4: Update raf.js
- Import the handler
- Replace case block with handler call
- Pass ALL required parameters

### Step 5: Test
```bash
# Run specific test
node test/test-handler-name.js

# Run all handler tests
node test/test-refactor-handlers.js
```

### Step 6: Update Documentation
- Update `REFACTORING_WORKFLOW.md` progress
- Mark completed items with ✅
- Update line count estimates

## 📋 WHERE TO MAKE CHANGES (POST-REFACTORING)

### For Different Feature Types:

| Feature Type | Handler Location | Examples |
|-------------|------------------|----------|
| WiFi Settings | handlers/wifi-management-handler.js | Name, password changes |
| WiFi Power | handlers/wifi-power-handler.js | Power adjustments |
| Balance/Transfer | handlers/balance-management-handler.js | Topup, transfer, delete |
| Billing | handlers/billing-management-handler.js | Check bills, invoices |
| Package Changes | handlers/package-management-handler.js | Upgrade, downgrade, SOD |
| Voucher Profiles | handlers/voucher-management-handler.js | Add/delete profiles |
| IP Binding/PPPoE | handlers/network-management-handler.js | Network admin tasks |
| Ticket Creation | handlers/smart-report-handler.js | Report issues |
| Teknisi Workflow | handlers/teknisi-workflow-handler.js | OTP, OTW, completion |
| Photo Uploads | handlers/teknisi-photo-handler-v3.js | Photo queue management |
| Multi-step Flows | handlers/conversation-state-handler.js | All temp[sender] states |
| State Sub-flows | handlers/states/*.js | WiFi, report, other states |

### NEVER modify raf.js for business logic!
raf.js is ONLY for:
- Case routing to handlers
- Basic validation
- Temp state checking

## 📊 SUCCESS METRICS

After each extraction, verify:
- [ ] raf.js line count decreased
- [ ] Handler file created/updated
- [ ] All tests pass
- [ ] No functionality broken
- [ ] Documentation updated

## 🔍 VERIFICATION COMMANDS

### Check raf.js size:
```bash
wc -l message/raf.js
```

### Find remaining cases:
```bash
grep -n "^            case '[A-Z_]'" message/raf.js | wc -l
```

### Test handlers:
```bash
node test/test-refactor-handlers.js
```

### Check for OLD blocks:
```bash
grep "_OLD" message/raf.js
```

## 💡 HANDLER PATTERNS

### Pattern 1: Simple Handler
```javascript
function handleSimpleCase({ param1, param2, reply }) {
    // Logic here
    reply("Response");
}
```

### Pattern 2: Async Handler
```javascript
async function handleAsyncCase({ sender, global, reply }) {
    try {
        const result = await someAsyncOperation();
        reply(result);
    } catch (error) {
        console.error('[HANDLER_ERROR]', error);
        reply("Error message");
    }
}
```

### Pattern 3: Conversation State Handler
```javascript
function handleConversationState({ sender, chats, temp, reply }) {
    const state = temp[sender];
    if (!state) return;
    
    switch(state.step) {
        case 'STEP_1':
            // Handle step 1
            temp[sender].step = 'STEP_2';
            break;
        case 'STEP_2':
            // Handle step 2
            delete temp[sender];
            break;
    }
}
```

## ✅ ACHIEVED GOALS

Successfully transformed raf.js:
- From: 3,093 lines monolithic file
- To: 1,866 lines clean router
- Result: 39.7% reduction
- Handlers: 36 organized files
- Architecture: Clean separation of concerns
- Maintenance: Easy to extend and debug
- Each handler: Single responsibility
- Business logic: 100% extracted

## ✋ STOP CONDITIONS

STOP and ask for help if:
- Unsure about functionality
- Complex state management
- Breaking changes detected
- Tests failing after extraction
- Circular dependencies found

## 📝 REMEMBER

**Quality > Speed**
Better to extract 1 handler correctly than 5 handlers with bugs.

**Test > Hope**
Always test after extraction, don't assume it works.

**Document > Forget**
Update workflow and analysis after each extraction.

---
*Last Updated: 2025-11-03*
*Version: 2.0 (Post-Refactoring)*
*Status: Active Rules for AI Maintenance*
