# 🚨 PROMPT: DEBUG & FIX CRITICAL BUGS HALAMAN USERS

## 🔴 KONTEKS MASALAH
Halaman users.php mengalami multiple critical bugs yang menyebabkan fungsi tidak berjalan dan performance issues parah sampai Chrome memberikan warning "page slowing down".

## 🐛 BUG REPORTS

### 1. PERFORMANCE ISSUES (CRITICAL)
- **Problem:** Loading terus menerus tidak berhenti
- **Symptom:** Chrome warning "This page is slowing down your browser"
- **Impact:** Browser hang/freeze
- **Possible Causes:**
  - Infinite loop dalam JavaScript
  - Recursive API calls tanpa stop condition
  - Memory leak dari DataTable refresh
  - GenieACS polling terlalu agresif
  - Event listeners duplicated

### 2. FORM HANDLING BUGS
- **Hapus Nomor:** Button hapus nomor telepon tidak ada efeknya
- **Device ID:** Ganti device ID stuck/tidak update
- **Possible Issues:**
  - Event handler tidak attached
  - Form submission preventDefault missing
  - API endpoint return error tapi tidak di-handle
  - DOM manipulation broken
  - State management tidak sync

### 3. OTHER UNREPORTED BUGS
- Modal tidak close setelah save
- DataTable tidak refresh after CRUD
- Map picker tidak responsive
- Select2 dropdown tidak load data
- Validation error tidak muncul

## 🔍 DEBUGGING CHECKLIST

### A. BROWSER CONSOLE CHECK
```javascript
// Check di Console Browser (F12):
1. Ada error merah? → Copy exact error message
2. Ada warning kuning? → Note semua warnings
3. Network tab → Ada request failed/pending?
4. Performance tab → Memory usage naik terus?
5. Sources tab → Ada breakpoint/debugger statement?
```

### B. INFINITE LOOP DETECTION
```javascript
// Cari pattern ini di users.php:
- setInterval() tanpa clearInterval
- setTimeout() recursive tanpa stop condition
- while(true) atau for(;;) loops
- DataTable.ajax.reload() dalam loop
- Event handler yang trigger dirinya sendiri
```

### C. API CALLS PATTERN
```javascript
// Check for:
- fetchActivePppoeUsers() dipanggil berulang
- fetchAndCacheDeviceData() tanpa debounce
- GenieACS polling interval terlalu cepat
- Multiple parallel requests ke endpoint sama
```

## 📋 STEP-BY-STEP DEBUG GUIDE

### STEP 1: IDENTIFY PERFORMANCE BOTTLENECK
```javascript
// Add console logs untuk track:
console.time('DataTable Init');
// ... DataTable initialization
console.timeEnd('DataTable Init');

console.log('[DEBUG] fetchActivePppoeUsers called');
console.log('[DEBUG] fetchAndCacheDeviceData called');
console.log('[DEBUG] refreshAllData called');
```

### STEP 2: FIX INFINITE LOADING
```javascript
// BEFORE (Possible problematic code):
setInterval(() => {
    fetchActivePppoeUsers();
    dataTable.ajax.reload();
}, 1000); // Too aggressive!

// AFTER (Fixed):
let refreshInterval;
function startRefresh() {
    // Clear existing interval first
    if (refreshInterval) clearInterval(refreshInterval);
    
    refreshInterval = setInterval(() => {
        if (document.visibilityState === 'visible') {
            fetchActivePppoeUsers();
        }
    }, 30000); // 30 seconds, not 1 second
}

// Stop refresh when page hidden
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        clearInterval(refreshInterval);
    } else {
        startRefresh();
    }
});
```

### STEP 3: FIX FORM HANDLERS

#### A. Fix Hapus Nomor Button
```javascript
// LOCATE FUNCTION:
function addNumberField(containerId) {
    // Check if this exists and works
}

function removePhoneNumber(button) {
    // This might be missing or broken
}

// FIX IMPLEMENTATION:
function removePhoneNumber(button) {
    // Get the input group container
    const inputGroup = button.closest('.input-group');
    if (inputGroup) {
        inputGroup.remove();
    }
}

// ENSURE EVENT DELEGATION:
$(document).on('click', '.btn-remove-phone', function(e) {
    e.preventDefault();
    $(this).closest('.input-group').remove();
});
```

#### B. Fix Device ID Update
```javascript
// CHECK THESE HANDLERS:
$('#edit_device_id_modal').on('change', function() {
    // Is this firing?
    console.log('[DEBUG] Device ID changed to:', $(this).val());
});

$('#load_edit_ssid_btn').on('click', function(e) {
    e.preventDefault();
    const deviceId = $('#edit_device_id_modal').val();
    console.log('[DEBUG] Loading SSID for:', deviceId);
    
    if (!deviceId) {
        alert('Please enter Device ID first');
        return;
    }
    
    // Load SSID with proper error handling
    loadSSID(deviceId).catch(err => {
        console.error('[ERROR] Failed to load SSID:', err);
        alert('Failed to load SSID: ' + err.message);
    });
});
```

### STEP 4: FIX DATATABLE ISSUES
```javascript
// PROBLEM: DataTable might be initialized multiple times
// SOLUTION: Check if already initialized
if (!$.fn.DataTable.isDataTable('#dataTable')) {
    dataTableInstance = $('#dataTable').DataTable({
        // ... configuration
    });
} else {
    // Already initialized, just reload
    dataTableInstance.ajax.reload();
}

// PROBLEM: Memory leak from event handlers
// SOLUTION: Use .off() before .on()
$('#dataTable').off('click', '.btn-edit').on('click', '.btn-edit', function() {
    // Handle edit
});

// PROBLEM: Too many redraws
// SOLUTION: Batch operations
dataTableInstance.rows().invalidate('data').draw(false);
```

