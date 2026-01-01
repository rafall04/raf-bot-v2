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
        // File not found - return empty object silently
        return {};
    } catch (error) {
        console.error(`[Templating] Error: ${path.basename(filePath)}`, error.message);
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
// Template loaded silently

/**
 * Reload template file dengan retry mechanism untuk handle file yang masih dalam proses write
 * @param {string} filePath - Path ke file yang akan di-reload
 * @param {string} cacheKey - Key di templatesCache (untuk logging)
 * @param {number} retries - Jumlah retry yang tersisa
 * @param {number} delay - Delay dalam milliseconds sebelum retry
 */
function reloadTemplateWithRetry(filePath, cacheKey, retries = 3, delay = 100) {
    setTimeout(() => {
        try {
            const data = loadJson(filePath);
            templatesCache[cacheKey] = data;
            const fileName = path.basename(filePath);
            // Only log on successful reload, no verbose logging
        } catch (error) {
            // Jika error dan masih ada retry, coba lagi
            if (retries > 0) {
                const fileName = path.basename(filePath);
                console.warn(`[Templating] ⚠️ Error reloading ${fileName} (retry ${4 - retries}/3):`, error.message);
                reloadTemplateWithRetry(filePath, cacheKey, retries - 1, delay * 2); // Exponential backoff
            } else {
                const fileName = path.basename(filePath);
                console.error(`[Templating] ❌ Error reloading ${fileName} after 3 retries:`, error.message);
            }
        }
    }, delay);
}

/**
 * Setup file watcher untuk template file dengan improved reliability
 * @param {string} filePath - Path ke file yang akan di-watch
 * @param {string} cacheKey - Key di templatesCache
 * @param {string} displayName - Nama untuk logging
 */
// Track watchers for summary log
let templateWatchersCount = 0;
let templateWatchersList = [];

function setupTemplateWatcher(filePath, cacheKey, displayName) {
    if (!fs.existsSync(filePath)) {
        return false; // Return false if file not found
    }

    let lastMtime = fs.statSync(filePath).mtime.getTime();
    
    fs.watchFile(filePath, { interval: 1000 }, (curr, prev) => {
        // Check jika file benar-benar berubah (mtime berbeda)
        const currMtime = curr.mtime ? curr.mtime.getTime() : 0;
        const prevMtime = prev.mtime ? prev.mtime.getTime() : 0;
        
        if (currMtime !== prevMtime && currMtime !== lastMtime) {
            lastMtime = currMtime;
            console.log(`[Templating] 🔄 ${displayName} changed`);
            reloadTemplateWithRetry(filePath, cacheKey, 3, 200);
        }
    });
    
    templateWatchersCount++;
    templateWatchersList.push(displayName);
    return true; // Return true if watcher set up successfully
}

// Watch for changes and reload the specific template file
// Skip watching in test environment to prevent stuck processes
if (process.env.NODE_ENV !== 'test' && process.env.DISABLE_FILE_WATCHERS !== 'true') {
    setupTemplateWatcher(notificationTemplatesPath, 'notificationTemplates', 'message_templates.json');
    setupTemplateWatcher(wifiMenuTemplatesPath, 'wifiMenuTemplates', 'wifi_menu_templates.json');
    setupTemplateWatcher(responseTemplatesPath, 'responseTemplates', 'response_templates.json');
    setupTemplateWatcher(commandTemplatesPath, 'commandTemplates', 'command_templates.json');
    setupTemplateWatcher(errorTemplatesPath, 'errorTemplates', 'error_templates.json');
    setupTemplateWatcher(successTemplatesPath, 'successTemplates', 'success_templates.json');
    setupTemplateWatcher(systemTemplatesPath, 'systemTemplates', 'system_messages.json');
    setupTemplateWatcher(menuTemplatesPath, 'menuTemplates', 'menu_templates.json');
    setupTemplateWatcher(reportTemplatesPath, 'reportTemplates', 'report_templates.json');
    
    // Log summary instead of individual logs
    console.log(`[Templating] ✅ ${templateWatchersCount} template watchers aktif`);
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

    // Generate admin contact info from config
    // PENTING: Gunakan adminPhone dari config (bukan ownerNumber)
    const adminPhoneNumber = global.config?.adminPhone || global.config?.telfon || '089685645956';
    const adminPhoneClean = adminPhoneNumber.replace(/\D/g, ''); // Remove non-digits
    const adminWaLink = adminPhoneClean 
        ? `https://wa.me/${adminPhoneClean.startsWith('62') ? adminPhoneClean : adminPhoneClean.startsWith('0') ? '62' + adminPhoneClean.substring(1) : '62' + adminPhoneClean}` 
        : 'https://wa.me/6289685645956'; // Fallback ke nomor admin default
    const nomor_admin = adminPhoneNumber || '089685645956'; // Format asli untuk display

    // Combine user-provided data with global config data
    const fullData = {
        // Default values
        nama: '',
        nama_pelanggan: '', // Add default for nama_pelanggan
        paket: '',
        jatuh_tempo: 'N/A',
        periode: 'bulan ini',
        rekening: formatBankAccounts() || global.config.rekening_details || 'Informasi rekening belum diatur. Silakan hubungi Admin.',
        nama_wifi: global.config.nama || 'Layanan WiFi Kami',
        nama_bot: global.config.namabot || 'Bot Asisten',
        telfon: global.config.telfon || 'N/A',
        // PENTING: Tambahkan placeholder untuk nomor admin dan link WhatsApp admin
        adminWaLink: adminWaLink,
        nomor_admin: nomor_admin,

        ...data, // User-provided data overrides the defaults

        // Alias support: Map 'nama' to 'nama_pelanggan' if nama_pelanggan is not provided
        // This ensures backward compatibility while supporting the correct placeholder
        nama_pelanggan: data.nama_pelanggan !== undefined ? data.nama_pelanggan : (data.nama !== undefined ? data.nama : ''),
    };

    // Finally, apply special formatting. This will override any 'harga' from data.
    // PENTING: Hanya format jika belum berupa string yang sudah diformat (tidak mengandung "Rp")
    if (data.harga !== undefined && data.harga !== null && data.harga !== '') {
        // Jika sudah berupa string yang mengandung "Rp", gunakan langsung
        // Jika berupa angka atau string angka, format dengan convertRupiah
        if (typeof data.harga === 'string' && data.harga.includes('Rp')) {
            fullData.harga = data.harga; // Sudah diformat, gunakan langsung
        } else {
            // Angka mentah, format dengan convertRupiah
            fullData.harga = convertRupiah.convert(data.harga);
        }
    } else {
        fullData.harga = '';
    }
    
    // Format formattedSaldo juga jika ada
    if (data.formattedSaldo !== undefined && data.formattedSaldo !== null && data.formattedSaldo !== '') {
        if (typeof data.formattedSaldo === 'string' && data.formattedSaldo.includes('Rp')) {
            fullData.formattedSaldo = data.formattedSaldo; // Sudah diformat, gunakan langsung
        } else {
            fullData.formattedSaldo = convertRupiah.convert(data.formattedSaldo);
        }
    } else {
        fullData.formattedSaldo = '';
    }

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
    
    // Generate admin contact info from config
    const adminPhoneNumber = global.config?.adminPhone || global.config?.telfon || '089685645956';
    const adminPhoneClean = adminPhoneNumber.replace(/\D/g, '');
    const adminWaLink = adminPhoneClean 
        ? `https://wa.me/${adminPhoneClean.startsWith('62') ? adminPhoneClean : adminPhoneClean.startsWith('0') ? '62' + adminPhoneClean.substring(1) : '62' + adminPhoneClean}` 
        : 'https://wa.me/6289685645956';
    const nomor_admin = adminPhoneNumber || '089685645956';

    // Add global data
    const fullData = {
        ...data,
        nama_wifi: global.config?.namaWifi || 'WiFi Service',
        nama_bot: global.config?.botName || 'Bot',
        telfon: global.config?.phoneSupport || '',
        admin_contact: global.config?.adminPhone || global.config?.ownerNumber?.[0] || '',
        adminWaLink: adminWaLink, // PENTING: Tambahkan adminWaLink untuk template
        nomor_admin: nomor_admin // PENTING: Tambahkan nomor_admin untuk template
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
        telfon: global.config?.phoneSupport || '',
        // Generate admin contact info from config
        adminWaLink: (() => {
            const adminPhoneNumber = global.config?.adminPhone || global.config?.telfon || '089685645956';
            const adminPhoneClean = adminPhoneNumber.replace(/\D/g, '');
            return adminPhoneClean 
                ? `https://wa.me/${adminPhoneClean.startsWith('62') ? adminPhoneClean : adminPhoneClean.startsWith('0') ? '62' + adminPhoneClean.substring(1) : '62' + adminPhoneClean}` 
                : 'https://wa.me/6289685645956';
        })(),
        nomor_admin: global.config?.adminPhone || global.config?.telfon || '089685645956'
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
