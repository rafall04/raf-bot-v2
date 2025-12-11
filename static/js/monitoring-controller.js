/**
 * Monitoring Dashboard Controller
 * Handles real-time updates and user interactions
 */

class MonitoringController {
    constructor() {
        this.socket = null;
        this.charts = {};
        this.updateInterval = null;
        this.trafficPeriod = '5m';
        this.alerts = [];
        this.currentInterface = 'ether1';
        this.isConnected = false;
        this.mikrotikConnected = false;
        this.useSocketIO = false;
        this.socketErrorLogged = false;
        
        this.init();
    }
    
    init() {
        if (this.useSocketIO) {
            this.connectSocket();
        } else {
            this.isConnected = true;
        }
        
        this.initCharts();
        this.startUpdateLoop();
        this.bindEvents();
        this.initClickableStatCards();
    }
    
    connectSocket() {
        const socketUrl = window.location.protocol + '//' + window.location.hostname + 
                         (window.location.port ? ':' + window.location.port : '');
        
        this.socket = io(socketUrl, {
            auth: {
                token: localStorage.getItem('token')
            },
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            reconnectionAttempts: 5
        });
        
        this.socket.on('connect', () => {
            console.log('Connected to monitoring server via Socket.IO');
            this.isConnected = true;
            this.updateConnectionStatus('connected');
        });
        
        this.socket.on('disconnect', () => {
            console.log('Disconnected from monitoring server');
            this.isConnected = false;
            this.mikrotikConnected = false;
            this.updateConnectionStatus('disconnected');
        });
        
        this.socket.on('connect_error', (error) => {
            if (!this.socketErrorLogged) {
                console.warn('Socket.IO connection failed. Falling back to polling mode.');
                this.socketErrorLogged = true;
            }
        });
        
        this.socket.on('monitoring:update', (data) => {
            this.handleMonitoringUpdate(data);
        });
        
        this.socket.on('mikrotik:traffic', (data) => {
            this.updateTrafficChart(data);
        });
        
        this.socket.on('mikrotik:users', (data) => {
            this.updateUserTables(data);
        });
        
        this.socket.on('alert:new', (alert) => {
            this.handleNewAlert(alert);
        });
    }
    
