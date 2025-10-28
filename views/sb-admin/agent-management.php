<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no">
    <title>Agent Management - RAF NET</title>
    
    <!-- Custom fonts -->
    <link href="/vendor/fontawesome-free/css/all.min.css" rel="stylesheet">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    
    <!-- Custom styles -->
    <link href="/css/sb-admin-2.min.css" rel="stylesheet">
    <link href="/vendor/datatables/dataTables.bootstrap4.min.css" rel="stylesheet">
    <link href="/css/dashboard-modern.css" rel="stylesheet">
    
    <style>
        .agent-card {
            border-left: 3px solid var(--primary);
            transition: all 0.3s;
            background: #ffffff;
            border-radius: 8px;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }
        .agent-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        }
        .service-badge {
            display: inline-block;
            padding: 0.25rem 0.5rem;
            margin: 0.1rem;
            border-radius: 6px;
            font-size: 0.75rem;
            font-weight: 600;
        }
        .service-topup { background-color: var(--success); color: white; }
        .service-voucher { background-color: var(--info); color: white; }
        .service-pembayaran { background-color: var(--warning); color: white; }
        .status-active { color: var(--success); }
        .status-inactive { color: var(--danger); }
    </style>
</head>

<body id="page-top">
    <div id="wrapper">
        <?php include '_navbar.php'; ?>
        
        <div id="content-wrapper" class="d-flex flex-column">
            <div id="content">
                <?php include 'topbar.php'; ?>
                
                <div class="container-fluid">
                    <div class="dashboard-header">
                        <div class="d-flex align-items-center justify-content-between">
                            <div>
                                <h1>Agent Management</h1>
                                <p>Kelola agent dan outlet untuk topup saldo</p>
                            </div>
                            <button class="btn btn-primary-custom" onclick="showAddAgentModal()">
                                <i class="fas fa-plus"></i> Tambah Agent
                            </button>
                        </div>
                    </div>
                    
                    <!-- Statistics Cards -->
                    <h4 class="dashboard-section-title">Statistik Agent</h4>
                    <div class="row match-height mb-4">
                        <div class="col-xl-3 col-md-6 mb-4">
                            <div class="card dashboard-card card-primary">
                                <div class="card-body">
                                    <div class="card-content">
                                        <div class="card-info">
                                            <div class="card-title-text">Total Agent</div>
                                            <div class="card-value" id="totalAgents">0</div>
                                            <div class="card-subtitle">
                                                <i class="fas fa-circle" style="font-size: 8px;"></i>
                                                <span>Registered</span>
                                            </div>
                                        </div>
                                        <div class="card-icon-container">
                                            <i class="fas fa-store"></i>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <div class="col-xl-3 col-md-6 mb-4">
                            <div class="card dashboard-card card-success">
                                <div class="card-body">
                                    <div class="card-content">
                                        <div class="card-info">
                                            <div class="card-title-text">Agent Aktif</div>
                                            <div class="card-value" id="activeAgents">0</div>
                                            <div class="card-subtitle">
                                                <span class="card-change positive">
                                                    <i class="fas fa-check-circle"></i> Active
                                                </span>
                                            </div>
                                        </div>
                                        <div class="card-icon-container">
                                            <i class="fas fa-check-circle"></i>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <div class="col-xl-3 col-md-6 mb-4">
                            <div class="card dashboard-card card-info">
                                <div class="card-body">
                                    <div class="card-content">
                                        <div class="card-info">
                                            <div class="card-title-text">Area Terlayani</div>
                                            <div class="card-value" id="totalAreas">0</div>
                                            <div class="card-subtitle">
                                                <i class="fas fa-circle" style="font-size: 8px;"></i>
                                                <span>Locations</span>
                                            </div>
                                        </div>
                                        <div class="card-icon-container">
                                            <i class="fas fa-map-marked-alt fa-2x text-gray-300"></i>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <div class="col-xl-3 col-md-6 mb-4">
                            <div class="card dashboard-card card-warning">
                                <div class="card-body">
                                    <div class="card-content">
                                        <div class="card-info">
                                            <div class="card-title-text">Total Layanan</div>
                                            <div class="card-value" id="totalServices">0</div>
                                            <div class="card-subtitle">
                                                <i class="fas fa-circle" style="font-size: 8px;"></i>
                                                <span>Services</span>
                                            </div>
                                        </div>
                                        <div class="card-icon-container">
                                            <i class="fas fa-clipboard-list"></i>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Agent List -->
                    <h4 class="dashboard-section-title">Daftar Agent</h4>
                    <div class="card table-card mb-4">
                        <div class="card-header">
                            <h6>Daftar Agent</h6>
                        </div>
                        <div class="card-body">
                            <div class="table-responsive">
                                <table class="table table-bordered" id="agentTable" width="100%" cellspacing="0">
                                    <thead>
                                        <tr>
                                            <th>ID</th>
                                            <th>Nama Agent</th>
                                            <th>Telepon</th>
                                            <th>Area</th>
                                            <th>Alamat</th>
                                            <th>Layanan</th>
                                            <th>Jam Operasional</th>
                                            <th>Status</th>
                                            <th>Aksi</th>
                                        </tr>
                                    </thead>
                                    <tbody id="agentTableBody">
                                        <!-- Data will be loaded here -->
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <?php include 'footer.php'; ?>
        </div>
    </div>
    
    <!-- Add/Edit Agent Modal -->
    <div class="modal fade" id="agentModal" tabindex="-1" role="dialog">
        <div class="modal-dialog modal-lg" role="document">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title" id="agentModalTitle">Tambah Agent</h5>
                    <button type="button" class="close" data-dismiss="modal">
                        <span>&times;</span>
                    </button>
                </div>
                <div class="modal-body">
                    <form id="agentForm">
                        <input type="hidden" id="agentId">
                        
                        <div class="form-row">
                            <div class="form-group col-md-6">
                                <label>Nama Agent *</label>
                                <input type="text" class="form-control" id="agentName" required>
                            </div>
                            <div class="form-group col-md-6">
                                <label>Nomor Telepon *</label>
                                <input type="text" class="form-control" id="agentPhone" required>
                            </div>
                        </div>
                        
                        <div class="form-row">
                            <div class="form-group col-md-6">
                                <label>Area *</label>
                                <input type="text" class="form-control" id="agentArea" required>
                            </div>
                            <div class="form-group col-md-6">
                                <label>Jam Operasional</label>
                                <input type="text" class="form-control" id="agentHours" value="08:00 - 20:00">
                            </div>
                        </div>
                        
                        <div class="form-group">
                            <label>Alamat Lengkap *</label>
                            <textarea class="form-control" id="agentAddress" rows="2" required></textarea>
                        </div>
                        
                        <div class="form-group">
                            <label>Layanan yang Tersedia</label>
                            <div class="form-check">
                                <input class="form-check-input" type="checkbox" value="topup" id="serviceTopup" checked>
                                <label class="form-check-label" for="serviceTopup">
                                    Topup Saldo
                                </label>
                            </div>
                            <div class="form-check">
                                <input class="form-check-input" type="checkbox" value="voucher" id="serviceVoucher" checked>
                                <label class="form-check-label" for="serviceVoucher">
                                    Jual Voucher
                                </label>
                            </div>
                            <div class="form-check">
                                <input class="form-check-input" type="checkbox" value="pembayaran" id="servicePembayaran">
                                <label class="form-check-label" for="servicePembayaran">
                                    Terima Pembayaran
                                </label>
                            </div>
                        </div>
                        
                        <div class="form-row">
                            <div class="form-group col-md-6">
                                <label>Latitude (Opsional)</label>
                                <input type="text" class="form-control" id="agentLat" placeholder="-2.2833">
                            </div>
                            <div class="form-group col-md-6">
                                <label>Longitude (Opsional)</label>
                                <input type="text" class="form-control" id="agentLng" placeholder="115.3833">
                            </div>
                        </div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-dismiss="modal">Batal</button>
                    <button type="button" class="btn btn-primary" onclick="saveAgent()">Simpan</button>
                </div>
            </div>
        </div>
    </div>
    
    <!-- Scripts -->
    <script src="/static/vendor/jquery/jquery.min.js"></script>
    <script src="/static/vendor/bootstrap/js/bootstrap.bundle.min.js"></script>
    <script src="/static/vendor/jquery-easing/jquery.easing.min.js"></script>
    <script src="/static/js/sb-admin-2.min.js"></script>
    <script src="/static/vendor/datatables/jquery.dataTables.min.js"></script>
    <script src="/static/vendor/datatables/dataTables.bootstrap4.min.js"></script>
    
    <script>
    let agentTable;
    
    $(document).ready(function() {
        loadAgents();
        loadStatistics();
    });
    
    function loadAgents() {
        $.get('/api/agents/list', function(response) {
            if (response.success) {
                const agents = response.data;
                let html = '';
                
                agents.forEach(agent => {
                    const services = agent.services.map(s => {
                        let className = 'service-' + s;
                        let label = s;
                        if (s === 'topup') label = 'Topup';
                        else if (s === 'voucher') label = 'Voucher';
                        else if (s === 'pembayaran') label = 'Pembayaran';
                        return `<span class="service-badge ${className}">${label}</span>`;
                    }).join('');
                    
                    const statusClass = agent.active ? 'status-active' : 'status-inactive';
                    const statusText = agent.active ? 'Aktif' : 'Nonaktif';
                    
                    html += `
                        <tr>
                            <td>${agent.id}</td>
                            <td><strong>${agent.name}</strong></td>
                            <td>${agent.phone}</td>
                            <td>${agent.area}</td>
                            <td>${agent.address}</td>
                            <td>${services}</td>
                            <td>${agent.operational_hours}</td>
                            <td><span class="${statusClass}"><i class="fas fa-circle"></i> ${statusText}</span></td>
                            <td>
                                <button class="btn btn-sm btn-info" onclick="editAgent('${agent.id}')">
                                    <i class="fas fa-edit"></i>
                                </button>
                                <button class="btn btn-sm btn-danger" onclick="deleteAgent('${agent.id}')">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </td>
                        </tr>
                    `;
                });
                
                $('#agentTableBody').html(html);
                
                // Initialize DataTable
                if (agentTable) {
                    agentTable.destroy();
                }
                
                agentTable = $('#agentTable').DataTable({
                    "language": {
                        "sProcessing": "Sedang memproses...",
                        "sLengthMenu": "Tampilkan _MENU_ entri",
                        "sZeroRecords": "Tidak ditemukan data yang sesuai",
                        "sInfo": "Menampilkan _START_ sampai _END_ dari _TOTAL_ entri",
                        "sInfoEmpty": "Menampilkan 0 sampai 0 dari 0 entri",
                        "sInfoFiltered": "(disaring dari _MAX_ entri keseluruhan)",
                        "sInfoPostFix": "",
                        "sSearch": "Cari:",
                        "sUrl": "",
                        "oPaginate": {
                            "sFirst": "Pertama",
                            "sPrevious": "Sebelumnya",
                            "sNext": "Selanjutnya",
                            "sLast": "Terakhir"
                        }
                    },
                    "pageLength": 25,
                    "order": [[0, "desc"]]
                });
            }
        });
    }
    
    function loadStatistics() {
        $.get('/api/agents/statistics', function(response) {
            if (response.success) {
                const stats = response.data;
                $('#totalAgents').text(stats.total);
                $('#activeAgents').text(stats.active);
                $('#totalAreas').text(Object.keys(stats.byArea).length);
                
                // Count total services
                let totalServices = 0;
                for (let service in stats.byService) {
                    totalServices += stats.byService[service];
                }
                $('#totalServices').text(totalServices);
            }
        });
    }
    
    function showAddAgentModal() {
        $('#agentModalTitle').text('Tambah Agent');
        $('#agentForm')[0].reset();
        $('#agentId').val('');
        $('#agentModal').modal('show');
    }
    
    function editAgent(agentId) {
        $.get(`/api/agents/detail/${agentId}`, function(response) {
            if (response.success) {
                const agent = response.data;
                $('#agentModalTitle').text('Edit Agent');
                $('#agentId').val(agent.id);
                $('#agentName').val(agent.name);
                $('#agentPhone').val(agent.phone);
                $('#agentArea').val(agent.area);
                $('#agentAddress').val(agent.address);
                $('#agentHours').val(agent.operational_hours);
                
                // Set services
                $('#serviceTopup').prop('checked', agent.services.includes('topup'));
                $('#serviceVoucher').prop('checked', agent.services.includes('voucher'));
                $('#servicePembayaran').prop('checked', agent.services.includes('pembayaran'));
                
                // Set location if available
                if (agent.location) {
                    $('#agentLat').val(agent.location.lat);
                    $('#agentLng').val(agent.location.lng);
                }
                
                $('#agentModal').modal('show');
            }
        });
    }
    
    function saveAgent() {
        const agentId = $('#agentId').val();
        const services = [];
        if ($('#serviceTopup').is(':checked')) services.push('topup');
        if ($('#serviceVoucher').is(':checked')) services.push('voucher');
        if ($('#servicePembayaran').is(':checked')) services.push('pembayaran');
        
        const data = {
            name: $('#agentName').val(),
            phone: $('#agentPhone').val(),
            area: $('#agentArea').val(),
            address: $('#agentAddress').val(),
            operational_hours: $('#agentHours').val(),
            services: services
        };
        
        // Add location if provided
        const lat = $('#agentLat').val();
        const lng = $('#agentLng').val();
        if (lat && lng) {
            data.location = {
                lat: parseFloat(lat),
                lng: parseFloat(lng)
            };
        }
        
        const url = agentId ? `/api/agents/update/${agentId}` : '/api/agents/add';
        const method = agentId ? 'PUT' : 'POST';
        
        $.ajax({
            url: url,
            method: method,
            data: JSON.stringify(data),
            contentType: 'application/json',
            success: function(response) {
                if (response.success) {
                    alert(agentId ? 'Agent berhasil diupdate!' : 'Agent berhasil ditambahkan!');
                    $('#agentModal').modal('hide');
                    loadAgents();
                    loadStatistics();
                } else {
                    alert('Error: ' + response.message);
                }
            },
            error: function() {
                alert('Terjadi kesalahan saat menyimpan agent');
            }
        });
    }
    
    function deleteAgent(agentId) {
        if (!confirm('Apakah Anda yakin ingin menonaktifkan agent ini?')) {
            return;
        }
        
        $.ajax({
            url: `/api/agents/delete/${agentId}`,
            method: 'DELETE',
            success: function(response) {
                if (response.success) {
                    alert('Agent berhasil dinonaktifkan!');
                    loadAgents();
                    loadStatistics();
                } else {
                    alert('Error: ' + response.message);
                }
            },
            error: function() {
                alert('Terjadi kesalahan saat menonaktifkan agent');
            }
        });
    }
    </script>
</body>
</html>