### STEP 5: FIX MEMORY LEAKS
```javascript
// CLEANUP ON PAGE UNLOAD:
window.addEventListener('beforeunload', () => {
    // Clear all intervals
    if (refreshInterval) clearInterval(refreshInterval);
    if (pppoeInterval) clearInterval(pppoeInterval);
    
    // Destroy DataTable
    if (dataTableInstance) {
        dataTableInstance.destroy();
    }
    
    // Clear device cache
    deviceDataCache.clear();
    
    // Remove event listeners
    $(document).off();
});

// CLEANUP MODALS:
$('.modal').on('hidden.bs.modal', function() {
    // Reset form
    $(this).find('form')[0].reset();
    
    // Clear dynamic fields
    $(this).find('.number-container').empty();
    
    // Destroy Select2 if exists
    $(this).find('.select2').select2('destroy');
});
```

## 🔧 CRITICAL FIXES TO IMPLEMENT

### 1. STOP INFINITE POLLING
```javascript
// Find and fix all polling code
// Search for: setInterval, setTimeout, ajax.reload
// Add proper stop conditions and reasonable intervals
```

### 2. FIX EVENT HANDLERS
```javascript
// Use event delegation for dynamic elements
$(document).on('event', '.selector', handler);

// Not direct binding which breaks for new elements
$('.selector').on('event', handler);
```

### 3. OPTIMIZE API CALLS
```javascript
// Implement debouncing
let debounceTimer;
function debouncedFetch() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
        actualFetchFunction();
    }, 500);
}

// Cache results
const cache = new Map();
function getCachedOrFetch(key) {
    if (cache.has(key)) {
        return Promise.resolve(cache.get(key));
    }
    return fetch(url).then(data => {
        cache.set(key, data);
        return data;
    });
}
```

### 4. FIX FORM SUBMISSION
```javascript
// Ensure all forms handle submit properly
$('#createUserForm').on('submit', async function(e) {
    e.preventDefault(); // CRITICAL!
    
    // Disable submit button to prevent double submit
    const submitBtn = $(this).find('button[type="submit"]');
    submitBtn.prop('disabled', true);
    
    try {
        const formData = new FormData(this);
        const response = await fetch('/api/users', {
            method: 'POST',
            body: formData
        });
        
        if (response.ok) {
            // Success handling
            $('#createModal').modal('hide');
            dataTableInstance.ajax.reload();
        } else {
            // Error handling
            const error = await response.json();
            alert(error.message);
        }
    } catch (err) {
        console.error('Submit failed:', err);
        alert('Failed to save user');
    } finally {
        submitBtn.prop('disabled', false);
    }
});
```

## 🎯 TESTING CHECKLIST

### After fixes, verify:
- [ ] Page loads without hanging
- [ ] No Chrome warning appears
- [ ] Console has no errors
- [ ] Network tab shows reasonable request frequency
- [ ] Memory usage stable (not increasing)
- [ ] All buttons clickable and responsive
- [ ] Forms submit and close properly
- [ ] DataTable updates after CRUD operations
- [ ] Phone number add/remove works
- [ ] Device ID update works
- [ ] Map picker responsive
- [ ] Select2 dropdowns load data
- [ ] Modals close after save
- [ ] No duplicate API calls

## 📊 PERFORMANCE METRICS

### Target Performance:
```
- Initial page load: < 3 seconds
- DataTable render: < 1 second
- API response time: < 500ms
- Memory usage: < 100MB stable
- No infinite loops or recursive calls
- Polling interval: >= 30 seconds
```

## 🚀 IMPLEMENTATION ORDER

### PRIORITY 1 (CRITICAL - Fix First):
1. Stop infinite loops/polling
2. Fix memory leaks
3. Optimize DataTable initialization

### PRIORITY 2 (HIGH):
1. Fix form event handlers
2. Fix phone number add/remove
3. Fix device ID update

### PRIORITY 3 (MEDIUM):
1. Optimize API calls with caching
2. Add proper error handling
3. Implement loading states

## 📝 CODE TO ADD FOR DEBUGGING

Add this at the top of users.php JavaScript section:
```javascript
// Debug mode flag
const DEBUG = true;

// Override console.log for debug
const originalLog = console.log;
console.log = function() {
    if (DEBUG) {
        originalLog.apply(console, ['[' + new Date().toISOString() + ']', ...arguments]);
    }
};

// Track API calls
let apiCallCount = 0;
const originalFetch = window.fetch;
window.fetch = function() {
    apiCallCount++;
    console.log(`[API] Call #${apiCallCount} to:`, arguments[0]);
    return originalFetch.apply(this, arguments);
};

// Monitor memory
if (DEBUG) {
    setInterval(() => {
        if (performance.memory) {
            const used = Math.round(performance.memory.usedJSHeapSize / 1048576);
            const total = Math.round(performance.memory.totalJSHeapSize / 1048576);
            console.log(`[MEMORY] ${used}MB / ${total}MB`);
        }
    }, 10000);
}
```

## 🎯 EXPECTED OUTCOME

After implementing fixes:
- ✅ No more browser warnings
- ✅ Page responsive and fast
- ✅ All CRUD operations work
- ✅ Forms submit properly
- ✅ No console errors
- ✅ Memory usage stable
- ✅ User experience smooth

---

**END OF DEBUG PROMPT**
