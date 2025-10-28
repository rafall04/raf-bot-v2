"use strict";

/**
 * Agent Transaction Manager
 * Manages transactions between customers and agents (topup, payment, voucher)
 */

const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const { logger } = require('./logger');
const { generateAgentTransactionId } = require('./id-generator');

// Database paths
const AGENT_TRANSACTIONS_DB = path.join(__dirname, '../database/agent_transactions.json');
const AGENT_CREDENTIALS_DB = path.join(__dirname, '../database/agent_credentials.json');

// Load data
let agentTransactions = [];
let agentCredentials = [];

// Initialize database
function initDatabase() {
    try {
        // Load agent transactions
        if (fs.existsSync(AGENT_TRANSACTIONS_DB)) {
            agentTransactions = JSON.parse(fs.readFileSync(AGENT_TRANSACTIONS_DB, 'utf8'));
        } else {
            fs.writeFileSync(AGENT_TRANSACTIONS_DB, '[]');
        }

        // Load agent credentials
        if (fs.existsSync(AGENT_CREDENTIALS_DB)) {
            agentCredentials = JSON.parse(fs.readFileSync(AGENT_CREDENTIALS_DB, 'utf8'));
        } else {
            fs.writeFileSync(AGENT_CREDENTIALS_DB, '[]');
        }

        logger.info('Agent transaction database initialized', {
            transactions: agentTransactions.length,
            credentials: agentCredentials.length
        });
    } catch (error) {
        logger.error('Error initializing agent transaction database:', error);
    }
}

// Save functions
function saveAgentTransactions() {
    fs.writeFileSync(AGENT_TRANSACTIONS_DB, JSON.stringify(agentTransactions, null, 2));
}

function saveAgentCredentials() {
    fs.writeFileSync(AGENT_CREDENTIALS_DB, JSON.stringify(agentCredentials, null, 2));
}

/**
 * Create a new agent transaction
 */
function createAgentTransaction(data) {
    const transaction = {
        id: generateAgentTransactionId(),
        topupRequestId: data.topupRequestId || null,
        customerId: data.customerId,
        customerName: data.customerName || 'Customer',
        agentId: data.agentId,
        agentName: data.agentName || 'Agent',
        amount: data.amount,
        transactionType: data.transactionType || 'topup', // topup, payment, voucher
        status: 'pending', // pending, confirmed, completed, cancelled
        agentPin: null,
        confirmedBy: null,
        confirmedAt: null,
        notes: data.notes || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    };

    agentTransactions.push(transaction);
    saveAgentTransactions();

    logger.info('Agent transaction created', {
        id: transaction.id,
        agentId: data.agentId,
        amount: data.amount
    });

    return transaction;
}

/**
 * Get transaction by ID
 */
function getTransactionById(transactionId) {
    return agentTransactions.find(t => t.id === transactionId);
}

/**
 * Get transactions by agent ID
 */
function getTransactionsByAgent(agentId, filters = {}) {
    let transactions = agentTransactions.filter(t => t.agentId === agentId);

    // Filter by status
    if (filters.status) {
        transactions = transactions.filter(t => t.status === filters.status);
    }

    // Filter by date range
    if (filters.startDate) {
        transactions = transactions.filter(t => 
            new Date(t.created_at) >= new Date(filters.startDate)
        );
    }

    if (filters.endDate) {
        transactions = transactions.filter(t => 
            new Date(t.created_at) <= new Date(filters.endDate)
        );
    }

    // Sort by date (newest first)
    return transactions.sort((a, b) => 
        new Date(b.created_at) - new Date(a.created_at)
    );
}

/**
 * Get transactions by customer ID
 */
function getTransactionsByCustomer(customerId, filters = {}) {
    let transactions = agentTransactions.filter(t => t.customerId === customerId);

    if (filters.status) {
        transactions = transactions.filter(t => t.status === filters.status);
    }

    return transactions.sort((a, b) => 
        new Date(b.created_at) - new Date(a.created_at)
    );
}

/**
 * Get today's transactions for agent
 */
function getTodayTransactions(agentId) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return agentTransactions.filter(t => 
        t.agentId === agentId && 
        new Date(t.created_at) >= today
    );
}

/**
 * Confirm agent transaction with PIN verification
 */
async function confirmTransaction(transactionId, agentPhone, pin) {
    const transaction = getTransactionById(transactionId);
    
    if (!transaction) {
        return {
            success: false,
            message: 'Transaction not found'
        };
    }

    if (transaction.status !== 'pending') {
        return {
            success: false,
            message: `Transaction already ${transaction.status}`
        };
    }

    // Verify agent credentials
    const verification = await verifyAgentCredentials(transaction.agentId, agentPhone, pin);
    
    if (!verification.success) {
        return {
            success: false,
            message: verification.message
        };
    }

    // Update transaction
    const index = agentTransactions.findIndex(t => t.id === transactionId);
    agentTransactions[index].status = 'confirmed';
    agentTransactions[index].confirmedBy = agentPhone;
    agentTransactions[index].confirmedAt = new Date().toISOString();
    agentTransactions[index].updated_at = new Date().toISOString();
    
    saveAgentTransactions();

    logger.info('Agent transaction confirmed', {
        id: transactionId,
        agentId: transaction.agentId,
        confirmedBy: agentPhone
    });

    return {
        success: true,
        transaction: agentTransactions[index]
    };
}

/**
 * Cancel agent transaction
 */
function cancelTransaction(transactionId, reason = null) {
    const index = agentTransactions.findIndex(t => t.id === transactionId);
    
    if (index === -1) {
        return false;
    }

    agentTransactions[index].status = 'cancelled';
    agentTransactions[index].notes = reason || agentTransactions[index].notes;
    agentTransactions[index].updated_at = new Date().toISOString();
    
    saveAgentTransactions();

    logger.info('Agent transaction cancelled', {
        id: transactionId,
        reason: reason
    });

    return true;
}

