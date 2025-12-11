/**
 * Environment Configuration Manager
 * Manages environment-specific settings (production vs test/development)
 * Ensures production database is never overwritten by test data
 */

const fs = require('fs');
const path = require('path');

// Get environment (default to production for safety)
// PENTING: Pastikan NODE_ENV tidak di-set ke 'test' atau 'development' di production
// Jika tidak di-set, default ke 'production'
const NODE_ENV = process.env.NODE_ENV || 'production';

    // Log environment hanya jika test/dev
    if (NODE_ENV === 'test' || NODE_ENV === 'development') {
        console.warn(`[ENV] ⚠️  ${NODE_ENV} mode - using test database`);
    }

// Environment-specific database paths
// NOTE: SEMUA database (SQLite dan JSON) disimpan di folder database/ untuk organisasi yang rapi
// Setiap domain/fitur memiliki database terpisah untuk maintenance yang lebih mudah
// Database utama untuk pelanggan: users.sqlite
// Saldo management: saldo.sqlite (terpisah)
// Log login/logout: activity_logs.sqlite (terpisah)
// Database PSB: psb_database.sqlite (terpisah)
const getDatabasePath = (dbName = 'users.sqlite') => {
    const baseDir = path.join(__dirname, '..');
    const dbDir = path.join(baseDir, 'database');
    
    // All databases go in database/ folder
    if (NODE_ENV === 'test' || NODE_ENV === 'development') {
        // Test/Dev: Use separate database with _test suffix
        return path.join(dbDir, `${dbName.replace('.sqlite', '')}_test.sqlite`);
    }
    
    // Production: Use original database name in database/ folder
    return path.join(dbDir, dbName);
};

// Environment-specific config file
const getConfigPath = () => {
    const baseDir = path.join(__dirname, '..');
    
    if (NODE_ENV === 'test' || NODE_ENV === 'development') {
        // Try test-specific config first
        const testConfig = path.join(baseDir, 'config.test.json');
        if (fs.existsSync(testConfig)) {
            return testConfig;
        }
    }
    
    // Default to production config
    const prodConfig = path.join(baseDir, 'config.json');
    if (!fs.existsSync(prodConfig)) {
        // Fallback to example
        const exampleConfig = path.join(baseDir, 'config.example.json');
        if (fs.existsSync(exampleConfig)) {
            console.warn(`[ENV_CONFIG] config.json not found, using config.example.json`);
            return exampleConfig;
        }
    }
    
    return prodConfig;
};

// Load configuration with environment awareness
const loadConfig = () => {
    const configPath = getConfigPath();
    
    try {
        if (fs.existsSync(configPath)) {
            const configData = fs.readFileSync(configPath, 'utf8');
            const config = JSON.parse(configData);
            
            // Add environment info to config
            config.environment = NODE_ENV;
            config.isProduction = NODE_ENV === 'production';
            config.isTest = NODE_ENV === 'test' || NODE_ENV === 'development';
            
            // Log hanya jika bukan production
            if (NODE_ENV !== 'production') {
                console.log(`[ENV] ${NODE_ENV} mode - DB: ${getDatabasePath()}`);
            }
            
            return config;
        } else {
            throw new Error(`Configuration file not found: ${configPath}`);
        }
    } catch (error) {
        console.error(`[ENV_CONFIG_ERROR] Failed to load config:`, error.message);
        throw error;
    }
};

// Validate environment setup
const validateEnvironment = () => {
    const errors = [];
    const warnings = [];
    
    // Check if we're in production mode
    if (NODE_ENV === 'production') {
        const prodDbPath = getDatabasePath('users.sqlite');
        const testDbPath = getDatabasePath('users_test.sqlite');
        
        // Warning if test database exists in production (informational only)
        if (fs.existsSync(testDbPath)) {
            warnings.push(`Test database found in production mode: ${testDbPath} (safe to ignore if not using test environment)`);
        }
        
        // Verify database path is in database/ folder (not root)
        if (!prodDbPath.includes(path.sep + 'database' + path.sep) && !prodDbPath.includes('/database/')) {
            errors.push(`Database path is not in database/ folder: ${prodDbPath}`);
        }
        
        // Check if production database exists in correct location (database/ folder)
        // Note: Allow database.sqlite for backward compatibility (will be migrated)
        const oldDbPath = prodDbPath.replace('users.sqlite', 'database.sqlite');
        if (!fs.existsSync(prodDbPath) && !fs.existsSync(oldDbPath)) {
            warnings.push(`Production database not found: ${prodDbPath} (will be created on first run)`);
        }
        
        // Check PSB database
        const psbDbPath = getDatabasePath('psb_database.sqlite');
        if (!psbDbPath.includes(path.sep + 'database' + path.sep) && !psbDbPath.includes('/database/')) {
            errors.push(`PSB database path is not in database/ folder: ${psbDbPath}`);
        }
    }
    
    // Check if config file exists
    const configPath = getConfigPath();
    if (!fs.existsSync(configPath)) {
        errors.push(`Configuration file not found: ${configPath}`);
    }
    
    // Log warnings and errors
    if (warnings.length > 0) {
        console.warn(`[ENV_CONFIG_WARN]`, warnings);
    }
    
    if (errors.length > 0) {
        console.error(`[ENV_CONFIG_ERROR]`, errors);
        throw new Error(`Environment validation failed: ${errors.join(', ')}`);
    }
    
    return {
        valid: errors.length === 0,
        errors,
        warnings
    };
};

// Get environment info
const getEnvironmentInfo = () => {
    return {
        NODE_ENV,
        isProduction: NODE_ENV === 'production',
        isTest: NODE_ENV === 'test' || NODE_ENV === 'development',
        databasePath: getDatabasePath(),
        configPath: getConfigPath()
    };
};

module.exports = {
    NODE_ENV,
    getDatabasePath,
    getConfigPath,
    loadConfig,
    validateEnvironment,
    getEnvironmentInfo
};

