<?php
header("Content-Type: application/json");

function sendJsonResponse($status, $message, $connected = false) {
    echo json_encode([
        'status' => $status,
        'message' => $message,
        'connected' => $connected
    ]);
    global $API;
    if (isset($API) && $API->connected) {
        $API->disconnect();
    }
    exit();
}

$API = null;
$ip = null;
$name = null;
$password = null;

try {
    require('conn.php');

    if (!isset($API) || !($API instanceof RouterosAPI)) {
        throw new Exception("Objek RouterosAPI (\$API) tidak terinisialisasi dengan benar dari conn.php.");
    }

    if ($API->connected) {
        $response = $API->comm("/system/resource/print");
        if (!empty($response) && !isset($response['!trap'])) {
            sendJsonResponse('success', 'Berhasil terkoneksi dan terautentikasi ke Mikrotik.', true);
        } else {
            $errorMessage = "Terhubung tetapi otentikasi atau perintah dasar gagal.";
            if (isset($response['!trap'])) {
                $errorMessage = $response['!trap']['message'] ?? $errorMessage;
            }
            sendJsonResponse('error', 'Gagal otentikasi atau jalankan perintah dasar: ' . $errorMessage, false);
        }
    } else {
        sendJsonResponse('error', 'Gagal terkoneksi ke Mikrotik: Pastikan IP, username, password benar di .env dan Mikrotik dapat dijangkau.', false);
    }

} catch (Exception $e) {
    sendJsonResponse('error', 'Kesalahan internal saat mengecek koneksi Mikrotik: ' . $e->getMessage(), false);
}
?>