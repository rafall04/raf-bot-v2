<?php
require('conn.php');

if (isset($argv[1]) && isset($argv[2])) {
    $username = $argv[1];
    $newProfile = $argv[2];

    // Step 1: Find the user by name to get their internal .id
    $findUserResponse = $API->comm("/ppp/secret/print", [
        "?name" => $username,
    ]);

    if (empty($findUserResponse)) {
        fwrite(STDERR, "Mikrotik API Error: User '{$username}' not found.\n");
        exit(1);
    }

    if (isset($findUserResponse['!trap'])) {
        $errorMessage = "Mikrotik API Error while finding user: " . (isset($findUserResponse['!trap'][0]['message']) ? $findUserResponse['!trap'][0]['message'] : 'Unknown error');
        fwrite(STDERR, $errorMessage . "\n");
        exit(1);
    }

    // Extract the internal .id
    $internal_id = $findUserResponse[0]['.id'];

    // Step 2: Use the internal .id to set the new profile
    $response = $API->comm("/ppp/secret/set", [
        ".id" => $internal_id,
        "profile" => $newProfile
    ]);

    // Check for errors from the set command
    if (isset($response['!trap'])) {
        $errorMessage = "Mikrotik API Error on set command: " . (isset($response['!trap'][0]['message']) ? $response['!trap'][0]['message'] : 'Unknown error');
        fwrite(STDERR, $errorMessage . "\n");
        exit(1);
    }

    echo "Successfully updated profile for {$username} to {$newProfile}\n";

} else {
    fwrite(STDERR, "Invalid arguments supplied to update_pppoe_profile.php\n");
    exit(1);
}

$API->disconnect();
?>
