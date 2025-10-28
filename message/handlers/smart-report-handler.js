/**
 * Smart Report Handler - Intelligent Troubleshooting with Device Detection
 * Handles LAPOR_GANGGUAN_MATI and LAPOR_GANGGUAN_LEMOT with auto-classification
 */

const { isDeviceOnline, getDeviceOfflineMessage } = require('../../lib/device-status');
const { setUserState, getUserState, deleteUserState } = require('./conversation-handler');
const { getResponseTimeMessage, isWithinWorkingHours } = require('../../lib/working-hours-helper');
const fs = require('fs');
const path = require('path');

// Generate ticket ID function (same as in raf.js)
function generateTicketId(length = 7) {
    const characters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let result = '';
    const charactersLength = characters.length;
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
}

/**
 * Handle GANGGUAN_MATI - Internet mati/putus total (HIGH Priority)
 * Auto-detect device status via GenieACS
 */
async function handleGangguanMati({ sender, pushname, userPelanggan, reply, findUserByPhone }) {
    try {
        // Find user
        const user = findUserByPhone ? 
            findUserByPhone(sender.replace('@s.whatsapp.net', '')) : 
            global.users.find(u => 
                u.phone_number && u.phone_number.split("|").some(num =>
                    num.trim() === sender.replace('@s.whatsapp.net', '') || 
                    `62${num.trim().substring(1)}` === sender.replace('@s.whatsapp.net', '')
                )
            );
        
        if (!user) {
            return { 
                success: false, 
                message: '❌ Nomor Anda belum terdaftar sebagai pelanggan.\n\nSilakan hubungi admin untuk mendaftar.' 
            };
        }
        
        // Check for duplicate/active report
        const recentReport = global.reports.find(r => 
            r.pelangganUserId === user.id &&
            r.status !== 'selesai' &&
            r.status !== 'completed' &&
            r.status !== 'cancelled' &&
            r.status !== 'dibatalkan'
        );
        
        if (recentReport) {
            const statusText = recentReport.status === 'baru' ? 
                'Menunggu diproses' : 
                `Sedang diproses oleh ${recentReport.processedByTeknisiName || 'teknisi'}`;
                
            return {
                success: false,
                message: `⚠️ *ANDA SUDAH MEMILIKI LAPORAN AKTIF*

📋 ID Tiket: *${recentReport.ticketId}*
📊 Status: ${statusText}
⏰ Dibuat: ${new Date(recentReport.createdAt).toLocaleString('id-ID', {
                    dateStyle: 'short',
                    timeStyle: 'short',
                    timeZone: 'Asia/Jakarta'
                })}

Silakan tunggu penyelesaian laporan ini terlebih dahulu.

Untuk cek status, ketik:
*ceklaporan*

Jika urgent, hubungi:
📞 Hotline: 085xxxxxxxxx`
            };
        }
        
        // Auto-check device status
        const deviceStatus = await isDeviceOnline(user.device_id);
        
        console.log('[handleGangguanMati] Device status:', {
            online: deviceStatus.online,
            minutesAgo: deviceStatus.minutesAgo,
            hasError: !!deviceStatus.error
        });
        
        if (!deviceStatus.online) {
            // ❌ DEVICE OFFLINE - High priority, kemungkinan kabel/listrik
            const minutesAgo = deviceStatus.minutesAgo || 'lebih dari 30';
            
            setUserState(sender, {
                step: 'GANGGUAN_MATI_DEVICE_OFFLINE',
                targetUser: user,
                deviceStatus: deviceStatus,
                issueType: 'MATI',
                priority: 'HIGH'
            });

            // Check if outside working hours
            const workingStatus = isWithinWorkingHours();
            let outOfHoursNotice = '';
            
            if (!workingStatus.isWithinHours) {
                const config = global.config.teknisiWorkingHours;
                outOfHoursNotice = `\n\n⏰ *PERHATIAN:*\n${config.outOfHoursMessage || 'Laporan Anda diterima di luar jam kerja. Akan diproses pada jam kerja berikutnya.'}\n`;
                if (workingStatus.nextWorkingTime) {
                    const options = {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long',
                        hour: '2-digit',
                        minute: '2-digit',
                        timeZone: 'Asia/Jakarta'
                    };
                    const timeStr = workingStatus.nextWorkingTime.toLocaleString('id-ID', options);
                    outOfHoursNotice += `Teknisi akan tersedia: ${timeStr} WIB`;
                }
            }
            
            return {
                success: true,
                message: `🚨 *GANGGUAN TERDETEKSI*

Status Perangkat: *OFFLINE* ❌
Terakhir Online: ${minutesAgo} menit yang lalu

*Kemungkinan Penyebab:*
⚡ Listrik mati / modem tidak menyala
🔌 Kabel power lepas
📡 Kabel fiber optik lepas/putus/bengkok
🔥 Gangguan dari ODP/jaringan pusat
⚠️ Modem/ONT rusak atau overheating

*Langkah Troubleshooting Cepat:*
1️⃣ Cek apakah modem/ONT menyala (lihat lampu indikator)
2️⃣ Cek kabel power terpasang dengan baik
3️⃣ Cek kabel fiber optik yang masuk ke modem tidak lepas/bengkok
4️⃣ Tunggu 5 menit, lalu restart modem (cabut-pasang power)${outOfHoursNotice}

⏱️ Apakah sudah mencoba langkah di atas?

*Pilih salah satu:*
1️⃣ Sudah dicoba, masih mati
2️⃣ Belum dicoba
3️⃣ Sudah normal kembali
0️⃣ Batal

Balas dengan *angka* (1/2/3/0)`
            };
            
        } else {
            // ✅ DEVICE ONLINE - Tapi user report mati (WiFi issue)
            setUserState(sender, {
                step: 'GANGGUAN_MATI_DEVICE_ONLINE',
                targetUser: user,
                deviceStatus: deviceStatus,
                issueType: 'MATI_WIFI_ONLY',
                priority: 'MEDIUM'
            });

            return {
                success: true,
                message: `🤔 *ANALISIS STATUS*

Menariknya, modem Anda terdeteksi *ONLINE* ✅ di sistem kami.

Ini berarti modem hidup dan terhubung ke jaringan, kemungkinan:

📶 *Masalah WiFi (bukan kabel):*
   • WiFi disabled atau SSID disembunyikan
   • Password WiFi berubah tanpa sengaja
   • Channel WiFi bentrok dengan tetangga
   
📱 *Masalah Device User:*
   • HP/laptop bermasalah
   • Driver WiFi bermasalah
   • Airplane mode aktif

*Coba Langkah Ini Dulu:*
1️⃣ Restart HP/laptop yang digunakan
2️⃣ Lupa jaringan WiFi → Konek ulang
3️⃣ Cek apakah WiFi masih muncul di daftar
4️⃣ Coba perangkat lain (HP yang berbeda)

Sudah dicoba?

*Pilih salah satu:*
1️⃣ Tetap mati, buat tiket
2️⃣ Sudah bisa terkoneksi
0️⃣ Batal

Balas dengan *angka* (1/2/0)`
            };
        }
        
    } catch (error) {
        console.error('[handleGangguanMati] Error:', error);
        return {
            success: false,
            message: `❌ Maaf, terjadi kesalahan saat memeriksa status perangkat. Silakan coba lagi atau hubungi admin.`
        };
    }
}

