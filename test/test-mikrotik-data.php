<?php
/**
 * Test MikroTik data structure
 * To understand exact field names
 */

require '../views/conn.php';

if (!$API->connected) {
    die("Failed to connect to MikroTik\n");
}

echo "=== PPPoE Active Sessions ===\n";
$ppp = $API->comm('/ppp/active/print');
if ($ppp && count($ppp) > 0) {
    echo "First PPPoE session fields:\n";
    print_r($ppp[0]);
} else {
    echo "No active PPPoE sessions\n";
}

echo "\n=== Hotspot Active Sessions ===\n";
$hotspot = $API->comm('/ip/hotspot/active/print');
if ($hotspot && count($hotspot) > 0) {
    echo "First Hotspot session fields:\n";
    print_r($hotspot[0]);
} else {
    echo "No active Hotspot sessions\n";
}

echo "\n=== Interface List ===\n";
$interfaces = $API->comm('/interface/print');
if ($interfaces && count($interfaces) > 0) {
    echo "Available interfaces:\n";
    foreach ($interfaces as $iface) {
        echo "- " . $iface['name'] . " (type: " . $iface['type'] . ", running: " . $iface['running'] . ")\n";
    }
}

$API->disconnect();
?>
