<?php
require('conn.php');

if (isset($argv[1])) {
    $username = $argv[1];

    $findUserResponse = $API->comm("/ppp/secret/print", [
        "?name" => $username,
    ]);

    if (isset($findUserResponse['!trap'])) {
        $errorMessage = "Mikrotik API Error while finding user: " . ($findUserResponse['!trap'][0]['message'] ?? 'Unknown error');
        fwrite(STDERR, $errorMessage . "\n");
        exit(1);
    }

    if (empty($findUserResponse)) {
        fwrite(STDERR, "Mikrotik API Error: User '{$username}' not found.\n");
        exit(1);
    }

    $profile = $findUserResponse[0]['profile'] ?? null;

    if ($profile === null) {
        fwrite(STDERR, "Mikrotik API Error: Profile for user '{$username}' could not be determined.\n");
        exit(1);
    }

    echo json_encode(['profile' => $profile]);

} else {
    fwrite(STDERR, "Invalid arguments: Username is required for get_pppoe_user_profile.php\n");
    exit(1);
}

$API->disconnect();
?>
