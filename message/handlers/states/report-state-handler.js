/**
 * Report State Handler
 * Handles all conversation states related to problem reporting (LAPOR_GANGGUAN)
 * 
 * CRITICAL: Contains complete state machine for report submission
 * DO NOT modify without understanding the complete flow
 */

const fs = require('fs');
const path = require('path');
const { renderReport } = require('../../../lib/templating');

/**
 * Helper function to generate ticket ID
 */
function generateTicketId() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let ticketId = '';
    for (let i = 0; i < 7; i++) {
        ticketId += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return ticketId;
}

/**
 * Helper function to save reports to file
 */
function saveReportsToFile(reports) {
    try {
        const reportsPath = path.join(__dirname, '../../..', 'database', 'reports.json');
        fs.writeFileSync(reportsPath, JSON.stringify(reports, null, 2));
        console.log('[REPORT] Reports saved successfully');
    } catch (error) {
        console.error('[REPORT] Error saving reports:', error);
    }
}

/**
 * Handle LAPOR_GANGGUAN_AWAITING_DESCRIPTION state
 */
async function handleLaporGangguanDescription(userState, chats, reply) {
    const laporanText = chats.trim();
    
    if (!laporanText || laporanText === "") {
        return reply(renderReport('form_step1', {}));
    }
    
    // Analisis awal keluhan untuk kategorisasi
    const keluhanLower = laporanText.toLowerCase();
    let kategoriMasalah = 'Gangguan Umum';
    let prioritas = 'Normal';
    
    if (keluhanLower.includes('mati total') || keluhanLower.includes('tidak ada internet')) {
        kategoriMasalah = 'Internet Mati Total';
        prioritas = 'Tinggi';
    } else if (keluhanLower.includes('lemot') || keluhanLower.includes('lambat')) {
        kategoriMasalah = 'Koneksi Lambat';
        prioritas = 'Sedang';
    } else if (keluhanLower.includes('putus-putus') || keluhanLower.includes('intermittent')) {
        kategoriMasalah = 'Koneksi Tidak Stabil';
        prioritas = 'Sedang';
    } else if (keluhanLower.includes('wifi') && (keluhanLower.includes('tidak bisa') || keluhanLower.includes('gak bisa'))) {
        kategoriMasalah = 'Masalah WiFi';
        prioritas = 'Sedang';
    }
    
    // Simpan keluhan dan kategori
    userState.step = 'LAPOR_GANGGUAN_ASK_REBOOT';
    userState.keluhan = laporanText;
    userState.kategoriMasalah = kategoriMasalah;
    userState.prioritas = prioritas;
    
    return reply(`✅ *KELUHAN BERHASIL DICATAT*\n\n📊 *Analisis Awal:*\n├ 📁 Kategori: ${kategoriMasalah}\n├ ⚡ Prioritas: ${prioritas}\n└ 📝 Keluhan: "${laporanText}"\n\n━━━━━━━━━━━━━━━━━━━━━━━━━\n\n🔧 *Langkah 2 dari 6: Troubleshooting Awal*\n\nSebelum teknisi kami datang, mari kita coba solusi sederhana yang sering berhasil mengatasi masalah.\n\n🔌 *PERTANYAAN: Restart Modem*\n\nApakah Anda sudah mencoba *merestart/reboot modem*?\n\n📖 *Cara restart modem yang benar:*\n1️⃣ Cabut kabel power dari modem\n2️⃣ Tunggu minimal 10 detik\n3️⃣ Pasang kembali kabel power\n4️⃣ Tunggu 2-3 menit hingga lampu stabil\n\n✏️ *Silakan jawab:*\n• Ketik *'ya'* → jika sudah mencoba restart\n• Ketik *'tidak'* → jika belum mencoba`);
}

/**
 * Handle LAPOR_GANGGUAN_ASK_REBOOT state
 */
