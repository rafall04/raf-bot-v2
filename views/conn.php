<?php

require('dotenv.class.php');

$dotenv = new DotEnv();
$dotenv->load(__DIR__ . '/../');

$ip = getenv('IP_MC');
$name = getenv('NAME_MC');
$password = getenv('PASSWORD_MC');
$ssl = getenv('SSL_MC') === 'true'; // Default to false if not set

// Forcing the use of the standard binary API for all versions as per user feedback.
require('routeros_api.class.php');

// The binary API uses port 8728, or 8729 for SSL.
$port = getenv('PORT_MC') ?: ($ssl ? 8729 : 8728);

$API = new RouterosAPI();
$API->port = $port;
$API->ssl = $ssl;
$API->timeout = 2;  // Reduce timeout to 2 seconds (from default 3)
$API->attempts = 2; // Reduce attempts to 2 (from default 5)
$API->delay = 1;    // Reduce delay between attempts to 1 second (from default 3)

if ($API->connect($ip, $name, $password)) {
    // Connection successful
} else {
    // Connection failed - handle error appropriately
    // For example, you could log the error or send a generic error response
}