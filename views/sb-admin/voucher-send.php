<!DOCTYPE html>
<html lang="id">

<head>
    <meta charset="utf-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no">
    <meta name="description" content="RAF BOT - Kirim Voucher via WhatsApp">
    <meta name="author" content="RAF BOT">
    <title>RAF BOT - Kirim Voucher</title>

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
            background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%);
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

        .form-section {
            background: #f9fafb;
            border-radius: 8px;
            padding: 1rem;
            margin-bottom: 1rem;
        }
        .form-section-title {
            font-weight: 600;
            color: var(--dark);
            margin-bottom: 0.75rem;
            font-size: 0.9rem;
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }
        .form-section-title i { color: var(--primary); }

        .type-selector {
            display: flex;
            gap: 0.5rem;
        }
        .type-btn {
            flex: 1;
            padding: 0.75rem 1rem;
            border: 2px solid #e5e7eb;
            border-radius: 8px;
            background: white;
            cursor: pointer;
            transition: all 0.2s;
            text-align: center;
            font-size: 0.85rem;
        }
        .type-btn:hover { border-color: var(--primary); }
        .type-btn.active {
            border-color: var(--primary);
            background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
            color: var(--primary-dark);
        }
        .type-btn i { margin-right: 0.5rem; }

        .voucher-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 0.75rem; }
        .voucher-card {
            border: 2px solid #e5e7eb;
            border-radius: 8px;
            padding: 0.75rem;
            cursor: pointer;
            transition: all 0.2s;
            background: white;
            text-align: center;
        }
        .voucher-card:hover { border-color: var(--primary); transform: translateY(-2px); }
        .voucher-card.selected {
            border-color: var(--primary);
            background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
        }
        .voucher-card .name { font-weight: 600; font-size: 0.85rem; color: var(--dark); }
        .voucher-card .duration { font-size: 0.75rem; color: #6b7280; margin: 0.25rem 0; }
        .voucher-card .price { font-weight: 700; color: var(--success); font-size: 0.9rem; }

        .qty-selector { display: flex; gap: 0.5rem; flex-wrap: wrap; }
        .qty-btn {
            width: 42px; height: 38px;
            border: 2px solid #e5e7eb;
            border-radius: 6px;
            background: white;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
            font-size: 0.85rem;
        }
        .qty-btn:hover { border-color: var(--primary); }
        .qty-btn.selected { border-color: var(--primary); background: var(--primary); color: white; }

        .phone-item {
            display: flex;
            gap: 0.5rem;
            margin-bottom: 0.5rem;
        }
        .phone-item input { flex: 1; }
        .btn-remove-phone {
            background: var(--danger);
            color: white;
            border: none;
            border-radius: 6px;
            padding: 0 0.75rem;
            cursor: pointer;
        }
        .btn-add-phone {
            background: var(--primary);
            color: white;
            border: none;
            border-radius: 6px;
            padding: 0.5rem 1rem;
            font-size: 0.85rem;
            cursor: pointer;
        }

        .preview-box {
            background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
            border: 1px solid #86efac;
            border-radius: 8px;
            padding: 1rem;
            font-family: 'Courier New', monospace;
            white-space: pre-wrap;
            font-size: 0.8rem;
            line-height: 1.5;
            max-height: 400px;
            overflow-y: auto;
        }

        .btn-action {
            border: none;
            border-radius: 8px;
            padding: 0.75rem 1.5rem;
            font-weight: 600;
            font-size: 0.9rem;
            cursor: pointer;
            transition: all 0.2s;
        }
        .btn-action:hover { transform: translateY(-2px); }
        .btn-send { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; }
        .btn-generate { background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; }

        .stats-row { display: flex; gap: 1rem; margin-bottom: 1rem; }
        .stat-card {
            flex: 1;
            background: white;
            border-radius: 8px;
            padding: 1rem;
            text-align: center;
            border: 1px solid #e5e7eb;
        }
        .stat-card .value { font-size: 1.5rem; font-weight: 700; color: var(--dark); }
        .stat-card .label { font-size: 0.75rem; color: #6b7280; }

        .history-table { font-size: 0.8rem; }
        .history-table th { background: #f9fafb; font-weight: 600; }
        .badge-sent { background: #d1fae5; color: #059669; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.7rem; }
        .badge-generated { background: #dbeafe; color: #2563eb; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.7rem; }

        .select2-container--bootstrap .select2-selection--single {
            height: 38px !important;
            padding: 0.375rem 0.75rem !important;
            border-radius: 6px !important;
        }

        .custom-creds-row { display: flex; gap: 0.75rem; }
        .custom-creds-row .form-group { flex: 1; margin-bottom: 0; }
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
                        <h1><i class="fas fa-paper-plane mr-2"></i>Kirim Voucher</h1>
                        <p>Generate dan kirim voucher hotspot via WhatsApp</p>
                    </div>

                    <div class="row">
                        <!-- Form -->
                        <div class="col-lg-7 mb-4">
                            <div class="card-modern">
                                <div class="card-header">
                                    <i class="fas fa-edit mr-2 text-primary"></i>Form Kirim Voucher
                                </div>
                                <div class="card-body">
                                    <!-- Tipe Voucher -->
                                    <div class="form-section">
                                        <div class="form-section-title"><i class="fas fa-tags"></i> Tipe Voucher</div>
                                        <div class="type-selector">
                                            <div class="type-btn active" data-type="random" onclick="setVoucherType('random')">
                                                <i class="fas fa-random"></i>Random<br>
                                                <small class="text-muted">Kode acak 6 karakter</small>
                                            </div>
                                            <div class="type-btn" data-type="custom" onclick="setVoucherType('custom')">
                                                <i class="fas fa-edit"></i>Custom<br>
                                                <small class="text-muted">Username & Password</small>
                                            </div>
                                        </div>
                                    </div>

                                    <!-- Pilih Paket -->
                                    <div class="form-section">
                                        <div class="form-section-title"><i class="fas fa-box"></i> Pilih Paket</div>
                                        <div class="voucher-grid" id="voucherList">
                                            <div class="text-center py-3 text-muted" style="grid-column: 1/-1;">
                                                <i class="fas fa-spinner fa-spin"></i> Memuat...
                                            </div>
                                        </div>
                                    </div>

                                    <!-- Custom Credentials (hidden by default) -->
                                    <div class="form-section" id="customCredsSection" style="display: none;">
                                        <div class="form-section-title"><i class="fas fa-key"></i> Kredensial Custom</div>
                                        <div class="custom-creds-row">
                                            <div class="form-group">
                                                <input type="text" class="form-control form-control-sm" id="customUsername" placeholder="Username">
                                            </div>
                                            <div class="form-group">
                                                <input type="text" class="form-control form-control-sm" id="customPassword" placeholder="Password">
                                            </div>
                                        </div>
                                    </div>

                                    <!-- Jumlah (only for random) -->
                                    <div class="form-section" id="qtySection">
                                        <div class="form-section-title"><i class="fas fa-sort-numeric-up"></i> Jumlah Voucher</div>
                                        <div class="qty-selector">
                                            <button type="button" class="qty-btn selected" data-qty="1">1</button>
                                            <button type="button" class="qty-btn" data-qty="2">2</button>
                                            <button type="button" class="qty-btn" data-qty="3">3</button>
                                            <button type="button" class="qty-btn" data-qty="5">5</button>
                                            <button type="button" class="qty-btn" data-qty="10">10</button>
                                            <input type="number" class="form-control form-control-sm" id="customQty" placeholder="Lainnya" min="1" max="50" style="width: 80px;">
                                        </div>
                                    </div>

                                    <!-- Nomor Tujuan -->
                                    <div class="form-section">
                                        <div class="form-section-title"><i class="fas fa-phone"></i> Nomor Tujuan</div>
                                        <select class="form-control form-control-sm mb-2" id="customerSearch" style="width: 100%;">
                                            <option value="">-- Cari pelanggan --</option>
                                        </select>
                                        <div id="phoneContainer">
                                            <div class="phone-item">
                                                <input type="text" class="form-control form-control-sm phone-input" placeholder="08xxxxxxxxxx">
                                                <button type="button" class="btn-remove-phone" onclick="removePhone(this)" disabled><i class="fas fa-times"></i></button>
                                            </div>
                                        </div>
                                        <button type="button" class="btn-add-phone mt-2" onclick="addPhone()">
                                            <i class="fas fa-plus mr-1"></i>Tambah
                                        </button>
                                    </div>

                                    <!-- Catatan -->
                                    <div class="form-section">
                                        <div class="form-section-title"><i class="fas fa-sticky-note"></i> Catatan (Opsional)</div>
                                        <textarea class="form-control form-control-sm" id="notes" rows="2" placeholder="Catatan untuk penerima..."></textarea>
                                    </div>

                                    <!-- Actions -->
                                    <div class="text-center mt-3">
                                        <button type="button" class="btn-action btn-send mr-2" onclick="generateAndSend()">
                                            <i class="fas fa-paper-plane mr-1"></i>Kirim WhatsApp
                                        </button>
                                        <button type="button" class="btn-action btn-generate" id="btnGenerateOnly" onclick="generateOnly()">
                                            <i class="fas fa-ticket-alt mr-1"></i>Generate Saja
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Preview & Stats -->
                        <div class="col-lg-5 mb-4">
                            <!-- Preview -->
                            <div class="card-modern mb-3">
                                <div class="card-header">
                                    <i class="fas fa-eye mr-2 text-primary"></i>Preview Pesan
                                </div>
                                <div class="card-body">
                                    <div class="preview-box" id="messagePreview">Pilih paket untuk melihat preview...</div>
                                </div>
                            </div>

                            <!-- Stats -->
                            <div class="stats-row">
                                <div class="stat-card">
                                    <div class="value" id="statToday">0</div>
                                    <div class="label">Hari Ini</div>
                                </div>
                                <div class="stat-card">
                                    <div class="value" id="statTotal">0</div>
                                    <div class="label">Total</div>
                                </div>
                            </div>

                            <!-- History -->
                            <div class="card-modern">
                                <div class="card-header d-flex justify-content-between align-items-center">
                                    <span><i class="fas fa-history mr-2 text-primary"></i>Riwayat</span>
                                </div>
                                <div class="card-body p-0">
                                    <div class="table-responsive">
                                        <table class="table history-table mb-0">
                                            <thead>
                                                <tr><th>Waktu</th><th>Paket</th><th>Status</th></tr>
                                            </thead>
                                            <tbody id="historyBody">
                                                <tr><td colspan="3" class="text-center py-3 text-muted">Belum ada</td></tr>
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

    <!-- Result Modal -->
    <div class="modal fade" id="resultModal" tabindex="-1">
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title"><i class="fas fa-check-circle text-success mr-2"></i>Berhasil</h5>
                    <button type="button" class="close" data-dismiss="modal">&times;</button>
                </div>
                <div class="modal-body" id="resultContent"></div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary btn-sm" data-dismiss="modal">Tutup</button>
                    <button type="button" class="btn btn-primary btn-sm" onclick="copyAllCodes()">
                        <i class="fas fa-copy mr-1"></i>Salin Kode
                    </button>
                </div>
            </div>
        </div>
    </div>

    <script src="/vendor/jquery/jquery.min.js"></script>
    <script src="/vendor/bootstrap/js/bootstrap.bundle.min.js"></script>
    <script src="/js/sb-admin-2.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
    <script src="https://cdn.jsdelivr.net/npm/select2@4.1.0-rc.0/dist/js/select2.min.js"></script>

    <script>
        let voucherProfiles = [];
        let selectedProfile = null;
        let selectedQty = 1;
        let voucherType = 'random';
        let messageTemplate = '';
        let messageTemplateCustom = '';
        let generatedCodes = [];

        $(document).ready(function() {
            loadProfiles();
            loadTemplates();
            loadHistory();
            loadStats();
            initCustomerSearch();
            initQtySelector();
            initPhoneAutoFormat();
        });

        // Initialize auto-format for existing phone inputs
        function initPhoneAutoFormat() {
            $(document).on('blur paste', '.phone-input', function(e) {
                const input = $(this);
                setTimeout(() => {
                    const formatted = formatPhoneNumber(input.val());
                    if (formatted !== input.val()) {
                        input.val(formatted);
                    }
                }, e.type === 'paste' ? 100 : 0);
            });
        }

        function setVoucherType(type) {
            voucherType = type;
            $('.type-btn').removeClass('active');
            $(`.type-btn[data-type="${type}"]`).addClass('active');
            
            if (type === 'custom') {
                $('#customCredsSection').show();
                $('#qtySection').hide();
                $('#btnGenerateOnly').hide();
            } else {
                $('#customCredsSection').hide();
                $('#qtySection').show();
                $('#btnGenerateOnly').show();
            }
            updatePreview();
        }

        async function loadProfiles() {
            try {
                const res = await fetch('/api/voucher/profiles');
                const data = await res.json();
                if (data.status === 200 && data.data) {
                    voucherProfiles = data.data;
                    renderProfiles();
                }
            } catch (e) {
                $('#voucherList').html('<div class="text-danger" style="grid-column:1/-1;">Gagal memuat</div>');
            }
        }

        function renderProfiles() {
            if (!voucherProfiles.length) {
                $('#voucherList').html('<div class="text-muted" style="grid-column:1/-1;">Tidak ada paket</div>');
                return;
            }
            let html = '';
            voucherProfiles.forEach((p, i) => {
                const price = parseInt(p.hargavc || 0);
                html += `<div class="voucher-card" data-index="${i}" onclick="selectProfile(${i})">
                    <div class="name">${p.namavc || p.prof}</div>
                    <div class="duration">${p.durasivc || '-'}</div>
                    <div class="price">Rp ${price.toLocaleString('id-ID')}</div>
                </div>`;
            });
            $('#voucherList').html(html);
        }

        function selectProfile(i) {
            selectedProfile = voucherProfiles[i];
            $('.voucher-card').removeClass('selected');
            $(`.voucher-card[data-index="${i}"]`).addClass('selected');
            updatePreview();
        }

        async function loadTemplates() {
            try {
                const res = await fetch('/api/templates');
                const json = await res.json();
                // Template ada di data.notificationTemplates
                const templates = json.data?.notificationTemplates || {};
                messageTemplate = templates.voucher_send?.template || `🎫 *VOUCHER HOTSPOT*

📦 Paket: *\${nama_paket}*
⏱️ Durasi: *\${durasi}*

🔐 *KODE VOUCHER:*
\${voucher_list}

📌 *Cara Penggunaan:*
1. Hubungkan ke WiFi Hotspot
2. Buka browser, akan muncul halaman login
3. Masukkan kode di atas pada Username & Password

\${catatan}

Terima kasih! 🙏
*\${nama_wifi}*`;
                messageTemplateCustom = templates.voucher_send_custom?.template || `🎫 *VOUCHER HOTSPOT*

📦 Paket: *\${nama_paket}*
⏱️ Durasi: *\${durasi}*

� *KREDENSI AL LOGIN:*
👤 Username: \`\${username}\`
� Pasrsword: \`\${password}\`

📌 *Cara Penggunaan:*
1. Hubungkan ke WiFi Hotspot
2. Buka browser, akan muncul halaman login
3. Masukkan Username & Password di atas

\${catatan}

Terima kasih! 🙏
*\${nama_wifi}*`;
            } catch (e) {
                console.error('Failed to load templates:', e);
            }
        }

        function initCustomerSearch() {
            $('#customerSearch').select2({
                theme: 'bootstrap',
                placeholder: '-- Cari pelanggan --',
                allowClear: true,
                minimumInputLength: 2,
                ajax: {
                    url: '/api/users',
                    dataType: 'json',
                    delay: 300,
                    data: params => ({ search: params.term, limit: 20 }),
                    processResults: data => ({
                        results: (data.data || data || []).map(u => ({
                            id: u.id,
                            text: `${u.nama} - ${u.pppoe || '-'}`,
                            phone: u.no_hp
                        }))
                    })
                }
            }).on('select2:select', function(e) {
                if (e.params.data.phone) {
                    const phones = e.params.data.phone.split('|').filter(p => p.trim());
                    if (phones.length) {
                        $('#phoneContainer').empty();
                        phones.forEach((p, i) => addPhone(p, i === 0));
                    }
                }
            });
        }

        function initQtySelector() {
            $('.qty-btn').on('click', function() {
                $('.qty-btn').removeClass('selected');
                $(this).addClass('selected');
                selectedQty = parseInt($(this).data('qty'));
                $('#customQty').val('');
                updatePreview();
            });
            $('#customQty').on('input', function() {
                const v = parseInt($(this).val());
                if (v > 0) {
                    $('.qty-btn').removeClass('selected');
                    selectedQty = Math.min(v, 50);
                    updatePreview();
                }
            });
        }

        // Auto-format phone number: +62 852-3304-7094 -> 6285233047094
        function formatPhoneNumber(phone) {
            if (!phone) return '';
            // Remove all non-digit characters (spaces, dashes, plus, parentheses, etc)
            let cleaned = phone.replace(/[^\d]/g, '');
            // Convert 08xx to 628xx
            if (cleaned.startsWith('0')) {
                cleaned = '62' + cleaned.substring(1);
            }
            return cleaned;
        }

        function addPhone(value = '', isFirst = false) {
            // Format the value if provided
            const formattedValue = formatPhoneNumber(value);
            const html = `<div class="phone-item">
                <input type="text" class="form-control form-control-sm phone-input" placeholder="08xxxxxxxxxx" value="${formattedValue}">
                <button type="button" class="btn-remove-phone" onclick="removePhone(this)" ${isFirst ? 'disabled' : ''}><i class="fas fa-times"></i></button>
            </div>`;
            $('#phoneContainer').append(html);
            updateRemoveButtons();
        }

        function removePhone(btn) {
            $(btn).closest('.phone-item').remove();
            updateRemoveButtons();
        }

        function updateRemoveButtons() {
            const items = $('#phoneContainer .phone-item');
            items.find('.btn-remove-phone').prop('disabled', items.length <= 1);
        }

        function getPhones() {
            return $('#phoneContainer input').map((_, el) => $(el).val().trim()).get().filter(p => p);
        }

        function generateCode() {
            const chars = '23456789abcdefghjkmnpqrstuvwxyz';
            let r = '';
            for (let i = 0; i < 6; i++) r += chars[Math.floor(Math.random() * chars.length)];
            return r;
        }

        function updatePreview() {
            if (!selectedProfile) {
                $('#messagePreview').text('Pilih paket untuk melihat preview...');
                return;
            }
            const notes = $('#notes').val().trim();
            const notesText = notes ? `📝 ${notes}` : '';
            let preview = '';

            if (voucherType === 'custom') {
                const u = $('#customUsername').val().trim() || 'username';
                const p = $('#customPassword').val().trim() || 'password';
                preview = messageTemplateCustom
                    .replace(/\$\{nama_paket\}/g, selectedProfile.namavc || selectedProfile.prof)
                    .replace(/\$\{durasi\}/g, selectedProfile.durasivc || '-')
                    .replace(/\$\{username\}/g, u)
                    .replace(/\$\{password\}/g, p)
                    .replace(/\$\{catatan\}/g, notesText)
                    .replace(/\$\{nama_wifi\}/g, 'RAF NET');
            } else {
                const codes = [];
                for (let i = 0; i < selectedQty; i++) codes.push(generateCode());
                const list = codes.map((c, i) => `${selectedQty > 1 ? `${i+1}. ` : ''}Kode: \`${c}\``).join('\n');
                preview = messageTemplate
                    .replace(/\$\{nama_paket\}/g, selectedProfile.namavc || selectedProfile.prof)
                    .replace(/\$\{durasi\}/g, selectedProfile.durasivc || '-')
                    .replace(/\$\{voucher_list\}/g, list)
                    .replace(/\$\{catatan\}/g, notesText)
                    .replace(/\$\{nama_wifi\}/g, 'RAF NET');
            }
            $('#messagePreview').text(preview);
        }

        $('#notes, #customUsername, #customPassword').on('input', updatePreview);

        function validate(requirePhone = true) {
            if (!selectedProfile) {
                Swal.fire('Pilih Paket', 'Silakan pilih paket voucher', 'warning');
                return false;
            }
            if (voucherType === 'custom') {
                if (!$('#customUsername').val().trim() || !$('#customPassword').val().trim()) {
                    Swal.fire('Kredensial Kosong', 'Isi username dan password', 'warning');
                    return false;
                }
            }
            if (requirePhone && !getPhones().length) {
                Swal.fire('Nomor Kosong', 'Masukkan minimal 1 nomor', 'warning');
                return false;
            }
            return true;
        }

        async function generateAndSend() {
            if (!validate()) return;
            const phones = getPhones();
            const isCustom = voucherType === 'custom';

            const conf = await Swal.fire({
                title: 'Konfirmasi',
                html: isCustom 
                    ? `Kirim voucher custom ke ${phones.length} nomor?`
                    : `Generate ${selectedQty} voucher dan kirim ke ${phones.length} nomor?`,
                icon: 'question',
                showCancelButton: true,
                confirmButtonText: 'Ya, Kirim',
                cancelButtonText: 'Batal'
            });
            if (!conf.isConfirmed) return;

            Swal.fire({ title: 'Memproses...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

            try {
                const res = await fetch('/api/voucher/generate-send', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        profile: selectedProfile.prof,
                        profileName: selectedProfile.namavc,
                        duration: selectedProfile.durasivc,
                        quantity: isCustom ? 1 : selectedQty,
                        phones: phones,
                        notes: $('#notes').val().trim(),
                        sendWhatsApp: true,
                        voucherType: voucherType,
                        customUsername: isCustom ? $('#customUsername').val().trim() : null,
                        customPassword: isCustom ? $('#customPassword').val().trim() : null
                    })
                });
                const data = await res.json();
                if (data.status === 200) {
                    generatedCodes = data.vouchers || [];
                    showResult(data);
                    loadHistory();
                    loadStats();
                    Swal.fire({ icon: 'success', title: 'Berhasil!', timer: 1500, showConfirmButton: false });
                } else {
                    Swal.fire('Gagal', data.message, 'error');
                }
            } catch (e) {
                Swal.fire('Error', e.message, 'error');
            }
        }

        async function generateOnly() {
            if (voucherType === 'custom') return;
            if (!validate(false)) return;

            const conf = await Swal.fire({
                title: 'Konfirmasi',
                html: `Generate ${selectedQty} voucher?`,
                icon: 'question',
                showCancelButton: true,
                confirmButtonText: 'Ya',
                cancelButtonText: 'Batal'
            });
            if (!conf.isConfirmed) return;

            Swal.fire({ title: 'Memproses...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

            try {
                const res = await fetch('/api/voucher/generate-send', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        profile: selectedProfile.prof,
                        profileName: selectedProfile.namavc,
                        duration: selectedProfile.durasivc,
                        quantity: selectedQty,
                        phones: [],
                        notes: $('#notes').val().trim(),
                        sendWhatsApp: false,
                        voucherType: 'random'
                    })
                });
                const data = await res.json();
                if (data.status === 200) {
                    generatedCodes = data.vouchers || [];
                    showResult(data);
                    loadHistory();
                    loadStats();
                    Swal.fire({ icon: 'success', title: 'Berhasil!', timer: 1500, showConfirmButton: false });
                } else {
                    Swal.fire('Gagal', data.message, 'error');
                }
            } catch (e) {
                Swal.fire('Error', e.message, 'error');
            }
        }

        function showResult(data) {
            let html = `<div class="alert alert-success py-2">${data.vouchers.length} voucher berhasil</div>`;
            html += '<table class="table table-sm table-bordered"><thead><tr><th>#</th><th>Kode</th></tr></thead><tbody>';
            data.vouchers.forEach((v, i) => {
                html += `<tr><td>${i+1}</td><td><code>${v.username}</code></td></tr>`;
            });
            html += '</tbody></table>';
            $('#resultContent').html(html);
            $('#resultModal').modal('show');
        }

        function copyAllCodes() {
            const text = generatedCodes.map((v, i) => `${i+1}. ${v.username}`).join('\n');
            navigator.clipboard.writeText(text).then(() => {
                Swal.fire({ icon: 'success', title: 'Disalin!', timer: 1000, showConfirmButton: false });
            });
        }

        async function loadHistory() {
            try {
                const res = await fetch('/api/voucher/sent-history?limit=5');
                const data = await res.json();
                if (data.status === 200 && data.data?.length) {
                    let html = '';
                    data.data.forEach(item => {
                        const d = new Date(item.created_at);
                        const t = d.toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
                        const badge = item.sent_status === 'sent' ? '<span class="badge-sent">Terkirim</span>' : '<span class="badge-generated">Generate</span>';
                        html += `<tr><td>${t}</td><td>${item.profile_name || item.profile}</td><td>${badge}</td></tr>`;
                    });
                    $('#historyBody').html(html);
                }
            } catch (e) {}
        }

        async function loadStats() {
            try {
                const res = await fetch('/api/voucher/sent-stats');
                const data = await res.json();
                if (data.status === 200) {
                    $('#statToday').text(data.today || 0);
                    $('#statTotal').text(data.total || 0);
                }
            } catch (e) {}
        }
    </script>
</body>
</html>
