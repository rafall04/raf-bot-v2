const bcrypt = require('bcrypt');
const saltRounds = 10;

/**
 * Hashes a plaintext password using bcrypt.
 * @param {string} password The plaintext password.
 * @returns {Promise<string>} A promise that resolves to the hashed password.
 */
async function hashPassword(password) {
    if (!password) {
        return null;
    }
    return await bcrypt.hash(password, saltRounds);
}

/**
 * Compares a plaintext password with a bcrypt hash.
 * @param {string} password The plaintext password to compare.
 * @param {string} hash The hash to compare against.
 * @returns {Promise<boolean>} A promise that resolves to true if the password matches the hash, otherwise false.
 */
async function comparePassword(password, hash) {
    if (!password || !hash) {
        return false;
    }
    return await bcrypt.compare(password, hash);
}

module.exports = {
    hashPassword,
    comparePassword
};
