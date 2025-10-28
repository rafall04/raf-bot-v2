let saldoTable, transactionTable;
let allTransactions = [];
let allSaldoData = [];
let allTopupRequests = [];

$(document).ready(function() {
    // Initialize DataTables
    saldoTable = $('#saldoTable').DataTable({
        language: {
            "sProcessing":   "Sedang memproses...",
            "sLengthMenu":   "Tampilkan _MENU_ entri",
            "sZeroRecords":  "Tidak ditemukan data yang sesuai",
            "sInfo":         "Menampilkan _START_ sampai _END_ dari _TOTAL_ entri",
            "sInfoEmpty":    "Menampilkan 0 sampai 0 dari 0 entri",
            "sInfoFiltered": "(disaring dari _MAX_ entri keseluruhan)",
            "sInfoPostFix":  "",
            "sSearch":       "Cari:",
            "sUrl":          "",
            "oPaginate": {
                "sFirst":    "Pertama",
                "sPrevious": "Sebelumnya",
                "sNext":     "Selanjutnya",
                "sLast":     "Terakhir"
            }
        },
        order: [[3, 'desc']]
    });

    transactionTable = $('#transactionTable').DataTable({
        language: {
            "sProcessing":   "Sedang memproses...",
            "sLengthMenu":   "Tampilkan _MENU_ entri",
            "sZeroRecords":  "Tidak ditemukan data yang sesuai",
            "sInfo":         "Menampilkan _START_ sampai _END_ dari _TOTAL_ entri",
            "sInfoEmpty":    "Menampilkan 0 sampai 0 dari 0 entri",
            "sInfoFiltered": "(disaring dari _MAX_ entri keseluruhan)",
            "sInfoPostFix":  "",
            "sSearch":       "Cari:",
            "sUrl":          "",
            "oPaginate": {
                "sFirst":    "Pertama",
                "sPrevious": "Sebelumnya",
                "sNext":     "Selanjutnya",
                "sLast":     "Terakhir"
            }
        },
        order: [[1, 'desc']]
    });


    // Load initial data
    loadStatistics();
    loadTopupRequests();
    loadSaldoData();
    loadTransactions();

    // Auto refresh every 30 seconds
    setInterval(function() {
        loadStatistics();
        loadTopupRequests();
    }, 30000);
});

function formatRupiah(amount) {
    return 'Rp ' + parseInt(amount).toLocaleString('id-ID');
}

