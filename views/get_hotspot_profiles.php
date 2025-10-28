<?php
require 'conn.php'; // Mengimpor koneksi ke API Mikrotik

// Mendapatkan daftar semua profil hotspot yang tersedia di MikroTik
$hotspotProfiles = $API->comm("/ip/hotspot/user/profile/print");

// Memeriksa apakah ada profil yang ditemukan
if (!empty($hotspotProfiles)) {
    foreach ($hotspotProfiles as $profile) {
        // Hanya mengoutput nama profil
        echo $profile['name'] . "\n";
    }
} else {
    echo "No Hotspot profiles found.\n";
}

$API->disconnect();
?>