/**
 * Handle GANGGUAN_LEMOT - Internet lambat (MEDIUM Priority)
 * Check device status and provide intelligent troubleshooting
 */
async function handleGangguanLemot({ sender, pushname, userPelanggan, reply, findUserByPhone }) {
    try {
        // Find user
        const user = findUserByPhone ? 
            findUserByPhone(sender.replace('@s.whatsapp.net', '')) : 
            global.users.find(u => 
                u.phone_number && u.phone_number.split("|").some(num =>
                    num.trim() === sender.replace('@s.whatsapp.net', '') || 
                    `62${num.trim().substring(1)}` === sender.replace('@s.whatsapp.net', '')
                )
            );
        
        if (!user) {
            return { 
                success: false, 
                message: '❌ Nomor Anda belum terdaftar sebagai pelanggan.\n\nSilakan hubungi admin untuk mendaftar.' 
            };
        }

        // Check if user already has active report
        const laporanAktif = global.reports.find(
            report => report.pelangganUserId === user.id &&
                      (report.status === 'pending' || report.status === 'baru' || 
                       report.status === 'process' || report.status === 'otw' || 
                       report.status === 'on_location' || report.status === 'in_progress' ||
                       report.status === 'diproses teknisi')
        );

        if (laporanAktif) {
            return { 
                success: false, 
                message: `⚠️ *ANDA SUDAH MEMILIKI LAPORAN AKTIF*\n\n📋 ID Tiket: *${laporanAktif.ticketId}*\n\nMohon tunggu hingga laporan tersebut selesai diproses.` 
            };
        }

        // Auto-check device status
        const deviceStatus = await isDeviceOnline(user.device_id);
        
        if (!deviceStatus.online) {
            // Device offline - redirect to MATI handler
            return {
                success: false,
                message: `❌ *Koreksi Analisis*

Perangkat Anda terdeteksi *OFFLINE* di sistem kami.

Sepertinya bukan masalah "lemot", tapi koneksi terputus total.

Silakan ketik: *lapor wifi mati* atau *lapor internet mati*
untuk troubleshooting gangguan mati/putus.`
            };
        }
        
        // Device ONLINE - Continue with lemot troubleshooting
        setUserState(sender, {
            step: 'GANGGUAN_LEMOT_AWAITING_RESPONSE',
            targetUser: user,
            deviceStatus: deviceStatus,
            issueType: 'LEMOT',
            priority: 'MEDIUM'
        });

        const paketUser = user.subscription || 'Tidak diketahui';
        
        return {
            success: true,
            message: `🐌 *ANALISIS GANGGUAN LEMOT*

Status Device: *ONLINE* ✅
Paket Anda: *${paketUser}*

*Troubleshooting Awal - Cek Hal Ini:*

1️⃣ *Terlalu Banyak Perangkat Terhubung?*
   Ketik: *cek wifi*
   Untuk lihat berapa device yang konek

2️⃣ *Aplikasi Berat Berjalan?*
   • Download torrent/file besar
   • Streaming video HD
   • Update Windows/Apps
   Tutup yang tidak perlu

3️⃣ *Jarak dari Modem Terlalu Jauh?*
   Coba dekat ke modem, apakah lebih cepat?

4️⃣ *Jam Sibuk (Peak Hours)?*
   Jam 7-10 malam biasanya ramai pengguna

5️⃣ *Speed Test*
   Coba test: speedtest.net atau fast.com
   Share hasil di sini

Setelah dicoba:

*Pilih salah satu:*
1️⃣ Tetap lemot, buat tiket
2️⃣ Sudah cepat kembali
3️⃣ Kirim hasil speedtest
0️⃣ Batal

Balas dengan *angka* (1/2/0) atau *speedtest [mbps]*
Contoh: speedtest 20`
        };
        
    } catch (error) {
        console.error('[handleGangguanLemot] Error:', error);
        return {
            success: false,
            message: `❌ Maaf, terjadi kesalahan saat menganalisis koneksi. Silakan coba lagi atau hubungi admin.`
        };
    }
}

