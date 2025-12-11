/**
 * RAF-BOT v2 Auto-Commit Service
 * Automatically commits and pushes changes to GitHub
 */

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const chokidar = require('chokidar');

// Configuration
const config = {
    projectPath: process.cwd(),
    debounceDelay: 10000, // Wait 10 seconds after last change
    commitPrefix: 'Auto-commit:',
    branch: 'main',
    excludePaths: [
        'node_modules',
        '.git',
        'database/database.sqlite', // All databases in database/ folder
        'database/psb_database.sqlite',
        'database/*.sqlite',
        'config.json',
        'session',
        'raf_session',
        'baileys_auth_info',
        'uploads',
        'temp',
        'logs'
    ]
};

// Colors for console output
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    red: '\x1b[31m',
    cyan: '\x1b[36m'
};

let debounceTimer = null;
let isProcessing = false;

// Logger function
function log(message, color = colors.reset) {
    const timestamp = new Date().toLocaleString('id-ID', { 
        timeZone: 'Asia/Jakarta',
        dateStyle: 'short',
        timeStyle: 'medium'
    });
    console.log(`${color}[${timestamp}] ${message}${colors.reset}`);
}

// Execute git command
function execGitCommand(command) {
    return new Promise((resolve, reject) => {
        exec(command, { cwd: config.projectPath }, (error, stdout, stderr) => {
            if (error) {
                reject(error);
            } else {
                resolve(stdout.trim());
            }
        });
    });
}

// Check if there are changes
async function hasChanges() {
    try {
        const status = await execGitCommand('git status --porcelain');
        return status.length > 0;
    } catch (error) {
        log(`Error checking git status: ${error.message}`, colors.red);
        return false;
    }
}

// Get list of changed files
async function getChangedFiles() {
    try {
        const status = await execGitCommand('git status --porcelain');
        return status.split('\n').filter(line => line.trim()).map(line => {
            const parts = line.trim().split(' ');
            return parts[parts.length - 1];
        });
    } catch (error) {
        return [];
    }
}

// Commit and push changes
async function commitAndPush() {
    if (isProcessing) {
        log('Already processing changes, skipping...', colors.yellow);
        return;
    }

    isProcessing = true;

    try {
        // Check for changes
        if (!(await hasChanges())) {
            log('No changes to commit', colors.yellow);
            isProcessing = false;
            return;
        }

        // Get changed files
        const changedFiles = await getChangedFiles();
        log(`Changes detected in ${changedFiles.length} file(s)`, colors.cyan);
        
        // Add all changes
        await execGitCommand('git add .');
        log('Files staged for commit', colors.blue);

        // Create commit message
        const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
        const fileCount = changedFiles.length;
        const commitMessage = `${config.commitPrefix} ${timestamp} (${fileCount} files)`;

        // Commit changes
        await execGitCommand(`git commit -m "${commitMessage}"`);
        log(`Committed: ${commitMessage}`, colors.green);

        // Push to remote
        try {
            await execGitCommand(`git push origin ${config.branch}`);
            log('Changes pushed to GitHub successfully!', colors.green);
        } catch (pushError) {
            log('Failed to push to GitHub. Changes committed locally.', colors.yellow);
            log(`Push error: ${pushError.message}`, colors.red);
        }

    } catch (error) {
        log(`Error during commit process: ${error.message}`, colors.red);
    } finally {
        isProcessing = false;
    }
}

// Debounced commit function
function debouncedCommit() {
    if (debounceTimer) {
        clearTimeout(debounceTimer);
    }

    debounceTimer = setTimeout(() => {
        commitAndPush();
    }, config.debounceDelay);
}

// Initialize watcher
function initWatcher() {
    const watcher = chokidar.watch(config.projectPath, {
        ignored: (path) => {
            // Ignore paths based on config
            return config.excludePaths.some(excludePath => 
                path.includes(excludePath)
            );
        },
        persistent: true,
        ignoreInitial: true,
        depth: 10
    });

    watcher
        .on('add', (path) => {
            log(`File added: ${path}`, colors.cyan);
            debouncedCommit();
        })
        .on('change', (path) => {
            log(`File changed: ${path}`, colors.cyan);
            debouncedCommit();
        })
        .on('unlink', (path) => {
            log(`File deleted: ${path}`, colors.cyan);
            debouncedCommit();
        })
        .on('error', (error) => {
            log(`Watcher error: ${error}`, colors.red);
        });

    log('File watcher initialized', colors.green);
}

// Main function
async function main() {
    console.log(`${colors.bright}${colors.green}`);
    console.log('================================================');
    console.log('        RAF-BOT v2 Auto-Commit Service         ');
    console.log('================================================');
    console.log(colors.reset);

    log(`Project path: ${config.projectPath}`, colors.cyan);
    log(`Branch: ${config.branch}`, colors.cyan);
    log(`Debounce delay: ${config.debounceDelay}ms`, colors.cyan);
    log('Excluded paths:', colors.cyan);
    config.excludePaths.forEach(path => {
        console.log(`  - ${path}`);
    });
    console.log('');

    // Check if git repository exists
    try {
        await execGitCommand('git status');
        log('Git repository detected', colors.green);
    } catch (error) {
        log('Error: Not a git repository!', colors.red);
        log('Please run "git init" first', colors.yellow);
        process.exit(1);
    }

    // Check if remote is configured
    try {
        const remotes = await execGitCommand('git remote -v');
        if (!remotes.includes('origin')) {
            log('Warning: No remote origin configured', colors.yellow);
            log('Commits will be saved locally only', colors.yellow);
        } else {
            log('Remote origin configured', colors.green);
        }
    } catch (error) {
        log('Warning: Could not check remotes', colors.yellow);
    }

    // Start watching for changes
    initWatcher();
    
    // Initial commit check
    setTimeout(() => {
        log('Checking for initial uncommitted changes...', colors.cyan);
        commitAndPush();
    }, 2000);

    log('Auto-commit service is running...', colors.green);
    log('Press Ctrl+C to stop', colors.yellow);
}

// Handle process termination
process.on('SIGINT', () => {
    log('\nStopping auto-commit service...', colors.yellow);
    process.exit(0);
});

process.on('SIGTERM', () => {
    log('\nStopping auto-commit service...', colors.yellow);
    process.exit(0);
});

// Run main function
main().catch(error => {
    log(`Fatal error: ${error.message}`, colors.red);
    process.exit(1);
});
