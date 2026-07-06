<?php
require_once '../api/config.php';

session_start();

$loggedIn = isset($_SESSION['misri_admin']) && $_SESSION['misri_admin'] === true;

if (isset($_POST['password'])) {
    if ($_POST['password'] === ADMIN_PASSWORD) {
        $_SESSION['misri_admin'] = true;
        $loggedIn = true;
    } else {
        $error = 'Wrong password';
    }
}

if (isset($_GET['logout'])) {
    session_destroy();
    header('Location: orders.php');
    exit;
}

$orders = [];
$messages = [];

if ($loggedIn) {
    try {
        $conn = getConnection();
        $orders = $conn->query("
            SELECT o.*, COUNT(oi.id) AS item_count
            FROM orders o
            LEFT JOIN order_items oi ON oi.order_id = o.id
            GROUP BY o.id
            ORDER BY o.created_at DESC
        ")->fetchAll();

        $messages = $conn->query("
            SELECT * FROM contact_messages ORDER BY created_at DESC LIMIT 50
        ")->fetchAll();
    } catch (PDOException $e) {
        $dbError = 'Database not set up. Import api/misri_cloth_db.sql in phpMyAdmin.';
    }
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Admin — MISRI CLOTH Orders</title>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Outfit', sans-serif; background: #f5f0e8; color: #1a1210; padding: 24px; }
    .container { max-width: 1100px; margin: 0 auto; }
    h1 { margin-bottom: 8px; }
    .sub { color: #7a7068; margin-bottom: 32px; }
    .login-box { max-width: 360px; margin: 80px auto; background: white; padding: 32px; border-radius: 12px; box-shadow: 0 8px 30px rgba(0,0,0,0.08); }
    input, select { width: 100%; padding: 12px; margin: 8px 0 16px; border: 1px solid #e5ddd4; border-radius: 6px; font-family: inherit; }
    button, .btn { background: #1a1210; color: white; border: none; padding: 12px 24px; border-radius: 6px; cursor: pointer; font-family: inherit; text-decoration: none; display: inline-block; }
    .error { color: #8b2942; margin-bottom: 12px; }
    table { width: 100%; border-collapse: collapse; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 16px rgba(0,0,0,0.06); margin-bottom: 40px; }
    th, td { padding: 14px 16px; text-align: left; border-bottom: 1px solid #e5ddd4; font-size: 0.9rem; }
    th { background: #1a1210; color: white; font-weight: 500; }
    .badge { padding: 4px 10px; border-radius: 50px; font-size: 0.75rem; background: #f0ebe3; }
    .badge.pending { background: #fff3cd; color: #856404; }
    .header-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; flex-wrap: wrap; gap: 12px; }
    .msg-box { background: white; padding: 20px; border-radius: 10px; margin-bottom: 12px; border: 1px solid #e5ddd4; }
    .msg-box strong { display: block; margin-bottom: 4px; }
    .msg-meta { font-size: 0.8rem; color: #7a7068; margin-bottom: 8px; }
    h2 { margin: 32px 0 16px; font-size: 1.3rem; }
  </style>
</head>
<body>
<div class="container">
<?php if (!$loggedIn): ?>
  <div class="login-box">
    <h1>MISRI CLOTH Admin</h1>
    <p class="sub">View orders & messages</p>
    <?php if (!empty($error)): ?><p class="error"><?= htmlspecialchars($error) ?></p><?php endif; ?>
    <form method="post">
      <label>Password</label>
      <input type="password" name="password" required placeholder="Admin password">
      <button type="submit">Login</button>
    </form>
  </div>
<?php else: ?>
  <div class="header-row">
    <div>
      <h1>MISRI CLOTH — Orders</h1>
      <p class="sub">All customer purchases and contact queries</p>
    </div>
    <a href="?logout=1" class="btn">Logout</a>
  </div>

  <?php if (!empty($dbError)): ?>
    <p class="error"><?= htmlspecialchars($dbError) ?></p>
  <?php else: ?>

  <h2>Orders (<?= count($orders) ?>)</h2>
  <?php if (empty($orders)): ?>
    <p>No orders yet.</p>
  <?php else: ?>
  <table>
    <thead>
      <tr>
        <th>Ref</th>
        <th>Customer</th>
        <th>Phone</th>
        <th>Items</th>
        <th>Total</th>
        <th>Status</th>
        <th>Date</th>
      </tr>
    </thead>
    <tbody>
      <?php foreach ($orders as $o): ?>
      <tr>
        <td><strong><?= htmlspecialchars($o['order_ref']) ?></strong></td>
        <td><?= htmlspecialchars($o['customer_name']) ?></td>
        <td><a href="tel:<?= htmlspecialchars($o['customer_phone']) ?>"><?= htmlspecialchars($o['customer_phone']) ?></a></td>
        <td><?= (int)$o['item_count'] ?></td>
        <td>Rs. <?= number_format($o['total_amount']) ?></td>
        <td><span class="badge <?= $o['status'] ?>"><?= ucfirst($o['status']) ?></span></td>
        <td><?= date('d M Y, h:i A', strtotime($o['created_at'])) ?></td>
      </tr>
      <?php endforeach; ?>
    </tbody>
  </table>
  <?php endif; ?>

  <h2>Contact Messages (<?= count($messages) ?>)</h2>
  <?php if (empty($messages)): ?>
    <p>No messages yet.</p>
  <?php else: ?>
    <?php foreach ($messages as $m): ?>
    <div class="msg-box">
      <strong><?= htmlspecialchars($m['first_name'] . ' ' . $m['last_name']) ?></strong>
      <div class="msg-meta"><?= htmlspecialchars($m['email']) ?> · <?= htmlspecialchars($m['subject']) ?> · <?= date('d M Y, h:i A', strtotime($m['created_at'])) ?></div>
      <p><?= nl2br(htmlspecialchars($m['message'])) ?></p>
    </div>
    <?php endforeach; ?>
  <?php endif; ?>

  <?php endif; ?>
<?php endif; ?>
</div>
</body>
</html>
