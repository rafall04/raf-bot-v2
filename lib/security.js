// Security utilities for RAF-BOT v2
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

// Rate limiting storage
const rateLimitStore = new Map();

/**
 * Generate CSRF token
 */
function generateCSRFToken() {
    return crypto.randomBytes(32).toString('hex');
}

/**
 * Verify CSRF token
 */
function verifyCSRFToken(token, sessionToken) {
    if (!token || !sessionToken) return false;
    return crypto.timingSafeEqual(
        Buffer.from(token),
        Buffer.from(sessionToken)
    );
}

/**
 * Rate limiting middleware
 * @param {string} identifier - Unique identifier for rate limiting (e.g., 'api-requests')
 * @param {number} maxRequests - Maximum requests allowed
 * @param {number} windowMs - Time window in milliseconds
 */
function rateLimit(identifier, maxRequests = 10, windowMs = 60000) {
    return (req, res, next) => {
        const key = `${identifier}-${req.user?.id || req.ip}`;
        const now = Date.now();
        
        if (!rateLimitStore.has(key)) {
            rateLimitStore.set(key, {
                requests: [],
                blocked: false
            });
        }
        
        const userData = rateLimitStore.get(key);
        
        // Clean old requests outside window
        userData.requests = userData.requests.filter(timestamp => 
            now - timestamp < windowMs
        );
        
        // Check if blocked
        if (userData.blocked && now - userData.blockedAt < windowMs * 2) {
            return res.status(429).json({
                status: 429,
                message: 'Terlalu banyak permintaan. Silakan coba lagi nanti.',
                retryAfter: Math.ceil((userData.blockedAt + windowMs * 2 - now) / 1000)
            });
        }
        
        // Check rate limit
        if (userData.requests.length >= maxRequests) {
            userData.blocked = true;
            userData.blockedAt = now;
            return res.status(429).json({
                status: 429,
                message: 'Terlalu banyak permintaan. Silakan coba lagi nanti.',
                retryAfter: Math.ceil(windowMs * 2 / 1000)
            });
        }
        
        // Add current request
        userData.requests.push(now);
        userData.blocked = false;
        
        next();
    };
}

/**
 * Input validation and sanitization
 */
function validateInput(input, type = 'string', options = {}) {
    if (input === null || input === undefined) {
        if (options.required) {
            throw new Error('Input is required');
        }
        return null;
    }
    
    switch (type) {
        case 'string':
            if (typeof input !== 'string') {
                throw new Error('Input must be a string');
            }
            // Remove potential XSS vectors
            input = input.trim();
            if (options.maxLength && input.length > options.maxLength) {
                throw new Error(`Input exceeds maximum length of ${options.maxLength}`);
            }
            if (options.minLength && input.length < options.minLength) {
                throw new Error(`Input must be at least ${options.minLength} characters`);
            }
            if (options.pattern && !options.pattern.test(input)) {
                throw new Error('Input format is invalid');
            }
            // Basic XSS prevention
            if (!options.allowHtml) {
                input = input.replace(/[<>]/g, '');
            }
            return input;
            
        case 'number':
            const num = Number(input);
            if (isNaN(num)) {
                throw new Error('Input must be a number');
            }
            if (options.min !== undefined && num < options.min) {
                throw new Error(`Input must be at least ${options.min}`);
            }
            if (options.max !== undefined && num > options.max) {
                throw new Error(`Input must not exceed ${options.max}`);
            }
            return num;
            
        case 'boolean':
            if (typeof input === 'boolean') return input;
            if (input === 'true' || input === '1' || input === 1) return true;
            if (input === 'false' || input === '0' || input === 0) return false;
            throw new Error('Input must be a boolean');
            
        case 'id':
            // Validate ID format (alphanumeric and common separators)
            if (typeof input !== 'string' && typeof input !== 'number') {
                throw new Error('ID must be a string or number');
            }
            const idStr = String(input).trim();
            if (!/^[a-zA-Z0-9_\-]+$/.test(idStr)) {
                throw new Error('Invalid ID format');
            }
            if (options.maxLength && idStr.length > options.maxLength) {
                throw new Error(`ID exceeds maximum length of ${options.maxLength}`);
            }
            return idStr;
            
        case 'array':
            if (!Array.isArray(input)) {
                throw new Error('Input must be an array');
            }
            if (options.maxItems && input.length > options.maxItems) {
                throw new Error(`Array exceeds maximum items of ${options.maxItems}`);
            }
            if (options.minItems && input.length < options.minItems) {
                throw new Error(`Array must have at least ${options.minItems} items`);
            }
            return input;
            
        default:
            return input;
    }
}

/**
 * Sanitize output for HTML display
 */
function sanitizeHtml(str) {
    if (typeof str !== 'string') return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;');
}

/**
 * Generate secure random token
 */
function generateSecureToken(length = 32) {
    return crypto.randomBytes(length).toString('hex');
}

/**
 * Hash password using crypto
 */
function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
    return `${salt}:${hash}`;
}

/**
 * Verify password hash
 */
function verifyPassword(password, storedHash) {
    const [salt, hash] = storedHash.split(':');
    const verifyHash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
    return hash === verifyHash;
}

/**
 * Clean up old rate limit entries (run periodically)
 */
function cleanupRateLimits() {
    const now = Date.now();
    const maxAge = 3600000; // 1 hour
    
    for (const [key, data] of rateLimitStore.entries()) {
        const lastRequest = Math.max(...data.requests, data.blockedAt || 0);
        if (now - lastRequest > maxAge) {
            rateLimitStore.delete(key);
        }
    }
}

// Run cleanup every 10 minutes
setInterval(cleanupRateLimits, 600000);

module.exports = {
    generateCSRFToken,
    verifyCSRFToken,
    rateLimit,
    validateInput,
    sanitizeHtml,
    generateSecureToken,
    hashPassword,
    verifyPassword,
    cleanupRateLimits
};
