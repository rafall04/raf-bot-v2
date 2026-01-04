<!DOCTYPE html>
<html lang="id">

<head>
    <meta charset="utf-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no">
    <title>RAF BOT - Monitoring Pembayaran</title>

    <link href="/vendor/fontawesome-free/css/all.min.css" rel="stylesheet" type="text/css">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <link href="/css/sb-admin-2.min.css" rel="stylesheet">
    <link href="/css/dashboard-modern.css" rel="stylesheet">
    <link href="/vendor/datatables/dataTables.bootstrap4.min.css" rel="stylesheet">
    <style>
        .stats-card {
            border-radius: 10px;
            transition: transform 0.2s;
        }
        .stats-card:hover {
            transform: translateY(-2px);
        }
        .stats-card .card-body {
            padding: 1.25rem;
        }
        .stats-icon {
            width: 50px;
            height: 50px;
            border-radius: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.5rem;
        }
        .stats-value {
            font-size: 1.75rem;
            font-weight: 700;
        }
        .stats-label {
            font-size: 0.85rem;
            color: #6c757d;
        }
        
        /* Status badges */
        .badge-lunas {
            background-color: #28a745;
            color: white;
        }
        .badge-belum {
            background-color: #dc3545;
            color: white;
        }
        
        /* Filter tabs */
        .filter-tabs {
            display: flex;
            gap: 10px;
            margin-bottom: 20px;
            flex-wrap: wrap;
        }
        .filter-tab {
            padding: 8px 16px;
            border-radius: 20px;
            cursor: pointer;
            border: 2px solid #e3e6f0;
            background: white;
            transition: all 0.2s;
            font-weight: 500;
        }
        .filter-tab:hover {
            border-color: #4e73df;
        }
        .filter-tab.active {
            background: #4e73df;
            color: white;
            border-color: #4e73df;
        }
        .filter-tab .count {
            background: rgba(0,0,0,0.1);
            padding: 2px 8px;
            border-radius: 10px;
            margin-left: 5px;
            font-size: 0.8rem;
        }
        .filter-tab.active .count {
            background: rgba(255,255,255,0.2);
        }
        
        /* Table styles */
        .table-payment th {
            background: #f8f9fc;
            font-weight: 600;
            font-size: 0.85rem;
        }
        .table-payment td {
            vertical-align: middle;
        }
        .customer-info {
            display: flex;
            flex-direction: column;
        }
        .customer-name {
            font-weight: 600;
            color: #2e2f37;
        }
        .customer-phone {
            font-size: 0.8rem;
            color: #6c757d;
        }
        .package-badge {
            background: #e7f1ff;
            color: #4e73df;
            padding: 4px 10px;
            border-radius: 15px;
            font-size: 0.8rem;
            font-weight: 500;
        }
        .billing-date {
            font-weight: 500;
        }
        
        /* Action buttons */
        .btn-action {
            padding: 5px 10px;
            font-size: 0.8rem;
        }
</style>
</head>

