#!/usr/bin/env node

/**
 * Automatically fix Fetch API calls by adding credentials: 'include'
 * CAUTION: This modifies files! Make sure to commit changes first.
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const VIEWS_DIR = path.join(__dirname, '..', 'views', 'sb-admin');

function fixFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    let modified = false;
    let fixCount = 0;
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // Check for fetch( calls
        if (line.includes('fetch(') && !line.includes('//')) {
            // Extract endpoint
            const endpointMatch = line.match(/fetch\(['"`]([^'"`]+)['"`]/);
            const endpoint = endpointMatch ? endpointMatch[1] : null;
            
            if (!endpoint) continue;
            
            // Check if it's an authenticated endpoint
            const publicEndpoints = [
                '/api/login',
                '/api/otp',
                '/api/otpverify',
                '/api/customer/login',
                '/api/announcements',
                '/api/news',
                '/api/packages'
            ];
            
            const isPublic = publicEndpoints.some(p => endpoint.startsWith(p));
            const isAuthRequired = endpoint.startsWith('/api/') && !isPublic;
            
            if (!isAuthRequired) continue;
            
            // Check if already has credentials in next few lines
            let hasCredentials = false;
            for (let j = i; j < Math.min(i + 10, lines.length); j++) {
                if (lines[j].includes('credentials')) {
                    hasCredentials = true;
                    break;
                }
                if (lines[j].includes('});')) break;
            }
            
            if (hasCredentials) continue;
            
            // Find where to insert credentials
            // Look for headers line or method line
            for (let j = i + 1; j < Math.min(i + 15, lines.length); j++) {
                const nextLine = lines[j];
                
                // If we find closing brace before headers, insert before it
                if (nextLine.match(/^\s*}\s*\)/)) {
                    const indent = nextLine.match(/^(\s*)/)[1];
                    lines.splice(j, 0, `${indent}  credentials: 'include', // ✅ Fixed by script`);
                    modified = true;
                    fixCount++;
                    break;
                }
                
                // Insert after headers line
                if (nextLine.includes('headers:') || nextLine.includes("'Content-Type'")) {
                    // Find end of headers object
                    let headerEnd = j;
                    for (let k = j; k < lines.length; k++) {
                        if (lines[k].includes('},')) {
                            headerEnd = k;
                            break;
                        }
                    }
                    
                    const indent = lines[headerEnd].match(/^(\s*)/)[1];
                    lines.splice(headerEnd + 1, 0, `${indent}credentials: 'include', // ✅ Fixed by script`);
                    modified = true;
                    fixCount++;
                    break;
                }
            }
        }
    }
    
    if (modified) {
        fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
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

// Ask for confirmation
async function confirm() {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    
    return new Promise((resolve) => {
        console.log('⚠️  WARNING: This script will MODIFY PHP files!');
        console.log('   Make sure you have committed your changes first.\n');
        
        rl.question('Do you want to proceed? (yes/no): ', (answer) => {
            rl.close();
            resolve(answer.toLowerCase() === 'yes');
        });
    });
}

// Main execution
(async () => {
    console.log('🔧 Fetch API Credentials Auto-Fix Tool\n');
    
    const proceed = await confirm();
    
    if (!proceed) {
        console.log('\n❌ Cancelled by user.\n');
        process.exit(0);
    }
    
    console.log('\n🔄 Processing files...\n');
    
    const { count, files } = scanAndFix(VIEWS_DIR);
    
    if (count === 0) {
        console.log('✅ No fixes needed! All files are already correct.\n');
        process.exit(0);
    }
    
    console.log(`✅ Fixed ${count} fetch calls in ${files.length} files:\n`);
    
    for (const { file, fixes } of files) {
        console.log(`   📝 ${file} (${fixes} fixes)`);
    }
    
    console.log('\n─'.repeat(80));
    console.log('\n📊 SUMMARY:');
    console.log(`   Total fixes: ${count}`);
    console.log(`   Files modified: ${files.length}`);
    console.log('\n💡 NEXT STEPS:');
    console.log('   1. Review the changes with: git diff');
    console.log('   2. Test the affected pages');
    console.log('   3. Commit if everything works\n');
})();