    initCharts() {
        const ctx = document.getElementById('traffic-chart');
        if (!ctx) return;
        
        this.trafficChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Download',
                    data: [],
                    borderColor: 'rgb(75, 192, 192)',
                    backgroundColor: 'rgba(75, 192, 192, 0.2)',
                    tension: 0.1
                }, {
                    label: 'Upload',
                    data: [],
                    borderColor: 'rgb(255, 99, 132)',
                    backgroundColor: 'rgba(255, 99, 132, 0.2)',
                    tension: 0.1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Mbps'
                        }
                    },
                    x: {
                        display: true
                    }
                },
                plugins: {
                    legend: {
                        display: true,
                        position: 'top'
                    }
                }
            }
        });
    }
    
    async fetchTrafficHistory() {
        if (!this.mikrotikConnected) {
            if (this.trafficChart) {
                const emptyData = new Array(this.trafficChart.data.labels.length || 20).fill(0);
                this.trafficChart.data.datasets[0].data = emptyData;
                this.trafficChart.data.datasets[1].data = emptyData;
                this.trafficChart.update();
            }
            return;
        }
        
        try {
            const response = await fetch('/api/monitoring/history');
            if (response.ok) {
                const result = await response.json();
                const history = result.data;
                
                if (this.trafficChart && history) {
                    this.trafficChart.options.plugins.title = {
                        display: false
                    };
                    
                    this.trafficChart.options.animation = {
                        duration: 750
                    };
                    
                    const labels = history.map(h => new Date(h.time).toLocaleTimeString());
                    const downloadData = history.map(h => h.download);
                    const uploadData = history.map(h => h.upload);
                    
                    this.trafficChart.data.labels = labels;
                    this.trafficChart.data.datasets[0].data = downloadData;
                    this.trafficChart.data.datasets[1].data = uploadData;
                    this.trafficChart.update();
                }
            }
        } catch (error) {
            console.error('Error fetching traffic history:', error);
            this.mikrotikConnected = false;
            this.handleDisconnection();
        }
    }
    
    startUpdateLoop() {
        if (document.readyState === 'complete') {
            this.startUpdateLoopImmediate();
        } else {
            window.addEventListener('load', () => {
                this.startUpdateLoopImmediate();
            });
        }
    }
    
    startUpdateLoopImmediate() {
        setTimeout(() => {
            this.fetchUserStatsFromStats();
            this.fetchMonitoringData();
            
            if (this.trafficChart) {
                this.fetchTrafficHistory();
            }
            
            this.updateInterval = setInterval(() => {
                this.fetchUserStatsFromStats();
                this.fetchMonitoringData();
                
                if (this.trafficChart && this.mikrotikConnected) {
                    this.fetchTrafficHistory();
                }
            }, 5000);
        }, 1000);
    }
    
    async fetchMonitoringData() {
        try {
            const interfaceSelector = document.getElementById('interface-selector');
            let selectedInterface = '';
            
            if (interfaceSelector && interfaceSelector.value) {
                selectedInterface = interfaceSelector.value;
                this.currentInterface = selectedInterface;
            } else {
                selectedInterface = this.currentInterface || 'ether1';
            }
            
            const url = `/api/monitoring/live?interface=${encodeURIComponent(selectedInterface)}`;
            
            const response = await fetch(url, {
                method: 'GET',
                credentials: 'same-origin',
                cache: 'no-cache',
                headers: {
                    'Cache-Control': 'no-cache'
                }
            });
            
            if (!response.ok) {
                console.error('[Monitoring] HTTP Error:', response.status, response.statusText);
                throw new Error(`Failed to fetch monitoring data: ${response.status}`);
            }
            
            const result = await response.json();
            
            if (result.status === 503 || result.error || !result.data) {
                console.error('[Monitoring] MikroTik Error:', result.message || result.error || 'No data received');
                this.mikrotikConnected = false;
                this.handleDisconnection();
                return;
            }
            
            const data = result.data;
            
            if (data) {
                if (data.mikrotik && (data.mikrotik.connected === true || data.mikrotik.cpu !== undefined)) {
                    this.mikrotikConnected = true;
                } else {
                    this.mikrotikConnected = false;
                }
                
                if (data.systemHealth) {
                    this.updateSystemHealth(data.systemHealth);
                }
                
                this.fetchWhatsAppStatus();
                
                if (data.mikrotik) {
                    this.updateMikroTikStatus(data.mikrotik);
                }
                
                if (data.traffic) {
                    this.updateTrafficData(data.traffic);
                }
                
                if (data.resources) {
                    this.updateResourceBars(data.resources);
                }
                
                if (data.alerts) {
                    this.updateAlerts(data.alerts);
                }
                
                if (data.users) {
                    this.updateUserStats(data.users);
                }
                this.fetchUserStatsFromStats();
                
                if (data.interfaces) {
                    this.populateInterfaceSelector(data.interfaces);
                }
            } else {
                console.error('[Monitoring] No data received from API');
                this.mikrotikConnected = false;
                this.handleDisconnection();
                return;
            }
            
        } catch (error) {
            console.error('[Monitoring] Error fetching monitoring data:', error);
            this.mikrotikConnected = false;
            this.handleDisconnection();
        }
    }
    
    updateSystemHealth(health) {
        const scoreEl = document.getElementById('health-score');
        const statusEl = document.getElementById('health-status');
        const boxEl = document.getElementById('health-status-box');
        
        let actualScore = 95;
        if (health.checks) {
            const totalChecks = Object.keys(health.checks).length;
            const passedChecks = Object.values(health.checks).filter(v => v === true).length;
            if (totalChecks > 0) {
                actualScore = Math.round((passedChecks / totalChecks) * 100);
            }
        }
        
        if (scoreEl) scoreEl.textContent = `${actualScore}%`;
        if (statusEl) statusEl.textContent = actualScore >= 75 ? 'Healthy' : 'Degraded';
        
        if (boxEl) {
            if (actualScore < 50) {
                boxEl.className = 'modern-card gradient-green error';
            } else {
                boxEl.className = 'modern-card gradient-green';
            }
        }
    }
    
    async fetchWhatsAppStatus() {
        try {
            const response = await fetch('/api/stats', {
                credentials: 'same-origin'
            });
            if (response.ok) {
                const data = await response.json();
                const isConnected = data.botStatus || false;
                this.updateWhatsAppStatus({ connected: isConnected });
                
                const healthChecks = document.querySelector('.health-checks');
                if (healthChecks) {
                    const waCheck = healthChecks.querySelector('[data-check="whatsapp"]');
                    if (waCheck) {
                        waCheck.classList.toggle('check-ok', isConnected);
                        waCheck.classList.toggle('check-error', !isConnected);
                    }
                }
            }
        } catch (error) {
            console.error('[Monitoring] Failed to fetch WhatsApp status:', error);
            this.updateWhatsAppStatus({ connected: false });
        }
    }
    
    updateWhatsAppStatus(wa) {
        const statusEl = document.getElementById('wa-status');
        if (statusEl) {
            statusEl.textContent = wa.connected ? 'Online' : 'Offline';
        }
    }
    
    updateMikroTikStatus(mikrotik) {
        const cpuEl = document.getElementById('mikrotik-cpu');
        const tempEl = document.getElementById('mikrotik-temp');
        
        if (!mikrotik) {
            if (cpuEl) cpuEl.textContent = '0%';
            if (tempEl) tempEl.textContent = '0°C';
            return;
        }
        
        const cpuValue = mikrotik.cpu !== undefined && mikrotik.cpu !== null ? mikrotik.cpu : 0;
        const tempValue = mikrotik.temperature !== undefined && mikrotik.temperature !== null ? mikrotik.temperature : 0;
        
        if (cpuEl) cpuEl.textContent = `${cpuValue}%`;
        if (tempEl) tempEl.textContent = `${tempValue}°C`;
        
        if (mikrotik.connected !== undefined) {
            this.mikrotikConnected = mikrotik.connected;
        }
    }
    
    updateTrafficData(traffic) {
        const dlCurrent = document.getElementById('current-download');
        const ulCurrent = document.getElementById('current-upload');
        const dlTotal = document.getElementById('total-download');
        const ulTotal = document.getElementById('total-upload');
        
        if (!traffic) {
            if (dlCurrent) dlCurrent.textContent = `N/A`;
            if (ulCurrent) ulCurrent.textContent = `N/A`;
            if (dlTotal) dlTotal.textContent = `Total: N/A`;
            if (ulTotal) ulTotal.textContent = `Total: N/A`;
            return;
        }
        
        if (!this.mikrotikConnected) {
            if (dlCurrent) dlCurrent.textContent = `N/A`;
            if (ulCurrent) ulCurrent.textContent = `N/A`;
            if (dlTotal) dlTotal.textContent = `Total: N/A`;
            if (ulTotal) ulTotal.textContent = `Total: N/A`;
            return;
        }
        
        const downloadCurrent = traffic.download?.current !== undefined && traffic.download?.current !== null ? traffic.download.current : 0;
        const uploadCurrent = traffic.upload?.current !== undefined && traffic.upload?.current !== null ? traffic.upload.current : 0;
        const downloadTotal = traffic.download?.total !== undefined && traffic.download?.total !== null ? traffic.download.total : 0;
        const uploadTotal = traffic.upload?.total !== undefined && traffic.upload?.total !== null ? traffic.upload.total : 0;
        
        if (dlCurrent) dlCurrent.textContent = `${downloadCurrent} Mbps`;
        if (ulCurrent) ulCurrent.textContent = `${uploadCurrent} Mbps`;
        
        if (dlTotal) dlTotal.textContent = `Total: ${downloadTotal} GB`;
        if (ulTotal) ulTotal.textContent = `Total: ${uploadTotal} GB`;
        
        if (this.trafficChart && this.mikrotikConnected) {
            if (this.trafficChart.options.plugins.title && this.trafficChart.options.plugins.title.display) {
                this.trafficChart.options.plugins.title.display = false;
                this.trafficChart.options.animation = {
                    duration: 750
                };
            }
            
            const now = new Date().toLocaleTimeString();
            
            if (this.trafficChart.data.labels.length >= 20) {
                this.trafficChart.data.labels.shift();
                this.trafficChart.data.datasets[0].data.shift();
                this.trafficChart.data.datasets[1].data.shift();
            }
            
            this.trafficChart.data.labels.push(now);
            this.trafficChart.data.datasets[0].data.push(downloadCurrent);
            this.trafficChart.data.datasets[1].data.push(uploadCurrent);
            
            this.trafficChart.update('none');
        }
    }
    
    updateResourceBars(resources) {
        if (!resources) {
            return;
        }
        
        const cpuValue = resources.cpu !== undefined && resources.cpu !== null ? resources.cpu : 0;
        const memoryValue = resources.memory !== undefined && resources.memory !== null ? resources.memory : 0;
        const diskValue = resources.disk !== undefined && resources.disk !== null ? resources.disk : 0;
        
        this.updateProgressBar('cpu', cpuValue);
        this.updateProgressBar('memory', memoryValue);
        this.updateProgressBar('disk', diskValue);
        
        const queueBar = document.getElementById('queue-bar');
        const queueText = document.getElementById('queue-text');
        if (queueBar) queueBar.style.width = `${Math.min(resources.messageQueue * 10, 100)}%`;
        if (queueText) queueText.textContent = `${resources.messageQueue} msgs`;
    }
    
    updateAlerts(alerts) {
        const countEl = document.getElementById('alert-count');
        if (countEl) countEl.textContent = alerts.active;
    }
    
    updateUserStats(users) {
        if (!users) {
            return;
        }
        
        const totalUsersEl = document.getElementById('total-users');
        if (totalUsersEl) {
            const total = users.pppoe?.active !== undefined && users.pppoe?.active !== null 
                ? users.pppoe.active 
                : 0;
            totalUsersEl.textContent = total;
        }
        
        const hotspotUsersEl = document.getElementById('hotspot-users-count');
        if (hotspotUsersEl) {
            const hotspotTotal = users.hotspot?.active !== undefined && users.hotspot?.active !== null
                ? users.hotspot.active
                : 0;
            hotspotUsersEl.textContent = hotspotTotal;
        }
    }
    
    async fetchUserStatsFromStats() {
        try {
            const response = await fetch('/api/stats', {
                credentials: 'same-origin'
            });
            
            if (response.ok) {
                const data = await response.json();
                
                const totalUsersEl = document.getElementById('total-users');
                if (totalUsersEl && data.pppStats && !data.pppStats.error) {
                    const pppOnline = data.pppStats.online;
                    if (typeof pppOnline === 'number' && pppOnline >= 0) {
                        totalUsersEl.textContent = pppOnline;
                    }
                }
                
                const hotspotUsersEl = document.getElementById('hotspot-users-count');
                if (hotspotUsersEl && data.hotspotStats && !data.hotspotStats.error) {
                    const hotspotActive = data.hotspotStats.active;
                    if (typeof hotspotActive === 'number' && hotspotActive >= 0) {
                        hotspotUsersEl.textContent = hotspotActive;
                    }
                }
            }
        } catch (error) {
            console.error('[Monitoring] Failed to fetch user stats from /api/stats:', error);
        }
    }

    formatBytesPerSec(bytesPerSec) {
        if (bytesPerSec < 1024) return bytesPerSec + ' B/s';
        if (bytesPerSec < 1048576) return (bytesPerSec / 1024).toFixed(2) + ' KB/s';
        if (bytesPerSec < 1073741824) return (bytesPerSec / 1048576).toFixed(2) + ' MB/s';
        return (bytesPerSec / 1073741824).toFixed(2) + ' GB/s';
    }
    
    formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1048576) return (bytes / 1024).toFixed(2) + ' KB';
        if (bytes < 1073741824) return (bytes / 1048576).toFixed(2) + ' MB';
        return (bytes / 1073741824).toFixed(2) + ' GB';
    }
    
    populateInterfaceSelector(interfaces) {
        const selector = document.getElementById('interface-selector');
        if (!selector) return;
        
        const currentSelection = selector.value || selector.getAttribute('data-selected');
        
        if (!selector.hasAttribute('data-initialized')) {
            selector.addEventListener('change', (e) => {
                const newInterface = e.target.value;
                this.currentInterface = newInterface;
                selector.setAttribute('data-selected', newInterface);
                
                if (this.trafficChart) {
                    this.trafficChart.data.labels = [];
                    this.trafficChart.data.datasets[0].data = [];
                    this.trafficChart.data.datasets[1].data = [];
                    this.trafficChart.update('none');
                }
                
                this.lastData = null;
                this.fetchMonitoringData();
                
                const chartTitle = document.querySelector('.panel-header h5');
                if (chartTitle) {
                    chartTitle.innerHTML = `<i class="fas fa-chart-line me-2"></i>Network Traffic Monitor - ${newInterface}`;
                }
            });
            selector.setAttribute('data-initialized', 'true');
        }
        
        if (selector.options.length === 0) {
            interfaces.forEach(iface => {
                const option = document.createElement('option');
                option.value = iface.name;
                const status = iface.running ? '●' : '○';
                option.textContent = `${status} ${iface.name} (${iface.type})`;
                selector.appendChild(option);
            });
            
            if (currentSelection && selector.querySelector(`option[value="${currentSelection}"]`)) {
                selector.value = currentSelection;
                selector.setAttribute('data-selected', currentSelection);
                this.currentInterface = currentSelection;
            } else if (selector.querySelector('option[value="ether1"]')) {
                selector.value = 'ether1';
                selector.setAttribute('data-selected', 'ether1');
                this.currentInterface = 'ether1';
            }
        } else {
            const currentValue = selector.value;
            for (let i = 0; i < selector.options.length; i++) {
                const option = selector.options[i];
                const iface = interfaces.find(i => i.name === option.value);
                if (iface) {
                    const status = iface.running ? '●' : '○';
                    option.textContent = `${status} ${iface.name} (${iface.type})`;
                }
            }
            selector.value = currentValue;
        }
    }
    
    showErrorMessage(message) {
        // Update MikroTik status box to show error
        const cpuEl = document.getElementById('mikrotik-cpu');
        const tempEl = document.getElementById('mikrotik-temp');
        const statusBox = document.getElementById('mikrotik-status-box');
        
        if (cpuEl) cpuEl.textContent = 'ERROR';
        if (tempEl) tempEl.textContent = 'N/A';
        if (statusBox) {
            statusBox.className = 'modern-card gradient-orange error';
        }
        
        // Update health score to show error
        const healthScore = document.getElementById('health-score');
        const healthBox = document.getElementById('health-status-box');
        
        if (healthScore) healthScore.textContent = '0%';
        if (healthBox) {
            healthBox.className = 'modern-card gradient-green error';
        }
        
        // Update traffic data to show error
        const dlCurrent = document.getElementById('current-download');
        const ulCurrent = document.getElementById('current-upload');
        const dlTotal = document.getElementById('total-download');
        const ulTotal = document.getElementById('total-upload');
        
        if (dlCurrent) dlCurrent.textContent = 'N/A';
        if (ulCurrent) ulCurrent.textContent = 'N/A';
        if (dlTotal) dlTotal.textContent = 'Total: N/A';
        if (ulTotal) ulTotal.textContent = 'Total: N/A';
        
        // Update resource bars to 0
        this.updateProgressBar('cpu', 0);
        this.updateProgressBar('memory', 0);
        this.updateProgressBar('disk', 0);
        
        // Update user count to 0
        const totalUsers = document.getElementById('total-users');
        if (totalUsers) totalUsers.textContent = '0';
        
        // Show error message in console
        console.error('[MikroTik Error]:', message);
    }
    
    // Initialize clickable stat cards
    initClickableStatCards() {
        // Add click event to PPPoE stat card
        const pppoeCard = document.getElementById('pppoe-stat-card');
        if (pppoeCard) {
            pppoeCard.addEventListener('click', () => {
                this.showPPPoEUsers();
            });
        }
        
        // Add click event to Hotspot stat card
        const hotspotCard = document.getElementById('hotspot-stat-card');
        if (hotspotCard) {
            hotspotCard.addEventListener('click', () => {
                this.showHotspotUsers();
            });
        }
    }
    
    // Show Hotspot Users in Modal
    async showHotspotUsers() {
        const modal = $('#userListModal');
        $('#userListTitle').text('Hotspot Active Users');
        
        // Show modal immediately with loading indicator
        const loadingContent = `
            <div class="text-center py-5">
                <div class="spinner-border text-primary" role="status" style="width: 3rem; height: 3rem;">
                    <span class="sr-only">Loading...</span>
                </div>
                <p class="mt-3 text-muted">Memuat data hotspot users...</p>
            </div>
        `;
        $('#userListContent').html(loadingContent);
        modal.modal('show');
        
        try {
            const response = await fetch('/api/monitoring/live', {
                credentials: 'same-origin'
            });
            const result = await response.json();
            
            if (result.data?.users?.hotspot) {
                const sessions = result.data.users.hotspot.sessions || [];
                
                // Use card-based layout for mobile
                let content = '<div class="user-list-container">';
                
                if (sessions.length > 0) {
                    // Desktop table
                    content += '<div class="d-none d-md-block">';
                    content += '<table class="table table-sm table-striped"><thead><tr>';
                    content += '<th>User</th><th>IP</th><th>MAC</th><th>Uptime</th><th>Download</th><th>Upload</th>';
                    content += '</tr></thead><tbody>';
                    
                    sessions.forEach(session => {
                        content += `<tr>
                            <td>${session.user || '-'}</td>
                            <td>${session.address || '-'}</td>
                            <td class="text-muted small">${session.mac || '-'}</td>
                            <td>${session.uptime || '0s'}</td>
                            <td class="text-success">${this.formatBytes(session.rx_bytes || 0)}</td>
                            <td class="text-info">${this.formatBytes(session.tx_bytes || 0)}</td>
                        </tr>`;
                    });
                    content += '</tbody></table></div>';
                    
                    // Mobile cards
                    content += '<div class="d-md-none">';
                    sessions.forEach(session => {
                        content += `<div class="user-card mb-2">
                            <div class="d-flex justify-content-between align-items-center">
                                <strong>${session.user || '-'}</strong>
                                <span class="badge badge-info">${session.uptime || '0s'}</span>
                            </div>
                            <small class="text-muted d-block">${session.address || '-'}</small>
                            <div class="d-flex justify-content-between mt-1">
                                <span class="text-success small">↓ ${this.formatBytes(session.rx_bytes || 0)}</span>
                                <span class="text-info small">↑ ${this.formatBytes(session.tx_bytes || 0)}</span>
                            </div>
                        </div>`;
                    });
                    content += '</div>';
                } else {
                    content += '<div class="alert alert-info text-center">No active hotspot users</div>';
                }
                
                content += '</div>';
                $('#userListContent').html(content);
            } else {
                $('#userListContent').html('<div class="alert alert-warning text-center">Data tidak tersedia</div>');
            }
        } catch (error) {
            console.error('Error fetching hotspot users:', error);
            $('#userListContent').html('<div class="alert alert-danger text-center">Error memuat data: ' + error.message + '</div>');
        }
    }
    
    // Show PPPoE Users in Modal
    async showPPPoEUsers() {
        const modal = $('#userListModal');
        $('#userListTitle').text('PPPoE Active Users');
        
        // Show modal immediately with loading indicator
        const loadingContent = `
            <div class="text-center py-5">
                <div class="spinner-border text-success" role="status" style="width: 3rem; height: 3rem;">
                    <span class="sr-only">Loading...</span>
                </div>
                <p class="mt-3 text-muted">Memuat data PPPoE users...</p>
            </div>
        `;
        $('#userListContent').html(loadingContent);
        modal.modal('show');
        
        try {
            const response = await fetch('/api/monitoring/live', {
                credentials: 'same-origin'
            });
            const result = await response.json();
            
            if (result.data?.users?.pppoe) {
                const sessions = result.data.users.pppoe.sessions || [];
                
                // Use card-based layout for mobile
                let content = '<div class="user-list-container">';
                
                if (sessions.length > 0) {
                    // Desktop table
                    content += '<div class="d-none d-md-block">';
                    content += '<table class="table table-sm table-striped"><thead><tr>';
                    content += '<th>Name</th><th>IP</th><th>Service</th><th>Uptime</th><th>Download</th><th>Upload</th>';
                    content += '</tr></thead><tbody>';
                    
                    sessions.forEach(session => {
                        content += `<tr>
                            <td><strong>${session.name || '-'}</strong></td>
                            <td>${session.address || '-'}</td>
                            <td><span class="badge badge-primary">${session.service || 'pppoe'}</span></td>
                            <td>${session.uptime || '0s'}</td>
                            <td class="text-success">${this.formatBytes(session.rx_bytes || 0)}</td>
                            <td class="text-info">${this.formatBytes(session.tx_bytes || 0)}</td>
                        </tr>`;
                    });
                    content += '</tbody></table></div>';
                    
                    // Mobile cards
                    content += '<div class="d-md-none">';
                    sessions.forEach(session => {
                        content += `<div class="user-card mb-2">
                            <div class="d-flex justify-content-between align-items-center">
                                <strong>${session.name || '-'}</strong>
                                <span class="badge badge-success">${session.uptime || '0s'}</span>
                            </div>
                            <small class="text-muted d-block">${session.address || '-'}</small>
                            <div class="d-flex justify-content-between mt-1">
                                <span class="text-success small">↓ ${this.formatBytes(session.rx_bytes || 0)}</span>
                                <span class="text-info small">↑ ${this.formatBytes(session.tx_bytes || 0)}</span>
                            </div>
                        </div>`;
                    });
                    content += '</div>';
                } else {
                    content += '<div class="alert alert-info text-center">No active PPPoE users</div>';
                }
                
                content += '</div>';
                $('#userListContent').html(content);
            } else {
                $('#userListContent').html('<div class="alert alert-warning text-center">Data tidak tersedia</div>');
            }
        } catch (error) {
            console.error('Error fetching PPPoE users:', error);
            $('#userListContent').html('<div class="alert alert-danger text-center">Error memuat data: ' + error.message + '</div>');
        }
    }
    
    
    updateSystemMetrics(data) {
        // Update health score
        const healthScore = data.health?.score || 100;
        const healthBox = document.getElementById('health-status-box');
        const healthScoreElement = document.getElementById('health-score');
        
        if (healthScoreElement) {
            healthScoreElement.textContent = healthScore;
        }
        
        // Update health box color
        if (healthBox) {
            healthBox.className = healthBox.className.replace(/bg-\w+/, '');
            if (healthScore >= 80) {
                healthBox.classList.add('bg-success');
            } else if (healthScore >= 60) {
                healthBox.classList.add('bg-warning');
            } else {
                healthBox.classList.add('bg-danger');
            }
        }
        
        // Update WhatsApp status
        const waConnected = data.connections?.whatsapp || false;
        const waStatusText = document.getElementById('wa-status-text');
        if (waStatusText) {
            waStatusText.textContent = waConnected ? 'Connected' : 'Disconnected';
        }
        
        const waBox = document.getElementById('wa-status-box');
        if (waBox) {
            waBox.className = waBox.className.replace(/bg-\w+/, '');
            waBox.classList.add(waConnected ? 'bg-info' : 'bg-danger');
        }
        
        // Update uptime
        const uptime = data.system?.uptime || 0;
        const hours = Math.floor(uptime / 3600);
        const minutes = Math.floor((uptime % 3600) / 60);
        const waUptime = document.getElementById('wa-uptime');
        if (waUptime) {
            waUptime.textContent = `Uptime: ${hours}h ${minutes}m`;
        }
        
        // Update resource bars
        this.updateProgressBar('cpu', data.system?.cpu || 0);
        this.updateProgressBar('memory', data.system?.memory || 0);
        this.updateProgressBar('disk', data.system?.disk || 0);
        
        // Update queue
        const queueSize = data.performance?.queueSize || 0;
        const queueText = document.getElementById('queue-text');
        const queueBar = document.getElementById('queue-bar');
        
        if (queueText) {
            queueText.textContent = `${queueSize} msgs`;
        }
        if (queueBar) {
            queueBar.style.width = Math.min(queueSize, 100) + '%';
        }
    }
    
    updateMikrotikMetrics(data) {
        if (!data || data.error) {
            return;
        }
        
        // Update MikroTik CPU
        const mikrotikCpu = document.getElementById('mikrotik-cpu');
        if (mikrotikCpu && data.system) {
            mikrotikCpu.textContent = (data.system.cpu || 0) + '%';
        }
        
        // Update MikroTik Temperature
        const mikrotikTemp = document.getElementById('mikrotik-temp');
        if (mikrotikTemp && data.system) {
            mikrotikTemp.textContent = `Temp: ${data.system.temperature || 0}°C`;
        }
        
        // Update user counts
        if (data.users) {
            const hotspotCount = document.getElementById('hotspot-count');
            const pppoeCount = document.getElementById('pppoe-count');
            const totalUsers = document.getElementById('total-users');
            
            if (hotspotCount) {
                hotspotCount.textContent = data.users.hotspot?.activeUsers || 0;
            }
            if (pppoeCount) {
                pppoeCount.textContent = data.users.pppoe?.activeConnections || 0;
            }
            if (totalUsers) {
                const total = (data.users.hotspot?.activeUsers || 0) + (data.users.pppoe?.activeConnections || 0);
                totalUsers.textContent = total;
            }
        }
    }
    
    updateProgressBar(type, value) {
        const bar = document.getElementById(`${type}-bar`);
        const text = document.getElementById(`${type}-text`);
        
        if (bar) {
            bar.style.width = `${value}%`;
            // PENTING: Jangan ubah class karena monitoring-widget.php menggunakan progress-fill, bukan progress-bar
            // Class sudah ada di HTML (progress-fill cpu-fill, progress-fill memory-fill, dll)
            // Hanya update width, warna akan di-handle oleh CSS berdasarkan class yang sudah ada
        }
        if (text) {
            text.textContent = `${value}%`;
        }
    }
    
    updateTrafficChart(data) {
        if (!this.charts.traffic || !data) {
            return;
        }
        
        const chart = this.charts.traffic;
        const now = new Date().toLocaleTimeString();
        
        // Add new data point
        if (chart.data.labels.length > 30) {
            chart.data.labels.shift();
            chart.data.datasets[0].data.shift();
            chart.data.datasets[1].data.shift();
        }
        
        chart.data.labels.push(now);
        chart.data.datasets[0].data.push(data.download || 0);
        chart.data.datasets[1].data.push(data.upload || 0);
        
        chart.update('none'); // Update without animation
        
        // Update current values
        const currentDownload = document.getElementById('current-download');
        const currentUpload = document.getElementById('current-upload');
        
        if (currentDownload) {
            currentDownload.textContent = this.formatBytes(data.download || 0) + '/s';
        }
        if (currentUpload) {
            currentUpload.textContent = this.formatBytes(data.upload || 0) + '/s';
        }
    }
    
    updateUserTables(data) {
        if (!data) return;
        
        // Update hotspot users table
        if (data.hotspot && data.hotspot.sessions) {
            const hotspotTable = document.getElementById('hotspot-users-table');
            if (hotspotTable) {
                let html = '';
                data.hotspot.sessions.forEach(session => {
                    html += `
                        <tr>
                            <td>${session.user}</td>
                            <td>${session.address}</td>
                            <td>${session.mac || '-'}</td>
                            <td>${session.uptime}</td>
                            <td>${this.formatBytes(session.bytesIn)} / ${this.formatBytes(session.bytesOut)}</td>
                        </tr>
                    `;
                });
                hotspotTable.innerHTML = html || '<tr><td colspan="5" class="text-center">No active users</td></tr>';
            }
        }
        
        // Update PPPoE users table
        if (data.pppoe && data.pppoe.connections) {
            const pppoeTable = document.getElementById('pppoe-users-table');
            if (pppoeTable) {
                let html = '';
                data.pppoe.connections.forEach(conn => {
                    html += `
                        <tr>
                            <td>${conn.name}</td>
                            <td>${conn.address}</td>
                            <td>${conn.service || '-'}</td>
                            <td>${conn.uptime}</td>
                            <td>${conn.callerID || '-'}</td>
                        </tr>
                    `;
                });
                pppoeTable.innerHTML = html || '<tr><td colspan="5" class="text-center">No active connections</td></tr>';
            }
        }
    }
    
    handleNewAlert(alert) {
        // Add to alerts array
        this.alerts.unshift(alert);
        
        // Keep only last 50 alerts
        if (this.alerts.length > 50) {
            this.alerts = this.alerts.slice(0, 50);
        }
        
        // Update alert counter
        const activeAlerts = document.getElementById('active-alerts');
        if (activeAlerts) {
            activeAlerts.textContent = this.alerts.length;
        }
        
        // Update last alert
        const lastAlert = document.getElementById('last-alert');
        if (lastAlert) {
            lastAlert.textContent = alert.message || 'New alert';
        }
        
        // Show notification if critical
        if (alert.level === 'critical' || alert.level === 'error') {
            this.showNotification(alert);
        }
    }
    
    showNotification(alert) {
        // Use browser notification if available
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('System Alert', {
                body: alert.message,
                icon: '/static/img/alert-icon.png'
            });
        }
        
        // Also show toast notification
        if (typeof toastr !== 'undefined') {
            toastr[alert.level || 'info'](alert.message, 'System Alert');
        }
    }
    
    updateConnectionStatus(status) {
        // Update any connection status indicators
        console.log('WebSocket connection status:', status);
        
        // Update UI based on connection status
        if (status === 'disconnected') {
            this.handleDisconnection();
        }
    }
    
    handleDisconnection() {
        // Set all traffic indicators to N/A when disconnected
        const dlCurrent = document.getElementById('current-download');
        const ulCurrent = document.getElementById('current-upload');
        const dlTotal = document.getElementById('total-download');
        const ulTotal = document.getElementById('total-upload');
        
        if (dlCurrent) dlCurrent.textContent = `N/A`;
        if (ulCurrent) ulCurrent.textContent = `N/A`;
        if (dlTotal) dlTotal.textContent = `Total: N/A`;
        if (ulTotal) ulTotal.textContent = `Total: N/A`;
        
        // PENTING: Jangan set PPPoE Active dan Hotspot Active menjadi 0 ketika disconnected
        // Biarkan fetchUserStatsFromStats() yang mengupdate dari /api/stats
        // Ini memastikan data tetap konsisten dengan dashboard cards meskipun mikrotik tidak terdeteksi di monitoring live
        
        // PENTING: Update CPU Usage dan Temperature menjadi 0 atau N/A ketika disconnected
        const mikrotikCpu = document.getElementById('mikrotik-cpu');
        if (mikrotikCpu) {
            mikrotikCpu.textContent = '0%';
        }
        
        const mikrotikTemp = document.getElementById('mikrotik-temp');
        if (mikrotikTemp) {
            mikrotikTemp.textContent = '0°C';
        }
        
        // PENTING: Update resource bars menjadi 0 ketika disconnected
        this.updateProgressBar('cpu', 0);
        this.updateProgressBar('memory', 0);
        this.updateProgressBar('disk', 0);
        
        // PENTING: Tetap fetch user stats dari /api/stats meskipun mikrotik tidak terdeteksi di monitoring live
        // Ini memastikan data user stats tetap konsisten dengan dashboard cards
        this.fetchUserStatsFromStats();
        
        // Stop chart updates and show disconnected state
        if (this.trafficChart) {
            // Clear the chart data to stop animation
            const emptyData = new Array(this.trafficChart.data.labels.length).fill(0);
            this.trafficChart.data.datasets[0].data = emptyData;
            this.trafficChart.data.datasets[1].data = emptyData;
            
            // Add disconnected indicator
            this.trafficChart.options.plugins.title = {
                display: true,
                text: 'Network Traffic Monitor (Connecting to MikroTik...)',
                color: '#fbbf24',
                font: {
                    size: 14,
                    weight: 'normal'
                }
            };
            
            // Disable animations when disconnected
            this.trafficChart.options.animation = false;
            this.trafficChart.update();
        }
    }
    
    bindEvents() {
        // Request notification permission
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }
    }
    
    formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
    
    // Public methods for external use
    async reconnectWhatsApp() {
        try {
            const response = await fetch('/api/monitoring-wrapper.php?action=trigger', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'same-origin',
                body: JSON.stringify({
                    action: 'reconnect_whatsapp',
                    params: {}
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                if (typeof toastr !== 'undefined') {
                    toastr.success('WhatsApp reconnection initiated');
                }
            } else {
                if (typeof toastr !== 'undefined') {
                    toastr.error(result.message || 'Failed to reconnect WhatsApp');
                }
            }
        } catch (error) {
            console.error('Error reconnecting WhatsApp:', error);
            if (typeof toastr !== 'undefined') {
                toastr.error('Error reconnecting WhatsApp');
            }
        }
    }
    
    showHealthDetails() {
        // Show detailed health information
        $('#alertModal').modal('show');
        this.loadHealthDetails();
    }
    
    showMikrotikDetails() {
        // Show detailed MikroTik information
        // This could open a modal or navigate to a detailed page
        console.log('Show MikroTik details');
    }
    
    showAlerts() {
        // Show all alerts
        $('#alertModal').modal('show');
        this.renderAlerts();
    }
    
    renderAlerts() {
        const alertsList = document.getElementById('alerts-list');
        if (!alertsList) return;
        
        if (this.alerts.length === 0) {
            alertsList.innerHTML = '<p class="text-center">No alerts to display</p>';
            return;
        }
        
        let html = '<div class="list-group">';
        this.alerts.forEach(alert => {
            const levelClass = {
                'critical': 'danger',
                'error': 'danger',
                'warning': 'warning',
                'info': 'info'
            }[alert.level] || 'secondary';
            
            html += `
                <div class="list-group-item">
                    <div class="d-flex w-100 justify-content-between">
                        <h6 class="mb-1">
                            <span class="badge badge-${levelClass}">${alert.level}</span>
                            ${alert.type || 'Alert'}
                        </h6>
                        <small>${new Date(alert.timestamp).toLocaleString()}</small>
                    </div>
                    <p class="mb-1">${alert.message}</p>
                    ${alert.details ? `<small class="text-muted">${JSON.stringify(alert.details)}</small>` : ''}
                </div>
            `;
        });
        html += '</div>';
        
        alertsList.innerHTML = html;
    }
    
    async clearAlerts() {
        this.alerts = [];
        
        const activeAlerts = document.getElementById('active-alerts');
        if (activeAlerts) {
            activeAlerts.textContent = '0';
        }
        
        const lastAlert = document.getElementById('last-alert');
        if (lastAlert) {
            lastAlert.textContent = 'No recent alerts';
        }
        
        this.renderAlerts();
        
        // Also clear on server
        try {
            await fetch('/api/monitoring-wrapper.php?action=trigger', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'same-origin',
                body: JSON.stringify({
                    action: 'clear_alerts',
                    params: {}
                })
            });
        } catch (error) {
            console.error('Error clearing alerts:', error);
        }
    }
    
    setTrafficPeriod(period) {
        this.trafficPeriod = period;
        console.log('Traffic period set to:', period);
        // You can implement period-based filtering here
    }
    
    destroy() {
        // Clean up when destroying the controller
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
        
        if (this.socket) {
            this.socket.disconnect();
        }
        
        // Destroy charts
        Object.values(this.charts).forEach(chart => {
            if (chart) chart.destroy();
        });
    }
}

