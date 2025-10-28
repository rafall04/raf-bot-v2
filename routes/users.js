const express = require('express');
const crypto = require('crypto');
const { hashPassword } = require('../lib/password');
const { renderTemplate, templatesCache } = require('../lib/templating');
const { normalizePhoneNumber } = require('../lib/utils');

const router = express.Router();

// Middleware for admin-only routes
function ensureAdmin(req, res, next) {
    if (!req.user || !['admin', 'owner', 'superadmin'].includes(req.user.role)) {
        return res.status(403).json({ status: 403, message: "Akses ditolak." });
    }
    next();
}

// POST /api/users/:id/credentials
router.post('/:id/credentials', ensureAdmin, async (req, res) => {
    const { id } = req.params;
    const { username: newUsername, password: newPassword } = req.body;

    const userToUpdate = global.users.find(v => String(v.id) === String(id));
    if (!userToUpdate) {
        return res.status(404).json({ status: 404, message: "Pengguna tidak ditemukan." });
    }

    try {
        let finalUsername = userToUpdate.username;
        let plainTextPassword = '';

        // Handle username update
        if (newUsername && newUsername.trim() !== '' && newUsername.trim() !== userToUpdate.username) {
            const existingUser = global.users.find(u => u.username === newUsername.trim() && String(u.id) !== String(id));
            if (existingUser) {
                return res.status(409).json({ status: 409, message: `Username "${newUsername}" sudah digunakan oleh pelanggan lain (${existingUser.name}).` });
            }
            finalUsername = newUsername.trim();
        } else if (!finalUsername || finalUsername.trim() === '') {
            // Generate username if it doesn't exist
            const nameParts = userToUpdate.name.toLowerCase().split(' ').filter(Boolean);
            let baseUsername = nameParts[0];
            if (nameParts.length > 1) {
                baseUsername += `.${nameParts[1].charAt(0)}`;
            }
            let counter = 1;
            finalUsername = baseUsername;
            while (global.users.some(u => u.username === finalUsername && String(u.id) !== String(id))) {
                counter++;
                finalUsername = `${baseUsername}${counter}`;
            }
        }

        // Handle password
        if (newPassword && newPassword.trim() !== '') {
            plainTextPassword = newPassword;
        } else {
            plainTextPassword = crypto.randomBytes(4).toString('hex');
        }

        const hashedPassword = await hashPassword(plainTextPassword);

        const sql = `UPDATE users SET username = ?, password = ? WHERE id = ?`;
        const params = [finalUsername, hashedPassword, id];

        await new Promise((resolve, reject) => {
            global.db.run(sql, params, function (err) {
                if (err) {
                    console.error("[DB_UPDATE_CREDS_ERROR]", err.message);
                    return reject(new Error("Gagal memperbarui kredensial pengguna di database."));
                }
                resolve();
            });
        });

        // Update in-memory data
        userToUpdate.username = finalUsername;
        userToUpdate.password = hashedPassword;

        // Send notification
        if (global.raf && templatesCache.notificationTemplates?.customer_welcome) {
            const templateData = {
                nama: userToUpdate.name,
                username: finalUsername,
                password: plainTextPassword,
                nama_wifi: global.config.nama_wifi || 'Layanan Kami'
            };
            const messageText = renderTemplate('customer_welcome', templateData);
            if (userToUpdate.phone_number) {
                const phoneNumbers = userToUpdate.phone_number.split('|');
                for (let number of phoneNumbers) {
                    const normalizedNumber = normalizePhoneNumber(number);
                    if (normalizedNumber) {
                        const jid = `${normalizedNumber}@s.whatsapp.net`;
                        const { delay } = await import('@whiskeysockets/baileys');
                        try {
                            await delay(1000);
                            await global.raf.sendMessage(jid, { text: messageText });
                            console.log(`[CREDENTIAL_NOTIF_SUCCESS] Credentials sent to ${jid}`);
                        } catch (e) {
                            console.error(`[CREDENTIAL_NOTIF_ERROR] Failed to send credentials to ${jid}:`, e);
                        }
                    }
                }
            }
        }

        return res.status(200).json({
            status: 200,
            message: "Kredensial berhasil dibuat/diperbarui.",
            generated_credentials: {
                username: finalUsername,
                password: plainTextPassword
            }
        });

    } catch (error) {
        console.error(`[USER_CREDENTIALS_ERROR] Failed to process credentials for user ${id}:`, error);
        return res.status(500).json({ status: 500, message: `Operasi gagal: ${error.message}` });
    }
});

module.exports = router;
