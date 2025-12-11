const fs = require('fs');
const path = require('path');
const { logger } = require('./logger');

class MessageManager {
    constructor() {
        this.messages = {};
        this.templates = {};
        this.settings = {};
        this.configPath = path.join(__dirname, '../config/messages.json');
        this.loadMessages();
        this.watchConfigFile();
    }

    /**
     * Load messages from config file
     */
    loadMessages() {
        try {
            const configData = fs.readFileSync(this.configPath, 'utf8');
            const config = JSON.parse(configData);
            
            this.messages = config.messages || {};
            this.templates = config.templates || {};
            this.settings = config.settings || {};
            
            logger.info('Messages loaded successfully', {
                categories: Object.keys(this.messages).length,
                templates: Object.keys(this.templates).length
            });
        } catch (error) {
            logger.error('Failed to load messages', error);
            // Use default messages if file doesn't exist
            this.messages = {
                general: {
                    error: 'Terjadi kesalahan. Silakan coba lagi.',
                    success: 'Berhasil!',
                    processing: 'Sedang diproses...'
                }
            };
            this.templates = {};
            this.settings = {};
        }
    }

    /**
     * Reload messages dengan retry mechanism untuk handle file yang masih dalam proses write
     * @param {number} retries - Jumlah retry yang tersisa
     * @param {number} delay - Delay dalam milliseconds sebelum retry
     */
    reloadMessagesWithRetry(retries = 3, delay = 100) {
        setTimeout(() => {
            try {
                this.loadMessages();
                logger.info('✅ Messages reloaded successfully');
            } catch (error) {
                // Jika error dan masih ada retry, coba lagi
                if (retries > 0) {
                    logger.warn(`⚠️ Error reloading messages (retry ${4 - retries}/3):`, error.message);
                    this.reloadMessagesWithRetry(retries - 1, delay * 2); // Exponential backoff
                } else {
                    logger.error('❌ Error reloading messages after 3 retries:', error.message);
                }
            }
        }, delay);
    }

    /**
     * Watch config file for changes dengan improved reliability
     * PERBAIKAN: Tambahkan delay dan retry mechanism untuk memastikan file sudah selesai ditulis
     * sebelum reload, karena fs.watchFile() di Windows mungkin tidak reliable
     */
    watchConfigFile() {
        // Skip watching in test environment to prevent stuck processes
        if (process.env.NODE_ENV === 'test' || process.env.DISABLE_FILE_WATCHERS === 'true') {
            return;
        }

        if (!fs.existsSync(this.configPath)) {
            logger.warn('⚠️ Messages config file tidak ditemukan, file watcher tidak aktif.');
            return;
        }

        let lastMtime = fs.statSync(this.configPath).mtime.getTime();
        
        fs.watchFile(this.configPath, { interval: 1000 }, (curr, prev) => {
            // Check jika file benar-benar berubah (mtime berbeda)
            const currMtime = curr.mtime ? curr.mtime.getTime() : 0;
            const prevMtime = prev.mtime ? prev.mtime.getTime() : 0;
            
            if (currMtime !== prevMtime && currMtime !== lastMtime) {
                lastMtime = currMtime;
                logger.info('🔄 Messages config file changed, reloading...');
                this.reloadMessagesWithRetry(3, 200);
            }
        });
        
        logger.info('✅ File watcher untuk messages.json aktif.');
    }

    /**
     * Get message by path (e.g., "customer.notRegistered")
     */
    getMessage(path, variables = {}) {
        if (!path || typeof path !== 'string') {
            return null;
        }

        const parts = path.split('.');
        let message = this.messages;
        
        for (const part of parts) {
            if (message && typeof message === 'object' && part in message) {
                message = message[part];
            } else {
                logger.warn('Message not found', { path });
                return null;
            }
        }

        if (typeof message !== 'string') {
            return null;
        }

        // Replace variables in message
        return this.replaceVariables(message, variables);
    }

    /**
     * Get template by path
     */
    getTemplate(path, variables = {}) {
        if (!path || typeof path !== 'string') {
            return null;
        }

        const parts = path.split('.');
        let template = this.templates;
        
        for (const part of parts) {
            if (template && typeof template === 'object' && part in template) {
                template = template[part];
            } else {
                logger.warn('Template not found', { path });
                return null;
            }
        }

        if (typeof template !== 'string') {
            return null;
        }

        return this.replaceVariables(template, variables);
    }

    /**
     * Replace variables in text
     */
    replaceVariables(text, variables = {}) {
        if (!text || typeof text !== 'string') {
            return text;
        }

        let result = text;
        
        // Replace {variable} patterns
        for (const [key, value] of Object.entries(variables)) {
            const pattern = new RegExp(`\\{${key}\\}`, 'g');
            result = result.replace(pattern, value);
        }

        // Add global variables
        const globalVars = this.getGlobalVariables();
        for (const [key, value] of Object.entries(globalVars)) {
            const pattern = new RegExp(`\\{${key}\\}`, 'g');
            result = result.replace(pattern, value);
        }

        return result;
    }

    /**
     * Get global variables
     */
    getGlobalVariables() {
        const now = new Date();
        const config = global.config || {};
        
        return {
            botName: config.namabot || 'RAF Bot',
            companyName: config.nama || 'ISP Company',
            adminNumber: config.ownerNumber || '6285233047094',
            supportNumber: config.ownerNumber || '6285233047094',
            timestamp: this.formatTimestamp(now),
            date: this.formatDate(now),
            time: this.formatTime(now)
        };
    }