function formatNumber(amount) {
    return parseInt(amount).toLocaleString('id-ID');
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function loadStatistics() {
    $.get('/api/saldo/statistics', function(data) {
        console.log('Statistics response:', data);
        $('#totalSaldo').text(formatRupiah(data.totalSaldo || 0));
        $('#activeUsers').text(data.activeUsers || 0);
        $('#pendingTopups').text(data.pendingTopups || 0);
        $('#todayTransactions').text(data.todayTransactions || 0);
        $('#pendingBadge').text(data.pendingTopups || 0);
    }).fail(function(xhr, status, error) {
        console.error('Failed to load statistics:', status, error, xhr.responseText);
    });
}

function loadTopupRequests() {
    $.get('/api/saldo/topup-requests', function(response) {
        console.log('Topup requests raw response:', response);
        // Handle response that might be {data: Array} or direct array
        let data = response;
        if (response && typeof response === 'object' && 'data' in response) {
            data = response.data;
        }
        
        // Ensure data is an array
        if (!Array.isArray(data)) {
            console.error('Invalid topup requests data:', response);
            allTopupRequests = [];
            renderTopupRequests([]);
            return;
        }
        console.log('Topup requests processed:', data);
        allTopupRequests = data;
        // Show both pending and waiting_verification requests
        renderTopupRequests(data.filter(r => r.status === 'pending' || r.status === 'waiting_verification'));
    }).fail(function(xhr, status, error) {
        console.error('Failed to load topup requests:', status, error, xhr.responseText);
        allTopupRequests = [];
        renderTopupRequests([]);
    });
}

function renderTopupRequests(requests) {
    const container = $('#topupRequestsList');
    container.empty();

    if (requests.length === 0) {
        container.html(`
            <div class="text-center py-5">
                <i class="fas fa-inbox fa-3x text-gray-300 mb-3"></i>
                <p class="text-muted">Tidak ada request topup pending</p>
            </div>
        `);
        return;
    }

    requests.forEach(request => {
        const statusBadge = getStatusBadge(request.status);
        const hasProof = request.paymentProof ? true : false;
        
        // Display name with priority: customerName > formatted phone
        const phoneNumber = request.userId.replace('@s.whatsapp.net', '');
        const displayName = request.customerName || (phoneNumber.startsWith('62') && phoneNumber.length > 10 ? '+' + phoneNumber.substring(0, 2) + ' ' + phoneNumber.substring(2) : phoneNumber);
        
        const card = $(`
            <div class="card topup-request-card mb-3 ${request.status === 'waiting_verification' ? 'border-warning' : ''}">
                <div class="card-body">
                    <div class="row align-items-center">
                        <div class="col-md-8">
                            <h6 class="font-weight-bold mb-2">
                                <i class="fas fa-user-circle"></i> ${displayName}
                            </h6>
                            <small class="text-muted d-block"><i class="fas fa-phone"></i> ${phoneNumber}</small>
                            <p class="mb-1">
                                <span class="badge badge-primary">Rp ${formatNumber(request.amount)}</span>
                                <span class="badge badge-info">${request.paymentMethod}</span>
                            </p>
                            <small class="text-muted">
                                <i class="fas fa-clock"></i> ${formatDate(request.created_at)}
                            </small>
                            ${request.paymentProof ? `
                                <div class="mt-2">
                                    <button class="btn btn-info btn-sm" onclick="viewTopupProof('${request.id}', '${request.paymentProof}')" title="Lihat Bukti">
                                        <i class="fas fa-image"></i> Lihat Bukti
                                    </button>
                                    <span class="badge badge-warning ml-2">
                                        <i class="fas fa-exclamation-triangle"></i> Menunggu Verifikasi
                                    </span>
                                </div>
                            ` : request.paymentMethod === 'cash' ? `
                                <div class="mt-2">
                                    <span class="badge badge-info">
                                        <i class="fas fa-user-tie"></i> Menunggu Konfirmasi Agent
                                    </span>
                                </div>
                            ` : `
                                <div class="mt-2">
                                    <span class="badge badge-secondary">
                                        <i class="fas fa-clock"></i> Menunggu Bukti Transfer
                                    </span>
                                </div>
                            `}
                        </div>
                        <div class="col-md-4 text-right">
                            <button class="btn btn-success btn-sm" onclick="verifyTopup('${request.id}', true)">
                                <i class="fas fa-check"></i> Approve
                            </button>
                            <button class="btn btn-danger btn-sm" onclick="verifyTopup('${request.id}', false)">
                                <i class="fas fa-times"></i> Reject
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `);
        container.append(card);
    });
}

function loadSaldoData() {
    $.get('/api/saldo/users', function(response) {
        console.log('Saldo users raw response:', response);
        // Handle response that might be {data: Array} or direct array
        let data = response;
        if (response && typeof response === 'object' && 'data' in response) {
            data = response.data;
        }
        
        // Ensure data is an array
        if (!Array.isArray(data)) {
            console.error('Invalid saldo data:', response);
            allSaldoData = [];
            saldoTable.clear().draw();
            return;
        }
        console.log('Saldo users processed:', data);
        console.log('Users with saldo > 0:', data.filter(u => u.saldo > 0));
        allSaldoData = data;
        
        // Filter only users with saldo > 0
        const usersWithSaldo = data.filter(u => u.saldo > 0);
        
        saldoTable.clear();
        
        usersWithSaldo.forEach((user, index) => {
            // Extract name and phone for display
            const phoneNumber = user.id.replace('@s.whatsapp.net', '');
            const displayName = user.name || phoneNumber;
            
            // Enhanced display: Show name + phone number for clarity
            // This prevents confusion when multiple accounts have same name
            const nameDisplay = user.name 
                ? `<strong>${displayName}</strong><br><small class="text-muted">${phoneNumber}</small>`
                : phoneNumber;
            
            saldoTable.row.add([
                index + 1,
                user.id,
                nameDisplay,
                formatRupiah(user.saldo || 0),
                formatDate(user.updated_at || new Date()),
                `
                    <button class="btn btn-sm btn-primary" onclick="showUserTransactions('${user.id}')">
                        <i class="fas fa-history"></i>
                    </button>
                    <button class="btn btn-sm btn-success" onclick="showAddSaldoModal('${user.id}')">
                        <i class="fas fa-plus"></i>
                    </button>
                `
            ]);
        });
        
        saldoTable.draw();
    }).fail(function() {
        console.error('Failed to load saldo data');
    });
}

function loadTransactions() {
    console.log('[LOAD_TRANSACTIONS] Starting to load transactions...');
    $.get('/api/saldo/transactions', function(response) {
        console.log('[LOAD_TRANSACTIONS] Raw response:', response);
        // Handle response that might be {data: Array} or direct array
        let data = response;
        if (response && typeof response === 'object' && 'data' in response) {
            data = response.data;
        }
        
        // Ensure data is an array
        if (!Array.isArray(data)) {
            console.error('Invalid transactions data:', response);
            allTransactions = [];
            renderTransactions([]);
            return;
        }
        console.log('[LOAD_TRANSACTIONS] Processed data:', data);
        console.log('[LOAD_TRANSACTIONS] Sample transaction:', data[0]);
        allTransactions = data;
        renderTransactions(data);
    }).fail(function(xhr, status, error) {
        console.error('Failed to load transactions:', status, error, xhr.responseText);
        allTransactions = [];
        renderTransactions([]);
    });
}

function renderTransactions(transactions) {
    transactionTable.clear();
    
    // Ensure transactions is an array
    if (!Array.isArray(transactions)) {
        console.error('Invalid transactions array:', transactions);
        transactionTable.draw();
        return;
    }
    
    transactions.forEach(tx => {
        const typeClass = tx.type === 'credit' ? 'credit' : 'debit';
        const typeIcon = tx.type === 'credit' ? '↓' : '↑';
        
        // Format user display: try to find name from saldo data
        const phoneNumber = tx.userId.replace('@s.whatsapp.net', '');
        const userSaldo = allSaldoData.find(u => u.id === tx.userId);
        const userDisplay = userSaldo && userSaldo.name
            ? `<strong>${userSaldo.name}</strong><br><small class="text-muted">${phoneNumber}</small>`
            : phoneNumber;
        
        // Proof button
        let proofButton = '<span class="text-muted">-</span>';
        
        // DEBUG: Log untuk transaksi tertentu
        if (tx.id === 'TRX1761114032174RRZH6') {
            console.log('[DEBUG] Transaction TRX1761114032174RRZH6:', tx);
            console.log('[DEBUG] tx.topupRequestId:', tx.topupRequestId);
            console.log('[DEBUG] tx.hasProof:', tx.hasProof);
        }
        
        if (tx.hasProof) {
            proofButton = `<button class="btn btn-sm btn-success" onclick="viewProof('${tx.id}')" title="Lihat Bukti Transfer">
                <i class="fas fa-file-image"></i> Lihat
            </button>`;
        }
        
        transactionTable.row.add([
            tx.id,
            formatDate(tx.created_at),
            userDisplay,
            `<span class="${typeClass}">${typeIcon} ${tx.type.toUpperCase()}</span>`,
            `<span class="${typeClass}">${formatRupiah(tx.amount)}</span>`,
            tx.description,
            formatRupiah(tx.balance_after || 0),
            proofButton
        ]);
    });
    
    transactionTable.draw();
}

// View topup proof from transaction (popup modal)
function viewProof(transactionId) {
    const proofUrl = `/api/saldo/transaction/${transactionId}/proof`;
    
    Swal.fire({
        title: 'Bukti Transfer',
        html: `
            <div class="text-center">
                <img src="${proofUrl}" class="img-fluid" style="max-height: 500px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                <div class="mt-3">
                    <p class="text-muted mb-2">
                        <i class="fas fa-receipt"></i> Transaction ID: <code>${transactionId}</code>
                    </p>
                    <a href="${proofUrl}" target="_blank" class="btn btn-sm btn-outline-primary">
                        <i class="fas fa-external-link-alt"></i> Buka di Tab Baru
                    </a>
                </div>
            </div>
        `,
        width: '700px',
        showCloseButton: true,
        confirmButtonText: '<i class="fas fa-times"></i> Tutup',
        confirmButtonColor: '#6c757d',
        customClass: {
            popup: 'animated fadeIn faster'
        }
    });
}

function loadVouchers() {
    $.get('/api/saldo/vouchers', function(data) {
        voucherTable.clear();
        
        data.forEach(voucher => {
            voucherTable.row.add([
                voucher.prof,
                voucher.namavc,
                voucher.durasivc,
                formatRupiah(voucher.hargavc),
                `
                    <button class="btn btn-sm btn-warning" onclick="editVoucher('${voucher.prof}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="deleteVoucher('${voucher.prof}')">
                        <i class="fas fa-trash"></i>
                    </button>
                `
            ]);
        });
        
        voucherTable.draw();
    }).fail(function() {
        console.error('Failed to load vouchers');
    });
}

function showAddSaldoModal(userId = '') {
    $('#addSaldoUserId').val(userId);
    $('#addSaldoModal').modal('show');
}

function addSaldoManual() {
    const userId = $('#addSaldoUserId').val();
    const amount = $('#addSaldoAmount').val();
    const description = $('#addSaldoDescription').val();

    if (!userId || !amount) {
        Swal.fire('Error', 'Lengkapi semua field', 'error');
        return;
    }

    // Format user ID if needed
    let formattedUserId = userId;
    if (!userId.includes('@')) {
        formattedUserId = userId + '@s.whatsapp.net';
    }

    $.post('/api/saldo/add-manual', {
        userId: formattedUserId,
        amount: amount,
        description: description
    }, function(response) {
        if (response.success) {
            Swal.fire('Sukses', 'Saldo berhasil ditambahkan', 'success');
            $('#addSaldoModal').modal('hide');
            $('#addSaldoForm')[0].reset();
            loadSaldoData();
            loadTransactions();
            loadStatistics();
        } else {
            Swal.fire('Error', response.message || 'Gagal menambah saldo', 'error');
        }
    }).fail(function() {
        Swal.fire('Error', 'Gagal menambah saldo', 'error');
    });
}

function verifyTopup(requestId, approved) {
    const action = approved ? 'approve' : 'reject';
    const title = approved ? 'Approve Topup?' : 'Reject Topup?';
    const text = approved ? 'Saldo akan ditambahkan ke user' : 'Request topup akan ditolak';
    
    Swal.fire({
        title: title,
        text: text,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: approved ? 'Ya, Approve' : 'Ya, Reject',
        cancelButtonText: 'Batal'
    }).then((result) => {
        if (result.isConfirmed) {
            $.post('/api/saldo/verify-topup', {
                requestId: requestId,
                approved: approved
            }, function(response) {
                if (response.success) {
                    Swal.fire('Sukses', `Topup berhasil di-${action}`, 'success');
                    loadTopupRequests();
                    loadSaldoData();
                    loadTransactions();
                    loadStatistics();
                } else {
                    Swal.fire('Error', response.message || 'Gagal memproses request', 'error');
                }
            }).fail(function() {
                Swal.fire('Error', 'Gagal memproses request', 'error');
            });
        }
    });
}

function showUserTransactions(userId) {
    // Filter transactions for specific user
    const userTransactions = allTransactions.filter(tx => tx.userId === userId);
    
    // Create modal content
    let content = '<div class="table-responsive"><table class="table table-sm">';
    content += '<thead><tr><th>Tanggal</th><th>Tipe</th><th>Jumlah</th><th>Keterangan</th></tr></thead><tbody>';
    
    if (userTransactions.length === 0) {
        content += '<tr><td colspan="4" class="text-center">Tidak ada transaksi</td></tr>';
    } else {
        userTransactions.slice(0, 10).forEach(tx => {
            const typeClass = tx.type === 'credit' ? 'text-success' : 'text-danger';
            content += `<tr>
                <td>${formatDate(tx.created_at)}</td>
                <td class="${typeClass}">${tx.type.toUpperCase()}</td>
                <td class="${typeClass}">${formatRupiah(tx.amount)}</td>
                <td>${tx.description}</td>
            </tr>`;
        });
    }
    
    content += '</tbody></table></div>';
    
    Swal.fire({
        title: `Riwayat Transaksi: ${userId}`,
        html: content,
        width: '800px',
        confirmButtonText: 'Tutup'
    });
}

function showAddVoucherModal() {
    Swal.fire({
        title: 'Tambah Voucher',
        html: `
            <div class="form-group text-left">
                <label>Profile</label>
                <input type="text" id="voucherProfile" class="form-control" placeholder="Contoh: Paket-1Hari">
            </div>
            <div class="form-group text-left">
                <label>Nama Voucher</label>
                <input type="text" id="voucherName" class="form-control" placeholder="Contoh: Paket 1 Hari">
            </div>
            <div class="form-group text-left">
                <label>Durasi</label>
                <input type="text" id="voucherDuration" class="form-control" placeholder="Contoh: 1 Hari">
            </div>
            <div class="form-group text-left">
                <label>Harga</label>
                <input type="number" id="voucherPrice" class="form-control" min="1000" placeholder="Contoh: 5000">
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: 'Tambah',
        cancelButtonText: 'Batal',
        preConfirm: () => {
            const profile = $('#voucherProfile').val();
            const name = $('#voucherName').val();
            const duration = $('#voucherDuration').val();
            const price = $('#voucherPrice').val();
            
            if (!profile || !name || !duration || !price) {
                Swal.showValidationMessage('Lengkapi semua field');
                return false;
            }
            
            return { profile, name, duration, price };
        }
    }).then((result) => {
        if (result.isConfirmed) {
            addVoucher(result.value);
        }
    });
}

function addVoucher(data) {
    $.post('/api/saldo/add-voucher', {
        prof: data.profile,
        namavc: data.name,
        durasivc: data.duration,
        hargavc: data.price
    }, function(response) {
        if (response.success) {
            Swal.fire('Sukses', 'Voucher berhasil ditambahkan', 'success');
            loadVouchers();
        } else {
            Swal.fire('Error', response.message || 'Gagal menambah voucher', 'error');
        }
    }).fail(function() {
        Swal.fire('Error', 'Gagal menambah voucher', 'error');
    });
}

function deleteVoucher(profile) {
    Swal.fire({
        title: 'Hapus Voucher?',
        text: 'Voucher akan dihapus permanen',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        confirmButtonText: 'Ya, Hapus',
        cancelButtonText: 'Batal'
    }).then((result) => {
        if (result.isConfirmed) {
            $.post('/api/saldo/delete-voucher', {
                prof: profile
            }, function(response) {
                if (response.success) {
                    Swal.fire('Sukses', 'Voucher berhasil dihapus', 'success');
                    loadVouchers();
                } else {
                    Swal.fire('Error', response.message || 'Gagal menghapus voucher', 'error');
                }
            }).fail(function() {
                Swal.fire('Error', 'Gagal menghapus voucher', 'error');
            });
        }
    });
}

function editVoucher(profile) {
    // Find voucher data
    $.get('/api/saldo/vouchers', function(vouchers) {
        const voucher = vouchers.find(v => v.prof === profile);
        if (!voucher) {
            Swal.fire('Error', 'Voucher tidak ditemukan', 'error');
            return;
        }
        
        Swal.fire({
            title: 'Edit Voucher',
            html: `
                <div class="form-group text-left">
                    <label>Profile</label>
                    <input type="text" id="editProfile" class="form-control" value="${voucher.prof}" readonly>
                </div>
                <div class="form-group text-left">
                    <label>Nama Voucher</label>
                    <input type="text" id="editName" class="form-control" value="${voucher.namavc}">
                </div>
                <div class="form-group text-left">
                    <label>Durasi</label>
                    <input type="text" id="editDuration" class="form-control" value="${voucher.durasivc}">
                </div>
                <div class="form-group text-left">
                    <label>Harga</label>
                    <input type="number" id="editPrice" class="form-control" min="1000" value="${voucher.hargavc}">
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: 'Simpan',
            cancelButtonText: 'Batal',
            preConfirm: () => {
                const name = $('#editName').val();
                const duration = $('#editDuration').val();
                const price = $('#editPrice').val();
                
                if (!name || !duration || !price) {
                    Swal.showValidationMessage('Lengkapi semua field');
                    return false;
                }
                
                return { profile, name, duration, price };
            }
        }).then((result) => {
            if (result.isConfirmed) {
                updateVoucher(result.value);
            }
        });
    });
}

