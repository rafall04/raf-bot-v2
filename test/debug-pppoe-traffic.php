<?php
/**
 * Debug PPPoE traffic fields
 * To understand exact field structure
 */

require '../views/conn.php';

if (!$API->connected) {
    die("Failed to connect to MikroTik\n");
}

echo "=== PPPoE Active Sessions with ALL Fields ===\n\n";
$ppp = $API->comm('/ppp/active/print');

if ($ppp && count($ppp) > 0) {
    echo "Found " . count($ppp) . " active PPPoE sessions\n\n";
    
    foreach ($ppp as $index => $session) {
        echo "Session " . ($index + 1) . ":\n";
        echo "----------------------------------------\n";
        foreach ($session as $key => $value) {
            echo "  $key: $value\n";
        }
        echo "\n";
        
        // Only show first 3 for brevity
        if ($index >= 2) break;
    }
    
    // Check specific traffic fields
    echo "\n=== Traffic Field Analysis ===\n";
    $session = $ppp[0];
    
    echo "Checking 'bytes' field: " . (isset($session['bytes']) ? $session['bytes'] : "NOT FOUND") . "\n";
    echo "Checking 'bytes-in' field: " . (isset($session['bytes-in']) ? $session['bytes-in'] : "NOT FOUND") . "\n";
    echo "Checking 'bytes-out' field: " . (isset($session['bytes-out']) ? $session['bytes-out'] : "NOT FOUND") . "\n";
    echo "Checking 'rx-byte' field: " . (isset($session['rx-byte']) ? $session['rx-byte'] : "NOT FOUND") . "\n";
    echo "Checking 'tx-byte' field: " . (isset($session['tx-byte']) ? $session['tx-byte'] : "NOT FOUND") . "\n";
    
} else {
    echo "No active PPPoE sessions found\n";
}

$API->disconnect();
?>
