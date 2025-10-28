const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const saldoManager = require('../lib/saldo-manager');
const voucherManager = require('../lib/voucher-manager');
const { getUploadDir, getUploadPath, generateFilename } = require('../lib/upload-helper');

// Configure multer for file uploads (Topup proofs)
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = getUploadDir('topup-requests');
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const userId = req.body.userId || 'unknown';
        const filename = generateFilename('topup', userId, file.originalname);
        cb(null, filename);
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|pdf/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        
        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Only image and PDF files are allowed'));
        }
    }
});

// Get saldo statistics
router.get('/statistics', (req, res) => {
    try {
        // Reload data to ensure fresh statistics
        saldoManager.reloadTopupRequests();
        saldoManager.reloadTransactions();
        
        const stats = saldoManager.getSaldoStatistics();
        const txStats = saldoManager.getTransactionStatistics();
        const topupRequests = saldoManager.getAllTopupRequests();
        
        // Count pending topups (include both pending AND waiting_verification)
        // These are requests that need admin action
        const pendingTopups = topupRequests.filter(r => 
            r.status === 'pending' || r.status === 'waiting_verification'
        ).length;
        
        // Count today's transactions
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayTransactions = saldoManager.getAllTransactions()
            .filter(tx => new Date(tx.created_at) >= today).length;
        
        res.json({
            ...stats,
            ...txStats,
            pendingTopups,
            todayTransactions
        });
    } catch (error) {
        console.error('Error getting statistics:', error);
        res.status(500).json({ error: 'Failed to get statistics' });
    }
});

// Get all users with saldo
router.get('/users', (req, res) => {
    try {
        const saldoData = saldoManager.getAllSaldoData();
        
        // Map with user names from database if available
        const users = global.users || [];
        const enrichedData = saldoData.map(saldo => {
            // Priority: 1) Pushname from saldo, 2) Name from users DB, 3) Phone number
            let displayName = saldo.pushname; // First priority: WhatsApp pushname
            
            if (!displayName) {
                // Try to get name from users database
                const user = users.find(u => 
                    u.phone_number === saldo.id.replace('@s.whatsapp.net', '') ||
                    u.phone_number === '0' + saldo.id.replace('@s.whatsapp.net', '').substring(2)
                );
                
                if (user && user.name) {
                    displayName = user.name;
                } else {
                    // Fallback: Format phone number nicely
                    const phoneNumber = saldo.id.replace('@s.whatsapp.net', '');
                    // Format: 628xxx → +62 8xxx or keep as is if short
                    if (phoneNumber.startsWith('62') && phoneNumber.length > 10) {
                        displayName = '+' + phoneNumber.substring(0, 2) + ' ' + phoneNumber.substring(2);
                    } else {
                        displayName = phoneNumber;
                    }
                }
            }
            
            return {
                ...saldo,
                name: displayName
            };
        });
        
        res.json(enrichedData);
    } catch (error) {
        console.error('Error getting users:', error);
        res.status(500).json({ error: 'Failed to get users' });
    }
});

// OLD ENDPOINT REMOVED - Using new enriched endpoint below (line ~465)
// This old endpoint returned raw data without hasProof field

// Get topup requests
router.get('/topup-requests', (req, res) => {
    try {
        const { status } = req.query;
        let requests = saldoManager.getAllTopupRequests();
        
        if (status) {
            requests = requests.filter(r => r.status === status);
        }
        
        // Sort by date ascending for pending, descending for others
        requests.sort((a, b) => {
            if (status === 'pending') {
                return new Date(a.created_at) - new Date(b.created_at);
            }
            return new Date(b.created_at) - new Date(a.created_at);
        });
        
        res.json(requests);
    } catch (error) {
        console.error('Error getting topup requests:', error);
        res.status(500).json({ error: 'Failed to get topup requests' });
    }
});

