<?php
header("Content-Type: application/json");

function sendJsonResponse($status, $message, $data = null) {
    echo json_encode([
        'status' => $status,
        'message' => $message,
        'data' => $data
    ]);
    global $API;
    if (isset($API) && $API->connected) {
        $API->disconnect();
    }
    exit();
}

$API = null;
try {
    require('conn.php');

    if (!isset($API) || !$API->connected) {
        if (isset($API) && method_exists($API, 'connect') && isset($host) && isset($username) && isset($password)) {
             if (!$API->connect($host, $username, $password)) {
                throw new Exception("Gagal terkoneksi ke Mikrotik: Pastikan konfigurasi koneksi di conn.php benar dan Mikrotik dapat dijangkau.");
            }
        } else {
             throw new Exception("Objek API Mikrotik tidak terinisialisasi atau tidak terhubung (periksa conn.php).");
        }
    }

} catch (Exception $e) {
    sendJsonResponse('error', 'Kesalahan Koneksi Mikrotik: ' . $e->getMessage());
}

if (empty($_GET['profil']) || empty($_GET['komen'])) {
    sendJsonResponse('error', 'Parameter profil atau komen tidak lengkap.');
}

$profil = $_GET['profil'];
$komen = $_GET['komen'];

function generateRandomString($length = 6) {
    $characters = '23456789abcdefghjkmnpqrstuvwxyz';
    $charactersLength = strlen($characters);
    $randomString = '';
    for ($i = 0; $i < $length; $i++) {
        $randomString .= $characters[rand(0, $charactersLength - 1)];
    }
    return $randomString;
}

define('SERVER', 'all');
define('COMMENT_PREFIX', "vc-BotWa | ");

try {
    $allHotspotProfiles = $API->comm('/ip/hotspot/user/profile/print');
    $profileExists = false;
    foreach ($allHotspotProfiles as $p) {
        if (isset($p['name']) && strcasecmp(trim($p['name']), $profil) === 0) {
            $profileExists = true;
            break;
        }
    }

    if (!$profileExists) {
        sendJsonResponse('error', 'Gagal: Profil Hotspot "' . $profil . '" tidak ditemukan di Mikrotik.');
    }

    $hotspot_username = generateRandomString(6);
    $hotspot_password = $hotspot_username;

    $full_comment = COMMENT_PREFIX . $komen . ' | ' . $profil . ' | ' . date('d-m-Y H:i:s');

    $API->write('/ip/hotspot/user/add', false);
    $API->write('=name=' . $hotspot_username, false);
    $API->write('=password=' . $hotspot_password, false);
    $API->write('=server=' . SERVER, false);
    $API->write('=comment=' . $full_comment, false);
    $API->write('=profile=' . $profil);

    $response = $API->read(false);

    if (!empty($response)) {
        foreach ($response as $item) {
            if (isset($item['!trap'])) {
                $message = $item['message'] ?? 'Terjadi kesalahan Hotspot Mikrotik yang tidak diketahui.';

                if (strpos($message, 'already have user with this name for this server') !== false) {
                    sendJsonResponse('error', 'Gagal: Voucher dengan username ini (' . $hotspot_username . ') sudah terdaftar.');
                }
                else if (strpos($message, 'input does not match any value of profile') !== false) {
                    sendJsonResponse('error', 'Gagal: Profil Hotspot yang dimasukkan salah atau tidak ditemukan.');
                }
                else {
                    sendJsonResponse('error', 'Gagal menambahkan Hotspot User: ' . $message);
                }
            }
        }
    }

    sendJsonResponse('success', 'Voucher Hotspot berhasil dibuat.', [
        'username' => $hotspot_username,
        'password' => $hotspot_username,
        'profile' => $profil
    ]);

} catch (Exception $e) {
    sendJsonResponse('error', 'Kesalahan Operasi Mikrotik Hotspot: ' . $e->getMessage());
}
?>