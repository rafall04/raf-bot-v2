<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no">
    <meta name="description" content="RAF BOT Saldo & Voucher Management">
    <meta name="author" content="RAF BOT">
    <title>RAF BOT - Manajemen Saldo & Voucher</title>
    
    <link href="/vendor/fontawesome-free/css/all.min.css" rel="stylesheet">
    <link href="https://fonts.googleapis.com/css?family=Nunito:200,300,400,600,700,800,900" rel="stylesheet">
    <link href="/css/sb-admin-2.min.css" rel="stylesheet">
    <link href="/vendor/datatables/dataTables.bootstrap4.min.css" rel="stylesheet">
    <link href="https://cdn.jsdelivr.net/npm/sweetalert2@11/dist/sweetalert2.min.css" rel="stylesheet">
    
    <style>
        .stat-card {
            border-left: 4px solid;
            transition: transform 0.2s;
        }
        .stat-card:hover {
            transform: translateY(-5px);
        }
        .stat-card.primary { border-left-color: #4e73df; }
        .stat-card.success { border-left-color: #1cc88a; }
        .stat-card.info { border-left-color: #36b9cc; }
        .stat-card.warning { border-left-color: #f6c23e; }
        
        .topup-request-card {
            border-left: 3px solid #4e73df;
            margin-bottom: 15px;
            transition: all 0.3s;
        }
        .topup-request-card:hover {
            box-shadow: 0 5px 15px rgba(0,0,0,0.1);
        }
        
        .credit { color: #1cc88a; font-weight: bold; }
        .debit { color: #e74a3b; font-weight: bold; }
    </style>
</head>

<body id="page-top">
    <div id="wrapper">
        <?php include '_navbar.php'; ?>
        
        <div id="content-wrapper" class="d-flex flex-column">
            <div id="content">
                <?php include '_topbar.php'; ?>
                
                <div class="container-fluid">
                    <div class="d-sm-flex align-items-center justify-content-between mb-4">
                        <h1 class="h3 mb-0 text-gray-800">Manajemen Saldo & Voucher</h1>
                        <div>
                            <button class="btn btn-success btn-sm" onclick="showAddSaldoModal()">
                                <i class="fas fa-plus-circle"></i> Tambah Saldo Manual
                            </button>
                        </div>
                    </div>

                    <!-- Statistics Cards -->
                    <div class="row mb-4">
                        <div class="col-xl-3 col-md-6 mb-4">
                            <div class="card stat-card primary shadow h-100 py-2">
                                <div class="card-body">
                                    <div class="row no-gutters align-items-center">
                                        <div class="col mr-2">
                                            <div class="text-xs font-weight-bold text-primary text-uppercase mb-1">
                                                Total Saldo Sistem
                                            </div>
                                            <div class="h5 mb-0 font-weight-bold text-gray-800" id="totalSaldo">
                                                Rp 0
                                            </div>
                                        </div>
                                        <div class="col-auto">
                                            <i class="fas fa-wallet fa-2x text-gray-300"></i>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div class="col-xl-3 col-md-6 mb-4">
                            <div class="card stat-card success shadow h-100 py-2">
                                <div class="card-body">
                                    <div class="row no-gutters align-items-center">
                                        <div class="col mr-2">
                                            <div class="text-xs font-weight-bold text-success text-uppercase mb-1">
                                                User Aktif (Saldo > 0)
                                            </div>
                                            <div class="h5 mb-0 font-weight-bold text-gray-800" id="activeUsers">
                                                0
                                            </div>
                                        </div>
                                        <div class="col-auto">
                                            <i class="fas fa-users fa-2x text-gray-300"></i>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div class="col-xl-3 col-md-6 mb-4">
                            <div class="card stat-card info shadow h-100 py-2">
                                <div class="card-body">
                                    <div class="row no-gutters align-items-center">
                                        <div class="col mr-2">
                                            <div class="text-xs font-weight-bold text-info text-uppercase mb-1">
                                                Topup Pending
                                            </div>
                                            <div class="h5 mb-0 font-weight-bold text-gray-800" id="pendingTopups">
                                                0
                                            </div>
                                        </div>
                                        <div class="col-auto">
                                            <i class="fas fa-clock fa-2x text-gray-300"></i>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div class="col-xl-3 col-md-6 mb-4">
                            <div class="card stat-card warning shadow h-100 py-2">
                                <div class="card-body">
                                    <div class="row no-gutters align-items-center">
                                        <div class="col mr-2">
                                            <div class="text-xs font-weight-bold text-warning text-uppercase mb-1">
                                                Transaksi Hari Ini
                                            </div>
                                            <div class="h5 mb-0 font-weight-bold text-gray-800" id="todayTransactions">
                                                0
                                            </div>
                                        </div>
                                        <div class="col-auto">
                                            <i class="fas fa-exchange-alt fa-2x text-gray-300"></i>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Tabs -->
                    <ul class="nav nav-tabs" role="tablist">
                        <li class="nav-item">
                            <a class="nav-link active" data-toggle="tab" href="#topupRequests">
                                <i class="fas fa-hand-holding-usd"></i> Request Topup
                                <span class="badge badge-danger" id="pendingBadge">0</span>
                            </a>
                        </li>
                        <li class="nav-item">
                            <a class="nav-link" data-toggle="tab" href="#userSaldo">
                                <i class="fas fa-users"></i> Saldo User
                            </a>
                        </li>
                        <li class="nav-item">
                            <a class="nav-link" data-toggle="tab" href="#transactions">
                                <i class="fas fa-history"></i> Riwayat Transaksi
                            </a>
                        </li>
                        <li class="nav-item">
                            <a class="nav-link" data-toggle="tab" href="#vouchers">
                                <i class="fas fa-ticket-alt"></i> Voucher
                            </a>
                        </li>
                    </ul>

                    <!-- Tab Content -->
                    <div class="tab-content">
                        <!-- Topup Requests Tab -->
                        <div id="topupRequests" class="tab-pane fade show active">
                            <div class="card shadow mb-4">
                                <div class="card-header py-3">
                                    <h6 class="m-0 font-weight-bold text-primary">
                                        Request Topup Pending
                                    </h6>
                                </div>
                                <div class="card-body">
                                    <div id="topupRequestsList"></div>
                                </div>
                            </div>
                        </div>

                        <!-- User Saldo Tab -->
                        <div id="userSaldo" class="tab-pane fade">
                            <div class="card shadow mb-4">
                                <div class="card-header py-3">
                                    <h6 class="m-0 font-weight-bold text-primary">
                                        Daftar Saldo User
                                    </h6>
                                </div>
                                <div class="card-body">
                                    <div class="table-responsive">
                                        <table class="table table-bordered" id="saldoTable" width="100%">
                                            <thead>
                                                <tr>
                                                    <th>No</th>
                                                    <th>User ID</th>
                                                    <th>Nama</th>
                                                    <th>Saldo</th>
                                                    <th>Last Update</th>
                                                    <th>Aksi</th>
                                                </tr>
                                            </thead>
                                            <tbody></tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Transactions Tab -->
                        <div id="transactions" class="tab-pane fade">
                            <div class="card shadow mb-4">
                                <div class="card-header py-3">
                                    <h6 class="m-0 font-weight-bold text-primary">
                                        Riwayat Transaksi
                                    </h6>
                                </div>
                                <div class="card-body">
                                    <div class="table-responsive">
                                        <table class="table table-bordered" id="transactionTable" width="100%">
                                            <thead>
                                                <tr>
                                                    <th>ID</th>
                                                    <th>Tanggal</th>
                                                    <th>User</th>
                                                    <th>Tipe</th>
                                                    <th>Jumlah</th>
                                                    <th>Keterangan</th>
                                                    <th>Saldo Akhir</th>
                                                </tr>
                                            </thead>
                                            <tbody></tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Vouchers Tab -->
                        <div id="vouchers" class="tab-pane fade">
                            <div class="card shadow mb-4">
                                <div class="card-header py-3 d-flex justify-content-between align-items-center">
                                    <h6 class="m-0 font-weight-bold text-primary">
                                        Daftar Voucher
                                    </h6>
                                    <button class="btn btn-sm btn-success" onclick="showAddVoucherModal()">
                                        <i class="fas fa-plus"></i> Tambah Voucher
                                    </button>
                                </div>
                                <div class="card-body">
                                    <div class="table-responsive">
                                        <table class="table table-bordered" id="voucherTable" width="100%">
                                            <thead>
                                                <tr>
                                                    <th>Profile</th>
                                                    <th>Nama</th>
                                                    <th>Durasi</th>
                                                    <th>Harga</th>
                                                    <th>Aksi</th>
                                                </tr>
                                            </thead>
                                            <tbody></tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <?php include '_footer.php'; ?>
        </div>
    </div>

    <!-- Add Saldo Modal -->
    <div class="modal fade" id="addSaldoModal" tabindex="-1">
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">Tambah Saldo Manual</h5>
                    <button type="button" class="close" data-dismiss="modal">
                        <span>&times;</span>
                    </button>
                </div>
                <div class="modal-body">
                    <form id="addSaldoForm">
                        <div class="form-group">
                            <label>User ID / No WhatsApp</label>
                            <input type="text" class="form-control" id="addSaldoUserId" required>
                            <small class="form-text text-muted">Format: 628xxx atau 628xxx@s.whatsapp.net</small>
                        </div>
                        <div class="form-group">
                            <label>Jumlah Saldo</label>
                            <input type="number" class="form-control" id="addSaldoAmount" min="1000" required>
                        </div>
                        <div class="form-group">
                            <label>Keterangan</label>
                            <input type="text" class="form-control" id="addSaldoDescription" value="Topup manual by admin">
                        </div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-dismiss="modal">Batal</button>
                    <button type="button" class="btn btn-success" onclick="addSaldoManual()">
                        <i class="fas fa-plus-circle"></i> Tambah Saldo
                    </button>
                </div>
            </div>
        </div>
    </div>

    <!-- Scripts -->
    <script src="/vendor/jquery/jquery.min.js"></script>
    <script src="/vendor/bootstrap/js/bootstrap.bundle.min.js"></script>
    <script src="/vendor/jquery-easing/jquery.easing.min.js"></script>
    <script src="/js/sb-admin-2.min.js"></script>
    <script src="/vendor/datatables/jquery.dataTables.min.js"></script>
    <script src="/vendor/datatables/dataTables.bootstrap4.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
    <script src="/js/saldo-management.js"></script>
</body>
</html>
