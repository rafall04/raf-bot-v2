/**
 * Monitoring Dashboard Controller
 * Handles real-time updates and user interactions
 */

class MonitoringController {
    constructor() {
        this.socket = null;
        this.charts = {};
        this.updateInterval = null;
        this.trafficUpdateInterval = null; // Interval terpisah untuk traffic data
        this.trafficPeriod = '5m';
        this.alerts = [];
        this.currentInterface = 'ether1';
        this.isConnected = false;
        this.mikrotikConnected = false;
        this.useSocketIO = false;
        this.socketErrorLogged = false;
        this.lastWhatsAppStatus = undefined; // Untuk menyimpan status WhatsApp terakhir
        this.lastHealthData = null; // Untuk menyimpan health data terakhir
        this.lastTrafficUpdateTime = null; // Timestamp update traffic terakhir
        this.trafficUpdateStuckThreshold = 15000; // 15 detik tanpa update = stuck
        this.trafficUpdateCheckInterval = null; // Interval untuk check stuck
        this.isUpdatingTraffic = false; // Flag untuk prevent concurrent updates
        
        this.init();
    }
    
    init() {
        if (this.useSocketIO) {
            this.connectSocket();
        } else {
            this.isConnected = true;
        }
        
        this.initCharts();
        this.bindEvents();
        this.initClickableStatCards();
        
        // PENTING: Start update loop setelah DOM ready dan chart terinisialisasi
        if (document.readyState === 'complete' || document.readyState === 'interactive') {
            // Delay sedikit untuk memastikan chart sudah terinisialisasi
            setTimeout(() => {
                this.startUpdateLoop();
            }, 500);
        } else {
            window.addEventListener('load', () => {
                // Delay sedikit untuk memastikan chart sudah terinisialisasi
                setTimeout(() => {
                    this.startUpdateLoopImmediate();
                }, 500);
            });
        }
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
        const canvas = document.getElementById('traffic-chart');
        if (!canvas) {
            console.warn('[Monitoring] Traffic chart canvas not found, will retry later');
            // Retry setelah 500ms jika canvas belum ada
            setTimeout(() => this.initCharts(), 500);
            return;
        }
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            console.warn('[Monitoring] Cannot get 2d context from canvas');
            return;
        }
        
        // PENTING: Pastikan Chart.js sudah loaded
        if (typeof Chart === 'undefined') {
            console.warn('[Monitoring] Chart.js not loaded yet, will retry later');
            setTimeout(() => this.initCharts(), 500);
            return;
        }
        
        // Smooth color gradients untuk visual yang lebih menarik
        // Gradient akan di-update setelah chart dibuat untuk mendapatkan height yang benar
        const downloadGradient = ctx.createLinearGradient(0, 0, 0, 400);
        downloadGradient.addColorStop(0, 'rgba(34, 197, 94, 0.3)'); // Green
        downloadGradient.addColorStop(1, 'rgba(34, 197, 94, 0.05)');
        
        const uploadGradient = ctx.createLinearGradient(0, 0, 0, 400);
        uploadGradient.addColorStop(0, 'rgba(59, 130, 246, 0.3)'); // Blue
        uploadGradient.addColorStop(1, 'rgba(59, 130, 246, 0.05)');
        