/**
 * Complete agent transaction (after saldo added)
 */
function completeTransaction(transactionId) {
    const index = agentTransactions.findIndex(t => t.id === transactionId);
    
    if (index === -1) {
        return false;
    }

    agentTransactions[index].status = 'completed';
    agentTransactions[index].updated_at = new Date().toISOString();
    
    saveAgentTransactions();

    return true;
}

/**
 * Register agent credentials (WhatsApp + PIN)
 */
async function registerAgentCredentials(agentId, whatsappNumber, pin) {
    // Check if already registered
    const existing = agentCredentials.find(c => c.agentId === agentId);
    
    if (existing) {
        return {
            success: false,
            message: 'Agent already registered'
        };
    }

    // Hash PIN
    const hashedPin = await bcrypt.hash(pin, 10);

    const credentials = {
        agentId: agentId,
        whatsappNumber: whatsappNumber,
        pin: hashedPin,
        active: true,
        created_at: new Date().toISOString(),
        lastLogin: null
    };

    agentCredentials.push(credentials);
    saveAgentCredentials();

    logger.info('Agent credentials registered', {
        agentId: agentId,
        whatsappNumber: whatsappNumber
    });

    return {
        success: true,
        credentials: credentials
    };
}

/**
 * Verify agent credentials (PIN check)
 */
async function verifyAgentCredentials(agentId, whatsappNumber, pin) {
    const credentials = agentCredentials.find(c => 
        c.agentId === agentId && 
        c.whatsappNumber === whatsappNumber &&
        c.active
    );

    if (!credentials) {
        return {
            success: false,
            message: 'Agent credentials not found or inactive'
        };
    }

    // Verify PIN
    const isValid = await bcrypt.compare(pin, credentials.pin);

    if (!isValid) {
        logger.warn('Invalid PIN attempt', {
            agentId: agentId,
            whatsappNumber: whatsappNumber
        });

        return {
            success: false,
            message: 'Invalid PIN'
        };
    }

    // Update last login
    const index = agentCredentials.findIndex(c => c.agentId === agentId);
    agentCredentials[index].lastLogin = new Date().toISOString();
    saveAgentCredentials();

    return {
        success: true,
        agentId: agentId
    };
}

/**
 * Update agent PIN
 */
async function updateAgentPin(agentId, whatsappNumber, oldPin, newPin) {
    // Verify old PIN first
    const verification = await verifyAgentCredentials(agentId, whatsappNumber, oldPin);
    
    if (!verification.success) {
        return {
            success: false,
            message: 'Invalid current PIN'
        };
    }

    // Hash new PIN
    const hashedPin = await bcrypt.hash(newPin, 10);

    // Update credentials
    const index = agentCredentials.findIndex(c => c.agentId === agentId);
    agentCredentials[index].pin = hashedPin;
    agentCredentials[index].updated_at = new Date().toISOString();
    
    saveAgentCredentials();

    logger.info('Agent PIN updated', {
        agentId: agentId
    });

    return {
        success: true,
        message: 'PIN updated successfully'
    };
}

/**
 * Get agent credentials by WhatsApp number
 */
function getAgentByWhatsapp(whatsappNumber) {
    return agentCredentials.find(c => 
        c.whatsappNumber === whatsappNumber && 
        c.active
    );
}

/**
 * Get agent statistics
 */
function getAgentStatistics(agentId, period = 'all') {
    let transactions = agentTransactions.filter(t => t.agentId === agentId);

    // Filter by period
    if (period === 'today') {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        transactions = transactions.filter(t => new Date(t.created_at) >= today);
    } else if (period === 'week') {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        transactions = transactions.filter(t => new Date(t.created_at) >= weekAgo);
    } else if (period === 'month') {
        const monthAgo = new Date();
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        transactions = transactions.filter(t => new Date(t.created_at) >= monthAgo);
    }

    const stats = {
        total: transactions.length,
        pending: transactions.filter(t => t.status === 'pending').length,
        confirmed: transactions.filter(t => t.status === 'confirmed').length,
        completed: transactions.filter(t => t.status === 'completed').length,
        cancelled: transactions.filter(t => t.status === 'cancelled').length,
        totalAmount: transactions
            .filter(t => t.status === 'completed')
            .reduce((sum, t) => sum + t.amount, 0),
        pendingAmount: transactions
            .filter(t => t.status === 'pending')
            .reduce((sum, t) => sum + t.amount, 0)
    };

    return stats;
}

/**
 * Get all transactions (admin view)
 */
function getAllTransactions(filters = {}) {
    let transactions = [...agentTransactions];

    if (filters.status) {
        transactions = transactions.filter(t => t.status === filters.status);
    }

    if (filters.agentId) {
        transactions = transactions.filter(t => t.agentId === filters.agentId);
    }

    if (filters.startDate) {
        transactions = transactions.filter(t => 
            new Date(t.created_at) >= new Date(filters.startDate)
        );
    }

    return transactions.sort((a, b) => 
        new Date(b.created_at) - new Date(a.created_at)
    );
}

// Initialize on load
initDatabase();

module.exports = {
    // Transaction management
    createAgentTransaction,
    getTransactionById,
    getTransactionsByAgent,
    getTransactionsByCustomer,
    getTodayTransactions,
    confirmTransaction,
    cancelTransaction,
    completeTransaction,
    getAllTransactions,
    
    // Credentials management
    registerAgentCredentials,
    verifyAgentCredentials,
    updateAgentPin,
    getAgentByWhatsapp,
    
    // Statistics
    getAgentStatistics,
    
    // Database access
    saveAgentTransactions,
    saveAgentCredentials
};
