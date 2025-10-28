// This is a cleaned version of index.js with all duplicate routes removed
// All routes have been moved to their respective files in the routes/ directory

const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { createServer } = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const phpExpress = require('php-express')({
    binPath: 'php'
});
const qrcode = require('qrcode');
const P = require('pino');
const Boom = require('@hapi/boom');

// --- GLOBAL ERROR HANDLERS ---
// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise);
    console.error('   Reason:', reason);
    // Log but don't crash - let the app continue
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
    console.error('   Stack:', error.stack);
    
    // Critical error - need to restart
    console.log('🔄 Restarting process due to uncaught exception...');
    process.exit(1);
});

// Handle graceful shutdown
process.on('SIGTERM', async () => {
    console.log('📴 SIGTERM received, shutting down gracefully...');
    
    try {
        // Close WhatsApp connection if exists
        if (global.sock && typeof global.sock.logout === 'function') {
            console.log('   Closing WhatsApp connection...');
            await global.sock.logout();
        }
        
        // Close database connection if exists
        if (global.db && typeof global.db.close === 'function') {
            console.log('   Closing database connection...');
            await global.db.close();
        }
        
        console.log('✅ Graceful shutdown complete');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error during shutdown:', error);
        process.exit(1);
    }
});

process.on('SIGINT', async () => {
    console.log('\n📴 SIGINT received (Ctrl+C), shutting down...');
    
    try {
        if (global.sock && typeof global.sock.logout === 'function') {
            await global.sock.logout();
        }
        process.exit(0);
    } catch (error) {
        console.error('❌ Error during shutdown:', error);
        process.exit(1);
    }
});

// --- GLOBAL VARIABLES (Initialize early) ---
global.conn = null;
global.whatsappConnectionState = 'close';
global.users = [];
global.packages = [];
global.reports = [];
global.compensations = [];
global.speed_requests = [];
global.packageChangeRequests = [];
global.accounts = [];
global.payment = [];
global.paymentMethod = [];
global.statik = [];
global.voucher = [];
global.atm = [];
global.networkAssets = [];
global.cronConfig = {};
global.config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));

// Local dependencies (after global config is loaded)
const { initializeDatabase, loadJSON, saveJSON } = require('./lib/database');
const { initializeAllCronTasks } = require('./lib/cron');
const { initializeUploadDirs } = require('./lib/upload-helper');
const msgHandler = require('./message/raf');
global.db = null;
global.io = null;

const app = express();
const PORT = process.env.PORT || 3100;
const config = global.config;

// --- MIDDLEWARE SETUP (Correct Order) ---

// 1. CORS
app.use(cors());

// 2. Body Parsers
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// 3. Cookie Parser
app.use(cookieParser('rweutkhdrt'))

// Serve static files
app.use('/static', express.static(path.join(__dirname, 'static')));
// Legacy paths for backward compatibility
app.use('/vendor', express.static(path.join(__dirname, 'static/vendor')));
app.use('/css', express.static(path.join(__dirname, 'static/css')));
app.use('/js', express.static(path.join(__dirname, 'static/js')));
// Serve temporary files (for payment proofs)
app.use('/temp', express.static(path.join(__dirname, 'temp')));

// 5. Main Authentication Middleware
app.use(async (req, res, next) => {
    // Let PHP engine handle its own files without interference
    if(req.url.match(/.+\.php/)) return next();
    
    const token = req.cookies?.token || req.headers?.authorization?.replace('Bearer ', '');
    
    console.log(`[AUTH_MIDDLEWARE] Path: ${req.path}, Token exists: ${!!token}, Cookie token: ${!!req.cookies?.token}`);
    
    if (token) {
        try {
            const decoded = jwt.verify(token, config.jwt);
            
            // Check if it's an admin/staff token (has 'role' field)
            if (decoded.role) {
                const account = global.accounts.find(acc => String(acc.id) === String(decoded.id));
                if (account) {
                    req.user = account;
                    console.log(`[AUTH_SUCCESS_ADMIN] User ${account.username} (${account.role}) authenticated. Path: ${req.path}`);
                } else {
                    console.log(`[AUTH_FAIL_ADMIN] Account not found for ID ${decoded.id}. Path: ${req.path}`);
                }
            } 
            // Check if it's a customer token (has 'name' field)
            else if (decoded.name) {
                const customer = global.users.find(u => String(u.id) === String(decoded.id));
                if (customer) {
                    req.customer = customer;
                    console.log(`[AUTH_SUCCESS_CUSTOMER] Customer ${customer.name} authenticated. Path: ${req.path}`);
                } else {
                    console.log(`[AUTH_FAIL_CUSTOMER] Customer not found for ID ${decoded.id}. Path: ${req.path}`);
                }
            }
        } catch (err) {
            console.log(`[AUTH_ERROR] Invalid token. Error: ${err.message}. Path: ${req.path}`);
        }
    }
    
    // Public paths that don't require authentication
    const publicPaths = [
        '/login',
        '/api/login',
        '/api/otp',
        '/api/otpverify',
        '/api/customer/login',
        '/app/',
        '/callback/payment',
        '/api/announcements',
        '/api/news',
        '/api/wifi-name',
        '/api/packages',
        '/api/speed-boost/packages'
    ];
    
    // Check if current path is public
    if (publicPaths.some(p => req.path.startsWith(p))) {
        return next();
    }
    
    // For authenticated paths, check if user is logged in
    if (req.user || req.customer) {
        return next();
    }
    
    // API routes should return 401
    if (req.path.startsWith('/api/')) {
        return res.status(401).json({ status: 401, message: "Unauthorized" });
    }
    
    // If accessing login page directly, allow it
    if (req.path === '/login') {
        return next();
    }
    
    // Check if it's an AJAX request
    if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
        return res.status(401).json({ status: 401, message: "Unauthorized" });
    }
    
    // If no token and not a public path, redirect to login
    console.log(`[AUTH_REDIRECT_GUEST] No token and not a public path. Path: ${req.path}. Redirecting to /login.`);
    return res.redirect("/login");
}); 


