# 🚀 ERROR RECOVERY & MONITORING SYSTEM

## 📋 Overview

The Error Recovery & Monitoring System provides automatic error handling, system monitoring, and admin alerts for RAF Bot v2. It ensures high availability and self-healing capabilities.

## ✨ Features

### 1. **Automatic Error Recovery**
- Auto-reconnection for WhatsApp disconnections
- Database connection recovery
- Queue clearing for stuck processes
- Memory management
- Exponential backoff retry logic

### 2. **Real-time Monitoring**
- System metrics (CPU, Memory, Disk)
- Message flow tracking
- Connection status monitoring
- Error rate tracking
- Performance metrics

### 3. **Alert System**
- WhatsApp alerts to admin
- Severity-based notifications
- Rate limiting to prevent spam
- Daily summary reports
- Health check warnings

### 4. **Dashboard**
- Web-based monitoring interface
- Real-time metrics display
- Error statistics
- System control actions
- Historical data viewing

---

## 🛠️ Installation & Configuration

### **1. Configuration Setup**

Add the following to your `config.json`:

```json
{
  "admin_numbers": [
    "6285123456789",
    "6281234567890"
  ],
  "monitoring": {
    "enabled": true,
    "alert_level": "warning",
    "daily_report_time": "09:00",
    "metrics_retention_days": 7
  },
  "error_recovery": {
    "max_retries": 5,
    "retry_delay": 1000,
    "reconnect_cooldown": 30000,
    "auto_recovery": true
  }
}
```

### **2. System Requirements**

- Node.js 14+
- SQLite3
- 100MB free disk space for logs
- Network access for alerts

---

## 📊 Components

### **ErrorRecovery Class** (`lib/error-recovery.js`)

Handles automatic error recovery with intelligent retry logic.

**Key Methods:**
- `handleError(error, context)` - Main error handler
- `executeRecovery(action, context)` - Execute recovery actions
- `reconnectWhatsApp()` - WhatsApp reconnection
- `resetDatabase()` - Database recovery
- `clearQueue()` - Clear stuck queues

**Recovery Actions:**
| Error Code | Action | Description |
|------------|--------|-------------|
| ECONNREFUSED | RECONNECT_WA | Reconnect WhatsApp |
| ETIMEDOUT | RECONNECT_WA | Reconnect WhatsApp |
| SQLITE_BUSY | RESET_DB | Reset database connection |
| ENOMEM | CLEAR_MEMORY | Clear memory caches |
| QUEUE_FULL | CLEAR_QUEUE | Clear message queue |

### **MonitoringService Class** (`lib/monitoring-service.js`)

Tracks system metrics and performance.

**Key Methods:**
- `collectMetrics()` - Collect system metrics
- `healthCheck()` - Perform health check
- `sendDailyReport()` - Send daily summary
- `getMetricsSnapshot()` - Get current metrics
- `trackActiveUser(userId)` - Track user activity

**Metrics Tracked:**
- Messages (sent/received/failed)
- System (CPU/Memory/Disk/Uptime)
- Connections (WhatsApp/Database)
- Performance (Response time/Queue size)
- Users (Active/Unique)

### **AlertSystem Class** (`lib/alert-system.js`)

Manages alerts and notifications.

**Key Methods:**
- `sendAlert(level, type, details)` - Send alert
- `sendHealthAlert(health)` - Send health status
- `sendDailyReport(report)` - Send daily report
- `getAlertStats()` - Get alert statistics

**Alert Levels:**
- `info` - Informational (10/hour limit)
- `warning` - Warning (5/hour limit)
- `error` - Error (3/hour limit)
- `critical` - Critical (no limit)

---

## 🔧 Usage

### **Basic Integration**

The system is automatically integrated into `index.js`:

```javascript
// Systems are initialized globally
global.errorRecovery = new ErrorRecovery();
global.monitoring = new MonitoringService();
global.alertSystem = new AlertSystem();

// Error handling in message processing
raf.ev.on('messages.upsert', async m => {
    try {
        global.monitoring.incrementMetric('messages.received');
        await msgHandler(raf, m.messages[0], m);
        global.monitoring.incrementMetric('messages.sent');
    } catch (error) {
        global.monitoring.incrementMetric('messages.failed');
        const recovery = await global.errorRecovery.handleError(error, { 
            context: 'message_processing',
            retryable: true
        });
        
        if (recovery.retry) {
            // Retry with exponential backoff
            setTimeout(() => msgHandler(raf, m.messages[0], m), recovery.delay);
        }
    }
});
```

### **Connection Monitoring**

```javascript
raf.ev.on('connection.update', async update => {
    global.monitoring.updateConnectionStatus('whatsapp', update.connection);
    
    if (update.connection === 'close') {
        const recovery = await global.errorRecovery.handleError(
            lastDisconnect.error,
            { context: 'whatsapp_disconnection' }
        );
        
        if (recovery.retry) {
            setTimeout(() => connect(), recovery.delay);
        }
    }
});
```

### **Manual Error Reporting**