async function handleLaporGangguanAskReboot(userState, userReply, reply) {
    const response = userReply.toLowerCase().trim();
    
    if (response === 'ya' || response === 'yes' || response === 'y' || response === 'sudah') {
        userState.sudah_reboot = 'Ya';
        userState.step = 'LAPOR_GANGGUAN_ASK_LOS';
        return reply(`✅ *Terima kasih sudah mencoba restart modem*\n\n━━━━━━━━━━━━━━━━━━━━━━━━━\n\n🔍 *Langkah 3 dari 6: Pemeriksaan Lampu LOS*\n\nSekarang saya perlu memeriksa kondisi lampu indikator pada modem Anda untuk mendeteksi masalah jaringan fiber optik.\n\n🔴 *PERTANYAAN PENTING:*\n\nApakah ada lampu *LOS* berwarna *MERAH* yang menyala di modem Anda?\n\n📍 *Cara Menemukan Lampu LOS:*\n• Lihat panel depan modem\n• Cari tulisan \"LOS\" di dekat lampu\n• Biasanya terletak di antara lampu Power dan PON\n• Jika menyala, warnanya MERAH terang\n\n⚠️ *Mengapa ini penting?*\nLampu LOS merah menandakan gangguan serius pada kabel fiber optik yang memerlukan penanganan teknisi segera.\n\n✏️ *Silakan jawab:*\n• Ketik *'ya'* → jika ada lampu LOS merah menyala\n• Ketik *'tidak'* → jika tidak ada lampu merah`);
        
    } else if (response === 'tidak' || response === 'no' || response === 'n' || response === 'belum') {
        userState.sudah_reboot = 'Tidak';
        userState.step = 'LAPOR_GANGGUAN_ASK_LOS';
        return reply(`📌 *Catatan: Belum mencoba restart*\n\n💡 *REKOMENDASI PENTING:*\nRestart modem dapat mengatasi 60% masalah koneksi. Sangat disarankan untuk mencoba restart sebelum teknisi datang.\n\n━━━━━━━━━━━━━━━━━━━━━━━━━\n\n🔍 *Langkah 3 dari 6: Pemeriksaan Lampu LOS*\n\nMari kita lanjutkan pemeriksaan untuk diagnosis yang akurat.\n\n🔴 *PERTANYAAN PENTING:*\n\nApakah ada lampu *LOS* berwarna *MERAH* yang menyala di modem?\n\n📍 *Panduan Mencari Lampu LOS:*\n• Perhatikan panel depan modem\n• Cari tulisan \"LOS\" (Loss of Signal)\n• Posisi: biasanya di antara Power dan PON\n• Jika ada masalah, lampunya MERAH terang\n\n⚠️ *Info Penting:*\nLOS merah = gangguan kabel fiber (urgent)\nLOS mati = koneksi fiber normal\n\n✏️ *Silakan jawab:*\n• Ketik *'ya'* → ada lampu LOS merah\n• Ketik *'tidak'* → tidak ada lampu merah`);
        
    } else {
        return reply(`⚠️ *Maaf, saya tidak mengerti jawaban Anda*\n\nMohon jawab dengan salah satu pilihan berikut:\n\n✅ Ketik *'ya'* → jika sudah mencoba restart modem\n❌ Ketik *'tidak'* → jika belum mencoba restart\n\n📝 *Pengingat:*\nRestart modem = cabut kabel power selama 10 detik, kemudian pasang kembali dan tunggu 2-3 menit.\n\nSilakan ketik jawaban Anda:`);
    }
}

/**
 * Handle LAPOR_GANGGUAN_ASK_LOS state
 */
