#!/usr/bin/env node

/**
 * Script to fix placeholder inconsistencies across all template files
 * Based on PLACEHOLDER_STANDARD.md
 */

const fs = require('fs');
const path = require('path');

console.log("🔧 PLACEHOLDER STANDARDIZATION SCRIPT\n");
console.log("=".repeat(50));

const templateFiles = [
    'message_templates.json',
    'wifi_menu_templates.json', 
    'response_templates.json',
    'command_templates.json',
    'error_templates.json',
    'success_templates.json'
];

// Track changes
let totalChanges = 0;
const changeLog = [];

// Context-aware replacement rules
const contextRules = {
    // For message_templates.json
    'message_templates.json': {
        'speed_on_demand_applied': { 'nama': 'nama_pelanggan' },
        'speed_on_demand_reverted': { 'nama': 'nama_pelanggan' },
        'unpaid_reminder': { 'nama': 'nama_pelanggan', 'paket': 'nama_paket' },
        'tagihan_lunas': { 'nama': 'nama_pelanggan', 'paket': 'nama_paket' },
        'tagihan_belum_lunas': { 'nama': 'nama_pelanggan', 'paket': 'nama_paket' },
        'sudah_bayar_notification': { 'nama': 'nama_pelanggan', 'paket': 'nama_paket' },
        'isolir_notification': { 'nama': 'nama_pelanggan' },
        'compensation_applied': { 'nama': 'nama_pelanggan' },
        'compensation_reverted': { 'nama': 'nama_pelanggan' },
        'customer_welcome': { 'nama': 'nama_pelanggan' },
        'redaman_alert': { 'nama': 'nama_pelanggan' }
    },
    // For wifi_menu_templates.json  
    'wifi_menu_templates.json': {
        'technicianmenu': { 'nama': 'nama_wifi', 'namabot': 'nama_bot' },
        'menubelivoucher': { 'nama': 'nama_wifi', 'namabot': 'nama_bot' },
        'menuvoucher': { 'nama': 'nama_wifi', 'namabot': 'nama_bot' },
        'menupasang': { 'nama': 'nama_wifi' },
        'menupaket': { 'nama': 'nama_wifi' },
        'menuowner': { 'nama': 'nama_wifi', 'namabot': 'nama_bot' }
    },
    // For success_templates.json
    'success_templates.json': {
        'user_added': { 'nama': 'nama_pelanggan' }
    }
};

// Process each file
templateFiles.forEach(file => {
    const filePath = path.join(__dirname, '..', 'database', file);
    
    if (!fs.existsSync(filePath)) {
        console.log(`❌ ${file} not found`);
        return;
    }
    
    console.log(`\n📁 Processing ${file}:`);
    console.log("-".repeat(50));
    
    const content = fs.readFileSync(filePath, 'utf8');
    const templates = JSON.parse(content);
    const rules = contextRules[file] || {};
    
    let fileChanges = 0;
    
    // Process each template in the file
    function processTemplate(obj, templateKey = '') {
        for (const [key, value] of Object.entries(obj)) {
            if (typeof value === 'string') {
                let updatedValue = value;
                const currentTemplate = templateKey || key;
                const templateRules = rules[currentTemplate] || {};
                
                // Apply context-specific rules for this template
                Object.entries(templateRules).forEach(([oldPlaceholder, newPlaceholder]) => {
                    const regex = new RegExp(`\\$\\{${oldPlaceholder}\\}`, 'g');
                    const beforeCount = (updatedValue.match(regex) || []).length;
                    
                    if (beforeCount > 0) {
                        updatedValue = updatedValue.replace(regex, `\${${newPlaceholder}}`);
                        fileChanges += beforeCount;
                        
                        changeLog.push({
                            file: file,
                            template: currentTemplate,
                            change: `\${${oldPlaceholder}} → \${${newPlaceholder}}`,
                            count: beforeCount
                        });
                        
                        console.log(`  ✏️ ${currentTemplate}: \${${oldPlaceholder}} → \${${newPlaceholder}} (${beforeCount}x)`);
                    }
                });
                
                // Apply global rules (that apply everywhere)
                // Only if not already handled by context rules
                if (!templateRules.namabot) {
                    const namabotRegex = /\$\{namabot\}/g;
                    const namabotCount = (updatedValue.match(namabotRegex) || []).length;
                    if (namabotCount > 0) {
                        updatedValue = updatedValue.replace(namabotRegex, '${nama_bot}');
                        fileChanges += namabotCount;
                        changeLog.push({
                            file: file,
                            template: currentTemplate,
                            change: '${namabot} → ${nama_bot}',
                            count: namabotCount
                        });
                        console.log(`  ✏️ ${currentTemplate}: \${namabot} → \${nama_bot} (${namabotCount}x)`);
                    }
                }
                
                if (!templateRules.paket) {
                    const paketRegex = /\$\{paket\}/g;
                    const paketCount = (updatedValue.match(paketRegex) || []).length;
                    if (paketCount > 0) {
                        updatedValue = updatedValue.replace(paketRegex, '${nama_paket}');
                        fileChanges += paketCount;
                        changeLog.push({
                            file: file,
                            template: currentTemplate,
                            change: '${paket} → ${nama_paket}',
                            count: paketCount
                        });
                        console.log(`  ✏️ ${currentTemplate}: \${paket} → \${nama_paket} (${paketCount}x)`);
                    }
                }
                
                obj[key] = updatedValue;
            } else if (typeof value === 'object' && value !== null) {
                processTemplate(value, key);
            }
        }
    }
    
    processTemplate(templates);
    
    if (fileChanges > 0) {
        // Write the updated file
        fs.writeFileSync(filePath, JSON.stringify(templates, null, 2) + '\n', 'utf8');
        console.log(`  ✅ Fixed ${fileChanges} placeholder(s)`);
        totalChanges += fileChanges;
    } else {
        console.log(`  ✨ No changes needed`);
    }
});

// Summary Report
console.log("\n" + "=".repeat(50));
console.log("📊 SUMMARY REPORT:");
console.log("-".repeat(50));

if (totalChanges > 0) {
    console.log(`\n✅ Total placeholders fixed: ${totalChanges}`);
    
    // Group changes by type
    const changesByType = {};
    changeLog.forEach(log => {
        if (!changesByType[log.change]) {
            changesByType[log.change] = 0;
        }
        changesByType[log.change] += log.count;
    });
    
    console.log("\nChanges by type:");
    Object.entries(changesByType).forEach(([change, count]) => {
        console.log(`  ${change}: ${count} occurrence(s)`);
    });
    
    console.log("\n📝 Detailed changes:");
    changeLog.forEach(log => {
        console.log(`  - ${log.file}:${log.template} - ${log.change} (${log.count}x)`);
    });
} else {
    console.log("✨ No changes needed - all placeholders are already standardized!");
}

// Create backup info
console.log("\n" + "=".repeat(50));
console.log("💡 NEXT STEPS:");
console.log("-".repeat(50));
console.log("1. Run 'node test/analyze-placeholders.js' to verify");
console.log("2. Test the bot to ensure templates still work");
console.log("3. Update any hardcoded references in handlers");
console.log("4. Inform admins about the placeholder changes");

console.log("\n" + "=".repeat(50));
console.log("STANDARDIZATION COMPLETE");
console.log("=".repeat(50));

process.exit(0);
