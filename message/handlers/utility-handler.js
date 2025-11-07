/**
 * Utility Handler
 * Menangani fungsi-fungsi utilitas dan bantuan
 */

const templateManager = require('../../lib/template-manager');

/**
 * Handle admin contact
 */
function handleAdminContact(from, ownerNumber, config, msg, sendContact) {
    sendContact(from, `${ownerNumber[0]}`, `Admin ${config.nama}`, msg);
}

/**
 * Handle bantuan
 */
function handleBantuan(pushname, config, reply) {
    // Use template if available, fallback to hardcoded
    if (templateManager.hasTemplate('bantuan')) {
        const message = templateManager.getTemplate('bantuan', {
            pushname: pushname
        });
        reply(message);
    } else {
        // Fallback to hardcoded message if template not found
        const namaLayanan = config.nama || "Layanan Kami";
        const namaBot = config.namabot || "Bot Kami";
        
        const bantuanText = `Hai ${pushname} 👋

*PANDUAN BANTUAN ${namaLayanan.toUpperCase()}*
━━━━━━━━━━━━━━━━━━━

📌 *CARA MENGGUNAKAN BOT:*
1. Ketik perintah yang diinginkan
2. Ikuti instruksi yang diberikan
3. Tunggu respon dari bot

📋 *PERINTAH UTAMA:*
• *menu* - Tampilkan menu utama
• *lapor* - Laporkan gangguan
• *ceksaldo* - Cek saldo Anda
• *admin* - Hubungi admin

🔧 *TIPS:*
• Gunakan perintah dengan benar
• Jangan spam perintah
• Tunggu respon sebelum mengirim perintah baru

📞 *BUTUH BANTUAN LEBIH?*
Hubungi admin dengan mengetik *admin*

━━━━━━━━━━━━━━━━━━━
_${namaBot} - Siap membantu Anda 24/7_`;
        
        reply(bantuanText);
    }
}

/**
 * Handle sapaan umum
 */
function handleSapaanUmum(pushname, reply) {
    const hour = new Date().getHours();
    let templateKey = "";
    
    if (hour >= 0 && hour < 12) {
        templateKey = "sapaan_pagi";
    } else if (hour >= 12 && hour < 15) {
        templateKey = "sapaan_siang";
    } else if (hour >= 15 && hour < 18) {
        templateKey = "sapaan_sore";
    } else {
        templateKey = "sapaan_malam";
    }
    
    // Use template if available
    if (templateManager.hasTemplate(templateKey)) {
        const message = templateManager.getTemplate(templateKey, {
            pushname: pushname
        });
        reply(message);
    } else {
        // Fallback to simple greeting
        const greeting = templateKey.replace('sapaan_', 'Selamat ');
        reply(`${greeting} ${pushname} 👋\n\nAda yang bisa saya bantu? Ketik *menu* untuk melihat daftar perintah yang tersedia.`);
    }
}

/**
 * Handle cek tiket
 */
