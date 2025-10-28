const fs = require('fs');
const path = require('path');
const { logger } = require('./logger');
const { generateTopupRequestId } = require('./id-generator');

// Database paths
const SALDO_DB = path.join(__dirname, '../database/user/atm.json');
const TRANSACTIONS_DB = path.join(__dirname, '../database/saldo_transactions.json');
const VOUCHER_DB = path.join(__dirname, '../database/voucher.json');
const TOPUP_REQUESTS_DB = path.join(__dirname, '../database/topup_requests.json');

// Load databases
let saldoData = [];
let transactions = [];
let vouchers = [];
let topupRequests = [];

// Initialize databases
function initDatabase() {
    try {
        // Load saldo data
        if (fs.existsSync(SALDO_DB)) {
            saldoData = JSON.parse(fs.readFileSync(SALDO_DB, 'utf8'));
        } else {
            fs.writeFileSync(SALDO_DB, '[]');
        }

        // Load transactions
        if (fs.existsSync(TRANSACTIONS_DB)) {
            transactions = JSON.parse(fs.readFileSync(TRANSACTIONS_DB, 'utf8'));
        } else {
            fs.writeFileSync(TRANSACTIONS_DB, '[]');
        }

        // Load vouchers
        if (fs.existsSync(VOUCHER_DB)) {
            vouchers = JSON.parse(fs.readFileSync(VOUCHER_DB, 'utf8'));
        } else {
            fs.writeFileSync(VOUCHER_DB, '[]');
        }

        // Load topup requests
        if (fs.existsSync(TOPUP_REQUESTS_DB)) {
            topupRequests = JSON.parse(fs.readFileSync(TOPUP_REQUESTS_DB, 'utf8'));
        } else {
            fs.writeFileSync(TOPUP_REQUESTS_DB, '[]');
        }
    } catch (error) {
        console.error('Error initializing saldo database:', error);
    }
}

// Save databases
function saveSaldoData() {
    fs.writeFileSync(SALDO_DB, JSON.stringify(saldoData, null, 2));
}

function saveTransactions() {
    fs.writeFileSync(TRANSACTIONS_DB, JSON.stringify(transactions, null, 2));
}

function saveTopupRequests() {
    fs.writeFileSync(TOPUP_REQUESTS_DB, JSON.stringify(topupRequests, null, 2));
}

// Reload functions to get fresh data from disk
function reloadTransactions() {
    try {
        if (fs.existsSync(TRANSACTIONS_DB)) {
            transactions = JSON.parse(fs.readFileSync(TRANSACTIONS_DB, 'utf8'));
            console.log(`[SALDO-MANAGER] Reloaded ${transactions.length} transactions from database`);
        }
    } catch (error) {
        console.error('[SALDO-MANAGER] Error reloading transactions:', error);
    }
}

function reloadTopupRequests() {
    try {
        if (fs.existsSync(TOPUP_REQUESTS_DB)) {
            topupRequests = JSON.parse(fs.readFileSync(TOPUP_REQUESTS_DB, 'utf8'));
            console.log(`[SALDO-MANAGER] Reloaded ${topupRequests.length} topup requests from database`);
        }
    } catch (error) {
        console.error('[SALDO-MANAGER] Error reloading topup requests:', error);
    }
}

function reloadSaldoData() {
    try {
        if (fs.existsSync(SALDO_DB)) {
            saldoData = JSON.parse(fs.readFileSync(SALDO_DB, 'utf8'));
            console.log(`[SALDO-MANAGER] Reloaded ${saldoData.length} saldo records from database`);
        }
    } catch (error) {
        console.error('[SALDO-MANAGER] Error reloading saldo data:', error);
    }
}

// Update pushname for existing user
function updatePushname(userId, pushname) {
    const userIndex = saldoData.findIndex(u => u.id === userId);
    if (userIndex !== -1 && pushname) {
        saldoData[userIndex].pushname = pushname;
        saldoData[userIndex].updated_at = new Date().toISOString();
        saveSaldoData();
        return true;
    }
    return false;
}

