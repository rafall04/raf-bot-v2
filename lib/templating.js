const fs = require('fs');
const path = require('path');
const convertRupiah = require('rupiah-format');

/**
 * Format bank accounts from config to readable string
 * @returns {string|null} Formatted bank accounts or null if none
 */
function formatBankAccounts() {
    if (!global.config?.bankAccounts || global.config.bankAccounts.length === 0) {
        return null;
    }
    
    let formatted = '';
    global.config.bankAccounts.forEach((account, index) => {
        if (account.bank && account.number) {
            // Format with line breaks for better readability:
            // " BANK:"
            // "NUMBER"
            // "a.n NAME"
            formatted += ` ${account.bank}:\n`;
            formatted += `${account.number}\n`;
            if (account.name) {
                formatted += `a.n ${account.name}`;
            }
            // Add extra line break between accounts if there are multiple
            if (index < global.config.bankAccounts.length - 1) {
                formatted += '\n\n';
            }
        }
    });
    
    return formatted || null;
}

// Define paths
const notificationTemplatesPath = path.join(__dirname, '../database/message_templates.json');
const wifiMenuTemplatesPath = path.join(__dirname, '../database/wifi_menu_templates.json');
const responseTemplatesPath = path.join(__dirname, '../database/response_templates.json');
const commandTemplatesPath = path.join(__dirname, '../database/command_templates.json');
const errorTemplatesPath = path.join(__dirname, '../database/error_templates.json');
const successTemplatesPath = path.join(__dirname, '../database/success_templates.json');
const systemTemplatesPath = path.join(__dirname, '../database/system_messages.json');
const menuTemplatesPath = path.join(__dirname, '../database/menu_templates.json');
const reportTemplatesPath = path.join(__dirname, '../database/report_templates.json');

// Centralized cache for all templates
let templatesCache = {
    notificationTemplates: {},
    wifiMenuTemplates: {},
    responseTemplates: {},
    commandTemplates: {},
    errorTemplates: {},
    successTemplates: {},
    systemTemplates: {},
    menuTemplates: {},
    reportTemplates: {}
};

// Generic function to load a JSON file into the cache
function loadJson(filePath) {
    try {
        if (fs.existsSync(filePath)) {
            const fileData = fs.readFileSync(filePath, 'utf8');
            return JSON.parse(fileData);
        }
        console.warn(`[Templating] Warning: File not found at ${filePath}. Returning empty object.`);
        return {};
    } catch (error) {
        console.error(`[Templating] Error loading or parsing ${path.basename(filePath)}:`, error);
        return {}; // Return empty object on failure
    }
}

// Initial load for all templates
templatesCache.notificationTemplates = loadJson(notificationTemplatesPath);
templatesCache.wifiMenuTemplates = loadJson(wifiMenuTemplatesPath);
templatesCache.responseTemplates = loadJson(responseTemplatesPath);
templatesCache.commandTemplates = loadJson(commandTemplatesPath);
templatesCache.errorTemplates = loadJson(errorTemplatesPath);
templatesCache.successTemplates = loadJson(successTemplatesPath);
templatesCache.systemTemplates = loadJson(systemTemplatesPath);
templatesCache.menuTemplates = loadJson(menuTemplatesPath);
templatesCache.reportTemplates = loadJson(reportTemplatesPath);
console.log('[Templating] Initial load complete for all templates.');

