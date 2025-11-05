# ✨ ENHANCED ERROR RECOVERY & MONITORING SYSTEM V2
## Including MikroTik Traffic Monitoring & Dashboard Integration

---

## 📋 PREREQUISITES
1. Review existing `index.php` dashboard structure
2. Understand MikroTik API integration (`lib/mikrotik.js`)
3. Check existing authentication flow
4. Review current database schema
5. Analyze existing WebSocket implementation

---

## 🎯 OBJECTIVES
Create a comprehensive monitoring system that:
1. Auto-recovers from failures
2. Monitors WhatsApp bot performance
3. Tracks MikroTik router traffic and statistics
4. Integrates seamlessly with existing dashboard
5. Provides real-time alerts and visualizations

---

## 🏗️ DETAILED IMPLEMENTATION PLAN

### **PHASE 1: CORE ERROR RECOVERY SYSTEM**

#### 1.1 Error Recovery Module (`lib/error-recovery.js`)

```javascript
/**
 * Enhanced Error Recovery with detailed actions
 */
class ErrorRecovery {
    constructor() {
        this.retryAttempts = new Map();
        this.errorLog = [];
        this.recoveryActions = new Map();
        this.maxRetries = 5;
        this.retryDelay = 1000;
        this.criticalErrors = [];
        
        // Initialize recovery strategies
        this.strategies = {
            'ECONNREFUSED': this.strategyReconnectWhatsApp.bind(this),
            'SQLITE_BUSY': this.strategyResetDatabase.bind(this),
            'MIKROTIK_TIMEOUT': this.strategyReconnectMikrotik.bind(this),
            'QUEUE_OVERFLOW': this.strategyClearQueue.bind(this)
        };
    }
    
    async handleError(error, context) {
        // 1. Classify error
        const classification = this.classifyError(error);
        
        // 2. Log with full context
        await this.logDetailedError({
            timestamp: new Date().toISOString(),
            error: error.message,
            stack: error.stack,
            code: error.code,
            context: context,
            classification: classification,
            userId: context.userId,
            sessionId: context.sessionId
        });
        
        // 3. Execute recovery strategy
        const strategy = this.strategies[error.code];
        if (strategy) {
            const result = await strategy(error, context);
            
            // 4. Notify recovery status
            await this.notifyRecoveryStatus(result);
            
            return result;
        }
        
        // 5. Default exponential backoff
        return await this.defaultRecovery(error, context);
    }
    
    async strategyReconnectWhatsApp(error, context) {
        const attempts = this.getRetryCount('whatsapp');
        
        if (attempts >= this.maxRetries) {
            // Critical: Send SMS alert as WhatsApp is down
            await this.sendSMSAlert('WhatsApp service down after 5 attempts');
            return { success: false, critical: true };
        }
        
        // Calculate backoff: 1s, 2s, 4s, 8s, 16s
        const delay = Math.min(1000 * Math.pow(2, attempts), 30000);
        
        await this.delay(delay);
        
        try {
            // Attempt reconnection
            if (global.connect) {
                await global.connect();
                this.resetRetryCount('whatsapp');
                return { success: true, recovered: true };
            }
        } catch (reconnectError) {
            this.incrementRetryCount('whatsapp');
            return { success: false, nextRetry: delay * 2 };
        }
    }
}
```

#### 1.2 Database Recovery (`lib/database-recovery.js`)

```javascript
/**
 * SQLite connection pooling and recovery
 */
class DatabaseRecovery {
    constructor() {
        this.pool = [];
        this.maxConnections = 10;
        this.activeConnections = 0;
        this.waitingQueue = [];
    }
    
    async getConnection() {
        if (this.activeConnections < this.maxConnections) {
            return this.createConnection();
        }
        
        // Wait for available connection
        return new Promise((resolve) => {
            this.waitingQueue.push(resolve);
        });
    }
    
    async executeWithRetry(query, params, maxRetries = 3) {
        let lastError;
        
        for (let i = 0; i < maxRetries; i++) {
            try {
                const conn = await this.getConnection();
                const result = await this.executeQuery(conn, query, params);
                this.releaseConnection(conn);
                return result;
            } catch (error) {
                lastError = error;
                
                if (error.code === 'SQLITE_BUSY') {
                    await this.delay(100 * Math.pow(2, i)); // Exponential backoff
                } else if (error.code === 'SQLITE_CORRUPT') {
                    await this.restoreFromBackup();
                }
            }
        }
        
        throw lastError;
    }
}
```

---

### **PHASE 2: MIKROTIK MONITORING INTEGRATION**

#### 2.1 MikroTik Monitor (`lib/mikrotik-monitor.js`)

