<?php
require 'conn.php'; // File koneksi API MikroTik Anda

// Function to send a JSON error response and exit
function send_json_error($message, $details = []) {
    header('Content-Type: application/json');
    http_response_code(500);
    $response = [
        'error' => true,
        'message' => $message,
        'online' => 'N/A',
        'offline' => 'N/A',
        'total' => 'N/A'
    ];
    if (!empty($details)) {
        $response['details'] = $details;
    }
    echo json_encode($response);
    // Disconnect safely before exiting
    if (isset($GLOBALS['API']) && $GLOBALS['API']->connected) {
        $GLOBALS['API']->disconnect();
    }
    exit();
}

// Handle connection failure
if (!$API->connected) {
    // The connection error is already handled in conn.php, but this is a fallback.
    // In this case, we send a generic error as we can't get more details.
    send_json_error('Failed to connect to Mikrotik router.');
}

$response = [
    'online' => 0,
    'offline' => 0,
    'total' => 0,
    'inactive_users_list' => []
];

// Get all configured PPP secrets
$pppSecrets = $API->comm("/ppp/secret/print");

// Check for API command errors
if (!is_array($pppSecrets) || isset($pppSecrets['!trap']) || isset($pppSecrets['!fatal'])) {
    send_json_error('Error fetching PPP secrets from Mikrotik.', $pppSecrets);
}

$allSecretNames = [];
// Process only if we have a valid array of secrets
if (!empty($pppSecrets)) {
    foreach ($pppSecrets as $secret) {
        if (isset($secret['name'])) {
            $allSecretNames[] = $secret['name'];
        }
    }
}
$response['total'] = count($allSecretNames);

// Get active PPP sessions
$activeSessions = $API->comm("/ppp/active/print");

// Check for API command errors
if (!is_array($activeSessions) || isset($activeSessions['!trap']) || isset($activeSessions['!fatal'])) {
    send_json_error('Error fetching active PPP sessions from Mikrotik.', $activeSessions);
}

$activeUserNames = [];
// Process only if we have a valid array of active sessions
if (!empty($activeSessions)) {
    foreach ($activeSessions as $session) {
        if (isset($session['name'])) {
            $activeUserNames[] = $session['name'];
        }
    }
    $activeUserNames = array_unique($activeUserNames);
}
$response['online'] = count($activeUserNames);

// Calculate offline users and list them
$inactiveUsersList = array_diff($allSecretNames, $activeUserNames);
$response['offline'] = count($inactiveUsersList);
$response['inactive_users_list'] = array_values($inactiveUsersList); // Re-index for clean JSON

header('Content-Type: application/json');
echo json_encode($response);

$API->disconnect();
?>