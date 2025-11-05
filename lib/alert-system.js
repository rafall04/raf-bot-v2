/**
 * Alert System for RAF Bot v2
 * Manages alerts, notifications, and admin communications
 */

const fs = require('fs-extra');
const path = require('path');

class AlertSystem {
    constructor() {
        this.alertQueue = [];
        this.rateLimiter = new Map();
        this.alertHistory = [];
        this.maxHistorySize = 1000;
        this.alertCooldowns = new Map();
        
        // Alert configurations
        this.config = {
            rateLimits: {
                info: { max: 10, window: 3600000 },      // 10 per hour
                warning: { max: 5, window: 3600000 },     // 5 per hour
                error: { max: 3, window: 3600000 },       // 3 per hour
                critical: { max: 10, window: 3600000 }     // 10 per hour (no real limit for critical)
            },
            cooldowns: {
                ERROR_SPIKE: 600000,         // 10 minutes
                HIGH_CPU: 300000,            // 5 minutes
                HIGH_MEMORY: 300000,         // 5 minutes
                WHATSAPP_DISCONNECTED: 60000, // 1 minute
                DATABASE_ERROR: 300000,       // 5 minutes
                QUEUE_BACKLOG: 600000        // 10 minutes
            },
            priorities: {
                info: 1,
                warning: 2,
                error: 3,
                critical: 4
            }
        };
        
        // Alert templates
        this.templates = this.loadTemplates();
        
        // Initialize alert log
        this.alertLogPath = path.join(__dirname, '../logs/alerts.log');
        this.ensureLogDirectory();
    }
    
    /**
     * Load alert message templates
     */
    loadTemplates() {
        return {
            ERROR_SPIKE: {
                icon: '📈',
                title: 'ERROR SPIKE DETECTED',
                template: 'Error rate has increased to {rate} errors/hour'
            },
            HIGH_CPU: {
                icon: '🔥',
                title: 'HIGH CPU USAGE',
                template: 'CPU usage is at {usage}%'
            },
            HIGH_MEMORY: {
                icon: '💾',
                title: 'HIGH MEMORY USAGE',
                template: 'Memory usage is at {usage}%'
            },
            WHATSAPP_DISCONNECTED: {
                icon: '📱',
                title: 'WHATSAPP DISCONNECTED',
                template: 'WhatsApp connection lost. Attempting reconnection...'
            },
            DATABASE_ERROR: {
                icon: '🗄️',
                title: 'DATABASE ERROR',
                template: 'Database error occurred: {error}'
            },
            QUEUE_BACKLOG: {
                icon: '📬',
                title: 'QUEUE BACKLOG',
                template: 'Message queue has {size} pending items'
            },
            SERVICE_RECOVERED: {
                icon: '✅',
                title: 'SERVICE RECOVERED',
                template: '{service} has been restored'
            },
            DAILY_REPORT: {
                icon: '📊',
                title: 'DAILY SYSTEM REPORT',
                template: 'Daily summary for {date}'
            },
            HEALTH_WARNING: {
                icon: '⚠️',
                title: 'HEALTH CHECK WARNING',
                template: 'System health: {status} with {issues} issues'
            },
            CRITICAL_ERROR: {
                icon: '🚨',
                title: 'CRITICAL ERROR',
                template: 'Critical error: {message}'
            }
        };
    }
    
    /**
     * Ensure log directory exists
     */
    ensureLogDirectory() {
        const logsDir = path.dirname(this.alertLogPath);
        if (!fs.existsSync(logsDir)) {
            fs.mkdirSync(logsDir, { recursive: true });
        }
    }
    
    /**
     * Send alert
     */
    async sendAlert(level, type, details = {}) {
        try {
            // Check if alert is in cooldown
            if (this.isInCooldown(type)) {
                console.log(`[ALERT] ${type} is in cooldown`);
                return false;
            }
            
            // Check rate limit
            if (this.isRateLimited(level)) {
                console.log(`[ALERT] Rate limit exceeded for ${level} alerts`);
                return false;
            }
            
            // Create alert object
            const alert = {
                id: Date.now().toString(),
                timestamp: new Date().toISOString(),
                level,
                type,
                details,
                priority: this.config.priorities[level] || 0
            };
            
            // Add to queue
            this.alertQueue.push(alert);
            
            // Process queue
            await this.processAlertQueue();
            
            // Set cooldown
            this.setCooldown(type);
            
            // Update rate limiter
            this.updateRateLimit(level);
            
            return true;
        } catch (error) {
            console.error('[ALERT] Send error:', error);
            return false;
        }
    }
    