```javascript
/**
 * Real-time MikroTik monitoring with traffic analysis
 */
const { RouterOSAPI } = require('node-routeros');

class MikrotikMonitor {
    constructor(config) {
        this.config = config;
        this.conn = null;
        this.metrics = {
            interfaces: {},
            traffic: {
                download: { current: 0, total: 0, history: [] },
                upload: { current: 0, total: 0, history: [] }
            },
            hotspot: {
                activeUsers: 0,
                totalUsers: 0,
                sessions: []
            },
            pppoe: {
                activeConnections: 0,
                totalAccounts: 0,
                connections: []
            },
            system: {
                cpu: 0,
                memory: 0,
                disk: 0,
                uptime: 0,
                temperature: 0
            },
            queues: {
                simple: [],
                tree: []
            }
        };
    }
    
    async connect() {
        try {
            this.conn = new RouterOSAPI({
                host: this.config.mikrotik_ip,
                user: this.config.mikrotik_user,
                password: this.config.mikrotik_pass,
                port: 8728,
                timeout: 10
            });
            
            await this.conn.connect();
            console.log('[MIKROTIK] Connected successfully');
            
            // Start monitoring loops
            this.startMonitoring();
            
            return true;
        } catch (error) {
            console.error('[MIKROTIK] Connection failed:', error);
            
            // Trigger recovery
            await global.errorRecovery.handleError(error, {
                context: 'mikrotik_connection',
                ip: this.config.mikrotik_ip
            });
            
            return false;
        }
    }
    
    async startMonitoring() {
        // Monitor every 5 seconds
        this.trafficInterval = setInterval(() => this.collectTrafficStats(), 5000);
        
        // Monitor interfaces every 10 seconds
        this.interfaceInterval = setInterval(() => this.collectInterfaceStats(), 10000);
        
        // Monitor hotspot/PPPoE every 30 seconds
        this.userInterval = setInterval(() => this.collectUserStats(), 30000);
        
        // System resources every minute
        this.systemInterval = setInterval(() => this.collectSystemStats(), 60000);
        
        // Queue statistics every 30 seconds
        this.queueInterval = setInterval(() => this.collectQueueStats(), 30000);
    }
}
```

---

## 📁 FILES TO CREATE/MODIFY

### **Backend Files (Node.js)**
1. `lib/error-recovery.js` - Enhanced error recovery with MikroTik support
2. `lib/monitoring-service.js` - Extended monitoring for MikroTik
3. `lib/mikrotik-monitor.js` - MikroTik traffic and statistics monitor
4. `lib/database-recovery.js` - Database connection pooling
5. `routes/monitoring-api.js` - API endpoints for monitoring data
6. `routes/mikrotik-api.js` - API endpoints for MikroTik data

### **Frontend Files (PHP/JS)**
1. `api/monitoring.php` - PHP API wrapper for monitoring data
2. `views/monitoring-widget.php` - Monitoring widget for index.php
3. `assets/js/monitoring-dashboard.js` - JavaScript for dashboard
4. `assets/css/monitoring.css` - Styling for monitoring components

### **Database Schema**
1. `database/schema/monitoring_tables.sql` - Extended schema
2. `database/schema/mikrotik_stats.sql` - MikroTik statistics tables

---

## 🔗 INTEGRATION POINTS

### **1. Index.php Integration**

```php
// In index.php after session check
require_once 'lib/monitoring-loader.php';
$monitoring = new MonitoringLoader();
$monitoringEnabled = $monitoring->isEnabled();
?>

<!-- Add to dashboard -->
<?php if ($monitoringEnabled): ?>
    <?php include 'views/monitoring-widget.php'; ?>
<?php endif; ?>
```

### **2. WebSocket Integration**

```javascript
// In index.js
const MikrotikMonitor = require('./lib/mikrotik-monitor');
const mikrotikMonitor = new MikrotikMonitor(config);

// Initialize after bot starts
mikrotikMonitor.connect();

// Broadcast updates
io.on('connection', (socket) => {
    // Send initial data
    socket.emit('monitoring:initial', {
        system: monitoring.getMetricsSnapshot(),
        mikrotik: mikrotikMonitor.metrics
    });
    
    // Join monitoring room
    socket.join('monitoring');
});
```

### **3. API Endpoints**

```javascript
// routes/monitoring-api.js
router.get('/api/monitoring/system', requireAdmin, (req, res) => {
    res.json(global.monitoring.getMetricsSnapshot());
});

router.get('/api/monitoring/mikrotik/traffic', requireAdmin, (req, res) => {
    res.json(global.mikrotikMonitor.metrics.traffic);
});

router.get('/api/monitoring/mikrotik/users', requireAdmin, (req, res) => {
    res.json({
        hotspot: global.mikrotikMonitor.metrics.hotspot,
        pppoe: global.mikrotikMonitor.metrics.pppoe
    });
});

router.post('/api/monitoring/mikrotik/restart-interface', requireAdmin, async (req, res) => {
    const { interface } = req.body;
    const result = await global.mikrotikMonitor.restartInterface(interface);
    res.json(result);
});
```

