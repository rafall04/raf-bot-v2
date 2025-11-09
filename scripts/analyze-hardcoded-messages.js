/**
 * Script to analyze and find all hardcoded messages in handlers
 * This will help identify what needs to be migrated to templates
 */

const fs = require('fs');
const path = require('path');

// Disable file watchers
process.env.DISABLE_FILE_WATCHERS = 'true';

const handlersDir = path.join(__dirname, '..', 'message', 'handlers');
const statesDir = path.join(handlersDir, 'states');
const stepsDir = path.join(handlersDir, 'steps');

// Patterns that indicate a message being sent
const messagePatterns = [
    /reply\([`'"]/g,
    /raf\.sendMessage\(/g,
    /sendMessage\(/g,
    /sendText\(/g,
    /reply\.message\(/g,
    /await reply\(/g,
    /return reply\(/g,
    /msg\.reply\(/g,
    /await msg\.reply\(/g,
    /fastSend\(/g,
    /await fastSend\(/g,
    /notifyAllCustomerNumbers\(/g,
    /broadcastToAdmins\(/g
];

// Pattern to detect template usage (these are OK)
const templatePatterns = [
    /renderTemplate\(/g,
    /templatesCache/g,
    /loadTemplate\(/g
];

const results = {
    totalFiles: 0,
    filesWithHardcoded: 0,
    filesWithTemplates: 0,
    hardcodedMessages: [],
    templateUsage: []
};

function analyzeFile(filePath, relativePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    
    const fileResult = {
        file: relativePath,
        hardcoded: [],
        templates: []
    };
    
    let hasHardcoded = false;
    let hasTemplates = false;
    
    lines.forEach((line, index) => {
        const lineNum = index + 1;
        
        // Check for hardcoded messages
        messagePatterns.forEach(pattern => {
            if (pattern.test(line)) {
                // Check if this line also uses templates
                let isTemplate = false;
                templatePatterns.forEach(tPattern => {
                    if (tPattern.test(line)) {
                        isTemplate = true;
                    }
                });
                
                if (!isTemplate && (line.includes('`') || line.includes('"') || line.includes("'"))) {
                    hasHardcoded = true;
                    fileResult.hardcoded.push({
                        line: lineNum,
                        content: line.trim().substring(0, 100) + (line.length > 100 ? '...' : '')
                    });
                }
            }
        });
        
        // Check for template usage
        templatePatterns.forEach(pattern => {
            if (pattern.test(line)) {
                hasTemplates = true;
                fileResult.templates.push({
                    line: lineNum,
                    content: line.trim().substring(0, 100)
                });
            }
        });
    });
    
    results.totalFiles++;
    
    if (hasHardcoded) {
        results.filesWithHardcoded++;
        results.hardcodedMessages.push(fileResult);
    }
    
    if (hasTemplates) {
        results.filesWithTemplates++;
        results.templateUsage.push(fileResult);
    }
}

function scanDirectory(dir, baseDir) {
    const files = fs.readdirSync(dir);
    
    files.forEach(file => {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
            scanDirectory(fullPath, baseDir);
        } else if (file.endsWith('.js')) {
            const relativePath = path.relative(baseDir, fullPath);
            analyzeFile(fullPath, relativePath);
        }
    });
}

console.log('🔍 Analyzing WhatsApp Bot Message Handlers...\n');
console.log('Scanning directories:');
console.log('- message/handlers/');
console.log('- message/handlers/states/');
console.log('- message/handlers/steps/\n');

// Scan all handler directories
scanDirectory(handlersDir, handlersDir);

console.log('=' .repeat(80));
console.log('📊 ANALYSIS RESULTS');
console.log('=' .repeat(80));

console.log(`\n📁 Files Analyzed: ${results.totalFiles}`);
console.log(`❌ Files with Hardcoded Messages: ${results.filesWithHardcoded}`);
console.log(`✅ Files using Templates: ${results.filesWithTemplates}`);

console.log('\n' + '=' .repeat(80));
console.log('❌ FILES WITH HARDCODED MESSAGES (Need Migration)');
console.log('=' .repeat(80));

results.hardcodedMessages.forEach(file => {
    console.log(`\n📄 ${file.file}`);
    console.log(`   Found ${file.hardcoded.length} hardcoded messages:`);
    
    // Show first 5 examples
    file.hardcoded.slice(0, 5).forEach(msg => {
        console.log(`   Line ${msg.line}: ${msg.content}`);
    });
    
    if (file.hardcoded.length > 5) {
        console.log(`   ... and ${file.hardcoded.length - 5} more`);
    }
});

console.log('\n' + '=' .repeat(80));
console.log('✅ FILES ALREADY USING TEMPLATES');
console.log('=' .repeat(80));

results.templateUsage.forEach(file => {
    console.log(`\n📄 ${file.file}`);
    console.log(`   Found ${file.templates.length} template usages`);
});

// Generate summary report
const summaryReport = {
    timestamp: new Date().toISOString(),
    statistics: {
        totalFiles: results.totalFiles,
        filesNeedingMigration: results.filesWithHardcoded,
        filesUsingTemplates: results.filesWithTemplates,
        migrationProgress: Math.round((results.filesWithTemplates / results.totalFiles) * 100) + '%'
    },
    filesRequiringWork: results.hardcodedMessages.map(f => ({
        file: f.file,
        hardcodedCount: f.hardcoded.length
    }))
};

// Save detailed report
const reportPath = path.join(__dirname, '..', 'HARDCODED_MESSAGES_REPORT.json');
fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
console.log(`\n📝 Detailed report saved to: HARDCODED_MESSAGES_REPORT.json`);

// Save summary
const summaryPath = path.join(__dirname, '..', 'MIGRATION_SUMMARY.json');
fs.writeFileSync(summaryPath, JSON.stringify(summaryReport, null, 2));
console.log(`📊 Summary saved to: MIGRATION_SUMMARY.json`);

console.log('\n' + '=' .repeat(80));
console.log('🎯 MIGRATION PRIORITY');
console.log('=' .repeat(80));

// Sort files by number of hardcoded messages
const priorityList = results.hardcodedMessages
    .sort((a, b) => b.hardcoded.length - a.hardcoded.length)
    .slice(0, 10);

console.log('\nTop 10 files with most hardcoded messages:');
priorityList.forEach((file, index) => {
    console.log(`${index + 1}. ${file.file} (${file.hardcoded.length} messages)`);
});

console.log('\n✅ Analysis complete!');
console.log('Next step: Start migrating hardcoded messages to templates.');

process.exit(0);
