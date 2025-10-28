// Global variables
let allUsers = [];
let filteredUsers = [];
let selectedUsers = new Set();
let currentPage = 1;
const itemsPerPage = 20;

// Initialize page
$(document).ready(function() {
    loadUsers();
    setupEventListeners();
    
    // Initialize Select2
    $('#subscriptionFilter').select2({
        theme: 'bootstrap',
        width: '100%'
    });
    
    // Event handler for toggle status button
    $(document).on('click', '.btn-toggle-status', function() {
        const userId = parseInt($(this).data('id'));
        const currentStatus = $(this).data('paid');
        const newStatus = !currentStatus;
        togglePaymentStatus(userId, newStatus);
    });
    
    // Event handler for send invoice button
    $(document).on('click', '.btn-send-invoice', function() {
        const userId = $(this).data('id');
        const userName = $(this).data('name');
        const phoneNumber = $(this).data('phone') || '';
        showPaymentMethodModal(userId, userName, phoneNumber, 'send');
    });
    
    // Event handler for print invoice button
    $(document).on('click', '.btn-print-invoice', function() {
        const userId = $(this).data('id');
        const userName = $(this).data('name');
        const phoneNumber = $(this).data('phone') || '';
        showPaymentMethodModal(userId, userName, phoneNumber, 'print');
    });
});

// Load users data
async function loadUsers() {
    showLoading('Memuat data pelanggan...');
    
    try {
        const response = await fetch('/api/users');
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data && data.status === 200 && data.data) {
            allUsers = data.data || [];
            filteredUsers = [...allUsers];
            
            // Populate subscription filter
            populateSubscriptionFilter();
            
            // Update statistics
            updateStatistics();
            
            // Render table
            renderTable();
            
            console.log(`Successfully loaded ${allUsers.length} users`);
        } else {
            const errorMessage = data && data.message ? data.message : 'Format data tidak valid';
            console.error('Invalid data format:', data);
            showToast('Error memuat data: ' + errorMessage, 'danger');
        }
    } catch (error) {
        console.error('Error loading users:', error);
        const errorMessage = error.message || 'Error tidak diketahui';
        showToast('Error memuat data pelanggan: ' + errorMessage, 'danger');
        
        // Set empty data to prevent further errors
        allUsers = [];
        filteredUsers = [];
        updateStatistics();
        renderTable();
    } finally {
        hideLoading();
    }
}

// Populate subscription filter
function populateSubscriptionFilter() {
    const subscriptions = [...new Set(allUsers.map(u => u.subscription).filter(s => s))];
    const select = $('#subscriptionFilter');
    
    select.empty().append('<option value="">Semua Paket</option>');
    subscriptions.sort().forEach(sub => {
        select.append(`<option value="${sub}">${sub}</option>`);
    });
    
    select.trigger('change.select2');
}

// Update statistics
function updateStatistics() {
    const total = filteredUsers.length;
    const paid = filteredUsers.filter(u => u.paid === true || u.paid === 1).length;
    const unpaid = total - paid;
    const percentage = total > 0 ? Math.round((paid / total) * 100) : 0;
    
    $('#totalCustomers').text(total);
    $('#paidCustomers').text(paid);
    $('#unpaidCustomers').text(unpaid);
    $('#paidPercentage').text(percentage + '%');
}