/**
 * Handle follow-up response for GANGGUAN_MATI (Device OFFLINE)
 */
async function handleGangguanMatiOfflineResponse({ sender, body, reply, findUserByPhone }) {
    const state = getUserState(sender);
    const response = body.toLowerCase().trim();
    
    // Check for cancel command (0 atau batal)
    if (response === '0' || response === 'batal' || response === 'cancel') {
        deleteUserState(sender);
        return { 
            success: true, 
            message: `❌ Proses laporan dibatalkan. Jika masih ada masalah, silakan lapor kembali.` 
        };
    }
    
    // 3 = sudah bisa/normal kembali
    if (response === '3' || response.includes('sudah bisa') || response.includes('sudahbisa') || response.includes('normal')) {
        deleteUserState(sender);
        return { 
            success: true, 
            message: `🎉 Alhamdulillah! Senang mendengar internet sudah kembali normal.\n\nJika ada masalah lagi, jangan ragu untuk chat ya. Terima kasih! 🙏` 
        };
    }
    
    // 1 = sudah dicoba masih mati
    if (response === '1' || response === 'sudah dicoba' || response.includes('sudah') && !response.includes('belum')) {
        // User sudah troubleshoot tapi masih mati - CREATE HIGH PRIORITY TICKET
            // Set state for optional photo upload
            const ticketId = generateTicketId();
            setUserState(sender, {
                step: 'GANGGUAN_MATI_AWAITING_PHOTO',
                targetUser: state.targetUser,
                deviceStatus: state.deviceStatus,
                startTime: Date.now(), // For timeout tracking
                ticketData: {
                    ticketId,
                    pelangganUserId: state.targetUser.id,
                    pelangganId: sender,
                    pelangganName: state.targetUser.name || state.targetUser.username,
                    pelangganPhone: state.targetUser.phone_number || '',
                    pelangganAddress: state.targetUser.address || '',
                    laporanText: `Internet mati total - Device OFFLINE\nTerakhir online: ${state.deviceStatus.minutesAgo || 'lebih dari 30'} menit yang lalu\nTroubleshooting sudah dilakukan.`,
                    status: 'baru',
                    priority: 'HIGH',
                    createdAt: new Date().toISOString(),
                    deviceOnline: false,
                    issueType: 'MATI',
                    troubleshootingDone: true
                },
                uploadedPhotos: []
            });

        // Don't save yet - wait for photo upload or skip
        // Return message prompting for optional photo upload
        return {
            success: true,
            message: `📸 *UPLOAD FOTO (OPSIONAL)*

Untuk membantu teknisi mengidentifikasi masalah, Anda bisa upload foto:

📷 *Foto yang membantu:*
• Lampu indikator modem/ONT
• Kondisi kabel (jika terlihat putus/rusak)
• Pesan error di layar (jika ada)
• Kondisi fisik perangkat

*Cara Upload:*
1. Kirim foto satu per satu
2. Maksimal 3 foto
3. Setelah selesai ketik *lanjut*
4. Atau ketik *skip* jika tidak ada foto

⏱️ *Timeout: 5 menit*

_Foto akan membantu teknisi membawa spare part yang tepat_`
        };
    }
    
    // Dead code below - will be removed
    if (false) { // Wrap in false to indicate this is dead code to be removed
        // Send to all teknisi from accounts database
        const teknisiAccounts = global.accounts.filter(acc => 
            acc.role === 'teknisi' && acc.phone_number && acc.phone_number.trim() !== ""
        );

        for (const teknisi of teknisiAccounts) {
            try {
                let teknisiJid = teknisi.phone_number.trim();
                if (!teknisiJid.endsWith('@s.whatsapp.net')) {
                    if (teknisiJid.startsWith('0')) {
                        teknisiJid = `62${teknisiJid.substring(1)}@s.whatsapp.net`;
                    } else if (teknisiJid.startsWith('62')) {
                        teknisiJid = `${teknisiJid}@s.whatsapp.net`;
                    } else {
                        teknisiJid = `62${teknisiJid}@s.whatsapp.net`;
                    }
                }
                await global.raf.sendMessage(teknisiJid, { text: notifMessage });
                console.log(`[REPORT] Notified teknisi: ${teknisi.username} (${teknisiJid})`);
            } catch (err) {
                console.error(`Failed to notify teknisi ${teknisi.username}:`, err.message);
            }
        }

        // Also notify admins/owners
        const adminAccounts = global.accounts.filter(acc => 
            ['admin', 'owner', 'superadmin'].includes(acc.role) && 
            acc.phone_number && acc.phone_number.trim() !== ""
        );

        const adminNotifMsg = `📊 *LAPORAN URGENT BARU*\n\n${notifMessage}\n\n_Notifikasi telah dikirim ke ${teknisiAccounts.length} teknisi._`;

        for (const admin of adminAccounts) {
            try {
                let adminJid = admin.phone_number.trim();
                if (!adminJid.endsWith('@s.whatsapp.net')) {
                    if (adminJid.startsWith('0')) {
                        adminJid = `62${adminJid.substring(1)}@s.whatsapp.net`;
                    } else if (adminJid.startsWith('62')) {
                        adminJid = `${adminJid}@s.whatsapp.net`;
                    } else {
                        adminJid = `62${adminJid}@s.whatsapp.net`;
                    }
                }
                await global.raf.sendMessage(adminJid, { text: adminNotifMsg });
            } catch (err) {
                console.error(`Failed to notify admin ${admin.username}:`, err.message);
            }
        }

        deleteUserState(sender);
        
        const responseTime = getResponseTimeMessage('HIGH');
        
        return {
            success: true,
            message: `✅ *TIKET PRIORITAS TINGGI DIBUAT*

Nomor Tiket: *${ticketId}*
Prioritas: *🔴 URGENT*

Teknisi akan segera menghubungi Anda untuk perbaikan.

⏱️ *Estimasi Waktu:* ${responseTime}

Mohon pastikan HP Anda aktif agar teknisi dapat menghubungi.

Terima kasih atas kesabarannya. 🙏`
        };
    }
    
    // 2 = belum dicoba
    if (response === '2' || response.includes('belum')) {
        return { 
            success: true, 
            message: `Baik Kak, silakan coba langkah troubleshooting di atas terlebih dahulu ya.\n\nJika setelah dicoba masih mati, balas dengan angka *1* untuk saya buatkan tiket teknisi segera. 🙏` 
        };
    }
    
    // Default - remind user
    return { 
        success: true, 
        message: `Mohon balas dengan angka:\n*1* - Sudah dicoba, masih mati\n*2* - Belum dicoba\n*3* - Sudah normal kembali\n*0* - Batal` 
    };
}

