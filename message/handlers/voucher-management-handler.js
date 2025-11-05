/**
 * Voucher Management Handler
 * Handles voucher profile CRUD operations
 */

const fs = require('fs');

/**
 * Handle add voucher profile
 */
async function handleAddProfVoucher({ q, isOwner, reply, mess, checkprofvoucher, addvoucher }) {
    try {
        if (!isOwner) throw mess.owner;
        
        let [profvc123, namavc123, durasivc123, hargavc123] = q.split('|');
        const cekprof = checkprofvoucher(profvc123);
        
        if (cekprof === true) {
            await reply(`Mohon Maaf Profil Yang Akan Ditambahkan Sudah Ada Di Dalam Database. Silahkan Cek Kembali Pada Penulisan Profil Voucher Anda.\n\nTerima Kasih`);
        } else {
            addvoucher(profvc123, namavc123, durasivc123, hargavc123);
            await reply(`Berhasil Membuat Profil Voucher\n\nProfil : ${profvc123}\nNama Voucher : ${namavc123}\nDurasi Voucher : ${durasivc123}\nHarga Voucher : ${hargavc123}\n\nTerima Kasih`);
        }
    } catch (error) {
        if (typeof error === 'string') {
            await reply(error);
        } else {
            console.error('[ADD_PROF_VOUCHER] Error:', error);
            await reply('Terjadi kesalahan saat menambahkan profil voucher.');
        }
    }
}

/**
 * Handle delete voucher profile
 */
async function handleDelProfVoucher({ q, isOwner, reply, mess, checkprofvoucher, voucher }) {
    try {
        if (!isOwner) throw mess.owner;
        if (!q) throw mess.notProfile;
        
        const cekprof = checkprofvoucher(q);
        
        if (cekprof === false) {
            await reply(`Profil Tidak Ditemukan !!!`);
        } else {
            voucher.splice(q, 1);
            fs.writeFileSync('./database/voucher.json', JSON.stringify(voucher));
            await reply(`Berhasil Menghapus Profil Voucher`);
        }
    } catch (error) {
        if (typeof error === 'string') {
            await reply(error);
        } else {
            console.error('[DEL_PROF_VOUCHER] Error:', error);
            await reply('Terjadi kesalahan saat menghapus profil voucher.');
        }
    }
}

/**
 * Handle add static profile
 */
async function handleAddProfStatik({ q, isOwner, reply, mess, checkStatik, addStatik }) {
    try {
        if (!isOwner) throw mess.owner;
        
        let [profstatik, limitat, maxlimit] = q.split('|');
        const cekprof = checkStatik(profstatik);
        
        if (cekprof === true) {
            await reply(`Mohon Maaf Profil Yang Akan Ditambahkan Sudah Ada Di Dalam Database. Silahkan Cek Kembali Pada Penulisan Profil Statik.\n\nTerima Kasih`);
        } else {
            addStatik(profstatik, limitat, maxlimit);
            await reply(`Berhasil Membuat Profil Statik\n\nNama Profil : ${profstatik}\nLimit At : ${limitat}\nMax Limit : ${maxlimit}`);
        }
    } catch (error) {
        if (typeof error === 'string') {
            await reply(error);
        } else {
            console.error('[ADD_PROF_STATIK] Error:', error);
            await reply('Terjadi kesalahan saat menambahkan profil statik.');
        }
    }
}

/**
 * Handle delete static profile
 */
async function handleDelProfStatik({ q, isOwner, reply, mess, checkStatik, statik }) {
    try {
        if (!isOwner) throw mess.owner;
        if (!q) throw mess.notProfile;
        
        const cekprof = checkStatik(q);
        
        if (cekprof === false) {
            await reply(`Profil Tidak Ditemukan !!!`);
        } else {
            statik.splice(q, 1);
            fs.writeFileSync('./database/statik.json', JSON.stringify(statik));
            await reply(`Berhasil Menghapus Profil Statik`);
        }
    } catch (error) {
        if (typeof error === 'string') {
            await reply(error);
        } else {
            console.error('[DEL_PROF_STATIK] Error:', error);
            await reply('Terjadi kesalahan saat menghapus profil statik.');
        }
    }
}

module.exports = {
    handleAddProfVoucher,
    handleDelProfVoucher,
    handleAddProfStatik,
    handleDelProfStatik
};
