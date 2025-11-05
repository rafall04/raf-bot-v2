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
        this.currentInterface = 'ether1'; // Store current interface selection
        
        this.init();
    }
    
    init() {
        // Initialize Socket.IO
        this.connectSocket();
        
        // Initialize charts
        this.initCharts();
        
        // Start update loop
        this.startUpdateLoop();
        
        // Bind events
        this.bindEvents();
    }
    
    connectSocket() {
        this.socket = io('http://localhost:3100', {
            auth: {
                token: localStorage.getItem('token')
            }
        });
        
        // Socket event handlers
        this.socket.on('connect', () => {
            console.log('Connected to monitoring server');
            this.updateConnectionStatus('connected');
        });
        
        this.socket.on('disconnect', () => {
            console.log('Disconnected from monitoring server');
            this.updateConnectionStatus('disconnected');
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
        // Initialize traffic chart
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
        
        // Fetch and update traffic history
        this.fetchTrafficHistory();
    }
    
    async fetchTrafficHistory() {
        try {
            const response = await fetch('/api/monitoring/history');
            if (response.ok) {
                const result = await response.json();
                const history = result.data;
                
                // Update chart with history data
                if (this.trafficChart && history) {
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
        }
    }
    
    startUpdateLoop() {
        // Initial load
        this.fetchMonitoringData();
        this.fetchTrafficHistory();
        
        // Update every 5 seconds
        this.updateInterval = setInterval(() => {
            this.fetchMonitoringData();
            this.fetchTrafficHistory();
        }, 5000);
    }
    
    async fetchMonitoringData() {
        try {
            // Get selected interface from selector or use stored value
            const interfaceSelector = document.getElementById('interface-selector');
            let selectedInterface = '';
            
            if (interfaceSelector && interfaceSelector.value) {
                selectedInterface = interfaceSelector.value;
                this.currentInterface = selectedInterface; // Update stored value
            } else {
                // Use stored value if selector not ready
                selectedInterface = this.currentInterface || 'ether1';
            }
            
            // Build URL with interface parameter
            const url = `/api/monitoring/live?interface=${encodeURIComponent(selectedInterface)}`;
            
            // Debug log only on interface change (uncomment for troubleshooting)
            // if (this.lastDebuggedInterface !== selectedInterface) {
            //     console.log('[DEBUG] Fetching URL:', url);
            //     this.lastDebuggedInterface = selectedInterface;
            // }
            
            const response = await fetch(url, {
                method: 'GET',
                credentials: 'same-origin',
                cache: 'no-cache',
                headers: {
                    'Cache-Control': 'no-cache'
                }
            });
            
            if (!response.ok) {
                throw new Error('Failed to fetch monitoring data');
            }
            
            const result = await response.json();
            
            // Check if we have an error response
            if (result.status === 503 || result.error) {
                console.error('[Monitoring] MikroTik Error:', result.message || result.error);
                this.showErrorMessage(result.message || 'MikroTik not connected');
                return;
            }
            
            const data = result.data;
            
            // Only update if we have valid data
            if (data) {
                // Debug interface mismatch (uncomment for troubleshooting)
                // const expectedInterface = document.getElementById('interface-selector')?.value || 
                //                          document.getElementById('interface-selector')?.getAttribute('data-selected') || 
                //                          'ether1';
                // if (data.selectedInterface && data.selectedInterface !== expectedInterface) {
                //     // Only warn once per mismatch
                //     if (!this.lastMismatchWarning || this.lastMismatchWarning !== data.selectedInterface) {
                //         console.warn('[Monitoring] Interface mismatch: Expected', expectedInterface, 'but got', data.selectedInterface);
                //         this.lastMismatchWarning = data.selectedInterface;
                //     }
                // }
                
                // Update all dashboard elements with real data
                this.updateSystemHealth(data.systemHealth);
                this.updateWhatsAppStatus(data.whatsapp);
                this.updateMikroTikStatus(data.mikrotik);
                this.updateTrafficData(data.traffic);
                this.updateResourceBars(data.resources);
                this.updateAlerts(data.alerts);
                this.updateUserStats(data.users);
                
                // Populate interface selector if available
                if (data.interfaces) {
                    this.populateInterfaceSelector(data.interfaces);
                }
            }
            
        } catch (error) {
            console.error('Error fetching monitoring data:', error);
        }
    }
    
    updateSystemHealth(health) {
        const scoreEl = document.getElementById('health-score');
        const boxEl = document.getElementById('health-status-box');
        
        if (scoreEl) scoreEl.textContent = health.score + '%';
        if (boxEl) {
            // Keep gradient style, just update if there's an error
            if (health.score < 50) {
                boxEl.className = 'modern-card gradient-green error';
            } else {
                boxEl.className = 'modern-card gradient-green';
            }
        }
    }
    
    updateWhatsAppStatus(wa) {
        const statusEl = document.getElementById('wa-status');
        if (statusEl) statusEl.textContent = wa.connected ? 'Online' : 'Offline';
    }
    
    updateMikroTikStatus(mikrotik) {
        const cpuEl = document.getElementById('mikrotik-cpu');
        const tempEl = document.getElementById('mikrotik-temp');
        
        if (cpuEl) cpuEl.textContent = `${mikrotik.cpu || 0}%`;
        if (tempEl) tempEl.textContent = `${mikrotik.temperature || 0}°C`;
    }
    
    updateTrafficData(traffic) {
        const dlCurrent = document.getElementById('current-download');
        const ulCurrent = document.getElementById('current-upload');
        const dlTotal = document.getElementById('total-download');
        const ulTotal = document.getElementById('total-upload');
        
        // Update current rates
        if (dlCurrent) dlCurrent.textContent = `${traffic.download.current || 0} Mbps`;
        if (ulCurrent) ulCurrent.textContent = `${traffic.upload.current || 0} Mbps`;
        
        // Update total traffic with interface-specific data
        if (dlTotal) dlTotal.textContent = `Total: ${traffic.download.total || 0} GB`;
        if (ulTotal) ulTotal.textContent = `Total: ${traffic.upload.total || 0} GB`;
        
        // Also update the traffic chart with current data
        if (this.trafficChart) {
            const now = new Date().toLocaleTimeString();
            
            // Keep only last 20 data points
            if (this.trafficChart.data.labels.length >= 20) {
                this.trafficChart.data.labels.shift();
                this.trafficChart.data.datasets[0].data.shift();
                this.trafficChart.data.datasets[1].data.shift();
            }
            
            // Add new data point
            this.trafficChart.data.labels.push(now);
            this.trafficChart.data.datasets[0].data.push(traffic.download.current);
            this.trafficChart.data.datasets[1].data.push(traffic.upload.current);
            
            // Update chart
            this.trafficChart.update('none'); // 'none' for no animation to avoid flicker
        }
    }
    
    updateResourceBars(resources) {
        this.updateProgressBar('cpu', resources.cpu);
        this.updateProgressBar('memory', resources.memory);
        this.updateProgressBar('disk', resources.disk);
        
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
        // Update total users count - ONLY PPPoE users
        const totalUsersEl = document.getElementById('total-users');
        if (totalUsersEl) {
            // Only count PPPoE active users, not hotspot
            const total = users.pppoe?.active || 0;
            totalUsersEl.textContent = total;
        }
    }

    updateProgressBar(type, value) {
        const bar = document.getElementById(`${type}-bar`);
        const text = document.getElementById(`${type}-text`);
        
        if (bar) {
            bar.style.width = `${value}%`;
            // Update color based on value
            bar.className = `progress-bar ${value > 80 ? 'bg-danger' : value > 60 ? 'bg-warning' : 'bg-primary'}`;
        }
        if (text) text.textContent = `${value}%`;
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
        
        // Keep current selection if exists
        const currentSelection = selector.value || selector.getAttribute('data-selected');
        
        // Only setup once
        if (!selector.hasAttribute('data-initialized')) {
            // Add change event listener only once
            selector.addEventListener('change', (e) => {
                console.log(`[Monitoring] Interface changed to: ${e.target.value}`);
                // Store selection in both data attribute and property
                this.currentInterface = e.target.value;
                selector.setAttribute('data-selected', e.target.value);
                // Clear any cached data and force immediate update
                this.lastData = null;
                this.fetchMonitoringData();
                // Also update chart title to show current interface
                const chartTitle = document.querySelector('.panel-header h5');
                if (chartTitle) {
                    chartTitle.innerHTML = `<i class="fas fa-chart-line me-2"></i>Network Traffic Monitor - ${e.target.value}`;
                }
            });
            selector.setAttribute('data-initialized', 'true');
        }
        
        // Only repopulate if empty (first load)
        if (selector.options.length === 0) {
            // Add all interfaces as options
            interfaces.forEach(iface => {
                const option = document.createElement('option');
                // Escape special characters in value
                option.value = iface.name;
                const status = iface.running ? '●' : '○';
                // Display name might have special chars, that's OK
                option.textContent = `${status} ${iface.name} (${iface.type})`;
                selector.appendChild(option);
            });
            
            // Set initial selection
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
            // Just update the status indicators without changing selection
            const currentValue = selector.value;
            for (let i = 0; i < selector.options.length; i++) {
                const option = selector.options[i];
                const iface = interfaces.find(i => i.name === option.value);
                if (iface) {
                    const status = iface.running ? '●' : '○';
                    option.textContent = `${status} ${iface.name} (${iface.type})`;
                }
            }
            // Ensure value is maintained
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
    
    // Show Hotspot Users in Modal
    async showHotspotUsers() {
        try {
            const response = await fetch('/api/monitoring/live', {
                credentials: 'same-origin'
            });
            const result = await response.json();
            
            if (result.data?.users?.hotspot) {
                const modal = $('#userListModal');
                $('#userListTitle').text('Hotspot Active Users');
                
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
                modal.modal('show');
            }
        } catch (error) {
            console.error('Error fetching hotspot users:', error);
        }
    }
    
    // Show PPPoE Users in Modal
    async showPPPoEUsers() {
        try {
            const response = await fetch('/api/monitoring/live', {
                credentials: 'same-origin'
            });
            const result = await response.json();
            
            if (result.data?.users?.pppoe) {
                const modal = $('#userListModal');
                $('#userListTitle').text('PPPoE Active Users');
                
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
                modal.modal('show');
            }
        } catch (error) {
            console.error('Error fetching PPPoE users:', error);
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
        
        if (bar && text) {
            bar.style.width = value + '%';
            text.textContent = value + '%';
            
            // Update color based on value
            bar.className = 'progress-bar';
            if (value < 60) {
                bar.classList.add('bg-success');
            } else if (value < 80) {
                bar.classList.add('bg-warning');
            } else {
                bar.classList.add('bg-danger');
            }
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

// Initialize controller when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Check if monitoring section exists
    const monitoringSection = document.getElementById('monitoring-section');
    if (monitoringSection) {
        console.log('[Monitoring] Initializing monitoring controller...');
        window.monitoringController = new MonitoringController();
    } else {
        console.log('[Monitoring] Monitoring section not found, skipping initialization');
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
