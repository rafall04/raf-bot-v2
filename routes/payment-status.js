const express = require('express');
const fs = require('fs');
const path = require('path');
const { loadJSON, saveJSON } = require('../lib/database');
const { handlePaidStatusChange } = require('../lib/approval-logic');

const router = express.Router();

// Middleware for admin-only routes
function ensureAdmin(req, res, next) {
    if (!req.user || !['admin', 'owner', 'superadmin'].includes(req.user.role)) {
        return res.status(403).json({ status: 403, message: "Akses ditolak." });
    }
    next();
}

// POST /api/payment-status/bulk-update
router.post('/bulk-update', ensureAdmin, async (req, res) => {
    const { userIds, paid } = req.body;
    
    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
        return res.status(400).json({ message: 'User IDs array is required' });
    }
    
    if (typeof paid !== 'boolean') {
        return res.status(400).json({ message: 'Paid status must be a boolean' });
    }
    
    const results = {
        success: [],
        failed: []
    };
    
    for (const userId of userIds) {
        try {
            const user = global.users.find(u => String(u.id) === String(userId));
            if (!user) {
                results.failed.push({ userId, reason: 'User not found' });
                continue;
            }
            
            // Update in database
            const newPaidStatus = paid ? 1 : 0;
            await new Promise((resolve, reject) => {
                global.db.run(
                    'UPDATE users SET paid = ? WHERE id = ?',
                    [newPaidStatus, userId],
                    function(err) {
                        if (err) {
                            console.error(`[BULK_UPDATE_ERROR] Failed to update user ${userId}:`, err);
                            reject(err);
                        } else {
                            resolve();
                        }
                    }
                );
            });
            
            // Update in memory
            user.paid = paid;
            
            // Handle paid status change (send invoice if needed)
            if (paid) {
                // When admin marks as paid, use TRANSFER_BANK as default payment method
                // Since admin is marking it, it's likely a bank transfer confirmation
                const paymentMethod = req.body.paymentMethod || 'TRANSFER_BANK';
                
                await handlePaidStatusChange(user, {
                    paidDate: new Date().toISOString(),
                    method: paymentMethod,
                    approvedBy: req.user.username,
                    notes: 'Status pembayaran diperbarui oleh admin'
                });
            }
            
            results.success.push(userId);
        } catch (error) {
            console.error(`[BULK_UPDATE_ERROR] Failed to process user ${userId}:`, error);
            results.failed.push({ userId, reason: error.message });
        }
    }
    
    return res.json({
        message: `Bulk update completed. Success: ${results.success.length}, Failed: ${results.failed.length}`,
        results
    });
});

module.exports = router;