    /**
     * Process alert queue
     */
    async processAlertQueue() {
        // Sort by priority
        this.alertQueue.sort((a, b) => b.priority - a.priority);
        
        while (this.alertQueue.length > 0) {
            const alert = this.alertQueue.shift();
            
            try {
                // Format message
                const message = this.formatAlertMessage(alert);
                
                // Send via WhatsApp
                await this.sendWhatsAppAlert(message, alert.level);
                
                // Log alert
                this.logAlert(alert, message);
                
                // Add to history
                this.addToHistory(alert);
                
                console.log(`[ALERT] Sent ${alert.level} alert: ${alert.type}`);
            } catch (error) {
                console.error(`[ALERT] Failed to send alert:`, error);
                
                // Re-queue if critical
                if (alert.level === 'critical' && !alert.retried) {
                    alert.retried = true;
                    this.alertQueue.push(alert);
                }
            }
        }
    }
    
    /**
     * Format alert message
     */
    formatAlertMessage(alert) {
        const template = this.templates[alert.type] || {
            icon: '📢',
            title: alert.type,
            template: 'Alert: {details}'
        };
        
        const timestamp = new Date().toLocaleString('id-ID', { 
            timeZone: 'Asia/Jakarta',
            dateStyle: 'short',
            timeStyle: 'medium'
        });
        
        let message = `${template.icon} *${template.title}*\n\n`;
        
        // Add level indicator
        const levelIcons = {
            info: 'ℹ️',
            warning: '⚠️',
            error: '❌',
            critical: '🚨'
        };
        
        message += `${levelIcons[alert.level]} *Level:* ${alert.level.toUpperCase()}\n`;
        message += `⏰ *Time:* ${timestamp}\n\n`;
        
        // Process template
        let details = template.template;
        for (const [key, value] of Object.entries(alert.details)) {
            details = details.replace(`{${key}}`, value);
        }
        
        message += `📝 *Details:*\n${details}\n\n`;
        
        // Add recommendations based on type
        const recommendation = this.getRecommendation(alert.type, alert.details);
        if (recommendation) {
            message += `💡 *Recommendation:*\n${recommendation}\n`;
        }
        
        // Add system stats for critical alerts
        if (alert.level === 'critical' || alert.level === 'error') {
            const stats = this.getSystemStats();
            if (stats) {
                message += `\n📊 *System Status:*\n${stats}`;
            }
        }
        
        return message;
    }
    
    /**
     * Get recommendation for alert type
     */
    getRecommendation(type, details) {
        const recommendations = {
            ERROR_SPIKE: 'Check error logs for patterns. Consider increasing resources or fixing the root cause.',
            HIGH_CPU: 'Check for runaway processes. Consider scaling resources or optimizing code.',
            HIGH_MEMORY: 'Check for memory leaks. May need to restart service or increase memory allocation.',
            WHATSAPP_DISCONNECTED: 'Auto-reconnection in progress. Check internet connection if persists.',
            DATABASE_ERROR: 'Check database integrity. May need to restore from backup.',
            QUEUE_BACKLOG: 'Queue processing may be slow. Check for bottlenecks.',
            SERVICE_RECOVERED: 'Service is back online. Monitor for stability.',
        };
        
        return recommendations[type] || null;
    }
    
