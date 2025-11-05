#!/usr/bin/env node

/**
 * Fix remaining fetch calls with existing options objects
 * This handles cases where fetch has { method: 'POST' } but no credentials
 */

const fs = require('fs');
const path = require('path');

const filesToFix = [
    { file: 'views/sb-admin/map-viewer.php', lines: [1980, 2667] },
    { file: 'views/sb-admin/pembayaran/teknisi.php', lines: [520] },
    { file: 'views/sb-admin/teknisi-map-viewer.php', lines: [1162, 1210, 1347] },
    { file: 'views/sb-admin/teknisi-pelanggan.php', lines: [476, 1482, 1789, 1839] },
    { file: 'views/sb-admin/teknisi-tiket.php', lines: [256] },
];

function fixFileAtLines(filePath, lineNumbers) {
    const fullPath = path.join(__dirname, '..', filePath);
    const content = fs.readFileSync(fullPath, 'utf8');
    const lines = content.split('\n');
    let fixCount = 0;
    
    for (const lineNum of lineNumbers) {
        const idx = lineNum - 1;
        if (idx < 0 || idx >= lines.length) continue;
        
        const line = lines[idx];
        
        // Check if this line has fetch
        if (line.includes('fetch(')) {
            // Pattern 1: fetch(..., { method: 'POST' })
            if (line.includes(', {') && !line.includes('credentials')) {
                // Insert credentials before the closing }
                const newLine = line.replace(/}\s*\)/, ", credentials: 'include' })");
                if (newLine !== line) {
                    lines[idx] = newLine;
                    fixCount++;
                    console.log(`   ✓ Fixed line ${lineNum}`);
                }
            }
            // Pattern 2: fetch(...) without options - already should be handled, but check
            else if (line.match(/fetch\([^,]+\)\s*$/)) {
                // Add options object
                const newLine = line.replace(/\)$/, ", { credentials: 'include' })");
                if (newLine !== line) {
                    lines[idx] = newLine;
                    fixCount++;
                    console.log(`   ✓ Fixed line ${lineNum}`);
                }
            }
        }
        
        // Check next few lines for options object spanning multiple lines
        if (line.includes('fetch(') && !line.includes('credentials')) {
            for (let j = idx; j < Math.min(idx + 10, lines.length); j++) {
                if (lines[j].includes('credentials')) {
                    break; // Already has credentials
                }
                if (lines[j].match(/^\s*}\s*\)/) || lines[j].match(/}\s*\)/)) {
                    // Found closing of options object
                    if (!lines[j].includes('credentials')) {
                        // Add credentials before closing
                        const indent = lines[j].match(/^(\s*)/)[1];
                        lines.splice(j, 0, `${indent}  credentials: 'include',`);
                        fixCount++;
                        console.log(`   ✓ Fixed line ${lineNum} (multi-line)`);
                    }
                    break;
                }
            }
        }
    }
    
    if (fixCount > 0) {
        fs.writeFileSync(fullPath, lines.join('\n'), 'utf8');
    }
    
    return fixCount;
}

// Main execution
console.log('🔧 Fixing Remaining Fetch Credentials (Targeted Fix)\n');

let totalFixed = 0;

for (const { file, lines } of filesToFix) {
    console.log(`📝 Processing ${file}...`);
    const count = fixFileAtLines(file, lines);
    if (count > 0) {
        console.log(`   → Fixed ${count} issues\n`);
        totalFixed += count;
    } else {
        console.log(`   → No changes needed\n`);
    }
}

console.log('─'.repeat(80));
console.log(`\n✅ Total fixes applied: ${totalFixed}\n`);
