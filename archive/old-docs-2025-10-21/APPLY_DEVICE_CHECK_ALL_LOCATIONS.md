# 📋 Apply Device Check to All WiFi Task Locations

## 🎯 LOCATIONS TO FIX

### File: `message/handlers/steps/wifi-steps-bulk.js`

Found 8 `axios.post` task creation locations:

1. ✅ **Line 84** - Bulk password change (ALL SSIDs) - ALREADY FIXED
2. ❌ **Line 171** - Single SSID password change (selected from bulk)
3. ❌ **Line 244** - Single SSID password change (alternative flow)
4. ❌ **Line 300** - Bulk password change (without initial password)
5. ❌ **Line 349** - Simple password change (non-bulk mode)
6. ❌ **Line 420** - Bulk name change (ALL SSIDs)
7. ❌ **Line 501** - Single SSID name change (selected from bulk)
8. ❌ **Line 555** - Simple name change (non-bulk mode)

### File: `message/handlers/wifi-handler-fixed.js`

Need to check and fix:
- handleWifiPasswordChange - Direct password change
- handleWifiNameChange - Direct name change

## 🔧 IMPLEMENTATION STRATEGY

### Option A: Add check to each location (Current approach)
- Pros: Maximum control, can customize message per location
- Cons: Repetitive code, hard to maintain

### Option B: Create wrapper function (BETTER)
- Pros: DRY, easy to maintain, consistent behavior
- Cons: Needs refactoring

### Option C: Middleware approach (BEST for future)
- Pros: Zero changes to existing handlers
- Cons: Requires architecture change

## ✅ RECOMMENDATION: Use Option A for now, then refactor to Option B

Create helper function:

```javascript
/**
 * Execute WiFi task with device online check
 * @param {Object} params - Task parameters
 * @returns {Promise<Object>} Result with success and message
 */
async function executeWifiTaskWithCheck({ 
    targetUser, 
    reply, 
    deleteUserState, 
    sender,
    parameterValues,
    successMessage,
    processingMessage = 'Sedang memproses...'
}) {
    // Check device online
    reply(`⏳ Memeriksa status perangkat...`);
    
    const deviceStatus = await isDeviceOnline(targetUser.device_id);
    
    if (!deviceStatus.online) {
        if (deleteUserState) deleteUserState(sender);
        return {
            success: false,
            message: getDeviceOfflineMessage(targetUser.name, deviceStatus.minutesAgo)
        };
    }
    
    // Execute task
    reply(`⏳ ${processingMessage}`);
    
    try {
        const response = await axios.post(
            `${global.config.genieacsBaseUrl}/devices/${encodeURIComponent(targetUser.device_id)}/tasks?connection_request`,
            {
                name: 'setParameterValues',
                parameterValues: parameterValues
            }
        );
        
        if (response.status === 200 || response.status === 202) {
            if (deleteUserState) deleteUserState(sender);
            return {
                success: true,
                message: successMessage
            };
        } else {
            throw new Error(`GenieACS returned status ${response.status}`);
        }
    } catch (error) {
        if (deleteUserState) deleteUserState(sender);
        return {
            success: false,
            message: getSafeErrorMessage(error)
        };
    }
}
```

## 📝 QUICK FIX TEMPLATE

For each location, wrap the axios.post call:

```javascript
// BEFORE
reply(`⏳ Sedang mengubah...`);
const response = await axios.post(...);
if (response.status === 200 || response.status === 202) {
    return { success: true, message: "Berhasil!" };
}

// AFTER
reply(`⏳ Memeriksa status perangkat...`);
const deviceStatus = await isDeviceOnline(targetUser.device_id);
if (!deviceStatus.online) {
    deleteUserState(sender);
    return {
        success: false,
        message: getDeviceOfflineMessage(targetUser.name, deviceStatus.minutesAgo)
    };
}

reply(`⏳ Sedang mengubah...`);
const response = await axios.post(...);
if (response.status === 200 || response.status === 202) {
    return { 
        success: true, 
        message: "✅ Permintaan Diterima\n\nPerubahan sedang diproses (1-2 menit)..." 
    };
}
```

## 🚀 EXECUTION PLAN

1. ✅ Create lib/device-status.js - DONE
2. ✅ Fix wifi-steps-bulk.js line 84 - DONE  
3. ⏳ Fix remaining 7 locations in wifi-steps-bulk.js
4. ⏳ Fix wifi-handler-fixed.js
5. ⏳ Test all flows
6. ⏳ Refactor to helper function (optional, later)

## 📊 PROGRESS TRACKER

- [x] Location 1 (wifi-steps-bulk.js:84) - Bulk password ALL ✅
- [x] Location 2 (wifi-steps-bulk.js:171) - Single SSID password (bulk mode) ✅
- [x] Location 3 (wifi-steps-bulk.js:244) - Single SSID password (alt flow) ✅
- [x] Location 4 (wifi-steps-bulk.js:300) - Bulk password (no initial pw) ✅
- [x] Location 5 (wifi-steps-bulk.js:349) - Simple password change ✅
- [x] Location 6 (wifi-steps-bulk.js:420) - Bulk name ALL ✅
- [x] Location 7 (wifi-steps-bulk.js:501) - Single SSID name (bulk mode) ✅
- [x] Location 8 (wifi-steps-bulk.js:555) - Simple name change ✅
- [x] wifi-handler-fixed.js password change ✅
- [x] wifi-handler-fixed.js name change ✅

---

**Status:** 10/10 complete (100%) ✅ COMPLETED!
**Priority:** HIGH
**Completed:** 2025-10-20
