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

// Centralized cache for all templates
let templatesCache = {
    notificationTemplates: {},
    wifiMenuTemplates: {},
    responseTemplates: {},
    commandTemplates: {},
    errorTemplates: {},
    successTemplates: {}
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

module.exports = {
    renderTemplate,
    templatesCache // Export the whole cache
};
