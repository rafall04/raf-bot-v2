<?php
/**
 * Get all PPPoE secrets from MikroTik
 * Returns: JSON array of PPPoE users with name, password, profile, comment, disabled status
 */
header("Content-Type: application/json");

function sendJsonResponse($status, $data = [], $message = '') {
    echo json_encode([
        'status' => $status,
        'data' => $data,
        'message' => $message,
        'count' => is_array($data) ? count($data) : 0
    ]);
    exit();
}

try {
    require('conn.php');

    if (!isset($API) || !$API->connected) {
        if (isset($API) && method_exists($API, 'connect') && isset($ip) && isset($name) && isset($password)) {
            if (!$API->connect($ip, $name, $password)) {
                sendJsonResponse('error', [], 'Gagal terkoneksi ke MikroTik');
            }
        } else {
            sendJsonResponse('error', [], 'Objek API MikroTik tidak terinisialisasi');
        }
    }

} catch (Exception $e) {
    sendJsonResponse('error', [], 'Kesalahan Koneksi MikroTik: ' . $e->getMessage());
}

try {
    // Get all PPPoE secrets
    $secrets = $API->comm('/ppp/secret/print');

    // Check for API errors
    if (isset($secrets['!trap'])) {
        sendJsonResponse('error', [], 'Error saat mengambil data PPPoE: ' . ($secrets['!trap'][0]['message'] ?? 'Unknown error'));
    }

    // Format the response
    $formattedSecrets = [];
    foreach ($secrets as $secret) {
        $formattedSecrets[] = [
            'name' => $secret['name'] ?? '',
            'password' => $secret['password'] ?? '',
            'profile' => $secret['profile'] ?? '',
            'comment' => $secret['comment'] ?? '',
            'disabled' => isset($secret['disabled']) && $secret['disabled'] === 'true',
            'service' => $secret['service'] ?? 'pppoe',
            'last_logged_out' => $secret['last-logged-out'] ?? '',
            'caller_id' => $secret['caller-id'] ?? ''
        ];
    }

    $API->disconnect();
    
    sendJsonResponse('success', $formattedSecrets, 'Berhasil mengambil ' . count($formattedSecrets) . ' PPPoE secrets');

} catch (Exception $e) {
    sendJsonResponse('error', [], 'Kesalahan Operasi MikroTik: ' . $e->getMessage());
}
?>