        try {
            this.trafficChart = new Chart(canvas, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Download',
                    data: [],
                    borderColor: '#22c55e', // Green - lebih modern
                    backgroundColor: downloadGradient,
                    tension: 0.4, // Lebih smooth curve (dari 0.1 ke 0.4)
                    borderWidth: 2.5, // Lebih tebal untuk visibility
                    fill: true,
                    pointRadius: 0, // Hide points untuk smooth line
                    pointHoverRadius: 4, // Show on hover
                    pointHoverBorderWidth: 2,
                    pointHoverBackgroundColor: '#22c55e',
                    pointHoverBorderColor: '#ffffff',
                    cubicInterpolationMode: 'monotone', // Smooth interpolation
                    spanGaps: false
                }, {
                    label: 'Upload',
                    data: [],
                    borderColor: '#3b82f6', // Blue - lebih modern
                    backgroundColor: uploadGradient,
                    tension: 0.4, // Lebih smooth curve
                    borderWidth: 2.5,
                    fill: true,
                    pointRadius: 0, // Hide points untuk smooth line
                    pointHoverRadius: 4, // Show on hover
                    pointHoverBorderWidth: 2,
                    pointHoverBackgroundColor: '#3b82f6',
                    pointHoverBorderColor: '#ffffff',
                    cubicInterpolationMode: 'monotone', // Smooth interpolation
                    spanGaps: false
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    intersect: false,
                    mode: 'index'
                },
                animation: {
                    duration: 800, // Smooth animation duration
                    easing: 'easeInOutQuart' // Smooth easing
                },
                transitions: {
                    show: {
                        animation: {
                            duration: 800,
                            easing: 'easeInOutQuart'
                        }
                    },
                    hide: {
                        animation: {
                            duration: 800,
                            easing: 'easeInOutQuart'
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Mbps',
                            font: {
                                size: 12,
                                weight: '600'
                            },
                            color: '#6b7280'
                        },
                        grid: {
                            color: 'rgba(0, 0, 0, 0.05)', // Subtle grid
                            drawBorder: false
                        },
                        ticks: {
                            color: '#9ca3af',
                            font: {
                                size: 11
                            },
                            padding: 8
                        }
                    },
                    x: {
                        grid: {
                            display: false, // Hide x-axis grid untuk cleaner look
                            drawBorder: false
                        },
                        ticks: {
                            color: '#9ca3af',
                            font: {
                                size: 11
                            },
                            maxRotation: 0,
                            autoSkip: true,
                            maxTicksLimit: 8
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                        align: 'end',
                        labels: {
                            usePointStyle: true,
                            padding: 15,
                            font: {
                                size: 12,
                                weight: '500'
                            },
                            color: '#374151',
                            boxWidth: 12,
                            boxHeight: 12
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        padding: 12,
                        titleFont: {
                            size: 13,
                            weight: '600'
                        },
                        bodyFont: {
                            size: 12
                        },
                        borderColor: 'rgba(255, 255, 255, 0.1)',
                        borderWidth: 1,
                        cornerRadius: 8,
                        displayColors: true,
                        callbacks: {
                            label: function(context) {
                                return context.dataset.label + ': ' + context.parsed.y.toFixed(2) + ' Mbps';
                            }
                        }
                    }
                }
            }
        });
        