    /**
     * Format timestamp
     */
    formatTimestamp(date) {
        const dateFormat = this.settings.dateFormat || 'DD/MM/YYYY';
        const timeFormat = this.settings.timeFormat || 'HH:mm';
        
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        
        let formatted = `${dateFormat} ${timeFormat}`;
        formatted = formatted.replace('DD', day);
        formatted = formatted.replace('MM', month);
        formatted = formatted.replace('YYYY', year);
        formatted = formatted.replace('HH', hours);
        formatted = formatted.replace('mm', minutes);
        
        return formatted;
    }

    /**
     * Format date
     */
    formatDate(date) {
        const dateFormat = this.settings.dateFormat || 'DD/MM/YYYY';
        
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        
        let formatted = dateFormat;
        formatted = formatted.replace('DD', day);
        formatted = formatted.replace('MM', month);
        formatted = formatted.replace('YYYY', year);
        
        return formatted;
    }

    /**
     * Format time
     */
    formatTime(date) {
        const timeFormat = this.settings.timeFormat || 'HH:mm';
        
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');
        
        let formatted = timeFormat;
        formatted = formatted.replace('HH', hours);
        formatted = formatted.replace('mm', minutes);
        formatted = formatted.replace('ss', seconds);
        
        return formatted;
    }

    /**
     * Format currency
     */
    formatCurrency(amount) {
        const format = this.settings.currencyFormat || 'Rp {amount}';
        
        // Format number with thousand separator
        const formatted = new Intl.NumberFormat('id-ID').format(amount);
        
        return format.replace('{amount}', formatted);
    }

    /**
     * Build menu from items
     */
    buildMenu(items, type = 'main') {
        const template = this.getTemplate(`menu.${type}`) || this.getTemplate('menu.main');
        if (!template) {
            return items.join('\n');
        }

        const menuItems = items.map((item, index) => {
            if (typeof item === 'string') {
                return `${index + 1}. ${item}`;
            } else if (typeof item === 'object') {
                const emoji = item.emoji || (index + 1) + '.';
                const text = item.text || item.description || '';
                const command = item.command ? ` (${item.command})` : '';
                return `${emoji} ${text}${command}`;
            }
            return '';
        }).filter(Boolean).join('\n');

        return this.replaceVariables(template, { menuItems });
    }

    /**
     * Add footer to message
     */
    addFooter(message, type = 'default') {
        const footer = this.getTemplate(`footer.${type}`) || this.getTemplate('footer.default');
        if (!footer) {
            return message;
        }
        
        return message + footer;
    }

    /**
     * Get message category
     */
    getCategory(category) {
        return this.messages[category] || {};
    }

    /**
     * Get all messages in a category
     */
    getMessagesInCategory(category) {
        const categoryMessages = this.messages[category];
        if (!categoryMessages || typeof categoryMessages !== 'object') {
            return [];
        }

        const messages = [];
        for (const [key, value] of Object.entries(categoryMessages)) {
            if (typeof value === 'string') {
                messages.push({
                    key,
                    path: `${category}.${key}`,
                    message: value
                });
            }
        }
        return messages;
    }

    /**
     * Update message (for runtime modifications)
     */
    updateMessage(path, message) {
        const parts = path.split('.');
        let target = this.messages;
        
        for (let i = 0; i < parts.length - 1; i++) {
            const part = parts[i];
            if (!target[part] || typeof target[part] !== 'object') {
                target[part] = {};
            }
            target = target[part];
        }
        
        const lastPart = parts[parts.length - 1];
        target[lastPart] = message;
        
        logger.debug('Message updated', { path });
    }

    /**
     * Update template
     */
    updateTemplate(path, template) {
        const parts = path.split('.');
        let target = this.templates;
        
        for (let i = 0; i < parts.length - 1; i++) {
            const part = parts[i];
            if (!target[part] || typeof target[part] !== 'object') {
                target[part] = {};
            }
            target = target[part];
        }
        
        const lastPart = parts[parts.length - 1];
        target[lastPart] = template;
        
        logger.debug('Template updated', { path });
    }

    /**
     * Save messages to config file
     */
    saveMessages() {
        try {
            const config = {
                messages: this.messages,
                templates: this.templates,
                settings: this.settings
            };
            
            fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2), 'utf8');
            logger.info('Messages saved to config file');
            return true;
        } catch (error) {
            logger.error('Failed to save messages', error);
            return false;
        }
    }

    /**
     * Get settings
     */
    getSettings() {
        return this.settings;
    }

    /**
     * Update settings
     */
    updateSettings(settings) {
        this.settings = { ...this.settings, ...settings };
    }

    /**
     * Check if emoji is enabled
     */
    isEmojiEnabled() {
        return this.settings.enableEmoji !== false;
    }

    /**
     * Check if formatting is enabled
     */
    isFormattingEnabled() {
        return this.settings.enableFormatting !== false;
    }

    /**
     * Get max message length
     */
    getMaxMessageLength() {
        return this.settings.maxMessageLength || 4096;
    }

    /**
     * Truncate message if too long
     */
    truncateMessage(message, suffix = '...') {
        const maxLength = this.getMaxMessageLength();
        if (!message || message.length <= maxLength) {
            return message;
        }
        
        const truncateLength = maxLength - suffix.length;
        return message.substring(0, truncateLength) + suffix;
    }
}

// Create singleton instance
const messageManager = new MessageManager();

module.exports = messageManager;
