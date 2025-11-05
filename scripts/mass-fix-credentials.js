#!/usr/bin/env node

/**
 * Mass fix fetch credentials - More comprehensive approach
 * Handles complex patterns that the simple fixer missed
 */

const fs = require('fs');
const path = require('path');

const VIEWS_DIR = path.join(__dirname, '..', 'views', 'sb-admin');

// Patterns to fix
const patterns = [
    // Pattern 1: Simple GET without options
    {
        find: /fetch\(['"`]([^'"`]+)['"`]\)/g,
        replace: (match, url) => {
            if (url.startsWith('/api/') && !isPublicEndpoint(url)) {
                return `fetch('${url}', { credentials: 'include' })`;
            }
            return match;
        }
    },
    // Pattern 2: Fetch with template literal, no options
    {
        find: /fetch\(`([^`]+)`\)/g,
        replace: (match, url) => {
            if (url.includes('/api/')) {
                return `fetch(\`${url}\`, { credentials: 'include' })`;
            }
            return match;
        }
    },
    // Pattern 3: await fetch without options
    {
        find: /await fetch\(['"`]([^'"`]+)['"`]\)/g,
        replace: (match, url) => {
            if (url.startsWith('/api/') && !isPublicEndpoint(url)) {
                return `await fetch('${url}', { credentials: 'include' })`;
            }
            return match;
        }
    },
    // Pattern 4: await fetch with template literal
    {
        find: /await fetch\(`([^`]+)`\)/g,
        replace: (match, url) => {
            if (url.includes('/api/')) {
                return `await fetch(\`${url}\`, { credentials: 'include' })`;
            }
            return match;
        }
    }
];

function isPublicEndpoint(url) {
    const publicEndpoints = [
        '/api/login',
        '/api/otp',
        '/api/otpverify',
        '/api/customer/login',
        '/api/announcements',
        '/api/news',
        '/api/packages'
    ];
    return publicEndpoints.some(p => url.startsWith(p));
}

function hasCredentials(content, startPos, endPos) {
    const section = content.substring(startPos, endPos);
    return section.includes('credentials');
}

function fixFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    let fixCount = 0;
    
    // Apply each pattern
    for (const pattern of patterns) {
        const newContent = content.replace(pattern.find, (...args) => {
            const result = pattern.replace(...args);
            if (result !== args[0]) {
                // Check if credentials already exists in this fetch block
                const fetchIndex = content.indexOf(args[0]);
                if (fetchIndex !== -1) {
                    // Look ahead 200 chars for credentials
                    const lookAhead = content.substring(fetchIndex, fetchIndex + 200);
                    if (lookAhead.includes('credentials')) {
                        return args[0]; // Already has credentials, skip
                    }
                }
                fixCount++;
                modified = true;
            }
            return result;
        });
        content = newContent;
    }
    
    if (modified) {
        fs.writeFileSync(filePath, content, 'utf8');
        return fixCount;
    }
    
    return 0;
}

function scanAndFix(dir) {
    const files = fs.readdirSync(dir, { withFileTypes: true });
    let totalFixed = 0;
    const fixedFiles = [];
    
    for (const file of files) {
        const fullPath = path.join(dir, file.name);
        
        if (file.isDirectory()) {
            const { count, files } = scanAndFix(fullPath);
            totalFixed += count;
            fixedFiles.push(...files);
        } else if (file.name.endsWith('.php')) {
            const fixCount = fixFile(fullPath);
            if (fixCount > 0) {
                const relativePath = path.relative(path.join(__dirname, '..'), fullPath);
                fixedFiles.push({ file: relativePath, fixes: fixCount });
                totalFixed += fixCount;
            }
        }
    }
    
    return { count: totalFixed, files: fixedFiles };
}

// Main execution
console.log('🔧 Mass Fix Fetch Credentials - Comprehensive Mode\n');
console.log('🔄 Processing files...\n');

const { count, files } = scanAndFix(VIEWS_DIR);

if (count === 0) {
    console.log('✅ No additional fixes needed!\n');
    process.exit(0);
}

console.log(`✅ Fixed ${count} additional fetch calls in ${files.length} files:\n`);

for (const { file, fixes } of files) {
    console.log(`   📝 ${file} (${fixes} fixes)`);
}

console.log('\n' + '─'.repeat(80));
console.log('\n📊 SUMMARY:');
console.log(`   Total fixes: ${count}`);
console.log(`   Files modified: ${files.length}\n`);