/**
 * Handle follow-up response for GANGGUAN_MATI (Device ONLINE - WiFi issue)
 */
async function handleGangguanMatiOnlineResponse({ sender, body, reply }) {
    const state = getUserState(sender);
    const response = body.toLowerCase().trim();
    
    // Check for cancel command (0 atau batal)
    if (response === '0' || response === 'batal' || response === 'cancel') {
        deleteUserState(sender);
        return { 
            success: true, 
            message: `❌ Proses laporan dibatalkan. Jika masih ada masalah, silakan lapor kembali.` 
        };
    }
    
    // 2 = sudah bisa terkoneksi
    if (response === '2' || response.includes('sudah bisa') || response.includes('sudahbisa') || response.includes('terkoneksi')) {
        deleteUserState(sender);
        return { 
            success: true, 
            message: `🎉 Bagus! Berarti masalahnya memang di WiFi saja ya.\n\nTips: Lupa dan konek ulang WiFi biasanya membantu jika terjadi lagi.\n\nTerima kasih! 🙏` 
        };
    }
    
    // 1 = tetap mati
    if (response === '1' || response.includes('tetap mati') || response.includes('tetapmati') || response.includes('masih mati')) {
        // CREATE MEDIUM PRIORITY TICKET (modem online, WiFi issue)
        const ticketId = generateTicketId();
        const newReport = {
            ticketId: ticketId,
            pelangganUserId: state.targetUser.id, // IMPORTANT: User ID untuk filter
            pelangganId: sender,
            pelangganName: state.targetUser.name,
            pelangganPhone: state.targetUser.phone_number,
            pelangganAddress: state.targetUser.address,
            laporanText: `Tidak bisa konek WiFi - Device ONLINE\nModem terdeteksi aktif tapi WiFi tidak bisa diakses.\nTroubleshooting sudah dilakukan.`,
            status: 'baru',
            priority: 'MEDIUM',
            createdAt: new Date().toISOString(),
            deviceOnline: true,
            issueType: 'WIFI_ISSUE',
            troubleshootingDone: true
        };

        if (!global.reports) global.reports = [];
        global.reports.push(newReport);
        
        // Save reports to file
        try {
            const reportsPath = path.join(__dirname, '../../database/reports.json');
            fs.writeFileSync(reportsPath, JSON.stringify(global.reports, null, 2));
        } catch (error) {
            console.error('[SAVE_REPORT_ERROR]', error);
        }

        // Notify teknisi dan admin - MEDIUM priority
        const notifMessage = `📶 *TIKET GANGGUAN WiFi*

ID: *${ticketId}*
Prioritas: *⚠️ MEDIUM*

Pelanggan: ${state.targetUser.name}
Telepon: ${state.targetUser.phone_number.split('|')[0]}
Alamat: ${state.targetUser.address}
Paket: ${state.targetUser.subscription || 'N/A'}

*Masalah:* WiFi tidak bisa connect (Modem ONLINE)
*Device Status:* ONLINE ✅
*Issue:* Kemungkinan masalah WiFi/setting

*Kemungkinan solusi:*
• Setting ulang WiFi/channel
• Reset password WiFi
• Cek SSID broadcast

Untuk proses tiket, ketik:
*proses ${ticketId}*`;

        // Send to all teknisi
        const teknisiAccounts = global.accounts.filter(acc => 
            acc.role === 'teknisi' && acc.phone_number && acc.phone_number.trim() !== ""
        );

        for (const teknisi of teknisiAccounts) {
            try {
                let teknisiJid = teknisi.phone_number.trim();
                if (!teknisiJid.endsWith('@s.whatsapp.net')) {
                    if (teknisiJid.startsWith('0')) {
                        teknisiJid = `62${teknisiJid.substring(1)}@s.whatsapp.net`;
                    } else if (teknisiJid.startsWith('62')) {
                        teknisiJid = `${teknisiJid}@s.whatsapp.net`;
                    } else {
                        teknisiJid = `62${teknisiJid}@s.whatsapp.net`;
                    }
                }
                await global.raf.sendMessage(teknisiJid, { text: notifMessage });
            } catch (err) {
                console.error(`Failed to notify teknisi ${teknisi.username}:`, err.message);
            }
        }

        deleteUserState(sender);
        
        const responseTime = getResponseTimeMessage('MEDIUM');
        
        return {
            success: true,
            message: `✅ *TIKET DIBUAT*

Nomor Tiket: *${ticketId}*
Prioritas: *⚠️ MEDIUM*

Teknisi akan menghubungi untuk pengecekan lebih lanjut dalam ${responseTime}.

Kemungkinan perlu setting ulang WiFi atau ganti channel.

Terima kasih! 🙏`
        };
    }
    
    // Default - remind user with numbers
    return { 
        success: true, 
        message: `Mohon balas dengan angka:\n*1* - Tetap mati, buat tiket\n*2* - Sudah bisa terkoneksi\n*0* - Batal` 
    };
}

