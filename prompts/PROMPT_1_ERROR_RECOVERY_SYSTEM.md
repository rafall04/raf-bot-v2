# ✨ CREATE REQUEST: AUTOMATIC ERROR RECOVERY & MONITORING SYSTEM

## 📋 PREREQUISITES
1. Understand existing error handling patterns in raf.js
2. Review lib/database.js connection management
3. Check current logging mechanisms
4. Understand WhatsApp connection lifecycle

## 🎯 OBJECTIVE
Create a robust error recovery and monitoring system that automatically handles common failures, tracks system health, and alerts administrators of critical issues.

## 📊 REQUIREMENTS

### Functional Requirements:
1. **Auto-reconnection for WhatsApp**
   - Detect disconnection events
   - Automatic retry with exponential backoff
   - Maximum retry limits
   - Alert admin after X failures

2. **Database Connection Pool**
   - Connection pooling for SQLite
   - Auto-reconnect on connection loss
   - Query retry mechanism
   - Transaction rollback handling

3. **Real-time Monitoring Dashboard**
   - System metrics (CPU, Memory, Disk)
   - Active connections count
   - Message processing rate
   - Error rate tracking
   - Queue sizes

4. **Alert System**
   - WhatsApp alerts to admin
   - Error severity levels
   - Rate limiting for alerts
   - Daily summary reports

5. **Automatic Recovery Actions**
   - Clear stuck queues
   - Reset frozen states
   - Restart failed services
   - Clean corrupted data

### Technical Requirements:
- Use existing baileys connection events
- Implement with minimal performance impact
- Store metrics in separate SQLite table
- Use node-cron for scheduled tasks
- WebSocket for real-time dashboard

## 🏗️ IMPLEMENTATION PLAN

### Phase 1: Error Recovery Module
```javascript
// lib/error-recovery.js
class ErrorRecovery {
    constructor() {
        this.retryAttempts = new Map();
        this.errorLog = [];
        this.recoveryActions = new Map();
    }
    
    async handleError(error, context) {
        // Log error
        this.logError(error, context);
        
        // Determine severity
        const severity = this.analyzeSeverity(error);
        
        // Execute recovery action
        const action = this.getRecoveryAction(error.code);
        if (action) {
            await this.executeRecovery(action, context);
        }
        
        // Alert if critical
        if (severity === 'CRITICAL') {
            await this.alertAdmin(error, context);
        }
    }
    
    async executeRecovery(action, context) {
        switch(action) {
            case 'RECONNECT_WA':
                await this.reconnectWhatsApp();
                break;
            case 'RESET_DB':
                await this.resetDatabase();
                break;
            case 'CLEAR_QUEUE':
                await this.clearQueue(context.queue);
                break;
            case 'RESTART_SERVICE':
                await this.restartService(context.service);
                break;
        }
    }
}
```

### Phase 2: Monitoring Service
```javascript
// lib/monitoring-service.js
class MonitoringService {
    constructor() {
        this.metrics = {
            messages: { sent: 0, received: 0, failed: 0 },
            errors: { count: 0, lastError: null },
            system: { cpu: 0, memory: 0, uptime: 0 },
            connections: { whatsapp: false, database: false }
        };
    }
    
    startMonitoring() {
        // Check every 30 seconds
        setInterval(() => this.collectMetrics(), 30000);
        
        // Health check every 5 minutes
        setInterval(() => this.healthCheck(), 300000);
        
        // Daily report at 9 AM
        cron.schedule('0 9 * * *', () => this.sendDailyReport());
    }
}
```

### Phase 3: Alert System
```javascript
// lib/alert-system.js
class AlertSystem {
    constructor() {
        this.alertQueue = [];
        this.rateLimiter = new Map();
    }
    
    async sendAlert(level, message, details) {
        // Check rate limit
        if (this.isRateLimited(level)) return;
        
        // Format alert message
        const alert = this.formatAlert(level, message, details);
        
        // Send via WhatsApp to admin
        await this.sendWhatsAppAlert(alert);
        
        // Log to database
        await this.logAlert(alert);
    }
}
```

## 📁 FILES TO CREATE/MODIFY
- `lib/error-recovery.js` - Main recovery module
- `lib/monitoring-service.js` - Monitoring engine
- `lib/alert-system.js` - Alert management
- `database/monitoring_metrics.sqlite` - Metrics storage
- `routes/monitoring-dashboard.js` - Web dashboard
- `views/monitoring-dashboard.html` - Dashboard UI
- `message/raf.js` - Integrate recovery hooks
- `lib/database.js` - Add connection pooling
- `config.json` - Add monitoring config

## 🔗 INTEGRATION POINTS
```javascript
// In message/raf.js
const { ErrorRecovery } = require('./lib/error-recovery');
const { MonitoringService } = require('./lib/monitoring-service');
const errorRecovery = new ErrorRecovery();
const monitoring = new MonitoringService();

// Hook into connection events
raf.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect } = update;
    
    if (connection === 'close') {
        const shouldReconnect = await errorRecovery.handleDisconnect(lastDisconnect);
        if (shouldReconnect) {
            await startBot();
        }
    }
    
    monitoring.updateConnectionStatus('whatsapp', connection);
});

// Hook into message processing
raf.ev.on('messages.upsert', async (m) => {
    try {
        monitoring.incrementMetric('messages.received');
        // Process message
    } catch (error) {
        monitoring.incrementMetric('messages.failed');
        await errorRecovery.handleError(error, { context: 'message_processing' });
    }
});
```

## 🧪 ACCEPTANCE CRITERIA
1. ✅ System auto-recovers from WhatsApp disconnection within 30 seconds
2. ✅ Database queries retry automatically on failure
3. ✅ Admin receives alerts for critical errors
4. ✅ Dashboard shows real-time system metrics
5. ✅ Daily report sent at 9 AM
6. ✅ Error rate reduced by 80%
7. ✅ Zero manual intervention for common issues

## 📈 SUCCESS METRICS
- Uptime: > 99.5%
- Error recovery rate: > 95%
- Alert response time: < 1 minute
- Dashboard load time: < 2 seconds
- Memory usage: < 500MB

## 🔧 TESTING SCENARIOS
1. Simulate WhatsApp disconnection
2. Force database connection timeout
3. Create memory leak scenario
4. Flood with messages (stress test)
5. Corrupt state data
6. Network interruption
7. Disk space exhaustion

## 📝 DOCUMENTATION
Update these docs:
- AI_MAINTENANCE_GUIDE.md - Add monitoring section
- README.md - Add dashboard access instructions
- Create MONITORING_GUIDE.md for operators