```javascript
// Log custom error
await global.monitoring.logError(error, { 
    context: 'custom_operation',
    userId: '12345'
}, 'warning');

// Send custom alert
await global.alertSystem.sendAlert('warning', 'CUSTOM_ALERT', {
    message: 'Custom warning message',
    details: 'Additional details'
});
```

---

## 🌐 API Endpoints

### **Monitoring Dashboard**

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/monitoring/metrics` | GET | Get current metrics |
| `/api/monitoring/health` | GET | Get health status |
| `/api/monitoring/history` | GET | Get metrics history |
| `/api/monitoring/errors` | GET | Get error statistics |
| `/api/monitoring/alerts` | GET | Get alert statistics |
| `/api/monitoring/test-alert` | POST | Send test alert |
| `/api/monitoring/clear-errors` | POST | Clear error logs |
| `/api/monitoring/restart-service` | POST | Restart service |

### **Dashboard UI**

Access the monitoring dashboard at:
```
http://localhost:3100/monitoring-dashboard.html
```

---

## 📈 Monitoring Metrics

### **Real-time Metrics**
- **Messages/min** - Message processing rate
- **Active Users** - Currently active users
- **CPU Usage** - System CPU usage percentage
- **Memory Usage** - System memory usage percentage
- **Queue Size** - Pending messages in queue
- **Error Rate** - Errors per hour
- **Uptime** - System uptime

### **Daily Report Contents**
- Total messages processed
- Error count and rate
- Average CPU/Memory usage
- Peak user count
- System uptime percentage
- Critical issues summary

---

## 🚨 Alert Types

| Alert Type | Icon | Description |
|------------|------|-------------|
| ERROR_SPIKE | 📈 | Error rate increased |
| HIGH_CPU | 🔥 | CPU usage >80% |
| HIGH_MEMORY | 💾 | Memory usage >85% |
| WHATSAPP_DISCONNECTED | 📱 | WhatsApp connection lost |
| DATABASE_ERROR | 🗄️ | Database error occurred |
| QUEUE_BACKLOG | 📬 | Message queue backed up |
| SERVICE_RECOVERED | ✅ | Service restored |
| DAILY_REPORT | 📊 | Daily summary |

---

## 🧪 Testing

### **Run Tests**
```bash
node test/test-error-recovery-system.js
```

### **Test Coverage**
- Error recovery mechanisms
- Monitoring metrics collection
- Health check functionality
- Alert system
- Connection status tracking
- Recovery actions

---

## 🔍 Troubleshooting

### **System Not Recovering**
1. Check `config.json` for correct settings
2. Verify admin numbers are correct
3. Check logs in `logs/error-recovery.log`
4. Ensure WhatsApp session is valid

### **Alerts Not Sending**
1. Verify WhatsApp is connected
2. Check admin_numbers in config
3. Review alert rate limits
4. Check `logs/alerts.log`

### **High Error Rate**
1. Check system resources (CPU/Memory)
2. Review error logs for patterns
3. Check network connectivity
4. Verify database integrity

### **Monitoring Not Working**
1. Check if monitoring service is running
2. Verify database permissions
3. Check `database/monitoring_metrics.sqlite`
4. Review console logs for errors

---

## 📊 Performance Impact

- **CPU Overhead**: <2%
- **Memory Usage**: ~50MB
- **Disk Usage**: ~10MB/day (logs)
- **Network**: Minimal (alerts only)
- **Database**: ~1000 writes/day

---

## 🔐 Security Considerations

1. **Admin Numbers**: Keep admin_numbers list updated and secure
2. **Dashboard Access**: Requires admin authentication
3. **Log Files**: Contains sensitive data, secure appropriately
4. **Alerts**: May contain system information, use secure channels

---

## 🚀 Best Practices

1. **Set Appropriate Limits**
   - Adjust retry limits based on your needs
   - Configure alert levels to avoid spam
   - Set reasonable cooldown periods

2. **Monitor Regularly**
   - Check dashboard daily
   - Review error patterns weekly
   - Analyze daily reports

3. **Maintain Logs**
   - Archive old logs monthly
   - Clean up error logs regularly
   - Keep metrics for trend analysis

4. **Test Recovery**
   - Test recovery mechanisms monthly
   - Verify alert delivery
   - Simulate failures for testing

---

## 📝 Maintenance

### **Daily Tasks**
- Review dashboard metrics
- Check for critical alerts
- Monitor error rates

### **Weekly Tasks**
- Analyze error patterns
- Review system performance
- Clean old error logs

### **Monthly Tasks**
- Archive monitoring data
- Test recovery mechanisms
- Update alert configurations
- Review and optimize thresholds

---

## 🆘 Support

For issues or questions about the Error Recovery System:

1. Check this documentation
2. Review logs in `logs/` directory
3. Run diagnostic test: `node test/test-error-recovery-system.js`
4. Check dashboard for system status
5. Contact system administrator

---

**Last Updated:** November 2024
**Version:** 1.0.0
**Status:** Production Ready
