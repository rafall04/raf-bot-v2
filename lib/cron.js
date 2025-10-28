const fs = require('fs');
const path = require('path');
const cron = require('node-cron');
const cronValidator = require('cron-validator');
const axios = require('axios');

// Dependencies from other lib modules
const { renderTemplate, templatesCache } = require('./templating');
const { updatePPPoEProfile, deleteActivePPPoEUser, getPPPoEUserProfile } = require('./mikrotik');
const { rebootRouter, performAllDevicesRedamanCheck, REDAMAN_PATHS } = require('./wifi');
const { saveCompensations, saveSpeedRequests } = require('./database');
const { getProfileBySubscription } = require('./myfunc');
const formatRupiah = require('rupiah-format');

// Path definition
const compensationsDbPath = path.join(__dirname, '..', 'database', 'compensations.json');

// Global variables to hold cron task instances
let cronTaskReminder = null;
let cronTaskSetUnpaid = null;
let cronTaskUnpaidAction = null;
let cronTaskIsolirNotification = null;
let cronTaskCompensationRevert = null;
let cronTaskSpeedRequestRevert = null;
let checkTask = null;

function isValidCron(cronExpression) {
    return cronValidator.isValidCron(cronExpression, { alias: true, allowBlankDay: true });
}

// Helper function to safely get nested property value (adapted from lib/wifi.js)
const getNestedValue = (obj, path) => {
    if (!path) return undefined;
    const parts = path.split('.');
    let current = obj;
    for (const part of parts) {
        if (current && typeof current === 'object' && Object.prototype.hasOwnProperty.call(current, part)) {
            current = current[part];
        } else {
            return undefined;
        }
    }
    return current;
};

function replacer(str, dataMsg = {}) {
  for (let msg in dataMsg) {
    str = str.replaceAll(`%${msg}`, dataMsg[msg]);
  }
  return str;
}

// --- Individual Cron Task Initializers ---

function generateReminderData(user) {
    const packageInfo = global.packages.find(p => p.name === user.subscription) || {};
    const price = packageInfo.price ? formatRupiah.convert(packageInfo.price) : 'Tidak diketahui';

    const dueDate = new Date();
    dueDate.setDate(global.config.tanggal_batas_bayar || 10);
    const formattedDueDate = dueDate.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });

    return {
        nama: user.name,
        nama_layanan: global.config.nama || 'Layanan Kami',
        nama_paket: user.subscription,
        harga_paket: price,
        tanggal_jatuh_tempo: formattedDueDate,
    };
}

