<?php
$current_page = isset($_SERVER['REQUEST_URI']) ? $_SERVER['REQUEST_URI'] : '';
?>
<ul class="navbar-nav bg-gradient-primary sidebar sidebar-dark accordion" id="accordionSidebar">
    <!-- Sidebar - Brand -->
    <a class="sidebar-brand d-flex align-items-center justify-content-center" href="/">
        <div class="sidebar-brand-icon rotate-n-15">
            <i class="fas fa-robot"></i>
        </div>
        <div class="sidebar-brand-text mx-3">RAF BOT<sup>WIFI</sup></div>
    </a>

    <!-- Divider -->
    <hr class="sidebar-divider my-0">

    <!-- Dashboard -->
    <li class="nav-item <?php echo ($current_page == '/' || $current_page == '/index.php') ? 'active' : ''; ?>">
        <a class="nav-link" href="/">
            <i class="fas fa-fw fa-tachometer-alt"></i>
            <span>Dashboard</span>
        </a>
    </li>

    <!-- Divider -->
    <hr class="sidebar-divider">

    <!-- Heading - Pelanggan -->
    <div class="sidebar-heading">
        Pelanggan
    </div>

    <!-- Nav Item - Users -->
    <li class="nav-item <?php echo ($current_page == '/users.php' || $current_page == '/users') ? 'active' : ''; ?>">
        <a class="nav-link" href="/users">
            <i class="fas fa-fw fa-users"></i>
            <span>Data Pelanggan</span>
        </a>
    </li>

    <!-- Nav Item - Packages -->
    <li class="nav-item <?php echo ($current_page == '/packages.php' || $current_page == '/packages') ? 'active' : ''; ?>">
        <a class="nav-link" href="/packages">
            <i class="fas fa-fw fa-box-open"></i>
            <span>Paket Langganan</span>
        </a>
    </li>

    <!-- Nav Item - Package Requests -->
    <li class="nav-item <?php echo ($current_page == '/package-requests.php' || $current_page == '/package-requests') ? 'active' : ''; ?>">
        <a class="nav-link" href="/package-requests">
            <i class="fas fa-fw fa-sync-alt"></i>
            <span>Request Ubah Paket</span>
        </a>
    </li>

    <!-- Divider -->
    <hr class="sidebar-divider">

    <!-- Heading - Pembayaran -->
    <div class="sidebar-heading">
        Pembayaran
    </div>

    <!-- Nav Item - Payment Status -->
    <li class="nav-item <?php echo ($current_page == '/payment-status.php' || $current_page == '/payment-status') ? 'active' : ''; ?>">
        <a class="nav-link" href="/payment-status">
            <i class="fas fa-fw fa-money-check-alt"></i>
            <span>Status Pembayaran</span>
        </a>
    </li>

    <!-- Nav Item - Saldo Management -->
    <li class="nav-item <?php echo ($current_page == '/saldo-management.php' || $current_page == '/saldo-management') ? 'active' : ''; ?>">
        <a class="nav-link" href="/saldo-management">
            <i class="fas fa-fw fa-wallet"></i>
            <span>Saldo & Voucher</span>
        </a>
    </li>

    <!-- Nav Item - Agent Management -->
    <li class="nav-item <?php echo ($current_page == '/agent-management.php' || $current_page == '/agent-management') ? 'active' : ''; ?>">
        <a class="nav-link" href="/agent-management">
            <i class="fas fa-fw fa-store"></i>
            <span>Agent & Outlet</span>
        </a>
    </li>

    <!-- Nav Item - Authorization -->
    <li class="nav-item <?php echo ($current_page == '/pembayaran/otorisasi.php' || $current_page == '/pembayaran/otorisasi') ? 'active' : ''; ?>">
        <a class="nav-link" href="/pembayaran/otorisasi">
            <i class="fas fa-fw fa-user-shield"></i>
            <span>Otorisasi Pembayaran</span>
        </a>
    </li>

    <!-- Nav Item - Transaction -->
    <li class="nav-item <?php echo ($current_page == '/transaction.php' || $current_page == '/transaction') ? 'active' : ''; ?>">
        <a class="nav-link" href="/transaction">
            <i class="fas fa-fw fa-exchange-alt"></i>
            <span>Transaksi</span>
        </a>
    </li>

    <!-- Nav Item - Payment Method -->
    <li class="nav-item <?php echo ($current_page == '/payment-method.php' || $current_page == '/payment-method') ? 'active' : ''; ?>">
        <a class="nav-link" href="/payment-method">
            <i class="fas fa-fw fa-credit-card"></i>
            <span>Metode Pembayaran</span>
        </a>
    </li>

    <!-- Nav Item - Invoice Settings -->
    <li class="nav-item <?php echo ($current_page == '/invoice-settings.php' || $current_page == '/invoice-settings') ? 'active' : ''; ?>">
        <a class="nav-link" href="/invoice-settings">
            <i class="fas fa-fw fa-file-invoice"></i>
            <span>Pengaturan Invoice</span>
        </a>
    </li>

    <!-- Nav Item - Saldo -->
    <li class="nav-item <?php echo ($current_page == '/atm.php' || $current_page == '/atm') ? 'active' : ''; ?>">
        <a class="nav-link" href="/atm">
            <i class="fas fa-fw fa-wallet"></i>
            <span>Saldo</span>
        </a>
    </li>

    <!-- Nav Item - Voucher -->
    <li class="nav-item <?php echo ($current_page == '/voucher.php' || $current_page == '/voucher') ? 'active' : ''; ?>">
        <a class="nav-link" href="/voucher">
            <i class="fas fa-fw fa-ticket-alt"></i>
            <span>Voucher</span>
        </a>
    </li>

    <!-- Divider -->
    <hr class="sidebar-divider">

    <!-- Heading - Layanan -->
    <div class="sidebar-heading">
        Layanan
    </div>

    <!-- Nav Item - Tickets -->
    <li class="nav-item <?php echo ($current_page == '/tiket.php' || $current_page == '/tiket') ? 'active' : ''; ?>">
        <a class="nav-link" href="/tiket">
            <i class="fas fa-fw fa-headset"></i>
            <span>Tiket Support</span>
        </a>
    </li>

    <!-- Nav Item - Speed Requests -->
    <li class="nav-item <?php echo ($current_page == '/speed-requests.php' || $current_page == '/speed-requests') ? 'active' : ''; ?>">
        <a class="nav-link" href="/speed-requests">
            <i class="fas fa-fw fa-rocket"></i>
            <span>Speed Boost Request</span>
        </a>
    </li>

    <!-- Nav Item - Speed Boost Config -->
    <li class="nav-item <?php echo ($current_page == '/speed-boost-config.php' || $current_page == '/speed-boost-config') ? 'active' : ''; ?>">
        <a class="nav-link" href="/speed-boost-config">
            <i class="fas fa-fw fa-tachometer-alt"></i>
            <span>Speed Boost Config</span>
        </a>
    </li>

    <!-- Nav Item - Compensation -->
    <li class="nav-item <?php echo ($current_page == '/kompensasi.php' || $current_page == '/kompensasi') ? 'active' : ''; ?>">
        <a class="nav-link" href="/kompensasi">
            <i class="fas fa-fw fa-gift"></i>
            <span>Kompensasi</span>
        </a>
    </li>

    <!-- Divider -->
    <hr class="sidebar-divider">

    <!-- Heading - Jaringan -->
    <div class="sidebar-heading">
        Jaringan
    </div>

    <!-- Nav Item - Network Map -->
    <li class="nav-item <?php echo ($current_page == '/map-viewer.php' || $current_page == '/map-viewer') ? 'active' : ''; ?>">
        <a class="nav-link" href="/map-viewer">
            <i class="fas fa-fw fa-map-marked-alt"></i>
            <span>Peta Jaringan</span>
        </a>
    </li>

    <!-- Nav Item - Network Assets -->
    <li class="nav-item <?php echo ($current_page == '/network-assets.php' || $current_page == '/network-assets') ? 'active' : ''; ?>">
        <a class="nav-link" href="/network-assets">
            <i class="fas fa-fw fa-boxes"></i>
            <span>Manajemen Aset</span>
        </a>
    </li>

    <!-- Nav Item - Static IP -->
    <li class="nav-item <?php echo ($current_page == '/statik.php' || $current_page == '/statik') ? 'active' : ''; ?>">
        <a class="nav-link" href="/statik">
            <i class="fas fa-fw fa-network-wired"></i>
            <span>IP Statik</span>
        </a>
    </li>

    <!-- Divider -->
    <hr class="sidebar-divider">

    <!-- Heading - Komunikasi -->
    <div class="sidebar-heading">
        Komunikasi
    </div>

    <!-- Nav Item - Broadcast -->
    <li class="nav-item <?php echo ($current_page == '/broadcast.php' || $current_page == '/broadcast') ? 'active' : ''; ?>">
        <a class="nav-link" href="/broadcast">
            <i class="fas fa-fw fa-bullhorn"></i>
            <span>Broadcast WhatsApp</span>
        </a>
    </li>

    <!-- Nav Item - Announcements -->
    <li class="nav-item <?php echo ($current_page == '/announcements.php' || $current_page == '/announcements') ? 'active' : ''; ?>">
        <a class="nav-link" href="/announcements">
            <i class="fas fa-fw fa-volume-up"></i>
            <span>Pengumuman</span>
        </a>
    </li>

    <!-- Nav Item - News -->
    <li class="nav-item <?php echo ($current_page == '/news.php' || $current_page == '/news') ? 'active' : ''; ?>">
        <a class="nav-link" href="/news">
            <i class="fas fa-fw fa-newspaper"></i>
            <span>Berita & Promo</span>
        </a>
    </li>

    <!-- Nav Item - Message Templates -->
    <li class="nav-item <?php echo ($current_page == '/templates.php' || $current_page == '/templates') ? 'active' : ''; ?>">
        <a class="nav-link" href="/templates">
            <i class="fas fa-fw fa-file-alt"></i>
            <span>Template Pesan</span>
        </a>
    </li>

    <!-- Nav Item - WiFi Templates -->
    <li class="nav-item <?php echo ($current_page == '/wifi-templates.php' || $current_page == '/wifi-templates') ? 'active' : ''; ?>">
        <a class="nav-link" href="/wifi-templates">
            <i class="fas fa-fw fa-comments"></i>
            <span>Template Command WiFi</span>
        </a>
    </li>

    <!-- Divider -->
    <hr class="sidebar-divider">

    <!-- Heading - Monitoring -->
    <div class="sidebar-heading">
        Monitoring & Log
    </div>

    <!-- Nav Item - WiFi Logs -->
    <li class="nav-item <?php echo ($current_page == '/wifi-logs.php' || $current_page == '/wifi-logs') ? 'active' : ''; ?>">
        <a class="nav-link" href="/wifi-logs">
            <i class="fas fa-fw fa-wifi"></i>
            <span>Log Perubahan WiFi</span>
        </a>
    </li>

    <!-- Divider -->
    <hr class="sidebar-divider">

    <!-- Heading - Sistem -->
    <div class="sidebar-heading">
        Sistem
    </div>

    <!-- Nav Item - Accounts -->
    <li class="nav-item <?php echo ($current_page == '/accounts.php' || $current_page == '/accounts') ? 'active' : ''; ?>">
        <a class="nav-link" href="/accounts">
            <i class="fas fa-fw fa-users-cog"></i>
            <span>Akun Admin</span>
        </a>
    </li>

    <!-- Nav Item - Config -->
    <li class="nav-item <?php echo ($current_page == '/config.php' || $current_page == '/config') ? 'active' : ''; ?>">
        <a class="nav-link" href="/config">
            <i class="fas fa-fw fa-cogs"></i>
            <span>Konfigurasi</span>
        </a>
    </li>

    <!-- Nav Item - Parameter Management -->
    <li class="nav-item <?php echo ($current_page == '/parameter-management.php' || $current_page == '/parameter-management') ? 'active' : ''; ?>">
        <a class="nav-link" href="/parameter-management">
            <i class="fas fa-fw fa-sliders-h"></i>
            <span>Parameter Management</span>
        </a>
    </li>

    <!-- Nav Item - Cron -->
    <li class="nav-item <?php echo ($current_page == '/cron.php' || $current_page == '/cron') ? 'active' : ''; ?>">
        <a class="nav-link" href="/cron">
            <i class="fas fa-fw fa-clock"></i>
            <span>Cron Jobs</span>
        </a>
    </li>

    <!-- Nav Item - Teknisi Working Hours -->
    <li class="nav-item <?php echo ($current_page == '/teknisi-working-hours.php' || $current_page == '/teknisi-working-hours') ? 'active' : ''; ?>">
        <a class="nav-link" href="/teknisi-working-hours">
            <i class="fas fa-fw fa-business-time"></i>
            <span>Jam Kerja Teknisi</span>
        </a>
    </li>

    <!-- Nav Item - Migrate DB -->
    <li class="nav-item <?php echo ($current_page == '/migrate.php' || $current_page == '/migrate') ? 'active' : ''; ?>">
        <a class="nav-link" href="/migrate">
            <i class="fas fa-fw fa-database"></i>
            <span>Migrasi Database</span>
        </a>
    </li>

    <!-- Divider -->
    <hr class="sidebar-divider d-none d-md-block">

    <!-- Sidebar Toggler (Sidebar) -->
    <div class="text-center d-none d-md-inline">
        <button class="rounded-circle border-0" id="sidebarToggle"></button>
    </div>
</ul>