// Render table
function renderTable() {
    const tbody = $('#paymentTableBody');
    tbody.empty();
    
    // Calculate pagination
    const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, filteredUsers.length);
    const pageUsers = filteredUsers.slice(startIndex, endIndex);
    
    // Render rows
    pageUsers.forEach(user => {
        const isPaid = user.paid === true || user.paid === 1;
        const phoneNumbers = user.phone_number ? user.phone_number.split('|').join(', ') : '-';
        const isSelected = selectedUsers.has(user.id);
        
        const row = `
            <tr class="payment-row ${isPaid ? 'table-success' : ''}" data-user-id="${user.id}">
                <td class="text-center">
                    <input type="checkbox" class="bulk-select-checkbox user-checkbox" 
                           data-user-id="${user.id}" ${isSelected ? 'checked' : ''}>
                </td>
                <td>${user.id}</td>
                <td>
                    <div class="customer-info">
                        <div class="customer-avatar">${user.name ? user.name.charAt(0).toUpperCase() : '?'}</div>
                        <div>
                            <div class="font-weight-bold">${user.name || 'Tanpa Nama'}</div>
                            <small class="text-muted">${user.address ? user.address.substring(0, 50) + '...' : 'Alamat tidak tersedia'}</small>
                        </div>
                    </div>
                </td>
                <td>${phoneNumbers}</td>
                <td>${user.subscription || '-'}</td>
                <td><small>${user.device_id || '-'}</small></td>
                <td class="text-center">
                    ${isPaid ? 
                        '<span class="badge badge-success status-badge">Sudah Bayar</span>' : 
                        '<span class="badge badge-danger status-badge">Belum Bayar</span>'}
                </td>
                <td class="text-center">
                    <div class="btn-group" role="group">
                        <button class="btn btn-sm ${user.paid ? 'btn-success' : 'btn-warning'} btn-toggle-status" 
                                data-id="${user.id}" 
                                data-paid="${user.paid}" 
                                data-name="${user.name}"
                                data-phone="${user.phone_number || ''}"
                                data-send-invoice="${user.send_invoice || false}"
                                title="Ubah status pembayaran">
                            <i class="fas fa-${user.paid ? 'check-circle' : 'times-circle'}"></i>
                        </button>
                        ${isPaid && (user.send_invoice === true || user.send_invoice === 1) ? 
                            `<button class="btn btn-sm btn-info btn-send-invoice" 
                                    data-id="${user.id}"
                                    data-name="${user.name}"
                                    data-phone="${user.phone_number || ''}"
                                    title="Kirim Invoice">
                                <i class="fas fa-file-invoice"></i>
                            </button>` : ''}
                        ${isPaid ? 
                            `<button class="btn btn-sm btn-warning btn-print-invoice" 
                                    data-id="${user.id}" 
                                    data-name="${user.name}"
                                    data-phone="${user.phone_number || ''}"
                                    title="Cetak invoice">
                                <i class="fas fa-print"></i>
                            </button>` : ''}
                    </div>
                </td>
            </tr>
        `;
        tbody.append(row);
    });
    
    // Update pagination info
    $('#showingFrom').text(filteredUsers.length > 0 ? startIndex + 1 : 0);
    $('#showingTo').text(endIndex);
    $('#totalRecords').text(filteredUsers.length);
    
    // Render pagination
    renderPagination(totalPages);
    
    // Update bulk action visibility
    updateBulkActionVisibility();
}

// Render pagination
function renderPagination(totalPages) {
    const pagination = $('#pagination');
    pagination.empty();
    
    if (totalPages <= 1) return;
    
    // Previous button
    pagination.append(`
        <li class="page-item ${currentPage === 1 ? 'disabled' : ''}">
            <a class="page-link" href="#" onclick="changePage(${currentPage - 1}); return false;">
                <i class="fas fa-chevron-left"></i>
            </a>
        </li>
    `);
    
    // Page numbers
    const maxVisible = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let endPage = Math.min(totalPages, startPage + maxVisible - 1);
    
    if (endPage - startPage < maxVisible - 1) {
        startPage = Math.max(1, endPage - maxVisible + 1);
    }
    
    if (startPage > 1) {
        pagination.append(`
            <li class="page-item">
                <a class="page-link" href="#" onclick="changePage(1); return false;">1</a>
            </li>
        `);
        if (startPage > 2) {
            pagination.append('<li class="page-item disabled"><span class="page-link">...</span></li>');
        }
    }
    
    for (let i = startPage; i <= endPage; i++) {
        pagination.append(`
            <li class="page-item ${i === currentPage ? 'active' : ''}">
                <a class="page-link" href="#" onclick="changePage(${i}); return false;">${i}</a>
            </li>
        `);
    }
    
    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            pagination.append('<li class="page-item disabled"><span class="page-link">...</span></li>');
        }
        pagination.append(`
            <li class="page-item">
                <a class="page-link" href="#" onclick="changePage(${totalPages}); return false;">${totalPages}</a>
            </li>
        `);
    }
    
    // Next button
    pagination.append(`
        <li class="page-item ${currentPage === totalPages ? 'disabled' : ''}">
            <a class="page-link" href="#" onclick="changePage(${currentPage + 1}); return false;">
                <i class="fas fa-chevron-right"></i>
            </a>
        </li>
    `);
}

// Change page
function changePage(page) {
    const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
    if (page < 1 || page > totalPages) return;
    
    currentPage = page;
    renderTable();
    
    // Scroll to top of table
    $('html, body').animate({
        scrollTop: $('#paymentTable').offset().top - 100
    }, 300);
}

