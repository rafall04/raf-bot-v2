/**
 * International Phone Number Validation Module
 * Supports multiple countries and formats
 * Ensures phone numbers are unique across all users
 */

/**
 * Country phone configurations
 */
const COUNTRY_CONFIGS = {
    // Indonesia
    ID: {
        code: '62',
        patterns: [
            /^08\d{8,11}$/,       // 08xxxxxxxxx (local)
            /^628\d{8,11}$/,      // 628xxxxxxxxx (international)
            /^\+628\d{8,11}$/     // +628xxxxxxxxx (with plus)
        ],
        localPrefix: '08',
        minLength: 10,
        maxLength: 13
    },
    // Malaysia
    MY: {
        code: '60',
        patterns: [
            /^01\d{7,9}$/,        // 01xxxxxxxx (local)
            /^601\d{7,9}$/,       // 601xxxxxxxx (international)
            /^\+601\d{7,9}$/      // +601xxxxxxxx (with plus)
        ],
        localPrefix: '01',
        minLength: 9,
        maxLength: 11
    },
    // Singapore
    SG: {
        code: '65',
        patterns: [
            /^[89]\d{7}$/,        // 8xxxxxxx or 9xxxxxxx (local)
            /^65[89]\d{7}$/,      // 658xxxxxxx (international)
            /^\+65[89]\d{7}$/     // +658xxxxxxx (with plus)
        ],
        localPrefix: '',
        minLength: 8,
        maxLength: 8
    },
    // Thailand
    TH: {
        code: '66',
        patterns: [
            /^0[689]\d{7,8}$/,    // 08xxxxxxxx (local)
            /^66[689]\d{7,8}$/,   // 668xxxxxxxx (international)
            /^\+66[689]\d{7,8}$/  // +668xxxxxxxx (with plus)
        ],
        localPrefix: '0',
        minLength: 9,
        maxLength: 10
    },
    // Philippines
    PH: {
        code: '63',
        patterns: [
            /^09\d{9}$/,          // 09xxxxxxxxx (local)
            /^639\d{9}$/,         // 639xxxxxxxxx (international)
            /^\+639\d{9}$/        // +639xxxxxxxxx (with plus)
        ],
        localPrefix: '09',
        minLength: 11,
        maxLength: 11
    },
    // India
    IN: {
        code: '91',
        patterns: [
            /^[6-9]\d{9}$/,       // 9xxxxxxxxx (local mobile)
            /^91[6-9]\d{9}$/,     // 919xxxxxxxxx (international)
            /^\+91[6-9]\d{9}$/    // +919xxxxxxxxx (with plus)
        ],
        localPrefix: '',
        minLength: 10,
        maxLength: 10
    },
    // USA/Canada
    US: {
        code: '1',
        patterns: [
            /^[2-9]\d{2}[2-9]\d{6}$/, // 2123456789 (local)
            /^1[2-9]\d{2}[2-9]\d{6}$/, // 12123456789 (international)
            /^\+1[2-9]\d{2}[2-9]\d{6}$/ // +12123456789 (with plus)
        ],
        localPrefix: '',
        minLength: 10,
        maxLength: 10
    },
    // United Kingdom
    GB: {
        code: '44',
        patterns: [
            /^07\d{9}$/,          // 07xxxxxxxxx (local mobile)
            /^447\d{9}$/,         // 447xxxxxxxxx (international)
            /^\+447\d{9}$/        // +447xxxxxxxxx (with plus)
        ],
        localPrefix: '07',
        minLength: 11,
        maxLength: 11
    },
    // Australia
    AU: {
        code: '61',
        patterns: [
            /^04\d{8}$/,          // 04xxxxxxxx (local mobile)
            /^614\d{8}$/,         // 614xxxxxxxx (international)
            /^\+614\d{8}$/        // +614xxxxxxxx (with plus)
        ],
        localPrefix: '04',
        minLength: 10,
        maxLength: 10
    },
    // Generic International (fallback)
    INTERNATIONAL: {
        code: '',
        patterns: [
            /^\+\d{7,15}$/,       // E.164 format (+1 to +999 followed by digits)
            /^\d{7,15}$/          // Just digits (7-15 is typical for most countries)
        ],
        localPrefix: '',
        minLength: 7,
        maxLength: 15
    }
};

/**
 * Detect country from phone number
 * @param {string} phone - Phone number to detect
 * @returns {string} - Country code or 'UNKNOWN'
 */