async function handleLaporGangguanAskLos(userState, userReply, reply) {
    const response = userReply.toLowerCase().trim();
    
    if (response === 'ya' || response === 'yes' || response === 'y' || response === 'ada') {
        userState.lampu_los = 'Ya (Merah menyala)';
        userState.urgency = 'URGENT';
        userState.step = 'LAPOR_GANGGUAN_ASK_LAMPU_DETAIL';
        return reply(`🚨 *ALERT: GANGGUAN FIBER OPTIK TERDETEKSI!*\n\n🔴 *Status: URGENT - Prioritas Tinggi*\n\n⚠️ *Lampu LOS Merah Menandakan:*\n├ 🔸 Kabel fiber optik putus/rusak\n├ 🔸 Gangguan pada jaringan utama (ODP/ODC)\n├ 🔸 Konektor fiber kotor atau lepas\n└ 🔸 Memerlukan penanganan teknisi SEGERA\n\n━━━━━━━━━━━━━━━━━━━━━━━━━\n\n📊 *Langkah 4 dari 6: Detail Lampu Indikator*\n\nUntuk memastikan diagnosis yang tepat, mohon sebutkan *SEMUA LAMPU* yang menyala/mati di modem Anda.\n\n📝 *Panduan Menjawab:*\nPerhatikan dan sebutkan kondisi setiap lampu:\n• *Power* → Hijau/Merah/Mati?\n• *PON* → Hijau/Merah/Mati?\n• *LOS* → Merah (sudah terkonfirmasi)\n• *LAN 1-4* → Hijau/Mati?\n• *WiFi/WLAN* → Hijau/Kedip/Mati?\n\n✅ *Contoh Jawaban yang Baik:*\n• \"Power hijau, PON mati, LOS merah, LAN1 hijau, WiFi hijau\"\n• \"Semua lampu hijau menyala\"\n• \"Hanya Power yang nyala\"\n\n✏️ *Ketik kondisi lampu modem Anda:*`);
        
    } else if (response === 'tidak' || response === 'no' || response === 'n' || response === 'gak ada') {
        userState.lampu_los = 'Tidak';
        userState.urgency = 'Normal';
        userState.step = 'LAPOR_GANGGUAN_ASK_LAMPU_DETAIL';
        return reply(`✅ *Kabar Baik: Tidak Ada LOS Merah*\n└ Koneksi fiber optik kemungkinan normal\n\n━━━━━━━━━━━━━━━━━━━━━━━━━\n\n📊 *Langkah 4 dari 6: Pemeriksaan Detail Lampu*\n\nUntuk mendiagnosis masalah dengan tepat, saya perlu mengetahui kondisi *SEMUA LAMPU INDIKATOR* pada modem Anda.\n\n🔦 *Lampu-Lampu yang Perlu Dicek:*\n\n1️⃣ *POWER* (Daya/Listrik)\n   └ Normal: Hijau menyala\n\n2️⃣ *PON* (Passive Optical Network)\n   └ Normal: Hijau menyala\n\n3️⃣ *LAN 1-4* (Kabel Internet)\n   └ Normal: Hijau jika ada kabel terpasang\n\n4️⃣ *WiFi/WLAN* (Sinyal Nirkabel)\n   └ Normal: Hijau menyala/berkedip\n\n5️⃣ *INTERNET* (Status Koneksi)\n   └ Normal: Hijau menyala\n\n📝 *Cara Menjawab yang Benar:*\nSebutkan nama lampu dan warnanya\n\n✅ *Contoh Jawaban:*\n• \"Semua lampu hijau menyala normal\"\n• \"Power hijau, PON hijau, WiFi mati, LAN1 hijau\"\n• \"Power dan PON hijau, yang lain mati\"\n\n✏️ *Silakan ketik kondisi lampu modem:*`);
        
    } else {
        return reply(`⚠️ *Maaf, saya tidak mengerti jawaban Anda*\n\nPertanyaan: Apakah ada lampu *LOS MERAH* menyala?\n\n✅ Ketik *'ya'* → jika ada lampu LOS merah\n❌ Ketik *'tidak'* → jika tidak ada\n\n💡 *Tips Mencari Lampu LOS:*\n• Cek panel depan modem\n• Cari tulisan \"LOS\" di dekat lampu\n• Jika bermasalah, lampunya MERAH terang\n• Jika normal, lampunya MATI\n\nSilakan ketik jawaban Anda:`);
    }
}

/**
 * Handle LAPOR_GANGGUAN_ASK_LAMPU_DETAIL state
 */
async function handleLaporGangguanAskLampu(userState, chats, reply) {
    const lampuResponse = chats.trim();
    
    if (!lampuResponse || lampuResponse === "") {
        return reply("⚠️ *Jawaban tidak boleh kosong*\n\nMohon sebutkan kondisi lampu-lampu pada modem Anda.\n\n📝 *Contoh jawaban:*\n• \"Power hijau, PON hijau, WiFi hijau\"\n• \"Semua lampu hijau menyala\"\n• \"Hanya Power yang nyala\"\n\nSilakan ketik kondisi lampu modem:");
    }
    
    // Simpan detail lampu
    userState.detail_lampu = lampuResponse;
    
    // Analisis sederhana untuk memberikan indikasi masalah
    let indikasi_masalah = '';
    const lampuLower = lampuResponse.toLowerCase();
    
    if (userState.lampu_los === 'Ya (Merah menyala)') {
        indikasi_masalah = '🔴 Kemungkinan: Kabel fiber putus/gangguan jaringan fiber';
    } else if (lampuLower.includes('power') && !lampuLower.includes('pon')) {
        indikasi_masalah = '🟡 Kemungkinan: Kabel fiber tidak terpasang dengan baik';
    } else if (lampuLower.includes('semua') && lampuLower.includes('hijau')) {
        indikasi_masalah = '🟢 Lampu normal, kemungkinan masalah di pengaturan/router';
    } else if (!lampuLower.includes('wifi') && !lampuLower.includes('wlan')) {
        indikasi_masalah = '🟡 Kemungkinan: WiFi mati/tidak aktif';
    }
    
    userState.indikasi_masalah = indikasi_masalah;
    userState.step = 'LAPOR_GANGGUAN_ASK_DETAIL_TAMBAHAN';
    
    let pesanIndikasi = indikasi_masalah ? `🔍 *HASIL DIAGNOSIS AWAL:*\n${indikasi_masalah}\n\n━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` : '';
    
    return reply(`${pesanIndikasi}📝 *Langkah 5 dari 6: Informasi Tambahan*\n\nApakah ada *informasi tambahan* yang perlu kami ketahui?\n\n💡 *Contoh Info yang Membantu:*\n• Kapan masalah mulai terjadi\n• Apakah ada hujan/petir sebelumnya\n• Apakah ada perbaikan jalan/galian kabel\n• Apakah tagihan sudah dibayar\n• Perangkat apa yang bermasalah (HP/Laptop/TV)\n• Sudah coba dengan perangkat lain?\n\n✏️ *Silakan ketik informasi tambahan*\natau ketik *'tidak ada'* jika tidak ada info lain:`);
}