// Toggle payment status
async function togglePaymentStatus(userId, newStatus) {
    const user = allUsers.find(u => u.id === userId);
    if (!user) return;
    
    const action = newStatus ? 'sudah bayar' : 'belum bayar';
    const confirmMsg = `Apakah Anda yakin ingin mengubah status pembayaran <strong>${user.name}</strong> menjadi <strong>${action}</strong>?`;
    
    $('#confirmModalBody').html(confirmMsg);
    $('#confirmModal').modal('show');
    
    $('#confirmActionBtn').off('click').on('click', async function() {
        $('#confirmModal').modal('hide');
        showLoading(`Mengubah status pembayaran...`);
        
        try {
            const response = await fetch('/api/payment-status/bulk-update', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    userIds: [userId],
                    paid: newStatus,
                    triggerNotification: true // Trigger handlePaidStatusChange
                })
            });
            
            const result = await response.json();
            
            if (response.ok) {
                // Update local data
                user.paid = newStatus;
                
                // Re-render
                updateStatistics();
                renderTable();
                
                showToast(`Status pembayaran ${user.name} berhasil diubah`, 'success');
                
                // If marked as paid and has send_invoice enabled, show payment method modal
                if (newStatus && (user.send_invoice === true || user.send_invoice === 1)) {
                    setTimeout(() => {
                        showPaymentMethodModal(userId, user.name, user.phone_number || '', 'send');
                    }, 500);
                } else if (newStatus) {
                    // Just show notification that payment has been confirmed
                    showToast(`✅ Notifikasi pembayaran telah dikirim ke ${user.name}`, 'info');
                }
            } else {
                showToast('Error: ' + result.message, 'danger');
            }
        } catch (error) {
            console.error('Error updating payment status:', error);
            showToast('Error mengubah status pembayaran', 'danger');
        } finally {
            hideLoading();
        }
    });
}

// Send invoice with payment method
async function sendInvoice(userId, method = 'CASH') {
    const user = allUsers.find(u => u.id === userId);
    if (!user) return;
    
    showLoading('Mengirim invoice...');
    
    try {
        const response = await fetch('/api/send-invoice-manual', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                userId,
                userName: user.name,
                phoneNumber: user.phone_number || '',
                method: method
            })
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showToast(`✅ Invoice PDF berhasil dikirim ke ${user.name}`, 'success');
        } else {
            showToast('Error: ' + result.message, 'danger');
        }
    } catch (error) {
        console.error('Error sending invoice:', error);
        showToast('Error mengirim invoice', 'danger');
    } finally {
        hideLoading();
    }
}

// Show payment method modal
function showPaymentMethodModal(userId, userName, phoneNumber, actionType) {
    // Store data in modal
    $('#paymentMethodModal').data('userId', userId);
    $('#paymentMethodModal').data('userName', userName);
    $('#paymentMethodModal').data('phoneNumber', phoneNumber);
    $('#paymentMethodModal').data('actionType', actionType);
    
    // Update modal title
    $('#paymentMethodModalTitle').text(actionType === 'send' ? 'Pilih Metode Pembayaran untuk Invoice' : 'Pilih Metode Pembayaran untuk Cetak');
    
    // Show modal
    $('#paymentMethodModal').modal('show');
}

// Print invoice with payment method
async function printInvoice(userId, method = 'CASH') {
    const user = allUsers.find(u => u.id === userId);
    if (!user) return;
    
    showLoading('Membuat invoice untuk dicetak...');
    
    try {
        const response = await fetch('/api/send-invoice-manual', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                userId,
                userName: user.name,
                phoneNumber: '',
                method: method,
                noSend: true // Don't send, just generate
            })
        });
        
        const result = await response.json();
        
        if (response.ok && result.invoiceId) {
            const printUrl = `/api/view-invoice?id=${result.invoiceId}&userId=${userId}`;
            window.open(printUrl, '_blank');
            showToast('Invoice dibuka untuk dicetak', 'success');
        } else {
            showToast('Error: ' + (result.message || 'Gagal membuat invoice'), 'danger');
        }
    } catch (error) {
        console.error('Error creating invoice for print:', error);
        showToast('Error membuat invoice', 'danger');
    } finally {
        hideLoading();
    }
}