<body id="page-top">
    <div id="wrapper">
        <?php include '_navbar_teknisi.php'; ?>
        <div id="content-wrapper" class="d-flex flex-column">
            <div id="content">
                <nav class="navbar navbar-expand navbar-light bg-white topbar mb-4 static-top shadow">
                    <button type="button" id="sidebarToggleTop" class="btn btn-link d-md-none rounded-circle mr-3">
                        <i class="fa fa-bars"></i>
                    </button>
                    <ul class="navbar-nav ml-auto">
                        <li class="nav-item dropdown no-arrow">
                            <a class="nav-link dropdown-toggle" href="#" id="userDropdown" role="button"
                                data-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
                                <span id="loggedInTechnicianInfo" class="mr-2 text-gray-600 small">Memuat nama...</span>
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
                    <!-- Page Header -->
                    <div class="d-sm-flex align-items-center justify-content-between mb-4">
                        <h1 class="h3 mb-0 text-gray-800">
                            <i class="fas fa-file-invoice-dollar text-primary"></i> Monitoring Pembayaran
                        </h1>
                        <button class="btn btn-primary btn-sm" id="refreshBtn">
                            <i class="fas fa-sync-alt"></i> Refresh Data
                        </button>
                    </div>

                    <!-- Stats Cards -->
                    <div class="row mb-4">
                        <div class="col-xl-3 col-md-6 mb-3">
                            <div class="card stats-card border-left-primary shadow h-100">
                                <div class="card-body">
                                    <div class="d-flex justify-content-between align-items-center">
                                        <div>
                                            <div class="stats-label text-uppercase">Total Pelanggan</div>
                                            <div class="stats-value text-primary" id="totalCustomers">-</div>
                                        </div>
                                        <div class="stats-icon bg-primary text-white">
                                            <i class="fas fa-users"></i>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="col-xl-3 col-md-6 mb-3">
                            <div class="card stats-card border-left-success shadow h-100">
                                <div class="card-body">
                                    <div class="d-flex justify-content-between align-items-center">
                                        <div>
                                            <div class="stats-label text-uppercase">Sudah Bayar</div>
                                            <div class="stats-value text-success" id="paidCount">-</div>
                                        </div>
                                        <div class="stats-icon bg-success text-white">
                                            <i class="fas fa-check-circle"></i>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="col-xl-3 col-md-6 mb-3">
                            <div class="card stats-card border-left-danger shadow h-100">
                                <div class="card-body">
                                    <div class="d-flex justify-content-between align-items-center">
                                        <div>
                                            <div class="stats-label text-uppercase">Belum Bayar</div>
                                            <div class="stats-value text-danger" id="unpaidCount">-</div>
                                        </div>
                                        <div class="stats-icon bg-danger text-white">
                                            <i class="fas fa-exclamation-circle"></i>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="col-xl-3 col-md-6 mb-3">
                            <div class="card stats-card border-left-warning shadow h-100">
                                <div class="card-body">
                                    <div class="d-flex justify-content-between align-items-center">
                                        <div>
                                            <div class="stats-label text-uppercase">Persentase Lunas</div>
                                            <div class="stats-value text-warning" id="paidPercentage">-</div>
                                        </div>
                                        <div class="stats-icon bg-warning text-white">
                                            <i class="fas fa-percentage"></i>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Filter Tabs -->
                    <div class="filter-tabs">
                        <div class="filter-tab active" data-filter="all">
                            <i class="fas fa-list"></i> Semua
                            <span class="count" id="countAll">0</span>
                        </div>
                        <div class="filter-tab" data-filter="unpaid">
                            <i class="fas fa-times-circle text-danger"></i> Belum Bayar
                            <span class="count" id="countUnpaid">0</span>
                        </div>
                        <div class="filter-tab" data-filter="paid">
                            <i class="fas fa-check-circle text-success"></i> Sudah Bayar
                            <span class="count" id="countPaid">0</span>
                        </div>
                    </div>

                    <!-- Data Table -->
                    <div class="card shadow mb-4">
                        <div class="card-header py-3">
                            <h6 class="m-0 font-weight-bold text-primary">
                                <i class="fas fa-table"></i> Daftar Pelanggan
                            </h6>
                        </div>
                        <div class="card-body">
                            <div class="table-responsive">
                                <table class="table table-bordered table-hover table-payment" id="paymentTable" width="100%">
                                    <thead>
                                        <tr>
                                            <th>ID</th>
                                            <th>Pelanggan</th>
                                            <th>Paket</th>
                                            <th>Tgl Tagihan</th>
                                            <th>Status</th>
                                            <th>Aksi</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <!-- Data will be loaded via JavaScript -->
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <footer class="sticky-footer bg-white">
                <div class="container my-auto">
                    <div class="copyright text-center my-auto">
                        <span>Copyright &copy; RAF BOT 2025</span>
                    </div>
                </div>
            </footer>
        </div>
    </div>

    <a class="scroll-to-top rounded" href="#page-top">
        <i class="fas fa-angle-up"></i>
    </a>

    <!-- Logout Modal -->
    <div class="modal fade" id="logoutModal" tabindex="-1" role="dialog">
        <div class="modal-dialog" role="document">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">Konfirmasi Logout</h5>
                    <button type="button" class="close" data-dismiss="modal">
                        <span>&times;</span>
                    </button>
                </div>
                <div class="modal-body">
                    Apakah Anda yakin ingin logout?
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-dismiss="modal">Batal</button>
                    <a href="/logout" class="btn btn-primary">Logout</a>
                </div>
            </div>
        </div>
    </div>

    <!-- Detail Modal -->
    <div class="modal fade" id="detailModal" tabindex="-1" role="dialog">
        <div class="modal-dialog modal-lg" role="document">
            <div class="modal-content">
                <div class="modal-header bg-primary text-white">
                    <h5 class="modal-title"><i class="fas fa-user"></i> Detail Pelanggan</h5>
                    <button type="button" class="close text-white" data-dismiss="modal">
                        <span>&times;</span>
                    </button>
                </div>
                <div class="modal-body" id="detailModalBody">
                    <!-- Content loaded via JS -->
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-dismiss="modal">Tutup</button>
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

    <script>
        // Global variables
        let allCustomers = [];
        let dataTable = null;
        let currentFilter = 'all';

        // Initialize page
        $(document).ready(function() {
            loadTechnicianInfo();
            loadCustomerData();
            setupEventHandlers();
        });

        // Load technician info
        function loadTechnicianInfo() {
            fetch('/api/teknisi/me', { credentials: 'include' })
                .then(res => res.json())
                .then(data => {
                    if (data.status === 200 && data.data) {
                        $('#loggedInTechnicianInfo').text(data.data.name || 'Teknisi');
                    }
                })
                .catch(err => {
                    console.error('Error loading technician info:', err);
                    $('#loggedInTechnicianInfo').text('Teknisi');
                });
        }

        // Load customer data
        function loadCustomerData() {
            $('#refreshBtn').prop('disabled', true).html('<i class="fas fa-spinner fa-spin"></i> Memuat...');
            
            fetch('/api/users', { credentials: 'include' })
                .then(res => res.json())
                .then(data => {
                    if (data.status === 200 && Array.isArray(data.data)) {
                        allCustomers = data.data;
                        updateStats();
                        renderTable();
                    } else {
                        showAlert('danger', 'Gagal memuat data pelanggan');
                    }
                })
                .catch(err => {
                    console.error('Error loading customers:', err);
                    showAlert('danger', 'Terjadi kesalahan saat memuat data');
                })
                .finally(() => {
                    $('#refreshBtn').prop('disabled', false).html('<i class="fas fa-sync-alt"></i> Refresh Data');
                });
        }

        // Update statistics
        function updateStats() {
            const total = allCustomers.length;
            const paid = allCustomers.filter(c => c.paid === true || c.paid === 1 || c.paid === 'true').length;
            const unpaid = total - paid;
            const percentage = total > 0 ? Math.round((paid / total) * 100) : 0;

            $('#totalCustomers').text(total);
            $('#paidCount').text(paid);
            $('#unpaidCount').text(unpaid);
            $('#paidPercentage').text(percentage + '%');

            // Update filter counts
            $('#countAll').text(total);
            $('#countPaid').text(paid);
            $('#countUnpaid').text(unpaid);
        }

        // Render table
        function renderTable() {
            // Destroy existing DataTable if exists
            if (dataTable) {
                dataTable.destroy();
            }

            // Filter data based on current filter
            let filteredData = allCustomers;
            if (currentFilter === 'paid') {
                filteredData = allCustomers.filter(c => c.paid === true || c.paid === 1 || c.paid === 'true');
            } else if (currentFilter === 'unpaid') {
                filteredData = allCustomers.filter(c => c.paid !== true && c.paid !== 1 && c.paid !== 'true');
            }

            // Build table rows
            const tbody = $('#paymentTable tbody');
            tbody.empty();

            filteredData.forEach(customer => {
                const isPaid = customer.paid === true || customer.paid === 1 || customer.paid === 'true';
                const statusBadge = isPaid 
                    ? '<span class="badge badge-lunas"><i class="fas fa-check"></i> Lunas</span>'
                    : '<span class="badge badge-belum"><i class="fas fa-times"></i> Belum Bayar</span>';
                
                const phoneDisplay = customer.phone_number 
                    ? customer.phone_number.split('|')[0].trim() 
                    : '-';
                
                const billingDate = customer.bulk || '-';
                const packageName = customer.subscription || '-';

                const row = `
                    <tr>
                        <td><strong>${customer.id}</strong></td>
                        <td>
                            <div class="customer-info">
                                <span class="customer-name">${escapeHtml(customer.name)}</span>
                                <span class="customer-phone"><i class="fas fa-phone"></i> ${phoneDisplay}</span>
                            </div>
                        </td>
                        <td><span class="package-badge">${escapeHtml(packageName)}</span></td>
                        <td class="billing-date">Tgl ${billingDate}</td>
                        <td>${statusBadge}</td>
                        <td>
                            <button class="btn btn-info btn-action" onclick="showDetail(${customer.id})" title="Lihat Detail">
                                <i class="fas fa-eye"></i>
                            </button>
                            ${!isPaid ? `
                            <a href="/pembayaran/teknisi?userId=${customer.id}" class="btn btn-success btn-action" title="Request Pembayaran">
                                <i class="fas fa-money-bill-wave"></i>
                            </a>
                            ` : ''}
                        </td>
                    </tr>
                `;
                tbody.append(row);
            });

            // Initialize DataTable
            dataTable = $('#paymentTable').DataTable({
                order: [[0, 'asc']],
                pageLength: 25,
                language: {
                    search: "Cari:",
                    lengthMenu: "Tampilkan _MENU_ data",
                    info: "Menampilkan _START_ - _END_ dari _TOTAL_ data",
                    infoEmpty: "Tidak ada data",
                    infoFiltered: "(difilter dari _MAX_ total data)",
                    zeroRecords: "Tidak ada data yang cocok",
                    paginate: {
                        first: "Pertama",
                        last: "Terakhir",
                        next: "Selanjutnya",
                        previous: "Sebelumnya"
                    }
                },
                responsive: true
            });
        }

        // Setup event handlers
        function setupEventHandlers() {
            // Refresh button
            $('#refreshBtn').on('click', function() {
                loadCustomerData();
            });

            // Filter tabs
            $('.filter-tab').on('click', function() {
                $('.filter-tab').removeClass('active');
                $(this).addClass('active');
                currentFilter = $(this).data('filter');
                renderTable();
            });
        }

        // Show customer detail
        function showDetail(customerId) {
            const customer = allCustomers.find(c => c.id === customerId);
            if (!customer) {
                showAlert('danger', 'Data pelanggan tidak ditemukan');
                return;
            }

            const isPaid = customer.paid === true || customer.paid === 1 || customer.paid === 'true';
            const statusBadge = isPaid 
                ? '<span class="badge badge-success badge-lg"><i class="fas fa-check"></i> LUNAS</span>'
                : '<span class="badge badge-danger badge-lg"><i class="fas fa-times"></i> BELUM BAYAR</span>';

            const phones = customer.phone_number ? customer.phone_number.split('|').map(p => p.trim()).filter(p => p) : [];
            const phoneList = phones.length > 0 
                ? phones.map(p => `<a href="https://wa.me/${p}" target="_blank" class="btn btn-sm btn-success mr-1 mb-1"><i class="fab fa-whatsapp"></i> ${p}</a>`).join('')
                : '<span class="text-muted">Tidak ada nomor</span>';

            const content = `
                <div class="row">
                    <div class="col-md-6">
                        <h6 class="font-weight-bold text-primary mb-3">Informasi Pelanggan</h6>
                        <table class="table table-sm">
                            <tr>
                                <td width="40%"><strong>ID</strong></td>
                                <td>${customer.id}</td>
                            </tr>
                            <tr>
                                <td><strong>Nama</strong></td>
                                <td>${escapeHtml(customer.name)}</td>
                            </tr>
                            <tr>
                                <td><strong>Alamat</strong></td>
                                <td>${escapeHtml(customer.address || '-')}</td>
                            </tr>
                            <tr>
                                <td><strong>Telepon</strong></td>
                                <td>${phoneList}</td>
                            </tr>
                        </table>
                    </div>
                    <div class="col-md-6">
                        <h6 class="font-weight-bold text-primary mb-3">Informasi Langganan</h6>
                        <table class="table table-sm">
                            <tr>
                                <td width="40%"><strong>Paket</strong></td>
                                <td><span class="package-badge">${escapeHtml(customer.subscription || '-')}</span></td>
                            </tr>
                            <tr>
                                <td><strong>Tgl Tagihan</strong></td>
                                <td>Tanggal ${customer.bulk || '-'}</td>
                            </tr>
                            <tr>
                                <td><strong>Status Bayar</strong></td>
                                <td>${statusBadge}</td>
                            </tr>
                            <tr>
                                <td><strong>PPPoE User</strong></td>
                                <td><code>${escapeHtml(customer.pppoe_user || '-')}</code></td>
                            </tr>
                        </table>
                    </div>
                </div>
                ${!isPaid ? `
                <hr>
                <div class="text-center">
                    <a href="/pembayaran/teknisi?userId=${customer.id}" class="btn btn-success">
                        <i class="fas fa-money-bill-wave"></i> Request Pembayaran untuk Pelanggan Ini
                    </a>
                </div>
                ` : ''}
            `;

            $('#detailModalBody').html(content);
            $('#detailModal').modal('show');
        }

        // Helper: Escape HTML
        function escapeHtml(text) {
            if (!text) return '';
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        // Helper: Show alert
        function showAlert(type, message) {
            const alertHtml = `
                <div class="alert alert-${type} alert-dismissible fade show" role="alert">
                    ${message}
                    <button type="button" class="close" data-dismiss="alert">
                        <span>&times;</span>
                    </button>
                </div>
            `;
            $('.container-fluid').prepend(alertHtml);
            setTimeout(() => {
                $('.alert').alert('close');
            }, 5000);
        }
    </script>

    <style>
        /* ===== MOBILE RESPONSIVE STYLES ===== */
        @media (max-width: 768px) {
            .container-fluid {
                padding: 0.75rem;
            }
            
            /* Page Header */
            .d-sm-flex {
                flex-direction: column !important;
                align-items: flex-start !important;
            }
            
            .d-sm-flex .btn {
                width: 100%;
                margin-top: 1rem;
            }
            
            h1.h3 {
                font-size: 1.25rem;
            }
            
            /* Stats cards */
            .stats-card .card-body {
                padding: 1rem;
            }
            
            .stats-value {
                font-size: 1.5rem;
            }
            
            .stats-icon {
                width: 40px;
                height: 40px;
                font-size: 1.2rem;
            }
            
            /* Filter tabs */
            .filter-tabs {
                gap: 8px;
            }
            
            .filter-tab {
                padding: 6px 12px;
                font-size: 0.85rem;
            }
            
            /* Card adjustments */
            .card-body {
                padding: 1rem;
            }
            
            .card-header {
                padding: 0.75rem 1rem;
            }
            
            /* Table */
            .table-responsive {
                font-size: 0.85rem;
            }
            
            .customer-info {
                min-width: 120px;
            }
            
            .btn-action {
                padding: 4px 8px;
                font-size: 0.75rem;
            }
            
            /* Modal */
            .modal-dialog {
                margin: 0.5rem;
                max-width: calc(100% - 1rem);
            }
            
            .modal-body {
                padding: 1rem;
            }
            
            /* Form controls */
            .form-control, select {
                font-size: 16px !important;
            }
        }
        
        @media (max-width: 576px) {
            .container-fluid {
                padding: 0.5rem;
            }
            
            h1.h3 {
                font-size: 1.1rem;
            }
            
            .stats-value {
                font-size: 1.25rem;
            }
            
            .stats-label {
                font-size: 0.75rem;
            }
            
            .stats-icon {
                width: 35px;
                height: 35px;
                font-size: 1rem;
            }
            
            .filter-tab {
                padding: 5px 10px;
                font-size: 0.8rem;
            }
            
            .filter-tab .count {
                padding: 1px 6px;
                font-size: 0.7rem;
            }
            
            .card-body {
                padding: 0.75rem;
            }
            
            .table-responsive {
                font-size: 0.8rem;
            }
            
            .package-badge {
                font-size: 0.7rem;
                padding: 3px 8px;
            }
        }
    </style>
</body>
</html>
