<?php
header("Content-Type: application/json");

function sendJsonResponse($status, $message, $data = null) {
    echo json_encode([
        'status' => $status,
        'message' => $message,
        'data' => $data
    ]);
    exit();
}

try {
    require('conn.php');

    if (!isset($API) || !$API->connected) {
        if (isset($API) && method_exists($API, 'connect') && isset($host) && isset($username) && isset($password)) {
             if (!$API->connect($host, $username, $password)) {
                throw new Exception("Gagal terkoneksi ke Mikrotik: Pastikan IP, username, dan password di conn.php benar dan Mikrotik dapat dijangkau.");
            }
        } else {
             throw new Exception("Objek API Mikrotik tidak terinisialisasi atau tidak terhubung.");
        }
    }

} catch (Exception $e) {
    sendJsonResponse('error', 'Kesalahan Koneksi Mikrotik: ' . $e->getMessage());
}

// Check if parameters are passed via command line arguments (for executePHPCommand)
if (isset($argv) && count($argv) >= 4) {
    $user = $argv[1];
    $pw = $argv[2];
    $profil = $argv[3];
} else {
    // Fallback to GET parameters (for web requests)
    if (empty($_GET['user']) || empty($_GET['pw']) || empty($_GET['profil'])) {
        sendJsonResponse('error', 'Parameter user, pw, atau profil tidak lengkap.');
    }
    $user = $_GET['user'];
    $pw = $_GET['pw'];
    $profil = $_GET['profil'];
}

define('SERVICE', 'any');
define('COMMENT', 'By-Bot');

try {
    $existingSecrets = $API->comm('/ppp/secret/print', [
        "?name" => $user,
    ]);

    if (!empty($existingSecrets)) {
        sendJsonResponse('error', 'Gagal: Akun PPPoE dengan nama yang sama sudah ada.');
    }

    $API->write('/ppp/secret/add', false);
    $API->write('=name=' . $user, false);
    $API->write('=password=' . $pw, false);
    $API->write('=service=' . SERVICE, false);
    $API->write('=comment=' . COMMENT, false);
    $API->write('=profile=' . $profil);

    $response = $API->read(false);
    $API->disconnect();

    if (!empty($response)) {
        foreach ($response as $item) {
            if (isset($item['!trap'])) {
                $message = $item['message'] ?? 'Terjadi kesalahan Mikrotik yang tidak diketahui.';
                sendJsonResponse('error', 'Gagal menambahkan PPPoE: ' . $message);
            }
        }
    }

    sendJsonResponse('success', 'Akun PPPoE berhasil ditambahkan.');

} catch (Exception $e) {
    sendJsonResponse('error', 'Kesalahan Operasi Mikrotik: ' . $e->getMessage());
}

?>