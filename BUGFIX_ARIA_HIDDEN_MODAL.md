# BUGFIX: aria-hidden Warning on Modal Close

## Problem
User reported console warning when closing "Buat Tiket Baru" modal:
```
Blocked aria-hidden on an element because its descendant retained focus. 
Element with focus: <button.close>
Ancestor with aria-hidden: <div.modal fade#createTicketModal>
```

## Root Cause
Bootstrap modals set `aria-hidden="true"` when closing, but if an element inside (like the close button) still has focus, this creates an accessibility violation. The focus is being hidden from screen readers while still being "active".

## Solution Implemented

### 1. Before Showing Modal
Remove focus from current element to prevent focus conflicts:
```javascript
$('#createTicketModal').on('show.bs.modal', function () {
    document.activeElement.blur();
});
```

### 2. After Modal Opens
Properly set ARIA attributes and move focus to input:
```javascript
$('#createTicketModal').on('shown.bs.modal', function () {
    $(this).removeAttr('aria-hidden');
    $(this).attr('aria-modal', 'true');
    // Focus on input instead of close button
    $('#customerSelect').select2('focus');
});
```

### 3. Before Hiding Modal
Blur any focused element to prevent warning:
```javascript
$('#createTicketModal').on('hide.bs.modal', function () {
    $(this).find(':focus').blur();
});
```

### 4. After Modal Hidden
Return focus to trigger button for better UX:
```javascript
$('#createTicketModal').on('hidden.bs.modal', function () {
    // Reset form values...
    // Return focus to the button that opened modal
    $('[data-target="#createTicketModal"]').focus();
});
```

### 5. Before Programmatic Close
When closing modal via JavaScript (after form submission):
```javascript
// Blur focus before hiding modal
$('#createTicketModal').find(':focus').blur();
$('#createTicketModal').modal('hide');
```

## Bootstrap Modal Lifecycle

1. **show.bs.modal** - Modal is about to show
2. **shown.bs.modal** - Modal is fully shown
3. **hide.bs.modal** - Modal is about to hide
4. **hidden.bs.modal** - Modal is fully hidden

## Why This Fixes the Issue

1. **Focus Management**: We explicitly manage focus at each stage
2. **No Hidden Focus**: Focus is removed before aria-hidden is applied
3. **Better UX**: Focus moves logically (trigger → input → trigger)
4. **Accessibility**: Screen readers can properly track focus changes

## Testing
1. Open modal - Focus should go to Select2 input
2. Close with X button - No console warning
3. Close with ESC - No console warning
4. Submit form - No console warning
5. Focus returns to "Buat Tiket Baru" button

## Prevention Pattern
For any Bootstrap modal:
```javascript
$('#anyModal').on('show.bs.modal', function () {
    document.activeElement.blur();
});

$('#anyModal').on('hide.bs.modal', function () {
    $(this).find(':focus').blur();
});

$('#anyModal').on('hidden.bs.modal', function () {
    // Return focus to trigger
    $('[data-target="#anyModal"]').focus();
});
```

## Related Standards
- [WAI-ARIA aria-hidden](https://w3c.github.io/aria/#aria-hidden)
- [Bootstrap Modal Accessibility](https://getbootstrap.com/docs/4.6/components/modal/#accessibility)

## Files Changed
- `views/sb-admin/tiket.php`
  - Lines 848-873: Complete modal event handlers
  - Line 971: Blur before programmatic hide

## Result
✅ No more aria-hidden warnings
✅ Proper focus management
✅ Better accessibility
✅ Improved UX with logical focus flow
