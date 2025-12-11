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
// OPTIMASI: Jangan blocking render dengan API call - load secara async di JavaScript
if ($monitoringEnabled) {
    $wrapperPath = __DIR__ . '/../api-monitoring-wrapper.php';
    if (file_exists($wrapperPath)) {
        require_once $wrapperPath;
        // Jangan panggil getSystemHealth() di sini - ini blocking render!
        // Biarkan JavaScript yang memanggil setelah page load
        $systemHealth = ['error' => false, 'loading' => true];
    } else {
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
            white-space: nowrap;
            overflow: visible;
            text-overflow: clip;
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
            <!-- Topbar dengan alerts custom untuk dashboard -->
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
                    
                    <!-- Nav Item - User (menggunakan logic dari topbar.php) -->
                    <?php
                    // Include topbar logic untuk mendapatkan userName
                    if (session_status() === PHP_SESSION_NONE) {
                        session_start();
                    }
                    $userName = 'User';
                    $role = 'user';
                    $debugInfo = [];
                    
                    // Prioritas 1: Coba ambil dari JWT token (cookie)
                    if (isset($_COOKIE['token']) && !empty($_COOKIE['token'])) {
                        try {
                            $token = $_COOKIE['token'];
                            $parts = explode('.', $token);
                            if (count($parts) === 3 && !empty($parts[1])) {
                                $payloadBase64 = str_replace(['-', '_'], ['+', '/'], $parts[1]);
                                $padding = strlen($payloadBase64) % 4;
                                if ($padding > 0) {
                                    $payloadBase64 .= str_repeat('=', 4 - $padding);
                                }
                                $decoded = base64_decode($payloadBase64, true);
                                if ($decoded !== false) {
                                    $payload = json_decode($decoded, true);
                                    if ($payload && is_array($payload)) {
                                        if (isset($payload['name']) && !empty(trim($payload['name']))) {
                                            $userName = trim($payload['name']);
                                        } elseif (isset($payload['username']) && !empty(trim($payload['username']))) {
                                            $userName = trim($payload['username']);
                                        }
                                        if (isset($payload['role']) && !empty(trim($payload['role']))) {
                                            $role = trim($payload['role']);
                                        }
                                    }
                                }
                            }
                        } catch (Exception $e) {
                            // Fallback ke session
                        }
                    }
                    
                    // Prioritas 2: Ambil dari session
                    if ($userName === 'User' && isset($_SESSION['name']) && !empty(trim($_SESSION['name']))) {
                        $userName = trim($_SESSION['name']);
                    } elseif ($userName === 'User' && isset($_SESSION['username']) && !empty(trim($_SESSION['username']))) {
                        $userName = trim($_SESSION['username']);
                    }
                    ?>
                    <li class="nav-item dropdown no-arrow">
                        <a class="nav-link dropdown-toggle" href="#" id="userDropdown" role="button"
                            data-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
                            <span class="mr-2 d-none d-lg-inline text-gray-600 small" id="topbarUserName"><?php echo htmlspecialchars($userName); ?></span>
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
            <script>
            // Fallback: Fetch dari API jika name masih 'User'
            (function() {
                if (document.getElementById('topbarUserName').textContent === 'User') {
                    fetch('/api/me', { credentials: 'include' })
                        .then(response => response.json())
                        .then(data => {
                            if (data.status === 200 && data.data && data.data.name) {
                                document.getElementById('topbarUserName').textContent = data.data.name;
                            }
                        })
                        .catch(err => console.warn('Failed to fetch user name from API:', err));
                }
            })();
            </script>
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

                <h4 class="dashboard-section-title">Login & Logout History</h4>
                <div class="row">
                    <div class="col-12 mb-4">
                        <div class="card shadow">
                            <div class="card-header py-3 d-flex flex-row align-items-center justify-content-between">
                                <h6 class="m-0 font-weight-bold text-primary">
                                    <i class="fas fa-history me-2"></i>Riwayat Login & Logout
                                </h6>
                                <a href="/login-logs" class="btn btn-sm btn-primary">
                                    <i class="fas fa-external-link-alt me-1"></i>Lihat Semua
                                </a>
                            </div>
                            <div class="card-body">
                                <div class="table-responsive">
                                    <table class="table table-sm table-hover mb-0" id="recentLoginLogsTable">
                                        <thead>
                                            <tr>
                                                <th>Action</th>
                                                <th>Waktu</th>
                                                <th>Username</th>
                                                <th>Role</th>
                                                <th>Status</th>
                                                <th>IP Address</th>
                                            </tr>
                                        </thead>
                                        <tbody id="recentLoginLogsBody">
                                            <tr>
                                                <td colspan="6" class="text-center">
                                                    <div class="spinner-border spinner-border-sm text-primary" role="status">
                                                        <span class="sr-only">Loading...</span>
                                                    </div>
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
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

        const animateCountUp = (elementId, endValue, isCurrency = false, duration = 1000) => {
            const element = document.getElementById(elementId);
            if (!element) return;

            // Hapus spinner jika ada sebelum animasi
            const spinner = element.querySelector('.spinner-border');
            if(spinner) spinner.remove();

            // Jika elemen sudah menampilkan 'N/A' atau 'Error', jangan animasi
            if (element.classList.contains('error-text')) {
                if (typeof endValue === 'string') element.textContent = endValue;
                return;
            }

            let startValue = 0;
            // Coba baca nilai numerik saat ini jika ada, untuk animasi dari nilai tersebut
            const currentText = element.textContent.replace(/[^\d,-]/g, '').replace(',', '.');
            const currentNumericValue = parseFloat(currentText);
            if (!isNaN(currentNumericValue) && element.textContent.trim() !== '') {
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
            if(!el) {
                console.warn(`[DASHBOARD_CARD] Element not found: ${elementId}`);
                return;
            }


            // PENTING: Hapus semua konten (termasuk spinner) sebelum update value
            // Gunakan innerHTML = '' untuk memastikan spinner HTML benar-benar dihapus
            const spinner = el.querySelector('.spinner-border');
            if(spinner) {
                spinner.remove();
            }
            // Juga hapus semua child nodes untuk memastikan tidak ada sisa HTML
            while(el.firstChild) {
                el.removeChild(el.firstChild);
            }

            if(hasError){
                el.textContent = 'N/A';
                el.classList.add('error-text');
                return;
            }
            el.classList.remove('error-text');

            if (typeof value === 'number' && !isNaN(value)) {
                animateCountUp(elementId, value, isCurrency);
            } else { // Untuk status teks seperti "Online", "Offline"
                const textValue = value || 'Loading...';
                // PENTING: Gunakan innerHTML = '' dulu untuk clear, baru set textContent
                // Ini memastikan tidak ada sisa HTML yang tersembunyi
                el.innerHTML = '';
                el.textContent = textValue;
                
                // Force reflow untuk memastikan browser render perubahan
                void el.offsetHeight;
                
                // Double check setelah reflow
                const afterText = el.textContent.trim();
                if (afterText !== textValue) {
                    el.textContent = textValue;
                }
                
                // Jika masih tidak match, force update sekali lagi
                const finalText = el.textContent.trim();
                if (finalText !== textValue && elementId === 'bot_status_value') {
                    el.innerHTML = '';
                    el.textContent = textValue;
                    void el.offsetHeight;
                }
            }
        };

        const cardValueIds = [
            'bot_status_value', 'users_total_value', 'users_paid_value', 'users_unpaid_value',
            'ppp_online_value', 'ppp_offline_value', 'hotspot_total_value', 'hotspot_active_value',
            'total_revenue_value',
            'mikrotik_status_value', // Tambahkan ini
            'genieacs_status_value'  // Tambahkan ini
        ];

        // Flag untuk mencegah multiple calls bersamaan
        let isFetchingDashboard = false;
        
        async function fetchDashboardData() {
            // Prevent multiple simultaneous calls
            if (isFetchingDashboard) {
                return;
            }
            
            isFetchingDashboard = true;
            
            // Hanya show spinner untuk card yang belum punya value valid
            // PENTING: Jangan timpa value yang sudah valid seperti "Online", "Offline", atau angka
            // PENTING: Jangan timpa teks "Checking..." dengan spinner, biarkan sebagai teks
            // PENTING: Jangan timpa "Online" atau "Offline" dengan spinner
            cardValueIds.forEach(id => {
                const el = document.getElementById(id);
                if (!el) return;
                
                const currentText = el.textContent.trim();
                const hasSpinner = el.querySelector('.spinner-border');
                
                // Jangan show spinner jika sudah ada value valid
                const hasValidValue = currentText === 'Online' || 
                                     currentText === 'Offline' || 
                                     currentText === 'Checking...' ||
                                     /^\d/.test(currentText); // Angka (untuk statistik)
                
                // Hanya show spinner jika:
                // 1. Element benar-benar kosong (tidak ada teks dan tidak ada spinner)
                // 2. Sudah ada spinner (untuk maintain spinner yang sudah ada)
                // 3. Value adalah "N/A" atau "Error" (bisa diganti dengan spinner)
                // PENTING: Jangan timpa value yang valid
                const shouldShowSpinner = (!hasValidValue && !currentText && !hasSpinner) || 
                                         hasSpinner ||
                                         (currentText === 'N/A' || currentText === 'Error');
                
                if (shouldShowSpinner) {
                    showLoadingSpinner(id);
                }
            });

            try {
                const response = await fetch('/api/stats', { credentials: 'include' });
                if (!response.ok) {
                    throw new Error(`API request failed with status ${response.status}`);
                }
                const data = await response.json();

                // Update all cards from a single data source
                // PENTING: botStatus harus boolean (true/false), bukan undefined/null
                let botStatusValue = 'Checking...';
                let botStatusHasError = false;
                
                // Pastikan botStatus selalu ter-definisi dengan benar
                // Strict check: hanya true/false yang valid, selain itu tetap "Checking..."
                if (data.botStatus === true || data.botStatus === 1 || data.botStatus === 'true') {
                    botStatusValue = 'Online';
                } else if (data.botStatus === false || data.botStatus === 0 || data.botStatus === 'false') {
                    botStatusValue = 'Offline';
                } else {
                    // Jika undefined/null/unknown, tampilkan "Checking..." sebagai teks
                    botStatusValue = 'Checking...';
                }
                
                // PENTING: Update bot_status_value PERTAMA sebelum card lainnya
                // Ini memastikan tidak ada race condition dengan spinner logic
                
                // Clear spinner dulu jika ada, baru update
                const botStatusEl = document.getElementById('bot_status_value');
                if (botStatusEl) {
                    const spinner = botStatusEl.querySelector('.spinner-border');
                    if (spinner) {
                        spinner.remove();
                    }
                }
                
                // PENTING: Update bot_status_value dengan mekanisme yang lebih agresif
                // Pastikan tidak ada yang menimpa setelah update
                const botStatusElForUpdate = document.getElementById('bot_status_value');
                if (botStatusElForUpdate) {
                    // Clear semua konten dulu
                    botStatusElForUpdate.innerHTML = '';
                    // Set textContent langsung
                    botStatusElForUpdate.textContent = botStatusValue;
                    // Force reflow
                    void botStatusElForUpdate.offsetHeight;
                }
                
                // Juga panggil updateDashboardCard untuk konsistensi
                updateDashboardCard('bot_status_value', botStatusValue, false, botStatusHasError);
                
                // PENTING: Update juga wa-status (monitoring widget) dan elemen lain yang relevan
                const waStatusEl = document.getElementById('wa-status');
                if (waStatusEl) {
                    const waStatusText = botStatusValue === 'Online' ? 'Online' : botStatusValue === 'Offline' ? 'Offline' : 'Checking...';
                    waStatusEl.textContent = waStatusText;
                }
                
                // PENTING: Update semua elemen yang mungkin menampilkan status WhatsApp
                // Cari semua elemen yang mengandung "Checking..." dan update dengan status yang benar
                setTimeout(() => {
                    const allCheckingElements = Array.from(document.querySelectorAll('*')).filter(el => {
                        const text = el.textContent?.trim();
                        return text === 'Checking...' && 
                               el.id !== 'bot_status_value' && 
                               (el.id === 'wa-status' || 
                                el.className?.includes('whatsapp') || 
                                el.className?.includes('bot') ||
                                el.closest('[id*="bot"]') ||
                                el.closest('[id*="whatsapp"]') ||
                                el.closest('[id*="wa"]'));
                    });
                    
                    if (allCheckingElements.length > 0) {
                        allCheckingElements.forEach(el => {
                            const statusText = botStatusValue === 'Online' ? 'Online' : botStatusValue === 'Offline' ? 'Offline' : 'Checking...';
                            el.textContent = statusText;
                        });
                    }
                }, 50);
                
                // PENTING: Final check langsung setelah update untuk memastikan tidak ada yang menimpa
                requestAnimationFrame(() => {
                    const immediateCheck = document.getElementById('bot_status_value');
                    if (immediateCheck && immediateCheck.textContent.trim() !== botStatusValue && botStatusValue !== 'Checking...') {
                        immediateCheck.innerHTML = '';
                        immediateCheck.textContent = botStatusValue;
                        void immediateCheck.offsetHeight;
                    }
                });
                
                // Verify update setelah 100ms dan force update jika masih "Checking..."
                setTimeout(() => {
                    const botStatusElAfter = document.getElementById('bot_status_value');
                    if (botStatusElAfter) {
                        const actualText = botStatusElAfter.textContent.trim();
                        
                        // PENTING: Cek apakah ada elemen lain yang menampilkan "Checking..."
                        const allElementsWithChecking = Array.from(document.querySelectorAll('*')).filter(el => {
                            const text = el.textContent?.trim();
                            return text === 'Checking...' && el.id !== 'bot_status_value';
                        });
                        if (allElementsWithChecking.length > 0) {
                            // PENTING: Update semua elemen yang menampilkan "Checking..." dengan status yang benar
                            allElementsWithChecking.forEach(el => {
                                // Update wa-status jika ada (monitoring widget)
                                if (el.id === 'wa-status') {
                                    const statusText = botStatusValue === 'Online' ? 'Online' : botStatusValue === 'Offline' ? 'Offline' : 'Checking...';
                                    el.textContent = statusText;
                                }
                            });
                        }
                        
                        if (actualText !== botStatusValue && botStatusValue !== 'Checking...') {
                            // Force update dengan menghapus semua child nodes dulu
                            while(botStatusElAfter.firstChild) {
                                botStatusElAfter.removeChild(botStatusElAfter.firstChild);
                            }
                            botStatusElAfter.textContent = botStatusValue;
                            void botStatusElAfter.offsetHeight;
                            
                            // Verify sekali lagi setelah force update
                            setTimeout(() => {
                                const finalText = botStatusElAfter.textContent.trim();
                                if (finalText !== botStatusValue) {
                                    botStatusElAfter.innerHTML = botStatusValue;
                                }
                            }, 50);
                        }
                    }
                }, 100);
                updateDashboardCard('users_total_value', data.users, false, data.users === undefined);
                updateDashboardCard('users_paid_value', data.paidUsers, false, data.paidUsers === undefined);
                updateDashboardCard('users_unpaid_value', data.unpaidUsers, false, data.unpaidUsers === undefined);
                updateDashboardCard('total_revenue_value', data.totalRevenue, true, data.totalRevenue === undefined);

                updateDashboardCard('ppp_online_value', data.pppStats?.online, false, data.pppStats?.online === undefined);
                updateDashboardCard('ppp_offline_value', data.pppStats?.offline, false, data.pppStats?.offline === undefined);

                updateDashboardCard('hotspot_total_value', data.hotspotStats?.total, false, data.hotspotStats?.total === undefined);
                updateDashboardCard('hotspot_active_value', data.hotspotStats?.active, false, data.hotspotStats?.active === undefined);

                // PENTING: Perbaiki logika status Mikrotik dan GenieACS
                // Backend sudah memastikan selalu ada property connected (true/false)
                // Jika status object tidak ada sama sekali → N/A (hasError = true)
                // Jika connected === true → Online
                // Jika connected === false → Offline
                const mikrotikHasError = !data.mikrotikStatus || data.mikrotikStatus.connected === undefined;
                const mikrotikStatusValue = mikrotikHasError ? 'N/A' : (data.mikrotikStatus.connected ? 'Online' : 'Offline');
                updateDashboardCard('mikrotik_status_value', mikrotikStatusValue, false, mikrotikHasError);
                
                const genieacsHasError = !data.genieAcsStatus || data.genieAcsStatus.connected === undefined;
                const genieacsStatusValue = genieacsHasError ? 'N/A' : (data.genieAcsStatus.connected ? 'Online' : 'Offline');
                updateDashboardCard('genieacs_status_value', genieacsStatusValue, false, genieacsHasError);

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
            } finally {
                isFetchingDashboard = false;
            }
        }

        socket.on('qr', (base64) => {
            qrContainerParent.classList.remove('d-none');
            qrImg.src = base64;
            qrImg.style.display = 'block';
        });

        socket.on('message', (msg) => {
            if (msg === 'connected') {
                // Update bot status langsung tanpa fetch ulang (karena sudah tahu statusnya Online)
                updateDashboardCard('bot_status_value', 'Online', false, false);
                // Delay sedikit sebelum fetch ulang untuk memastikan update pertama sudah selesai
                setTimeout(() => {
                    fetchDashboardData();
                }, 500);
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

        // Load Login & Logout History
        function loadRecentLoginLogs() {
            fetch('/api/logs/login?limit=20&offset=0', {
                credentials: 'same-origin',
                headers: {
                    'Accept': 'application/json'
                }
            })
            .then(response => {
                if (response.status === 403) {
                    // If 403, show error message
                    const tbody = document.getElementById('recentLoginLogsBody');
                    if (tbody) {
                        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted small">Akses ditolak. Silakan login ulang.</td></tr>';
                    }
                    return null;
                }
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.json();
            })
            .then(result => {
                const tbody = document.getElementById('recentLoginLogsBody');
                if (!tbody) return;

                if (!result || result.status !== 200 || !result.data) {
                    tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted small">Tidak ada data login/logout logs</td></tr>';
                    return;
                }

                const logs = result.data;
                if (logs.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted small">Belum ada history login/logout</td></tr>';
                    return;
                }

                let html = '';
                logs.forEach(log => {
                    // Determine action type (login or logout)
                    const actionType = log.action_type || (log.logout_time ? 'logout' : 'login');
                    const isLogout = actionType === 'logout';
                    
                    // Use logout_time for logout events, login_time for login events
                    const timeField = isLogout && log.logout_time ? log.logout_time : (log.login_time || log.timestamp);
                    
                    // Format timestamp with Asia/Jakarta timezone
                    const timestamp = timeField ? new Date(timeField).toLocaleString('id-ID', {
                        timeZone: 'Asia/Jakarta',
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit'
                    }) : '-';
                    
                    const success = log.success === 1 || log.success === true;
                    const actionBadgeClass = isLogout ? 'badge-warning' : 'badge-primary';
                    const actionBadgeText = isLogout ? 'Logout' : 'Login';
                    const statusBadgeClass = success ? 'badge-success' : 'badge-danger';
                    const statusBadgeText = success ? 'Success' : 'Failed';
                    const roleBadge = log.role ? `<span class="badge badge-info badge-sm">${log.role}</span>` : '-';
                    
                    html += `
                        <tr>
                            <td><span class="badge ${actionBadgeClass} badge-sm">${actionBadgeText}</span></td>
                            <td class="small">${timestamp}</td>
                            <td><strong>${log.username || '-'}</strong></td>
                            <td>${roleBadge}</td>
                            <td><span class="badge ${statusBadgeClass} badge-sm">${statusBadgeText}</span></td>
                            <td class="small text-muted">${log.ip_address || log.ipAddress || '-'}</td>
                        </tr>
                    `;
                });
                tbody.innerHTML = html;
            })
            .catch(error => {
                console.error('Error loading login/logout logs:', error);
                const tbody = document.getElementById('recentLoginLogsBody');
                if (tbody) {
                    tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted small">Error loading login/logout logs</td></tr>';
                }
            });
        }

        // Load login/logout history on page load
        loadRecentLoginLogs();
        
        // Reload login/logout history every 2 minutes
        setInterval(loadRecentLoginLogs, 2 * 60 * 1000);

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
                    // API response received
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

        // OPTIMASI: Tampilkan default values terlebih dahulu untuk UX yang lebih baik
        // Halaman akan langsung ter-render tanpa menunggu API calls
        // Untuk bot_status_value, set "Checking..." sebagai teks (bukan spinner) agar tidak stuck
        const botStatusEl = document.getElementById('bot_status_value');
        if (botStatusEl && !botStatusEl.textContent.trim()) {
            botStatusEl.textContent = 'Checking...';
        }
        showLoadingSpinner('mikrotik_status_value');
        showLoadingSpinner('genieacs_status_value');
        
        // OPTIMASI: Delay lebih lama untuk memastikan halaman benar-benar ter-render dulu
        // Ini memastikan login response cepat, dashboard load di background
        window.addEventListener('load', () => {
            // Delay 2 detik untuk memastikan halaman sudah fully rendered
            // User akan melihat halaman dulu, data load di background
            setTimeout(() => {
                fetchDashboardData();
            }, 2000);
            
            // Set interval untuk refresh status setiap 5 detik (untuk memastikan status ter-update)
            // Hanya refresh jika masih "Checking..." untuk menghindari flickering
            setInterval(() => {
                const botStatusEl = document.getElementById('bot_status_value');
                if (botStatusEl) {
                    const currentText = botStatusEl.textContent.trim();
                    // Hanya refresh jika masih "Checking..." atau kosong
                    if (currentText === 'Checking...' || !currentText) {
                        fetchDashboardData();
                    }
                }
            }, 5000);
        });
        
        // Refresh dashboard data every 30 seconds (hanya setelah page load)
        let refreshInterval = null;
        window.addEventListener('load', () => {
            refreshInterval = setInterval(() => {
                fetchDashboardData();
            }, 30000);
        });

    </script>
    
    <?php if ($monitoringEnabled): ?>
    <!-- Monitoring Dashboard Scripts -->
    <script src="https://cdn.socket.io/4.5.0/socket.io.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <script src="/static/js/monitoring-controller.js"></script>
    <?php endif; ?>
    
    </body>
</html>