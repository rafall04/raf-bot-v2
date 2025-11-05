/**
 * Monitoring Handler
 * Menangani perintah monitoring dan status
 */

const { getPppStats, getHotspotStats, statusap } = require('../../lib/mikrotik');

/**
 * Handle status PPP
 */
async function handleStatusPpp(isOwner, isTeknisi, reply, mess, config) {
    if (!isOwner && !isTeknisi) return reply(mess.teknisiOrOwnerOnly);
    
    reply("⏳ Sedang mengambil statistik PPPoE, mohon tunggu...");

    try {
        const pppStats = await getPppStats();
        let replyText = `📊 *Statistik PPPoE Saat Ini (${config.nama || "Layanan Kami"}):*\n\n`;
        replyText += `👤 Total Pengguna PPPoE: *${pppStats.total !== undefined ? pppStats.total : 'N/A'}*\n`;
        replyText += `🟢 Aktif Saat Ini: *${pppStats.online !== undefined ? pppStats.online : 'N/A'}*\n`;
        replyText += `🔴 Tidak Aktif: *${pppStats.offline !== undefined ? pppStats.offline : 'N/A'}*\n`;

        if (pppStats.inactive_users_list && Array.isArray(pppStats.inactive_users_list) && pppStats.inactive_users_list.length > 0) {
            replyText += `\n📜 *Daftar Pengguna PPPoE Tidak Aktif:*\n`;
            const maxInactiveToShow = 20;
            const inactiveToShow = pppStats.inactive_users_list.slice(0, maxInactiveToShow);

            inactiveToShow.forEach((user, index) => {
                replyText += `${index + 1}. ${user}\n`;
            });

            if (pppStats.inactive_users_list.length > maxInactiveToShow) {
                replyText += `... dan ${pppStats.inactive_users_list.length - maxInactiveToShow} pengguna lainnya.\n`;
            }
        } else if (pppStats.offline > 0) {
            replyText += `\n📜 *Daftar Pengguna PPPoE Tidak Aktif:* (Detail daftar tidak tersedia saat ini)\n`;
        } else {
            replyText += `\n👍 Semua pengguna PPPoE yang terdaftar saat ini aktif atau tidak ada pengguna tidak aktif.\n`;
        }

        replyText += `\n----\nℹ️ _Data diambil pada: ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}_\nTim ${config.namabot || "Bot Kami"}`;
        reply(replyText);
    } catch (err) {
        console.error("[statusppp_ERROR_COMMAND]", err.message);
        reply(`🚫 Gagal mengambil statistik PPPoE: ${err.message}. Silakan coba lagi nanti atau hubungi Admin.`);
    }
}

/**
 * Handle status hotspot
 */
async function handleStatusHotspot(isOwner, isTeknisi, reply, mess, config) {
    if (!isOwner && !isTeknisi) return reply(mess.teknisiOrOwnerOnly);
    
    reply("⏳ Sedang mengambil statistik Hotspot, mohon tunggu...");

    try {
        const hotspotStats = await getHotspotStats();
        let replyText = `📊 *Statistik Hotspot Saat Ini (${config.nama || "Layanan Kami"}):*\n\n`;
        replyText += `👥 Total Pengguna Hotspot Terdaftar: *${hotspotStats.total !== undefined ? hotspotStats.total : 'N/A'}*\n`;
        replyText += `🟢 Aktif Saat Ini: *${hotspotStats.active !== undefined ? hotspotStats.active : 'N/A'}*\n\n----\nℹ️ _Data diambil pada: ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}_\nTim ${config.namabot || "Bot Kami"}`;
        reply(replyText);
    } catch (err) {
        console.error("[statushotspot_ERROR_COMMAND]", err.message);
        reply(`🚫 Gagal mengambil statistik Hotspot: ${err.message}. Silakan coba lagi nanti atau hubungi Admin.`);
    }
}

/**
 * Handle status AP
 */
async function handleStatusAp(isOwner, reply, mess) {
    if (!isOwner) throw mess.owner;
    
    try {
        const body = await statusap();
        const tod = body.split();
        const statusapData = tod[Math.floor(Math.random() * tod.length)];
        var splitnya = 'Nama' + statusapData.replace('NAMA', '').split('NAMA').join('\nNAMA').split('</br>').join(' ').split(' : ').join(':').split(' ').join('\n');
        await reply(`STATUS AP :\n\n${splitnya}\n\nBy Bot`);
    } catch (err) {
        console.error(err);
        await reply('Error!');
    }
}

/**
 * Handle all saldo
 */
function handleAllSaldo(isOwner, reply, mess, config, atm) {
    if (!isOwner) throw mess.owner;
    
    let txtx = `「 *${config.nama}* 」\n\nJumlah Saldo Semua User.\n\n`;
    for (let i of atm){
        txtx += `User  : ${i.id}\nSaldo :  Rp.${i.saldo}\n\n`;
    }
    reply(`${txtx}`);
}

/**
 * Handle all user
 */
function handleAllUser(reply, users) {
    reply(`ALL USERS\n\n${users.map(user => 'Nama: ' + user.name + '\nNo Telepon: ' + user.phone_number.split("|").join(", ") + '\nPaket Langganan: ' + user.subscription + '\nAlamat: ' + user.address + '\nUsername PPPoE: ' + user.pppoe_username + '\nPassword PPPoE: ' + user.pppoe_password).join('\n\n')}`);
}

/**
 * Handle list profil statik
 */
function handleListProfStatik(isOwner, reply, mess, statik) {
    if(!isOwner) throw mess.owner;
    
    let txtx = `「 *LIST-PROFIL-STATIK* 」\n\nJumlah : ${statik.length}\n\n`;
    for (let i of statik){
        txtx += `• *PROFIL:* ${i.prof}\n`;
        txtx += `• *LIMIT AT:* ${i.limitat}\n`;
        txtx += `• *MAX LIMIT:* ${i.maxlimit}\n\n`;
    }
    reply(`${txtx}`);
}

/**
 * Handle list profil voucher
 */
function handleListProfVoucher(isOwner, reply, mess, voucher) {
    if(!isOwner) throw mess.owner;
    
    let txtx = `「 *LIST-PROFIL-VOUCHER* 」\n\nJumlah : ${voucher.length}\n\n`;
    for (let i of voucher){
        txtx += `• *NAMA PROFIL:* ${i.prof}\n`;
        txtx += `• *NAMA VOUCHER:* ${i.namavc}\n`;
        txtx += `• *DURASI VOUCHER:* ${i.durasivc}\n`;
        txtx += `• *HARGA VOUCHER:* ${i.hargavc}\n\n`;
    }
    reply(`${txtx}`);
}

/**
 * Handle monitor wifi
 */
function handleMonitorWifi(isOwner, isTeknisi, reply, mess) {
    if (!isOwner && !isTeknisi) return reply(mess.teknisiOrOwnerOnly);
    
    reply(`📊 *MONITOR WIFI*\n\nFitur monitoring WiFi sedang dalam pengembangan.\n\nGunakan perintah berikut yang tersedia:\n• *statusppp* - Status PPPoE\n• *statushotspot* - Status Hotspot\n• *statusap* - Status Access Point (Owner only)`);
}

module.exports = {
    handleStatusPpp,
    handleStatusHotspot,
    handleStatusAp,
    handleAllSaldo,
    handleAllUser,
    handleListProfStatik,
    handleListProfVoucher,
    handleMonitorWifi
};
