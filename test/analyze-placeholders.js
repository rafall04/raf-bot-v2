#!/usr/bin/env node

/**
 * Script to analyze placeholder usage across all template files
 */

const fs = require('fs');
const path = require('path');

console.log("📊 PLACEHOLDER USAGE ANALYSIS\n");
console.log("=".repeat(50));

const templateFiles = [
    'message_templates.json',
    'wifi_menu_templates.json', 
    'response_templates.json',
    'command_templates.json',
    'error_templates.json',
    'success_templates.json'
];

// Track all unique placeholders
const placeholderUsage = {};
const inconsistencies = [];

// Regex to find placeholders
const placeholderRegex = /\$\{([^}]+)\}/g;

// Analyze each file
templateFiles.forEach(file => {
    const filePath = path.join(__dirname, '..', 'database', file);
    
    if (!fs.existsSync(filePath)) {
        console.log(`❌ ${file} not found`);
        return;
    }
    
    const content = fs.readFileSync(filePath, 'utf8');
    const templates = JSON.parse(content);
    
    console.log(`\n📁 ${file}:`);
    console.log("-".repeat(50));
    
    // Extract all placeholders from this file
    const filePlaceholders = new Set();
    
    function extractPlaceholders(obj, templateKey = '') {
        for (const [key, value] of Object.entries(obj)) {
            if (typeof value === 'string') {
                let match;
                while ((match = placeholderRegex.exec(value)) !== null) {
                    const placeholder = match[1];
                    filePlaceholders.add(placeholder);
                    
                    // Track usage
                    if (!placeholderUsage[placeholder]) {
                        placeholderUsage[placeholder] = [];
                    }
                    placeholderUsage[placeholder].push({
                        file: file,
                        template: templateKey || key
                    });
                    
                    // Check for problematic placeholders
                    if (placeholder === 'nama') {
                        inconsistencies.push({
                            file: file,
                            template: templateKey || key,
                            issue: 'Ambiguous ${nama} - should specify what nama'
                        });
                    }
                    if (placeholder === 'namabot') {
                        inconsistencies.push({
                            file: file,
                            template: templateKey || key,
                            issue: 'Should use ${nama_bot} instead of ${namabot}'
                        });
                    }
                    if (placeholder === 'paket') {
                        inconsistencies.push({
                            file: file,
                            template: templateKey || key,
                            issue: 'Should use ${nama_paket} instead of ${paket}'
                        });
                    }
                }
            } else if (typeof value === 'object' && value !== null) {
                extractPlaceholders(value, key);
            }
        }
    }
    
    extractPlaceholders(templates);
    
    // Report for this file
    const sortedPlaceholders = Array.from(filePlaceholders).sort();
    console.log(`  Found ${sortedPlaceholders.length} unique placeholders:`);
    sortedPlaceholders.forEach(p => {
        const flag = (p === 'nama' || p === 'namabot' || p === 'paket') ? ' ⚠️' : '';
        console.log(`    - ${p}${flag}`);
    });
});

// Summary
console.log("\n" + "=".repeat(50));
console.log("📊 OVERALL SUMMARY:");
console.log("-".repeat(50));

// Sort placeholders by usage count
const sortedByUsage = Object.entries(placeholderUsage)
    .map(([placeholder, usage]) => ({
        placeholder,
        count: usage.length,
        files: [...new Set(usage.map(u => u.file))]
    }))
    .sort((a, b) => b.count - a.count);

console.log("\nMost used placeholders:");
sortedByUsage.slice(0, 10).forEach(({placeholder, count, files}) => {
    const flag = (placeholder === 'nama' || placeholder === 'namabot' || placeholder === 'paket') ? ' ⚠️' : '';
    console.log(`  ${placeholder}: ${count} uses in ${files.length} file(s)${flag}`);
});

// Report inconsistencies
console.log("\n" + "=".repeat(50));
console.log("⚠️ INCONSISTENCIES FOUND:");
console.log("-".repeat(50));

if (inconsistencies.length > 0) {
    // Group by issue type
    const byIssue = {};
    inconsistencies.forEach(item => {
        if (!byIssue[item.issue]) {
            byIssue[item.issue] = [];
        }
        byIssue[item.issue].push(`${item.file}:${item.template}`);
    });
    
    Object.entries(byIssue).forEach(([issue, locations]) => {
        console.log(`\n${issue}:`);
        locations.forEach(loc => console.log(`  - ${loc}`));
    });
    
    console.log(`\n❌ Total: ${inconsistencies.length} inconsistencies found`);
} else {
    console.log("✅ No inconsistencies found!");
}

// Recommendations
console.log("\n" + "=".repeat(50));
console.log("📝 RECOMMENDATIONS:");
console.log("-".repeat(50));

const recommendations = {
    'nama': 'Replace with ${nama_pelanggan} or ${nama_wifi} depending on context',
    'namabot': 'Replace with ${nama_bot}',
    'paket': 'Replace with ${nama_paket}',
    'harga': 'Consider using ${harga_formatted} for display'
};

Object.entries(recommendations).forEach(([old, recommendation]) => {
    if (placeholderUsage[old]) {
        console.log(`\n${old} (${placeholderUsage[old].length} occurrences):`);
        console.log(`  → ${recommendation}`);
    }
});

console.log("\n" + "=".repeat(50));
console.log("📊 STATISTICS:");
console.log("-".repeat(50));
console.log(`Total unique placeholders: ${Object.keys(placeholderUsage).length}`);
console.log(`Total placeholder uses: ${Object.values(placeholderUsage).reduce((sum, arr) => sum + arr.length, 0)}`);
console.log(`Files analyzed: ${templateFiles.length}`);
console.log(`Inconsistencies found: ${inconsistencies.length}`);

console.log("\n" + "=".repeat(50));
console.log("ANALYSIS COMPLETE");
console.log("=".repeat(50));

process.exit(inconsistencies.length > 0 ? 1 : 0);
