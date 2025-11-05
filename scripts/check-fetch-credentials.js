#!/usr/bin/env node

/**
 * Check for Fetch API calls without credentials in PHP files
 * This script helps identify authentication issues
 */

const fs = require('fs');
const path = require('path');

const VIEWS_DIR = path.join(__dirname, '..', 'views', 'sb-admin');

function checkFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    const issues = [];
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lineNum = i + 1;
        
        // Check for fetch( calls
        if (line.includes('fetch(')) {
            // Look ahead for credentials
            let hasCredentials = false;
            let fetchBlock = '';
            
            // Collect next 10 lines to check for credentials
            for (let j = i; j < Math.min(i + 10, lines.length); j++) {
                fetchBlock += lines[j] + '\n';
                
                if (lines[j].includes('credentials')) {
                    hasCredentials = true;
                    break;
                }
                
                // Stop at closing )
                if (lines[j].includes('});') || lines[j].includes(')')) {
                    break;
                }
            }
            
            // Extract endpoint from fetch call
            const endpointMatch = line.match(/fetch\(['"`]([^'"`]+)['"`]/);
            const endpoint = endpointMatch ? endpointMatch[1] : 'unknown';
            
            // Check if it's an authenticated endpoint (starts with /api/ and not public)
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
            
            if (isAuthRequired && !hasCredentials) {
                issues.push({
                    line: lineNum,
                    endpoint: endpoint,
                    severity: 'HIGH',
                    message: `Missing credentials: 'include' for authenticated endpoint`
                });
            }
        }
    }
    
    return issues;
}

function scanDirectory(dir) {
    const files = fs.readdirSync(dir, { withFileTypes: true });
    const results = {};
    
    for (const file of files) {
        const fullPath = path.join(dir, file.name);
        
        if (file.isDirectory()) {
            Object.assign(results, scanDirectory(fullPath));
        } else if (file.name.endsWith('.php')) {
            const issues = checkFile(fullPath);
            if (issues.length > 0) {
                const relativePath = path.relative(path.join(__dirname, '..'), fullPath);
                results[relativePath] = issues;
            }
        }
    }
    
    return results;
}

// Main execution
console.log('🔍 Scanning PHP files for Fetch API authentication issues...\n');

const results = scanDirectory(VIEWS_DIR);
const fileCount = Object.keys(results).length;
const totalIssues = Object.values(results).reduce((sum, issues) => sum + issues.length, 0);

if (totalIssues === 0) {
    console.log('✅ No issues found! All fetch calls have proper credentials.\n');
    process.exit(0);
}

console.log(`❌ Found ${totalIssues} potential issues in ${fileCount} files:\n`);

// Print results
for (const [file, issues] of Object.entries(results)) {
    console.log(`📄 ${file}`);
    for (const issue of issues) {
        console.log(`   Line ${issue.line}: [${issue.severity}] ${issue.endpoint}`);
        console.log(`   → ${issue.message}`);
    }
    console.log('');
}

// Summary
console.log('─'.repeat(80));
console.log(`\n📊 SUMMARY:`);
console.log(`   Files with issues: ${fileCount}`);
console.log(`   Total issues: ${totalIssues}`);
console.log(`\n💡 TO FIX:`);
console.log(`   Add 'credentials: "include"' to each fetch call like this:`);
console.log(`\n   fetch('/api/endpoint', {`);
console.log(`       method: 'POST',`);
console.log(`       headers: { 'Content-Type': 'application/json' },`);
console.log(`       credentials: 'include',  // ← Add this line`);
console.log(`       body: JSON.stringify(data)`);
console.log(`   })\n`);

process.exit(1);
