"use strict";

/**
 * Conversation State Handler
 * Menangani percakapan multi-step dengan user
 */

const fs = require("fs");
const path = require("path");
const { templatesCache } = require("../../lib/templating");

// Helper untuk format template
const format = (key, data = {}) => {
    let template = templatesCache.responseTemplates[key]?.template || '';
    for (const placeholder in data) {
        const regex = new RegExp(`\\$\\{${placeholder}\\}`, 'g');
        template = template.replace(regex, data[placeholder]);
    }
    return template;
};

// Message templates
const mess = {
    get owner() { return format('mess_owner'); },
    get userNotRegister() { return format('mess_userNotRegister'); },
    get notRegister() { return format('mess_notRegister'); },
    get notProfile() { return format('mess_notProfile'); },
    get onlyMonthly() { return format('mess_onlyMonthly'); },
    get wrongFormat() { return format('mess_wrongFormat'); },
    get mustNumber() { return format('mess_mustNumber'); },
    get teknisiOrOwnerOnly() { return format('mess_teknisiOrOwnerOnly'); },
    get teknisiOnly() { return format('mess_teknisiOnly'); },
    get reportNotFound() { return format('mess_reportNotFound'); },
    get reportAlreadyDone() { return format('mess_reportAlreadyDone'); },
    get reportNotFound_detail() { return format('mess_reportNotFound_detail'); },
    get reportAlreadyDone_detail() { return format('mess_reportAlreadyDone_detail'); },
};

// Temporary state storage
let temp = {};

// State timeout management
const STATE_TIMEOUT = 15 * 60 * 1000; // 15 minutes
const stateTimers = {};
const stateActivity = {}; // Track last activity time

/**
 * Get user state from temporary storage
 * @param {string} userId - User ID
 * @returns {Object|null} User state or null if not found
 */
function getUserState(userId) {
    if (temp[userId]) {
        // Update last activity time
        stateActivity[userId] = Date.now();
        // Reset timer on activity
        resetStateTimer(userId);
    }
    return temp[userId] || null;
}

/**
 * Set user state in temporary storage with auto-cleanup
 * @param {string} userId - User ID
 * @param {Object} state - State object to store
 */
function setUserState(userId, state) {
    // Clear existing timer if any
    if (stateTimers[userId]) {
        clearTimeout(stateTimers[userId]);
        delete stateTimers[userId];
    }
    
    temp[userId] = state;
    stateActivity[userId] = Date.now();
    
    // Set auto cleanup timer
    stateTimers[userId] = setTimeout(() => {
        console.log(`[AUTO-CLEANUP] Removing inactive state for user: ${userId}`);
        deleteUserState(userId);
    }, STATE_TIMEOUT);
}

/**
 * Delete user state from temporary storage
 * @param {string} userId - User ID
 */
function deleteUserState(userId) {
    // Clear timer if exists
    if (stateTimers[userId]) {
        clearTimeout(stateTimers[userId]);
        delete stateTimers[userId];
    }
    
    delete temp[userId];
    delete stateActivity[userId];
}

/**
 * Reset state timer (called on user activity)
 * @param {string} userId - User ID
 */
function resetStateTimer(userId) {
    if (stateTimers[userId]) {
        clearTimeout(stateTimers[userId]);
        
        stateTimers[userId] = setTimeout(() => {
            console.log(`[AUTO-CLEANUP] Removing inactive state for user: ${userId}`);
            deleteUserState(userId);
        }, STATE_TIMEOUT);
    }
}

/**
 * Check if user has active conversation state
 * @param {string} userId - User ID
 * @returns {boolean} True if user has active state
 */
function hasActiveState(userId) {
    return temp[userId] !== undefined;
}

/**
 * Clear all temporary states and timers
 */
function clearAllStates() {
    // Clear all timers first
    for (const userId in stateTimers) {
        clearTimeout(stateTimers[userId]);
    }
    
    // Clear all data
    temp = {};
    Object.keys(stateTimers).forEach(key => delete stateTimers[key]);
    Object.keys(stateActivity).forEach(key => delete stateActivity[key]);
}

/**
 * Get all active states (for debugging/monitoring)
 * @returns {Object} All active states with metadata
 */
function getAllStates() {
    const states = {};
    for (const userId in temp) {
        states[userId] = {
            state: temp[userId],
            lastActivity: stateActivity[userId] ? new Date(stateActivity[userId]).toISOString() : null,
            hasTimer: !!stateTimers[userId]
        };
    }
    return states;
}

/**
 * Get state statistics
 * @returns {Object} Statistics about active states
 */
function getStateStats() {
    return {
        activeStates: Object.keys(temp).length,
        activeTimers: Object.keys(stateTimers).length,
        oldestActivity: Math.min(...Object.values(stateActivity)) || null,
        newestActivity: Math.max(...Object.values(stateActivity)) || null
    };
}

module.exports = {
    getUserState,
    setUserState,
    deleteUserState,
    hasActiveState,
    clearAllStates,
    getAllStates,
    getStateStats,
    mess,
    format,
    STATE_TIMEOUT,
    // Aliases for compatibility
    setState: setUserState,
    clearState: deleteUserState,
    getState: getUserState
};
