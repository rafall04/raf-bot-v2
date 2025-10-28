const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();

// Middleware to check user role
function checkRole(allowedRoles) {
    return (req, res, next) => {
        if (!req.user || !allowedRoles.includes(req.user.role)) {
            if (req.user && req.user.role === 'teknisi') {
                return res.status(403).send("Akses ditolak. Halaman ini khusus Administrator.");
            }
            return res.status(403).send("Akses ditolak");
        }
        next();
    };
}

// Public pages (no auth required)
router.get('/login', (req, res) => {
    res.render('sb-admin/login.php');
});

// Main dashboard
router.get('/', (req, res) => {
    res.render('sb-admin/index.php');
});

// Admin-only pages
router.get('/kompensasi', checkRole(['admin', 'owner', 'superadmin']), (req, res) => {
    res.render('sb-admin/kompensasi.php');
});

router.get('/migrate', checkRole(['admin', 'owner', 'superadmin']), (req, res) => {
    res.render('sb-admin/migrate.php');
});

router.get('/wifi-logs', checkRole(['admin', 'owner', 'superadmin']), (req, res) => {
    res.render('sb-admin/wifi-logs.php');
});

router.get('/speed-boost-config', checkRole(['admin', 'owner', 'superadmin']), (req, res) => {
    res.render('sb-admin/speed-boost-config.php');
});

router.get('/agent-management', (req, res) => {
    res.render('sb-admin/agent-management.php');
});

router.get('/admin/daftar-tiket', checkRole(['admin', 'owner', 'superadmin']), (req, res) => {
    res.render('sb-admin/admin-daftar-tiket.php');
});

// Teknisi pages
router.get('/pembayaran/teknisi', (req, res) => {
    res.render('sb-admin/pembayaran/teknisi.php');
});

router.get('/teknisi-tiket', checkRole(['teknisi', 'admin', 'owner', 'superadmin']), (req, res) => {
    res.render('sb-admin/teknisi-tiket.php');
});

router.get('/teknisi-pelanggan', (req, res) => {
    res.render('sb-admin/teknisi-pelanggan.php');
});

router.get('/admin/teknisi-request-paket', checkRole(['admin', 'owner', 'superadmin', 'teknisi']), (req, res) => {
    res.render('sb-admin/teknisi-request-paket.php');
});

// Working Hours page
router.get('/teknisi-working-hours', checkRole(['admin', 'owner', 'superadmin']), (req, res) => {
    res.render('sb-admin/teknisi-working-hours.php');
});

// Payment status page
router.get('/payment-status', (req, res) => {
    res.render('sb-admin/payment-status.php');
});

// View invoice page
router.get('/views/sb-admin/view-invoice.php', (req, res) => {
    res.render('sb-admin/view-invoice.php');
});

// Logout
router.get('/logout', (req, res) => {
    res.cookie("token", "", { httpOnly: true, maxAge: 0, path: "/" });
    return res.redirect("/login");
});

// Generic page handler
router.get('/:type([^.]+)', (req, res) => {
    const { type } = req.params;
    const filePath = path.join(__dirname, '..', 'views', 'sb-admin', `${type}.php`);
    if (fs.existsSync(filePath)) {
        res.render(`sb-admin/${type}.php`);
    } else {
        res.status(404).render('sb-admin/404.php');
    }
});

module.exports = router;
