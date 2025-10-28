<?php
require('conn.php');

if (isset($argv[1])) {
    $username = $argv[1];

    // Langkah 1: Cari sesi aktif berdasarkan username untuk mendapatkan .id-nya
    $activeSessions = $API->comm("/ppp/active/print", [
        "?name" => $username,
    ]);

    if (count($activeSessions) > 0) {
        // Pengguna sedang online, dapatkan .id dari sesi pertama yang ditemukan
        $sessionId = $activeSessions[0]['.id'];
        
        // Langkah 2: Hapus sesi aktif menggunakan .id yang didapat
        $API->comm("/ppp/active/remove", [
            ".id" => $sessionId
        ]);
        
        echo "Sesi PPPoE aktif untuk pengguna '$username' (ID Sesi: $sessionId) berhasil dihapus.";
    } else {
        // Pengguna sedang tidak online, ini bukan sebuah error dalam konteks ini
        echo "Pengguna '$username' sedang tidak aktif. Tidak ada sesi yang perlu dihapus.";
    }

} else {
    // Argumen tidak valid yang diberikan ke skrip
    http_response_code(400); // Atur kode error yang sesuai
    echo "Error: Tidak ada username yang diberikan.";
}

$API->disconnect();
?>