function updateVoucher(data) {
    $.post('/api/saldo/update-voucher', {
        prof: data.profile,
        namavc: data.name,
        durasivc: data.duration,
        hargavc: data.price
    }, function(response) {
        if (response.success) {
            Swal.fire('Sukses', 'Voucher berhasil diupdate', 'success');
            loadVouchers();
        } else {
            Swal.fire('Error', response.message || 'Gagal update voucher', 'error');
        }
    }).fail(function() {
        Swal.fire('Error', 'Gagal update voucher', 'error');
    });
}

function getStatusBadge(status) {
    const badges = {
        'pending': '<span class="badge badge-warning">Pending</span>',
        'waiting_verification': '<span class="badge badge-info">Menunggu Verifikasi</span>',
        'verified': '<span class="badge badge-success">Terverifikasi</span>',
        'rejected': '<span class="badge badge-danger">Ditolak</span>',
        'cancelled': '<span class="badge badge-secondary">Dibatalkan</span>'
    };
    return badges[status] || '<span class="badge badge-secondary">Unknown</span>';
}

function viewTopupProof(requestId, proofFile) {
    const proofPath = `/temp/topup_proofs/${proofFile}`;
    Swal.fire({
        title: 'Bukti Transfer',
        html: `
            <div class="text-center">
                <img src="${proofPath}" class="img-fluid" style="max-height: 400px;">
                <div class="mt-3">
                    <p class="text-muted">Request ID: ${requestId}</p>
                </div>
            </div>
        `,
        width: '600px',
        confirmButtonText: 'Tutup'
    });
}

