<?php
define('DB_HOST', 'localhost');
define('DB_NAME', 'misri_cloth_db');
define('DB_USER', 'root');
define('DB_PASS', '');
define('OWNER_EMAIL', 'sharifimranm@gmail.com');
define('OWNER_PHONE', '03348711716');
define('ADMIN_PASSWORD', 'misri2026');

function getConnection() {
    static $conn = null;
    if ($conn === null) {
        $dsn = 'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4';
        $conn = new PDO($dsn, DB_USER, DB_PASS, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
        ]);
    }
    return $conn;
}

function jsonResponse($data, $code = 200) {
    http_response_code($code);
    header('Content-Type: application/json');
    echo json_encode($data);
    exit;
}

function generateOrderRef() {
    return 'MC' . strtoupper(substr(uniqid(), -8));
}

function sendOwnerEmail($subject, $body) {
    $headers = "From: MISRI CLOTH <noreply@misricloth.local>\r\n";
    $headers .= "Reply-To: " . OWNER_EMAIL . "\r\n";
    $headers .= "Content-Type: text/plain; charset=UTF-8\r\n";
    @mail(OWNER_EMAIL, $subject, $body, $headers);
}
