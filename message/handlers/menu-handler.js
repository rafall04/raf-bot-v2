/**
 * Menu Handler
 * Menangani semua tampilan menu
 */

const { wifimenu, menupaket, menubelivoucher, menupasang, menuowner, customermenu, technicianmenu } = require('../wifi');

/**
 * Handle main menu
 */
function handleMenuUtama(config, reply, pushname, sender) {
    reply(wifimenu(config.nama, config.namabot, pushname, sender));
}

/**
 * Handle teknisi menu
 */
function handleMenuTeknisi(config, reply, pushname, sender) {
    reply(technicianmenu(config.nama, config.namabot, pushname, sender));
}

/**
 * Handle owner menu
 */
function handleMenuOwner(config, isOwner, reply, pushname, sender) {
    if (!isOwner) throw mess.owner;
    reply(menuowner(config.nama, config.namabot, pushname, sender));
}

/**
 * Handle cara pasang menu
 */
function handleTanyaCaraPasang(config, reply, pushname, sender) {
    reply(menupasang(config.nama, config.namabot, pushname, sender));
}

/**
 * Handle paket bulanan menu
 */
function handleTanyaPaketBulanan(config, reply, pushname, sender) {
    reply(menupaket(config.nama, config.namabot, pushname, sender));
}

/**
 * Handle tutorial topup
 */
function handleTutorialTopup(config, reply, pushname, sender) {
    reply(menubelivoucher(config.nama, config.namabot, pushname, sender));
}

/**
 * Handle customer menu
 */
function handleMenuPelanggan(config, reply, pushname, sender) {
    const namaLayanan = config.nama || "Layanan Kami";
    const namaBot = config.namabot || "Bot Kami";
    
    const menuText = `📱 *MENU PELANGGAN ${namaLayanan.toUpperCase()}*
━━━━━━━━━━━━━━━━━━━

📋 *LAYANAN GANGGUAN*
• *lapor* - Laporkan gangguan
• *cektiket [ID]* - Cek status tiket
• *batalkantiket [ID]* - Batalkan tiket

💳 *LAYANAN SALDO & VOUCHER*
• *ceksaldo* - Cek saldo Anda
• *topup* - Cara topup saldo
• *belivoucher [nominal]* - Beli voucher WiFi
• *voucher* - Lihat harga voucher

🔧 *PENGATURAN WIFI*
• *gantinama [nama]* - Ubah nama WiFi
• *gantisandi [sandi]* - Ubah password WiFi
• *gantipassword [sandi]* - Ubah password WiFi

📱 *MANAJEMEN AKSES*
• *akses list* - Lihat daftar akses
• *akses tambah 628xxx* - Tambah akses
• *akses hapus 628xxx* - Hapus akses

🚀 *SPEED ON DEMAND*
• *speedboost* - Request speed boost
• *sod* - Request speed boost

📞 *BANTUAN*
• *admin* - Hubungi admin
• *bantuan* - Panduan lengkap

━━━━━━━━━━━━━━━━━━━
_${namaBot} - Siap membantu Anda 24/7_`;
    
    reply(menuText);
}

module.exports = {
    handleMenuUtama,
    handleMenuTeknisi,
    handleMenuOwner,
    handleTanyaCaraPasang,
    handleTanyaPaketBulanan,
    handleTutorialTopup,
    handleMenuPelanggan
};