// Add saldo manually (admin only)
router.post('/add-manual', async (req, res) => {
    try {
        const { userId, amount, description } = req.body;
        
        if (!userId || !amount) {
            return res.status(400).json({ 
                success: false, 
                message: 'User ID dan jumlah harus diisi' 
            });
        }
        
        // Ensure user exists in saldo database
        saldoManager.createUserSaldo(userId);
        
        // Add saldo
        const success = saldoManager.addSaldo(userId, amount, description || 'Topup manual by admin');
        
        if (success) {
            // Send WhatsApp notification
            try {
                if (global.raf && global.raf.sendMessage) {
                    const message = `✅ *SALDO DITAMBAHKAN*\n\n` +
                        `Saldo Anda telah ditambahkan sebesar:\n` +
                        `💰 *${saldoManager.formatCurrency(amount)}*\n\n` +
                        `Saldo saat ini: *${saldoManager.formatCurrency(saldoManager.getUserSaldo(userId))}*\n\n` +
                        `Keterangan: ${description || 'Topup manual by admin'}\n\n` +
                        `Terima kasih! 🙏`;
                    
                    await global.raf.sendMessage(userId, { text: message });
                    console.log(`[SALDO] Notifikasi WhatsApp terkirim ke ${userId}`);
                } else {
                    console.error('[SALDO] WhatsApp connection (global.raf) tidak tersedia');
                }
            } catch (error) {
                console.error('[SALDO] Error mengirim notifikasi:', error);
            }
            
            res.json({ success: true, message: 'Saldo berhasil ditambahkan' });
        } else {
            res.status(500).json({ success: false, message: 'Gagal menambah saldo' });
        }
    } catch (error) {
        console.error('Error adding saldo:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Create topup request
router.post('/topup-request', upload.single('proof'), (req, res) => {
    try {
        const { userId, amount, paymentMethod } = req.body;
        const paymentProof = req.file ? getUploadPath('topup-requests', req.file.filename) : null;
        
        if (!userId || !amount || !paymentMethod) {
            return res.status(400).json({ 
                success: false, 
                message: 'Data tidak lengkap' 
            });
        }
        
        // Create topup request
        const request = saldoManager.createTopupRequest(userId, amount, paymentMethod, paymentProof);
        
        // Notify admins
        if (global.raf && global.raf.sendMessage) {
            const adminMessage = `📢 *REQUEST TOPUP BARU*\n\n` +
                `User: ${userId}\n` +
                `Jumlah: ${saldoManager.formatCurrency(amount)}\n` +
                `Metode: ${paymentMethod}\n` +
                `${paymentProof ? 'Bukti: ✅ Sudah upload' : 'Bukti: ⏳ Belum upload'}\n\n` +
                `ID Request: ${request.id}\n\n` +
                `Silakan cek di panel admin untuk verifikasi.`;
            
            // Send to owner and admins
            const admins = global.accounts?.filter(acc => 
                acc.role === 'owner' || acc.role === 'admin' || acc.role === 'superadmin'
            ) || [];
            
            admins.forEach(admin => {
                if (admin.phone) {
                    const adminJid = admin.phone.includes('@') ? admin.phone : `${admin.phone}@s.whatsapp.net`;
                    global.raf.sendMessage(adminJid, { text: adminMessage }).catch(console.error);
                }
            });
        }
        
        res.json({ 
            success: true, 
            message: 'Request topup berhasil dibuat',
            requestId: request.id 
        });
    } catch (error) {
        console.error('Error creating topup request:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Verify topup request (admin only)
router.post('/verify-topup', async (req, res) => {
    try {
        const { requestId, approved, notes } = req.body;
        const adminName = req.session?.username || 'admin';
        
        if (!requestId) {
            return res.status(400).json({ 
                success: false, 
                message: 'Request ID harus diisi' 
            });
        }
        
        // Use the new handler for verification
        const { handleTopupVerification } = require('../message/handlers/topup-handler');
        const result = await handleTopupVerification(requestId, approved, adminName, notes);
        
        res.json(result);
    } catch (error) {
        console.error('Error verifying topup:', error);
        res.status(500).json({ 
            success: false, 
            message: error.message || 'Server error' 
        });
    }
});

// Get voucher profiles
router.get('/vouchers', (req, res) => {
    try {
        const vouchers = voucherManager.getVoucherProfiles();
        res.json(vouchers);
    } catch (error) {
        console.error('Error getting vouchers:', error);
        res.status(500).json({ error: 'Failed to get vouchers' });
    }
});

// Get voucher statistics
router.get('/voucher-stats', (req, res) => {
    try {
        const stats = voucherManager.getVoucherStatistics();
        res.json(stats);
    } catch (error) {
        console.error('Error getting voucher stats:', error);
        res.status(500).json({ error: 'Failed to get statistics' });
    }
});

// Get user purchase history
router.get('/voucher-history/:userId', (req, res) => {
    try {
        const { userId } = req.params;
        const history = voucherManager.getUserPurchaseHistory(userId);
        res.json(history);
    } catch (error) {
        console.error('Error getting purchase history:', error);
        res.status(500).json({ error: 'Failed to get history' });
    }
});

// Add voucher profile
router.post('/add-voucher', (req, res) => {
    try {
        const { prof, namavc, durasivc, hargavc } = req.body;
        
        if (!prof || !namavc || !durasivc || !hargavc) {
            return res.status(400).json({ 
                success: false, 
                message: 'Data voucher tidak lengkap' 
            });
        }
        
        const result = voucherManager.addVoucherProfile({
            prof,
            namavc,
            durasivc,
            hargavc: String(hargavc)
        });
        
        res.json(result);
    } catch (error) {
        console.error('Error adding voucher:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Update voucher profile
router.post('/update-voucher', (req, res) => {
    try {
        const { prof, namavc, durasivc, hargavc } = req.body;
        
        if (!prof) {
            return res.status(400).json({ 
                success: false, 
                message: 'Profile voucher harus diisi' 
            });
        }
        
        const updates = {};
        if (namavc) updates.namavc = namavc;
        if (durasivc) updates.durasivc = durasivc;
        if (hargavc) updates.hargavc = String(hargavc);
        
        const result = voucherManager.updateVoucherProfile(prof, updates);
        
        if (!result.success) {
            return res.status(404).json(result);
        }
        
        res.json(result);
    } catch (error) {
        console.error('Error updating voucher:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Delete voucher profile
router.post('/delete-voucher', (req, res) => {
    try {
        const { prof } = req.body;
        
        if (!prof) {
            return res.status(400).json({ 
                success: false, 
                message: 'Profile voucher harus diisi' 
            });
        }
        
        const result = voucherManager.deleteVoucherProfile(prof);
        
        if (!result.success) {
            return res.status(404).json(result);
        }
        
        res.json(result);
    } catch (error) {
        console.error('Error deleting voucher:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Purchase voucher with saldo (auto-generate from MikroTik)
router.post('/purchase-voucher', async (req, res) => {
    try {
        const { userId, voucherProfile } = req.body;
        
        if (!userId || !voucherProfile) {
            return res.status(400).json({ 
                success: false, 
                message: 'User ID dan voucher harus dipilih' 
            });
        }
        
        // Use new voucher manager for auto-generation
        const result = await voucherManager.purchaseVoucherWithSaldo(userId, voucherProfile, saldoManager);
        
        if (result.success) {
            // Send voucher code via WhatsApp
            if (global.raf && global.raf.sendMessage) {
                const message = `✅ *PEMBELIAN VOUCHER BERHASIL*\n\n` +
                    `Voucher: *${result.voucher.profile}*\n` +
                    `Durasi: ${result.voucher.duration}\n` +
                    `Harga: ${saldoManager.formatCurrency(result.voucher.price)}\n\n` +
                    `📱 *KODE VOUCHER HOTSPOT:*\n` +
                    `━━━━━━━━━━━━━━━━━\n` +
                    `Username: \`${result.voucher.code}\`\n` +
                    `Password: \`${result.voucher.password}\`\n` +
                    `━━━━━━━━━━━━━━━━━\n\n` +
                    `Sisa saldo: ${saldoManager.formatCurrency(result.remainingSaldo)}\n\n` +
                    `📌 *CARA PENGGUNAAN:*\n` +
                    `1. Hubungkan ke WiFi hotspot\n` +
                    `2. Buka browser\n` +
                    `3. Masukkan username & password\n\n` +
                    `_⚠️ Screenshot atau catat kode voucher ini!_`;
                
                global.raf.sendMessage(userId, { text: message }).catch(console.error);
            }
        }
        
        res.json(result);
    } catch (error) {
        console.error('Error purchasing voucher:', error);
        res.status(500).json({ success: false, message: 'Server error: ' + error.message });
    }
});

// Get all transactions with topup request info
router.get('/transactions', (req, res) => {
    try {
        console.log('[API_TRANSACTIONS] Starting to fetch transactions...');
        saldoManager.reloadTransactions();
        saldoManager.reloadTopupRequests();  // IMPORTANT: Reload topup requests too!
        const transactions = saldoManager.getAllTransactions();
        console.log(`[API_TRANSACTIONS] Loaded ${transactions.length} transactions`);
        
        // Enrich with user names and topup request info
        const users = global.users || [];
        const saldoData = saldoManager.getAllSaldoData();
        
        const enrichedTransactions = transactions.map(tx => {
            const saldoUser = saldoData.find(s => s.id === tx.userId);
            let displayName = saldoUser?.pushname || tx.userId.replace('@s.whatsapp.net', '');
            
            // Try from users database if no pushname
            if (!saldoUser?.pushname) {
                const user = users.find(u => 
                    u.phone_number === tx.userId.replace('@s.whatsapp.net', '') ||
                    u.phone_number === '0' + tx.userId.replace('@s.whatsapp.net', '').substring(2)
                );
                if (user?.name) displayName = user.name;
            }
            
            // Check if has topup request with proof
            let hasProof = false;
            if (tx.topupRequestId) {
                const topupRequest = saldoManager.getTopupRequest(tx.topupRequestId);
                
                // DEBUG: Log for specific transaction
                if (tx.id === 'TRX1761114032174RRZH6') {
                    console.log('[DEBUG_API] Transaction TRX1761114032174RRZH6');
                    console.log('[DEBUG_API] topupRequestId:', tx.topupRequestId);
                    console.log('[DEBUG_API] topupRequest found:', !!topupRequest);
                    if (topupRequest) {
                        console.log('[DEBUG_API] paymentProof:', topupRequest.paymentProof);
                        console.log('[DEBUG_API] topupRequest:', topupRequest);
                    }
                }
                
                if (topupRequest && topupRequest.paymentProof) {
                    hasProof = true;
                }
            }
            
            const result = {
                ...tx,
                userName: displayName,
                hasProof: hasProof
            };
            
            // DEBUG: Log specific transaction
            if (tx.id === 'TRX1761114032174RRZH6') {
                console.log('[DEBUG_API] Final result for TRX1761114032174RRZH6:', result);
            }
            
            return result;
        });
        
        res.json({ success: true, data: enrichedTransactions });
    } catch (error) {
        console.error('Error getting transactions:', error);
        res.status(500).json({ success: false, message: 'Failed to get transactions' });
    }
});

// View topup proof from transaction
router.get('/transaction/:id/proof', (req, res) => {
    try {
        const { id } = req.params;
        
        console.log('[PROOF] Getting proof for transaction:', id);
        
        // IMPORTANT: Reload data to get latest from database
        saldoManager.reloadTransactions();
        saldoManager.reloadTopupRequests();
        
        // Get transaction
        const transactions = saldoManager.getAllTransactions();
        const transaction = transactions.find(t => t.id === id);
        
        console.log('[PROOF] Transaction found:', !!transaction);
        if (transaction) {
            console.log('[PROOF] Transaction topupRequestId:', transaction.topupRequestId);
        }
        
        if (!transaction) {
            return res.status(404).json({ success: false, message: 'Transaction not found' });
        }
        
        if (!transaction.topupRequestId) {
            return res.status(404).json({ success: false, message: 'No topup request linked to this transaction' });
        }
        
        // Get topup request
        const topupRequest = saldoManager.getTopupRequest(transaction.topupRequestId);
        
        console.log('[PROOF] Topup request found:', !!topupRequest);
        if (topupRequest) {
            console.log('[PROOF] Payment proof:', topupRequest.paymentProof);
        }
        
        if (!topupRequest) {
            return res.status(404).json({ success: false, message: 'Topup request not found' });
        }
        
        if (!topupRequest.paymentProof) {
            return res.status(404).json({ success: false, message: 'No payment proof for this topup request' });
        }
        
        // Construct file path
        const proofPath = path.join(__dirname, '../temp/topup_proofs', topupRequest.paymentProof);
        
        if (!fs.existsSync(proofPath)) {
            return res.status(404).json({ success: false, message: 'Proof file not found' });
        }
        
        // Send file
        res.sendFile(proofPath);
    } catch (error) {
        console.error('Error getting topup proof:', error);
        res.status(500).json({ success: false, message: 'Failed to get proof: ' + error.message });
    }
});

module.exports = router;