function initReminderTask(config) {
    if (cronTaskReminder) cronTaskReminder.stop();
    if (config.status_schedule === true && isValidCron(config.schedule)) {
        console.log("[CRON_REMINDER] Starting/Restarting reminder task with schedule:", config.schedule);
        cronTaskReminder = cron.schedule(config.schedule, async () => {
            const currentConfig = loadCronConfig();
            if (currentConfig.status_schedule !== true) return;

            const now = new Date();
            const currentDay = now.getDate();
            const reminderDay = (global.config && parseInt(global.config.tanggal_pengingat)) || 1;

            if (currentDay === reminderDay) {
                console.log(`[CRON_REMINDER] Task executed at: ${new Date().toLocaleString('id-ID')}. Today is reminder day.`);
                const whitelistedProfile = global.packages.filter(v => v.whitelist).map(v => v.profile);

                for (let user of global.users) {
                    const userProfile = getProfileBySubscription(user.subscription);
                    if (!whitelistedProfile.includes(userProfile) && !user.paid) {
                        
                        const packageInfo = global.packages.find(p => p.name === user.subscription) || {};
                        
                        // Periode adalah bulan ini (bukan bulan depan)
                        const currentMonth = new Date();
                        const periode = currentMonth.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });

                        // Jatuh tempo adalah tanggal batas bayar di bulan ini
                        const dueDate = new Date();
                        const batasBayar = global.config.tanggal_batas_bayar || 10;
                        dueDate.setDate(batasBayar);
                        const jatuh_tempo = dueDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

                        const templateData = {
                            nama: user.name,
                            paket: user.subscription,
                            harga: packageInfo.price || 0,
                            jatuh_tempo: jatuh_tempo,
                            periode: periode
                        };
                        
                        const messageText = renderTemplate('unpaid_reminder', templateData);

                        if (user.phone_number && global.conn) {
                            const phoneNumbers = user.phone_number.split('|');
                            for (let number of phoneNumbers) {
                                const { delay } = await import('@whiskeysockets/baileys');
                                const normalizedNumber = number.trim() + "@s.whatsapp.net";
                                
                                if (normalizedNumber.length > 15) {
                                    try {
                                        await global.conn.sendMessage(normalizedNumber, { text: messageText });
                                        console.log(`[CRON_REMINDER] Reminder sent to ${user.name} at ${normalizedNumber}`);
                                        await delay(1000);
                                    } catch (e) {
                                        console.error(`[CRON_REMINDER_ERROR] Failed to send reminder to ${normalizedNumber} for user ${user.name}:`, e.message);
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });
    } else {
        console.log("[CRON_REMINDER] Reminder task is disabled or has an invalid schedule.");
    }
}

function initSetUnpaidTask(config) {
    if (cronTaskSetUnpaid) cronTaskSetUnpaid.stop();
    if (config.status_unpaid_schedule === true && isValidCron(config.unpaid_schedule)) {
        console.log("[CRON_SET_UNPAID] Starting/Restarting set-unpaid task with schedule:", config.unpaid_schedule);
        cronTaskSetUnpaid = cron.schedule(config.unpaid_schedule, async () => {
            const currentConfig = loadCronConfig();
            if (currentConfig.status_unpaid_schedule !== true) return;

            const whitelistedProfile = global.packages.filter(v => v.whitelist).map(v => v.profile);
            global.users.forEach(user => {
                const userProfile = getProfileBySubscription(user.subscription);
                if (!whitelistedProfile.includes(userProfile) && user.paid) {
                     global.db.run('UPDATE users SET paid = ? WHERE id = ?', [0, user.id], (err) => {
                        if(err) return console.error(`[CRON_UNPAID_RESET_ERROR] Failed to update user ${user.id}: ${err.message}`);
                        user.paid = 0;
                    });
                }
            });
        });
    } else {
        console.log("[CRON_SET_UNPAID] Set-unpaid task is disabled or has an invalid schedule.");
    }
}

function initIsolirTask(config) {
    if (cronTaskUnpaidAction) cronTaskUnpaidAction.stop();
    if (config.status_schedule_unpaid_action === true && isValidCron(config.schedule_unpaid_action)) {
        console.log("[CRON_ISOLIR_ACTION] Starting/Restarting isolir action task with schedule:", config.schedule_unpaid_action);
        cronTaskUnpaidAction = cron.schedule(config.schedule_unpaid_action, async () => {
            const isolirDay = (global.config && parseInt(global.config.tanggal_isolir)) || 11;
            const currentDay = new Date().getDate();

            if (currentDay < isolirDay) {
                console.log(`[CRON_ISOLIR_ACTION_SKIPPED] Today (day ${currentDay}) is before the configured isolation day (${isolirDay}). No action will be taken.`);
                return;
            }

            console.log(`[CRON_ISOLIR_ACTION_STARTED] Today is day ${currentDay}, which is on or after the isolation day (${isolirDay}). Starting isolation process for unpaid users.`);
            const isolirProfileToUse = global.config.isolir_profile;
            if (!isolirProfileToUse) {
                console.error("[CRON_ISOLIR_ACTION_ERROR] `isolir_profile` is not defined in config.json. Cannot proceed.");
                return;
            }

            // Check if sync to MikroTik is enabled
            const syncToMikrotik = global.config.sync_to_mikrotik !== false; // Default to true if not set
            
            if (!syncToMikrotik) {
                console.log("[CRON_ISOLIR_ACTION] Sync to MikroTik is DISABLED - skipping isolir action.");
                return;
            }

            const whitelistedProfile = global.packages.filter(v => v.whitelist).map(v => v.profile);
            for (let user of global.users) {
                const userProfile = getProfileBySubscription(user.subscription);
                if (!user.paid && !whitelistedProfile.includes(userProfile) && userProfile !== isolirProfileToUse) {
                    if (user.pppoe_username) {
                        console.log(`[CRON_ISOLIR_ACTION] Attempting to isolate user: ${user.pppoe_username} with profile: "${isolirProfileToUse}"`);
                        updatePPPoEProfile(user.pppoe_username, isolirProfileToUse)
                            .then(() => {
                                console.log(`[CRON_ISOLIR_SUCCESS] Profile updated for ${user.pppoe_username}. Now disconnecting session.`);
                                return deleteActivePPPoEUser(user.pppoe_username);
                            })
                            .then(() => {
                                console.log(`[CRON_ISOLIR_SUCCESS] Session disconnected for ${user.pppoe_username}.`);
                                if (user.device_id) {
                                    console.log(`[CRON_ISOLIR_ACTION] Attempting to reboot router ${user.device_id} for user ${user.pppoe_username}.`);
                                    return rebootRouter(user.device_id);
                                }
                            })
                            .catch(e => console.error(`[CRON_ISOLIR_ACTION_ERROR] Full process failed for user ${user.name}:`, e.message || e));
                    }
                }
            }
        });
    } else {
        console.log("[CRON_ISOLIR_ACTION] Isolir action task is disabled or has an invalid schedule.");
    }
}

function initIsolirNotificationTask(config) {
    if (cronTaskIsolirNotification) cronTaskIsolirNotification.stop();
    if (config.status_message_isolir_notification === true && isValidCron(config.schedule_isolir_notification)) {
        console.log("[CRON_ISOLIR_NOTIF] Starting/Restarting isolir notification task with schedule:", config.schedule_isolir_notification);
        cronTaskIsolirNotification = cron.schedule(config.schedule_isolir_notification, async () => {
            const isolirProfileToUse = global.config.isolir_profile;
            if (!isolirProfileToUse) {
                console.error("[CRON_ISOLIR_NOTIF_ERROR] `isolir_profile` is not defined in config.json. Cannot send notifications.");
                return;
            }

            console.log(`[CRON_ISOLIR_NOTIF] Task executed at: ${new Date().toLocaleString('id-ID')}. Checking for isolated users.`);

            for (let user of global.users) {
                // Skip users without a PPPoE username
                if (!user.pppoe_username) continue;

                try {
                    // Get the user's LIVE profile from MikroTik
                    const liveProfileData = await getPPPoEUserProfile(user.pppoe_username);
                    const liveProfile = liveProfileData.profile;

                    // Check if the user is currently isolated
                    if (liveProfile === isolirProfileToUse) {
                        if (user.phone_number && global.conn) {
                            const phoneNumbers = user.phone_number.split('|');
                            const { delay } = await import('@whiskeysockets/baileys');
                            for (let number of phoneNumbers) {
                                const normalizedNumber = number.trim().replace(/\D/g, ''); // Clean non-digit characters

                                if (normalizedNumber.length > 5) { // Basic validation
                                    const jid = normalizedNumber + "@s.whatsapp.net";
                                    try {
                                        const message = renderTemplate('isolir_notification', {
                                            nama: user.name,
                                            periode: new Date().toLocaleString('id-ID', { month: 'long', year: 'numeric' })
                                        });

                                        await global.conn.sendMessage(jid, { text: message });
                                        console.log(`[CRON_ISOLIR_NOTIF] Notification sent to ${user.name} at ${jid}`);
                                        await delay(1000); // Avoid spamming
                                    } catch (e) {
                                        console.error(`[CRON_ISOLIR_NOTIF_SEND_ERROR] Failed to send to ${jid} for user ${user.name}:`, e.message);
                                    }
                                }
                            }
                        }
                    }
                } catch (error) {
                    // This error is from getPPPoEUserProfile, likely user not found on router or API error
                    console.error(`[CRON_ISOLIR_NOTIF_FETCH_ERROR] Could not get profile for user ${user.name} (${user.pppoe_username}): ${error.message}`);
                }
            }
        });
    } else {
        console.log("[CRON_ISOLIR_NOTIF] Isolir notification task is disabled or has an invalid schedule.");
    }
}

function initCompensationRevertTask(config) {
    if (cronTaskCompensationRevert) {
        cronTaskCompensationRevert.stop();
    }

    if (config.status_compensation_revert === true && isValidCron(config.schedule_compensation_revert)) {
        cronTaskCompensationRevert = cron.schedule(config.schedule_compensation_revert, async () => {
            let currentCronConfig;
            try {
                currentCronConfig = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'database', 'cron.json'), 'utf8'));
            } catch (e) {
                console.error("[CRON_COMPENSATION_ERROR] Error reading cron.json inside callback:", e);
                return;
            }

            if (currentCronConfig.status_compensation_revert !== true) {
                return;
            }

            let currentCompensationsData;
            try {
                currentCompensationsData = JSON.parse(fs.readFileSync(compensationsDbPath, 'utf8'));
            } catch (e) {
                if (e.code !== 'ENOENT') {
                    console.error("[CRON_COMPENSATION_ERROR] Error reading compensations.json:", e);
                }
                return;
            }

            const now = new Date();
            let compensationsModifiedInThisRun = false;
            const compensationsToKeep = [];

            // Check if sync to MikroTik is enabled
            const syncToMikrotik = global.config.sync_to_mikrotik !== false; // Default to true if not set

            for (const comp of currentCompensationsData) {
                if (comp.status === 'active' && new Date(comp.endDate) <= now) {
                    const userToRevert = global.users.find(u => u.id.toString() === comp.userId.toString());

                    if (!userToRevert) {
                        console.error(`[CRON_COMPENSATION_REVERT_ERROR] User with ID ${comp.userId} not found for compensation ID ${comp.id}.`);
                        comp.status = 'error_revert_user_not_found';
                        compensationsToKeep.push(comp);
                        compensationsModifiedInThisRun = true;
                        continue;
                    }

                    if (!syncToMikrotik) {
                        console.log(`[CRON_COMPENSATION_REVERT] Sync to MikroTik is DISABLED - skipping compensation revert for ${comp.pppoeUsername}.`);
                        compensationsToKeep.push(comp);
                        continue;
                    }

                    try {
                        await updatePPPoEProfile(comp.pppoeUsername, comp.originalProfile);

                        try {
                            await deleteActivePPPoEUser(comp.pppoeUsername);
                        } catch (disconnectError) {
                            console.warn(`[CRON_COMPENSATION_WARN] Could not disconnect active session for ${comp.pppoeUsername}: ${disconnectError.message}`);
                        }

                        if (userToRevert.device_id) {
                            try {
                                await rebootRouter(userToRevert.device_id);
                            } catch (rebootError) {
                                console.warn(`[CRON_COMPENSATION_WARN] Could not reboot router for ${comp.pppoeUsername}: ${rebootError.message}`);
                            }
                        }

                        if (currentCronConfig.status_message_compensation_reverted === true && templatesCache.notificationTemplates['compensation_reverted'] && global.conn) {
                            if (userToRevert.phone_number && userToRevert.phone_number.trim() !== "") {
                                const locale = currentCronConfig.date_locale_for_notification || 'id-ID';
                                const dateOptions = currentCronConfig.date_options_for_revert_notification || { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
                                const dataPesan = {
                                    nama: userToRevert.name,
                                    tanggalRevert: new Date().toLocaleDateString(locale, dateOptions),
                                    profileAsli: global.packages.find(p => p.profile === comp.originalProfile)?.name || comp.originalProfile,
                                };

                                const messageText = renderTemplate('compensation_reverted', dataPesan);

                                const { delay } = await import('@whiskeysockets/baileys');
                                const phoneNumbers = userToRevert.phone_number.split('|');
                                for (let number of phoneNumbers) {
                                    let normalizedNumber = number.trim().replace(/\D/g, '');
                                    if (normalizedNumber.length > 5) {
                                        const jid = normalizedNumber + "@s.whatsapp.net";
                                        try {
                                            await global.conn.sendMessage(jid, { text: messageText });
                                            await delay(1000);
                                        } catch (msgError) {
                                            console.error(`[CRON_COMPENSATION_NOTIF_ERROR] Failed to send revert message to ${jid}:`, msgError.message);
                                        }
                                    }
                                }
                            }
                        }

                        compensationsModifiedInThisRun = true;

                    } catch (mikrotikError) {
                        console.error(`[CRON_COMPENSATION_REVERT_ERROR] Failed to revert Mikrotik profile for ${comp.pppoeUsername}:`, mikrotikError.message);
                        comp.status = 'error_revert';
                        compensationsToKeep.push(comp);
                        compensationsModifiedInThisRun = true;
                    }
                } else {
                    compensationsToKeep.push(comp);
                }
            }

            if (compensationsModifiedInThisRun) {
                global.compensations = compensationsToKeep;
                saveCompensations();
            }
        });
    }
}

function initSpeedRevertTask(config) {
    if (cronTaskSpeedRequestRevert) cronTaskSpeedRequestRevert.stop();

    // The schedule is hardcoded to every minute for responsiveness.
    const schedule = '* * * * *';

    if (config.status_speed_boost_revert === true) {
        console.log(`[CRON_SPEED_REVERT] Starting/Restarting speed boost revert task with schedule: ${schedule}`);
        cronTaskSpeedRequestRevert = cron.schedule(schedule, async () => {
            // Re-check the config inside the cron to ensure it can be disabled without a restart
            const currentCronConfig = loadCronConfig();
            if (currentCronConfig.status_speed_boost_revert !== true) {
                return;
            }

            const now = new Date();
            let requestsModified = false;

            // Check if sync to MikroTik is enabled
            const syncToMikrotik = global.config.sync_to_mikrotik !== false; // Default to true if not set

            for (const req of global.speed_requests) {
                if (req.status === 'active' && new Date(req.expirationDate) <= now) {
                    console.log(`[CRON_SPEED_REVERT] Reverting speed for user ID ${req.userId} (PPPoE: ${req.pppoeUsername})`);

                    const userToRevert = global.users.find(u => u.id.toString() === req.userId.toString());
                    if (!userToRevert) {
                        console.error(`[CRON_SPEED_REVERT_ERROR] User with ID ${req.userId} not found for request ID ${req.id}.`);
                        req.status = 'error_revert_user_not_found';
                        requestsModified = true;
                        continue;
                    }

                    const originalPackage = global.packages.find(p => p.name === req.currentPackageName);
                    if (!originalPackage || !originalPackage.profile) {
                        console.error(`[CRON_SPEED_REVERT_ERROR] Original package profile not found for package name: ${req.currentPackageName}.`);
                        req.status = 'error_revert_package_not_found';
                        requestsModified = true;
                        continue;
                    }

                    if (!syncToMikrotik) {
                        console.log(`[CRON_SPEED_REVERT] Sync to MikroTik is DISABLED - skipping speed revert for ${req.pppoeUsername}.`);
                        continue;
                    }

                    const originalProfile = originalPackage.profile;

                    try {
                        // 1. Revert profile in Mikrotik
                        await updatePPPoEProfile(req.pppoeUsername, originalProfile);

                        // 2. Disconnect user session
                        let disconnected = false;
                        try {
                            await deleteActivePPPoEUser(req.pppoeUsername);
                            disconnected = true;
                        } catch (disconnectError) {
                            console.warn(`[CRON_SPEED_REVERT_WARN] Could not disconnect active session for ${req.pppoeUsername}: ${disconnectError.message}. This is often not critical.`);
                        }

                        // 3. Update request status
                        req.status = 'reverted';
                        requestsModified = true;

                        // 4. Send notification if enabled
                        let notificationSent = false;
                        if (currentCronConfig.status_message_sod_reverted === true && templatesCache.notificationTemplates['speed_on_demand_reverted'] && global.conn) {
                            if (userToRevert.phone_number && userToRevert.phone_number.trim() !== "") {
                                const dataPesan = {
                                    nama: userToRevert.name,
                                    requestedPackageName: req.requestedPackageName,
                                    originalPackageName: req.currentPackageName
                                };
                                const messageText = renderTemplate('speed_on_demand_reverted', dataPesan);

                                const { delay } = await import('@whiskeysockets/baileys');
                                const phoneNumbers = userToRevert.phone_number.split('|');
                                let sentToAny = false;
                                for (let number of phoneNumbers) {
                                    let normalizedNumber = number.trim().replace(/\D/g, '');
                                    if (normalizedNumber.length > 5) {
                                        const jid = normalizedNumber + "@s.whatsapp.net";
                                        try {
                                            await global.conn.sendMessage(jid, { text: messageText });
                                            sentToAny = true;
                                            await delay(1000);
                                        } catch (msgError) {
                                            console.error(`[CRON_SPEED_REVERT_NOTIF_ERROR] Failed to send 'reverted' message to ${jid}:`, msgError.message);
                                        }
                                    }
                                }
                                notificationSent = sentToAny;
                            }
                        }

                        console.log(`[CRON_SPEED_REVERT_SUCCESS] User: ${req.pppoeUsername}, Profile: ${originalProfile}, Disconnected: ${disconnected}, Notified: ${notificationSent}.`);

                    } catch (mikrotikError) {
                        console.error(`[CRON_SPEED_REVERT_ERROR] Failed to revert Mikrotik profile for ${req.pppoeUsername}:`, mikrotikError.message);
                        req.status = 'error_revert_failed';
                        requestsModified = true;
                    }
                }
            }

            if (requestsModified) {
                saveSpeedRequests();
            }
        });
    } else {
        console.log("[CRON_SPEED_REVERT] Speed boost revert task is disabled.");
    }
}

function startCheck() {
    // Always stop the existing task first to prevent duplicates or zombies.
    if (checkTask) {
        console.log("[CRON_REDAMAN] Stopping existing redaman check task before re-evaluating schedule.");
        checkTask.stop();
        checkTask = null;
    }

    try {
        // The cron schedule string from config.json might be commented out
        const schedule = global.config.check_schedule.startsWith('#')
            ? global.config.check_schedule.substring(1).trim()
            : global.config.check_schedule;

        if (!cron.validate(schedule)) {
            // Log as a warning instead of an error if it's just the default commented-out value
            if (global.config.check_schedule.startsWith('#')) {
                console.log(`[CRON_REDAMAN] Redaman check task is disabled as per config.json.`);
            } else {
                console.error(`[CRON_REDAMAN_ERROR] Invalid cron expression: "${schedule}". Job not started.`);
            }
            return; // Exit because the schedule is invalid or disabled. The old task is already stopped.
        }

        // If we reach here, the schedule is valid, so we create a new task.
        checkTask = cron.schedule(schedule, async () => {
            console.log(`[CRON_REDAMAN] Task triggered at: ${new Date().toLocaleString('id-ID')}. Starting redaman check for all devices.`);

            try {
                // 1. Get all device IDs from GenieACS
                const { data: allDevices } = await axios.get(`${global.config.genieacsBaseUrl}/devices?projection=_id`);
                if (!allDevices || allDevices.length === 0) {
                    console.log("[CRON_REDAMAN] No devices found in GenieACS. Skipping check.");
                    return;
                }
                const deviceIDs = allDevices.map(d => d._id);
                console.log(`[CRON_REDAMAN] Found ${deviceIDs.length} devices to check.`);

                // 2. Batch Refresh: Send refreshObject tasks for redaman paths in parallel
                const refreshPromises = [];
                for (const deviceId of deviceIDs) {
                    for (const path of REDAMAN_PATHS) {
                        const refreshUrl = `${global.config.genieacsBaseUrl}/devices/${encodeURIComponent(deviceId)}/tasks?connection_request`;
                        refreshPromises.push(
                            axios.post(refreshUrl, { name: "refreshObject", objectName: path })
                                 .catch(err => console.warn(`[CRON_REDAMAN_WARN] Failed to send refresh for path '${path}' on device ${deviceId}: ${err.message}`))
                        );
                    }
                }
                await Promise.allSettled(refreshPromises);
                const delayAfterRefresh = global.config.genieacsRefreshBatchDelay || 5000;
                const { delay } = await import('@whiskeysockets/baileys');
                // console.log(`[CRON_REDAMAN] All refresh commands sent. Waiting for ${delayAfterRefresh}ms...`);
                await delay(delayAfterRefresh);

                // 3. Batch Fetch: Get only redaman data for all devices in one call
                const queryPayload = { "_id": { "$in": deviceIDs } };
                const projectionFields = REDAMAN_PATHS.join(',');
                const { data: devicesWithRedaman } = await axios.get(`${global.config.genieacsBaseUrl}/devices/`, {
                    params: {
                        query: JSON.stringify(queryPayload),
                        projection: projectionFields
                    }
                });

                // console.log(`[CRON_REDAMAN] Fetched data for ${devicesWithRedaman.length} devices. Analyzing...`);

                // 4. Process and notify
                const rxTolerance = parseInt(global.config.rx_tolerance, 10);
                if (isNaN(rxTolerance)) {
                    console.error("[CRON_REDAMAN_ERROR] `rx_tolerance` in config.json is not a valid number. Skipping checks.");
                    return;
                }

                let devicesWithBadRedaman = 0;

                for (const device of devicesWithRedaman) {
                    let redamanValue = null;

                    // Find the redaman value from the possible paths
                    for (const path of REDAMAN_PATHS) {
                        const value = getNestedValue(device, path);
                        if (typeof value !== 'undefined' && typeof value._value !== 'undefined') {
                            redamanValue = value._value;
                            break;
                        }
                    }

                    if (redamanValue === null) {
                        continue; // Skip device if no redaman value found
                    }

                    const redamanInt = parseInt(redamanValue, 10);
                    if (isNaN(redamanInt)) {
                        console.warn(`[CRON_REDAMAN_WARN] Could not parse redaman value "${redamanValue}" for device ${device._id}.`);
                        continue;
                    }

                    if (redamanInt < rxTolerance) {
                        devicesWithBadRedaman++; // Increment counter

                        const findUser = global.users.find(u => u.device_id === device._id);

                        const templateData = {
                            nama: findUser?.name?.split("|")[0] || "(Tidak Terdaftar)",
                            no_hp: findUser?.phone_number?.split("|")[0] || "(Tidak Terdaftar)",
                            alamat: findUser?.address?.split("|")[0] || "(Tidak Diketahui)",
                            pppoe: findUser?.pppoe_username?.split("|")[0] || "(Tidak Diketahui)",
                            redaman: `${redamanValue} dBm`
                        };

                        // --- Defensive templating with diagnostics ---

                        // 1. Check if the template exists in the cache first
                        if (!templatesCache.notificationTemplates?.redaman_alert?.template) {
                            console.error(`[CRON_REDAMAN_ERROR] CRITICAL: Template 'redaman_alert' not found or is invalid. Please check database/message_templates.json. Skipping notification for device ${device._id}.`);
                            continue; // Skip to the next device in the loop
                        }

                        // 2. Render the template
                        const notificationText = renderTemplate('redaman_alert', templateData);

                        // 3. Check if rendering was successful
                        if (!notificationText || notificationText.startsWith('Error:')) {
                            console.error(`[CRON_REDAMAN_ERROR] Failed to render 'redaman_alert' template for device ${device._id}. Result: ${notificationText}`);
                            continue; // Skip to the next device in the loop
                        }

                        // Send notification to all accounts with a phone number
                        for (const account of global.accounts) {
                            const { delay } = await import('@whiskeysockets/baileys');
                            if (account.phone_number && account.phone_number.length > 0 && !account.phone_number.startsWith("0")) {
                                const targetJid = account.phone_number.endsWith('@s.whatsapp.net') ? account.phone_number : `${account.phone_number}@s.whatsapp.net`;
                                try {
                                    if (global.conn) {
                                        await global.conn.sendMessage(targetJid, { text: notificationText });
                                        // console.log(`[CRON_REDAMAN_NOTIF_SUCCESS] Notification sent to ${account.username} at ${targetJid}.`);
                                        await delay(1000); // Stagger messages
                                    } else {
                                        console.warn(`[CRON_REDAMAN_NOTIF_WARN] WhatsApp connection not available. Skipping notification to ${account.username}.`);
                                    }
                                } catch (e) {
                                    console.error(`[CRON_REDAMAN_NOTIF_ERROR] Failed to send notification to ${account.username} (${targetJid}):`, e.message);
                                }
                            }
                        }
                    }
                }

                let summaryMessage = "Redaman check finished.";
                if (devicesWithBadRedaman > 0) {
                    summaryMessage += ` Found ${devicesWithBadRedaman} devices with bad redaman. Notifications sent.`;
                }
                console.log(`[CRON_REDAMAN] ${summaryMessage}`);

            } catch (error) {
                const errorMessage = error.response ? JSON.stringify(error.response.data) : error.message;
                console.error(`[CRON_REDAMAN_EXECUTION_ERROR] An error occurred during the redaman check task: ${errorMessage}`);
            }
        });
        console.log(`[CRON_REDAMAN] Redaman check task scheduled with pattern: "${schedule}"`);
    } catch (e) {
        console.error("[CRON_REDAMAN_SETUP_ERROR] Error setting up redaman check cron job:", e);
    }
}

function loadCronConfig() {
    try {
        return JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'database', 'cron.json'), 'utf8'));
    } catch (e) {
        console.error("[CRON_CONFIG_ERROR] Gagal memuat cron.json:", e);
        // Return a default config to prevent crashes
        return {};
    }
}

/**
 * Initializes all cron tasks on application startup.
 */
function initializeAllCronTasks() {
    const config = loadCronConfig();
    global.cronConfig = config; // Ensure global config is set

    initReminderTask(config);
    initSetUnpaidTask(config);
    initIsolirTask(config);
    initIsolirNotificationTask(config);
    initCompensationRevertTask(config);
    initSpeedRevertTask(config);
    startCheck();
}


module.exports = {
    initializeAllCronTasks,
    initReminderTask,
    initSetUnpaidTask,
    initIsolirTask,
    initIsolirNotificationTask,
    initCompensationRevertTask,
    initSpeedRevertTask,
    startCheck,
    isValidCron
};