function verifyTopup(requestId, approved) {
    const title = approved ? 'Approve Topup?' : 'Reject Topup?';
    const text = approved ? 'Saldo akan ditambahkan ke user' : 'Request akan ditolak';
    
    Swal.fire({
        title: title,
        text: text,
        input: approved ? null : 'textarea',
        inputPlaceholder: approved ? null : 'Alasan penolakan (opsional)',
        icon: approved ? 'question' : 'warning',
        showCancelButton: true,
        confirmButtonColor: approved ? '#28a745' : '#dc3545',
        confirmButtonText: approved ? 'Ya, Approve' : 'Ya, Reject',
        cancelButtonText: 'Batal'
    }).then((result) => {
        if (result.isConfirmed) {
            const notes = result.value || '';
            
            $.post('/api/saldo/verify-topup', {
                requestId: requestId,
                approved: approved,
                notes: notes
            }, function(response) {
                if (response.success) {
                    Swal.fire(
                        'Berhasil!',
                        response.message,
                        'success'
                    );
                    loadTopupRequests();
                    loadStatistics();
                } else {
                    Swal.fire('Error', response.message || 'Gagal memverifikasi topup', 'error');
                }
            }).fail(function() {
                Swal.fire('Error', 'Gagal memverifikasi topup', 'error');
            });
        }
    });
}