    /**
     * Get system stats for alert
     */
    getSystemStats() {
        try {
            if (!global.monitoring) return null;
            
            const metrics = global.monitoring.getMetricsSnapshot();
            
            let stats = '';
            stats += `• CPU: ${metrics.system.cpu}%\n`;
            stats += `• Memory: ${metrics.system.memory}%\n`;
            stats += `• Uptime: ${Math.floor(metrics.system.uptime / 3600)}h\n`;
            stats += `• Active Users: ${metrics.performance.activeUsers}\n`;
            stats += `• Queue Size: ${metrics.performance.queueSize}\n`;
            stats += `• WhatsApp: ${metrics.connections.whatsapp ? '✅' : '❌'}\n`;
            stats += `• Database: ${metrics.connections.database ? '✅' : '❌'}`;
            
            return stats;
        } catch {
            return null;
        }
    }
    
    /**
     * Send WhatsApp alert
     */
    async sendWhatsAppAlert(message, level) {
        try {
            // Check if WhatsApp is connected
            if (!global.raf || !global.raf.user) {
                console.log('[ALERT] WhatsApp not connected, queuing alert');
                // Could implement email fallback here
                return false;
            }
            
            // Get admin numbers from config
            const admins = global.config?.admin_numbers || [];
            
            if (admins.length === 0) {
                console.log('[ALERT] No admin numbers configured');
                return false;
            }
            
            // Send to all admins
            const sendPromises = admins.map(async (adminNumber) => {
                try {
                    const jid = adminNumber.includes('@') 
                        ? adminNumber 
                        : `${adminNumber}@s.whatsapp.net`;
                    
                    await global.raf.sendMessage(jid, { text: message });
                    
                    console.log(`[ALERT] Sent to admin: ${adminNumber}`);
                    return true;
                } catch (error) {
                    console.error(`[ALERT] Failed to send to ${adminNumber}:`, error);
                    return false;
                }
            });
            
            const results = await Promise.allSettled(sendPromises);
            const successCount = results.filter(r => r.status === 'fulfilled' && r.value).length;
            
            return successCount > 0;
        } catch (error) {
            console.error('[ALERT] WhatsApp send error:', error);
            return false;
        }
    }
    
    /**
     * Send health alert
     */
    async sendHealthAlert(health) {
        const level = health.status === 'critical' ? 'critical' : 
                     health.status === 'degraded' ? 'error' : 'warning';
        
        await this.sendAlert(level, 'HEALTH_WARNING', {
            status: health.status,
            issues: health.issues.length
        });
        
        // Send detailed issues for critical
        if (health.status === 'critical') {
            for (const issue of health.issues) {
                if (issue.severity === 'critical') {
                    await this.sendAlert('critical', issue.type, issue);
                }
            }
        }
    }
    
    /**
     * Send daily report
     */
    async sendDailyReport(report) {
        if (!report) return;
        
        const message = this.formatDailyReport(report);
        
        // Send as info level
        await this.sendWhatsAppAlert(message, 'info');
        
        console.log('[ALERT] Daily report sent');
    }
    
    /**
     * Format daily report
     */
    formatDailyReport(report) {
        let message = `📊 *DAILY SYSTEM REPORT*\n`;
        message += `📅 Date: ${report.date}\n\n`;
        
        message += `📨 *MESSAGES*\n`;
        message += `• Sent: ${report.messages.sent}\n`;
        message += `• Received: ${report.messages.received}\n`;
        message += `• Failed: ${report.messages.failed}\n`;
        message += `• Total: ${report.messages.total}\n\n`;
        
        message += `❌ *ERRORS*\n`;
        message += `• Total: ${report.errors.total}\n`;
        message += `• Rate: ${report.errors.rate}/hour\n\n`;
        
        message += `💻 *SYSTEM*\n`;
        message += `• Avg CPU: ${report.system.avgCpu}%\n`;
        message += `• Max CPU: ${report.system.maxCpu}%\n`;
        message += `• Avg Memory: ${report.system.avgMemory}%\n`;
        message += `• Max Memory: ${report.system.maxMemory}%\n\n`;
        
        message += `👥 *USERS*\n`;
        message += `• Unique: ${report.users.unique}\n`;
        message += `• Peak: ${report.users.peak}\n\n`;
        
        message += `⚡ *PERFORMANCE*\n`;
        message += `• Uptime: ${report.performance.uptime}%\n`;
        message += `• Avg Queue: ${report.performance.avgQueueSize}\n\n`;
        
        // Add summary
        const health = report.performance.uptime >= 99 ? '🟢 Excellent' :
                      report.performance.uptime >= 95 ? '🟡 Good' :
                      report.performance.uptime >= 90 ? '🟠 Fair' : '🔴 Poor';
        
        message += `📈 *Overall Health:* ${health}`;
        
        return message;
    }
    