        console.log('[Monitoring] Traffic chart initialized successfully');
        } catch (error) {
            console.error('[Monitoring] Error initializing traffic chart:', error);
            // Retry setelah 1 detik jika error
            setTimeout(() => this.initCharts(), 1000);
        }
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
                    // Remove title jika masih ada
                    if (this.trafficChart.options.plugins.title) {
                        this.trafficChart.options.plugins.title.display = false;
                    }
                    
                    // Format labels dengan format yang lebih compact
                    const labels = history.map(h => {
                        const date = new Date(h.time);
                        return date.toLocaleTimeString('id-ID', { 
                            hour: '2-digit', 
                            minute: '2-digit',
                            second: '2-digit'
                        });
                    });
                    const downloadData = history.map(h => h.download || 0);
                    const uploadData = history.map(h => h.upload || 0);
                    
                    // Update data dengan smooth animation
                    this.trafficChart.data.labels = labels;
                    this.trafficChart.data.datasets[0].data = downloadData;
                    this.trafficChart.data.datasets[1].data = uploadData;
                    
                    // Update dengan animation untuk smooth transition
                    this.trafficChart.update('default');
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
            // Initial load
            this.fetchUserStatsFromStats();
            this.fetchMonitoringData();
            
            // PENTING: Update monitoring data setiap 10 detik (kurang sering untuk mengurangi beban)
            this.updateInterval = setInterval(() => {
                this.fetchUserStatsFromStats();
                this.fetchMonitoringData();
            }, 10000); // 10 detik untuk monitoring data umum
            
            // PENTING: Pastikan chart sudah terinisialisasi sebelum membuat interval
            // Retry mechanism jika chart belum siap
            const initTrafficInterval = () => {
                if (this.trafficChart) {
                    // PENTING: Clear interval sebelumnya jika ada (prevent multiple intervals)
                    if (this.trafficUpdateInterval) {
                        clearInterval(this.trafficUpdateInterval);
                        this.trafficUpdateInterval = null;
                    }
                    
                    // PENTING: Initialize timestamp untuk stuck detection
                    this.lastTrafficUpdateTime = Date.now();
                    
                    // Initial traffic history load
                    this.fetchTrafficHistory();
                    
                    // PENTING: Trigger initial traffic data fetch setelah chart siap
                    // Jangan tunggu interval pertama (5 detik)
                    // PENTING: Jangan check mikrotikConnected di sini - biarkan fetchTrafficDataOnly() yang check
                    setTimeout(() => {
                        if (this.trafficChart && !this.isUpdatingTraffic) {
                            console.log('[Monitoring] Initial traffic data fetch triggered');
                            this.fetchTrafficDataOnly();
                        }
                    }, 1000); // Fetch setelah 1 detik
                    
                    // Set interval terpisah untuk traffic data
                    // PENTING: Jangan check mikrotikConnected di sini - biarkan fetchTrafficDataOnly() yang check
                    // Ini memastikan interval tetap dibuat meskipun mikrotikConnected belum true
                    this.trafficUpdateInterval = setInterval(() => {
                        if (this.trafficChart && !this.isUpdatingTraffic) {
                            this.fetchTrafficDataOnly();
                        }
                    }, 5000); // 5 detik untuk traffic data
                    
                    console.log('[Monitoring] Traffic update interval created');
                    
                    // PENTING: Start stuck detection mechanism (setelah interval dibuat)
                    // Delay sedikit untuk prevent false stuck detection saat initializing
                    setTimeout(() => {
                        this.startTrafficStuckDetection();
                    }, 2000); // Start stuck detection setelah 2 detik
                } else {
                    // Retry setelah 500ms jika chart belum siap
                    setTimeout(initTrafficInterval, 500);
                }
            };
            
            // Start initialization
            initTrafficInterval();
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
            
            // PENTING: Handle rate limit (429) dan unauthorized (401) dengan graceful
            if (response.status === 429) {
                console.warn('[Monitoring] Rate limit exceeded, akan retry setelah beberapa saat');
                // Jangan throw error - biarkan retry pada interval berikutnya
                // Rate limit akan reset setelah beberapa saat
                return;
            }
            
            if (response.status === 401) {
                console.warn('[Monitoring] Unauthorized - mungkin token expired');
                // Jangan langsung redirect - biarkan user tetap di halaman
                // Token mungkin akan refresh atau user bisa login ulang nanti
                return;
            }
            
            if (!response.ok) {
                console.error('[Monitoring] HTTP Error:', response.status, response.statusText);
                // Jangan throw error untuk non-critical errors
                // Biarkan retry pada interval berikutnya
                return;
            }
            
            const result = await response.json();
            
            // PENTING: Jangan langsung disconnect pada error pertama
            // Error 503 atau error lainnya bisa terjadi karena timeout, bukan disconnect permanen
            if (result.status === 503 || result.error || !result.data) {
                console.warn('[Monitoring] MikroTik API Error:', result.message || result.error || 'No data received');
                // Jangan langsung set disconnect - biarkan data yang ada tetap digunakan
                // Error bisa transient (timeout, network hiccup, dll)
                // Hanya set disconnect jika benar-benar tidak ada data sama sekali
                if (!result.data) {
                    // Tidak ada data sama sekali - mungkin benar-benar disconnect
                    this.mikrotikConnected = false;
                    this.handleDisconnection();
                    return;
                }
                // Jika ada data meskipun ada error, tetap proses data yang ada
            }
            
            const data = result.data;
            
            if (data) {
                // PENTING: Check connection status dari data mikrotik
                // Jika mikrotik.connected === true atau ada data CPU, berarti masih connected
                if (data.mikrotik) {
                    if (data.mikrotik.connected === true || data.mikrotik.cpu !== undefined) {
                        this.mikrotikConnected = true;
                    } else {
                        // Hanya set false jika benar-benar tidak ada data dan connected === false
                        if (data.mikrotik.connected === false) {
                            this.mikrotikConnected = false;
                        }
                        // Jika connected tidak ada tapi ada data lain, tetap anggap connected
                    }
                } else {
                    // Tidak ada data mikrotik - mungkin error, tapi jangan langsung disconnect
                    // Biarkan status sebelumnya tetap digunakan
                }
                
                if (data.systemHealth) {
                    // PENTING: Simpan health data untuk digunakan nanti saat update WhatsApp status
                    this.lastHealthData = data.systemHealth;
                    this.updateSystemHealth(data.systemHealth);
                }
                
                // PENTING: Fetch WhatsApp status setelah system health di-update
                // Ini akan mengupdate health.checks.whatsapp dengan status yang benar
                this.fetchWhatsAppStatus();
                
                if (data.mikrotik) {
                    this.updateMikroTikStatus(data.mikrotik);
                }
                
                // PENTING: Update traffic data juga di sini sebagai fallback
                // Ini memastikan traffic data tetap ter-update meskipun fetchTrafficDataOnly() tidak dipanggil
                // fetchTrafficDataOnly() tetap berjalan setiap 5 detik untuk update lebih sering
                
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
                
                // PENTING: Update traffic data juga di sini sebagai fallback
                // Ini memastikan traffic data tetap ter-update meskipun fetchTrafficDataOnly() tidak dipanggil
                if (data.traffic) {
                    console.log('[Monitoring] Updating traffic data from fetchMonitoringData:', data.traffic);
                    this.updateTrafficData(data.traffic);
                }
            } else {
                // No data - jangan langsung disconnect, mungkin hanya timeout
                console.warn('[Monitoring] No data received from API - mungkin timeout atau transient error');
                // Jangan langsung set disconnect - biarkan status sebelumnya
                // Error akan teratasi pada request berikutnya jika hanya transient
                return;
            }
            
        } catch (error) {
            // Network error atau error lainnya - jangan langsung disconnect
            console.warn('[Monitoring] Error fetching monitoring data:', error.message);
            // Jangan langsung set disconnect - error bisa transient
            // Biarkan status sebelumnya tetap digunakan
        }
    }
    
    /**
     * Fetch traffic data saja (tanpa data monitoring lainnya)
     * Dipanggil setiap 5 detik untuk mengurangi beban
     */
    async fetchTrafficDataOnly() {
        // PENTING: Prevent concurrent updates
        if (this.isUpdatingTraffic) {
            console.warn('[Monitoring] Traffic update already in progress, skipping...');
            return;
        }
        
        // PENTING: Pastikan chart sudah terinisialisasi
        if (!this.trafficChart) {
            console.warn('[Monitoring] Traffic chart not initialized, attempting to init...');
            this.initCharts();
            return;
        }
        
        // PENTING: Check mikrotikConnected di sini, tapi jangan langsung return
        // Biarkan fetch tetap berjalan untuk update timestamp dan stuck detection
        if (!this.mikrotikConnected) {
            console.log('[Monitoring] MikroTik not connected, skipping traffic fetch');
            // Update timestamp untuk stuck detection
            this.lastTrafficUpdateTime = Date.now();
            return;
        }
        
        this.isUpdatingTraffic = true;
        console.log('[Monitoring] fetchTrafficDataOnly started');
        
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
            
            // PENTING: Add timeout untuk prevent stuck requests
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 detik timeout
            
            const response = await fetch(url, {
                method: 'GET',
                credentials: 'same-origin',
                cache: 'no-cache',
                signal: controller.signal,
                headers: {
                    'Cache-Control': 'no-cache'
                }
            });
            
            clearTimeout(timeoutId);
            
            // PENTING: Handle rate limit (429) dan unauthorized (401) dengan graceful
            if (response.status === 429) {
                console.warn('[Monitoring] Rate limit exceeded untuk traffic data, akan retry setelah beberapa saat');
                // Update timestamp untuk stuck detection
                this.lastTrafficUpdateTime = Date.now();
                return; // Silent fail - akan retry pada interval berikutnya
            }
            
            if (response.status === 401) {
                console.warn('[Monitoring] Unauthorized untuk traffic data - mungkin token expired');
                // Update timestamp untuk stuck detection
                this.lastTrafficUpdateTime = Date.now();
                return; // Silent fail - jangan trigger logout
            }
            
            if (!response.ok) {
                // PENTING: Update timestamp meskipun error untuk stuck detection
                this.lastTrafficUpdateTime = Date.now();
                return; // Silent fail untuk traffic update
            }
            
            const result = await response.json();
            
            if (result.status === 503 || result.error || !result.data) {
                // PENTING: Update timestamp meskipun error untuk stuck detection
                this.lastTrafficUpdateTime = Date.now();
                return; // Silent fail
            }
            
            const data = result.data;
            
            if (data && data.traffic) {
                // Hanya update traffic data, tidak update yang lain
                console.log('[Monitoring] Updating traffic data:', data.traffic);
                this.updateTrafficData(data.traffic);
                // PENTING: Update timestamp setelah berhasil update
                this.lastTrafficUpdateTime = Date.now();
            } else {
                console.warn('[Monitoring] No traffic data in response, data:', data);
                // PENTING: Update timestamp meskipun tidak ada data untuk stuck detection
                this.lastTrafficUpdateTime = Date.now();
            }
            
        } catch (error) {
            // PENTING: Update timestamp meskipun error untuk stuck detection
            this.lastTrafficUpdateTime = Date.now();
            
            if (error.name === 'AbortError') {
                console.warn('[Monitoring] Traffic fetch timeout');
            } else {
                // Silent fail untuk traffic update - tidak perlu log error setiap 5 detik
                // Error akan terdeteksi di fetchMonitoringData()
                console.warn('[Monitoring] Error fetching traffic data:', error.message);
            }
        } finally {
            // PENTING: Always clear flag
            this.isUpdatingTraffic = false;
        }
    }
    
    /**
     * Start stuck detection mechanism untuk traffic chart
     * Check setiap 10 detik apakah chart stuck
     */
    startTrafficStuckDetection() {
        // PENTING: Clear interval sebelumnya jika ada
        if (this.trafficUpdateCheckInterval) {
            clearInterval(this.trafficUpdateCheckInterval);
            this.trafficUpdateCheckInterval = null;
        }
        
        // PENTING: Initialize timestamp hanya jika belum ada atau null
        // Jangan overwrite jika sudah ada (untuk prevent false stuck detection saat start)
        if (!this.lastTrafficUpdateTime) {
            this.lastTrafficUpdateTime = Date.now();
        }
        
        // Check setiap 10 detik
        this.trafficUpdateCheckInterval = setInterval(() => {
            if (!this.trafficChart || !this.mikrotikConnected) {
                return;
            }
            
            // PENTING: Skip check jika timestamp belum di-set (masih initializing)
            if (!this.lastTrafficUpdateTime) {
                return;
            }
            
            const now = Date.now();
            const timeSinceLastUpdate = now - this.lastTrafficUpdateTime;
            
            // Jika tidak ada update selama threshold, anggap stuck
            if (timeSinceLastUpdate > this.trafficUpdateStuckThreshold) {
                console.warn(`[Monitoring] Traffic chart stuck detected (${Math.round(timeSinceLastUpdate / 1000)}s since last update), attempting recovery...`);
                
                // Recovery mechanism: force update dengan data dummy atau re-init
                this.recoverStuckTrafficChart();
            }
        }, 10000); // Check setiap 10 detik
    }
    
    /**
     * Recovery mechanism untuk stuck traffic chart
     */
    recoverStuckTrafficChart() {
        try {
            // Method 1: Coba force update dengan data dummy
            if (this.trafficChart && this.trafficChart.data) {
                const now = new Date();
                const timeString = now.toLocaleTimeString('id-ID', { 
                    hour: '2-digit', 
                    minute: '2-digit',
                    second: '2-digit'
                });
                
                // Add dummy data point untuk test
                this.trafficChart.data.labels.push(timeString);
                this.trafficChart.data.datasets[0].data.push(0);
                this.trafficChart.data.datasets[1].data.push(0);
                
                // Try update
                this.trafficChart.update('none');
                
                // Update timestamp
                this.lastTrafficUpdateTime = Date.now();
                
                console.log('[Monitoring] Traffic chart recovery: force update successful');
                return;
            }
        } catch (error) {
            console.error('[Monitoring] Traffic chart recovery: force update failed:', error);
        }
        
        // Method 2: Re-init chart jika force update gagal
        try {
            console.warn('[Monitoring] Traffic chart recovery: attempting re-init...');
            
            // Destroy chart lama
            if (this.trafficChart) {
                this.trafficChart.destroy();
                this.trafficChart = null;
            }
            
            // Re-init chart
            this.initCharts();
            
            // Re-start traffic interval
            if (this.trafficUpdateInterval) {
                clearInterval(this.trafficUpdateInterval);
                this.trafficUpdateInterval = null;
            }
            
            // Re-start interval
            setTimeout(() => {
                if (this.trafficChart) {
                    // PENTING: Clear interval sebelumnya jika ada
                    if (this.trafficUpdateInterval) {
                        clearInterval(this.trafficUpdateInterval);
                        this.trafficUpdateInterval = null;
                    }
                    
                    // PENTING: Jangan check mikrotikConnected di sini - biarkan fetchTrafficDataOnly() yang check
                    this.trafficUpdateInterval = setInterval(() => {
                        if (this.trafficChart && !this.isUpdatingTraffic) {
                            this.fetchTrafficDataOnly();
                        }
                    }, 5000);
                    
                    // PENTING: Re-start stuck detection setelah re-init
                    this.startTrafficStuckDetection();
                }
            }, 1000);
            
            // Update timestamp
            this.lastTrafficUpdateTime = Date.now();
            
            console.log('[Monitoring] Traffic chart recovery: re-init successful');
        } catch (error) {
            console.error('[Monitoring] Traffic chart recovery: re-init failed:', error);
        }
    }
    
    updateSystemHealth(health) {
        const scoreEl = document.getElementById('health-score');
        const statusEl = document.getElementById('health-status');
        const boxEl = document.getElementById('health-status-box');
        
        // PENTING: Update whatsapp check berdasarkan status yang sebenarnya
        // Jika health.checks.whatsapp belum di-update, coba ambil dari status WhatsApp yang sudah di-fetch
        if (health.checks && health.checks.whatsapp === false && this.lastWhatsAppStatus !== undefined) {
            health.checks.whatsapp = this.lastWhatsAppStatus;
        }
        
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
            
            // PENTING: Handle rate limit (429) dan unauthorized (401) dengan graceful
            if (response.status === 429) {
                console.warn('[Monitoring] Rate limit exceeded untuk WhatsApp status, akan retry setelah beberapa saat');
                return; // Silent fail - akan retry pada interval berikutnya
            }
            
            if (response.status === 401) {
                console.warn('[Monitoring] Unauthorized untuk WhatsApp status - mungkin token expired');
                return; // Silent fail - jangan trigger logout
            }
            
            if (response.ok) {
                const data = await response.json();
                const isConnected = data.botStatus || false;
                
                // PENTING: Simpan status WhatsApp untuk digunakan di updateSystemHealth
                this.lastWhatsAppStatus = isConnected === true || isConnected === 1 || isConnected === 'true';
                
                this.updateWhatsAppStatus({ connected: isConnected });
                
                // PENTING: Update system health dengan status WhatsApp yang benar
                // Cari health data yang sudah ada dan update checks.whatsapp
                const healthScoreEl = document.getElementById('health-score');
                if (healthScoreEl) {
                    // Re-fetch monitoring data untuk mendapatkan health object yang lengkap
                    // Tapi lebih baik update langsung jika sudah ada
                    const currentHealth = this.lastHealthData || { checks: {} };
                    if (!currentHealth.checks) {
                        currentHealth.checks = {};
                    }
                    currentHealth.checks.whatsapp = this.lastWhatsAppStatus;
                    this.lastHealthData = currentHealth;
                    this.updateSystemHealth(currentHealth);
                }
                
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
            this.lastWhatsAppStatus = false;
            this.updateWhatsAppStatus({ connected: false });
            
            // Update health dengan status false
            const currentHealth = this.lastHealthData || { checks: {} };
            if (!currentHealth.checks) {
                currentHealth.checks = {};
            }
            currentHealth.checks.whatsapp = false;
            this.lastHealthData = currentHealth;
            this.updateSystemHealth(currentHealth);
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
            // Jangan langsung set disconnect jika mikrotik null - mungkin hanya error sementara
            return;
        }
        
        const cpuValue = mikrotik.cpu !== undefined && mikrotik.cpu !== null ? mikrotik.cpu : 0;
        const tempValue = mikrotik.temperature !== undefined && mikrotik.temperature !== null ? mikrotik.temperature : 0;
        
        if (cpuEl) cpuEl.textContent = `${cpuValue}%`;
        if (tempEl) tempEl.textContent = `${tempValue}°C`;
        
        // PENTING: Hanya update connection status jika explicitly set
        // Jangan set false jika connected tidak ada - biarkan status sebelumnya
        if (mikrotik.connected === true) {
            this.mikrotikConnected = true;
        } else if (mikrotik.connected === false) {
            // Hanya set false jika explicitly false
            this.mikrotikConnected = false;
        }
        // Jika connected tidak ada, biarkan status sebelumnya tetap digunakan
    }
    
    updateTrafficData(traffic) {
        console.log('[Monitoring] updateTrafficData called with:', traffic);
        
        const dlCurrent = document.getElementById('current-download');
        const ulCurrent = document.getElementById('current-upload');
        const dlTotal = document.getElementById('total-download');
        const ulTotal = document.getElementById('total-upload');
        
        // PENTING: Debug - log element existence
        console.log('[Monitoring] Traffic elements found:', {
            dlCurrent: !!dlCurrent,
            ulCurrent: !!ulCurrent,
            dlTotal: !!dlTotal,
            ulTotal: !!ulTotal,
            trafficChart: !!this.trafficChart,
            mikrotikConnected: this.mikrotikConnected
        });
        
        if (!traffic) {
            console.warn('[Monitoring] No traffic data provided to updateTrafficData');
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
        
        // Format dengan 2 decimal untuk smooth display
        const formatMbps = (value) => {
            if (value === 0) return '0';
            if (value < 0.01) return '<0.01';
            return value.toFixed(2);
        };
        
        const formatGB = (value) => {
            if (value === 0) return '0';
            if (value < 0.01) return '<0.01';
            return value.toFixed(2);
        };
        
        // Update dengan smooth number formatting
        if (dlCurrent) {
            dlCurrent.textContent = `${formatMbps(downloadCurrent)} Mbps`;
            // Add color transition based on speed
            if (downloadCurrent > 10) {
                dlCurrent.style.color = '#22c55e'; // Green for high speed
            } else if (downloadCurrent > 1) {
                dlCurrent.style.color = '#f59e0b'; // Orange for medium speed
            } else {
                dlCurrent.style.color = '#6b7280'; // Gray for low speed
            }
        }
        
        if (ulCurrent) {
            ulCurrent.textContent = `${formatMbps(uploadCurrent)} Mbps`;
            // Add color transition based on speed
            if (uploadCurrent > 10) {
                ulCurrent.style.color = '#3b82f6'; // Blue for high speed
            } else if (uploadCurrent > 1) {
                ulCurrent.style.color = '#f59e0b'; // Orange for medium speed
            } else {
                ulCurrent.style.color = '#6b7280'; // Gray for low speed
            }
        }
        
        if (dlTotal) dlTotal.textContent = `Total: ${formatGB(downloadTotal)} GB`;
        if (ulTotal) ulTotal.textContent = `Total: ${formatGB(uploadTotal)} GB`;
        
        // PENTING: Pastikan chart sudah terinisialisasi sebelum update
        if (!this.trafficChart) {
            // Chart belum terinisialisasi, coba init lagi
            console.warn('[Monitoring] Traffic chart not initialized in updateTrafficData, attempting init...');
            this.initCharts();
            // Jangan return - biarkan data tetap di-update setelah init
            // Tapi tunggu sebentar untuk chart siap
            setTimeout(() => {
                if (this.trafficChart && traffic) {
                    this.updateTrafficData(traffic);
                }
            }, 500);
            return;
        }
        
        if (this.mikrotikConnected) {
            // Remove title jika masih ada
            if (this.trafficChart.options.plugins.title && this.trafficChart.options.plugins.title.display) {
                this.trafficChart.options.plugins.title.display = false;
            }
            
            // Format waktu dengan format yang lebih compact
            const now = new Date();
            const timeString = now.toLocaleTimeString('id-ID', { 
                hour: '2-digit', 
                minute: '2-digit',
                second: '2-digit'
            });
            
            // Maintain max 30 data points untuk smooth scrolling
            const maxDataPoints = 30;
            if (this.trafficChart.data.labels.length >= maxDataPoints) {
                this.trafficChart.data.labels.shift();
                this.trafficChart.data.datasets[0].data.shift();
                this.trafficChart.data.datasets[1].data.shift();
            }
            
            // Add new data point
            this.trafficChart.data.labels.push(timeString);
            this.trafficChart.data.datasets[0].data.push(downloadCurrent);
            this.trafficChart.data.datasets[1].data.push(uploadCurrent);
            
            // PENTING: Update dengan animation untuk smooth transition
            // Gunakan 'default' mode untuk smooth animation, bukan 'none'
            try {
                // PENTING: Validate chart object sebelum update
                if (this.trafficChart && this.trafficChart.data && this.trafficChart.data.labels) {
                    this.trafficChart.update('default');
                } else {
                    console.warn('[Monitoring] Traffic chart object invalid, attempting re-init...');
                    this.initCharts();
                }
            } catch (error) {
                console.error('[Monitoring] Error updating traffic chart:', error);
                // Coba re-init chart jika error
                try {
                    if (this.trafficChart) {
                        this.trafficChart.destroy();
                    }
                    this.trafficChart = null;
                    this.initCharts();
                } catch (reinitError) {
                    console.error('[Monitoring] Error re-initializing traffic chart:', reinitError);
                }
            }
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
            
            // PENTING: Handle rate limit (429) dan unauthorized (401) dengan graceful
            if (response.status === 429) {
                console.warn('[Monitoring] Rate limit exceeded untuk user stats, akan retry setelah beberapa saat');
                return; // Silent fail - akan retry pada interval berikutnya
            }
            
            if (response.status === 401) {
                console.warn('[Monitoring] Unauthorized untuk user stats - mungkin token expired');
                return; // Silent fail - jangan trigger logout
            }
            
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
                    // Clear chart data dengan smooth animation
                    this.trafficChart.data.labels = [];
                    this.trafficChart.data.datasets[0].data = [];
                    this.trafficChart.data.datasets[1].data = [];
                    this.trafficChart.update('default');
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
                    content += '<th>User</th><th>IP</th><th>Hostname</th><th>MAC</th><th>Uptime</th><th>Download</th><th>Upload</th>';
                    content += '</tr></thead><tbody>';
                    
                    sessions.forEach(session => {
                        const hostname = session.hostname || '-';
                        const hostnameDisplay = hostname !== '-' 
                            ? `<span class="badge badge-secondary" title="Hostname dari DHCP Server">${hostname}</span>` 
                            : '<span class="text-muted">-</span>';
                        
                        content += `<tr>
                            <td><strong>${session.user || '-'}</strong></td>
                            <td>${session.address || '-'}</td>
                            <td>${hostnameDisplay}</td>
                            <td class="text-muted small font-monospace">${session.mac || '-'}</td>
                            <td>${session.uptime || '0s'}</td>
                            <td class="text-success">${this.formatBytes(session.rx_bytes || 0)}</td>
                            <td class="text-info">${this.formatBytes(session.tx_bytes || 0)}</td>
                        </tr>`;
                    });
                    content += '</tbody></table></div>';
                    
                    // Mobile cards
                    content += '<div class="d-md-none">';
                    sessions.forEach(session => {
                        const hostname = session.hostname || '-';
                        const hostnameDisplay = hostname !== '-' 
                            ? `<div class="mt-1"><span class="badge badge-secondary badge-sm">${hostname}</span></div>` 
                            : '';
                        
                        content += `<div class="user-card mb-2">
                            <div class="d-flex justify-content-between align-items-center">
                                <strong>${session.user || '-'}</strong>
                                <span class="badge badge-info">${session.uptime || '0s'}</span>
                            </div>
                            <small class="text-muted d-block">IP: ${session.address || '-'}</small>
                            ${hostnameDisplay}
                            <small class="text-muted d-block font-monospace" style="font-size: 0.75rem;">MAC: ${session.mac || '-'}</small>
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
            // Clear the chart data dengan smooth transition
            const emptyData = new Array(this.trafficChart.data.labels.length).fill(0);
            this.trafficChart.data.datasets[0].data = emptyData;
            this.trafficChart.data.datasets[1].data = emptyData;
            
            // Add disconnected indicator
            if (!this.trafficChart.options.plugins.title) {
                this.trafficChart.options.plugins.title = {};
            }
            this.trafficChart.options.plugins.title.display = true;
            this.trafficChart.options.plugins.title.text = 'Network Traffic Monitor (Connecting to MikroTik...)';
            this.trafficChart.options.plugins.title.color = '#f59e0b';
            this.trafficChart.options.plugins.title.font = {
                size: 14,
                weight: '500'
            };
            this.trafficChart.options.plugins.title.position = 'top';
            this.trafficChart.options.plugins.title.align = 'center';
            
            // Update dengan animation untuk smooth transition
            this.trafficChart.update('default');
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
            this.updateInterval = null;
        }
        
        if (this.trafficUpdateInterval) {
            clearInterval(this.trafficUpdateInterval);
            this.trafficUpdateInterval = null;
        }
        
        if (this.trafficUpdateCheckInterval) {
            clearInterval(this.trafficUpdateCheckInterval);
            this.trafficUpdateCheckInterval = null;
        }
        
        // Destroy chart
        if (this.trafficChart) {
            try {
                this.trafficChart.destroy();
            } catch (error) {
                console.error('[Monitoring] Error destroying traffic chart:', error);
            }
            this.trafficChart = null;
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