/**
 * Handle LAPOR_GANGGUAN_ASK_DETAIL_TAMBAHAN state
 */
async function handleLaporGangguanDetailTambahan(userState, chats, reply) {
    const detailTambahan = chats.trim();
    const { keluhan, sudah_reboot, lampu_los, detail_lampu, indikasi_masalah } = userState;
    
    // Set detail tambahan
    let infoTambahan = detailTambahan;
    if (detailTambahan.toLowerCase() === 'tidak ada' || detailTambahan.toLowerCase() === 'tidak' || detailTambahan.toLowerCase() === 'gak ada') {
        infoTambahan = 'Tidak ada';
    }
    
    userState.info_tambahan = infoTambahan;
    userState.step = 'LAPOR_GANGGUAN_CONFIRM';
    
    // Tampilkan ringkasan untuk konfirmasi
    const urgencyBadge = userState.urgency === 'URGENT' ? '🔴 *[URGENT]* ' : '🟡 *[NORMAL]* ';
    const kategoriIcon = userState.kategoriMasalah === 'Internet Mati Total' ? '⛔' : 
                        userState.kategoriMasalah === 'Koneksi Lambat' ? '🐌' :
                        userState.kategoriMasalah === 'Koneksi Tidak Stabil' ? '📶' :
                        userState.kategoriMasalah === 'Masalah WiFi' ? '📡' : '⚠️';
    
    const ringkasan = `📋 *KONFIRMASI LAPORAN GANGGUAN*\n\n${urgencyBadge}${kategoriIcon} ${userState.kategoriMasalah}\n\n━━━━━━━━━━━━━━━━━━━━━━━━━\n\n📝 *DETAIL LAPORAN:*\n\n1️⃣ *Keluhan Utama:*\n└ ${keluhan}\n\n2️⃣ *Troubleshooting:*\n└ Sudah restart modem: ${sudah_reboot}\n\n3️⃣ *Status Lampu Indikator:*\n├ LOS: ${lampu_los}\n└ Detail: ${detail_lampu}\n\n4️⃣ *Informasi Tambahan:*\n└ ${infoTambahan}\n\n${indikasi_masalah ? `5️⃣ *Diagnosis Sistem:*\n└ ${indikasi_masalah}\n\n` : ''}━━━━━━━━━━━━━━━━━━━━━━━━━\n\n✅ *Langkah 6 dari 6: Konfirmasi*\n\nApakah semua informasi di atas sudah *BENAR*?\n\n✏️ *Pilihan:*\n• Ketik *'ya'* → Kirim laporan ke teknisi\n• Ketik *'tidak'* → Batalkan dan mulai ulang\n\nSilakan konfirmasi:`;
    
    return reply(ringkasan);
}

/**
 * Handle LAPOR_GANGGUAN_CONFIRM state
 */
