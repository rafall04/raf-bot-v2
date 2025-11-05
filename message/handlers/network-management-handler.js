/**
 * Network Management Handler
 * Handles IP Binding, PPPoE, and network configuration
 */

/**
 * Handle add IP binding
 */
async function handleAddBinding({ q, isOwner, reply, mess, global, checkStatik, checkLimitAt, checkMaxLimit, addbinding, addqueue }) {
    try {
        if (!isOwner) throw mess.owner;
        
        const parent = `${global.config.parentbinding}`;
        let [komen, ip, mac, prof] = q.split('|');
        
        const cekprof = checkStatik(prof);
        const ceklimitat = checkLimitAt(prof);
        const cekmaxlimit = checkMaxLimit(prof);
        
        if (cekprof === false) {
            return reply(`Profil Tidak Ditemukan !!!`);
        }
        
        // Handle case when MAC is empty (kosong)
        if (mac && mac.toLowerCase() === 'kosong') {
            try {
                const body = await addbinding(komen, ip);
                const tod = body.split('\n');
                const resultbinding = tod[Math.floor(Math.random() * tod.length)];
                
                if (resultbinding === 'ERROR !!! IP ATAU MAC DI IP BINDING SUDAH TERDAFTAR DI MIKROTIK') {
                    await reply(`Mohon Maaf Kak Mac Atau Ip Sudah Terdaftar Di IP Binding. Silahkan Cek Lagi Dalam Penulisannya.\n\nTerima Kasih`);
                } else if (resultbinding === '') {
                    await reply(`Mohon Maaf Kak Ada Kesalahan Teknis Saat Penambahan Ip Binding. Silahkan Hubungi Pembuat bot.\n\nTerima Kasih`);
                } else if (resultbinding === 'ERROR !!! INVALID MAC ADDRESS') {
                    await reply(`Mohon Maaf Kak Error Pada Mac Address. Silahkan Cek Kembali Pada Penulisan Mac Address.\n\nTerima Kasih`);
                } else if (resultbinding === 'ERROR !!! RANGE IP MELEWATI BATAS YANG TELAH DITENTUKAN') {
                    await reply(`Mohon Maaf Kak Ip Address Melebihi Range Yang Telah Ditentukan. Silahkan Cek Kembali Pada Penulisan Mac Address.\n\nTerima Kasih`);
                } else {
                    await reply(`Pembuatan Ip Binding Telah Selesai. Dengan Data Berikut :\n\nKomen : ${komen}\nIP : ${ip}\nMAC ADDRESS : ${mac}\n\nTerima Kasih`);
                }
            } catch (err) {
                console.error('[ADD_BINDING] Error:', err);
                await reply('Error!');
            }
        } else {
            // Handle normal case with MAC address
            try {
                const body = await addbinding(komen, ip, mac);
                const tod = body.split('\n');
                const resultbinding = tod[Math.floor(Math.random() * tod.length)];
                
                if (resultbinding === 'ERROR !!! IP ATAU MAC DI IP BINDING SUDAH TERDAFTAR DI MIKROTIK') {
                    await reply(`Mohon Maaf Kak Mac Atau Ip Sudah Terdaftar Di IP Binding. Silahkan Cek Lagi Dalam Penulisannya.\n\nTerima Kasih`);
                } else if (resultbinding === '') {
                    await reply(`Mohon Maaf Kak Ada Kesalahan Teknis Saat Penambahan Ip Binding. Silahkan Hubungi Pembuat bot.\n\nTerima Kasih`);
                } else if (resultbinding === 'ERROR !!! INVALID MAC ADDRESS') {
                    await reply(`Mohon Maaf Kak Error Pada Mac Address. Silahkan Cek Kembali Pada Penulisan Mac Address.\n\nTerima Kasih`);
                } else if (resultbinding === 'ERROR !!! RANGE IP MELEWATI BATAS YANG TELAH DITENTUKAN') {
                    await reply(`Mohon Maaf Kak Ip Address Melebihi Range Yang Telah Ditentukan. Silahkan Cek Kembali Pada Penulisan Mac Address.\n\nTerima Kasih`);
                } else {
                    await reply(`Pembuatan Ip Binding Telah Selesai. Dengan Data Berikut :\n\nKomen : ${komen}\nIP : ${ip}\nMAC ADDRESS : ${mac}\n\nTerima Kasih`);
                }
            } catch (err) {
                console.error('[ADD_BINDING] Error:', err);
                await reply('Error!');
            }
            
            // Add to queue
            try {
                const body = await addqueue(prof, komen, ip, parent, ceklimitat, cekmaxlimit);
                const tod = body.split('\n');
                const resultqueue = tod[Math.floor(Math.random() * tod.length)];
                
                if (resultqueue === 'ERROR !!! PARENT TIDAK DITEMUKAN DI MIKROTIK') {
                    await reply(`Mohon Maaf Kak Gagal Menambahkan Ke Simple Queue Dikarenakan Parent Tidak Ditemukan. Silahkan Cek Lagi Dalam Penulisannya.\n\nTerima Kasih`);
                } else if (resultqueue === 'ERROR !!! NAMA SIMPLE QUEUE SUDAH TERDAFTAR DI MIKROTIK') {
                    await reply(`Mohon Maaf Kak Gagal Menambahkan Ke Simple Queue Dikarenakan Nama Itu Sudah Terdaftar Di Simple Queue. Silahkan Cek Lagi Dalam Penulisannya.\n\nTerima Kasih`);
                } else if (resultqueue === '') {
                    await reply(`Mohon Maaf Kak Ada Kesalahan Teknis Saat Penambahan Simple Queue. Silahkan Hubungi Pembuat bot.\n\nTerima Kasih`);
                } else if (resultqueue === 'ERROR !!! CEK PADA KONFIG DOWNLOAD ANDA.') {
                    await reply(`Mohon Maaf Kak Limit At Download Lebih Besar Dari Max Limit. Silahkan Cek Konfigurasi Database Profil Anda.\n\nTerima Kasih`);
                } else if (resultqueue === 'ERROR !!! CEK PADA KONFIG UPLOAD ANDA.') {
                    await reply(`Mohon Maaf Kak Limit At Upload Lebih Besar Dari Max Limit. Silahkan Cek Konfigurasi Database Profil Anda.\n\nTerima Kasih`);
                } else {
                    await reply(`Pembuatan Simple Queue Telah Selesai. Dengan Data Berikut :\n\nNama : ${komen}\nIP : ${ip}\nParent : ${parent}\nLimit At : ${ceklimitat}\nMax Limit : ${cekmaxlimit}\n\nTerima Kasih`);
                }
            } catch (err) {
                console.error('[ADD_QUEUE] Error:', err);
                await reply('Error!');
            }
        }
    } catch (error) {
        if (typeof error === 'string') {
            await reply(error);
        } else {
            console.error('[ADD_BINDING_HANDLER] Unexpected error:', error);
            await reply('Terjadi kesalahan saat menambahkan binding.');
        }
    }
}