// 6. Routers - Import all route modules
const publicApiRouter = require('./routes/public');
const adminApiRouter = require('./routes/admin');
const apiRouter = require('./routes/api');
const ticketsRouter = require('./routes/tickets');
const invoiceRouter = require('./routes/invoice');
const paymentStatusRouter = require('./routes/payment-status');
const requestsRouter = require('./routes/requests');
const compensationRouter = require('./routes/compensation');
const statsRouter = require('./routes/stats');
const usersRouter = require('./routes/users');
const accountsRouter = require('./routes/accounts');
const packagesRouter = require('./routes/packages');
const saldoRouter = require('./routes/saldo');
const agentsRouter = require('./routes/agents');
const pagesRouter = require('./routes/pages');

// Mount routers - ORDER MATTERS!
// More specific routes should come before general ones
app.use('/', publicApiRouter);
app.use('/', adminApiRouter);
app.use('/api/payment-status', paymentStatusRouter);
app.use('/api/requests', requestsRouter);
app.use('/api/users', usersRouter); // Mount this BEFORE general /api to avoid conflicts
app.use('/api/saldo', saldoRouter); // Mount BEFORE general /api routes
app.use('/api/agents', agentsRouter); // Agent management routes
app.use('/', packagesRouter); // Packages management routes
app.use('/api', accountsRouter); // Accounts management routes
app.use('/api', apiRouter); // This has /users routes, so must come AFTER /api/users
app.use('/api', ticketsRouter);
app.use('/api', invoiceRouter);
app.use('/api', compensationRouter);
app.use('/api', statsRouter); // This has catch-all /:type/:id route, must be LAST
app.use('/', pagesRouter);


// --- VIEW ENGINE AND PHP SETUP ---
app.set('views', 'views');
app.engine('php', phpExpress.engine);
app.set('view engine', 'php');

// PHP file handler
app.all(/.+\.php$/, phpExpress.router);

// Socket.IO setup
const server = createServer(app);
const io = new Server(server);
global.io = io;

// Helper functions that are still needed in index.js

// Fungsi untuk membersihkan request pending yang lama
function cleanupOldPendingRequests() {
    try {
        const allRequests = loadJSON('database/requests.json');
        const sevenDaysInMs = 7 * 24 * 60 * 60 * 1000;
        let cleanedCount = 0;
        
        allRequests.forEach(request => {
            if (request.status === 'pending') {
                const requestAge = Date.now() - new Date(request.created_at).getTime();
                
                // Auto-cancel jika lebih dari 7 hari
                if (requestAge > sevenDaysInMs) {
                    request.status = 'cancelled_by_system';
                    request.updated_at = new Date().toISOString();
                    request.updated_by = 'system';
                    request.cancel_reason = 'Request expired (>7 hari)';
                    cleanedCount++;
                    console.log(`[CLEANUP] Auto-cancelled expired request ID ${request.id} (created: ${request.created_at})`);
                } else {
                    // Cek apakah status user sudah sesuai dengan pengajuan
                    const user = global.users.find(u => String(u.id) === String(request.userId));
                    if (user && user.paid === request.newStatus) {
                        request.status = 'cancelled_by_system';
                        request.updated_at = new Date().toISOString();
                        request.updated_by = 'system';
                        request.cancel_reason = 'Status pelanggan sudah sesuai dengan pengajuan';
                        cleanedCount++;
                        console.log(`[CLEANUP] Auto-cancelled request ID ${request.id} - status sudah sesuai`);
                    }
                }
            }
        });
        
        if (cleanedCount > 0) {
            saveJSON('database/requests.json', allRequests);
            console.log(`[CLEANUP] Total ${cleanedCount} pending requests dibersihkan.`);
        } else {
            console.log(`[CLEANUP] Tidak ada pending requests yang perlu dibersihkan.`);
        }
    } catch (error) {
        console.error('[CLEANUP_ERROR] Error cleaning up old requests:', error);
    }
}