function detectCountry(phone) {
    const cleaned = phone.replace(/[\s\-\(\)]/g, '');
    
    // Check each country's patterns
    for (const [country, config] of Object.entries(COUNTRY_CONFIGS)) {
        if (country === 'INTERNATIONAL') continue; // Skip generic pattern
        
        for (const pattern of config.patterns) {
            if (pattern.test(cleaned)) {
                return country;
            }
        }
    }
    
    // If starts with + and digits, it's international format
    if (/^\+\d+$/.test(cleaned)) {
        // Try to match by country code
        for (const [country, config] of Object.entries(COUNTRY_CONFIGS)) {
            if (config.code && cleaned.startsWith('+' + config.code)) {
                return country;
            }
        }
        return 'INTERNATIONAL';
    }
    
    // Default to Indonesia if just digits (backward compatibility)
    if (/^08\d+$/.test(cleaned)) {
        return 'ID';
    }
    
    // Check if it's a valid international number
    if (COUNTRY_CONFIGS.INTERNATIONAL.patterns.some(p => p.test(cleaned))) {
        return 'INTERNATIONAL';
    }
    
    return 'UNKNOWN';
}

/**
 * Validate phone format (international support)
 * @param {string} phone - Phone number to validate
 * @param {string} defaultCountry - Default country code (optional)
 * @returns {Object} - Validation result with country detection
 */
function isValidPhoneFormat(phone, defaultCountry = 'ID') {
    const cleaned = phone.replace(/[\s\-\(\)]/g, '');
    
    // Detect country
    let country = detectCountry(cleaned);
    
    // If unknown and default country provided, try that
    if (country === 'UNKNOWN' && defaultCountry) {
        const config = COUNTRY_CONFIGS[defaultCountry];
        if (config) {
            for (const pattern of config.patterns) {
                if (pattern.test(cleaned)) {
                    country = defaultCountry;
                    break;
                }
            }
        }
    }
    
    // If still unknown, check international format
    if (country === 'UNKNOWN') {
        const isInternational = COUNTRY_CONFIGS.INTERNATIONAL.patterns.some(p => p.test(cleaned));
        if (isInternational) {
            country = 'INTERNATIONAL';
        }
    }
    
    return {
        valid: country !== 'UNKNOWN',
        country: country,
        format: country !== 'UNKNOWN' ? 'Valid' : 'Invalid',
        cleaned: cleaned
    };
}

/**
 * Normalize phone number to E.164 format
 * @param {string} phone - Phone number to normalize
 * @param {string} defaultCountry - Default country if not specified
 * @returns {string} - Normalized phone in international format
 */
function normalizePhone(phone, defaultCountry = 'ID') {
    const cleaned = phone.replace(/\D/g, '');
    const validation = isValidPhoneFormat(phone, defaultCountry);
    
    if (!validation.valid) {
        return phone; // Return as-is if invalid
    }
    
    const country = validation.country;
    const config = COUNTRY_CONFIGS[country];
    
    if (!config || country === 'INTERNATIONAL') {
        // Already in international format or generic
        if (cleaned.startsWith('+')) {
            return cleaned;
        }
        return '+' + cleaned;
    }
    
    // Handle country-specific normalization
    if (config.localPrefix && cleaned.startsWith(config.localPrefix.replace(/^0/, ''))) {
        // Local format - add country code
        const withoutPrefix = cleaned.substring(config.localPrefix.length - 1);
        return config.code + withoutPrefix;
    } else if (cleaned.startsWith(config.code)) {
        // Already has country code
        return cleaned;
    } else if (cleaned.startsWith('0')) {
        // Starts with 0 (common for local)
        return config.code + cleaned.substring(1);
    } else {
        // Assume it needs country code
        return config.code + cleaned;
    }
}

/**
 * Check if a phone number already exists in the database
 * @param {Object} db - Database connection
 * @param {string} phoneNumber - Phone number to check
 * @param {string} excludeUserId - User ID to exclude from check (for updates)
 * @returns {Promise<Object|null>} - Returns user object if exists, null otherwise
 */
async function checkPhoneExists(db, phoneNumber, excludeUserId = null) {
    return new Promise((resolve, reject) => {
        // Normalize phone number for comparison
        const normalized = normalizePhone(phoneNumber);
        
        // Build query
        let query = `
            SELECT id, name, phone_number 
            FROM users 
            WHERE phone_number LIKE ?
        `;
        
        const params = [`%${normalized}%`];
        
        // Exclude current user if updating
        if (excludeUserId) {
            query += ` AND id != ?`;
            params.push(excludeUserId);
        }
        
        db.get(query, params, (err, row) => {
            if (err) {
                console.error('[PHONE_VALIDATOR] Error checking phone:', err);
                reject(err);
            } else {
                resolve(row || null);
            }
        });
    });
}

