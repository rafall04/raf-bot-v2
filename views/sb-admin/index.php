<?php
// Start session
session_start();

// Set default monitoring to disabled 
// User can enable it via environment variable or config
$monitoringEnabled = false;

// Check multiple ways to enable monitoring:
// 1. Check environment variable
if (getenv('MONITORING_ENABLED') === 'true') {
    $monitoringEnabled = true;
}

// 2. Check if config file exists and is readable
$configPath = __DIR__ . '/../../config.json';
if (!$monitoringEnabled && file_exists($configPath) && is_readable($configPath)) {
    $configContent = @file_get_contents($configPath);
    if ($configContent) {
        $config = @json_decode($configContent, true);
        if ($config && isset($config['monitoring']['enabled'])) {
            $monitoringEnabled = $config['monitoring']['enabled'];
        }
    }
}

// 3. For now, FORCE ENABLE for testing (remove this line in production)
$monitoringEnabled = true; // TEMPORARY - REMOVE AFTER TESTING

// Load monitoring API wrapper if enabled
if ($monitoringEnabled) {
    $wrapperPath = __DIR__ . '/../api-monitoring-wrapper.php';
    if (file_exists($wrapperPath)) {
        require_once $wrapperPath;
        $monitoringApi = new MonitoringAPIWrapper($_SESSION['token'] ?? '');
        $systemHealth = $monitoringApi->getSystemHealth();
    } else {
        // Wrapper doesn't exist, but we still enable monitoring with defaults
        $systemHealth = ['error' => false];
    }
}
?>
<!DOCTYPE html>
<html lang="en">

