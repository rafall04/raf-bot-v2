<?php
require 'conn.php'; // Your MikroTik API connection file

// Function to send a JSON error response and exit
function send_json_error($message, $details = []) {
    header('Content-Type: application/json');
    http_response_code(500);
    $response = [
        'error' => true,
        'message' => $message,
        'total' => 'N/A',
        'active' => 'N/A'
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
    send_json_error('Failed to connect to Mikrotik router.');
}

$response = ['total' => 0, 'active' => 0];

// Get all configured Hotspot users
$hotspotUsers = $API->comm("/ip/hotspot/user/print");

// Check for API command errors
if (!is_array($hotspotUsers) || isset($hotspotUsers['!trap']) || isset($hotspotUsers['!fatal'])) {
    send_json_error('Error fetching Hotspot users from Mikrotik.', $hotspotUsers);
}
$response['total'] = is_array($hotspotUsers) ? count($hotspotUsers) : 0;


// Get active Hotspot sessions
$activeHotspotSessions = $API->comm("/ip/hotspot/active/print");

// Check for API command errors
if (!is_array($activeHotspotSessions) || isset($activeHotspotSessions['!trap']) || isset($activeHotspotSessions['!fatal'])) {
    send_json_error('Error fetching active Hotspot sessions from Mikrotik.', $activeHotspotSessions);
}
$response['active'] = is_array($activeHotspotSessions) ? count($activeHotspotSessions) : 0;


header('Content-Type: application/json');
echo json_encode($response);

$API->disconnect();
?>