---

## 🎨 DASHBOARD UI COMPONENTS

### **1. Main Monitoring Widget**
- Real-time system health indicator
- WhatsApp connection status
- MikroTik connection status
- Quick stats (CPU, Memory, Traffic)
- Alert notifications

### **2. Traffic Monitor**
- Real-time bandwidth graph
- Per-interface statistics
- Historical traffic data
- Peak usage indicators

### **3. User Monitor**
- Active hotspot users list
- PPPoE connections list
- User bandwidth consumption
- Session duration tracking

### **4. Alert Center**
- Recent alerts list
- Alert acknowledgment
- Alert history
- Custom alert rules

---

## 🔧 CONFIGURATION

### **config.json additions:**
```json
{
  "monitoring": {
    "enabled": true,
    "mikrotik": {
      "enabled": true,
      "host": "192.168.88.1",
      "user": "admin",
      "password": "password",
      "port": 8728,
      "ssl": false
    },
    "alerts": {
      "whatsapp": true,
      "email": false,
      "sms": false,
      "webhook": "https://your-webhook.com/alerts"
    },
    "thresholds": {
      "cpu_warning": 70,
      "cpu_critical": 90,
      "memory_warning": 80,
      "memory_critical": 95,
      "traffic_spike": 100000000,
      "error_rate_warning": 10,
      "error_rate_critical": 50
    },
    "retention": {
      "metrics_days": 7,
      "alerts_days": 30,
      "traffic_hours": 24
    }
  }
}
```

---

## 🧪 TESTING SCENARIOS

### **Error Recovery Tests**
1. Simulate WhatsApp disconnection
2. Force database lock
3. Trigger memory overflow
4. Create network partition
5. Corrupt configuration file

### **MikroTik Monitor Tests**
1. Disconnect MikroTik API
2. Simulate traffic spike
3. Create hotspot overload
4. Test queue overflow
5. Trigger temperature alert

### **Integration Tests**
1. Dashboard load performance
2. WebSocket connection stability
3. API response times
4. Alert delivery verification
5. Data consistency check

---

## 📈 SUCCESS METRICS

### **System Metrics**
- Uptime: > 99.5%
- Error recovery: < 30 seconds
- Alert delivery: < 1 minute
- Dashboard refresh: < 2 seconds

### **MikroTik Metrics**
- Traffic accuracy: 99%
- User tracking: Real-time
- API response: < 500ms
- Historical data: 24 hours minimum

### **User Experience**
- Dashboard load: < 3 seconds
- Chart update: Real-time
- Alert visibility: Immediate
- Mobile responsive: Yes

---

## 🔐 SECURITY CONSIDERATIONS

1. **API Authentication**
   - JWT tokens for API access
   - Rate limiting on endpoints
   - IP whitelisting for admin

2. **MikroTik Security**
   - Encrypted API connection
   - Read-only access where possible
   - Credential encryption

3. **Data Protection**
   - Sanitize all inputs
   - Encrypt sensitive data
   - Audit logging

---

## 📝 DOCUMENTATION REQUIREMENTS

1. **User Guide**
   - Dashboard navigation
   - Alert management
   - Traffic monitoring
   - Troubleshooting

2. **Admin Guide**
   - Configuration options
   - Alert rules setup
   - Backup procedures
   - Performance tuning

3. **API Documentation**
   - Endpoint descriptions
   - Request/response formats
   - Authentication flow
   - Rate limits

---

## 🚀 DEPLOYMENT CHECKLIST

- [ ] Install Node.js dependencies
- [ ] Configure MikroTik API access
- [ ] Set up monitoring database
- [ ] Configure alert channels
- [ ] Test WebSocket connectivity
- [ ] Verify dashboard access
- [ ] Set up backup automation
- [ ] Configure log rotation
- [ ] Test recovery scenarios
- [ ] Document admin procedures

---

## 💡 ADVANCED FEATURES (Future)

1. **Machine Learning**
   - Anomaly detection
   - Traffic prediction
   - Auto-scaling triggers

2. **Integrations**
   - Telegram alerts
   - Grafana dashboard
   - Prometheus metrics
   - ELK stack logging

3. **Automation**
   - Auto-restart services
   - Traffic shaping rules
   - User management
   - Backup orchestration

---

END OF PROMPT V2
