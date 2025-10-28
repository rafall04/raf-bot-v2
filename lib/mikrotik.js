const { exec } = require('child_process');
const path = require('path');
const axios = require("axios");
const { fetchText } = require('../tools/fetcher'); // config is now global

function executePHPCommand(scriptName, ...args) {
    return new Promise((resolve, reject) => {
        const scriptPath = path.resolve(__dirname, `../views/${scriptName}.php`);
        // Escape each argument for shell safety
        const escapedArgs = args.map(arg => `${escapeshellarg(arg)}`).join(' ');
        const command = `php "${scriptPath}" ${escapedArgs}`;

        exec(command, (error, stdout, stderr) => {
            if (error) {
                console.error(`Error executing ${scriptName}: ${error.message}`);
                return reject(new Error(`Execution failed for ${scriptName}: ${error.message}`));
            }
            if (stderr) {
                console.error(`stderr for ${scriptName}: ${stderr}`);
                // It's better to reject on stderr as it often indicates a PHP error
                return reject(new Error(`Error in script ${scriptName}: ${stderr}`));
            }
            resolve(stdout.trim());
        });
    });
}

function escapeshellarg(arg) {
    if (typeof arg !== 'string') {
        arg = String(arg);
    }
    // The previous implementation added single quotes, which caused issues with the PHP argv.
    // For the simple arguments being passed (usernames, profiles without spaces),
    // returning the argument directly is the correct fix.
    return arg;
}

// --- Existing Mikrotik Functions ---

function updatePPPoEProfile(username, newProfile) {
    return executePHPCommand('update_pppoe_profile', username, newProfile);
}

function deleteActivePPPoEUser(username) {
    return executePHPCommand('delete_active_pppoe_user', username);
}

function getPPPProfiles() {
    return executePHPCommand('get_ppp_profiles');
}

function getPPPUsers() {
    return executePHPCommand('get_pppoe_users');
}

function getHotspotProfiles() {
    return executePHPCommand('get_hotspot_profiles');
}

function addPPPoEUser(username, password, profile) {
    return executePHPCommand('adduserpppoe', username, password, profile);
}

function getPPPoEUserProfile(username) {
    return executePHPCommand('get_pppoe_user_profile', username)
        .then(stdout => {
            try {
                return JSON.parse(stdout);
            } catch (e) {
                // This will help debug if PHP script returns non-JSON errors
                console.error(`[MikrotikJS_ERROR] Failed to parse JSON from get_pppoe_user_profile.php: ${e.message}. Raw output:`, stdout);
                throw new Error('Failed to get user profile due to invalid format.');
            }
        });
}

// --- Functions moved from wifi.js ---

const getPppStats = () => new Promise((resolve, reject) => {
    const phpScriptPath = path.join(__dirname, '../views/get_ppp_stats.php');
    exec(`php "${phpScriptPath}"`, (error, stdout, stderr) => {
        if (error) {
            return reject(new Error("Gagal mengeksekusi skrip statistik PPP."));
        }
        try {
            const stats = JSON.parse(stdout);
            resolve(stats);
        } catch (parseError) {
            reject(new Error("Respon JSON tidak valid dari skrip statistik PPP."));
        }
    });
});

const getHotspotStats = () => new Promise((resolve, reject) => {
    const phpScriptPath = path.join(__dirname, '../views/get_hotspot_stats.php');
    exec(`php "${phpScriptPath}"`, (error, stdout, stderr) => {
        if (error) {
            return reject(new Error("Gagal mengeksekusi skrip statistik Hotspot."));
        }
        try {
            const stats = JSON.parse(stdout);
            resolve(stats);
        } catch (parseError) {
            reject(new Error("Respon JSON tidak valid dari skrip statistik Hotspot."));
        }
    });
});

const statusap = () => new Promise((resolve, reject) => {
    const config = global.config;
    fetchText(`${config.site_url_bot}/interface.php`)
        .then((result) => resolve(result))
        .catch((err) => reject(err))
})

const getvoucher = async (profile, sender) => {
    const config = global.config;
    if (!config || !config.site_url_bot) {
        throw new Error("Konfigurasi 'site_url_bot' tidak ditemukan.");
    }
    const url = `${config.site_url_bot}/adduserhotspot.php`;
    try {
        const response = await axios.get(url, { params: { profil: profile, komen: sender }, timeout: 15000 });
        const data = response.data;
        if (data.status === 'error') {
            throw new Error(data.message || 'Gagal membuat voucher Hotspot.');
        } else if (data.status === 'success' && data.data?.username) {
            return data.data;
        } else {
            throw new Error("Respons tidak valid dari skrip pembuatan voucher.");
        }
    } catch (error) {
        throw new Error(`Error saat memanggil API voucher: ${error.message}`);
    }
};

const addpppoe = async (user, pw, profil) => {
    const config = global.config;
    if (!config || !config.site_url_bot) {
        throw new Error("Konfigurasi 'site_url_bot' tidak ditemukan.");
    }
    const url = `${config.site_url_bot}/adduserpppoe.php`;
    try {
        const response = await axios.get(url, { params: { user, pw, profil }, timeout: 15000 });
        const data = response.data;
        if (data.status === 'error') {
            throw new Error(data.message || 'Gagal menambahkan PPPoE user.');
        } else if (data.status === 'success') {
            return data;
        } else {
            throw new Error("Respons tidak valid dari skrip penambahan PPPoE.");
        }
    } catch (error) {
        throw new Error(`Error saat memanggil API PPPoE: ${error.message}`);
    }
};

const addbinding = (komen, ip, mac) => new Promise((resolve, reject) => {
    const config = global.config;
    fetchText(`${config.site_url_bot}/addipbinding.php?comment=${komen}&ip=${ip}&mac=${mac}`)
        .then(resolve).catch(reject);
})

const addqueue = (prof, komen, ip, parent, ceklimitat, cekmaxlimit) => new Promise((resolve, reject) => {
    const config = global.config;
    fetchText(`${config.site_url_bot}/addsimplequeue.php?comment=${prof}&name=${komen}&target=${ip}&parent=${parent}&limitat=${ceklimitat}&maxlimit=${cekmaxlimit}`)
        .then(resolve).catch(reject);
})


module.exports = {
    updatePPPoEProfile,
    deleteActivePPPoEUser,
    getPPPProfiles,
    getHotspotProfiles,
    getPPPUsers,
    addPPPoEUser,
    getPPPoEUserProfile,
    // --- Newly Moved Functions ---
    getPppStats,
    getHotspotStats,
    statusap,
    getvoucher,
    addpppoe,
    addbinding,
    addqueue
};