// Watch for changes and reload the specific template file
// Skip watching in test environment to prevent stuck processes
if (process.env.NODE_ENV !== 'test' && process.env.DISABLE_FILE_WATCHERS !== 'true') {
    fs.watchFile(notificationTemplatesPath, (curr, prev) => {
        console.log('[Templating] message_templates.json file changed, reloading.');
        templatesCache.notificationTemplates = loadJson(notificationTemplatesPath);
    });

    fs.watchFile(wifiMenuTemplatesPath, (curr, prev) => {
        console.log('[Templating] wifi_menu_templates.json file changed, reloading.');
        templatesCache.wifiMenuTemplates = loadJson(wifiMenuTemplatesPath);
    });

    fs.watchFile(responseTemplatesPath, (curr, prev) => {
        console.log('[Templating] response_templates.json file changed, reloading.');
        templatesCache.responseTemplates = loadJson(responseTemplatesPath);
    });

    fs.watchFile(commandTemplatesPath, (curr, prev) => {
        console.log('[Templating] command_templates.json file changed, reloading.');
        templatesCache.commandTemplates = loadJson(commandTemplatesPath);
    });

    fs.watchFile(errorTemplatesPath, (curr, prev) => {
        console.log('[Templating] error_templates.json file changed, reloading.');
        templatesCache.errorTemplates = loadJson(errorTemplatesPath);
    });

    fs.watchFile(successTemplatesPath, (curr, prev) => {
        console.log('[Templating] success_templates.json file changed, reloading.');
        templatesCache.successTemplates = loadJson(successTemplatesPath);
    });

    fs.watchFile(systemTemplatesPath, (curr, prev) => {
        console.log('[Templating] system_messages.json file changed, reloading.');
        templatesCache.systemTemplates = loadJson(systemTemplatesPath);
    });

    fs.watchFile(menuTemplatesPath, (curr, prev) => {
        console.log('[Templating] menu_templates.json file changed, reloading.');
        templatesCache.menuTemplates = loadJson(menuTemplatesPath);
    });

    fs.watchFile(reportTemplatesPath, (curr, prev) => {
        console.log('[Templating] report_templates.json file changed, reloading.');
        templatesCache.reportTemplates = loadJson(reportTemplatesPath);
    });
}

/**
 * Renders a message by replacing placeholders in a template.
 * This function is specifically for notification templates which have a complex structure and data injection.
 * @param {string} templateName - The key of the template in message_templates.json (e.g., 'unpaid_reminder').
 * @param {object} data - An object containing the data to replace placeholders.
 * @returns {string} The rendered message.
 */
function renderTemplate(templateName, data) {
    const templateContent = templatesCache.notificationTemplates[templateName]?.template;

    if (!templateContent) {
        console.warn(`[Templating] Warning: Template "${templateName}" not found in notification templates.`);
        return `Error: Template "${templateName}" not found. Please check message_templates.json.`;
    }

    // Combine user-provided data with global config data
    const fullData = {
        // Default values
        nama: '',
        paket: '',
        jatuh_tempo: 'N/A',
        periode: 'bulan ini',
        rekening: formatBankAccounts() || global.config.rekening_details || 'Informasi rekening belum diatur. Silakan hubungi Admin.',
        nama_wifi: global.config.nama || 'Layanan WiFi Kami',
        nama_bot: global.config.namabot || 'Bot Asisten',
        telfon: global.config.telfon || 'N/A',

        ...data, // User-provided data overrides the defaults

        // Finally, apply special formatting. This will override any 'harga' from data.
        harga: data.harga ? convertRupiah.convert(data.harga) : '',
    };

    // Replace all instances of ${key} with the value from fullData
    // Updated regex to support all characters except } (was: \w+ which only matched alphanumeric+underscore)
    let rendered = templateContent.replace(/\$\{([^}]+)\}/g, (placeholder, key) => {
        // Return the value from fullData if it exists, otherwise return the original placeholder
        return fullData.hasOwnProperty(key) ? fullData[key] : placeholder;
    });

    // Log warning for any unmatched placeholders (helps debugging)
    const unmatched = rendered.match(/\$\{[^}]+\}/g);
    if (unmatched && unmatched.length > 0) {
        console.warn(`[Templating] Warning: Template "${templateName}" has unmatched placeholders:`, unmatched);
        console.warn(`[Templating] Available data keys:`, Object.keys(fullData));
    }

    return rendered;
}

/**
 * Renders a system message template
 * @param {string} templateName - The key of the template in system_messages.json
 * @param {object} data - Data to replace placeholders
 * @returns {string} The rendered message
 */
function renderSystemMessage(templateName, data = {}) {
    const template = templatesCache.systemTemplates[templateName];
    
    if (!template) {
        console.error(`[Templating] System template "${templateName}" not found`);
        return `System template "${templateName}" not found`;
    }
    
    // Add global data
    const fullData = {
        ...data,
        nama_wifi: global.config?.namaWifi || 'WiFi Service',
        nama_bot: global.config?.botName || 'Bot',
        telfon: global.config?.phoneSupport || ''
    };
    
    // Replace placeholders
    let rendered = template.template.replace(/\$\{([^}]+)\}/g, (placeholder, key) => {
        return fullData.hasOwnProperty(key) ? fullData[key] : placeholder;
    });
    
    return rendered;
}

/**
 * Helper function for error messages
 */
function errorMessage(type, data = {}) {
    return renderSystemMessage(`error_${type}`, data);
}

/**
 * Helper function for success messages
 */