function handleCekTiket(q, pushname, sender, isOwner, isTeknisi, config, global, reply) {
    if (!q) {
        return reply(`⚠️ Mohon sertakan ID Tiket yang ingin Anda periksa.\n\n*Contoh Penggunaan:*\ncektiket ABC123\n\nAnda bisa menemukan ID Tiket pada pesan konfirmasi saat Anda pertama kali membuat laporan.`);
    }

    const ticketIdToCheck = q.trim();
    const report = global.reports.find(r => r.ticketId && r.ticketId.toLowerCase() === ticketIdToCheck.toLowerCase());

    const namaLayanan = config.nama || "Layanan Kami";
    const namaBotKami = config.namabot || "Bot Kami";

    if (!report) {
        return reply(`🚫 Maaf Kak ${pushname}, tiket dengan ID "*${ticketIdToCheck}*" tidak ditemukan di sistem kami.\n\nPastikan ID Tiket yang Anda masukkan sudah benar, atau hubungi Admin jika Anda yakin tiket tersebut ada.`);
    }

    if (!isOwner && !isTeknisi && report.pelangganId !== sender) {
        return reply(`🚫 Maaf Kak ${pushname}, Anda hanya dapat memeriksa tiket laporan milik Anda sendiri. Tiket ID "*${ticketIdToCheck}*" tidak terdaftar atas nama Anda.`);
    }

    const namaPelanggan = report.pelangganName || report.pelangganPushName || (report.pelangganDataSystem ? report.pelangganDataSystem.name : "N/A");
    const layananPelanggan = report.pelangganSubscription || 
                           (report.pelangganDataSystem && report.pelangganDataSystem.subscription) || 
                           "Tidak terinfo";
    const cuplikanLaporan = report.laporanText.substring(0, 150) + (report.laporanText.length > 150 ? '...' : '');

    const optionsDateFormat = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' };
    const tanggalDibuatFormatted = new Date(report.createdAt).toLocaleString('id-ID', optionsDateFormat);

    let statusDetail = "";
    let pesanTambahan = "";

    switch(report.status) {
        case 'pending':
            statusDetail = "🕒 *MENUNGGU DIPROSES*";
            pesanTambahan = "Laporan Anda sedang dalam antrian. Teknisi akan segera memproses.";
            break;
        case 'assigned':
            statusDetail = "👷 *TEKNISI DITUGASKAN*";
            pesanTambahan = report.teknisiName ? 
                `Teknisi *${report.teknisiName}* telah ditugaskan untuk menangani gangguan Anda.` :
                "Teknisi telah ditugaskan untuk menangani gangguan Anda.";
            break;
        case 'process':
        case 'processing':
            statusDetail = "🔧 *SEDANG DIPROSES*";
            pesanTambahan = report.teknisiName ? 
                `Teknisi *${report.teknisiName}* sedang dalam perjalanan ke lokasi Anda.` :
                "Teknisi sedang dalam perjalanan ke lokasi Anda.";
            break;
        case 'otw':
            statusDetail = "🚗 *TEKNISI MENUJU LOKASI*";
            pesanTambahan = report.teknisiName ? 
                `Teknisi *${report.teknisiName}* sedang menuju ke lokasi Anda.` :
                "Teknisi sedang menuju ke lokasi Anda.";
            break;
        case 'arrived':
            statusDetail = "📍 *TEKNISI TIBA DI LOKASI*";
            pesanTambahan = "Teknisi sudah tiba di lokasi Anda dan akan segera memulai perbaikan.";
            break;
        case 'working':
            statusDetail = "🛠️ *SEDANG DIPERBAIKI*";
            pesanTambahan = "Teknisi sedang melakukan perbaikan. Mohon ditunggu.";
            break;
        case 'resolved':
        case 'completed':
            statusDetail = "✅ *SELESAI*";
            const durasiMenit = report.workDuration || 
                (report.resolvedAt && report.startTime ? 
                    Math.floor((report.resolvedAt - report.startTime) / (1000 * 60)) : 
                    "N/A");
            pesanTambahan = `Gangguan telah selesai diperbaiki${durasiMenit !== "N/A" ? ` (durasi: ${durasiMenit} menit)` : ''}.${report.resolutionNotes ? '\n📝 Catatan: ' + report.resolutionNotes : ''}`;
            break;
        case 'cancelled':
            statusDetail = "❌ *DIBATALKAN*";
            pesanTambahan = "Tiket ini telah dibatalkan.";
            break;
        default:
            statusDetail = `📋 *${report.status.toUpperCase()}*`;
            pesanTambahan = "Status tiket sedang diperbarui.";
    }

    const replyMessage = `📋 *INFORMASI TIKET GANGGUAN*

━━━━━━━━━━━━━━━━
🎫 *ID Tiket:* ${report.ticketId}
📅 *Tanggal:* ${tanggalDibuatFormatted}
━━━━━━━━━━━━━━━━

👤 *DATA PELANGGAN:*
• Nama: ${namaPelanggan}
• Layanan: ${layananPelanggan}

📝 *LAPORAN:*
${cuplikanLaporan}

📊 *STATUS SAAT INI:*
${statusDetail}

💬 ${pesanTambahan}

━━━━━━━━━━━━━━━━
_${namaBotKami} - ${namaLayanan}_`;

    reply(replyMessage);
}

module.exports = {
    handleAdminContact,
    handleBantuan,
    handleSapaanUmum,
    handleCekTiket
};
