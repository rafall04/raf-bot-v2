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

// Error Recovery and Monitoring System
const ErrorRecovery = require('./lib/error-recovery');
const MonitoringService = require('./lib/monitoring-service');
const AlertSystem = require('./lib/alert-system');

// Initialize recovery systems
global.errorRecovery = new ErrorRecovery();
global.monitoring = new MonitoringService();
global.alertSystem = new AlertSystem();
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
app.use('/img', express.static(path.join(__dirname, 'static/img')));
// Serve temporary files (for payment proofs)
app.use('/temp', express.static(path.join(__dirname, 'temp')));
// Serve uploaded ticket photos
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

// 5. Main Authentication Middleware
app.use(async (req, res, next) => {
    // Skip auth for static files (images, css, js, etc)
    if(req.path.match(/\.(jpg|jpeg|png|gif|svg|css|js|ico|woff|woff2|ttf|eot)$/i)) {
        return next();
    }
    
    // Let PHP engine handle its own files without interference
    if(req.url.match(/.+\.php/)) return next();
    
    // Public paths that don't require authentication (check BEFORE token verification)
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
        '/api/speed-boost/packages',
        '/api/monitoring/live-data',
        '/api/monitoring/traffic-history',
        '/api/monitoring/live',
        '/api/monitoring/health',
        '/api/monitoring/traffic',
        '/api/monitoring/users',
        '/api/monitoring/history',
        '/.well-known/' // Chrome DevTools & browser metadata
    ];
    
    // Check if current path is public FIRST (before token verification)
    if (publicPaths.some(p => req.path.startsWith(p))) {
        return next();
    }
    
    const token = req.cookies?.token || req.headers?.authorization?.replace('Bearer ', '');
    
    // Simple cache to track logged auth (reset every hour)
    if (!global.authLogCache) {
        global.authLogCache = new Set();
        // Clear cache every hour
        setInterval(() => {
            global.authLogCache.clear();
        }, 3600000);
    }
    
    if (token) {
        try {
            const decoded = jwt.verify(token, config.jwt);
            
            // Check if it's an admin/staff token (has 'role' field)
            if (decoded.role) {
                const account = global.accounts.find(acc => String(acc.id) === String(decoded.id));
                if (account) {
                    req.user = account;
                    // Only log first time for this user
                    const cacheKey = `admin_${account.id}`;
                    if (!global.authLogCache.has(cacheKey)) {
                        console.log(`[AUTH] Admin ${account.username} authenticated`);
                        global.authLogCache.add(cacheKey);
                    }
                } else {
                    console.log(`[AUTH_FAIL] Account not found for ID ${decoded.id}. Path: ${req.path}`);
                }
            } 
            // Check if it's a customer token (has 'name' field)
            else if (decoded.name) {
                const customer = global.users.find(u => String(u.id) === String(decoded.id));
                if (customer) {
                    req.customer = customer;
                    // Only log first time for this customer
                    const cacheKey = `customer_${customer.id}`;
                    if (!global.authLogCache.has(cacheKey)) {
                        console.log(`[AUTH] Customer ${customer.name} authenticated`);
                        global.authLogCache.add(cacheKey);
                    }
                } else {
                    console.log(`[AUTH_FAIL] Customer not found for ID ${decoded.id}. Path: ${req.path}`);
                }
            }
        } catch (err) {
            console.log(`[AUTH_ERROR] Invalid token. Error: ${err.message}. Path: ${req.path}`);
        }
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
const monitoringRouter = require('./routes/monitoring-dashboard');
const monitoringDummyRouter = require('./routes/monitoring-dummy');
const monitoringApiRouter = require('./routes/monitoring-api');

// Mount routers - ORDER MATTERS!
// More specific routes should come before general ones
app.use('/', publicApiRouter);
app.use('/', adminApiRouter);
app.use('/api/payment-status', paymentStatusRouter);
app.use('/api/requests', requestsRouter);
app.use('/api/users', usersRouter); // Mount this BEFORE general /api to avoid conflicts
app.use('/api/saldo', saldoRouter); // Mount BEFORE general /api routes
app.use('/api/agents', agentsRouter); // Agent management routes
// Monitoring routes - use API router for PHP endpoints
app.use('/api/monitoring', monitoringApiRouter); // PHP monitoring endpoints
// app.use('/api/monitoring', monitoringRouter); // Node.js monitoring routes (disabled)
// app.use('/api/monitoring', monitoringDummyRouter); // Dummy data (disabled)
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
            
            try {
                // Update monitoring metrics
                global.monitoring.incrementMetric('messages.received');
                
                // Process message
                await msgHandler(raf, m.messages[0], m);
                
                // Track success
                global.monitoring.incrementMetric('messages.sent');
                
            } catch (error) {
                console.error('[MESSAGE_ERROR] Error processing message:', error);
                
                // Update error metrics
                global.monitoring.incrementMetric('messages.failed');
                global.monitoring.logError(error, { context: 'message_processing' });
                
                // Handle error recovery
                const recovery = await global.errorRecovery.handleError(error, { 
                    context: 'message_processing',
                    retryable: true,
                    identifier: `msg_${m.messages[0]?.key?.id || 'unknown'}`
                });
                
                // Retry if suggested
                if (recovery.retry && recovery.delay) {
                    setTimeout(async () => {
                        try {
                            await msgHandler(raf, m.messages[0], m);
                        } catch (retryError) {
                            console.error('[MESSAGE_RETRY_ERROR] Retry failed:', retryError);
                        }
                    }, recovery.delay);
                }
            }
        });

        raf.ev.on('connection.update', async update => {
            const { connection, lastDisconnect, qr } = update
            
            // Update monitoring status
            global.monitoring.updateConnectionStatus('whatsapp', connection);
            
            if (connection === 'open') {
                global.conn = raf;
                global.raf = raf;  // Make raf globally available
                global.whatsappConnectionState = 'open';
                console.log("✅ WhatsApp connection is open.");
                io.emit('message', 'connected');
                
                // Send recovery notification if this was after disconnection
                if (global.wasDisconnected) {
                    await global.alertSystem.sendAlert('info', 'SERVICE_RECOVERED', {
                        service: 'WhatsApp'
                    });
                    global.wasDisconnected = false;
                }
                
            } else if (connection === 'close') {
                global.whatsappConnectionState = 'close';
                global.wasDisconnected = true;
                console.log("❌ WhatsApp connection is closed.");
                
                let reason = lastDisconnect?.error?.output?.statusCode;
                const error = lastDisconnect?.error || new Error('Connection closed');
                error.code = reason || 'CONNECTION_CLOSED';
                
                // Log to monitoring
                global.monitoring.logError(error, { 
                    context: 'whatsapp_connection',
                    reason: reason 
                });
                
                // Check specific disconnect reasons
                if (reason === DisconnectReason.connectionReplaced) {
                    console.log("Connection Replaced, Another New Session Opened, Please Close Current Session First");
                    raf.logout();
                } else if (reason === DisconnectReason.loggedOut) {
                    console.log(`Device Logged Out, Please Scan Again`);
                    global.conn = null;
                    global.raf = null;  // Clear global.raf too
                    io.emit('message', 'disconnected');
                } else {
                    // Handle auto-reconnection through error recovery
                    console.log("Connection lost, initiating recovery...");
                    
                    const recovery = await global.errorRecovery.handleError(error, {
                        context: 'whatsapp_disconnection',
                        retryable: true,
                        identifier: 'whatsapp_connection'
                    });
                    
                    if (recovery.recovered) {
                        console.log("✅ Recovery successful");
                    } else if (recovery.retry && recovery.delay) {
                        console.log(`⏱️ Will retry connection in ${recovery.delay}ms`);
                        setTimeout(() => {
                            connect();
                        }, recovery.delay);
                    } else {
                        console.log("❌ Max reconnection attempts reached");
                        io.emit('message', 'disconnected');
                        
                        // Alert admin about persistent failure
                        await global.alertSystem.sendAlert('critical', 'WHATSAPP_DISCONNECTED', {
                            reason: reason,
                            message: 'Failed to reconnect after multiple attempts'
                        });
                    }
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
                // Debug: Uncomment to see all connection updates
                // console.log(update);
            }
        });

        raf.ev.on('creds.update', saveState);
        return raf;
    }

    // Make connect function global so it can be called from API routes and recovery
    global.connect = connect;
    global.startBot = connect;  // Alias for error recovery system
    global.rafect = connect;    // Alias for API compatibility
}

startApp().catch(err => {
    console.error("[FATAL_STARTUP_ERROR] Failed to start the application.", err);
    process.exit(1);
});
