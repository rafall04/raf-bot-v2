const messageManager = require('./message-manager');
const { logger } = require('./logger');

/**
 * Message Helper
 * Wrapper functions untuk memudahkan penggunaan message manager
 */

class MessageHelper {
    /**
     * Get customer message
     */
    static getCustomerMessage(key, variables = {}) {
        return messageManager.getMessage(`customer.${key}`, variables);
    }

    /**
     * Get WiFi message
     */
    static getWifiMessage(key, variables = {}) {
        return messageManager.getMessage(`wifi.${key}`, variables);
    }

    /**
     * Get ticket message
     */
    static getTicketMessage(key, variables = {}) {
        return messageManager.getMessage(`ticket.${key}`, variables);
    }

    /**
     * Get payment message
     */
    static getPaymentMessage(key, variables = {}) {
        return messageManager.getMessage(`payment.${key}`, variables);
    }

    /**
     * Get speed message
     */
    static getSpeedMessage(key, variables = {}) {
        return messageManager.getMessage(`speed.${key}`, variables);
    }

    /**
     * Get admin message
     */
    static getAdminMessage(key, variables = {}) {
        return messageManager.getMessage(`admin.${key}`, variables);
    }

    /**
     * Get teknisi message
     */
    static getTeknisiMessage(key, variables = {}) {
        return messageManager.getMessage(`teknisi.${key}`, variables);
    }

    /**
     * Get notification message
     */
    static getNotificationMessage(key, variables = {}) {
        return messageManager.getMessage(`notification.${key}`, variables);
    }

    /**
     * Get general message
     */
    static getGeneralMessage(key, variables = {}) {
        return messageManager.getMessage(`general.${key}`, variables);
    }

    /**
     * Get error message
     */
    static getErrorMessage(variables = {}) {
        return messageManager.getMessage('general.error', variables);
    }

    /**
     * Get success message
     */
    static getSuccessMessage(variables = {}) {
        return messageManager.getMessage('general.success', variables);
    }

    /**
     * Get processing message
     */
    static getProcessingMessage(variables = {}) {
        return messageManager.getMessage('general.processing', variables);
    }

    /**
     * Build menu
     */
    static buildMenu(items, type = 'main', variables = {}) {
        return messageManager.buildMenu(items, type, variables);
    }

    /**
     * Format currency
     */
    static formatCurrency(amount) {
        return messageManager.formatCurrency(amount);
    }

    /**
     * Format date
     */
    static formatDate(date) {
        return messageManager.formatDate(date);
    }

    /**
     * Format time
     */
    static formatTime(date) {
        return messageManager.formatTime(date);
    }

    /**
     * Add footer to message
     */
    static addFooter(message, type = 'default') {
        return messageManager.addFooter(message, type);
    }

    /**
     * Truncate message if too long
     */
    static truncateMessage(message, suffix = '...') {
        return messageManager.truncateMessage(message, suffix);
    }

    /**
     * Get message with footer
     */
    static getMessageWithFooter(path, variables = {}, footerType = 'default') {
        const message = messageManager.getMessage(path, variables);
        if (!message) return null;
        return messageManager.addFooter(message, footerType);
    }

    /**
     * Get formatted bill info
     */
    static getBillInfo(user) {
        return this.getCustomerMessage('billInfo', {
            name: user.name,
            package: user.subscription || user.package,
            amount: this.formatCurrency(user.bill_amount || 0),
            dueDate: this.formatDate(new Date(user.due_date || Date.now())),
            status: user.paid ? 'Lunas' : 'Belum Lunas'
        });
    }

    /**
     * Get formatted package info
     */
    static getPackageInfo(user, packageData) {
        return this.getCustomerMessage('packageInfo', {
            name: user.name,
            package: packageData.name,
            speed: packageData.profile || packageData.speed,
            price: this.formatCurrency(packageData.price)
        });
    }

    /**
     * Get formatted WiFi info
     */
    static getWifiInfo(wifiData) {
        return this.getWifiMessage('infoSuccess', {
            ssid: wifiData.ssid || wifiData.name,
            password: wifiData.password,
            status: wifiData.status || 'Aktif'
        });
    }

    /**
     * Get formatted ticket info
     */
    static getTicketInfo(ticket) {
        return this.getTicketMessage('statusInfo', {
            ticketId: ticket.id,
            status: ticket.status,
            reporter: ticket.reporter_name,
            technician: ticket.technician_name || 'Belum ditugaskan',
            complaint: ticket.complaint,
            date: this.formatDate(new Date(ticket.created_at)),
            lastUpdate: ticket.updated_at ? this.formatDate(new Date(ticket.updated_at)) : 'Belum ada update'
        });
    }

    /**
     * Get formatted speed boost info
     */
    static getSpeedBoostInfo(speedBoost) {
        return this.getSpeedMessage('boostActive', {
            package: speedBoost.package_name,
            speed: speedBoost.speed,
            duration: speedBoost.duration,
            endDate: this.formatDate(new Date(speedBoost.end_date))
        });
    }

    /**
     * Get no permission message
     */
    static getNoPermissionMessage() {
        return this.getGeneralMessage('noPermission');
    }

    /**
     * Get unknown command message
     */
    static getUnknownCommandMessage() {
        return this.getGeneralMessage('unknownCommand');
    }

    /**
     * Get maintenance message
     */
    static getMaintenanceMessage() {
        return this.getGeneralMessage('maintenance');
    }

    /**
     * Get timeout message
     */
    static getTimeoutMessage() {
        return this.getGeneralMessage('timeout');
    }

    /**
     * Get invalid input message
     */
    static getInvalidInputMessage() {
        return this.getGeneralMessage('invalidInput');
    }

    /**
     * Get cancelled message
     */
    static getCancelledMessage() {
        return this.getGeneralMessage('cancelled');
    }

    /**
     * Get group only message
     */
    static getGroupOnlyMessage() {
        return this.getGeneralMessage('groupOnly');
    }

    /**
     * Get private only message
     */
    static getPrivateOnlyMessage() {
        return this.getGeneralMessage('privateOnly');
    }
}

module.exports = MessageHelper;