function startHttpServer() {
    server.listen(PORT, async () => {
        console.log(`[SERVER_START] HTTP server listening on port ${PORT}`);
        if(fs.existsSync(path.join(`sessions/${config.sessionName}`))) {
            console.log("[WA_CONNECT] Session file found, attempting to connect to WhatsApp...");
            connect();
        } else {
            console.log("[WA_CONNECT] No session file found. Please scan the QR code on the admin panel to connect.");
        }
    });
}

async function startApp() {
    // Load ESM modules first
    const { default: makeWASocket, DisconnectReason, useMultiFileAuthState, delay, fetchLatestWaWebVersion } = await import('@whiskeysockets/baileys');

    // Initialize databases and cron tasks
    initializeDatabase().then(() => {
        console.log('[DATABASE] Database initialized successfully');
        initializeAllCronTasks();
        
        // Initialize upload directories
        initializeUploadDirs();
        
        // Initialize topup expiry checker
        const { initTopupExpiryChecker } = require('./lib/topup-expiry');
        initTopupExpiryChecker();
    }).catch(err => {
        console.error('[DATABASE] Failed to initialize database:', err);
    });    
    // Clean up expired speed boost requests
    const { scheduleSpeedBoostCleanup } = require('./lib/speed-boost-cleanup');
    scheduleSpeedBoostCleanup();
    
    if (global.cronConfig) {
        initializeAllCronTasks();
    }

    // Start the HTTP server
    startHttpServer();

    // Define the connect function inside startApp to have access to Baileys modules
    async function connect() {
        let { version, isLatest } = await fetchLatestWaWebVersion();
        console.log(`Using: ${version}, newer: ${isLatest}`);
        const { state, saveCreds: saveState } = await useMultiFileAuthState(`sessions/${config.sessionName}`)
        const raf = makeWASocket({
            version,
            logger: P({ level: 'fatal' }),
            browser: ["RAF BOT MD BETA", "safari", "1.0.0"],
            auth: state
        });
        raf.multi = true
        raf.nopref = false
        raf.prefa = 'anjing'
        raf.mode = 'public'

        // Assign delay to global scope if needed elsewhere
        global.delay = delay;

        raf.ev.on('messages.upsert', async m => {
            if (!m.messages || !m.messages[0]?.message) return;
            msgHandler(raf, m.messages[0], m);
        });

        raf.ev.on('connection.update', async update => {
            const { connection, lastDisconnect } = update
            if (connection === 'open') {
                global.conn = raf;
                global.raf = raf;  // Make raf globally available
                whatsappConnectionState = 'open';
                console.log("WhatsApp connection is open.");
                io.emit('message', 'connected');
            } else if (connection === 'close') {
                whatsappConnectionState = 'close';
                console.log("WhatsApp connection is closed.");
                let reason = lastDisconnect?.error?.output?.statusCode;
                if (reason === DisconnectReason.connectionReplaced) {
                    console.log("Connection Replaced, Another New Session Opened, Please Close Current Session First");
                    raf.logout();
                } else if (reason === DisconnectReason.loggedOut) {
                    console.log(`Device Logged Out, Please Scan Again`);
                    global.conn = null;
                    global.raf = null;  // Clear global.raf too
                    io.emit('message', 'disconnected');
                } else {
                    console.log("Attempting to reconnect...");
                    connect();
                }
            } else if (update.qr) {
                console.log("Please scan QR code");
                // Generate QR string for terminal
                qrcode.toString(update.qr, { type: 'terminal', small: true }, (err, qrString) => {
                    if (err) throw err;
                    console.log(qrString);
                });
                qrcode.toDataURL(update.qr, (err, url) => {
                    io.emit('qr', url);
                });
            } else {
                console.log(update);
            }
        });

        raf.ev.on('creds.update', saveState);
        return raf;
    }

    // Make connect function global so it can be called from API routes
    global.connect = connect;
}

startApp().catch(err => {
    console.error("[FATAL_STARTUP_ERROR] Failed to start the application.", err);
    process.exit(1);
});
