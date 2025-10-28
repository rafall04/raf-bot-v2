const fs = require('fs');
const path = require('path');

const templatesPath = path.join(__dirname, '../database/wifi_templates.json');
let wifiTemplates = [];

// Function to load or reload templates from the JSON file
function loadWifiTemplates() {
    try {
        const templatesData = fs.readFileSync(templatesPath, 'utf8');
        wifiTemplates = JSON.parse(templatesData);
        console.log('[WiFi_Template_Handler] Successfully loaded wifi_templates.json.');
    } catch (error) {
        console.error('[WiFi_Template_Handler] Error loading wifi_templates.json:', error);
        wifiTemplates = [];
    }
}

// Initial load of the templates
loadWifiTemplates();

// Watch for changes in the template file and reload it automatically
// Skip watching in test environment to prevent stuck processes
if (process.env.NODE_ENV !== 'test' && process.env.DISABLE_FILE_WATCHERS !== 'true') {
    fs.watchFile(templatesPath, (curr, prev) => {
        console.log('[WiFi_Template_Handler] wifi_templates.json file changed, reloading templates.');
        loadWifiTemplates();
    });
}

/**
 * Checks a user's message against a list of keywords to determine an intent.
 * @param {string} message - The incoming message text from the user.
 * @returns {object|null} Object with intent and matchedKeywordLength, or null if no match.
 */
function getIntentFromKeywords(message) {
    if (!message || message.trim() === '') {
        return null;
    }

    const lowerCaseMessage = message.toLowerCase();
    let bestMatch = null;
    let longestKeywordLength = 0;

    // Collect all possible matches first
    for (const template of wifiTemplates) {
        for (const keyword of template.keywords) {
            // CRITICAL: Only match keywords at START of message to prevent false positives
            // Example: "masmau konsultasi tentang topup" should NOT match "topup"
            // Only "topup 50000" or "topup" at start should match
            const escapedKeyword = keyword.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const keywordRegex = new RegExp(`^${escapedKeyword}(?:\\s|$)`, 'i');
            if (keywordRegex.test(lowerCaseMessage)) {
                // Hitung jumlah kata dalam keyword yang cocok
                const matchedKeywordLength = keyword.trim().split(/\s+/).length;
                
                // Prioritize longer keywords (more specific matches)
                if (matchedKeywordLength > longestKeywordLength) {
                    longestKeywordLength = matchedKeywordLength;
                    bestMatch = {
                        intent: template.intent,
                        matchedKeywordLength: matchedKeywordLength,
                        matchedKeyword: keyword
                    };
                }
            }
        }
    }

    // Return the best match (longest keyword)
    return bestMatch;
}

module.exports = {
    getIntentFromKeywords
};
