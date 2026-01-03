<!DOCTYPE html>
<html lang="id">

<head>
    <meta charset="utf-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no">
    <meta name="description" content="RAF BOT - Buka Isolir Pelanggan">
    <meta name="author" content="RAF BOT">
    <title>RAF BOT - Buka Isolir</title>

    <link href="/vendor/fontawesome-free/css/all.min.css" rel="stylesheet" type="text/css">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <link href="/css/sb-admin-2.min.css" rel="stylesheet">
    <link href="/css/dashboard-modern.css" rel="stylesheet">
    <link href="https://cdn.jsdelivr.net/npm/select2@4.1.0-rc.0/dist/css/select2.min.css" rel="stylesheet" />
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/select2-bootstrap-theme/0.1.0-beta.10/select2-bootstrap.min.css" />
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
        body { font-family: 'Inter', sans-serif; background: #f3f4f6; }
        .page-header {
            background: linear-gradient(135deg, var(--warning) 0%, #d97706 100%);
            border-radius: var(--border-radius);
            padding: 1.5rem 2rem;
            margin-bottom: 1.5rem;
            color: white;
        }
        .page-header h1 { font-size: 1.5rem; font-weight: 700; margin: 0; }
        .page-header p { margin: 0.25rem 0 0; opacity: 0.9; font-size: 0.9rem; }
        .card-modern {
            background: white;
            border-radius: var(--border-radius);
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            border: none;
        }
        .card-modern .card-header {
            background: transparent;
            border-bottom: 1px solid #e5e7eb;
            padding: 1rem 1.25rem;
            font-weight: 600;
        }
        .card-modern .card-body { padding: 1.25rem; }
        .user-card {
            border: 2px solid #e5e7eb;
            border-radius: 10px;
            padding: 1rem;
            margin-bottom: 0.75rem;
            transition: all 0.2s;
            cursor: pointer;
        }
        .user-card:hover { border-color: var(--warning); background: #fffbeb; }
        .user-card.selected { border-color: var(--warning); background: #fef3c7; }
        .user-card .user-name { font-weight: 600; color: var(--dark); }
        .user-card .user-info { font-size: 0.85rem; color: #6b7280; }
        .badge-isolir { background: #fee2e2; color: #dc2626; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.75rem; }
        .badge-profile { background: #dbeafe; color: #2563eb; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.75rem; }
        .btn-buka-isolir {
            background: linear-gradient(135deg, var(--success) 0%, #059669 100%);
            border: none;
            border-radius: 10px;
            padding: 0.75rem 1.5rem;
            font-weight: 600;
            color: white;
            transition: all 0.2s;
        }
        .btn-buka-isolir:hover { transform: translateY(-2px); color: white; }
        .btn-buka-isolir:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
        .search-box {
            background: #f9fafb;
            border-radius: 8px;
            padding: 1rem;
            margin-bottom: 1rem;
        }
        .stats-row { display: flex; gap: 1rem; margin-bottom: 1rem; }
        .stat-card {
            flex: 1;
            background: white;
            border-radius: 8px;
            padding: 1rem;
            text-align: center;
            border: 1px solid #e5e7eb;
        }
        .stat-card .value { font-size: 1.5rem; font-weight: 700; }
        .stat-card .label { font-size: 0.75rem; color: #6b7280; }
        .stat-card.isolir .value { color: var(--danger); }
        .empty-state { text-align: center; padding: 2rem; color: #6b7280; }
        .select2-container--bootstrap .select2-selection--single {
            height: 42px !important;
            padding: 0.5rem 0.75rem !important;
            border-radius: 8px !important;
        }
        .history-table { font-size: 0.85rem; }
        .history-table th { background: #f9fafb; font-weight: 600; }
    </style>
</head>

<body id="page-top">
    <div id="wrapper">
        <?php include __DIR__ . '/_navbar.php'; ?>
        <div id="content-wrapper" class="d-flex flex-column">
            <div id="content">
                <?php include __DIR__ . '/topbar.php'; ?>
                <div class="container-fluid">
                    <!-- Header -->
                    <div class="page-header">
                        <h1><i class="fas fa-unlock mr-2"></i>Buka Isolir</h1>
                        <p>Buka isolir pelanggan tanpa mengubah status pembayaran</p>
                    </div>

                    <div class="row">
                        <!-- Form Buka Isolir -->
                        <div class="col-lg-7 mb-4">
                            <div class="card-modern">
                                <div class="card-header">
                                    <i class="fas fa-user-check mr-2 text-warning"></i>Pilih Pelanggan Terisolir
                                </div>
                                <div class="card-body">
                                    <!-- Search -->
                                    <div class="search-box">
                                        <div class="row">
                                            <div class="col-md-8 mb-2 mb-md-0">
                                                <select class="form-control" id="customerSearch" style="width: 100%;">
                                                    <option value="">-- Cari pelanggan terisolir --</option>
                                                </select>
                                            </div>
                                            <div class="col-md-4">
                                                <button class="btn btn-outline-warning btn-block" onclick="loadIsolatedUsers()">
                                                    <i class="fas fa-sync-alt mr-1"></i>Refresh
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    <!-- Stats -->
                                    <div class="stats-row">
                                        <div class="stat-card isolir">
                                            <div class="value" id="statIsolir">0</div>
                                            <div class="label">Pelanggan Terisolir</div>
                                        </div>
                                        <div class="stat-card">
                                            <div class="value" id="statSelected">0</div>
                                            <div class="label">Dipilih</div>
                                        </div>
                                    </div>

                                    <!-- User List -->
                                    <div id="userList">
                                        <div class="empty-state">
                                            <i class="fas fa-spinner fa-spin fa-2x mb-2"></i>
                                            <p>Memuat data...</p>
                                        </div>
                                    </div>

                                    <!-- Action Button -->
                                    <div class="text-center mt-3">
                                        <button class="btn btn-buka-isolir" id="btnBukaIsolir" onclick="bukaIsolir()" disabled>
                                            <i class="fas fa-unlock mr-2"></i>Buka Isolir (<span id="selectedCount">0</span> Pelanggan)
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Info & History -->
                        <div class="col-lg-5 mb-4">
                            <!-- Info -->
                            <div class="card-modern mb-3">
                                <div class="card-header">
                                    <i class="fas fa-info-circle mr-2 text-info"></i>Informasi
                                </div>
                                <div class="card-body">
                                    <div class="alert alert-warning mb-0">
                                        <strong><i class="fas fa-exclamation-triangle mr-1"></i>Catatan:</strong>
                                        <ul class="mb-0 mt-2 pl-3">
                                            <li>Buka isolir hanya mengubah profil ke paket semula</li>
                                            <li>Status pembayaran <strong>tidak berubah</strong> (tetap belum bayar)</li>
                                            <li>Router pelanggan akan di-reboot otomatis</li>
                                            <li>Cocok untuk pelanggan yang baru bayar bulan lalu</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>

                            <!-- History -->
                            <div class="card-modern">
                                <div class="card-header">
                                    <i class="fas fa-history mr-2 text-primary"></i>Riwayat Buka Isolir
                                </div>
                                <div class="card-body p-0">
                                    <div class="table-responsive">
                                        <table class="table history-table mb-0">
                                            <thead>
                                                <tr><th>Waktu</th><th>Pelanggan</th><th>Status</th></tr>
                                            </thead>
                                            <tbody id="historyBody">
                                                <tr><td colspan="3" class="text-center py-3 text-muted">Belum ada riwayat</td></tr>
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <?php include __DIR__ . '/footer.php'; ?>
        </div>
    </div>

    <script src="/vendor/jquery/jquery.min.js"></script>
    <script src="/vendor/bootstrap/js/bootstrap.bundle.min.js"></script>
    <script src="/js/sb-admin-2.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
    <script src="https://cdn.jsdelivr.net/npm/select2@4.1.0-rc.0/dist/js/select2.min.js"></script>

    <script>
        let isolatedUsers = [];
        let selectedUsers = new Set();
        let isolirProfile = 'ISOLIR';

        $(document).ready(function() {
            loadConfig();
            loadIsolatedUsers();
            initCustomerSearch();
        });

        async function loadConfig() {
            try {
                const res = await fetch('/api/config');
                const data = await res.json();
                if (data.data?.isolir_profile) {
                    isolirProfile = data.data.isolir_profile;
                }
            } catch (e) {}
        }

        async function loadIsolatedUsers() {
            $('#userList').html('<div class="empty-state"><i class="fas fa-spinner fa-spin fa-2x mb-2"></i><p>Memuat data...</p></div>');
            
            try {
                const res = await fetch('/api/users/isolated');
                const data = await res.json();
                
                if (data.status === 200) {
                    isolatedUsers = data.data || [];
                    $('#statIsolir').text(isolatedUsers.length);
                    renderUserList();
                } else {
                    $('#userList').html('<div class="empty-state"><i class="fas fa-exclamation-circle fa-2x mb-2 text-danger"></i><p>Gagal memuat data</p></div>');
                }
            } catch (e) {
                $('#userList').html('<div class="empty-state"><i class="fas fa-exclamation-circle fa-2x mb-2 text-danger"></i><p>Error: ' + e.message + '</p></div>');
            }
        }

        function renderUserList() {
            if (isolatedUsers.length === 0) {
                $('#userList').html('<div class="empty-state"><i class="fas fa-check-circle fa-2x mb-2 text-success"></i><p>Tidak ada pelanggan terisolir</p></div>');
                return;
            }

            let html = '';
            isolatedUsers.forEach((user, i) => {
                const isSelected = selectedUsers.has(user.id);
                html += `
                    <div class="user-card ${isSelected ? 'selected' : ''}" data-id="${user.id}" onclick="toggleUser(${user.id})">
                        <div class="d-flex justify-content-between align-items-start">
                            <div>
                                <div class="user-name">
                                    <input type="checkbox" class="mr-2" ${isSelected ? 'checked' : ''} onclick="event.stopPropagation(); toggleUser(${user.id})">
                                    ${user.name}
                                </div>
                                <div class="user-info mt-1">
                                    <i class="fas fa-user mr-1"></i>${user.pppoe_username || '-'}
                                    <span class="mx-2">|</span>
                                    <i class="fas fa-box mr-1"></i>${user.subscription || '-'}
                                </div>
                            </div>
                            <div class="text-right">
                                <span class="badge-isolir"><i class="fas fa-ban mr-1"></i>Terisolir</span>
                                <div class="mt-1">
                                    <span class="badge-profile">${user.current_profile || isolirProfile}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            });
            $('#userList').html(html);
        }

        function toggleUser(userId) {
            if (selectedUsers.has(userId)) {
                selectedUsers.delete(userId);
            } else {
                selectedUsers.add(userId);
            }
            updateSelection();
            renderUserList();
        }

        function updateSelection() {
            const count = selectedUsers.size;
            $('#statSelected').text(count);
            $('#selectedCount').text(count);
            $('#btnBukaIsolir').prop('disabled', count === 0);
        }

        function initCustomerSearch() {
            $('#customerSearch').select2({
                theme: 'bootstrap',
                placeholder: '-- Cari pelanggan terisolir --',
                allowClear: true,
                minimumInputLength: 0,
                ajax: {
                    url: '/api/users/isolated',
                    dataType: 'json',
                    delay: 300,
                    data: params => ({ search: params.term }),
                    processResults: data => ({
                        results: (data.data || []).map(u => ({
                            id: u.id,
                            text: `${u.name} - ${u.pppoe_username || '-'} (${u.subscription || '-'})`
                        }))
                    })
                }
            }).on('select2:select', function(e) {
                const userId = parseInt(e.params.data.id);
                if (!selectedUsers.has(userId)) {
                    selectedUsers.add(userId);
                    updateSelection();
                    renderUserList();
                }
                $(this).val(null).trigger('change');
            });
        }

        async function bukaIsolir() {
            if (selectedUsers.size === 0) return;

            const userIds = Array.from(selectedUsers);
            const userNames = isolatedUsers
                .filter(u => userIds.includes(u.id))
                .map(u => u.name)
                .join(', ');

            const confirm = await Swal.fire({
                title: 'Konfirmasi Buka Isolir',
                html: `Buka isolir untuk <strong>${selectedUsers.size}</strong> pelanggan?<br><small class="text-muted">${userNames}</small>`,
                icon: 'question',
                showCancelButton: true,
                confirmButtonText: 'Ya, Buka Isolir',
                cancelButtonText: 'Batal',
                confirmButtonColor: '#10b981'
            });

            if (!confirm.isConfirmed) return;

            Swal.fire({ title: 'Memproses...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

            try {
                const res = await fetch('/api/users/buka-isolir', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userIds })
                });

                const data = await res.json();

                if (data.status === 200) {
                    const successCount = data.results?.success?.length || 0;
                    const failedCount = data.results?.failed?.length || 0;

                    let message = `<strong>${successCount}</strong> pelanggan berhasil dibuka isolirnya.`;
                    if (failedCount > 0) {
                        message += `<br><strong>${failedCount}</strong> gagal.`;
                    }

                    await Swal.fire({
                        title: 'Berhasil!',
                        html: message,
                        icon: successCount > 0 ? 'success' : 'warning'
                    });

                    selectedUsers.clear();
                    updateSelection();
                    loadIsolatedUsers();
                } else {
                    Swal.fire('Gagal', data.message || 'Terjadi kesalahan', 'error');
                }
            } catch (e) {
                Swal.fire('Error', e.message, 'error');
            }
        }
    </script>
</body>
</html>
