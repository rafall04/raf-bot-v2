/**
 * Reboot Modem Handler
 * Menangani proses reboot modem pelanggan
 */

/**
 * Handle reboot modem request
 */
function handleRebootModem({ sender, entities, isOwner, isTeknisi, plainSenderNumber, pushname, users, reply, temp, mess }) {
    // Logika pencarian user yang aman dan konsisten
    let user;
    const providedId = entities.id_pelanggan;

    if ((isOwner || isTeknisi) && providedId && !isNaN(parseInt(providedId))) {
        user = users.find(v => v.id == providedId);
    } else {
        user = users.find(v => v.phone_number && v.phone_number.split("|").includes(plainSenderNumber));
    }

    if (!user) {
        const errorMessage = (isOwner || isTeknisi)
            ? (providedId ? `Maaf, Kak. Pelanggan dengan ID "${providedId}" tidak ditemukan.` : "Anda belum terdaftar sebagai pelanggan. Untuk reboot modem pelanggan lain, sebutkan ID pelanggannya.")
            : mess.userNotRegister;
        return reply(errorMessage);
    }
    
    if (user.subscription === 'PAKET-VOUCHER' && !(isOwner || isTeknisi)) {
        return reply(`Maaf Kak ${pushname}, fitur reboot modem saat ini hanya tersedia untuk pelanggan bulanan.`);
    }
    
    if (!user.device_id) {
        return reply(`Maaf Kak ${pushname}, data device ID untuk pelanggan "${user.name || 'ini'}" tidak ditemukan sehingga saya tidak bisa melakukan reboot. Silakan hubungi Admin.`);
    }

    // Memulai percakapan konfirmasi
    temp[sender] = { step: 'CONFIRM_REBOOT', targetUser: user };
    reply(`Tentu, saya bisa me-reboot modem Anda. Perlu diingat, proses ini akan membuat koneksi internet terputus selama beberapa menit.\n\nAnda yakin ingin melanjutkan?\n\nBalas *'ya'* untuk melanjutkan, atau *'batal'* untuk membatalkan.`);
}

module.exports = {
    handleRebootModem
};
