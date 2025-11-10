const express = require('express');
const axios = require('axios');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const { getSSIDInfo, rebootRouter } = require('../lib/wifi');

const router = express.Router();
const execPromise = util.promisify(exec);

// Middleware to ensure user is authenticated
function ensureAuthenticated(req, res, next) {
    if (!req.user) {
        return res.status(401).json({ status: 401, message: "Unauthorized" });
    }
    next();
}

// GET /api/me
router.get('/me', ensureAuthenticated, (req, res) => {
    if (req.user && req.user.username) {
        res.json({
            status: 200,
            message: "User details fetched successfully.",
            data: {
                id: req.user.id,
                username: req.user.username,
                role: req.user.role
            }
        });
    } else {
        res.status(401).json({ status: 401, message: "Not authenticated or user details not found." });
    }
});

// GET /api/:type/:id?
router.get('/:type/:id?', async (req, res) => {
    const { type, id } = req.params;
    try {
        switch(type){
            case "start":
                if (!global.raf) {
                    if (global.rafect) global.rafect();
                }
                return res.json({ message: !!global.raf ? 'bot is online' : 'starting bot'});
            
            case "stop":
                if(!!global.raf) {
                    global.raf.end();
                    global.raf = null;
                }
                return res.json({ message: 'Bot is offline' });
            
            case "sync-status":
                // Manual sync of WhatsApp connection state
                try {
                    // Check actual connection status
                    let actualState = 'close';
                    
                    if (global.raf && global.raf.user) {
                        actualState = 'open';
                    } else if (global.conn && global.conn.user) {
                        actualState = 'open';
                    }
                    
                    // Update global state if different
                    if (global.whatsappConnectionState !== actualState) {
                        const oldState = global.whatsappConnectionState;
                        global.whatsappConnectionState = actualState;
                        console.log(`[SYNC] State updated: ${oldState} → ${actualState}`);
                    }
                    
                    return res.json({
                        success: true,
                        message: 'WhatsApp state synchronized',
                        status: {
                            connectionState: global.whatsappConnectionState,
                            hasRaf: !!global.raf,
                            hasConn: !!global.conn,
                            hasUser: !!(global.raf?.user || global.conn?.user)
                        }
                    });
                } catch (error) {
                    return res.json({
                        success: false,
                        error: error.message
                    });
                }
            
            case "bot-status":
                // Debug endpoint for checking bot status
                try {
                    const wsState = global.raf?.ws?.readyState || global.raf?.ws?._ws?.readyState;
                    const userInfo = global.conn?.user || global.raf?.user;
                    
                    const statusInfo = {
                        botStatus: false,
                        connectionState: global.whatsappConnectionState,
                        hasRafObject: !!global.raf,
                        hasConnObject: !!global.conn,
                        hasWebSocket: !!(global.raf?.ws),
                        webSocketState: wsState,
                        webSocketStateText: wsState === 0 ? 'CONNECTING' : wsState === 1 ? 'OPEN' : wsState === 2 ? 'CLOSING' : wsState === 3 ? 'CLOSED' : 'UNKNOWN',
                        userInfo: userInfo ? {
                            id: userInfo.id,
                            name: userInfo.name || userInfo.notify || 'Unknown'
                        } : null,
                        timestamp: new Date().toISOString()
                    };
                    
                    // Determine final bot status
                    if (global.whatsappConnectionState === 'open' || wsState === 1 || userInfo) {
                        statusInfo.botStatus = true;
                        
                        // Fix out-of-sync state
                        if (global.whatsappConnectionState !== 'open' && (wsState === 1 || userInfo)) {
                            global.whatsappConnectionState = 'open';
                            console.log('[BOT-STATUS] Fixed out-of-sync connection state');
                        }
                    }
                    
                    return res.json(statusInfo);
                } catch (error) {
                    return res.json({
                        error: error.message,
                        botStatus: false,
                        connectionState: global.whatsappConnectionState
                    });
                }
            
            case "stats":
                try {
                    const totalUsers = global.users.length;
                    const paidUsersCount = global.users.filter(user => user.paid === true || user.paid === 1).length;
                    const unpaidUsers = totalUsers - paidUsersCount;
                    
                    // ORIGINAL LOGIC - JANGAN DIUBAH! INI SUDAH BEKERJA UNTUK WIDGET BAWAH!
                    const botStatus = !!global.raf && global.whatsappConnectionState === 'open';
                    
                    let totalRevenue = 0;
                    if (global.users && global.packages) {
                        const paidUsersList = global.users.filter(user => user.paid === true || user.paid === 1);
                        paidUsersList.forEach(user => {
                            const userPackage = global.packages.find(pkg => pkg.name === user.subscription);
                            if (userPackage && userPackage.price) {
                                const price = parseFloat(userPackage.price);
                                if (!isNaN(price)) {
                                    totalRevenue += price;
                                }
                            }
                        });
                    }
                    const pppPromise = execPromise(`php "${path.join(__dirname, '..', 'views', 'get_ppp_stats.php')}"`).then(({ stdout }) => JSON.parse(stdout)).catch(e => { console.error("[STATS_API_ERROR] PPP Stats failed:", e.message); return { error: true }; });
                    const hotspotPromise = execPromise(`php "${path.join(__dirname, '..', 'views', 'get_hotspot_stats.php')}"`).then(({ stdout }) => JSON.parse(stdout)).catch(e => { console.error("[STATS_API_ERROR] Hotspot Stats failed:", e.message); return { error: true }; });
                    const mikrotikPromise = execPromise(`php "${path.join(__dirname, '..', 'views', 'check_mikrotik_connection.php')}"`).then(({ stdout }) => JSON.parse(stdout)).catch(e => { console.error("[STATS_API_ERROR] Mikrotik check failed:", e.message); return { error: true, connected: false, message: e.message }; });
                    const genieAcsPromise = (async () => {
                        if (!global.config.genieacsBaseUrl) return { connected: false, message: 'Not Configured' };
                        try {
                            await axios.get(`${global.config.genieacsBaseUrl}/devices?projection=_id&limit=1`, { timeout: 3500 });
                            return { connected: true, message: 'Connected' };
                        } catch (error) {
                            console.error("[STATS_API_ERROR] GenieACS check failed:", error.message);
                            return { connected: false, message: error.code || 'Request Failed' };
                        }
                    })();
                    const [pppResult, hotspotResult, mikrotikResult, genieAcsResult] = await Promise.all([pppPromise, hotspotPromise, mikrotikPromise, genieAcsPromise]);
                    return res.json({
                        users: totalUsers,
                        paidUsers: paidUsersCount,
                        unpaidUsers: unpaidUsers,
                        totalRevenue: totalRevenue,
                        botStatus: botStatus,
                        pppStats: pppResult.error ? { online: 'N/A', offline: 'N/A' } : (pppResult.data || pppResult),
                        hotspotStats: hotspotResult.error ? { total: 'N/A', active: 'N/A' } : (hotspotResult.data || hotspotResult),
                        mikrotikStatus: { connected: mikrotikResult.connected, message: mikrotikResult.message || (mikrotikResult.connected ? 'Connected' : 'Offline') },
                        genieAcsStatus: genieAcsResult,
                    });
                } catch (e) {
                    console.error("[STATS_API_FATAL_ERROR] A critical error occurred while fetching dashboard stats:", e);
                    return res.status(500).json({ status: 500, message: "A critical error occurred on the server while gathering dashboard statistics." });
                }
            
            case "ssid":
                const data = await getSSIDInfo(id);
                return res.json({ data });
            
            case "reboot":
                try {
                    await rebootRouter(req.params.id);
                    console.log(`[API_REBOOT] Perintah reboot untuk device ID ${req.params.id} berhasil dikirim.`);
                    return res.status(200).json({ status: 200, message: `Perintah reboot untuk device ID ${req.params.id} berhasil dikirim.` });
                } catch (error) {
                    console.error(`[API_REBOOT_ERROR] Gagal reboot device ${req.params.id}:`, error.response ? error.response.data : error.message);
                    let errorMessage = `Gagal mengirim perintah reboot untuk device ${req.params.id}.`;
                    if (error.response && error.response.data && error.response.data.message) {
                        errorMessage = error.response.data.message;
                    } else if (error.response && typeof error.response.data === 'string' && error.response.data.length > 0 && error.response.data.length < 150) {
                        errorMessage = `Error dari server perangkat: ${error.response.data}`;
                    } else if (error.message) {
                        errorMessage = error.message;
                    }
                    return res.status(500).json({ status: 500, message: errorMessage });
                }
            
            case "requests":
                const currentRequestsFromFile = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'database/requests.json'), 'utf8'));
                let requestsToFilter = currentRequestsFromFile;
                if (req.user && req.user.role === 'teknisi') {
                    requestsToFilter = currentRequestsFromFile.filter(request => request && String(request.requested_by_teknisi_id) === String(req.user.id));
                }
                const validAndMappedRequests = requestsToFilter.reduce((acc, v) => {
                    if (!v || !v.userId) {
                        console.warn(`[API_REQUESTS_SKIP] Melewatkan item permintaan karena tidak valid atau tidak memiliki userId. Item:`, v);
                        return acc;
                    }
                    const findUserPelanggan = global.users.find(u => String(u.id) === String(v.userId));
                    if (!findUserPelanggan) {
                        console.warn(`[API_REQUESTS_SKIP] Melewatkan permintaan ID ${v.id} karena pengguna terkait ID ${v.userId} tidak ditemukan.`);
                        return acc;
                    }
                    const findTeknisiRequestor = global.accounts.find(acc => String(acc.id) === String(v.requested_by_teknisi_id));
                    const findPackageInfo = global.packages.find(p => p.name == findUserPelanggan.subscription);
                    let packagePrice = 0;
                    if (findPackageInfo && findPackageInfo.price && findPackageInfo.price !== "N/A" && !isNaN(parseFloat(findPackageInfo.price))) {
                        packagePrice = parseFloat(findPackageInfo.price);
                    }
                    const mappedRequest = {
                        ...v,
                        requestorName: findTeknisiRequestor?.username || "Teknisi Tidak Diketahui",
                        userName: v.userName || findUserPelanggan.name,
                        packageName: findPackageInfo?.name || "Unknown",
                        packagePrice: packagePrice,
                        updated_by_name: global.accounts.find(adminAcc => String(adminAcc.id) === String(v.updated_by))?.username || "-",
                    };
                    acc.push(mappedRequest);
                    return acc;
                }, []);
                return res.json({ data: validAndMappedRequests.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)) });
            
            case "config":
                return res.json({ data: { ...global.config, ...global.cronConfig } });
            
            case "speed-requests":
                if (!req.user || !['admin', 'owner', 'superadmin'].includes(req.user.role)) {
                    return res.status(403).json({ data: [], message: "Akses ditolak." });
                }
                const sortedRequests = [...global.speed_requests].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
                return res.json({ data: sortedRequests });
            
            case "invoice-settings":
                if (!req.user || !['admin', 'owner', 'superadmin'].includes(req.user.role)) {
                    return res.status(403).json({ message: "Akses ditolak." });
                }
                return res.json(global.config);
            
            case "tickets": {
                let ticketsToReturn = [...global.reports];
                const { status } = req.query;

                if (status) {
                    const allowedStatuses = status.split(',').map(s => s.trim());
                    ticketsToReturn = ticketsToReturn.filter(ticket => allowedStatuses.includes(ticket.status));
                }

                ticketsToReturn.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
                return res.json({ status: 200, message: "Data tiket berhasil diambil.", data: ticketsToReturn });
            }
            
            default:
                return res.json({ data: type == 'users' ? global.users : type == 'packages' ? global.packages : type == 'payment' ? global.payment : type == 'payment-method' ? global.paymentMethod : type == 'statik' ? global.statik : type == 'voucher' ? global.voucher : type == 'atm' ? global.atm : type == 'cron' ? global.cronConfig : type == 'accounts' ? global.accounts : [] })
        }
    } catch (e){
        console.log(e);
        res.json({ status: 500, message: "Internal server error" });
    }
});

module.exports = router;
