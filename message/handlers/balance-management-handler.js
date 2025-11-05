/**
 * Balance Management Handler
 * Handles topup, transfer, and balance operations
 */

const { convertRupiah } = require('../../lib/function');

/**
 * Handle topup balance
 */
async function handleTopup({ q, isOwner, sender, reply, msg, mess, raf, checkATMuser, addATM, addKoinUser }) {
    try {
        if (!isOwner) throw mess.owner;
        if (!q.includes('|')) throw mess.wrongFormat;
        
        let [tujuan, jumblah] = q.split('|');
        if (isNaN(jumblah)) throw mess.mustNumber;
        
        const tujuantf = `${tujuan.replace("@", '')}@s.whatsapp.net`;
        const checkATM = checkATMuser(tujuantf);
        
        try {
            if (checkATM === undefined) addATM(tujuantf);
            const uangsaku = 0;
            addKoinUser(tujuantf, uangsaku);
        } catch (err) {
            console.error('[TOPUP_INIT]', err);
        }
        
        addKoinUser(tujuantf, jumblah);
        const kerupiah123 = convertRupiah.convert(jumblah);
        
        await reply(`*「 SUKSES 」*\n\nPengiriman uang telah sukses\nDari : +${sender.split("@")[0]}\nKe : +${tujuan}\nJumlah transfer : ${kerupiah123}`);
        await raf.sendMessage(tujuantf, {
            text: `*「 SUKSES 」*\n\nPengisian Saldo Dengan Jumlah\n${kerupiah123}\n\nSilahkan Cek Saldo Anda Dengan Ketik ceksaldo\n\nTerima Kasih Telah Melakukan Topup\nBy Bot`
        }, { quoted: msg });
        
    } catch (error) {
        if (typeof error === 'string') {
            await reply(error);
        } else {
            console.error('[TOPUP_HANDLER] Error:', error);
            await reply('Terjadi kesalahan saat melakukan topup.');
        }
    }
}

/**
 * Handle delete balance
 */
async function handleDelSaldo({ q, isOwner, reply, mess, checkATMuser, delSaldo }) {
    try {
        if (!isOwner) throw mess.owner;
        if (!q) throw mess.wrongFormat;
        if (isNaN(q)) throw mess.mustNumber;
        
        const tujuandel = `${q.replace("@", '')}@s.whatsapp.net`;
        const checkATM = checkATMuser(tujuandel);
        
        if (checkATM === undefined) {
            await reply('Nomor Yang Akan Dihapus Tidak Ditemukan.');
        } else {
            delSaldo(tujuandel);
            await reply(`*「 SUKSES 」*\n\nHapus Saldo User Dengan Nomor :\n${tujuandel}`);
        }
    } catch (error) {
        if (typeof error === 'string') {
            await reply(error);
        } else {
            console.error('[DELSALDO_HANDLER] Error:', error);
            await reply('Terjadi kesalahan saat menghapus saldo.');
        }
    }
}

/**
 * Handle balance transfer
 */
async function handleTransfer({ q, sender, reply, msg, mess, raf, checkATMuser, addATM, addKoinUser, confirmATM, format }) {
    try {
        if (!q.includes('|')) return reply(format('mess_wrongFormat'));
        
        let [tujuan, jumblah] = q.split('|');
        if (isNaN(jumblah)) throw mess.mustNumber;
        
        if (checkATMuser(sender) < jumblah) {
            throw `uang mu tidak mencukupi untuk melakukan transfer.`;
        }
        
        const tujuantf = `${tujuan.replace("@", '')}@s.whatsapp.net`;
        const checkATM = checkATMuser(tujuantf);
        
        try {
            if (checkATM === undefined) addATM(tujuantf);
            const uangsaku = 0;
            addKoinUser(tujuantf, uangsaku);
        } catch (err) {
            console.error('[TRANSFER_INIT]', err);
        }
        
        confirmATM(sender, jumblah);
        addKoinUser(tujuantf, jumblah);
        
        const kerupiah123 = convertRupiah.convert(jumblah);
        const sisaSaldo = convertRupiah.convert(checkATMuser(sender));
        
        await reply(format('transfer_sukses_pengirim', { 
            nomorPengirim: sender.split("@")[0], 
            nomorTujuan: tujuan, 
            jumlah: kerupiah123, 
            sisaSaldo 
        }));
        
        await raf.sendMessage(tujuantf, {
            text: format('transfer_sukses_penerima', { 
                jumlah: kerupiah123, 
                nomorPengirim: sender.split("@")[0] 
            })
        }, { quoted: msg });
        
    } catch (error) {
        if (typeof error === 'string') {
            await reply(error);
        } else {
            console.error('[TRANSFER_HANDLER] Error:', error);
            await reply('Terjadi kesalahan saat melakukan transfer.');
        }
    }
}

module.exports = {
    handleTopup,
    handleDelSaldo,
    handleTransfer
};