// User saldo management
function getUserSaldo(userId) {
    const user = saldoData.find(u => u.id === userId);
    return user ? user.saldo : 0;
}

function createUserSaldo(userId, pushname = null) {
    const existing = saldoData.find(u => u.id === userId);
    if (!existing) {
        saldoData.push({
            id: userId,
            saldo: 0,
            uang: 0, // legacy field
            pushname: pushname, // Store WhatsApp pushname for better UX
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        });
        saveSaldoData();
        return true;
    }
    return false;
}

function addSaldo(userId, amount, description = 'Topup saldo', pushname = null, topupRequestId = null) {
    console.log(`[SALDO-MANAGER] Adding saldo: userId=${userId}, amount=${amount}, description=${description}, topupRequestId=${topupRequestId}`);
    
    const userIndex = saldoData.findIndex(u => u.id === userId);
    if (userIndex === -1) {
        console.log(`[SALDO-MANAGER] User not found, creating new user: ${userId}`);
        createUserSaldo(userId, pushname);
        return addSaldo(userId, amount, description, pushname, topupRequestId);
    }

    const oldSaldo = saldoData[userIndex].saldo;
    saldoData[userIndex].saldo += parseInt(amount);
    saldoData[userIndex].updated_at = new Date().toISOString();
    
    // Update pushname if provided and not already set
    if (pushname && !saldoData[userIndex].pushname) {
        saldoData[userIndex].pushname = pushname;
    }
    
    saveSaldoData();
    
    console.log(`[SALDO-MANAGER] Saldo updated: ${oldSaldo} -> ${saldoData[userIndex].saldo}`);

    // Record transaction
    addTransaction(userId, 'credit', amount, description, saldoData[userIndex].saldo, topupRequestId);
    
    return true;
}

function deductSaldo(userId, amount, description = 'Pembelian') {
    const userIndex = saldoData.findIndex(u => u.id === userId);
    if (userIndex === -1) return false;
    
    if (saldoData[userIndex].saldo < amount) return false;
    
    saldoData[userIndex].saldo -= parseInt(amount);
    saldoData[userIndex].updated_at = new Date().toISOString();
    saveSaldoData();

    // Record transaction
    addTransaction(userId, 'debit', amount, description, saldoData[userIndex].saldo);
    
    return true;
}

// Transaction management
function addTransaction(userId, type, amount, description, balance, topupRequestId = null) {
    console.log('[ADD_TRANSACTION] Creating transaction:', { userId, type, amount, description, topupRequestId });
    
    const transaction = {
        id: `TRX${Date.now()}${Math.random().toString(36).substr(2, 5)}`.toUpperCase(),
        userId: userId,
        type: type, // credit or debit
        amount: parseInt(amount),
        description: description,
        balance_after: balance,
        topupRequestId: topupRequestId, // Link to topup request for proof viewing
        status: 'completed',
        created_at: new Date().toISOString()
    };
    
    console.log('[ADD_TRANSACTION] Transaction created:', { id: transaction.id, topupRequestId: transaction.topupRequestId });
    
    transactions.push(transaction);
    saveTransactions();
    
    return transaction;
}

function getUserTransactions(userId, limit = 10) {
    return transactions
        .filter(t => t.userId === userId)
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, limit);
}

