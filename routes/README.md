# Route Structure Documentation

## Overview
This directory contains all route modules for the RAF-BOT v2 application. The routing system has been refactored from a monolithic structure to a modular architecture for better maintainability and scalability.

## Route Files

### 1. **public.js**
Public-facing routes that don't require authentication or have their own authentication.

**Key Endpoints:**
- `POST /api/login` - Admin/staff login
- `POST /api/customer/login` - Customer login
- `POST /api/otp` - Request OTP
- `POST /api/otpverify` - Verify OTP
- `GET /api/customer/*` - Customer API endpoints (authenticated)
- `POST /callback/payment` - Payment callback webhook
- `GET /app/*` - Public app endpoints

### 2. **admin.js**
Administrative routes requiring admin/owner/superadmin authentication.

**Key Endpoints:**
- `GET /api/list/users` - Get user list
- `GET /api/list/packages` - Get package list
- `GET/POST /api/templates` - Manage message templates
- `POST /api/cron` - Update cron configuration
- `POST /api/config` - Update system configuration
- CRUD operations for announcements and news
- Package change request management

### 3. **api.js**
Core API routes for system operations.

**Key Endpoints:**
- `POST /api/action` - Update PPPoE profiles
- `GET /api/send/:id/:text` - Send WhatsApp messages
- Future: Entity CRUD operations

### 4. **tickets.js**
Ticket management system for customer support.

**Key Endpoints:**
- `GET /api/tickets` - Get tickets (teknisi view)
- `GET /api/admin/tickets` - Get all tickets (admin view)
- `POST /api/ticket/process` - Process a ticket
- `POST /api/ticket/resolve` - Resolve a ticket
- `POST /api/admin/ticket/create` - Admin create ticket
- `POST /api/admin/ticket/cancel` - Cancel ticket

### 5. **invoice.js**
Invoice generation and management system.

**Key Endpoints:**
- `GET /api/get-latest-invoice` - Get user's latest invoice
- `GET /api/view-invoice` - View invoice HTML
- `GET /api/download-invoice-pdf` - Download invoice as PDF
- `POST /api/send-invoice-manual` - Manually send invoice
- `GET/POST /api/invoice-settings` - Manage invoice settings
- `POST /api/upload-logo` - Upload company logo
- `POST /api/preview-pdf-invoice` - Preview invoice template

### 6. **payment-status.js**
Bulk payment status management.

**Key Endpoints:**
- `POST /api/payment-status/bulk-update` - Bulk update payment status

### 7. **requests.js**
Payment request management for teknisi.

**Key Endpoints:**
- `GET /api/requests` - Get payment requests
- `POST /api/requests` - Create payment request
- `POST /api/request/cancel` - Cancel request
- `POST /api/approve-paid-change` - Approve payment status change

### 8. **compensation.js**
Compensation and speed boost request management.

**Key Endpoints:**
- `GET /api/compensations/active` - Get active compensations
- `POST /api/compensation/apply` - Apply compensation
- `POST /api/speed-requests/action` - Process speed boost request

### 9. **stats.js**
Statistics and dashboard data endpoints.

**Key Endpoints:**
- `GET /api/me` - Get current user info
- `GET /api/stats` - Get dashboard statistics
- `GET /api/ssid` - Get SSID information
- `GET /api/reboot` - Reboot router
- `GET /api/:type/:id?` - Generic data endpoints

### 10. **users.js**
User credential management.

**Key Endpoints:**
- `POST /api/users/:id/credentials` - Update user credentials

### 11. **pages.js**
PHP page rendering routes.

**Key Endpoints:**
- `GET /login` - Login page
- `GET /` - Dashboard
- `GET /logout` - Logout
- Various admin and teknisi pages
- Generic page handler for PHP views

## Authentication Middleware

### Staff Authentication
Used for admin, owner, superadmin, and teknisi roles:
```javascript
function ensureAuthenticatedStaff(req, res, next) {
    if (!req.user || !['admin', 'owner', 'superadmin', 'teknisi'].includes(req.user.role)) {
        return res.status(403).json({ status: 403, message: "Akses ditolak." });
    }
    next();
}
```

### Admin Authentication
Used for admin-only routes:
```javascript
function ensureAdmin(req, res, next) {
    if (!req.user || !['admin', 'owner', 'superadmin'].includes(req.user.role)) {
        return res.status(403).json({ status: 403, message: "Akses ditolak." });
    }
    next();
}
```

### Customer Authentication
Used for customer API endpoints:
```javascript
function ensureCustomerAuthenticated(req, res, next) {
    // Validates JWT token and sets req.customer
}
```

## Route Mounting Order

Routes are mounted in `index.js` in the following order:

1. Public routes (`/`)
2. Admin routes (`/`)
3. API routes (`/api`)
4. Ticket routes (`/api`)
5. Invoice routes (`/api`)
6. Payment status routes (`/api/payment-status`)
7. Request routes (`/api/requests` and `/api/request`)
8. Compensation routes (`/api`)
9. Stats routes (`/api`)
10. User routes (`/api/users`)
11. Page routes (`/`)

## Adding New Routes

To add a new route module:

1. Create a new file in the `routes/` directory
2. Use the Express Router:
```javascript
const express = require('express');
const router = express.Router();

// Define your routes
router.get('/endpoint', (req, res) => {
    // Route logic
});

module.exports = router;
```

3. Import and mount in `index.js`:
```javascript
const newRouter = require('./routes/newroute');
app.use('/api/new', newRouter);
```

## Best Practices

1. **Separation of Concerns**: Each route file should handle a specific domain
2. **Middleware Usage**: Apply authentication middleware at the router level when possible
3. **Error Handling**: Use try-catch blocks and return appropriate HTTP status codes
4. **Consistent Response Format**: Use standardized JSON response structure
5. **Documentation**: Comment complex route logic and maintain this README

## Migration Notes

This routing structure was refactored from a monolithic `index.js` file (3000+ lines) to improve:
- Code maintainability
- Module testability
- Development scalability
- Team collaboration
- Performance optimization

All routes maintain backward compatibility with existing API contracts.