/**
 * Validate multiple phone numbers (pipe-separated)
 * @param {Object} db - Database connection
 * @param {string} phoneNumbers - Pipe-separated phone numbers
 * @param {string} excludeUserId - User ID to exclude from check
 * @param {string} defaultCountry - Default country for validation
 * @returns {Promise<Object>} - Validation result
 */
async function validatePhoneNumbers(db, phoneNumbers, excludeUserId = null, defaultCountry = 'ID') {
    if (!phoneNumbers) {
        return {
            valid: false,
            message: 'Phone number cannot be empty'
        };
    }
    
    // Split multiple phones and normalize
    const phones = phoneNumbers.split('|').map(p => p.trim()).filter(p => p);
    
    if (phones.length === 0) {
        return {
            valid: false,
            message: 'Invalid phone number'
        };
    }
    
    const phoneDetails = [];
    
    // Validate format for each phone
    for (const phone of phones) {
        const validation = isValidPhoneFormat(phone, defaultCountry);
        
        if (!validation.valid) {
            return {
                valid: false,
                message: `Invalid phone format: ${phone}. Supported countries: Indonesia, Malaysia, Singapore, Thailand, Philippines, India, USA, UK, Australia, or use international format (+country_code)`
            };
        }
        
        phoneDetails.push({
            original: phone,
            normalized: normalizePhone(phone, defaultCountry),
            country: validation.country
        });
    }
    
    // Check each phone number for duplicates in database
    for (const phoneDetail of phoneDetails) {
        try {
            const existingUser = await checkPhoneExists(db, phoneDetail.normalized, excludeUserId);
            
            if (existingUser) {
                const isOwnNumber = excludeUserId && existingUser.id === excludeUserId;
                
                if (!isOwnNumber) {
                    return {
                        valid: false,
                        message: `Phone number ${phoneDetail.original} (${phoneDetail.country}) is already registered to ${existingUser.name} (ID: ${existingUser.id})`,
                        conflictUser: existingUser
                    };
                }
            }
        } catch (error) {
            console.error('[PHONE_VALIDATOR] Error validating phone:', phoneDetail.original, error);
            return {
                valid: false,
                message: `Error validating phone ${phoneDetail.original}: ${error.message}`
            };
        }
    }
    
    // Check for duplicates within the input
    const normalizedPhones = phoneDetails.map(pd => pd.normalized);
    const uniquePhones = new Set(normalizedPhones);
    if (uniquePhones.size !== normalizedPhones.length) {
        return {
            valid: false,
            message: 'Duplicate phone numbers found in input'
        };
    }
    
    return {
        valid: true,
        message: 'OK',
        phones: phoneDetails,
        countries: [...new Set(phoneDetails.map(pd => pd.country))]
    };
}

/**
 * Get supported countries list
 * @returns {Array} - List of supported countries with details
 */
function getSupportedCountries() {
    return Object.entries(COUNTRY_CONFIGS)
        .filter(([code]) => code !== 'INTERNATIONAL')
        .map(([code, config]) => ({
            code: code,
            countryCode: config.code,
            name: getCountryName(code),
            example: getExampleNumber(code)
        }));
}

/**
 * Get country name from code
 * @param {string} code - Country code
 * @returns {string} - Country name
 */
function getCountryName(code) {
    const names = {
        ID: 'Indonesia',
        MY: 'Malaysia',
        SG: 'Singapore',
        TH: 'Thailand',
        PH: 'Philippines',
        IN: 'India',
        US: 'USA/Canada',
        GB: 'United Kingdom',
        AU: 'Australia',
        INTERNATIONAL: 'International'
    };
    return names[code] || code;
}

/**
 * Get example phone number for country
 * @param {string} code - Country code
 * @returns {string} - Example number
 */
function getExampleNumber(code) {
    const examples = {
        ID: '081234567890',
        MY: '0123456789',
        SG: '91234567',
        TH: '0812345678',
        PH: '09123456789',
        IN: '9876543210',
        US: '2125551234',
        GB: '07123456789',
        AU: '0412345678',
        INTERNATIONAL: '+1234567890'
    };
    return examples[code] || '';
}

module.exports = {
    checkPhoneExists,
    validatePhoneNumbers,
    isValidPhoneFormat,
    normalizePhone,
    detectCountry,
    getSupportedCountries,
    getCountryName,
    COUNTRY_CONFIGS
};