// Topup request management
function createTopupRequest(userId, amount, paymentMethod, agentId = null, customerName = 'Customer') {
    const request = {
        id: generateTopupRequestId(),
        userId: userId,
        customerName: customerName, // Store customer name for better UX
        amount: parseInt(amount),
        paymentMethod: paymentMethod, // cash, transfer, qris
        agentId: agentId, // For cash payments via agent
        agentTransactionId: null, // Will be set after agent transaction created
        paymentProof: null,
        status: 'pending', // pending, verified, rejected
        verifiedBy: null,
        verifiedAt: null,
        notes: null,
        created_at: new Date().toISOString()
    };
    
    topupRequests.push(request);
    saveTopupRequests();
    
    // If agent is specified, create agent transaction
    if (agentId) {
        try {
            const agentTransactionManager = require('./agent-transaction-manager');
            const agentManager = require('./agent-manager');
            
            const agent = agentManager.getAgentById(agentId);
            if (agent) {
                const agentTransaction = agentTransactionManager.createAgentTransaction({
                    topupRequestId: request.id,
                    customerId: userId,
                    customerName: customerName,
                    agentId: agentId,
                    agentName: agent.name,
                    amount: parseInt(amount),
                    transactionType: 'topup'
                });
                
                // Update topup request with agent transaction ID
                const index = topupRequests.findIndex(r => r.id === request.id);
                if (index !== -1) {
                    topupRequests[index].agentTransactionId = agentTransaction.id;
                    saveTopupRequests();
                }
                
                console.log('[SALDO-MANAGER] Agent transaction created:', agentTransaction.id);
            }
        } catch (error) {
            console.error('[SALDO-MANAGER] Failed to create agent transaction:', error);
            // Don't fail the topup request if agent transaction creation fails
        }
    }
    
    return request;
}

function getTopupRequest(requestId) {
    return topupRequests.find(r => r.id === requestId);
}

function getUserTopupRequests(userId) {
    return topupRequests
        .filter(r => r.userId === userId)
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

function getPendingTopupRequests() {
    return topupRequests
        .filter(r => r.status === 'pending')
        .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
}

function verifyTopupRequest(requestId, adminId, approved = true, notes = null) {
    console.log('[VERIFY_TOPUP] Starting verification:', { requestId, adminId, approved });
    
    const requestIndex = topupRequests.findIndex(r => r.id === requestId);
    if (requestIndex === -1) {
        console.log('[VERIFY_TOPUP] Request not found:', requestId);
        return false;
    }
    
    const request = topupRequests[requestIndex];
    console.log('[VERIFY_TOPUP] Found request:', { id: request.id, status: request.status, amount: request.amount });
    
    if (request.status !== 'pending') {
        console.log('[VERIFY_TOPUP] Request status not pending:', request.status);
        return false;
    }
    
    request.status = approved ? 'verified' : 'rejected';
    request.verifiedBy = adminId;
    request.verifiedAt = new Date().toISOString();
    request.notes = notes;
    
    saveTopupRequests();
    console.log('[VERIFY_TOPUP] Request updated in database');
    
    // If approved, add saldo
    if (approved) {
        console.log('[VERIFY_TOPUP] Calling addSaldo with requestId:', requestId);
        addSaldo(request.userId, request.amount, `Topup verified - ${request.paymentMethod}`, null, requestId);
        console.log('[VERIFY_TOPUP] addSaldo completed');
    }
    
    return request;
}

// Voucher purchase (DEPRECATED - use voucher-manager.js instead)
function purchaseVoucher(userId, voucherProfile) {
    // This function is deprecated
    // Use purchaseVoucherWithSaldo from voucher-manager.js
    return { 
        success: false, 
        message: 'Please use voucher-manager.js for voucher purchases' 
    };
}

// Helper functions
function generateVoucherCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 4; j++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        if (i < 2) code += '-';
    }
    return code;
}

function formatCurrency(amount) {
    return `Rp ${parseInt(amount).toLocaleString('id-ID')}`;
}

// Statistics
function getSaldoStatistics() {
    const totalUsers = saldoData.length;
    const totalSaldo = saldoData.reduce((sum, user) => sum + user.saldo, 0);
    const activeUsers = saldoData.filter(u => u.saldo > 0).length;
    
    return {
        totalUsers,
        activeUsers,
        totalSaldo,
        averageSaldo: totalUsers > 0 ? Math.floor(totalSaldo / totalUsers) : 0
    };
}

