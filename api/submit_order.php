<?php
require_once 'config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(['success' => false, 'message' => 'Invalid request'], 405);
}

$input = json_decode(file_get_contents('php://input'), true);
if (!$input) {
    jsonResponse(['success' => false, 'message' => 'Invalid data'], 400);
}

$name = trim($input['name'] ?? '');
$phone = trim($input['phone'] ?? '');
$email = trim($input['email'] ?? '');
$address = trim($input['address'] ?? '');
$notes = trim($input['notes'] ?? '');
$items = $input['items'] ?? [];
$total = floatval($input['total'] ?? 0);

if ($name === '' || $phone === '' || $address === '') {
    jsonResponse(['success' => false, 'message' => 'Name, phone and address are required']);
}

if (empty($items)) {
    jsonResponse(['success' => false, 'message' => 'Cart is empty']);
}

try {
    $conn = getConnection();
    $orderRef = generateOrderRef();

    $stmt = $conn->prepare("
        INSERT INTO orders (order_ref, customer_name, customer_phone, customer_email, customer_address, notes, total_amount)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ");
    $stmt->execute([$orderRef, $name, $phone, $email, $address, $notes, $total]);
    $orderId = $conn->lastInsertId();

    $itemStmt = $conn->prepare("
        INSERT INTO order_items (order_id, product_id, product_name, size_label, color, meters, unit_price, quantity, line_total)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ");

    $emailBody = "NEW ORDER — MISRI CLOTH\n";
    $emailBody .= "========================\n";
    $emailBody .= "Order Ref: $orderRef\n";
    $emailBody .= "Date: " . date('Y-m-d H:i:s') . "\n\n";
    $emailBody .= "Customer: $name\n";
    $emailBody .= "Phone: $phone\n";
    $emailBody .= "Email: " . ($email ?: 'N/A') . "\n";
    $emailBody .= "Address: $address\n";
    if ($notes) $emailBody .= "Notes: $notes\n";
    $emailBody .= "\n--- ITEMS ---\n";

    foreach ($items as $item) {
        $meters = isset($item['meters']) && $item['meters'] !== null ? floatval($item['meters']) : null;
        $itemStmt->execute([
            $orderId,
            intval($item['product_id']),
            $item['product_name'],
            $item['size'],
            $item['color'],
            $meters,
            floatval($item['unit_price']),
            intval($item['quantity']),
            floatval($item['line_total'])
        ]);

        $line = $item['product_name'];
        if ($meters) {
            $line .= " — {$meters}m @ Rs. " . number_format($item['unit_price']) . "/m";
        } else {
            $line .= " — {$item['size']}, {$item['color']} x{$item['quantity']}";
        }
        $line .= " = Rs. " . number_format($item['line_total']);
        $emailBody .= $line . "\n";
    }

    $emailBody .= "\nTOTAL: Rs. " . number_format($total) . "\n";
    $emailBody .= "\nView all orders: admin/orders.php\n";

    sendOwnerEmail("New Order $orderRef — MISRI CLOTH", $emailBody);

    jsonResponse([
        'success' => true,
        'order_ref' => $orderRef,
        'message' => 'Order placed successfully'
    ]);

} catch (PDOException $e) {
    jsonResponse([
        'success' => false,
        'message' => 'Database error. Please run api/misri_cloth_db.sql in MySQL first.'
    ], 500);
}
