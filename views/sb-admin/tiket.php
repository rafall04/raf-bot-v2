<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="utf-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no">
    <meta name="description" content="RAF BOT Ticket Management">
    <meta name="author" content="RAF BOT">
    <title>RAF BOT - Ticket Management</title>
    
    <link href="/vendor/fontawesome-free/css/all.min.css" rel="stylesheet" type="text/css">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <link href="/css/sb-admin-2.min.css" rel="stylesheet">
    <link href="/vendor/datatables/dataTables.bootstrap4.min.css" rel="stylesheet">
    <link href="https://cdn.jsdelivr.net/npm/select2@4.1.0-rc.0/dist/css/select2.min.css" rel="stylesheet" />
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/select2-bootstrap-theme/0.1.0-beta.10/select2-bootstrap.min.css" />
    <link href="/css/dashboard-modern.css" rel="stylesheet">

    <style>
        .ticket-details-admin { font-size: 0.8rem; white-space: pre-wrap; max-width: 250px; overflow-wrap: break-word; }
        .report-text-admin { font-size: 0.85rem; white-space: pre-wrap; max-width: 300px; overflow-wrap: break-word; }
        th, td { font-size: 0.85rem; }
        .action-buttons-admin .btn { margin-bottom: 5px; margin-right: 5px; }
        .modal-body { max-height: calc(100vh - 210px); overflow-y: auto; }
        
        /* Status badges per TICKET_STATUS_STANDARD.md */
        .badge-status-baru { background: #6f42c1; color: #fff; }
        .badge-status-process { background: #17a2b8; color: #fff; }
        .badge-status-otw { background: #ffc107; color: #000; }
        .badge-status-arrived { background: #fd7e14; color: #fff; }
        .badge-status-working { background: #20c997; color: #fff; }
        .badge-status-resolved { background: #28a745; color: #fff; }
        .badge-status-cancelled { background: #6c757d; color: #fff; }
        
        /* Photo Gallery Styles */
        .photo-gallery {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
            margin-top: 15px;
        }
        .photo-thumbnail {
            width: 150px;
            height: 150px;
            border: 2px solid #ddd;
            border-radius: 5px;
            overflow: hidden;
            cursor: pointer;
            position: relative;
        }
        .photo-thumbnail img {
            width: 100%;
            height: 100%;
            object-fit: cover;
            transition: transform 0.3s;
        }
        .photo-thumbnail:hover img {
            transform: scale(1.1);
        }
        .photo-count-badge {
            position: absolute;
            top: 5px;
            right: 5px;
            background: rgba(0,0,0,0.7);
            color: white;
            padding: 2px 8px;
            border-radius: 12px;
            font-size: 0.8rem;
        }
        
        /* Workflow Progress */
        .workflow-progress {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 10px 0;
            margin: 10px 0;
        }
        .workflow-step {
            flex: 1;
            text-align: center;
            position: relative;
        }
        .workflow-step:not(:last-child)::after {
            content: '';
            position: absolute;
            top: 20px;
            left: 60%;
            width: 80%;
            height: 2px;
            background: #ddd;
        }
        .workflow-step.completed:not(:last-child)::after {
            background: #28a745;
        }
        .step-icon {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            background: #ddd;
            color: #666;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            margin-bottom: 5px;
        }
        .workflow-step.completed .step-icon,
        .workflow-step.active .step-icon {
            background: #28a745;
            color: white;
        }
        .step-label {
            font-size: 0.75rem;
            color: #666;
        }
        .workflow-step.completed .step-label,
        .workflow-step.active .step-label {
            color: #333;
            font-weight: 600;
        }
        
        /* Detail Section */
        .detail-section {
            margin-bottom: 20px;
            padding: 15px;
            background: #f8f9fc;
            border-radius: 5px;
        }
        .detail-section h6 {
            color: #4e73df;
            margin-bottom: 10px;
            font-weight: 600;
        }
        .detail-item {
            display: flex;
            margin-bottom: 8px;
        }
        .detail-label {
            min-width: 120px;
            font-weight: 500;
            color: #666;
        }
        .detail-value {
            color: #333;
        }
    </style>
</head>

<body id="page-top">
    <div id="wrapper">
    <?php include '_navbar.php'; ?>
        <div id="content-wrapper" class="d-flex flex-column">
            <div id="content">
                <nav class="navbar navbar-expand navbar-light bg-white topbar mb-4 static-top shadow-sm">
                    <button type="button" id="sidebarToggleTop" class="btn btn-link d-md-none rounded-circle mr-3"><i class="fa fa-bars"></i></button>
                    <ul class="navbar-nav ml-auto">
                        <li class="nav-item dropdown no-arrow">
                            <a class="nav-link dropdown-toggle" href="#" id="userDropdown" role="button" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
                                <span id="username-placeholder" class="mr-2 d-none d-lg-inline text-gray-600 small">Admin</span>
                                <img class="img-profile rounded-circle" src="/img/undraw_profile.svg">
                            </a>
                            <div class="dropdown-menu dropdown-menu-right shadow animated--grow-in" aria-labelledby="userDropdown">
                                <a class="dropdown-item" href="/logout" data-toggle="modal" data-target="#logoutModal"><i class="fas fa-sign-out-alt fa-sm fa-fw mr-2 text-gray-400"></i>Logout</a>
                            </div>
                        </li>
                    </ul>
                </nav>
                <div class="container-fluid">
                    <!-- Page Header -->
                    <div class="dashboard-header">
                        <div class="d-flex align-items-center justify-content-between">
                            <div>
                                <h1>Ticket Management</h1>
                                <p>Kelola tiket laporan dan keluhan pelanggan</p>
                            </div>
                            <button class="btn btn-primary-custom" data-toggle="modal" data-target="#createTicketModal">
                                <i class="fas fa-ticket-alt"></i> Buat Tiket Baru
                            </button>
                        </div>
                    </div>
                    <div id="globalAdminMessage" class="mb-3"></div>

                    <!-- Filter Section -->
                    <h4 class="dashboard-section-title">Filter & Pencarian</h4>
                    <div class="filter-section">
                        <form id="filterForm" class="row">
                            <div class="form-group col-md-2">
                                <label for="filterTicketId">ID Tiket</label>
                                <input type="text" class="form-control form-control-modern" id="filterTicketId" placeholder="Cari ID Tiket">
                            </div>
                            <div class="form-group col-md-2">
                                <label for="filterStatus">Status</label>
                                <select id="filterStatus" class="form-control form-control-modern">
                                    <option value="all" selected>Semua Status</option>
                                    <option value="baru">Baru</option>
                                    <option value="process">Process (OTP Generated)</option>
                                    <option value="otw">OTW (On The Way)</option>
                                    <option value="arrived">Arrived (Tiba di Lokasi)</option>
                                    <option value="working">Working (Sedang Dikerjakan)</option>
                                    <option value="resolved">Resolved (Selesai)</option>
                                    <option value="dibatalkan pelanggan">Dibatalkan Pelanggan</option>
                                    <option value="dibatalkan admin">Dibatalkan Admin</option>
                                </select>
                            </div>
                            <div class="form-group col-md-2">
                                <label for="filterPppoe">Nama PPPoE</label>
                                <input type="text" class="form-control form-control-modern" id="filterPppoe" placeholder="Cari PPPoE">
                            </div>
                            <div class="form-group col-md-2">
                                <label for="filterStartDate">Tgl Lapor Dari</label>
                                <input type="date" class="form-control form-control-modern" id="filterStartDate">
                            </div>
                            <div class="form-group col-md-2">
                                <label for="filterEndDate">Tgl Lapor Sampai</label>
                                <input type="date" class="form-control form-control-modern" id="filterEndDate">
                            </div>
                            <div class="form-group col-md-2 d-flex align-items-end">
                                <button type="submit" class="btn btn-primary-custom btn-sm-custom btn-block">
                                    <i class="fas fa-filter"></i> Filter
                                </button>
                            </div>
                        </form>
                    </div>
                    <!-- Data Table -->
                    <h4 class="dashboard-section-title">Daftar Tiket</h4>
                    <div class="dashboard-card" style="height: auto;">
                        <div class="card-body">
                            <div class="d-flex justify-content-between align-items-center mb-3">
                                <div>
                                    <span class="font-weight-600" style="color: var(--dark); font-size: 1.1rem;">Data Tiket</span>
                                </div>
                                <button class="btn btn-info-custom btn-sm-custom" onclick="loadTickets(true)">
                                    <i class="fas fa-sync-alt"></i> Reset & Refresh
                                </button>
                            </div>
                            <div class="table-responsive">
                                <table class="table table-bordered table-hover" id="allTicketsTable" width="100%" cellspacing="0">
                                    <thead>
                                        <tr>
                                            <th>ID Tiket</th>
                                            <th>Pelanggan (WA)</th>
                                            <th>Detail Pelanggan (Sistem)</th>
                                            <th>Isi Laporan</th>
                                            <th>Foto</th>
                                            <th>Status</th>
                                            <th>Tgl Dibuat</th>
                                            <th>Diproses Oleh</th>
                                            <th>Diselesaikan Oleh</th>
                                            <th>Dibatalkan Oleh</th>
                                            <th style="min-width: 120px;">Aksi Admin</th>
                                        </tr>
                                    </thead>
                                    <tbody></tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <footer class="sticky-footer bg-white">
                <div class="container my-auto"><div class="copyright text-center my-auto"><span>Copyright &copy; Raf BOT 2025</span></div></div>
            </footer>
        </div>
    </div>

    <a class="scroll-to-top rounded" href="#page-top"><i class="fas fa-angle-up"></i></a>
    <div class="modal fade" id="logoutModal" tabindex="-1" role="dialog"><div class="modal-dialog modal-dialog-centered" role="document"><div class="modal-content"><div class="modal-header"><h5 class="modal-title">Ready to Leave?</h5><button class="close" type="button" data-dismiss="modal" aria-label="Close"><span aria-hidden="true">&times;</span></button></div><div class="modal-body">Select "Logout" below if you are ready to end your current session.</div><div class="modal-footer"><button class="btn btn-secondary" type="button" data-dismiss="modal">Cancel</button><a class="btn btn-primary" href="/logout">Logout</a></div></div></div></div>

    <!-- Ticket Detail Modal -->
    <div class="modal fade" id="ticketDetailModal" tabindex="-1" role="dialog" aria-labelledby="ticketDetailModalLabel" aria-hidden="true">
        <div class="modal-dialog modal-lg" role="document">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title" id="ticketDetailModalLabel">Detail Tiket</h5>
                    <button type="button" class="close" data-dismiss="modal" aria-label="Close">
                        <span aria-hidden="true">&times;</span>
                    </button>
                </div>
                <div class="modal-body">
                    <!-- Workflow Progress -->
                    <div class="workflow-progress">
                        <div class="workflow-step" id="step-baru">
                            <div class="step-icon"><i class="fas fa-plus"></i></div>
                            <div class="step-label">Baru</div>
                        </div>
                        <div class="workflow-step" id="step-process">
                            <div class="step-icon"><i class="fas fa-cog"></i></div>
                            <div class="step-label">Process</div>
                        </div>
                        <div class="workflow-step" id="step-otw">
                            <div class="step-icon"><i class="fas fa-car"></i></div>
                            <div class="step-label">OTW</div>
                        </div>
                        <div class="workflow-step" id="step-arrived">
                            <div class="step-icon"><i class="fas fa-map-marker-alt"></i></div>
                            <div class="step-label">Arrived</div>
                        </div>
                        <div class="workflow-step" id="step-working">
                            <div class="step-icon"><i class="fas fa-wrench"></i></div>
                            <div class="step-label">Working</div>
                        </div>
                        <div class="workflow-step" id="step-resolved">
                            <div class="step-icon"><i class="fas fa-check"></i></div>
                            <div class="step-label">Resolved</div>
                        </div>
                    </div>
                    
                    <!-- Ticket Info -->
                    <div class="detail-section">
                        <h6>Informasi Tiket</h6>
                        <div class="detail-item">
                            <span class="detail-label">ID Tiket:</span>
                            <span class="detail-value" id="detail-ticketId">-</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Status:</span>
                            <span class="detail-value" id="detail-status">-</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Pelanggan:</span>
                            <span class="detail-value" id="detail-customer">-</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Laporan:</span>
                            <span class="detail-value" id="detail-report">-</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Dibuat:</span>
                            <span class="detail-value" id="detail-created">-</span>
                        </div>
                    </div>
                    
                    <!-- Teknisi Info -->
                    <div class="detail-section">
                        <h6>Informasi Teknisi</h6>
                        <div class="detail-item">
                            <span class="detail-label">Teknisi:</span>
                            <span class="detail-value" id="detail-teknisi">-</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">OTP:</span>
                            <span class="detail-value" id="detail-otp">-</span>
                        </div>
                    </div>
                    
                    <!-- Photos Section -->
                    <div class="detail-section">
                        <h6>Dokumentasi Foto</h6>
                        <div class="photo-gallery" id="detail-photos">
                            <p class="text-muted">Memuat foto...</p>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-dismiss="modal">Tutup</button>
                </div>
            </div>
        </div>
    </div>
    
    <div class="modal fade" id="cancelTicketModal" tabindex="-1" role="dialog" aria-labelledby="cancelTicketModalLabel" aria-hidden="true">
        <div class="modal-dialog modal-dialog-centered" role="document">
            <div class="modal-content">
                <div class="modal-header"><h5 class="modal-title" id="cancelTicketModalLabel">Batalkan Tiket Laporan</h5><button type="button" class="close" data-dismiss="modal" aria-label="Close"><span aria-hidden="true">&times;</span></button></div>
                <div class="modal-body">
                    <p>Anda akan membatalkan tiket <strong id="cancelTicketIdDisplay"></strong>.</p>
                    <div class="form-group"><label for="cancellationReasonInput">Alasan Pembatalan (Wajib Diisi):</label><textarea class="form-control" id="cancellationReasonInput" rows="3" placeholder="Masukkan alasan mengapa tiket ini dibatalkan..."></textarea></div>
                </div>
                <div class="modal-footer"><button type="button" class="btn btn-secondary" data-dismiss="modal">Tutup</button><button type="button" class="btn btn-danger" id="confirmCancelTicketBtn">Ya, Batalkan Tiket</button></div>
            </div>
        </div>
    </div>

    <div class="modal fade" id="createTicketModal" tabindex="-1" role="dialog" aria-labelledby="createTicketModalLabel" aria-hidden="true">
        <div class="modal-dialog modal-dialog-centered modal-lg" role="document">
            <form id="createTicketForm">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title" id="createTicketModalLabel">Buat Tiket Laporan Baru untuk Pelanggan</h5>
                        <button type="button" class="close" data-dismiss="modal" aria-label="Close">
                            <span aria-hidden="true">&times;</span>
                        </button>
                    </div>
                    <div class="modal-body">
                        <div class="form-group">
                            <label for="customerSelect">Pilih Pelanggan:</label>
                            <select class="form-control" id="customerSelect" name="customerUserId" style="width: 100%;" required>
                                <option value="">Memuat pelanggan...</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="laporanTextInput">Deskripsi Laporan Kendala:</label>
                            <textarea class="form-control" id="laporanTextInput" name="laporanText" rows="4" placeholder="Jelaskan kendala yang dialami pelanggan..." required></textarea>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-dismiss="modal">Tutup</button>
                        <button type="submit" class="btn btn-success" id="submitNewTicketBtn">Buat Tiket</button>
                    </div>
                </div>
            </form>
        </div>
    </div>


    <script src="/vendor/jquery/jquery.min.js"></script>
    <script src="/vendor/bootstrap/js/bootstrap.bundle.min.js"></script>
    <script src="/vendor/jquery-easing/jquery.easing.min.js"></script>
    <script src="/js/sb-admin-2.js"></script>
    <script src="/vendor/datatables/jquery.dataTables.min.js"></script>
    <script src="/vendor/datatables/dataTables.bootstrap4.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/select2@4.1.0-rc.0/dist/js/select2.min.js"></script> 


    <script>
        let currentUser = null;
        fetch('/api/me', { credentials: 'include' }).then(response => response.json()).then(data => {
            if (data.status === 200 && data.data) {
                document.getElementById('username-placeholder').textContent = data.data.username;
                currentUser = data.data;
            }
        });

        function displayGlobalAdminMessage(message, type = 'info') {
             const globalMessageDiv = document.getElementById('globalAdminMessage');
            globalMessageDiv.innerHTML = `<div class="alert alert-${type} alert-dismissible fade show" role="alert">
                ${message}
                <button type="button" class="close" data-dismiss="alert" aria-label="Close"><span aria-hidden="true">&times;</span></button>
            </div>`;
            setTimeout(() => { if (globalMessageDiv.querySelector('.alert')) $(globalMessageDiv.querySelector('.alert')).alert('close'); }, 7000);
        }
        function formatTicketDetailsAdmin(d) { return d ? `Nama: ${d.name||'N/A'}\nAlamat: ${d.address||'N/A'}\nPaket: ${d.subscription||'N/A'}\nPPPoE: ${d.pppoe_username||'N/A'}` : 'N/A';}
        function getStatusBadgeAdmin(s) { 
            // Per TICKET_STATUS_STANDARD.md
            if (s === 'baru') return '<span class="badge badge-status-baru">Baru</span>';
            if (s === 'process' || s === 'diproses teknisi') return '<span class="badge badge-status-process">Process</span>';
            if (s === 'otw') return '<span class="badge badge-status-otw">OTW</span>';
            if (s === 'arrived') return '<span class="badge badge-status-arrived">Arrived</span>';
            if (s === 'working') return '<span class="badge badge-status-working">Working</span>';
            if (s === 'resolved' || s === 'selesai') return '<span class="badge badge-status-resolved">Resolved</span>';
            if (s === 'dibatalkan pelanggan') return '<span class="badge badge-status-cancelled">Dibatalkan Pelanggan</span>';
            if (s === 'dibatalkan admin') return '<span class="badge badge-status-cancelled">Dibatalkan Admin</span>';
            return `<span class="badge badge-secondary">${s || 'N/A'}</span>`;
        }
        
        function showTicketDetail(ticket) {
            // Open detail modal with full ticket information
            const detailModal = $('#ticketDetailModal');
            if (!detailModal.length) {
                console.error('Detail modal not found');
                return;
            }
            
            // Populate modal with ticket data
            $('#detail-ticketId').text(ticket.ticketId || '-');
            $('#detail-status').html(getStatusBadgeAdmin(ticket.status));
            $('#detail-customer').text(ticket.pelangganPushName || '-');
            $('#detail-report').text(ticket.laporanText || '-');
            $('#detail-otp').text(ticket.otp || '-');
            $('#detail-teknisi').text(ticket.teknisiName || '-');
            $('#detail-created').text(ticket.createdAt ? new Date(ticket.createdAt).toLocaleString('id-ID') : '-');
            
            // Show photos if available
            const photoContainer = $('#detail-photos');
            photoContainer.empty();
            
            // Check BOTH teknisiPhotos (from WhatsApp) AND photos (from Web Dashboard)
            let allPhotos = [];
            
            // Collect photos from teknisiPhotos field (WhatsApp uploads)
            if (ticket.teknisiPhotos && ticket.teknisiPhotos.length > 0) {
                ticket.teknisiPhotos.forEach(photo => {
                    allPhotos.push({
                        type: 'whatsapp',
                        path: `/uploads/teknisi/${photo}`,
                        filename: photo
                    });
                });
            }
            
            // Collect photos from photos field (Web Dashboard uploads)
            if (ticket.photos && ticket.photos.length > 0) {
                ticket.photos.forEach(photo => {
                    // Handle both object format and string format
                    if (typeof photo === 'object') {
                        allPhotos.push({
                            type: 'web',
                            path: photo.path || `/uploads/tickets/${photo.filename}`,
                            filename: photo.filename
                        });
                    } else {
                        // If it's a string, treat as filename
                        allPhotos.push({
                            type: 'web',
                            path: `/uploads/tickets/${photo}`,
                            filename: photo
                        });
                    }
                });
            }
            
            // Also check completionPhotos field (alternative field sometimes used)
            if (ticket.completionPhotos && ticket.completionPhotos.length > 0) {
                ticket.completionPhotos.forEach(photo => {
                    allPhotos.push({
                        type: 'completion',
                        path: `/uploads/teknisi/${photo}`,
                        filename: photo
                    });
                });
            }
            
            // Display all collected photos
            if (allPhotos.length > 0) {
                allPhotos.forEach((photo, index) => {
                    photoContainer.append(`
                        <div class="photo-thumbnail" onclick="viewPhotoFullPath('${photo.path}')" title="Photo ${index + 1} (${photo.type})">
                            <img src="${photo.path}" alt="Photo ${index + 1}" onerror="this.onerror=null; this.src='/img/no-image.png';">
                            <span class="photo-count-badge">${index + 1}</span>
                        </div>
                    `);
                });
            } else {
                photoContainer.append('<p class="text-muted">Belum ada foto dokumentasi</p>');
            }
            
            // Show workflow progress
            updateWorkflowProgress(ticket.status);
            
            detailModal.modal('show');
        }
        
        function updateWorkflowProgress(status) {
            const steps = ['baru', 'process', 'otw', 'arrived', 'working', 'resolved'];
            const currentIndex = steps.indexOf(status);
            
            $('.workflow-step').removeClass('completed active');
            steps.forEach((step, index) => {
                const stepEl = $(`#step-${step}`);
                if (index < currentIndex) {
                    stepEl.addClass('completed');
                } else if (index === currentIndex) {
                    stepEl.addClass('active');
                }
            });
        }
        
        function viewPhoto(photoUrl) {
            // Open photo in full screen modal
            window.open(`/uploads/teknisi/${photoUrl}`, '_blank');
        }
        
        function viewPhotoFullPath(fullPath) {
            // Open photo with full path in new window
            window.open(fullPath, '_blank');
        }
        
        let dataTableInstance;

        function setupCancelModal(ticketId) { 
            document.getElementById('cancelTicketIdDisplay').textContent = ticketId;
            document.getElementById('cancellationReasonInput').value = '';
            document.getElementById('confirmCancelTicketBtn').setAttribute('data-ticket-id', ticketId);
            $('#cancelTicketModal').modal('show');
        }
        async function executeAdminCancelTicket(ticketId, reason) { 
            if (!ticketId || !reason || reason.trim() === '') {
                displayGlobalAdminMessage('ID Tiket dan Alasan Pembatalan wajib diisi.', 'danger');
                return;
            }
            try {
                const response = await fetch('/api/admin/ticket/cancel', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include', // ✅ Fixed by script
                    body: JSON.stringify({ ticketId, cancellationReason: reason })
                });
                const result = await response.json();
                $('#cancelTicketModal').modal('hide');
                if (response.ok && result.status === 200) {
                    displayGlobalAdminMessage(result.message, 'success');
                    loadTickets(); 
                } else {
                    displayGlobalAdminMessage(`Gagal membatalkan tiket: ${result.message || 'Error tidak diketahui.'}`, 'danger');
                }
            } catch (error) {
                $('#cancelTicketModal').modal('hide');
                console.error('Error cancelling ticket by admin:', error);
                displayGlobalAdminMessage('Terjadi kesalahan koneksi saat membatalkan tiket.', 'danger');
            }
        }
        async function loadTickets(resetFilters = false) { 
            if (resetFilters) {
                document.getElementById('filterForm').reset();
                 // Jika Select2 digunakan untuk filter status atau lainnya, reset juga mereka
                // $('#filterStatusSelect2').val(null).trigger('change'); 
            }
            
            const status = document.getElementById('filterStatus').value;
            const startDate = document.getElementById('filterStartDate').value;
            const endDate = document.getElementById('filterEndDate').value;
            const pppoeName = document.getElementById('filterPppoe').value;
            const ticketIdVal = document.getElementById('filterTicketId').value;

            let queryParams = new URLSearchParams();
            if (status && status !== 'all') queryParams.append('status', status);
            if (startDate) queryParams.append('startDate', startDate);
            if (endDate) queryParams.append('endDate', endDate);
            if (pppoeName.trim() !== '') queryParams.append('pppoeName', pppoeName.trim());
            if (ticketIdVal.trim() !== '') queryParams.append('ticketId', ticketIdVal.trim());

            const apiUrl = `/api/admin/tickets?${queryParams.toString()}&_=${new Date().getTime()}`;

            try {
                const response = await fetch(apiUrl);
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                const result = await response.json();
                const tickets = result.data;
                
                if ($.fn.DataTable.isDataTable('#allTicketsTable')) dataTableInstance.destroy();
                
                const ticketsTableBody = document.getElementById('allTicketsTable').getElementsByTagName('tbody')[0];
                ticketsTableBody.innerHTML = ''; 

                if (tickets && tickets.length > 0) {
                    tickets.forEach(ticket => {
                        let row = ticketsTableBody.insertRow();
                        row.insertCell().textContent = ticket.ticketId || '-';
                        row.insertCell().textContent = `${ticket.pelangganPushName || 'N/A'} (${ticket.pelangganId ? ticket.pelangganId.split('@')[0] : 'N/A'})`;
                        row.insertCell().innerHTML = `<div class="ticket-details-admin">${formatTicketDetailsAdmin(ticket.pelangganDataSystem)}</div>`;
                        row.insertCell().innerHTML = `<div class="report-text-admin">${ticket.laporanText || '-'}</div>`;
                        
                        // Photo column
                        let photoCell = row.insertCell();
                        if (ticket.teknisiPhotos && ticket.teknisiPhotos.length > 0) {
                            photoCell.innerHTML = `
                                <button class="btn btn-sm btn-info" onclick='showTicketDetail(${JSON.stringify(ticket).replace(/'/g, "\\'")})' title="Lihat ${ticket.teknisiPhotos.length} foto">
                                    <i class="fas fa-camera"></i> ${ticket.teknisiPhotos.length}
                                </button>
                            `;
                        } else if (ticket.photoCount > 0 || ticket.photos) {
                            const count = ticket.photoCount || (ticket.photos ? ticket.photos.length : 0);
                            photoCell.innerHTML = `
                                <button class="btn btn-sm btn-info" onclick='showTicketDetail(${JSON.stringify(ticket).replace(/'/g, "\\'")})' title="Lihat ${count} foto">
                                    <i class="fas fa-camera"></i> ${count}
                                </button>
                            `;
                        } else {
                            photoCell.innerHTML = '<span class="text-muted">-</span>';
                        }
                        
                        row.insertCell().innerHTML = getStatusBadgeAdmin(ticket.status);
                        row.insertCell().textContent = ticket.createdAt ? new Date(ticket.createdAt).toLocaleString('id-ID', {dateStyle:'short', timeStyle:'short'}) : '-';
                        
                        let processedByText = ticket.processedByTeknisiName || '-';
                        if(ticket.processingStartedAt && ticket.processedByTeknisiName) processedByText += ` <small class="text-muted">(${new Date(ticket.processingStartedAt).toLocaleDateString('id-ID', {day:'2-digit',month:'short'})})</small>`;
                        row.insertCell().innerHTML = processedByText;

                        let resolvedByText = ticket.resolvedByTeknisiName || '-';
                        if(ticket.resolvedAt && ticket.resolvedByTeknisiName) resolvedByText += ` <small class="text-muted">(${new Date(ticket.resolvedAt).toLocaleDateString('id-ID', {day:'2-digit',month:'short'})})</small>`;
                        row.insertCell().innerHTML = resolvedByText;

                        let cancelledByText = ticket.cancelledBy ? `${ticket.cancelledBy.name || 'N/A'} (${ticket.cancelledBy.type || 'N/A'})` : '-';
                        if(ticket.cancellationTimestamp && ticket.cancelledBy) cancelledByText += ` <small class="text-muted">(${new Date(ticket.cancellationTimestamp).toLocaleDateString('id-ID', {day:'2-digit',month:'short'})})</small>`;
                        row.insertCell().innerHTML = cancelledByText;

                        let adminActionCell = row.insertCell();
                        adminActionCell.classList.add('action-buttons-admin', 'text-center');
                        if (ticket.status !== 'selesai' && !ticket.status.startsWith('dibatalkan')) {
                            let cancelButton = document.createElement('button');
                            cancelButton.classList.add('btn', 'btn-danger', 'btn-sm');
                            cancelButton.innerHTML = '<i class="fas fa-times-circle"></i> Batalkan';
                            cancelButton.title = 'Batalkan Tiket Ini';
                            cancelButton.onclick = function() { setupCancelModal(ticket.ticketId); };
                            adminActionCell.appendChild(cancelButton);
                        } else {
                            adminActionCell.textContent = '-';
                        }
                    });
                } else {
                    const colCount = $('#allTicketsTable thead th').length;
                    ticketsTableBody.innerHTML = `<tr><td colspan="${colCount}" class="text-center">Tidak ada tiket yang cocok dengan filter Anda.</td></tr>`;
                }

                dataTableInstance = $('#allTicketsTable').DataTable({
                    "order": [[5, "desc"]], 
                    "pageLength": 10,
                    "language": { /* ... bahasa ... */ }
                });

            } catch (error) {
                console.error('Error loading tickets for admin:', error);
                const colCount = $('#allTicketsTable thead th').length;
                document.getElementById('allTicketsTable').getElementsByTagName('tbody')[0].innerHTML = `<tr><td colspan="${colCount}" class="text-center">Gagal memuat data tiket. Coba refresh.</td></tr>`;
            }
        }

        document.getElementById('filterForm').addEventListener('submit', function(event) { event.preventDefault(); loadTickets();});
        
        document.addEventListener('DOMContentLoaded', function() {
            loadTickets(); 
            
            const confirmCancelBtn = document.getElementById('confirmCancelTicketBtn');
            if(confirmCancelBtn) {
                 confirmCancelBtn.addEventListener('click', function() {
                    const ticketId = this.getAttribute('data-ticket-id');
                    const reason = document.getElementById('cancellationReasonInput').value;
                    if (!reason || reason.trim() === "") {
                        // Menggunakan displayGlobalAdminMessage untuk pesan error di modal pembatalan juga bisa, atau alert
                        alert("Alasan pembatalan wajib diisi!"); 
                        // displayGlobalAdminMessage('Alasan pembatalan wajib diisi!', 'warning'); // Alternatif
                        return;
                    }
                    executeAdminCancelTicket(ticketId, reason);
                });
            }

            $('#customerSelect').select2({
                theme: "bootstrap", // Menggunakan tema bootstrap umum yang lebih cocok untuk BS4
                dropdownParent: $('#createTicketModal'), 
                placeholder: 'Cari dan pilih pelanggan...',
                allowClear: true,
                ajax: {
                    url: '/api/users', 
                    dataType: 'json',
                    delay: 250, 
                    data: function (params) {
                        return {
                            search: params.term, 
                            page: params.page || 1,
                            role: 'pelanggan' // Opsional: filter hanya user dengan role pelanggan jika API mendukung
                        };
                    },
                    processResults: function (data, params) {
                        params.page = params.page || 1;
                        const users = data.data || data; 
                        return {
                            results: users.map(user => ({
                                id: user.id,
                                text: `${user.name || `ID: ${user.id}`} (${user.pppoe_username || 'No PPPoE'}) - ${user.phone_number ? user.phone_number.split('|')[0] : 'No HP'}`
                            })),
                            pagination: {
                                more: (params.page * 10) < (data.total || users.length) 
                            }
                        };
                    },
                    cache: true
                }
            });

            document.getElementById('createTicketForm').addEventListener('submit', async function(event) {
                event.preventDefault();
                const customerUserId = document.getElementById('customerSelect').value;
                const laporanText = document.getElementById('laporanTextInput').value;
                const submitBtn = document.getElementById('submitNewTicketBtn');

                if (!customerUserId) { // Hanya cek customerUserId karena laporanText sudah 'required'
                    displayGlobalAdminMessage('Harap pilih pelanggan dari daftar.', 'warning');
                     $('#customerSelect').select2('open'); // Fokuskan kembali ke select2
                    return;
                }
                 if (laporanText.trim() === "") {
                    displayGlobalAdminMessage('Deskripsi laporan tidak boleh kosong.', 'warning');
                    document.getElementById('laporanTextInput').focus();
                    return;
                }


                submitBtn.disabled = true;
                submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Membuat...';

                try {
                    const response = await fetch('/api/admin/ticket/create', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include', // ✅ Fixed by script
                        body: JSON.stringify({ customerUserId, laporanText })
                    });
                    const result = await response.json();

                    if (response.ok && (result.status === 201 || result.status === 200) ) {
                        displayGlobalAdminMessage(result.message, 'success');
                        $('#createTicketModal').modal('hide');
                        document.getElementById('createTicketForm').reset();
                        $('#customerSelect').val(null).trigger('change'); 
                        loadTickets(); 
                    } else {
                        displayGlobalAdminMessage(`Gagal membuat tiket: ${result.message || 'Error tidak diketahui.'}`, 'danger');
                    }
                } catch (error) {
                    console.error('Error creating ticket by admin:', error);
                    displayGlobalAdminMessage('Terjadi kesalahan koneksi saat membuat tiket.', 'danger');
                } finally {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = 'Buat Tiket';
                }
            });
        });
    </script>
</body>
</html>