/**
 * Handle follow-up response for GANGGUAN_LEMOT
 */
async function handleGangguanLemotResponse({ sender, body, reply }) {
    const state = getUserState(sender);
    const response = body.toLowerCase().trim();
    
    // Check for cancel command (0 atau batal)
    if (response === '0' || response === 'batal' || response === 'cancel') {
        deleteUserState(sender);
        return { 
            success: true, 
            message: `❌ Proses laporan dibatalkan. Jika masih ada masalah, silakan lapor kembali.` 
        };
    }
    
    // 2 = sudah cepat kembali
    if (response === '2' || response.includes('sudah cepat') || response.includes('sudahcepat')) {
        deleteUserState(sender);
        return { 
            success: true, 
            message: `🎉 Alhamdulillah, senang mendengarnya!\n\nJika ada masalah lagi, jangan ragu untuk chat ya. Terima kasih! 🙏` 
        };
    }
    
    // Parse speed test result
    if (response.includes('speedtest') || response.match(/\d+(\.\d+)?\s*(mbps|mb)/i)) {
        const speedMatch = response.match(/(\d+(\.\d+)?)\s*(mbps|mb)?/i);
        if (speedMatch) {
            const speed = parseFloat(speedMatch[1]);
            const userPackage = state.targetUser.subscription || '';
            
            // Extract speed from package name (e.g., "Paket-10Mbps" -> 10)
            const packageSpeedMatch = userPackage.match(/(\d+)\s*mbps/i);
            const packageSpeed = packageSpeedMatch ? parseInt(packageSpeedMatch[1]) : null;
            
            if (packageSpeed && speed < packageSpeed * 0.5) {
                // Speed < 50% dari paket - perlu pengecekan
                setUserState(sender, {
                    ...state,
                    step: 'GANGGUAN_LEMOT_CONFIRM_TICKET',
                    speedTest: speed,
                    packageSpeed: packageSpeed
                });
                
                return { 
                    success: true, 
                    message: `📊 *Hasil Speed Test*

Hasil Anda: *${speed} Mbps*
Paket Anda: *${packageSpeed} Mbps*

⚠️ Speed Anda hanya *${Math.round(speed/packageSpeed*100)}%* dari paket yang seharusnya.

Ini perlu pengecekan oleh teknisi.

*Pilih salah satu:*
1️⃣ Buat tiket teknisi
2️⃣ Coba lagi nanti
0️⃣ Batal

Balas dengan *angka* (1/2/0)` 
                };
            } else if (packageSpeed) {
                return { 
                    success: true, 
                    message: `📊 *Hasil Speed Test*

Hasil: *${speed} Mbps*
Paket: *${packageSpeed} Mbps*

Speed Anda *${Math.round(speed/packageSpeed*100)}%* dari paket, masih dalam range normal.

Jika masih terasa lemot, kemungkinan:
• Situs/server tujuan yang lemot
• Terlalu banyak device konek bersamaan
• Jam sibuk (peak hours)
• Aplikasi background makan bandwidth

Coba lagi nanti atau test dengan server lain.

*Pilih salah satu:*
1️⃣ Tetap lemot, buat tiket
2️⃣ Sudah cepat kembali
0️⃣ Batal

Balas dengan *angka* (1/2/0)` 
                };
            } else {
                return { 
                    success: true, 
                    message: `Speed test: *${speed} Mbps*\n\n*Pilih salah satu:*
1️⃣ Tetap lemot, buat tiket
2️⃣ Sudah cepat kembali
0️⃣ Batal

Balas dengan *angka* (1/2/0)` 
                };
            }
        }
    }
    
    // 1 = tetap lemot, buat tiket
    if (response === '1' || response.includes('tetap lemot') || response.includes('tetaplemot') || response.includes('masih lemot')) {
        // CREATE MEDIUM PRIORITY TICKET
        const ticketId = generateTicketId();
        const speedInfo = state.speedTest ? `Speed test: ${state.speedTest} Mbps` : 'Belum speed test';
        
        const newReport = {
            ticketId: ticketId,
            pelangganUserId: state.targetUser.id, // IMPORTANT: User ID untuk filter
            pelangganId: sender,
            pelangganName: state.targetUser.name || state.targetUser.full_name || 'Customer',
            pelangganPhone: state.targetUser.phone_number,
            pelangganAddress: state.targetUser.address || '',
            pelangganSubscription: state.targetUser.subscription || 'Tidak terinfo', // ADD SUBSCRIPTION
            laporanText: `Internet lemot/lambat - Device ONLINE\n${speedInfo}\nTroubleshooting sudah dilakukan.`,
            status: 'pending',  // Use new status format
            priority: 'MEDIUM',
            createdAt: new Date().toISOString(),
            deviceOnline: true,
            deviceStatus: state.deviceStatus || {},  // Include full device status
            issueType: 'LEMOT',
            troubleshootingDone: true
        };

        if (!global.reports) global.reports = [];
        global.reports.push(newReport);
        
        // Save reports to file
        try {
            const reportsPath = path.join(__dirname, '../../database/reports.json');
            fs.writeFileSync(reportsPath, JSON.stringify(global.reports, null, 2));
        } catch (error) {
            console.error('[SAVE_REPORT_ERROR]', error);
        }

        // Notify teknisi untuk tiket LEMOT
        const notifMessage = `🐌 *TIKET INTERNET LEMOT*

ID: *${ticketId}*
Prioritas: *⚠️ MEDIUM*

Pelanggan: ${state.targetUser.name}
Telepon: ${state.targetUser.phone_number.split('|')[0]}
Alamat: ${state.targetUser.address}
Paket: ${state.targetUser.subscription || 'N/A'}

*Masalah:* Internet lambat/lemot
*Device Status:* ONLINE ✅
*Speed Test:* ${speedInfo}

*Kemungkinan penyebab:*
• Bandwidth penuh/overload
• Interference WiFi
• Kualitas sinyal menurun
• Peak hour traffic

Untuk proses tiket, ketik:
*proses ${ticketId}*`;

        // Send to teknisi with delay to prevent spam
        const teknisiAccounts = global.accounts.filter(acc => 
            acc.role === 'teknisi' && acc.phone_number && acc.phone_number.trim() !== ""
        );

        for (let i = 0; i < teknisiAccounts.length; i++) {
            const teknisi = teknisiAccounts[i];
            
            // Add delay between notifications (2 seconds between each)
            if (i > 0) {
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
            
            try {
                let teknisiJid = teknisi.phone_number.trim();
                if (!teknisiJid.endsWith('@s.whatsapp.net')) {
                    if (teknisiJid.startsWith('0')) {
                        teknisiJid = `62${teknisiJid.substring(1)}@s.whatsapp.net`;
                    } else if (teknisiJid.startsWith('62')) {
                        teknisiJid = `${teknisiJid}@s.whatsapp.net`;
                    } else {
                        teknisiJid = `62${teknisiJid}@s.whatsapp.net`;
                    }
                }
                await global.raf.sendMessage(teknisiJid, { text: notifMessage });
            } catch (err) {
                console.error(`Failed to notify teknisi ${teknisi.username}:`, err.message);
            }
        }

        deleteUserState(sender);
        
        const responseTime = getResponseTimeMessage('MEDIUM');
        
        return {
            success: true,
            message: `✅ *TIKET DIBUAT*

Nomor Tiket: *${ticketId}*
Prioritas: *⚠️ MEDIUM*

Teknisi akan menghubungi untuk pengecekan lebih lanjut dalam ${responseTime}.

Terima kasih! 🙏`
        };
    }
    
    // Handle "buat tiket" response after speed test (also accept "1")
    if (response === '1' || response.includes('buat tiket') || response.includes('buattiket')) {
        // User confirm create ticket after speed test
        const ticketId = generateTicketId();
        const speedInfo = state.speedTest ? `Speed test: ${state.speedTest} Mbps (seharusnya ${state.packageSpeed} Mbps)` : '';
        
        const newReport = {
            ticketId: ticketId,
            pelangganUserId: state.targetUser.id, // IMPORTANT: User ID untuk filter
            pelangganId: sender,
            pelangganName: state.targetUser.name || state.targetUser.full_name || 'Customer',
            pelangganPhone: state.targetUser.phone_number,
            pelangganAddress: state.targetUser.address || '',
            pelangganSubscription: state.targetUser.subscription || 'Tidak terinfo', // ADD SUBSCRIPTION
            laporanText: `Internet lemot - Speed di bawah 50% paket\n${speedInfo}`,
            status: 'pending',  // Use new status format
            priority: 'MEDIUM',
            createdAt: new Date().toISOString(),
            deviceOnline: true,
            deviceStatus: state.deviceStatus || {},  // Include full device status
            issueType: 'LEMOT',
            troubleshootingDone: true
        };

        if (!global.reports) global.reports = [];
        global.reports.push(newReport);
        
        // Save reports to file
        try {
            const reportsPath = path.join(__dirname, '../../database/reports.json');
            fs.writeFileSync(reportsPath, JSON.stringify(global.reports, null, 2));
        } catch (error) {
            console.error('[SAVE_REPORT_ERROR]', error);
        }

        deleteUserState(sender);
        
        const responseTime = getResponseTimeMessage('MEDIUM');
        
        return {
            success: true,
            message: `✅ *TIKET DIBUAT*

Nomor Tiket: *${ticketId}*

Teknisi akan menghubungi untuk pengecekan dalam ${responseTime}.

Terima kasih! 🙏`
        };
    }
    
    // Handle "nanti dulu" or "2" (coba lagi nanti)
    if (response === '2' || response.includes('nanti') || response.includes('coba lagi')) {
        deleteUserState(sender);
        return { 
            success: true, 
            message: `Baik, silakan coba lagi nanti ya Kak.\n\nJika masih lemot, jangan ragu untuk lapor kembali. Semoga segera membaik! 🙏` 
        };
    }
    
    // Default - remind user with numbers
    return { 
        success: true, 
        message: `Mohon balas dengan angka:\n*1* - Tetap lemot, buat tiket\n*2* - Sudah cepat kembali\n*0* - Batal\n\nAtau kirim hasil speedtest:\n*speedtest [mbps]* - Contoh: speedtest 20` 
    };
}

module.exports = {
    handleGangguanMati,
    handleGangguanLemot,
    handleGangguanMatiOfflineResponse,
    handleGangguanMatiOnlineResponse,
    handleGangguanLemotResponse
};
