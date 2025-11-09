<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="utf-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no">
    <title>Manajemen Tiket Laporan - Teknisi</title>
    <link href="/vendor/fontawesome-free/css/all.min.css" rel="stylesheet" type="text/css">
    <link href="https://fonts.googleapis.com/css?family=Nunito:200,200i,300,300i,400,400i,600,600i,700,700i,800,800i,900,900i" rel="stylesheet">
    <link href="/css/sb-admin-2.min.css" rel="stylesheet">
    <link href="https://cdn.jsdelivr.net/npm/select2@4.1.0-rc.0/dist/css/select2.min.css" rel="stylesheet" />
    <link href="/css/dashboard-modern.css" rel="stylesheet">
    <link href="/vendor/datatables/dataTables.bootstrap4.min.css" rel="stylesheet">
    <style>
        .ticket-details {
            font-size: 0.85rem;
            white-space: pre-wrap;
        }
        .processed-by-details {
            font-size: 0.8rem;
            color: #5a5c69;
        }
        .action-buttons .btn {
            margin-right: 5px;
            margin-bottom: 5px;
        }
        .modal-body {
            word-break: break-word;
        }
        
        /* Workflow Stepper Styles */
        .workflow-stepper {
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
            z-index: 0;
        }
        .workflow-step.completed:not(:last-child)::after {
            background: #28a745;
        }
        .workflow-step.active:not(:last-child)::after {
            background: linear-gradient(to right, #28a745 50%, #ddd 50%);
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
            font-size: 18px;
            position: relative;
            z-index: 1;
            margin-bottom: 5px;
        }
        .workflow-step.completed .step-icon {
            background: #28a745;
            color: white;
        }
        .workflow-step.active .step-icon {
            background: #007bff;
            color: white;
            animation: pulse 2s infinite;
        }
        .step-label {
            font-size: 0.75rem;
            color: #666;
            display: block;
        }
        .workflow-step.completed .step-label,
        .workflow-step.active .step-label {
            color: #333;
            font-weight: 600;
        }
        @keyframes pulse {
            0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(0,123,255,0.7); }
            50% { transform: scale(1.05); box-shadow: 0 0 0 10px rgba(0,123,255,0); }
        }
        
        /* Status Badge Colors - All clearly visible! */
        .badge-status-baru { background: #6f42c1; color: #fff; } /* Purple - new tickets */
        .badge-status-process { background: #17a2b8; color: #fff; } /* Cyan - being processed */
        .badge-status-otw { background: #ffc107; color: #000; } /* Yellow - on the way */
        .badge-status-arrived { background: #fd7e14; color: #fff; } /* Orange - arrived */
        .badge-status-working { background: #20c997; color: #fff; } /* Teal/Turquoise - working (changed from dark blue) */
        .badge-status-resolved { background: #28a745; color: #fff; } /* Green - completed */
        
        /* Photo Preview Styles */
        .photo-preview-container {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
            margin-top: 15px;
        }
        .photo-preview-item {
            position: relative;
            width: 150px;
            height: 150px;
            border: 2px solid #ddd;
            border-radius: 5px;
            overflow: hidden;
        }
        .photo-preview-item img {
            width: 100%;
            height: 100%;
            object-fit: cover;
        }
        .photo-preview-item .remove-photo {
            position: absolute;
            top: 5px;
            right: 5px;
            background: rgba(220, 53, 69, 0.9);
            color: white;
            border: none;
            border-radius: 50%;
            width: 25px;
            height: 25px;
            cursor: pointer;
            font-size: 12px;
        }
        .photo-count-badge {
            font-size: 0.9rem;
            padding: 5px 10px;
        }
        
        /* OTP Display Box */
        .otp-box {
            text-align: center;
            padding: 20px;
            background: #f8f9fc;
            border: 3px solid #4e73df;
            border-radius: 10px;
            margin: 20px 0;
        }
        .otp-code {
            font-size: 2.5rem;
            font-weight: 700;
            color: #4e73df;
            letter-spacing: 8px;
            font-family: 'Courier New', monospace;
        }
        .otp-label {
            font-size: 0.9rem;
            color: #666;
            margin-bottom: 10px;
        }
        
        /* Modal Improvements */
        .modal-header {
            background: #4e73df;
            color: white;
        }
        .modal-header .close {
            color: white;
            opacity: 0.8;
        }
        .modal-header .close:hover {
            opacity: 1;
        }
        
        /* Action Button Improvements */
        .btn-group-vertical .btn {
            margin-bottom: 5px;
        }
        .action-btn-icon {
            width: 20px;
            text-align: center;
            display: inline-block;
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
                                <a class="dropdown-item" href="/logout" data-toggle="modal" data-target="#logoutModal">
                                    <i class="fas fa-sign-out-alt fa-sm fa-fw mr-2 text-gray-400"></i>
                                    Logout
                                </a>
                            </div>
                        </li>
                    </ul>
                </nav>
                <div class="container-fluid">
                    <div class="d-sm-flex align-items-center justify-content-between mb-4">
                        <h1 class="h3 mb-0 text-gray-800">Manajemen Tiket Laporan</h1>
                        <button class="btn btn-primary" data-toggle="modal" data-target="#createTicketModal">
                            <i class="fas fa-ticket-alt"></i> Buat Tiket Baru
                        </button>
                    </div>
                    <div id="globalMessage" class="mb-3"></div>

                    <div class="card shadow mb-4">
                        <div class="card-header py-3 d-flex flex-row align-items-center justify-content-between">
                            <h6 class="m-0 font-weight-bold text-primary">Daftar Tiket Aktif</h6>
                            <button class="btn btn-sm btn-primary" onclick="loadTickets()"><i class="fas fa-sync-alt"></i> Refresh</button>
                        </div>
                        <div class="card-body">
                            <div class="table-responsive">
                                <table class="table table-bordered table-hover" id="ticketsTable" width="100%" cellspacing="0">
                                    <thead>
                                        <tr>
                                            <th>ID Tiket</th>
                                            <th>Pelanggan</th>
                                            <th>Isi Laporan</th>
                                            <th>Status</th>
                                            <th style="min-width: 300px;">Progress</th>
                                            <th>Teknisi</th>
                                            <th style="min-width: 180px;">Aksi</th>
                                        </tr>
                                    </thead>
                                    <tbody>
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
                        <span>Copyright &copy; Raf BOT 2025</span>
                    </div>
                </div>
            </footer>
            </div>
    </div>

    <a class="scroll-to-top rounded" href="#page-top">
        <i class="fas fa-angle-up"></i>
    </a>

    <div class="modal fade" id="logoutModal" tabindex="-1" role="dialog" aria-labelledby="exampleModalLabel">
        <div class="modal-dialog" role="document">
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

    <!-- Create Ticket Modal -->
    <div class="modal fade" id="createTicketModal" tabindex="-1" role="dialog" aria-labelledby="createTicketModalLabel" aria-modal="true">
        <div class="modal-dialog modal-dialog-centered modal-lg" role="document">
            <form id="createTicketForm">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title" id="createTicketModalLabel">Buat Tiket Laporan Baru</h5>
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
                        
                        <div class="form-row">
                            <div class="form-group col-md-6">
                                <label for="prioritySelect">Prioritas:</label>
                                <select class="form-control" id="prioritySelect" name="priority" required>
                                    <option value="HIGH">🔴 URGENT (2-4 jam)</option>
                                    <option value="MEDIUM" selected>🟡 NORMAL (6-12 jam)</option>
                                    <option value="LOW">🟢 LOW (1-2 hari)</option>
                                </select>
                            </div>
                            <div class="form-group col-md-6">
                                <label for="issueTypeSelect">Tipe Masalah:</label>
                                <select class="form-control" id="issueTypeSelect" name="issueType" required>
                                    <option value="MATI">💀 Internet Mati Total</option>
                                    <option value="LEMOT">🐌 Internet Lemot</option>
                                    <option value="PUTUS_NYAMBUNG">🔄 Putus-Nyambung</option>
                                    <option value="WIFI">📶 Masalah WiFi</option>
                                    <option value="HARDWARE">🔧 Masalah Hardware</option>
                                    <option value="GENERAL" selected>📋 Lainnya/Umum</option>
                                </select>
                            </div>
                        </div>
                        
                        <div class="form-group">
                            <label for="laporanTextInput">Deskripsi Laporan Kendala:</label>
                            <textarea class="form-control" id="laporanTextInput" name="laporanText" rows="4" placeholder="Jelaskan kendala yang dialami pelanggan..." required></textarea>
                        </div>
                        
                        <div class="alert alert-info" role="alert">
                            <strong>ℹ️ Info:</strong> Tiket akan otomatis dikirim ke pelanggan dan teknisi lain via WhatsApp
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

    <div class="modal fade" id="processTicketModal" tabindex="-1" role="dialog" aria-labelledby="processTicketModalLabel" aria-hidden="true">
        <div class="modal-dialog modal-dialog-centered" role="document">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title" id="processTicketModalLabel">Konfirmasi Proses Tiket</h5>
                    <button class="close" type="button" data-dismiss="modal" aria-label="Close">
                        <span aria-hidden="true">×</span>
                    </button>
                </div>
                <div class="modal-body">
                    Apakah Anda yakin ingin mengambil dan memproses tiket ini? Tiket akan ditandai sedang Anda tangani.
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" type="button" data-dismiss="modal">Batal</button>
                    <button class="btn btn-primary" type="button" id="confirmProcessTicketBtn">Ya, Proses Tiket</button>
                </div>
            </div>
        </div>
    </div>

    <!-- OTP Display Modal REMOVED -->
    <!-- Teknisi should NOT see OTP - they must ask customer for it! -->
    <!-- This is the correct workflow per security requirements -->

    <!-- OTP Verification Modal -->
    <div class="modal fade" id="verifyOtpModal" tabindex="-1" role="dialog">
        <div class="modal-dialog modal-dialog-centered" role="document">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title"><i class="fas fa-check-circle"></i> Verifikasi OTP</h5>
                    <button class="close" type="button" data-dismiss="modal" aria-label="Close">
                        <span aria-hidden="true">×</span>
                    </button>
                </div>
                <div class="modal-body">
                    <p>Masukkan 6 digit kode OTP yang diberikan pelanggan:</p>
                    <input type="hidden" id="verifyOtpTicketId">
                    <div class="form-group">
                        <label for="otpInput">Kode OTP</label>
                        <input type="text" class="form-control form-control-lg text-center" 
                               id="otpInput" placeholder="000000" maxlength="6" 
                               style="letter-spacing: 5px; font-size: 1.5rem; font-family: 'Courier New', monospace;">
                    </div>
                    <div class="alert alert-info">
                        <i class="fas fa-lightbulb"></i> 
                        <small>Minta kode OTP langsung dari pelanggan saat Anda tiba di lokasi</small>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" type="button" data-dismiss="modal">Batal</button>
                    <button class="btn btn-primary" type="button" id="confirmVerifyOtpBtn">
                        <i class="fas fa-check"></i> Verifikasi
                    </button>
                </div>
            </div>
        </div>
    </div>

    <!-- Photo Upload Modal -->
    <div class="modal fade" id="uploadPhotoModal" tabindex="-1" role="dialog">
        <div class="modal-dialog modal-lg" role="document">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title"><i class="fas fa-camera"></i> Upload Foto Dokumentasi</h5>
                    <button class="close" type="button" data-dismiss="modal" aria-label="Close">
                        <span aria-hidden="true">×</span>
                    </button>
                </div>
                <div class="modal-body">
                    <input type="hidden" id="uploadPhotoTicketId">
                    <div class="alert alert-warning">
                        <i class="fas fa-exclamation-triangle"></i> 
                        <strong>Minimal 2 foto diperlukan!</strong> Maksimal 5 foto.
                    </div>
                    <div class="form-group">
                        <label for="photoInput">Pilih Foto</label>
                        <input type="file" class="form-control-file" id="photoInput" accept="image/*" multiple>
                        <small class="form-text text-muted">
                            Format: JPG, PNG, GIF. Maksimal 5MB per foto.
                        </small>
                    </div>
                    <div class="mt-3">
                        <p class="font-weight-bold">
                            Foto Terupload: <span class="badge photo-count-badge badge-info" id="photoCountBadge">0</span>
                        </p>
                        <div class="photo-preview-container" id="photoPreviewContainer">
                            <!-- Photo previews will be inserted here -->
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" type="button" data-dismiss="modal">Tutup</button>
                    <button class="btn btn-success" type="button" id="completePhotoUploadBtn" disabled>
                        <i class="fas fa-check"></i> Selesai Upload
                    </button>
                </div>
            </div>
        </div>
    </div>

    <!-- Complete Ticket Modal -->
    <div class="modal fade" id="completeTicketModal" tabindex="-1" role="dialog">
        <div class="modal-dialog modal-lg" role="document">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title"><i class="fas fa-check-circle"></i> Selesaikan Tiket</h5>
                    <button class="close" type="button" data-dismiss="modal" aria-label="Close">
                        <span aria-hidden="true">×</span>
                    </button>
                </div>
                <div class="modal-body">
                    <input type="hidden" id="completeTicketId">
                    <div class="alert alert-success">
                        <i class="fas fa-info-circle"></i> 
                        Pastikan semua pekerjaan selesai sebelum menutup tiket.
                    </div>
                    <div class="form-group">
                        <label for="resolutionNotes">Catatan Penyelesaian</label>
                        <textarea class="form-control" id="resolutionNotes" rows="4" 
                                  placeholder="Jelaskan apa yang sudah dikerjakan dan masalah apa yang sudah diselesaikan..."></textarea>
                        <small class="form-text text-muted">
                            Catatan ini akan dikirim ke pelanggan via WhatsApp
                        </small>
                    </div>
                    <div class="mt-3">
                        <p class="font-weight-bold">Dokumentasi Foto:</p>
                        <div id="completedPhotosPreview" class="photo-preview-container">
                            <!-- Photos will be shown here -->
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" type="button" data-dismiss="modal">Batal</button>
                    <button class="btn btn-success" type="button" id="confirmCompleteTicketBtn">
                        <i class="fas fa-check-double"></i> Tandai Selesai
                    </button>
                </div>
            </div>
        </div>
    </div>


    <script src="/vendor/jquery/jquery.min.js"></script>
    <script src="/vendor/bootstrap/js/bootstrap.bundle.min.js"></script>
    <script src="/vendor/jquery-easing/jquery.easing.min.js"></script>
    <script src="/js/sb-admin-2.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/select2@4.1.0-rc.0/dist/js/select2.min.js"></script>
    <script src="/vendor/datatables/jquery.dataTables.min.js"></script>
    <script src="/socket.io/socket.io.js"></script>
    <script src="/vendor/datatables/dataTables.bootstrap4.min.js"></script>

    <script>
        let currentUser = null;
        let isLoadingTickets = false;
        let ticketProcessedTimeout = null;
        fetch('/api/me', { credentials: 'include' })
            .then(response => response.json())
            .then(data => {
                if (data.status === 200 && data.data) {
                    document.getElementById('loggedInTechnicianInfo').textContent = data.data.username;
                    currentUser = data.data;
                }
            })
            .catch(error => console.error('Error fetching user info:', error));

        function displayGlobalMessage(message, type = 'info') {
            const globalMessageDiv = document.getElementById('globalMessage');
            globalMessageDiv.innerHTML = `<div class="alert alert-${type} alert-dismissible fade show" role="alert">
                ${message}
                <button type="button" class="close" data-dismiss="alert" aria-label="Close">
                    <span aria-hidden="true">&times;</span>
                </button>
            </div>`;
            setTimeout(() => {
                if (globalMessageDiv.querySelector('.alert')) {
                     $(globalMessageDiv.querySelector('.alert')).alert('close');
                }
            }, 7000);
        }

        function formatTicketDetails(pelangganData) {
            if (!pelangganData) return 'N/A';
            let details = `Nama: ${pelangganData.name || 'N/A'}\n`;
            details += `Alamat: ${pelangganData.address || 'N/A'}\n`;
            details += `Paket: ${pelangganData.subscription || 'N/A'}\n`;
            details += `PPPoE: ${pelangganData.pppoe_username || 'N/A'}`;
            return details;
        }

        /**
         * Get status badge with proper color coding
         * Supports all workflow statuses from WhatsApp bot
         */
        function getStatusBadge(status) {
            const statusLower = (status || 'baru').toLowerCase();
            
            // Map status to badge HTML with custom classes (see TICKET_STATUS_STANDARD.md)
            const statusMap = {
                // Primary statuses
                'baru': '<span class="badge badge-status-baru">Baru</span>',
                'process': '<span class="badge badge-status-process">Diproses</span>',
                'otw': '<span class="badge badge-status-otw">OTW</span>',
                'arrived': '<span class="badge badge-status-arrived">Tiba</span>',
                'working': '<span class="badge badge-status-working">Bekerja</span>',
                'resolved': '<span class="badge badge-status-resolved">Selesai</span>',
                // Backward compatibility aliases
                'pending': '<span class="badge badge-status-baru">Pending</span>',
                'diproses teknisi': '<span class="badge badge-status-process">Diproses</span>',
                'selesai': '<span class="badge badge-status-resolved">Selesai</span>',
                'completed': '<span class="badge badge-status-resolved">Selesai</span>',
                'dibatalkan': '<span class="badge badge-secondary">Dibatalkan</span>',
                'cancelled': '<span class="badge badge-secondary">Dibatalkan</span>'
            };
            
            return statusMap[statusLower] || `<span class="badge badge-secondary">${status}</span>`;
        }
        
        /**
         * Render workflow stepper based on current ticket status
         * Visual progress indicator showing which step ticket is on
         */
        function renderWorkflowStepper(status) {
            const statusLower = (status || 'baru').toLowerCase();
            
            // Define workflow steps
            const steps = [
                { key: 'process', icon: 'fas fa-play', label: 'Proses' },
                { key: 'otw', icon: 'fas fa-car', label: 'OTW' },
                { key: 'arrived', icon: 'fas fa-map-marker-alt', label: 'Tiba' },
                { key: 'working', icon: 'fas fa-wrench', label: 'Kerja' },
                { key: 'resolved', icon: 'fas fa-check', label: 'Selesai' }
            ];
            
            // Map statuses to step index (see TICKET_STATUS_STANDARD.md)
            const statusStepMap = {
                // Primary statuses
                'baru': -1,      // Not started yet
                'process': 0,    // Step 1: Proses
                'otw': 1,        // Step 2: OTW
                'arrived': 2,    // Step 3: Tiba
                'working': 3,    // Step 4: Kerja
                'resolved': 4,   // Step 5: Selesai
                // Backward compatibility aliases
                'pending': -1,
                'diproses teknisi': 0,
                'selesai': 4,
                'completed': 4
            };
            
            const currentStep = statusStepMap[statusLower] !== undefined ? statusStepMap[statusLower] : -1;
            
            let html = '<div class="workflow-stepper">';
            steps.forEach((step, index) => {
                let stepClass = 'workflow-step';
                if (index < currentStep) {
                    stepClass += ' completed';
                } else if (index === currentStep) {
                    stepClass += ' active';
                }
                
                html += `
                    <div class="${stepClass}">
                        <div class="step-icon">
                            <i class="${step.icon}"></i>
                        </div>
                        <span class="step-label">${step.label}</span>
                    </div>
                `;
            });
            html += '</div>';
            
            return html;
        }
        
        /**
         * Render action buttons dynamically based on ticket status
         * Following WhatsApp bot workflow: baru → process → otw → arrived → working → resolved
         */
        function renderActionButtons(row) {
            const ticketId = row.ticketId || row.id;
            const status = (row.status || 'baru').toLowerCase();
            const photoCount = (row.photos && Array.isArray(row.photos)) ? row.photos.length : 0;
            const hasMinPhotos = photoCount >= 2;
            
            // Safety check
            if (!ticketId) {
                return '<span class="text-danger small">Invalid Ticket ID</span>';
            }
            
            let html = '<div class="btn-group-vertical" style="width: 100%;">';
            
            switch(status) {
                case 'baru':
                    // New ticket - only "Proses" button
                    html += `
                        <button class="btn btn-sm btn-primary" 
                                onclick="showProcessModal('${ticketId}')" 
                                title="Ambil dan proses tiket ini">
                            <i class="fas fa-play action-btn-icon"></i> Proses
                        </button>
                    `;
                    break;
                    
                case 'process':
                case 'diproses teknisi':
                    // Processed - OTW button only (OTP sent to customer via WhatsApp)
                    html += `
                        <button class="btn btn-sm btn-info" 
                                onclick="otwTicket('${ticketId}')" 
                                title="Berangkat ke lokasi">
                            <i class="fas fa-car action-btn-icon"></i> OTW
                        </button>
                    `;
                    break;
                    
                case 'otw':
                    // On The Way - Share Location & Sampai buttons
                    html += `
                        <button class="btn btn-sm btn-primary" 
                                onclick="shareCurrentLocation('${ticketId}')" 
                                title="Bagikan lokasi terkini">
                            <i class="fas fa-location-arrow action-btn-icon"></i> Share Lokasi
                        </button>
                        <button class="btn btn-sm btn-warning" 
                                onclick="sampaiTicket('${ticketId}')" 
                                title="Tandai sudah sampai">
                            <i class="fas fa-map-marker-alt action-btn-icon"></i> Sampai
                        </button>
                    `;
                    break;
                    
                case 'arrived':
                    // Arrived - Verify OTP only (ask customer for OTP code)
                    html += `
                        <button class="btn btn-sm btn-success" 
                                onclick="showVerifyOtpModal('${ticketId}')" 
                                title="Verifikasi OTP dari pelanggan">
                            <i class="fas fa-check-circle action-btn-icon"></i> Verifikasi OTP
                        </button>
                    `;
                    break;
                    
                case 'working':
                    // Working - Upload Photo + Complete buttons
                    html += `
                        <button class="btn btn-sm btn-primary" 
                                onclick="showUploadPhotoModal('${ticketId}')" 
                                title="Upload foto dokumentasi">
                            <i class="fas fa-camera action-btn-icon"></i> 
                            Upload Foto <span class="badge badge-light">${photoCount}</span>
                        </button>
                        <button class="btn btn-sm btn-success ${hasMinPhotos ? '' : 'disabled'}" 
                                onclick="${hasMinPhotos ? `showCompleteModal('${ticketId}')` : 'return false;'}" 
                                title="${hasMinPhotos ? 'Selesaikan tiket' : 'Upload minimal 2 foto dulu'}"
                                ${hasMinPhotos ? '' : 'disabled'}>
                            <i class="fas fa-check-double action-btn-icon"></i> 
                            Selesai ${hasMinPhotos ? '✓' : '(Min 2 foto)'}
                        </button>
                    `;
                    break;
                    
                case 'resolved':
                case 'selesai':
                case 'completed':
                    // Completed - show success badge
                    html += `
                        <span class="badge badge-success p-2">
                            <i class="fas fa-check-double"></i> Tiket Selesai
                        </span>
                    `;
                    break;
                    
                default:
                    // Unknown status
                    html += `
                        <span class="text-muted small">
                            Status: ${status}
                        </span>
                    `;
            }
            
            html += '</div>';
            return html;
        }
        
        /**
         * Get current location using browser Geolocation API
         * Returns promise with location data
         */
        function getCurrentLocation() {
            return new Promise((resolve, reject) => {
                if (!navigator.geolocation) {
                    reject(new Error('Geolocation tidak didukung browser Anda'));
                    return;
                }
                
                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        resolve({
                            latitude: position.coords.latitude,
                            longitude: position.coords.longitude,
                            accuracy: position.coords.accuracy,
                            timestamp: new Date().toISOString()
                        });
                    },
                    (error) => {
                        reject(error);
                    },
                    {
                        enableHighAccuracy: true,
                        timeout: 10000,
                        maximumAge: 0
                    }
                );
            });
        }
        
        /**
         * Share current location for a ticket
         * Used when teknisi is already OTW and wants to update location
         */
        async function shareCurrentLocation(ticketId) {
            if (!ticketId) {
                displayGlobalMessage('ID Tiket tidak valid', 'danger');
                return;
            }
            
            try {
                displayGlobalMessage('🎐 Mendapatkan lokasi...', 'info');
                const locationData = await getCurrentLocation();
                
                // Send location update to server
                const response = await fetch('/api/ticket/share-location', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ 
                        ticketId,
                        location: locationData 
                    })
                });
                
                const result = await response.json();
                
                if (response.ok && result.status === 200) {
                    displayGlobalMessage(`✓ Lokasi berhasil dibagikan ke pelanggan`, 'success');
                    
                    // Show Google Maps link that was sent
                    const mapsUrl = `https://www.google.com/maps?q=${locationData.latitude},${locationData.longitude}`;
                    displayGlobalMessage(`🗺️ Link: ${mapsUrl}`, 'info');
                } else {
                    displayGlobalMessage(`Gagal membagikan lokasi: ${result.message || 'Error'}`, 'danger');
                }
            } catch (error) {
                console.error('Location sharing error:', error);
                if (error.code === 1) {
                    displayGlobalMessage('❌ Akses lokasi ditolak. Silakan izinkan akses lokasi di browser.', 'danger');
                } else if (error.code === 2) {
                    displayGlobalMessage('❌ Tidak dapat mendapatkan lokasi. Pastikan GPS aktif.', 'danger');
                } else if (error.code === 3) {
                    displayGlobalMessage('❌ Timeout mendapatkan lokasi. Silakan coba lagi.', 'warning');
                } else {
                    displayGlobalMessage('❌ Gagal mendapatkan lokasi', 'danger');
                }
            }
        }
        
        /**
         * Update ticket status to OTW (On The Way) with optional location sharing
         * Calls API endpoint created in Phase 1
         */
        async function otwTicket(ticketId) {
            if (!ticketId) {
                displayGlobalMessage('ID Tiket tidak valid', 'danger');
                return;
            }
            
            // Ask if user wants to share location
            const shareLocation = confirm(`Update status tiket ${ticketId} ke OTW (On The Way)?\n\nApakah Anda ingin membagikan lokasi real-time kepada pelanggan?`);
            
            let locationData = null;
            
            if (shareLocation) {
                // Get current location if user agrees
                try {
                    locationData = await getCurrentLocation();
                    displayGlobalMessage('📍 Lokasi berhasil didapatkan', 'info');
                } catch (error) {
                    console.error('Failed to get location:', error);
                    displayGlobalMessage('⚠️ Tidak dapat mengakses lokasi. Melanjutkan tanpa lokasi.', 'warning');
                }
            }
            
            try {
                const response = await fetch('/api/ticket/otw', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ 
                        ticketId,
                        location: locationData 
                    })
                });
                
                const result = await response.json();
                
                if (response.ok && result.status === 200) {
                    displayGlobalMessage(`✓ Status tiket ${ticketId} diupdate ke OTW. Pelanggan telah dinotifikasi.`, 'success');
                    loadTickets(); // Refresh table
                } else {
                    displayGlobalMessage(`Gagal update status OTW: ${result.message || 'Error tidak diketahui'}`, 'danger');
                }
            } catch (error) {
                console.error('[OTW_TICKET_ERROR]', error);
                displayGlobalMessage('Terjadi kesalahan koneksi saat update status OTW', 'danger');
            }
        }
        
        /**
         * Mark ticket as arrived at location
         * Calls API endpoint and shows OTP to technician
         */
        async function sampaiTicket(ticketId) {
            if (!ticketId) {
                displayGlobalMessage('ID Tiket tidak valid', 'danger');
                return;
            }
            
            // Confirm action
            if (!confirm(`Konfirmasi sudah sampai di lokasi untuk tiket ${ticketId}?`)) {
                return;
            }
            
            try {
                const response = await fetch('/api/ticket/arrived', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ ticketId })
                });
                
                const result = await response.json();
                
                if (response.ok && result.status === 200) {
                    displayGlobalMessage(`✓ Anda sudah tiba di lokasi. Silakan minta kode OTP dari pelanggan untuk verifikasi.`, 'success');
                    
                    // Do NOT show OTP to teknisi - they must ask customer for it!
                    // This is the correct workflow per security requirements
                    
                    loadTickets(); // Refresh table
                } else {
                    displayGlobalMessage(`Gagal update status arrived: ${result.message || 'Error tidak diketahui'}`, 'danger');
                }
            } catch (error) {
                console.error('[SAMPAI_TICKET_ERROR]', error);
                displayGlobalMessage('Terjadi kesalahan koneksi saat update status arrived', 'danger');
            }
        }
        
        /**
         * showOTP function REMOVED
         * Teknisi should NEVER see the OTP!
         * 
         * CORRECT WORKFLOW:
         * 1. Teknisi process ticket → OTP sent to CUSTOMER via WhatsApp
         * 2. Teknisi arrives at location → Teknisi ASKS customer for OTP
         * 3. Customer gives OTP → Teknisi inputs in verification modal
         * 4. System verifies OTP → Work session starts
         * 
         * This ensures customer is present and verifies teknisi identity
         */
        
        /**
         * Show OTP verification modal
         * For technician to input OTP received from customer
         */
        function showVerifyOtpModal(ticketId) {
            if (!ticketId) {
                displayGlobalMessage('ID Tiket tidak valid', 'danger');
                return;
            }
            
            // Store ticketId in hidden field
            $('#verifyOtpTicketId').val(ticketId);
            
            // Clear input field
            $('#otpInput').val('');
            
            // Show modal
            $('#verifyOtpModal').modal('show');
            
            // Focus on input after modal shown
            $('#verifyOtpModal').on('shown.bs.modal', function() {
                $(this).removeAttr('aria-hidden');
                $(this).attr('aria-modal', 'true');
                $('#otpInput').focus();
            })
        }
        
        /**
         * Verify OTP and start work session
         * Validates OTP and calls API endpoint
         */
        async function verifyOTP() {
            const ticketId = $('#verifyOtpTicketId').val();
            const otp = $('#otpInput').val().trim();
            
            // Validation
            if (!ticketId) {
                displayGlobalMessage('ID Tiket tidak valid', 'danger');
                return;
            }
            
            if (!otp || otp.length !== 6) {
                displayGlobalMessage('OTP harus 6 digit angka', 'warning');
                $('#otpInput').focus();
                return;
            }
            
            // Validate numeric
            if (!/^\d{6}$/.test(otp)) {
                displayGlobalMessage('OTP hanya boleh berisi angka', 'warning');
                $('#otpInput').focus();
                return;
            }
            
            try {
                const response = await fetch('/api/ticket/verify-otp', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ ticketId, otp })
                });
                
                const result = await response.json();
                
                if (response.ok && result.status === 200) {
                    // Blur focus before closing modal
                    $('#verifyOtpModal').find(':focus').blur();
                    // Close modal
                    $('#verifyOtpModal').modal('hide');
                    
                    displayGlobalMessage(`✓ OTP berhasil diverifikasi! Mulai pekerjaan sekarang. Jangan lupa upload minimal 2 foto.`, 'success');
                    
                    // Refresh table
                    loadTickets();
                } else {
                    displayGlobalMessage(`Verifikasi gagal: ${result.message || 'OTP salah atau tidak valid'}`, 'danger');
                    $('#otpInput').val('').focus();
                }
            } catch (error) {
                console.error('[VERIFY_OTP_ERROR]', error);
                displayGlobalMessage('Terjadi kesalahan koneksi saat verifikasi OTP', 'danger');
            }
        }
        
        /**
         * Global state for photo uploads
         */
        let currentUploadTicketId = null;
        let uploadedPhotos = [];
        
        /**
         * Show photo upload modal
         */
        function showUploadPhotoModal(ticketId) {
            if (!ticketId) {
                displayGlobalMessage('ID Tiket tidak valid', 'danger');
                return;
            }
            
            // Store ticketId
            currentUploadTicketId = ticketId;
            $('#uploadPhotoTicketId').val(ticketId);
            
            // Get current photo count from ticket data
            const table = $('#ticketsTable').DataTable();
            const allData = table.rows().data().toArray();
            const ticket = allData.find(t => (t.ticketId === ticketId || t.id === ticketId));
            
            if (ticket && ticket.photos && Array.isArray(ticket.photos)) {
                uploadedPhotos = ticket.photos;
            } else {
                uploadedPhotos = [];
            }
            
            // Update display
            updatePhotoDisplay();
            
            // Clear file input
            $('#photoInput').val('');
            
            // Show modal
            $('#uploadPhotoModal').modal('show');
        }
        
        /**
         * Handle photo file selection and upload
         */
        $('#photoInput').on('change', async function(e) {
            const files = e.target.files;
            
            if (!files || files.length === 0) {
                return;
            }
            
            const ticketId = currentUploadTicketId;
            if (!ticketId) {
                displayGlobalMessage('Error: Ticket ID tidak ditemukan', 'danger');
                return;
            }
            
            // Check max photos limit
            if (uploadedPhotos.length >= 5) {
                displayGlobalMessage('Maksimal 5 foto sudah tercapai', 'warning');
                $('#photoInput').val('');
                return;
            }
            
            // Upload each file
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                
                // Check if would exceed limit
                if (uploadedPhotos.length >= 5) {
                    displayGlobalMessage('Maksimal 5 foto. Foto berikutnya tidak diupload.', 'warning');
                    break;
                }
                
                // Validate file size (5MB)
                if (file.size > 5 * 1024 * 1024) {
                    displayGlobalMessage(`File ${file.name} terlalu besar (max 5MB)`, 'warning');
                    continue;
                }
                
                // Validate image type
                if (!file.type.startsWith('image/')) {
                    displayGlobalMessage(`File ${file.name} bukan gambar`, 'warning');
                    continue;
                }
                
                // Upload photo
                await uploadSinglePhoto(ticketId, file);
            }
            
            // Clear input so same file can be selected again
            $('#photoInput').val('');
        });
        
        /**
         * Upload single photo to server
         */
        async function uploadSinglePhoto(ticketId, file) {
            const formData = new FormData();
            formData.append('ticketId', ticketId);
            formData.append('photo', file);
            
            try {
                const response = await fetch('/api/ticket/upload-photo', {
                    method: 'POST',
                    credentials: 'include',
                    body: formData // Don't set Content-Type, browser will set it with boundary
                });
                
                const result = await response.json();
                
                if (response.ok && result.status === 200) {
                    // Add to uploaded photos array
                    uploadedPhotos.push(result.data.photo);
                    
                    // Update display
                    updatePhotoDisplay();
                    
                    displayGlobalMessage(`✓ Foto ${uploadedPhotos.length} berhasil diupload`, 'success');
                } else {
                    displayGlobalMessage(`Upload gagal: ${result.message || 'Error'}`, 'danger');
                }
            } catch (error) {
                console.error('[UPLOAD_PHOTO_ERROR]', error);
                displayGlobalMessage('Terjadi kesalahan saat upload foto', 'danger');
            }
        }
        
        /**
         * Update photo display in modal
         */
        function updatePhotoDisplay() {
            const photoCount = uploadedPhotos.length;
            const minPhotos = 2;
            const canComplete = photoCount >= minPhotos;
            
            // Update badge
            $('#photoCountBadge').text(photoCount);
            
            // Update complete button state
            if (canComplete) {
                $('#completePhotoUploadBtn').prop('disabled', false)
                    .removeClass('btn-secondary').addClass('btn-success');
            } else {
                $('#completePhotoUploadBtn').prop('disabled', true)
                    .removeClass('btn-success').addClass('btn-secondary');
            }
            
            // Render photo previews
            const container = $('#photoPreviewContainer');
            container.empty();
            
            uploadedPhotos.forEach((photo, index) => {
                const photoPath = photo.path || photo;
                const html = `
                    <div class="photo-preview-item">
                        <img src="${photoPath}" alt="Foto ${index + 1}">
                        <div class="text-center mt-1">
                            <small class="text-muted">Foto ${index + 1}</small>
                        </div>
                    </div>
                `;
                container.append(html);
            });
            
            // Show message if no photos yet
            if (photoCount === 0) {
                container.html('<p class="text-muted">Belum ada foto terupload</p>');
            }
        }
        
        /**
         * Handle complete photo upload button
         */
        $('#completePhotoUploadBtn').on('click', function() {
            const photoCount = uploadedPhotos.length;
            
            if (photoCount < 2) {
                displayGlobalMessage('Minimal 2 foto diperlukan', 'warning');
                return;
            }
            
            // Close modal
            $('#uploadPhotoModal').modal('hide');
            
            // Show success message
            displayGlobalMessage(`✓ ${photoCount} foto dokumentasi berhasil. Sekarang bisa selesaikan tiket.`, 'success');
            
            // Refresh table to update button states
            loadTickets();
        });
        
        /**
         * Show complete ticket modal with photo preview and resolution notes
         */
        function showCompleteModal(ticketId) {
            if (!ticketId) {
                displayGlobalMessage('ID Tiket tidak valid', 'danger');
                return;
            }
            
            // Get ticket data from DataTable
            const table = $('#ticketsTable').DataTable();
            const allData = table.rows().data().toArray();
            const ticket = allData.find(t => (t.ticketId === ticketId || t.id === ticketId));
            
            if (!ticket) {
                displayGlobalMessage('Data tiket tidak ditemukan', 'danger');
                return;
            }
            
            // Check minimum photos requirement
            const photoCount = (ticket.photos && Array.isArray(ticket.photos)) ? ticket.photos.length : 0;
            if (photoCount < 2) {
                displayGlobalMessage('Upload minimal 2 foto terlebih dahulu sebelum menyelesaikan tiket', 'warning');
                return;
            }
            
            // Store ticketId
            $('#completeTicketId').val(ticketId);
            
            // Clear resolution notes
            $('#resolutionNotes').val('');
            
            // Display photos in modal
            const photoContainer = $('#completedPhotosPreview');
            photoContainer.empty();
            
            if (ticket.photos && ticket.photos.length > 0) {
                ticket.photos.forEach((photo, index) => {
                    const photoPath = photo.path || photo;
                    const html = `
                        <div class="photo-preview-item">
                            <img src="${photoPath}" alt="Foto ${index + 1}">
                            <div class="text-center mt-1">
                                <small class="text-muted">Foto ${index + 1}</small>
                            </div>
                        </div>
                    `;
                    photoContainer.append(html);
                });
            } else {
                photoContainer.html('<p class="text-muted">Tidak ada foto</p>');
            }
            
            // Show modal
            $('#completeTicketModal').modal('show');
            
            // Focus on resolution notes after modal shown
            $('#completeTicketModal').on('shown.bs.modal', function() {
                $('#resolutionNotes').focus();
            });
        }
        
        /**
         * Complete ticket with resolution notes
         * Final step in the workflow
         */
        async function completeTicket() {
            const ticketId = $('#completeTicketId').val();
            const resolutionNotes = $('#resolutionNotes').val().trim();
            
            // Validation
            if (!ticketId) {
                displayGlobalMessage('ID Tiket tidak valid', 'danger');
                return;
            }
            
            if (!resolutionNotes) {
                displayGlobalMessage('Catatan penyelesaian harus diisi', 'warning');
                $('#resolutionNotes').focus();
                return;
            }
            
            if (resolutionNotes.length < 10) {
                displayGlobalMessage('Catatan penyelesaian minimal 10 karakter', 'warning');
                $('#resolutionNotes').focus();
                return;
            }
            
            // Confirm action
            if (!confirm(`Selesaikan tiket ${ticketId}?\n\nSetelah diselesaikan, tiket tidak bisa diubah lagi.`)) {
                return;
            }
            
            try {
                const response = await fetch('/api/ticket/complete', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ 
                        ticketId, 
                        resolutionNotes 
                    })
                });
                
                const result = await response.json();
                
                if (response.ok && result.status === 200) {
                    // Close modal
                    $('#completeTicketModal').modal('hide');
                    
                    // Show success message with duration info
                    const duration = result.data.duration || 0;
                    const photoCount = result.data.photoCount || 0;
                    
                    displayGlobalMessage(
                        `✅ Tiket ${ticketId} berhasil diselesaikan!\n` +
                        `Durasi: ${duration} menit | Foto: ${photoCount} dokumentasi\n` +
                        `Pelanggan telah dinotifikasi.`,
                        'success'
                    );
                    
                    // Refresh table
                    loadTickets();
                    
                    // Clear form
                    $('#resolutionNotes').val('');
                    $('#completeTicketId').val('');
                } else {
                    displayGlobalMessage(
                        `Gagal menyelesaikan tiket: ${result.message || 'Error tidak diketahui'}`,
                        'danger'
                    );
                }
            } catch (error) {
                console.error('[COMPLETE_TICKET_ERROR]', error);
                displayGlobalMessage('Terjadi kesalahan koneksi saat menyelesaikan tiket', 'danger');
            }
        }
        
        async function executeProcessTicket(ticketId) {
            if (!ticketId) {
                displayGlobalMessage('Terjadi kesalahan: ID Tiket tidak ditemukan untuk diproses.', 'danger');
                return;
            }
            try {
                console.log(`[PROCESS_TICKET] Attempting to process ticket: ${ticketId}`);
                const response = await fetch('/api/ticket/process', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ ticketId })
                });
                
                console.log(`[PROCESS_TICKET] Response status: ${response.status}`);
                
                const result = await response.json();
                console.log(`[PROCESS_TICKET] Response data:`, result);
                
                if (response.ok && result.status === 200) {
                    displayGlobalMessage(`✓ Tiket ${ticketId} berhasil diproses! OTP telah dikirim ke pelanggan.`, 'success');
                    
                    // Do NOT show OTP to teknisi!
                    // OTP is sent to customer via WhatsApp
                    // Teknisi will ask customer for OTP when arrived at location
                    
                    loadTickets(); // Refresh daftar tiket
                } else {
                    console.error(`[PROCESS_TICKET] Error response:`, result);
                    displayGlobalMessage(`Gagal memproses tiket ${ticketId}: ${result.message || 'Error tidak diketahui.'}`, 'danger');
                }
            } catch (error) {
                console.error('[PROCESS_TICKET] Exception:', error);
                displayGlobalMessage(`Terjadi kesalahan koneksi saat memproses tiket ${ticketId}.`, 'danger');
            }
        }

        async function loadTickets(retryCount = 0) {
            // Prevent race condition - jangan load jika masih ada request yang berjalan
            if (isLoadingTickets) {
                console.log('[LOAD_TICKETS] Already loading, skipping duplicate request.');
                return;
            }

            const MAX_RETRIES = 2;
            const dataTable = $('#ticketsTable').DataTable();
            isLoadingTickets = true;
            
            // Note: DataTable processing indicator handled automatically by "processing": true option

            try {
                // CRITICAL: Include ALL active workflow statuses (see TICKET_STATUS_STANDARD.md)
                // Active: baru, process, otw, arrived, working
                // Backward compat: pending, diproses teknisi
                const statusParam = encodeURIComponent('baru,pending,process,diproses teknisi,otw,arrived,working');
                const response = await fetch(`/api/tickets?status=${statusParam}&_=${new Date().getTime()}`, {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    credentials: 'same-origin'
                });

                // Handle specific HTTP errors
                if (!response.ok) {
                    if (response.status === 404) {
                        throw new Error('Endpoint API tidak ditemukan. Hubungi administrator sistem.');
                    } else if (response.status === 403) {
                        throw new Error('Akses ditolak. Anda tidak memiliki izin untuk melihat data tiket.');
                    } else if (response.status === 401) {
                        throw new Error('Sesi Anda telah berakhir. Silakan login kembali.');
                        // Redirect to login after 2 seconds
                        setTimeout(() => window.location.href = '/login', 2000);
                    } else if (response.status >= 500) {
                        throw new Error(`Server error (${response.status}). Coba lagi dalam beberapa saat.`);
                    }
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const result = await response.json();

                // Validasi response structure
                if (!result || typeof result !== 'object') {
                    throw new Error('Response data tidak valid dari server.');
                }

                // Validasi result.data adalah array
                const tickets = Array.isArray(result.data) ? result.data : [];

                // Log untuk debugging
                console.log(`[LOAD_TICKETS] Berhasil memuat ${tickets.length} tiket aktif.`);
                if (tickets.length > 0) {
                    const statusSummary = tickets.reduce((acc, t) => {
                        acc[t.status] = (acc[t.status] || 0) + 1;
                        return acc;
                    }, {});
                    console.log('[LOAD_TICKETS] Status breakdown:', statusSummary);
                }

                // Update DataTable dengan data baru
                dataTable.clear().rows.add(tickets).draw();

                // Clear any previous error messages
                if (retryCount === 0 && tickets.length === 0) {
                    console.log('[LOAD_TICKETS] Tidak ada tiket aktif. Filter: baru, pending, process, diproses teknisi, otw, arrived, working');
                }

            } catch (error) {
                console.error('[LOAD_TICKETS_ERROR]', error);

                // Retry logic untuk network errors
                if (retryCount < MAX_RETRIES && (error.message.includes('fetch') || error.message.includes('network'))) {
                    console.log(`[LOAD_TICKETS] Retry attempt ${retryCount + 1}/${MAX_RETRIES} after network error...`);
                    await new Promise(resolve => setTimeout(resolve, 1500 * (retryCount + 1)));
                    isLoadingTickets = false;
                    return loadTickets(retryCount + 1);
                }

                // Show user-friendly error message
                const errorMessage = error.message || 'Gagal memuat data tiket. Coba refresh halaman.';
                displayGlobalMessage(errorMessage, 'danger');

                // Clear table on error
                dataTable.clear().draw();

            } finally {
                // Always reset flag
                isLoadingTickets = false;
            }
        }

        document.addEventListener('DOMContentLoaded', function() {
            // Fix for modal aria-hidden issue
            $('#createTicketModal').on('show.bs.modal', function () {
                // Remove focus from any active element before showing modal
                document.activeElement.blur();
            });
            
            $('#createTicketModal').on('shown.bs.modal', function () {
                $(this).removeAttr('aria-hidden');
                $(this).attr('aria-modal', 'true');
                // Focus on first input instead of close button
                $('#customerSelect').select2('focus');
            });
            
            $('#createTicketModal').on('hide.bs.modal', function () {
                // Blur any focused element in the modal before hiding
                $(this).find(':focus').blur();
            });
            
            $('#createTicketModal').on('hidden.bs.modal', function () {
                // Reset form values after modal is completely hidden
                document.getElementById('createTicketForm').reset();
                $('#customerSelect').val(null).trigger('change');
                // Return focus to the trigger button
                $('[data-target="#createTicketModal"]').focus();
            });
            
            // Fix for verifyOtpModal aria-hidden issue
            $('#verifyOtpModal').on('show.bs.modal', function () {
                document.activeElement.blur();
            });
            
            $('#verifyOtpModal').on('hide.bs.modal', function () {
                $(this).find(':focus').blur();
            });
            
            $('#verifyOtpModal').on('hidden.bs.modal', function () {
                $('#otpInput').val('');  // Clear OTP input
            });
            
            // Fix for uploadPhotoModal aria-hidden issue
            $('#uploadPhotoModal').on('show.bs.modal', function () {
                document.activeElement.blur();
            });
            
            $('#uploadPhotoModal').on('shown.bs.modal', function () {
                $(this).removeAttr('aria-hidden');
                $(this).attr('aria-modal', 'true');
            });
            
            $('#uploadPhotoModal').on('hide.bs.modal', function () {
                $(this).find(':focus').blur();
            });
            
            $('#uploadPhotoModal').on('hidden.bs.modal', function () {
                // Clear photo input and reset state
                $('#photoInput').val('');
                uploadedPhotos = [];
                updatePhotoDisplay();
            });
            
            // Fix for processTicketModal aria-hidden issue
            $('#processTicketModal').on('show.bs.modal', function () {
                document.activeElement.blur();
            });
            
            $('#processTicketModal').on('shown.bs.modal', function () {
                $(this).removeAttr('aria-hidden');
                $(this).attr('aria-modal', 'true');
                $('#confirmProcessTicketBtn').focus();
            });
            
            $('#processTicketModal').on('hide.bs.modal', function () {
                $(this).find(':focus').blur();
            });
            
            $('#processTicketModal').on('hidden.bs.modal', function () {
                $('#confirmProcessTicketBtn').removeAttr('data-ticket-id');
                // Return focus to the process button that opened it
                $('button[onclick*="showProcessModal"]').first().focus();
            });
            
            // Initialize Select2 for customer dropdown
            $('#customerSelect').select2({
                theme: "bootstrap",
                dropdownParent: $('#createTicketModal'),
                placeholder: 'Cari dan pilih pelanggan...',
                allowClear: true,
                dropdownAutoWidth: true,
                ajax: {
                    url: '/api/users',
                    dataType: 'json',
                    delay: 250,
                    data: function (params) {
                        return {
                            search: params.term,
                            page: params.page || 1,
                            role: 'pelanggan'
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

            // Handle create ticket form submission
            document.getElementById('createTicketForm').addEventListener('submit', async function(event) {
                event.preventDefault();
                const customerUserId = document.getElementById('customerSelect').value;
                const laporanText = document.getElementById('laporanTextInput').value;
                const priority = document.getElementById('prioritySelect').value;
                const issueType = document.getElementById('issueTypeSelect').value;
                const submitBtn = document.getElementById('submitNewTicketBtn');

                if (!customerUserId) {
                    displayGlobalMessage('Silakan pilih pelanggan', 'warning');
                    return;
                }

                submitBtn.disabled = true;
                submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Membuat tiket...';

                try {
                    const response = await fetch('/api/ticket/create', {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        credentials: 'include',
                        body: JSON.stringify({
                            customerUserId,
                            laporanText,
                            priority,
                            issueType
                        })
                    });
                    const result = await response.json();

                    if (response.ok && (result.status === 201 || result.status === 200)) {
                        displayGlobalMessage(result.message || 'Tiket berhasil dibuat dan teknisi telah dinotifikasi', 'success');
                        // Blur focus before hiding modal to prevent aria-hidden warning
                        $('#createTicketModal').find(':focus').blur();
                        $('#createTicketModal').modal('hide');
                        loadTickets(); // Refresh ticket list
                    } else {
                        displayGlobalMessage(result.message || 'Gagal membuat tiket', 'danger');
                    }
                } catch(error) {
                    console.error('Error creating ticket:', error);
                    displayGlobalMessage('Terjadi kesalahan koneksi saat membuat tiket', 'danger');
                } finally {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = 'Buat Tiket';
                }
            });

            // Inisialisasi DataTable sekali saat halaman dimuat
            $('#ticketsTable').DataTable({
                "data": [], // Mulai dengan data kosong
                "columns": [
                    { 
                        "title": "ID Tiket",
                        "data": null,
                        "render": function(data, type, row) {
                            const ticketId = row.ticketId || row.id || 'N/A';
                            return `<strong>${ticketId}</strong>`;
                        }
                    },
                    { 
                        "title": "Pelanggan",
                        "data": null, 
                        "render": function(data, type, row) {
                            const name = row.pelangganName || row.user_name || 'N/A';
                            const phone = row.pelangganPhone || row.user_phone || 'N/A';
                            return `<strong>${name}</strong><br><small class="text-muted">${phone}</small>`;
                        }
                    },
                    { 
                        "title": "Isi Laporan",
                        "data": null,
                        "render": function(data, type, row) {
                            const laporan = row.laporanText || row.description || row.laporan || '-';
                            // Limit text to 100 chars
                            return laporan.length > 100 ? laporan.substring(0, 100) + '...' : laporan;
                        }
                    },
                    { 
                        "title": "Status",
                        "data": "status", 
                        "render": function(data, type, row) {
                            return getStatusBadge(data);
                        }
                    },
                    {
                        "title": "Progress",
                        "data": null,
                        "orderable": false,
                        "render": function(data, type, row) {
                            // Only show workflow stepper if ticket is being processed
                            const status = (row.status || '').toLowerCase();
                            if (status === 'baru') {
                                return '<span class="text-muted small"><i class="fas fa-hourglass-start"></i> Belum diproses</span>';
                            }
                            return renderWorkflowStepper(row.status);
                        },
                        "className": "text-center"
                    },
                    { 
                        "title": "Teknisi",
                        "data": null,
                        "render": function(data, type, row) {
                            const teknisiName = row.teknisiName || row.processedByTeknisiName || row.processedBy || row.processed_by;
                            if (teknisiName) {
                                const processedAt = row.processedAt || row.processed_at;
                                const timeStr = processedAt ? new Date(processedAt).toLocaleString('id-ID', { dateStyle:'short', timeStyle:'short'}) : '';
                                return `<strong>${teknisiName}</strong>${timeStr ? '<br><small class="text-muted">' + timeStr + '</small>' : ''}`;
                            }
                            return '<span class="text-muted">-</span>';
                        }
                    },
                    { 
                        "title": "Aksi",
                        "data": null,
                        "orderable": false,
                        "className": "action-buttons",
                        "render": function(data, type, row) {
                            // NOTE: renderActionButtons() will be created in Phase 3.2
                            // For now, just show status
                            if (typeof renderActionButtons === 'function') {
                                return renderActionButtons(row);
                            }
                            
                            // Fallback rendering for Phase 3.1
                            const ticketId = row.ticketId || row.id;
                            const status = (row.status || 'baru').toLowerCase();
                            
                            if (status === 'baru') {
                                return `<button class="btn btn-sm btn-primary" title="Proses Tiket Ini" onclick="showProcessModal('${ticketId}')">
                                    <i class="fas fa-play"></i> Proses
                                </button>`;
                            }
                            
                            return '<span class="badge badge-secondary">Waiting for Phase 3.2</span>';
                        }
                    }
                ],
                "order": [[ 0, "desc" ]], // Urutkan berdasarkan ID Tiket (newest first)
                "processing": true, // Mengaktifkan indikator "processing"
                "pageLength": 10,
                "responsive": true, // Tambahkan responsive untuk mobile
                "language": {
                    "emptyTable": "Tidak ada data tiket yang tersedia",
                    "info": "Menampilkan _START_ sampai _END_ dari _TOTAL_ tiket",
                    "infoEmpty": "Menampilkan 0 sampai 0 dari 0 tiket",
                    "infoFiltered": "(difilter dari _MAX_ total tiket)",
                    "lengthMenu": "Tampilkan _MENU_ tiket per halaman",
                    "loadingRecords": "Memuat...",
                    "processing": "Sedang memproses...",
                    "search": "Cari:",
                    "zeroRecords": "Tidak ada tiket yang cocok ditemukan",
                    "paginate": {
                        "first": "Pertama",
                        "last": "Terakhir",
                        "next": "Berikutnya",
                        "previous": "Sebelumnya"
                    }
                }
            });

            // Panggil loadTickets setelah inisialisasi selesai
            loadTickets(); 

            // Fix: Perbaiki event listener untuk mencegah memory leak
            const processModal = document.getElementById('processTicketModal');
            const confirmBtn = document.getElementById('confirmProcessTicketBtn');
            
            if(confirmBtn) {
                // Gunakan jQuery untuk event handling yang lebih clean
                $(confirmBtn).off('click').on('click', function() {
                    const ticketId = $(this).attr('data-ticket-id');
                    $('#processTicketModal').modal('hide'); 
                    if(ticketId) { 
                        executeProcessTicket(ticketId); 
                    } else {
                        console.error("[PROCESS_TICKET_ERROR] Confirm button clicked without ticketId");
                        displayGlobalMessage('Gagal memproses: ID Tiket tidak ditemukan.', 'danger');
                    }
                });
            }
            
            // Already handled in the DOMContentLoaded event listener above
            
            // Event handler for OTP verification button
            $('#confirmVerifyOtpBtn').off('click').on('click', function() {
                verifyOTP();
            });
            
            // Allow Enter key to submit OTP
            $('#otpInput').off('keypress').on('keypress', function(e) {
                if (e.which === 13) { // Enter key
                    e.preventDefault();
                    verifyOTP();
                }
            });
            
            // Event handler for complete ticket button
            $('#confirmCompleteTicketBtn').off('click').on('click', function() {
                completeTicket();
            });
            
            // Note: Old resolveTicketForm has been removed in Phase 2
            // Ticket completion now handled through workflow modals (showCompleteModal)
        });

        // Socket.IO listener dengan debounce untuk prevent multiple rapid calls
        const socket = io();
        
        socket.on('ticket_processed', function(data) {
            // Cek apakah tiket diproses oleh orang lain, bukan diri sendiri
            if (currentUser && data.processedById && String(currentUser.id) !== String(data.processedById)) {
                console.log('[SOCKET_EVENT] Menerima event ticket_processed dari user lain:', data);
                displayGlobalMessage(`Info: Tiket ${data.ticketId} telah diproses oleh teknisi ${data.processedBy}. Daftar diperbarui.`, 'info');
                
                // Debounce loadTickets to prevent rapid successive calls
                if (ticketProcessedTimeout) {
                    clearTimeout(ticketProcessedTimeout);
                }
                ticketProcessedTimeout = setTimeout(() => {
                    loadTickets(); // Muat ulang daftar tiket
                }, 1000); // Tambahkan delay lebih lama untuk stabilitas
            } else {
                console.log('[SOCKET_EVENT] Menerima event ticket_processed dari diri sendiri, diabaikan untuk notifikasi global.', data);
            }
        });
        
        // Handle socket connection errors dengan reconnection strategy
        socket.on('connect_error', function(error) {
            console.error('[SOCKET_ERROR] Connection error:', error);
            // Tampilkan pesan hanya jika error berlanjut
            if (socket.disconnected) {
                displayGlobalMessage('Koneksi ke server terputus. Mencoba menghubungkan kembali...', 'warning');
            }
        });
        
        socket.on('reconnect', function(attemptNumber) {
            console.log('[SOCKET_RECONNECT] Reconnected after', attemptNumber, 'attempts');
            displayGlobalMessage('Koneksi ke server berhasil dipulihkan.', 'success');
            // Reload tickets setelah reconnect
            loadTickets();
        });
        
        socket.on('disconnect', function(reason) {
            console.warn('[SOCKET_DISCONNECT] Disconnected:', reason);
            if (reason === 'io server disconnect') {
                // Server disconnected, try to reconnect
                socket.connect();
            }
        });

        // Fungsi helper untuk memisahkan logika modal
        function showProcessModal(ticketId) {
            if (!ticketId) {
                console.error('[SHOW_PROCESS_MODAL] No ticketId provided');
                return;
            }
            document.getElementById('confirmProcessTicketBtn').setAttribute('data-ticket-id', ticketId);
            $('#processTicketModal').modal('show');
        }
        
        // Auto-refresh setiap 30 detik untuk data terbaru (optional)
        setInterval(function() {
            if (!isLoadingTickets && document.visibilityState === 'visible') {
                console.log('[AUTO_REFRESH] Refreshing ticket data...');
                loadTickets();
            }
        }, 30000);
    </script>
</body>
</html>