/**
 * Handle add PPPoE account
 */
async function handleAddPPP({ q, isOwner, reply, mess, addpppoe }) {
    try {
        if (!isOwner) throw mess.owner;
        
        let [user, pw, profil] = q.split('|');
        
        const body = await addpppoe(user, pw, profil);
        const tod = body.split('\n');
        const resultppp = tod[Math.floor(Math.random() * tod.length)];
        
        if (resultppp === 'ERROR !!! KESALAHAN PENULISAN PROFILE') {
            await reply(`Mohon Maaf Kak Ada Kesalahan Dalam Penulisan Profil. Silahkan Cek Lagi Dalam Penulisan Profil.\n\nTerima Kasih`);
        } else if (resultppp === 'ERROR !!! AKUN PPPOE SUDAH TERDAFTAR') {
            await reply(`Mohon Maaf Kak User PPPOE Tersebut Telah Terdaftar. Silahkan Buat User Baru Lagi Kak.\n\nTerima Kasih`);
        } else if (resultppp === '') {
            await reply(`Mohon Maaf Kak Ada Kesalahan Teknis. Silahkan Lapor Ke Pembuat Bot\n\nTerima Kasih`);
        } else {
            await reply(`Pembuatan Akun PPPOE Berhasil\n\nUsername : ${user}\nPassword : ${pw} \nProfile : ${profil}\n\nTerima Kasih`);
        }
    } catch (error) {
        if (typeof error === 'string') {
            await reply(error);
        } else {
            console.error('[ADD_PPP] Error:', error);
            await reply('Error!');
        }
    }
}

module.exports = {
    handleAddBinding,
    handleAddPPP
};