async function handleLaporGangguanConfirm(userState, userReply, reply, sender, temp, global, plainSenderNumber, pushname) {
    const response = userReply.toLowerCase().trim();
    const { keluhan, sudah_reboot, lampu_los, detail_lampu, indikasi_masalah, info_tambahan, targetUser } = userState;
    
    if (response === 'ya' || response === 'yes' || response === 'y' || response === 'kirim') {
        // Buat tiket dengan format lengkap
        const ticketId = generateTicketId();
        const fullDescription = `Keluhan: ${keluhan}\nSudah coba reboot: ${sudah_reboot}\nLampu LOS: ${lampu_los}\nDetail Lampu: ${detail_lampu}\nInfo tambahan: ${info_tambahan}`;
        
        const newReport = {
            ticketId: ticketId,
            pelangganId: sender,
            pelangganPushName: pushname,
            pelangganPhone: targetUser ? targetUser.phone_number : plainSenderNumber,
            pelangganName: targetUser ? targetUser.name : pushname,
            pelangganAddress: targetUser ? targetUser.address : 'Tidak diketahui',
            pelangganDataSystem: targetUser,
            laporanText: fullDescription,
            status: 'baru',
            priority: userState.urgency === 'URGENT' ? 'high' : 'medium',
            createdAt: new Date().toISOString(),
            processedByTeknisiId: null,
            processedByTeknisiName: null,
            processingStartedAt: null,
            resolvedAt: null,
            resolvedByTeknisiId: null,
            resolvedByTeknisiName: null,
            notes: `${lampu_los === 'Ya (Merah menyala)' ? 'LOS MERAH - ' : ''}${indikasi_masalah || 'Perlu diagnosa lebih lanjut'}`
        };
        
        if (!global.reports) {
            global.reports = [];
        }
        
        global.reports.push(newReport);
        saveReportsToFile(global.reports);
        
        delete temp[sender];
        
        // Tips berdasarkan indikasi masalah
        let additionalMessage = '';
        let estimasiWaktu = '';
        
        // Import getResponseTimeMessage if available
        try {
            const { getResponseTimeMessage } = require('../../lib/working-hours-helper');
            const { priority, timeMessage } = getResponseTimeMessage(userState.urgency === 'URGENT' ? 'high' : 'medium');
            estimasiWaktu = timeMessage;
        } catch (error) {
            // Fallback if module not found
            if (userState.urgency === 'URGENT') {
                estimasiWaktu = '⏰ *Estimasi Penanganan:* 1-2 jam (Prioritas Tinggi)';
            } else {
                estimasiWaktu = '⏰ *Estimasi Penanganan:* 3-6 jam';
            }
        }
        
        if (lampu_los === 'Ya (Merah menyala)') {
            additionalMessage = '\n\n⚠️ *PERHATIAN KHUSUS:*\nKarena lampu LOS merah, masalah Anda akan diprioritaskan. Teknisi akan segera menangani gangguan fiber optik Anda.';
        } else if (sudah_reboot === 'Tidak') {
            additionalMessage = '\n\n💡 *SARAN:*\nSementara menunggu teknisi, coba restart modem:\n1. Cabut kabel power 10 detik\n2. Pasang kembali\n3. Tunggu 2-3 menit';
        }
        
        const successMessage = `✅ *LAPORAN BERHASIL DIKIRIM!*\n\n📋 *DETAIL TIKET:*\n├ 🎫 ID Tiket: *${ticketId}*\n├ 📅 Tanggal: ${new Date().toLocaleDateString('id-ID')}\n├ ⏰ Waktu: ${new Date().toLocaleTimeString('id-ID')}\n├ 🏷️ Status: Baru\n└ ${userState.urgency === 'URGENT' ? '🔴 Prioritas: URGENT' : '🟡 Prioritas: Normal'}\n\n${estimasiWaktu}\n\n📱 *LANGKAH SELANJUTNYA:*\n1. Teknisi akan segera menghubungi Anda\n2. Siapkan informasi tambahan jika diperlukan\n3. Pastikan nomor HP aktif dan dapat dihubungi\n\n🔍 *CEK STATUS:*\nKetik: *cek tiket ${ticketId}*${additionalMessage}\n\n🙏 Terima kasih telah melaporkan gangguan. Tim kami akan segera menangani masalah Anda.`;
        
        return reply(successMessage);
        
    } else if (response === 'tidak' || response === 'no' || response === 'n' || response === 'batal') {
        delete temp[sender];
        return reply("❌ *Laporan dibatalkan*\n\nJika Anda ingin membuat laporan baru, silakan ketik *'lapor'* untuk memulai kembali.\n\nAda yang bisa saya bantu lagi?");
    } else {
        return reply("⚠️ *Pilihan tidak valid*\n\n✅ Ketik *'ya'* → Kirim laporan ke teknisi\n❌ Ketik *'tidak'* → Batalkan laporan\n\nSilakan pilih:");
    }
}

module.exports = {
    handleLaporGangguanDescription,
    handleLaporGangguanAskReboot,
    handleLaporGangguanAskLos,
    handleLaporGangguanAskLampu,
    handleLaporGangguanDetailTambahan,
    handleLaporGangguanConfirm,
    generateTicketId,
    saveReportsToFile
};