function getTransactionStatistics(startDate = null, endDate = null) {
    let filteredTransactions = transactions;
    
    if (startDate) {
        filteredTransactions = filteredTransactions.filter(t => 
            new Date(t.created_at) >= new Date(startDate)
        );
    }
    
    if (endDate) {
        filteredTransactions = filteredTransactions.filter(t => 
            new Date(t.created_at) <= new Date(endDate)
        );
    }
    
    const totalTransactions = filteredTransactions.length;
    const totalCredit = filteredTransactions
        .filter(t => t.type === 'credit')
        .reduce((sum, t) => sum + t.amount, 0);
    const totalDebit = filteredTransactions
        .filter(t => t.type === 'debit')
        .reduce((sum, t) => sum + t.amount, 0);
    
    return {
        totalTransactions,
        totalCredit,
        totalDebit,
        netFlow: totalCredit - totalDebit
    };
}

// Cancel topup request
function cancelTopupRequest(requestId) {
    const index = topupRequests.findIndex(r => r.id === requestId);
    if (index === -1) return false;
    
    topupRequests[index].status = 'cancelled';
    topupRequests[index].cancelled_at = new Date().toISOString();
    saveTopupRequests();
    return true;
}

// Transfer saldo between users
function transferSaldo(fromUserId, toUserId, amount, description = 'Transfer saldo') {
    try {
        // Validate amount
        if (!amount || amount <= 0) return false;
        
        // Check sender balance
        const senderBalance = getUserSaldo(fromUserId);
        if (senderBalance < amount) return false;
        
        // Create recipient if not exists
        createUserSaldo(toUserId);
        
        // Deduct from sender
        const senderIndex = saldoData.findIndex(u => u.id === fromUserId);
        if (senderIndex === -1) return false;
        
        saldoData[senderIndex].saldo -= amount;
        saldoData[senderIndex].updated_at = new Date().toISOString();
        
        // Add to recipient
        const recipientIndex = saldoData.findIndex(u => u.id === toUserId);
        saldoData[recipientIndex].saldo += amount;
        saldoData[recipientIndex].updated_at = new Date().toISOString();
        
        // Save changes
        saveSaldoData();
        
        // Record transactions
        const timestamp = new Date().toISOString();
        
        // Debit transaction for sender
        transactions.push({
            id: `TX${Date.now()}_1`,
            userId: fromUserId,
            type: 'debit',
            amount: amount,
            description: `${description} ke ${toUserId.replace('@s.whatsapp.net', '')}`,
            balance_before: senderBalance,
            balance_after: saldoData[senderIndex].saldo,
            created_at: timestamp
        });
        
        // Credit transaction for recipient
        const recipientBalanceBefore = saldoData[recipientIndex].saldo - amount;
        transactions.push({
            id: `TX${Date.now()}_2`,
            userId: toUserId,
            type: 'credit',
            amount: amount,
            description: `${description} dari ${fromUserId.replace('@s.whatsapp.net', '')}`,
            balance_before: recipientBalanceBefore,
            balance_after: saldoData[recipientIndex].saldo,
            created_at: timestamp
        });
        
        saveTransactions();
        return true;
        
    } catch (error) {
        console.error('Error in transferSaldo:', error);
        return false;
    }
}

