/**
 * Template Manager
 * Centralized template management system for all bot messages
 * 
 * Features:
 * - Load templates from multiple JSON files
 * - Dynamic placeholder replacement
 * - Fallback to hardcoded messages
 * - Real-time template reloading
 * - Template caching for performance
 */

const fs = require('fs');
const path = require('path');

class TemplateManager {
    constructor() {
        this.templates = {};
        this.templateFiles = [
            'message_templates.json',
            'wifi_menu_templates.json', 
            'wifi_templates.json',
            'response_templates.json',
            'command_templates.json',    // Basic commands
            'error_templates.json',       // Error messages
            'success_templates.json'      // Success messages
        ];
        this.loadAllTemplates();
    }
    
    /**
     * Load all template files from database directory
     */
    loadAllTemplates() {
        let totalLoaded = 0;
        const loadedFiles = [];
        
        this.templateFiles.forEach(file => {
            const filePath = path.join(__dirname, '..', 'database', file);
            if (fs.existsSync(filePath)) {
                try {
                    const content = fs.readFileSync(filePath, 'utf8');
                    const templates = JSON.parse(content);
                    Object.assign(this.templates, templates);
                    const count = Object.keys(templates).length;
                    totalLoaded += count;
                    loadedFiles.push(`${file} (${count})`);
                } catch (error) {
                    console.error(`[TemplateManager] Error loading ${file}:`, error.message);
                }
            }
        });
        
        // Single summary log
        console.log(`[TemplateManager] ✅ Loaded ${totalLoaded} templates from ${loadedFiles.length} files`);
    }
    
    /**
     * Reload templates (useful for real-time updates)
     */
    reloadTemplates() {
        this.templates = {};
        this.loadAllTemplates();
    }
    
    /**
     * Get a template by key and render with data
     * @param {string} key - Template key
     * @param {object} data - Data for placeholder replacement
     * @param {string} fallback - Fallback message if template not found
     */
    getTemplate(key, data = {}, fallback = null) {
        const template = this.templates[key];
        
        if (!template) {
            console.warn(`[TemplateManager] Template '${key}' not found`);
            return fallback || `Template '${key}' not found. Please check template configuration.`;
        }
        
        // Extract template string (could be object with 'template' property or direct string)
        const templateString = template.template || template;
        
        return this.renderTemplate(templateString, data);
    }
    
    /**
     * Check if template exists
     * @param {string} key - Template key to check
     */
    hasTemplate(key) {
        return !!this.templates[key];
    }
    
    /**
     * Render template with data
     * @param {string} template - Template string
     * @param {object} data - Data for replacement
     */
    renderTemplate(template, data) {
        // Add global/default data
        const fullData = {
            // Global config data
            nama_wifi: global.config?.nama || 'Layanan WiFi',
            nama_bot: global.config?.namabot || 'Bot Asisten',
            nama_layanan: global.config?.nama || 'Layanan Kami',
            admin_number: global.config?.ownerNumber || '',
            
            // Dynamic data
            timestamp: new Date().toLocaleString('id-ID'),
            tanggal: new Date().toLocaleDateString('id-ID'),
            waktu: new Date().toLocaleTimeString('id-ID'),
            
            // User provided data (overrides defaults)
            ...data,
            
            // Computed values based on time
            greeting: this.getGreeting()
        };
        
        // Replace all placeholders ${key} with values
        let rendered = template.replace(/\$\{([^}]+)\}/g, (match, key) => {
            // Handle nested properties (e.g., ${user.name})
            const keys = key.split('.');
            let value = fullData;
            
            for (const k of keys) {
                value = value?.[k];
                if (value === undefined) break;
            }
            
            // Return value or original placeholder if not found
            return value !== undefined ? value : match;
        });
        
        // Log unmatched placeholders for debugging
        const unmatched = rendered.match(/\$\{[^}]+\}/g);
        if (unmatched && unmatched.length > 0) {
            console.warn(`[TemplateManager] Unmatched placeholders in '${template.substring(0, 50)}...':`, unmatched);
        }
        
        return rendered;
    }
    
    /**
     * Get greeting based on time
     */
    getGreeting() {
        const hour = new Date().getHours();
        if (hour >= 0 && hour < 12) return "Selamat pagi";
        if (hour >= 12 && hour < 15) return "Selamat siang";
        if (hour >= 15 && hour < 18) return "Selamat sore";
        return "Selamat malam";
    }
    
    /**
     * Get all template keys (for documentation/UI)
     */
    getAllTemplateKeys() {
        return Object.keys(this.templates);
    }
    
    /**
     * Get template info (for UI/documentation)
     * @param {string} key - Template key
     */
    getTemplateInfo(key) {
        const template = this.templates[key];
        if (!template) return null;
        
        return {
            key: key,
            name: template.name || key,
            template: template.template || template,
            placeholders: this.extractPlaceholders(template.template || template)
        };
    }
    
    /**
     * Extract placeholder names from template
     * @param {string} template - Template string
     */
    extractPlaceholders(template) {
        const placeholders = [];
        const regex = /\$\{([^}]+)\}/g;
        let match;
        
        while ((match = regex.exec(template)) !== null) {
            if (!placeholders.includes(match[1])) {
                placeholders.push(match[1]);
            }
        }
        
        return placeholders;
    }
    
    /**
     * Save custom template (for admin UI)
     * @param {string} key - Template key
     * @param {string} name - Template name
     * @param {string} template - Template content
     * @param {string} category - Template category/file
     */
    saveTemplate(key, name, template, category = 'custom_templates.json') {
        const filePath = path.join(__dirname, '..', 'database', category);
        
        // Load existing templates from file
        let templates = {};
        if (fs.existsSync(filePath)) {
            const content = fs.readFileSync(filePath, 'utf8');
            templates = JSON.parse(content);
        }
        
        // Add/update template
        templates[key] = {
            name: name,
            template: template,
            modified: new Date().toISOString()
        };
        
        // Save back to file
        fs.writeFileSync(filePath, JSON.stringify(templates, null, 2));
        
        // Reload templates
        this.reloadTemplates();
        
        console.log(`[TemplateManager] Template '${key}' saved to ${category}`);
        return true;
    }
}

// Create singleton instance
const templateManager = new TemplateManager();

// Export instance and class
module.exports = templateManager;
module.exports.TemplateManager = TemplateManager;