// Bulk update payment status
async function bulkUpdatePaymentStatus(newStatus) {
    if (selectedUsers.size === 0) {
        showToast('Tidak ada pelanggan yang dipilih', 'warning');
        return;
    }
    
    const action = newStatus ? 'sudah bayar' : 'belum bayar';
    const confirmMsg = `Apakah Anda yakin ingin mengubah status pembayaran <strong>${selectedUsers.size} pelanggan</strong> menjadi <strong>${action}</strong>?`;
    
    $('#confirmModalBody').html(confirmMsg);
    $('#confirmModal').modal('show');
    
    $('#confirmActionBtn').off('click').on('click', async function() {
        $('#confirmModal').modal('hide');
        showLoading(`Mengubah status pembayaran ${selectedUsers.size} pelanggan...`);
        
        try {
            const response = await fetch('/api/payment-status/bulk-update', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    userIds: Array.from(selectedUsers),
                    paid: newStatus,
                    triggerNotification: true // Trigger handlePaidStatusChange for all
                })
            });
            
            const result = await response.json();
            
            if (response.ok) {
                // Update local data
                selectedUsers.forEach(userId => {
                    const user = allUsers.find(u => u.id === userId);
                    if (user) user.paid = newStatus;
                });
                
                // Clear selection
                selectedUsers.clear();
                
                // Re-render
                updateStatistics();
                renderTable();
                
                showToast(`Status pembayaran ${result.updated} pelanggan berhasil diubah`, 'success');
                
                if (newStatus) {
                    showToast(`✅ Notifikasi pembayaran telah dikirim ke semua pelanggan yang diubah`, 'info');
                }
            } else {
                showToast('Error: ' + result.message, 'danger');
            }
        } catch (error) {
            console.error('Error bulk updating payment status:', error);
            showToast('Error mengubah status pembayaran', 'danger');
        } finally {
            hideLoading();
        }
    });
}

// Bulk send invoices
async function bulkSendInvoices() {
    const eligibleUsers = Array.from(selectedUsers).filter(userId => {
        const user = allUsers.find(u => u.id === userId);
        return user && (user.paid === true || user.paid === 1) && (user.send_invoice === true || user.send_invoice === 1);
    });
    
    if (eligibleUsers.length === 0) {
        showToast('Tidak ada pelanggan yang memenuhi syarat untuk kirim invoice', 'warning');
        return;
    }
    
    const confirmMsg = `Kirim invoice ke <strong>${eligibleUsers.length} pelanggan</strong>?`;
    
    $('#confirmModalBody').html(confirmMsg);
    $('#confirmModal').modal('show');
    
    $('#confirmActionBtn').off('click').on('click', async function() {
        $('#confirmModal').modal('hide');
        showLoading(`Mengirim invoice ke ${eligibleUsers.length} pelanggan...`);
        
        let successCount = 0;
        let failCount = 0;
        
        for (const userId of eligibleUsers) {
            try {
                const response = await fetch('/api/send-invoice-manual', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ userId })
                });
                
                const result = await response.json();
                
                if (result.status === 200) {
                    successCount++;
                } else {
                    failCount++;
                }
            } catch (error) {
                console.error(`Error sending invoice to user ${userId}:`, error);
                failCount++;
            }
        }
        
        hideLoading();
        
        if (successCount > 0) {
            showToast(`Invoice berhasil dikirim ke ${successCount} pelanggan`, 'success');
        }
        if (failCount > 0) {
            showToast(`Gagal mengirim invoice ke ${failCount} pelanggan`, 'warning');
        }
    });
}

