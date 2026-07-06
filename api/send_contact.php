<?php
require_once 'config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(['success' => false, 'message' => 'Invalid request'], 405);
}

$input = json_decode(file_get_contents('php://input'), true);
if (!$input) {
    $input = $_POST;
}

$firstName = trim($input['firstName'] ?? '');
$lastName = trim($input['lastName'] ?? '');
$email = trim($input['email'] ?? '');
$subject = trim($input['subject'] ?? 'General Inquiry');
$message = trim($input['message'] ?? '');

if ($firstName === '' || $lastName === '' || $email === '' || $message === '') {
    jsonResponse(['success' => false, 'message' => 'Please fill all required fields']);
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    jsonResponse(['success' => false, 'message' => 'Invalid email address']);
}

$subjectLabels = [
    'general' => 'General Inquiry',
    'order' => 'Order Status',
    'returns' => 'Returns & Exchanges',
    'sizing' => 'Sizing / Measurements',
    'wholesale' => 'Wholesale',
    'fabric' => 'Fabric Inquiry'
];
$subjectText = $subjectLabels[$subject] ?? $subject;
$fullName = $firstName . ' ' . $lastName;

try {
    $conn = getConnection();
    $stmt = $conn->prepare("
        INSERT INTO contact_messages (first_name, last_name, email, subject, message)
        VALUES (?, ?, ?, ?, ?)
    ");
    $stmt->execute([$firstName, $lastName, $email, $subjectText, $message]);
} catch (PDOException $e) {
    // Continue to send email even if DB fails
}

$emailBody = "CONTACT QUERY — MISRI CLOTH\n";
$emailBody .= "===========================\n";
$emailBody .= "From: $fullName\n";
$emailBody .= "Email: $email\n";
$emailBody .= "Subject: $subjectText\n";
$emailBody .= "Date: " . date('Y-m-d H:i:s') . "\n\n";
$emailBody .= "Message:\n$message\n";

sendOwnerEmail("Contact: $subjectText — $fullName", $emailBody);

jsonResponse([
    'success' => true,
    'message' => 'Message sent! We will reply to your email soon.'
]);