<head>

    <meta charset="utf-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no">
    <meta name="description" content="RAF BOT Dashboard - Premium Edition">
    <meta name="author" content="RAF BOT">

    <title>RAF BOT - Premium Dashboard</title>

    <link href="/vendor/fontawesome-free/css/all.min.css" rel="stylesheet" type="text/css">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <link href="/css/sb-admin-2.min.css" rel="stylesheet">
    <link href="/static/css/monitoring.css" rel="stylesheet">

    <style>
        :root {
            --primary: #6366f1;
            --primary-dark: #4f46e5;
            --success: #10b981;
            --info: #3b82f6;
            --warning: #f59e0b;
            --danger: #ef4444;
            --dark: #1f2937;
            --light: #f9fafb;
            --border-radius: 12px;
        }

        body {
            font-family: 'Inter', sans-serif;
            background: #f3f4f6;
            min-height: 100vh;
        }

        #content-wrapper {
            background: #ffffff;
            min-height: 100vh;
        }

        .topbar {
            background: #ffffff !important;
            border-bottom: 1px solid #e5e7eb;
            box-shadow: 0 1px 3px rgba(0,0,0,0.05) !important;
        }

        .container-fluid {
            padding: 1.5rem;
        }

        /* Section Headers */
        .dashboard-header {
            margin-bottom: 2rem;
        }

        .dashboard-header h1 {
            font-size: 1.875rem;
            font-weight: 700;
            color: var(--dark);
            margin-bottom: 0.25rem;
        }

        .dashboard-header p {
            color: #6b7280;
            font-size: 0.95rem;
        }

        .dashboard-section-title {
            font-weight: 600;
            font-size: 1.125rem;
            color: var(--dark);
            margin-top: 2rem;
            margin-bottom: 1rem;
            position: relative;
            padding-left: 12px;
        }

        .dashboard-section-title::before {
            content: '';
            position: absolute;
            left: 0;
            top: 50%;
            transform: translateY(-50%);
            width: 3px;
            height: 20px;
            background: var(--primary);
            border-radius: 2px;
        }

        /* Modern Cards */
        .dashboard-card {
            background: #ffffff;
            border: 1px solid #e5e7eb;
            border-radius: var(--border-radius);
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
            transition: transform 0.2s ease, box-shadow 0.2s ease;
            overflow: hidden;
            position: relative;
            height: 100%;
        }

        .dashboard-card:hover {
            transform: translateY(-4px);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }

        .dashboard-card .card-body {
            padding: 1.25rem;
            position: relative;
        }

        .dashboard-card .card-content {
            display: flex;
            align-items: center;
            justify-content: space-between;
        }

        .dashboard-card .card-info {
            flex: 1;
        }

        .dashboard-card .card-title-text {
            font-weight: 500;
            font-size: 0.875rem;
            color: #6b7280;
            margin-bottom: 0.5rem;
        }

        .dashboard-card .card-value {
            font-size: 2rem;
            font-weight: 700;
            color: var(--dark);
            line-height: 1;
            margin-bottom: 0.25rem;
        }

        .dashboard-card .card-subtitle {
            font-size: 0.75rem;
            color: #9ca3af;
            display: flex;
            align-items: center;
            gap: 4px;
        }

        .dashboard-card .card-change {
            font-size: 0.75rem;
            font-weight: 500;
            padding: 2px 6px;
            border-radius: 4px;
            display: inline-flex;
            align-items: center;
            gap: 2px;
        }

        .dashboard-card .card-change.positive {
            color: var(--success);
            background: rgba(16, 185, 129, 0.1);
        }

        .dashboard-card .card-change.negative {
            color: var(--danger);
            background: rgba(239, 68, 68, 0.1);
        }

        .dashboard-card .card-icon-container {
            width: 56px;
            height: 56px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 12px;
            background: #f3f4f6;
            transition: background 0.2s ease;
        }

        .dashboard-card:hover .card-icon-container {
            background: #e5e7eb;
        }

        .dashboard-card .card-icon-container i {
            font-size: 1.5rem;
            color: var(--primary);
        }

        /* Card color variants */
        .dashboard-card.card-primary .card-icon-container { background: rgba(99, 102, 241, 0.1); }
        .dashboard-card.card-primary .card-icon-container i { color: var(--primary); }
        
        .dashboard-card.card-success .card-icon-container { background: rgba(16, 185, 129, 0.1); }
        .dashboard-card.card-success .card-icon-container i { color: var(--success); }
        
        .dashboard-card.card-info .card-icon-container { background: rgba(59, 130, 246, 0.1); }
        .dashboard-card.card-info .card-icon-container i { color: var(--info); }
        
        .dashboard-card.card-warning .card-icon-container { background: rgba(245, 158, 11, 0.1); }
        .dashboard-card.card-warning .card-icon-container i { color: var(--warning); }
        
        .dashboard-card.card-danger .card-icon-container { background: rgba(239, 68, 68, 0.1); }
        .dashboard-card.card-danger .card-icon-container i { color: var(--danger); }
        
        .dashboard-card.card-dark .card-icon-container { background: rgba(31, 41, 55, 0.1); }
        .dashboard-card.card-dark .card-icon-container i { color: var(--dark); }

        /* Loading spinner */
        .dashboard-card .card-value .spinner-border {
            width: 2rem;
            height: 2rem;
            border-color: var(--primary);
            border-right-color: transparent;
        }

        /* Error text */
        .dashboard-card .card-value.error-text {
            font-size: 1.5rem;
            color: var(--danger) !important;
        }

        /* Modern Button */
        .btn-primary-custom {
            background: var(--primary);
            color: white !important;
            border: none;
            border-radius: 8px;
            padding: 10px 24px;
            font-weight: 600;
            font-size: 0.95rem;
            box-shadow: 0 2px 8px rgba(99, 102, 241, 0.25);
            transition: all 0.2s ease;
        }

        .btn-primary-custom:hover {
            background: var(--primary-dark);
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(99, 102, 241, 0.35);
            color: white !important;
        }

        .btn-primary-custom i {
            margin-right: 6px;
        }

        /* QR Card */
        .qr-card {
            background: #ffffff;
            border: 1px solid #e5e7eb;
            border-radius: var(--border-radius);
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
            overflow: hidden;
        }

        .qr-card .card-header {
            background: var(--primary);
            color: white;
            border: none;
            padding: 1rem 1.25rem;
            font-weight: 600;
        }

        .qr-card .card-body {
            padding: 1.5rem;
        }

        #qr_img {
            border: 2px solid var(--primary);
            border-radius: 8px;
            padding: 8px;
            background: white;
        }

        .row.match-height > [class*="col-"] {
            display: flex;
            flex-direction: column;
        }

        .row.match-height > [class*="col-"] > .card {
            flex-grow: 1;
        }

        /* Dropdown Notifications/Pengumuman Styling */
        .dropdown-list {
            padding: 0;
            border: none;
            box-shadow: 0 0.15rem 1.75rem 0 rgba(58, 59, 69, 0.15) !important;
            width: 420px;
            max-height: 500px;
            overflow-y: auto;
        }

        .dropdown-list .dropdown-header {
            background-color: var(--primary);
            color: white;
            padding: 0.75rem 1.25rem;
            font-weight: 600;
            font-size: 0.875rem;
            border-bottom: none;
        }

        .dropdown-list .dropdown-item {
            white-space: normal;
            padding: 1rem 1.25rem;
            border-bottom: 1px solid #e3e6f0;
            transition: background-color 0.15s ease;
        }

        .dropdown-list .dropdown-item:hover {
            background-color: #f8f9fc;
        }

        .dropdown-list .dropdown-item:last-of-type {
            border-bottom: none;
        }

        .icon-circle {
            height: 2.5rem;
            width: 2.5rem;
            border-radius: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .icon-circle i {
            font-size: 1rem;
        }

        /* Badge counter */
        .badge-counter {
            position: absolute;
            transform: scale(0.7);
            transform-origin: top right;
            right: 0.25rem;
            margin-top: -0.25rem;
        }

        /* Topbar divider */
        .topbar-divider {
            width: 0;
            border-right: 1px solid #e5e7eb;
            height: calc(4.375rem - 2rem);
            margin: auto 1rem;
        }

        /* Responsive adjustments */
        @media (max-width: 768px) {
            .dashboard-header h1 {
                font-size: 1.8rem;
            }
            
            .dashboard-card .card-value {
                font-size: 2rem;
            }
            
            .dashboard-card .card-icon-container {
                width: 60px;
                height: 60px;
            }
            
            .dashboard-card .card-icon-container i {
                font-size: 1.5rem;
            }
            
            .dropdown-list {
                width: 320px;
            }
        }
    </style>

</head>

<body id="page-top">

    <div id="wrapper">
    <?php include '_navbar.php'; ?>
    <div id="content-wrapper" class="d-flex flex-column">
        <div id="content">
            <nav class="navbar navbar-expand navbar-light bg-white topbar mb-4 static-top shadow-sm">
                <button type="button" id="sidebarToggleTop" class="btn btn-link d-md-none rounded-circle mr-3">
                    <i class="fa fa-bars"></i>
                </button>
                <ul class="navbar-nav ml-auto">
                    
                    <!-- Nav Item - Alerts/Pengumuman -->
                    <li class="nav-item dropdown no-arrow mx-1">
                        <a class="nav-link dropdown-toggle" href="#" id="alertsDropdown" role="button"
                            data-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
                            <i class="fas fa-bell fa-fw"></i>
                            <!-- Counter - Alerts -->
                            <span class="badge badge-danger badge-counter" id="alertCount">0</span>
                        </a>
                        <!-- Dropdown - Pengumuman -->
                        <div class="dropdown-list dropdown-menu dropdown-menu-right shadow animated--grow-in"
                            aria-labelledby="alertsDropdown">
                            <h6 class="dropdown-header">
                                <i class="fas fa-bullhorn"></i> Pengumuman & Notifikasi
                            </h6>
                            <div id="alertsContainer">
                                <!-- Alerts akan di-load via JavaScript -->
                                <a class="dropdown-item text-center small text-gray-500" href="#">
                                    <i class="fas fa-spinner fa-spin"></i> Loading...
                                </a>
                            </div>
                            <a class="dropdown-item text-center small text-gray-500" href="/announcements">
                                <i class="fas fa-eye"></i> Lihat Semua Pengumuman
                            </a>
                        </div>
                    </li>

                    <div class="topbar-divider d-none d-sm-block"></div>
                    
                    <!-- Nav Item - User -->
                    <li class="nav-item dropdown no-arrow">
                        <a class="nav-link dropdown-toggle" href="#" id="userDropdown" role="button"
                            data-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
                            <span class="mr-2 d-none d-lg-inline text-gray-600 small" id="adminUsername">Admin</span>
                            <img class="img-profile rounded-circle" src="/img/undraw_profile.svg">
                        </a>
                        <div class="dropdown-menu dropdown-menu-right shadow animated--grow-in"
                            aria-labelledby="userDropdown">
                            <a class="dropdown-item" href="#" data-toggle="modal" data-target="#logoutModal">
                                <i class="fas fa-sign-out-alt fa-sm fa-fw mr-2 text-gray-400"></i>
                                Logout
                            </a>
                        </div>
                    </li>
                </ul>
            </nav>
            <div class="container-fluid">
                <div class="dashboard-header">
                    <div class="d-flex align-items-center justify-content-between">
                        <div>
                            <h1>Dashboard Overview</h1>
                            <p>Selamat datang di RAF BOT Premium Dashboard</p>
                        </div>
                        <button id="start_btn" type="button" class="btn btn-primary-custom">
                            <i class="fas fa-rocket"></i> Connect BOT
                        </button>
                    </div>
                </div>

                <?php if ($monitoringEnabled): ?>
                    <div id="monitoring-section">
                        <?php 
                        $widgetPath = __DIR__ . '/../monitoring-widget.php';
                        if (file_exists($widgetPath)) {
                            include $widgetPath;
                        } else {
                            echo '<!-- Monitoring widget not found at: ' . $widgetPath . ' -->';
                        }
                        ?>
                    </div>
                <?php else: ?>
                    <!-- Monitoring is disabled -->
                <?php endif; ?>

                <h4 class="dashboard-section-title">System Status</h4>
                <div class="row match-height">
                    <div class="col-xl-4 col-lg-6 col-md-6 col-sm-12 mb-4">
                        <div class="card dashboard-card card-primary" id="card-bot-status">
                            <div class="card-body">
                                <div class="card-content">
                                    <div class="card-info">
                                        <div class="card-title-text">Bot Status</div>
                                        <div class="card-value" id="bot_status_value"></div>
                                        <div class="card-subtitle">
                                            <i class="fas fa-circle" style="font-size: 8px;"></i>
                                            <span>WhatsApp Connection</span>
                                        </div>
                                    </div>
                                    <div class="card-icon-container">
                                        <i class="fas fa-robot"></i>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="col-xl-4 col-lg-6 col-md-6 col-sm-12 mb-4">
                        <div class="card dashboard-card card-info" id="card-mikrotik-status">
                            <div class="card-body">
                                <div class="card-content">
                                    <div class="card-info">
                                        <div class="card-title-text">Mikrotik Status</div>
                                        <div class="card-value" id="mikrotik_status_value"></div>
                                        <div class="card-subtitle">
                                            <i class="fas fa-circle" style="font-size: 8px;"></i>
                                            <span>Network Router</span>
                                        </div>
                                    </div>
                                    <div class="card-icon-container">
                                        <i class="fas fa-network-wired"></i>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="col-xl-4 col-lg-6 col-md-6 col-sm-12 mb-4">
                        <div class="card dashboard-card card-dark" id="card-genieacs-status">
                            <div class="card-body">
                                <div class="card-content">
                                    <div class="card-info">
                                        <div class="card-title-text">GenieACS Status</div>
                                        <div class="card-value" id="genieacs_status_value"></div>
                                        <div class="card-subtitle">
                                            <i class="fas fa-circle" style="font-size: 8px;"></i>
                                            <span>Device Manager</span>
                                        </div>
                                    </div>
                                    <div class="card-icon-container">
                                        <i class="fas fa-server"></i>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <h4 class="dashboard-section-title">User Statistics</h4>
                <div class="row match-height">
                    <div class="col-xl-4 col-lg-4 col-md-6 col-sm-12 mb-4">
                        <div class="card dashboard-card card-success" id="card-users-total">
                            <div class="card-body">
                                <div class="card-content">
                                    <div class="card-info">
                                        <div class="card-title-text">Total Users</div>
                                        <div class="card-value" id="users_total_value"></div>
                                        <div class="card-subtitle">
                                            <span class="card-change positive">
                                                <i class="fas fa-arrow-up"></i> Active
                                            </span>
                                        </div>
                                    </div>
                                    <div class="card-icon-container">
                                        <i class="fas fa-users"></i>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="col-xl-4 col-lg-4 col-md-6 col-sm-12 mb-4">
                        <div class="card dashboard-card card-info" id="card-users-paid">
                            <div class="card-body">
                                <div class="card-content">
                                    <div class="card-info">
                                        <div class="card-title-text">Paid Users</div>
                                        <div class="card-value" id="users_paid_value"></div>
                                        <div class="card-subtitle">
                                            <span class="card-change positive">
                                                <i class="fas fa-check-circle"></i> Lunas
                                            </span>
                                        </div>
                                    </div>
                                    <div class="card-icon-container">
                                        <i class="fas fa-user-check"></i>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="col-xl-4 col-lg-4 col-md-6 col-sm-12 mb-4">
                        <div class="card dashboard-card card-warning" id="card-users-unpaid">
                            <div class="card-body">
                                <div class="card-content">
                                    <div class="card-info">
                                        <div class="card-title-text">Unpaid Users</div>
                                        <div class="card-value" id="users_unpaid_value"></div>
                                        <div class="card-subtitle">
                                            <span class="card-change negative">
                                                <i class="fas fa-clock"></i> Pending
                                            </span>
                                        </div>
                                    </div>
                                    <div class="card-icon-container">
                                        <i class="fas fa-user-clock"></i>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <h4 class="dashboard-section-title">Statistik PPPoE</h4>
                <div class="row match-height">
                    <div class="col-xl-6 col-lg-6 col-md-6 col-sm-12 mb-4">
                        <div class="card dashboard-card card-success" id="card-ppp-online">
                            <div class="card-body">
                                <div class="card-content">
                                    <div class="card-info">
                                        <div class="card-title-text">PPPoE Online</div>
                                        <div class="card-value" id="ppp_online_value"></div>
                                        <div class="card-subtitle">
                                            <i class="fas fa-circle text-success" style="font-size: 8px;"></i>
                                            <span>Connected</span>
                                        </div>
                                    </div>
                                    <div class="card-icon-container">
                                        <i class="fas fa-plug"></i>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="col-xl-6 col-lg-6 col-md-6 col-sm-12 mb-4" data-aos="fade-up" data-aos-delay="200">
                        <div class="card dashboard-card card-dark" id="card-ppp-offline">
                            <div class="card-body">
                                <div class="card-content">
                                    <div class="card-info">
                                        <div class="card-title-text">PPPoE Offline</div>
                                        <div class="card-value" id="ppp_offline_value"></div>
                                        <div class="card-subtitle">
                                            <i class="fas fa-circle text-secondary" style="font-size: 8px;"></i>
                                            <span>Disconnected</span>
                                        </div>
                                    </div>
                                    <div class="card-icon-container">
                                        <i class="fas fa-user-slash"></i>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <h4 class="dashboard-section-title">Statistik Hotspot</h4>
                <div class="row match-height">
                    <div class="col-xl-6 col-lg-6 col-md-6 col-sm-12 mb-4">
                        <div class="card dashboard-card card-primary" id="card-hotspot-total">
                            <div class="card-body">
                                <div class="card-content">
                                    <div class="card-info">
                                        <div class="card-title-text">Hotspot Users</div>
                                        <div class="card-value" id="hotspot_total_value"></div>
                                        <div class="card-subtitle">
                                            <i class="fas fa-wifi" style="font-size: 10px;"></i>
                                            <span>Total Registered</span>
                                        </div>
                                    </div>
                                    <div class="card-icon-container">
                                        <i class="fas fa-wifi"></i>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="col-xl-6 col-lg-6 col-md-6 col-sm-12 mb-4" data-aos="fade-up" data-aos-delay="200">
                        <div class="card dashboard-card card-danger" id="card-hotspot-active">
                            <div class="card-body">
                                <div class="card-content">
                                    <div class="card-info">
                                        <div class="card-title-text">Hotspot Online</div>
                                        <div class="card-value" id="hotspot_active_value"></div>
                                        <div class="card-subtitle">
                                            <i class="fas fa-signal" style="font-size: 10px;"></i>
                                            <span>Active Now</span>
                                        </div>
                                    </div>
                                    <div class="card-icon-container">
                                        <i class="fas fa-broadcast-tower"></i>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <h4 class="dashboard-section-title">Ringkasan Pendapatan</h4>
                <div class="row match-height">
                     <div class="col-xl-4 col-lg-6 col-md-6 col-sm-12 mb-4">
                        <div class="card dashboard-card card-danger" id="card-total-revenue">
                            <div class="card-body">
                                <div class="card-content">
                                    <div class="card-info">
                                        <div class="card-title-text">Pendapatan PPPoE Bulanan</div>
                                        <div class="card-value" id="total_revenue_value"></div>
                                        <div class="card-subtitle">
                                            <span class="card-change positive">
                                                <i class="fas fa-chart-line"></i> Revenue
                                            </span>
                                        </div>
                                    </div>
                                    <div class="card-icon-container">
                                        <i class="fas fa-coins"></i>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="row d-none mt-4" id="qr_container_parent">
                    <div class="col-xl-4 col-lg-5">
                        <div class="card qr-card mb-4">
                            <div class="card-header py-3 d-flex flex-row align-items-center justify-content-between">
                                <h6 class="m-0 font-weight-bold">Scan QR to Connect WhatsApp</h6>
                            </div>
                            <div class="card-body text-center">
                                <img src="" alt="WhatsApp QR Code" class="img-fluid" id="qr_img" style="max-height: 300px;">
                                <p class="mt-3 text-muted">Arahkan kamera WhatsApp Anda ke layar ini</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <footer class="sticky-footer bg-white">
                <div class="container my-auto">
                    <div class="copyright text-center my-auto">
                        <span>Copyright &copy; RAF BOT <script>document.write(new Date().getFullYear())</script></span>
                    </div>
                </div>
            </footer>
        </div>
    </div>

    <a class="scroll-to-top rounded" href="#page-top"><i class="fas fa-angle-up"></i></a>

    <div class="modal fade" id="logoutModal" tabindex="-1" role="dialog" aria-labelledby="exampleModalLabel"
        aria-hidden="true">
        <div class="modal-dialog modal-dialog-centered" role="document">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title" id="exampleModalLabel">Ready to Leave?</h5>
                    <button class="close" type="button" data-dismiss="modal" aria-label="Close">
                        <span aria-hidden="true">×</span>
                    </button>
                </div>
                <div class="modal-body">Select "Logout" below if you are ready to end your current session.</div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" type="button" data-dismiss="modal">Cancel</button>
                    <a class="btn btn-primary" href="/logout">Logout</a>
                </div>
            </div>
        </div>
    </div>

    <script src="/vendor/jquery/jquery.min.js"></script>
    <script src="/vendor/bootstrap/js/bootstrap.bundle.min.js"></script>
    <script src="/vendor/jquery-easing/jquery.easing.min.js"></script>
    <script src="/js/sb-admin-2.js"></script>
    <script src="/socket.io/socket.io.js"></script>

    <script>
        const socket = io();
        const startBtn = document.getElementById('start_btn');
        const qrImg = document.getElementById('qr_img');
        const qrContainerParent = document.getElementById('qr_container_parent');

        const showLoadingSpinner = (elementId) => {
            const el = document.getElementById(elementId);
            if (el) {
                el.innerHTML = `<div class="spinner-border spinner-border-sm" role="status"><span class="sr-only">Loading...</span></div>`;
            }
        };

        const animateCountUp = (elementId, endValue, isCurrency = false, duration = 1000) => { // Durasi dipercepat sedikit
            const element = document.getElementById(elementId);
            if (!element) return;

            // Jika elemen sudah menampilkan 'N/A' atau 'Error', jangan animasi
            if (element.classList.contains('error-text')) {
                if (typeof endValue === 'string') element.textContent = endValue;
                return;
            }

            let startValue = 0;
            // Coba baca nilai numerik saat ini jika ada, untuk animasi dari nilai tersebut
            const currentText = element.textContent.replace(/[^\d,-]/g, '').replace(',', '.');
            const currentNumericValue = parseFloat(currentText);
            if (!isNaN(currentNumericValue) && element.textContent.trim() !== '' && !element.querySelector('.spinner-border')) {
                startValue = currentNumericValue;
            }


            const startTime = Date.now();

            const formatValue = (value) => {
                if (isCurrency) {
                    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value);
                }
                return Math.round(value).toLocaleString('id-ID');
            };

            if (typeof endValue !== 'number' || isNaN(endValue)) {
                 element.textContent = endValue;
                 if(endValue === 'N/A' || endValue === 'Error') element.classList.add('error-text');
                 else element.classList.remove('error-text');
                 return;
            }
            element.classList.remove('error-text');


            function updateCount() {
                const now = Date.now();
                const progress = Math.min(1, (now - startTime) / duration);
                let currentValue = startValue + (endValue - startValue) * progress;

                if (!isCurrency && Number.isInteger(startValue) && Number.isInteger(endValue)) {
                    currentValue = Math.round(currentValue);
                }

                element.textContent = formatValue(currentValue);

                if (progress < 1) {
                    requestAnimationFrame(updateCount);
                } else {
                    element.textContent = formatValue(endValue);
                }
            }
            requestAnimationFrame(updateCount);
        };

        const updateDashboardCard = (elementId, value, isCurrency = false, hasError = false) => {
            const el = document.getElementById(elementId);
            if(!el) return;

            if(hasError){
                el.textContent = 'N/A';
                el.classList.add('error-text'); // Tambahkan class untuk styling error
                // Hapus spinner jika ada
                const spinner = el.querySelector('.spinner-border');
                if(spinner) spinner.remove();
                return;
            }
            el.classList.remove('error-text'); // Hapus class error jika tidak error

            if (typeof value === 'number' && !isNaN(value)) {
                animateCountUp(elementId, value, isCurrency);
            } else { // Untuk status teks seperti "Online", "Offline"
                 el.textContent = value;
            }
        };

        const cardValueIds = [
            'bot_status_value', 'users_total_value', 'users_paid_value', 'users_unpaid_value',
            'ppp_online_value', 'ppp_offline_value', 'hotspot_total_value', 'hotspot_active_value',
            'total_revenue_value',
            'mikrotik_status_value', // Tambahkan ini
            'genieacs_status_value'  // Tambahkan ini
        ];

        async function fetchDashboardData() {
            console.log("Fetching consolidated dashboard data...");
            cardValueIds.forEach(id => showLoadingSpinner(id));

            try {
                const response = await fetch('/api/stats', { credentials: 'include' });
                if (!response.ok) {
                    throw new Error(`API request failed with status ${response.status}`);
                }
                const data = await response.json();
                console.log("Consolidated data received:", data);

                // Update all cards from a single data source
                updateDashboardCard('bot_status_value', data.botStatus ? 'Online' : 'Offline', false, data.botStatus === undefined);
                updateDashboardCard('users_total_value', data.users, false, data.users === undefined);
                updateDashboardCard('users_paid_value', data.paidUsers, false, data.paidUsers === undefined);
                updateDashboardCard('users_unpaid_value', data.unpaidUsers, false, data.unpaidUsers === undefined);
                updateDashboardCard('total_revenue_value', data.totalRevenue, true, data.totalRevenue === undefined);

                updateDashboardCard('ppp_online_value', data.pppStats?.online, false, data.pppStats?.online === undefined);
                updateDashboardCard('ppp_offline_value', data.pppStats?.offline, false, data.pppStats?.offline === undefined);

                updateDashboardCard('hotspot_total_value', data.hotspotStats?.total, false, data.hotspotStats?.total === undefined);
                updateDashboardCard('hotspot_active_value', data.hotspotStats?.active, false, data.hotspotStats?.active === undefined);

                updateDashboardCard('mikrotik_status_value', data.mikrotikStatus?.connected ? 'Online' : 'Offline', false, data.mikrotikStatus?.connected === undefined);
                updateDashboardCard('genieacs_status_value', data.genieAcsStatus?.connected ? 'Online' : 'Offline', false, data.genieAcsStatus?.connected === undefined);

                 // Optional: Show toast notifications for offline systems
                if (!data.mikrotikStatus?.connected && typeof $ !== 'undefined' && $.fn.Toasts) {
                    $(document).Toasts('create', {
                        class: 'bg-warning',
                        title: 'Mikrotik Status',
                        body: data.mikrotikStatus.message || 'Could not connect.',
                        autohide: true, delay: 7000, icon: 'fas fa-exclamation-triangle'
                    });
                }
                if (!data.genieAcsStatus?.connected && typeof $ !== 'undefined' && $.fn.Toasts) {
                     $(document).Toasts('create', {
                        class: 'bg-warning',
                        title: 'GenieACS Status',
                        body: data.genieAcsStatus.message || 'Could not connect.',
                        autohide: true, delay: 7000, icon: 'fas fa-exclamation-triangle'
                    });
                }


            } catch (error) {
                console.error("Fatal error fetching or processing dashboard data:", error);
                cardValueIds.forEach(id => {
                    const isCurrency = id === 'total_revenue_value';
                    updateDashboardCard(id, 'Error', isCurrency, true);
                });
                if (typeof $ !== 'undefined' && $.fn.Toasts) {
                    $(document).Toasts('create', {
                        class: 'bg-danger',
                        title: 'Dashboard Error',
                        body: 'Could not load dashboard data. Please check the connection and try again.',
                        autohide: true,
                        delay: 7000,
                        icon: 'fas fa-times-circle'
                    });
                }
            }
        }

        socket.on('qr', (base64) => {
            qrContainerParent.classList.remove('d-none');
            qrImg.src = base64;
            qrImg.style.display = 'block';
        });

        socket.on('message', (msg) => {
            console.log("Socket message:", msg);
            if (msg === 'connected') {
                fetchDashboardData();
                qrContainerParent.classList.add('d-none');
                if (typeof $ !== 'undefined' && $.fn.Toasts) {
                    $(document).Toasts('create', {
                        class: 'bg-success',
                        title: 'BOT Connected',
                        body: 'WhatsApp BOT berhasil terhubung.',
                        autohide: true,
                        delay: 5000,
                        icon: 'fas fa-check-circle'
                    });
                } else {
                    alert('BOT Connected: WhatsApp BOT berhasil terhubung.');
                }
            } else if (msg === 'disconnected' || msg === 'close') {
                 updateDashboardCard('bot_status_value', 'Offline', false, false); // Set to Offline, no error
                 if (typeof $ !== 'undefined' && $.fn.Toasts) {
                     $(document).Toasts('create', {
                        class: 'bg-danger',
                        title: 'BOT Disconnected',
                        body: 'WhatsApp BOT telah terputus.',
                        autohide: true,
                        delay: 5000,
                        icon: 'fas fa-times-circle'
                    });
                 } else {
                    alert('BOT Disconnected: WhatsApp BOT telah terputus.');
                 }
            }
        });

        // Load Pengumuman/Notifications
        function loadAnnouncements() {
            fetch('/api/announcements/recent?limit=5')
                .then(response => response.json())
                .then(data => {
                    const container = document.getElementById('alertsContainer');
                    const countBadge = document.getElementById('alertCount');
                    
                    if (data.success && data.data && data.data.length > 0) {
                        const announcements = data.data;
                        countBadge.textContent = announcements.length;
                        countBadge.style.display = 'inline-block';
                        
                        let html = '';
                        announcements.forEach(item => {
                            const date = new Date(item.created_at).toLocaleDateString('id-ID', { 
                                day: 'numeric', 
                                month: 'short', 
                                year: 'numeric' 
                            });
                            
                            // Jika ada gambar, tampilkan gambar thumbnail
                            const imageHtml = item.image 
                                ? `<img src="${item.image}" alt="Pengumuman" style="width: 50px; height: 50px; object-fit: cover; border-radius: 8px;">`
                                : `<div class="icon-circle bg-primary" style="width: 50px; height: 50px; display: flex; align-items: center; justify-content: center;">
                                       <i class="fas fa-bullhorn text-white"></i>
                                   </div>`;
                            
                            html += `
                                <a class="dropdown-item d-flex align-items-center" href="/announcements">
                                    <div class="mr-3">
                                        ${imageHtml}
                                    </div>
                                    <div style="flex: 1; min-width: 0;">
                                        <div class="small text-gray-500 mb-1">${date}</div>
                                        <span class="font-weight-bold" style="display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; line-height: 1.4;">${item.title || item.message}</span>
                                    </div>
                                </a>
                            `;
                        });
                        
                        container.innerHTML = html;
                    } else {
                        countBadge.style.display = 'none';
                        container.innerHTML = `
                            <a class="dropdown-item text-center small text-gray-500" href="#">
                                <i class="fas fa-inbox"></i> Tidak ada pengumuman terbaru
                            </a>
                        `;
                    }
                })
                .catch(error => {
                    console.error('Error loading announcements:', error);
                    document.getElementById('alertsContainer').innerHTML = `
                        <a class="dropdown-item text-center small text-gray-500" href="#">
                            <i class="fas fa-exclamation-triangle"></i> Gagal memuat pengumuman
                        </a>
                    `;
                });
        }
        
        // Load announcements on page load
        loadAnnouncements();
        
        // Reload announcements every 5 minutes
        setInterval(loadAnnouncements, 5 * 60 * 1000);

        startBtn.addEventListener("click", () => {
            startBtn.disabled = true;
            startBtn.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Connecting...`;
            fetch('/api/start', { credentials: 'include' })
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`Start API error! Status: ${response.status}`);
                    }
                    return response.json();
                })
                .then(data => {
                    console.log("Start API response:", data.message);
                })
                .catch(error => {
                    console.error("Error starting bot:", error);
                    if (typeof $ !== 'undefined' && $.fn.Toasts) {
                        $(document).Toasts('create', {
                            class: 'bg-danger',
                            title: 'Connection Error',
                            body: 'Gagal memulai koneksi BOT. Cek konsol.',
                            autohide: true,
                            delay: 5000,
                            icon: 'fas fa-exclamation-triangle'
                        });
                    } else {
                        alert('Connection Error: Gagal memulai koneksi BOT. Cek konsol.');
                    }
                })
                .finally(() => {
                    startBtn.disabled = false;
                    startBtn.innerHTML = `<i class="fas fa-rocket"></i> Connect BOT`;
                });
        });

        // Panggil fetchDashboardData saat halaman pertama kali dimuat
        fetchDashboardData();
        
        // Refresh dashboard data every 30 seconds
        setInterval(() => {
            fetchDashboardData();
        }, 30000);

    </script>
    
    <?php if ($monitoringEnabled): ?>
    <!-- Monitoring Dashboard Scripts -->
    <script src="https://cdn.socket.io/4.5.0/socket.io.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <script src="/static/js/monitoring-controller.js"></script>
    <?php endif; ?>
    
    </body>
</html>