// Setup event listeners
function setupEventListeners() {
    // Filter listeners
    $('#statusFilter').on('change', applyFilters);
    $('#subscriptionFilter').on('change', applyFilters);
    $('#searchInput').on('keyup', debounce(applyFilters, 300));
    $('#searchBtn').on('click', applyFilters);
    $('#clearFilters').on('click', clearFilters);
    
    // Select all checkbox
    $('#selectAllCheckbox, #selectAllHeader').on('change', function() {
        const isChecked = $(this).prop('checked');
        $('#selectAllCheckbox, #selectAllHeader').prop('checked', isChecked);
        
        $('.user-checkbox').each(function() {
            const userId = parseInt($(this).data('user-id'));
            $(this).prop('checked', isChecked);
            
            if (isChecked) {
                selectedUsers.add(userId);
            } else {
                selectedUsers.delete(userId);
            }
        });
        
        updateBulkActionVisibility();
    });
    
    // Individual checkbox
    $(document).on('change', '.user-checkbox', function() {
        const userId = parseInt($(this).data('user-id'));
        
        if ($(this).prop('checked')) {
            selectedUsers.add(userId);
        } else {
            selectedUsers.delete(userId);
        }
        
        updateBulkActionVisibility();
    });
    
    // Bulk action buttons
    $('#markPaidBtn').on('click', () => bulkUpdatePaymentStatus(true));
    $('#markUnpaidBtn').on('click', () => bulkUpdatePaymentStatus(false));
    $('#sendInvoiceBtn').on('click', bulkSendInvoices);
    $('#deselectAllBtn').on('click', () => {
        selectedUsers.clear();
        $('.user-checkbox').prop('checked', false);
        $('#selectAllCheckbox, #selectAllHeader').prop('checked', false);
        updateBulkActionVisibility();
    });
    
    // Payment method modal confirmation
    $('#confirmPaymentMethodBtn').on('click', async function() {
        const userId = $('#paymentMethodModal').data('userId');
        const userName = $('#paymentMethodModal').data('userName');
        const actionType = $('#paymentMethodModal').data('actionType');
        const method = $('#paymentMethodSelect').val();
        
        $('#paymentMethodModal').modal('hide');
        
        if (actionType === 'send') {
            await sendInvoice(userId, method);
        } else if (actionType === 'print') {
            await printInvoice(userId, method);
        }
    });
}

// Apply filters
function applyFilters() {
    const status = $('#statusFilter').val();
    const subscription = $('#subscriptionFilter').val();
    const searchTerm = $('#searchInput').val().toLowerCase();
    
    filteredUsers = allUsers.filter(user => {
        // Status filter
        if (status) {
            const isPaid = user.paid === true || user.paid === 1;
            if (status === 'paid' && !isPaid) return false;
            if (status === 'unpaid' && isPaid) return false;
        }
        
        // Subscription filter
        if (subscription && user.subscription !== subscription) {
            return false;
        }
        
        // Search filter
        if (searchTerm) {
            const name = (user.name || '').toLowerCase();
            const phone = (user.phone_number || '').toLowerCase();
            const deviceId = (user.device_id || '').toLowerCase();
            const address = (user.address || '').toLowerCase();
            
            if (!name.includes(searchTerm) && 
                !phone.includes(searchTerm) && 
                !deviceId.includes(searchTerm) &&
                !address.includes(searchTerm)) {
                return false;
            }
        }
        
        return true;
    });
    
    currentPage = 1;
    updateStatistics();
    renderTable();
}

// Clear filters
function clearFilters() {
    $('#statusFilter').val('');
    $('#subscriptionFilter').val('').trigger('change.select2');
    $('#searchInput').val('');
    
    filteredUsers = [...allUsers];
    currentPage = 1;
    updateStatistics();
    renderTable();
}

// Update bulk action visibility
function updateBulkActionVisibility() {
    if (selectedUsers.size > 0) {
        $('#bulkActions').show();
        $('#selectedCount').text(selectedUsers.size);
    } else {
        $('#bulkActions').hide();
    }
}

// Show loading overlay
function showLoading(text = 'Memproses...') {
    $('#loadingText').text(text);
    $('#loadingOverlay').addClass('show');
}

// Hide loading overlay
function hideLoading() {
    $('#loadingOverlay').removeClass('show');
}

// Show toast notification
function showToast(message, type = 'info') {
    const toastId = 'toast-' + Date.now();
    const toastHtml = `
        <div id="${toastId}" class="toast" role="alert" aria-live="assertive" aria-atomic="true" data-delay="5000">
            <div class="toast-header bg-${type} text-white">
                <strong class="mr-auto">
                    ${type === 'success' ? '<i class="fas fa-check-circle"></i>' : 
                      type === 'danger' ? '<i class="fas fa-exclamation-circle"></i>' : 
                      type === 'warning' ? '<i class="fas fa-exclamation-triangle"></i>' : 
                      '<i class="fas fa-info-circle"></i>'} 
                    Notifikasi
                </strong>
                <button type="button" class="ml-2 mb-1 close text-white" data-dismiss="toast" aria-label="Close">
                    <span aria-hidden="true">&times;</span>
                </button>
            </div>
            <div class="toast-body">
                ${message}
            </div>
        </div>
    `;
    
    $('#toastContainer').append(toastHtml);
    $(`#${toastId}`).toast('show');
    
    $(`#${toastId}`).on('hidden.bs.toast', function() {
        $(this).remove();
    });
}

// Debounce function
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}