function successMessage(type, data = {}) {
    return renderSystemMessage(`success_${type}`, data);
}

/**
 * Helper function for prompt messages
 */
function promptMessage(type, data = {}) {
    return renderSystemMessage(`prompt_${type}`, data);
}

/**
 * Helper function for info messages
 */
function infoMessage(type, data = {}) {
    return renderSystemMessage(`info_${type}`, data);
}

/**
 * Helper function for validation messages
 */
function validationMessage(type, data = {}) {
    return renderSystemMessage(`validation_${type}`, data);
}

/**
 * Helper function for greeting messages based on time
 */
function greetingMessage(name) {
    const hour = new Date().getHours();
    let type = 'morning';
    
    if (hour >= 5 && hour < 11) type = 'morning';
    else if (hour >= 11 && hour < 15) type = 'afternoon';
    else if (hour >= 15 && hour < 18) type = 'evening';
    else type = 'night';
    
    return renderSystemMessage(`greeting_${type}`, { nama: name });
}

/**
 * Renders a report template
 * @param {string} reportType - The type of report message (e.g., 'start_mati', 'troubleshoot_restart')
 * @param {object} data - Data to replace placeholders
 * @returns {string} The rendered report message
 */
function renderReport(reportType, data = {}) {
    const templateName = `report_${reportType}`;
    const template = templatesCache.reportTemplates[templateName];
    
    if (!template) {
        console.error(`[Templating] Report template "${templateName}" not found`);
        return `Report template "${templateName}" not found`;
    }
    
    // Add global data
    const fullData = {
        ...data,
        nama_wifi: global.config?.namaWifi || 'WiFi Service',
        nama_bot: global.config?.botName || 'Bot',
        telfon: global.config?.phoneSupport || '',
        admin_contact: global.config?.ownerNumber?.[0] || ''
    };
    
    // Replace placeholders
    let rendered = template.template.replace(/\$\{([^}]+)\}/g, (placeholder, key) => {
        return fullData.hasOwnProperty(key) ? fullData[key] : placeholder;
    });
    
    return rendered;
}

/**
 * Renders a menu template
 * @param {string} menuType - The type of menu (e.g., 'main_customer', 'wifi', 'payment')
 * @param {object} data - Data to replace placeholders
 * @returns {string} The rendered menu
 */
function renderMenu(menuType, data = {}) {
    const templateName = `menu_${menuType}`;
    const template = templatesCache.menuTemplates[templateName];
    
    if (!template) {
        console.error(`[Templating] Menu template "${templateName}" not found`);
        return `Menu template "${templateName}" not found`;
    }
    
    // Add global data and default icons
    const fullData = {
        // Default icons
        icon_tagihan: '💰',
        icon_saldo: '💳',
        icon_lapor: '📢',
        icon_tiket: '🎟️',
        icon_wifi: '📶',
        icon_nama: '✏️',
        icon_password: '🔐',
        icon_history: '📜',
        icon_speed: '🚀',
        icon_admin: '👨‍💼',
        icon_help: '❓',
        icon_info: 'ℹ️',
        icon_list: '📋',
        icon_add: '➕',
        icon_edit: '✏️',
        icon_delete: '🗑️',
        icon_isolir: '🔌',
        icon_payment: '💵',
        icon_report: '📊',
        icon_assign: '👤',
        icon_close: '❌',
        icon_broadcast: '📢',
        icon_config: '⚙️',
        icon_backup: '💾',
        icon_log: '📝',
        icon_restart: '🔄',
        icon_process: '⚡',
        icon_otw: '🚗',
        icon_arrive: '📍',
        icon_working: '🔧',
        icon_complete: '✅',
        icon_reboot: '🔄',
        icon_power: '🔋',
        icon_redaman: '📡',
        icon_stats: '📈',
        ...data,
        nama_wifi: global.config?.namaWifi || 'WiFi Service',
        nama_bot: global.config?.botName || 'Bot',
        telfon: global.config?.phoneSupport || ''
    };
    
    // Replace placeholders
    let rendered = template.template.replace(/\$\{([^}]+)\}/g, (placeholder, key) => {
        return fullData.hasOwnProperty(key) ? fullData[key] : placeholder;
    });
    
    return rendered;
}

module.exports = {
    renderTemplate,
    renderSystemMessage,
    renderMenu,
    renderReport,
    errorMessage,
    successMessage,
    promptMessage,
    infoMessage,
    validationMessage,
    greetingMessage,
    templatesCache
}; // Export the whole cache
