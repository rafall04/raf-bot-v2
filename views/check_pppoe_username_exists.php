<?php
header("Content-Type: application/json");

function sendJsonResponse($status, $exists = false, $message = '') {
    echo json_encode([
        'status' => $status,
        'exists' => $exists,
        'message' => $message
    ]);
    exit();
}

try {
    require('conn.php');

    if (!isset($API) || !$API->connected) {
        if (isset($API) && method_exists($API, 'connect') && isset($host) && isset($username) && isset($password)) {
            if (!$API->connect($host, $username, $password)) {
                sendJsonResponse('error', false, 'Gagal terkoneksi ke Mikrotik');
            }
        } else {
            sendJsonResponse('error', false, 'Objek API Mikrotik tidak terinisialisasi');
        }
    }

} catch (Exception $e) {
    sendJsonResponse('error', false, 'Kesalahan Koneksi Mikrotik: ' . $e->getMessage());
}

// Check if username is passed via command line arguments (for executePHPCommand)
$username = null;
if (isset($argv) && count($argv) >= 2) {
    $username = $argv[1];
} else if (isset($_GET['username'])) {
    // Fallback to GET parameters (for web requests)
    $username = $_GET['username'];
}

if (empty($username)) {
    sendJsonResponse('error', false, 'Username tidak boleh kosong');
}

try {
    // Check if PPPoE username already exists
    $existingSecrets = $API->comm('/ppp/secret/print', [
        "?name" => $username,
    ]);

    // Check for API errors
    if (isset($existingSecrets['!trap'])) {
        sendJsonResponse('error', false, 'Error saat mengecek username: ' . ($existingSecrets['!trap'][0]['message'] ?? 'Unknown error'));
    }

    // If array is not empty, username exists
    $exists = !empty($existingSecrets);
    
    $API->disconnect();
    
    if ($exists) {
        sendJsonResponse('success', true, 'Username sudah ada di MikroTik');
    } else {
        sendJsonResponse('success', false, 'Username tersedia');
    }

} catch (Exception $e) {
    sendJsonResponse('error', false, 'Kesalahan Operasi Mikrotik: ' . $e->getMessage());
}

?>