// PENTING: Pindahkan inisialisasi ke after page load
// Ini memastikan login tidak terasa berat karena monitoring tidak langsung start
function initializeMonitoringController() {
    // Check if monitoring section exists
    const monitoringSection = document.getElementById('monitoring-section');
    
    if (monitoringSection) {
        // Check if controller already exists
        if (window.monitoringController) {
            return;
        }
        
        // Create controller instance
        // Note: useSocketIO is already set to false in constructor
        // This prevents Socket.IO connection attempts
        try {
            window.monitoringController = new MonitoringController();
        } catch (error) {
            console.error('[Monitoring] Error creating controller:', error);
        }
    }
}

// Try to initialize immediately if DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        initializeMonitoringController();
    });
} else {
    initializeMonitoringController();
}

// Also try on window load as backup
window.addEventListener('load', () => {
    if (!window.monitoringController) {
        initializeMonitoringController();
    }
});

// Global functions for onclick handlers
window.reconnectWhatsApp = () => {
    if (window.monitoringController) {
        window.monitoringController.reconnectWhatsApp();
    }
};

window.showHealthDetails = () => {
    if (window.monitoringController) {
        window.monitoringController.showHealthDetails();
    }
};

window.showMikrotikDetails = () => {
    if (window.monitoringController) {
        window.monitoringController.showMikrotikDetails();
    }
};

window.showAlerts = () => {
    if (window.monitoringController) {
        window.monitoringController.showAlerts();
    }
};

window.clearAlerts = () => {
    if (window.monitoringController) {
        window.monitoringController.clearAlerts();
    }
};

window.setTrafficPeriod = (period) => {
    if (window.monitoringController) {
        window.monitoringController.setTrafficPeriod(period);
    }
};
