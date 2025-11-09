# BUGFIX: DataTable Colspan Error - Complete Solution

## Problem Report
User: "saat saya mengakses halaman tiket untuk admin masih muncul log error di console"

## Error Details
```javascript
DataTable initialization error: TypeError: Cannot set properties of undefined (setting '_DT_CellIndex')
    at Ja (jquery.dataTables.min.js:25:57)
    at O (jquery.dataTables.min.js:16:448)
```

## Root Cause
**DataTables CANNOT handle colspan in tbody!**

When the table has no data, we were doing:
1. Insert row with single cell having colspan="11"
2. Try to initialize DataTable on that table
3. DataTable crashes trying to map cells to columns

## The Complete Solution

### 1. Conditional DataTable Initialization
Only initialize DataTable when there's actual data:

```javascript
if (tickets && tickets.length > 0) {
    // Add normal rows with 11 cells each
    tickets.forEach(ticket => {
        // ... insert 11 cells ...
    });
    
    // NOW safe to initialize DataTable
    dataTableInstance = $('#allTicketsTable').DataTable({
        // ... options ...
    });
} else {
    // NO DataTable initialization!
    dataTableInstance = null;
    
    // Show custom message with colspan (safe now)
    ticketsTableBody.innerHTML = `
        <tr>
            <td colspan="${colCount}" class="text-center">
                Tidak ada tiket yang cocok dengan filter Anda.
            </td>
        </tr>
    `;
}
```

### 2. Improved Destruction Logic
Safely destroy existing DataTable:

```javascript
if (dataTableInstance && $.fn.DataTable.isDataTable('#allTicketsTable')) {
    try {
        dataTableInstance.clear().destroy();
    } catch (e) {
        // Fallback if instance is corrupted
        $('#allTicketsTable').DataTable().destroy();
    }
    dataTableInstance = null; // Clear reference
    $('#allTicketsTable').removeAttr('aria-describedby');
}
```

### 3. State Management
- Set `dataTableInstance = null` when not initialized
- Check `dataTableInstance` exists before operations
- Clear reference after destruction

## Behavior Matrix

| Scenario | DataTable? | Display |
|----------|------------|---------|
| Has tickets | ✅ YES | Full DataTable with sorting, search, pagination |
| No tickets | ❌ NO | Simple table with colspan message |
| Load error | ❌ NO | Simple table with error message |
| Filter → no results | ❌ NO | Destroy DataTable, show message |
| Filter → has results | ✅ YES | Initialize fresh DataTable |

## Why This Works

1. **DataTable Requirements:**
   - Each row in tbody must have same number of cells as header
   - Cannot handle colspan in data rows
   - Expects consistent table structure

2. **Our Solution:**
   - Only give DataTable properly structured tables
   - Use colspan only when DataTable is NOT active
   - Maintain clean state transitions

## Testing Checklist

- [x] Load page with tickets → DataTable works
- [x] Load page without tickets → No errors, shows message
- [x] Filter to no results → DataTable destroyed, message shown
- [x] Filter to results → DataTable re-initialized
- [x] Reset & Refresh → Proper cleanup and reload
- [x] Cancel ticket → Reload works without errors

## Prevention Rules

### ✅ DO:
- Check data exists before DataTable init
- Destroy DataTable before adding colspan
- Keep dataTableInstance reference clean
- Use try-catch for destruction

### ❌ DON'T:
- Initialize DataTable on empty tables
- Add colspan rows with DataTable active
- Assume DataTable instance exists
- Mix DataTable and non-DataTable states

## Files Changed

**views/sb-admin/tiket.php:**
- Lines 666-677: Enhanced destruction with error handling
- Lines 769-772: Removed premature colspan insertion  
- Lines 774-818: Conditional DataTable initialization
- Line 815: Clear instance reference when no data

## Error Prevention Pattern

```javascript
// PATTERN: Safe DataTable Usage
async function loadTableData() {
    // 1. Clean up old instance
    if (dataTableInstance) {
        try { 
            dataTableInstance.destroy(); 
        } catch(e) { /* handle */ }
        dataTableInstance = null;
    }
    
    // 2. Load data
    const data = await fetchData();
    
    // 3. Conditional initialization
    if (data && data.length > 0) {
        populateTable(data);
        dataTableInstance = $('#table').DataTable();
    } else {
        showEmptyMessage(); // With colspan, no DataTable
    }
}
```

## Result

✅ **No more "_DT_CellIndex" errors**
✅ **Table works with and without data**
✅ **All DataTable features functional**
✅ **Clean user experience**

## Commit Message
```
Fix DataTable colspan error - only initialize DataTable when table has data, 
show custom message without DataTable when empty
```