// Process agent confirmation (called after agent confirms with PIN)
function processAgentConfirmation(agentTransactionId) {
    console.log('[SALDO-MANAGER] Processing agent confirmation:', agentTransactionId);
    
    try {
        const agentTransactionManager = require('./agent-transaction-manager');
        
        // 1. Get agent transaction
        const agentTransaction = agentTransactionManager.getTransactionById(agentTransactionId);
        
        if (!agentTransaction) {
            return {
                success: false,
                message: 'Agent transaction not found'
            };
        }
        
        if (agentTransaction.status !== 'confirmed') {
            return {
                success: false,
                message: `Agent transaction status is ${agentTransaction.status}, expected confirmed`
            };
        }
        
        // 2. Find related topup request
        const topupRequest = topupRequests.find(r => 
            r.id === agentTransaction.topupRequestId
        );
        
        if (!topupRequest) {
            return {
                success: false,
                message: 'Topup request not found'
            };
        }
        
        // 3. Update topup request status
        const requestIndex = topupRequests.findIndex(r => r.id === topupRequest.id);
        topupRequests[requestIndex].status = 'verified';
        topupRequests[requestIndex].verifiedBy = `agent_${agentTransaction.agentId}`;
        topupRequests[requestIndex].verifiedAt = new Date().toISOString();
        topupRequests[requestIndex].notes = `Confirmed by agent via WhatsApp`;
        saveTopupRequests();
        
        console.log('[SALDO-MANAGER] Topup request verified:', topupRequest.id);
        
        // 4. Add saldo to customer
        const saldoAdded = addSaldo(
            agentTransaction.customerId,
            agentTransaction.amount,
            `Topup via agent ${agentTransaction.agentName}`
        );
        
        if (!saldoAdded) {
            return {
                success: false,
                message: 'Failed to add saldo to customer'
            };
        }
        
        console.log('[SALDO-MANAGER] Saldo added to customer:', agentTransaction.customerId);
        
        // 5. Complete agent transaction
        const completed = agentTransactionManager.completeTransaction(agentTransactionId);
        
        if (!completed) {
            console.warn('[SALDO-MANAGER] Failed to complete agent transaction, but saldo already added');
        }
        
        // 6. Get updated saldo
        const newSaldo = getUserSaldo(agentTransaction.customerId);
        
        return {
            success: true,
            topupRequest: topupRequests[requestIndex],
            agentTransaction: agentTransaction,
            newSaldo: newSaldo,
            message: 'Agent confirmation processed successfully'
        };
        
    } catch (error) {
        console.error('[SALDO-MANAGER] Error processing agent confirmation:', error);
        return {
            success: false,
            message: 'Internal error processing confirmation',
            error: error.message
        };
    }
}

// Get user topup requests
function getUserTopupRequests(userId) {
    return topupRequests.filter(r => r.userId === userId);
}

// Save topup requests
function saveTopupRequests() {
    fs.writeFileSync(TOPUP_REQUESTS_DB, JSON.stringify(topupRequests, null, 2));
}

// Initialize on load
initDatabase();

module.exports = {
    // User saldo
    getUserSaldo,
    getSaldo: getUserSaldo, // Alias for compatibility
    createUserSaldo,
    addSaldo,
    deductSaldo,
    transferSaldo,
    cancelTopupRequest,
    updatePushname,
    
    // Transactions
    getUserTransactions,
    
    // Topup requests
    createTopupRequest,
    getTopupRequest,
    getUserTopupRequests,
    getPendingTopupRequests,
    verifyTopupRequest,
    saveTopupRequests,
    
    // Agent transaction processing
    processAgentConfirmation,
    
    // Voucher
    purchaseVoucher,
    
    // Statistics
    getSaldoStatistics,
    getTransactionStatistics,
    
    // Helpers
    formatCurrency,
    
    // Reload functions (force refresh from database)
    reloadTransactions,
    reloadTopupRequests,
    reloadSaldoData,
    
    // Get raw data accessors
    getAllSaldoData: function getAllSaldoData() {
        return saldoData;
    },
    getAllTransactions: function getAllTransactions() {
        return transactions;
    },
    getAllTopupRequests: function getAllTopupRequests() {
        // Reload from file to ensure fresh data
        if (fs.existsSync(TOPUP_REQUESTS_DB)) {
            topupRequests = JSON.parse(fs.readFileSync(TOPUP_REQUESTS_DB, 'utf8'));
        }
        return topupRequests;
    }
};