    /**
     * Check if alert type is in cooldown
     */
    isInCooldown(type) {
        const lastAlert = this.alertCooldowns.get(type);
        if (!lastAlert) return false;
        
        const cooldownPeriod = this.config.cooldowns[type] || 300000; // Default 5 min
        const now = Date.now();
        
        return (now - lastAlert) < cooldownPeriod;
    }
    
    /**
     * Set cooldown for alert type
     */
    setCooldown(type) {
        this.alertCooldowns.set(type, Date.now());
    }
    
    /**
     * Check rate limit for alert level
     */
    isRateLimited(level) {
        const limit = this.config.rateLimits[level];
        if (!limit) return false;
        
        const now = Date.now();
        const key = `${level}_alerts`;
        
        if (!this.rateLimiter.has(key)) {
            this.rateLimiter.set(key, []);
        }
        
        const alerts = this.rateLimiter.get(key);
        
        // Clean old entries
        const validAlerts = alerts.filter(timestamp => 
            (now - timestamp) < limit.window
        );
        
        this.rateLimiter.set(key, validAlerts);
        
        return validAlerts.length >= limit.max;
    }
    
    /**
     * Update rate limit counter
     */
    updateRateLimit(level) {
        const key = `${level}_alerts`;
        
        if (!this.rateLimiter.has(key)) {
            this.rateLimiter.set(key, []);
        }
        
        this.rateLimiter.get(key).push(Date.now());
    }
    
    /**
     * Log alert to file
     */
    logAlert(alert, message) {
        try {
            const logEntry = {
                timestamp: alert.timestamp,
                level: alert.level,
                type: alert.type,
                details: alert.details,
                message: message.replace(/[*_`]/g, '') // Remove markdown
            };
            
            const logLine = JSON.stringify(logEntry) + '\n';
            
            fs.appendFileSync(this.alertLogPath, logLine);
        } catch (error) {
            console.error('[ALERT] Log write error:', error);
        }
    }
    
    /**
     * Add alert to history
     */
    addToHistory(alert) {
        this.alertHistory.push({
            ...alert,
            sentAt: Date.now()
        });
        
        // Trim if too large
        if (this.alertHistory.length > this.maxHistorySize) {
            this.alertHistory = this.alertHistory.slice(-this.maxHistorySize / 2);
        }
    }
    
    /**
     * Get alert statistics
     */
    getAlertStats() {
        const now = Date.now();
        const hour = 3600000;
        const day = 86400000;
        
        const recentAlerts = this.alertHistory.filter(a => 
            now - a.sentAt < day
        );
        
        const hourlyAlerts = recentAlerts.filter(a => 
            now - a.sentAt < hour
        );
        
        const byLevel = {};
        const byType = {};
        
        recentAlerts.forEach(alert => {
            // By level
            byLevel[alert.level] = (byLevel[alert.level] || 0) + 1;
            
            // By type
            byType[alert.type] = (byType[alert.type] || 0) + 1;
        });
        
        return {
            total: this.alertHistory.length,
            lastDay: recentAlerts.length,
            lastHour: hourlyAlerts.length,
            byLevel,
            byType,
            queueSize: this.alertQueue.length
        };
    }
    
    /**
     * Clear alert queue
     */
    clearQueue() {
        const cleared = this.alertQueue.length;
        this.alertQueue = [];
        console.log(`[ALERT] Cleared ${cleared} pending alerts`);
        return cleared;
    }
    
    /**
     * Test alert system
     */
    async testAlert() {
        console.log('[ALERT] Running test alert...');
        
        const testAlert = await this.sendAlert('info', 'TEST_ALERT', {
            message: 'This is a test alert',
            timestamp: new Date().toISOString()
        });
        
        return testAlert;
    }
}

module.exports = AlertSystem;
