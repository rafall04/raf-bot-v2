<?php
require 'conn.php';
$activeSessions = $API->comm("/ppp/active/print");

$formattedActiveUsers = [];

if (!empty($activeSessions)) {
    foreach ($activeSessions as $session) {
        if (isset($session['name']) && isset($session['address'])) {
            $formattedActiveUsers[] = [
                "name" => $session['name'],
                "address" => $session['address']
            ];
        }
    }
}

header('Content-Type: application/json');
echo json_encode($formattedActiveUsers);

$API->disconnect();
?>