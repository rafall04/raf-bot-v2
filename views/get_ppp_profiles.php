<?php
require 'conn.php';

// Mendapatkan daftar semua profil PPPoE yang tersedia di MikroTik
$profiles = $API->comm("/ppp/profile/print");

// Memeriksa apakah ada profil yang ditemukan
if (!empty($profiles)) {
    foreach ($profiles as $profile) {
        echo $profile['name'] . "\n";
    }
} else {
    echo "No PPPoE profiles found.\n";
}

$API->disconnect();
?>
