<?php

declare(strict_types=1);

if (function_exists('ini_set')) {
    @ini_set('display_errors', '0');
    @ini_set('html_errors', '0');
}
error_reporting(E_ALL);
ob_start();

set_error_handler(static function ($severity, $message, $file, $line) {
    if (!(error_reporting() & $severity)) {
        return false;
    }

    throw new ErrorException((string) $message, 0, (int) $severity, (string) $file, (int) $line);
});

require_once __DIR__ . DIRECTORY_SEPARATOR . 'config.php';
require_once __DIR__ . DIRECTORY_SEPARATOR . 'dispatch_pdf.php';
require_once __DIR__ . DIRECTORY_SEPARATOR . 'mtc_pdf.php';

set_exception_handler(static function ($e) {
    while (ob_get_level() > 0) {
        ob_end_clean();
    }
    header('Content-Type: application/json; charset=utf-8');
    http_response_code(500);
    echo json_encode([
        'message' => 'Unhandled server error.',
        'details' => $e instanceof Throwable ? $e->getMessage() : 'Unknown error',
    ], JSON_UNESCAPED_SLASHES);
    exit;
});

try {
    $cfg = app_config();
    $pdo = app_pdo($cfg);
} catch (Throwable $e) {
    while (ob_get_level() > 0) {
        ob_end_clean();
    }
    header('Content-Type: application/json; charset=utf-8');
    http_response_code(500);
    echo json_encode([
        'message' => 'Server configuration error.',
        'details' => $e->getMessage(),
    ], JSON_UNESCAPED_SLASHES);
    exit;
}

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Access-Control-Allow-Methods: GET, POST, PATCH, PUT, DELETE, OPTIONS');

$requestOrigin = isset($_SERVER['HTTP_ORIGIN']) ? trim((string) $_SERVER['HTTP_ORIGIN']) : '';
$allowedOrigins = is_array($cfg['cors_origins'] ?? null) ? $cfg['cors_origins'] : [($cfg['cors_origin'] ?? '*')];

if (in_array('*', $allowedOrigins, true)) {
    header('Access-Control-Allow-Origin: *');
} elseif ($requestOrigin !== '' && in_array($requestOrigin, $allowedOrigins, true)) {
    header('Access-Control-Allow-Origin: ' . $requestOrigin);
    header('Vary: Origin');
} else {
    $fallbackOrigin = isset($allowedOrigins[0]) ? (string) $allowedOrigins[0] : '*';
    if ($fallbackOrigin === '*') {
        header('Access-Control-Allow-Origin: *');
    } else {
        header('Access-Control-Allow-Origin: ' . $fallbackOrigin);
        header('Vary: Origin');
    }
}

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

function json_response(array $payload, int $statusCode = 200): void
{
    while (ob_get_level() > 0) {
        ob_end_clean();
    }
    http_response_code($statusCode);
    echo json_encode($payload, JSON_UNESCAPED_SLASHES);
    exit;
}

function json_error(string $message, int $statusCode = 400): void
{
    json_response(['message' => $message], $statusCode);
}

function read_json_body(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === false || trim($raw) === '') {
        return [];
    }

    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : [];
}

function base64url_encode(string $data): string
{
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

function base64url_decode(string $data): string
{
    $remainder = strlen($data) % 4;
    if ($remainder > 0) {
        $data .= str_repeat('=', 4 - $remainder);
    }

    return (string) base64_decode(strtr($data, '-_', '+/'));
}

function jwt_sign(array $claims, string $secret): string
{
    $header = ['alg' => 'HS256', 'typ' => 'JWT'];
    $segments = [
        base64url_encode(json_encode($header, JSON_UNESCAPED_SLASHES)),
        base64url_encode(json_encode($claims, JSON_UNESCAPED_SLASHES)),
    ];

    $signature = hash_hmac('sha256', implode('.', $segments), $secret, true);
    $segments[] = base64url_encode($signature);

    return implode('.', $segments);
}

function jwt_verify(string $token, string $secret): ?array
{
    $parts = explode('.', $token);
    if (count($parts) !== 3) {
        return null;
    }

    [$h, $p, $s] = $parts;
    $expected = base64url_encode(hash_hmac('sha256', $h . '.' . $p, $secret, true));
    if (!hash_equals($expected, $s)) {
        return null;
    }

    $payload = json_decode(base64url_decode($p), true);
    if (!is_array($payload)) {
        return null;
    }

    if (isset($payload['exp']) && time() >= (int) $payload['exp']) {
        return null;
    }

    return $payload;
}

function auth_user_or_null(string $jwtSecret): ?array
{
    $authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if (strpos($authHeader, 'Bearer ') !== 0) {
        return null;
    }

    $token = substr($authHeader, 7);
    $payload = jwt_verify($token, $jwtSecret);
    if ($payload === null) {
        return null;
    }

    return [
        'id' => (string) ($payload['sub'] ?? ''),
        'username' => (string) ($payload['username'] ?? ''),
        'role' => (string) ($payload['role'] ?? ''),
    ];
}

function require_auth(string $jwtSecret): array
{
    $user = auth_user_or_null($jwtSecret);
    if ($user === null || $user['id'] === '') {
        json_error('Authentication required.', 401);
    }

    return $user;
}

function require_roles(array $user, array $allowedRoles): void
{
    $role = strtolower((string) ($user['role'] ?? ''));
    $allowed = array_map(static function ($item) {
        return strtolower((string) $item);
    }, $allowedRoles);

    if (!in_array($role, $allowed, true)) {
        json_error('Forbidden.', 403);
    }
}

function format_date_dd_mm_yyyy(string $isoDate): string
{
    if (!$isoDate || !preg_match('/^(\d{4})-(\d{2})-(\d{2})/', $isoDate, $m)) {
        return '';
    }
    return $m[3] . '-' . $m[2] . '-' . $m[1]; // dd-mm-yyyy
}

function get_today_iso(): string
{
    return gmdate('Y-m-d');
}

function subtract_days_iso(string $isoDate, int $days): string
{
    if (!preg_match('/^(\d{4})-(\d{2})-(\d{2})/', $isoDate, $m)) {
        return '';
    }
    $time = mktime(12, 0, 0, (int) $m[2], (int) $m[3], (int) $m[1]);
    $time -= ($days * 24 * 60 * 60);
    return gmdate('Y-m-d', $time);
}

function ensure_schema(PDO $pdo): void
{
    $pdo->exec("CREATE TABLE IF NOT EXISTS app_users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(120) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    $pdo->exec("CREATE TABLE IF NOT EXISTS app_orders (
        id VARCHAR(64) PRIMARY KEY,
        data LONGTEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    $pdo->exec("CREATE TABLE IF NOT EXISTS app_state (
        id VARCHAR(40) PRIMARY KEY,
        data LONGTEXT NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    $count = (int) $pdo->query('SELECT COUNT(*) AS c FROM app_users')->fetch()['c'];
    if ($count === 0) {
        $seed = [
            ['sales1', 'sales123', 'sales'],
            ['loading1', 'load1234', 'loading'],
            ['accounts1', 'acc12345', 'accounts'],
            ['manager1', 'manage123', 'management'],
            ['prod1', 'prod1234', 'production'],
        ];

        $stmt = $pdo->prepare('INSERT INTO app_users (username, password_hash, role) VALUES (?, ?, ?)');
        foreach ($seed as $row) {
            $stmt->execute([$row[0], password_hash($row[1], PASSWORD_BCRYPT), $row[2]]);
        }
    }

    $exists = $pdo->prepare('SELECT id FROM app_state WHERE id = ?');
    $exists->execute(['main']);
    if ($exists->fetch() === false) {
        $payload = json_encode([
            'orders' => [],
            'dieselEntries' => [],
            'logs' => [],
            'rawStock' => new stdClass(),
            'finishedStock' => new stdClass(),
        ], JSON_UNESCAPED_SLASHES);

        $insert = $pdo->prepare('INSERT INTO app_state (id, data) VALUES (?, ?)');
        $insert->execute(['main', $payload]);
    }
}

function request_path(): string
{
    $uri = $_SERVER['REQUEST_URI'] ?? '/';
    $path = parse_url($uri, PHP_URL_PATH) ?: '/';

    $script = $_SERVER['SCRIPT_NAME'] ?? '/api/index.php';
    $baseDir = rtrim(str_replace('\\', '/', dirname($script)), '/');

    if ($baseDir !== '' && $baseDir !== '/' && strpos($path, $baseDir) === 0) {
        $path = substr($path, strlen($baseDir));
    }

    if ($path === '' || $path === false) {
        $path = '/';
    }

    return $path;
}

function server_base_url(): string
{
    $https = $_SERVER['HTTPS'] ?? '';
    $scheme = (!empty($https) && $https !== 'off') ? 'https' : 'http';
    $host = $_SERVER['HTTP_HOST'] ?? 'localhost';

    $script = $_SERVER['SCRIPT_NAME'] ?? '/api/index.php';
    $baseDir = rtrim(str_replace('\\', '/', dirname($script)), '/');

    return $scheme . '://' . $host . $baseDir;
}

function order_with_urls(array $order): array
{
    $base = server_base_url();
    $id = (string) ($order['id'] ?? '');

    // Backward compatibility: old rows may not have status set.
    if (empty($order['status'])) {
        $order['status'] = 'Awaiting Truck';
    }

    if (!array_key_exists('invoice', $order)) {
        $order['invoice'] = null;
    }

    if (!array_key_exists('invoiceId', $order)) {
        $order['invoiceId'] = (string) ($order['invoiceNumber'] ?? '');
    }

    if (!array_key_exists('dispatchSlip', $order)) {
        $order['dispatchSlip'] = null;
    }

    if (!array_key_exists('mtc', $order)) {
        $order['mtc'] = null;
    }

    if (!empty($order['invoice']) && $id !== '') {
        $order['invoiceUrl'] = $base . '/uploads/invoices/' . rawurlencode($id) . '/' . rawurlencode((string) $order['invoice']);
    }

    if (!empty($order['dispatchSlip']) && $id !== '') {
        $order['dispatchSlipUrl'] = $base . '/uploads/dispatch-slips/' . rawurlencode($id) . '/' . rawurlencode((string) $order['dispatchSlip']);
    }

    if (!empty($order['mtc']) && $id !== '') {
        $order['mtcUrl'] = $base . '/uploads/mtc/' . rawurlencode($id) . '/' . rawurlencode((string) $order['mtc']);
    }

    return $order;
}

function normalize_rate($value): ?float
{
    if ($value === null || $value === '') {
        return null;
    }

    if (!is_numeric($value)) {
        return null;
    }

    return (float) $value;
}

function build_client_profiles(array $orders, string $query = ''): array
{
    $needle = strtolower(trim($query));
    $byClient = [];

    usort($orders, static function ($a, $b) {
        $aKey = (string) ($a['updatedAt'] ?? $a['createdAt'] ?? $a['orderDate'] ?? '');
        $bKey = (string) ($b['updatedAt'] ?? $b['createdAt'] ?? $b['orderDate'] ?? '');
        return strcmp($bKey, $aKey);
    });

    foreach ($orders as $order) {
        $clientName = trim((string) ($order['client'] ?? ''));
        if ($clientName === '') {
            continue;
        }

        if ($needle !== '' && strpos(strtolower($clientName), $needle) === false) {
            continue;
        }

        $clientKey = strtolower($clientName);
        if (!isset($byClient[$clientKey])) {
            $byClient[$clientKey] = [
                'clientName' => $clientName,
                'gstin' => trim((string) ($order['gstin'] ?? '')),
                'sites' => [],
            ];
        }

        if ($byClient[$clientKey]['gstin'] === '') {
            $byClient[$clientKey]['gstin'] = trim((string) ($order['gstin'] ?? ''));
        }

        $siteName = trim((string) ($order['location'] ?? ''));
        if ($siteName === '') {
            continue;
        }

        $siteKey = strtolower($siteName);
        if (isset($byClient[$clientKey]['sites'][$siteKey])) {
            continue;
        }

        $byClient[$clientKey]['sites'][$siteKey] = [
            'siteName' => $siteName,
            'aacRate' => normalize_rate($order['rate'] ?? null),
            'bjmRate' => normalize_rate($order['bjmRate'] ?? null),
            'lastUsedAt' => (string) ($order['updatedAt'] ?? $order['createdAt'] ?? $order['orderDate'] ?? ''),
        ];
    }

    $profiles = [];
    foreach ($byClient as $profile) {
        $sites = array_values($profile['sites']);
        usort($sites, static function ($a, $b) {
            return strcmp((string) ($b['lastUsedAt'] ?? ''), (string) ($a['lastUsedAt'] ?? ''));
        });

        $profiles[] = [
            'clientName' => $profile['clientName'],
            'gstin' => $profile['gstin'],
            'sites' => $sites,
        ];
    }

    usort($profiles, static function ($a, $b) {
        return strcmp((string) $a['clientName'], (string) $b['clientName']);
    });

    return $profiles;
}

function get_state(PDO $pdo): array
{
    $stmt = $pdo->prepare('SELECT data FROM app_state WHERE id = ?');
    $stmt->execute(['main']);
    $row = $stmt->fetch();
    if (!$row) {
        return [
            'orders' => [],
            'dieselEntries' => [],
            'logs' => [],
            'rawStock' => new stdClass(),
            'finishedStock' => new stdClass(),
        ];
    }

    $decoded = json_decode((string) $row['data'], true);
    return is_array($decoded) ? $decoded : [];
}

function set_state(PDO $pdo, array $state): void
{
    $stmt = $pdo->prepare('UPDATE app_state SET data = ? WHERE id = ?');
    $stmt->execute([json_encode($state, JSON_UNESCAPED_SLASHES), 'main']);
}

function safe_num($value): float
{
    return is_numeric($value) ? (float) $value : 0.0;
}

function raw_materials_catalog(): array
{
    return [
        ['desc' => 'FLYASH', 'unit' => 'Ton'],
        ['desc' => 'CEMENT', 'unit' => 'Ton'],
        ['desc' => 'LIME POWDER', 'unit' => 'Ton'],
        ['desc' => 'GYPSUM (POP)', 'unit' => 'Ton'],
        ['desc' => 'RICE HUSK', 'unit' => 'Ton'],
        ['desc' => 'ALUM. POWDER', 'unit' => 'KG'],
        ['desc' => 'SOLUBLE OIL', 'unit' => 'Ltr'],
        ['desc' => 'MOULD OIL', 'unit' => 'Ltr'],
        ['desc' => 'HARDENER', 'unit' => 'KG'],
        ['desc' => 'CHARCOAL', 'unit' => 'KG'],
        ['desc' => 'SALT', 'unit' => 'KG'],
        ['desc' => 'COAL', 'unit' => 'Ton'],
    ];
}

function finished_sizes_catalog(): array
{
    return [
        '600X250X200', '600X250X125', '600X200X250', '600X200X230', '600X200X225', '600X200X200',
        '600X200X150', '600X200X150(P)', '600X200X125', '600X200X100', '600X200X75', '600X200X350',
        '600X200X250(B)', '600X200X225 (B)', '600X200X200(B)', '600X200X150(B)', '600X200X100 (B)',
        '600x200x125 (B)', '600x200x200 (HD)', '600X200X100 (HD)', '600X250X250',
    ];
}

function previous_date_iso(string $isoDate): ?string
{
    if (!preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $isoDate, $m)) {
        return null;
    }

    $ts = gmmktime(12, 0, 0, (int) $m[2], (int) $m[3], (int) $m[1]);
    if ($ts === false) {
        return null;
    }

    return gmdate('Y-m-d', $ts - 86400);
}

function find_latest_stock_before(array $stock, string $date): ?array
{
    $candidateDate = null;
    $candidate = null;

    foreach ($stock as $key => $snapshot) {
        $d = (string) $key;
        if ($d >= $date) {
            continue;
        }

        if ($candidateDate === null || $d > $candidateDate) {
            $candidateDate = $d;
            $candidate = is_array($snapshot) ? $snapshot : null;
        }
    }

    return $candidate;
}

function build_raw_opening_map(array $items): array
{
    $map = [];
    foreach ($items as $item) {
        if (!is_array($item)) {
            continue;
        }
        $desc = (string) ($item['desc'] ?? '');
        if ($desc === '') {
            continue;
        }
        $map[$desc] = safe_num($item['closing'] ?? 0);
    }
    return $map;
}

function recompute_raw_items_with_opening(array $sourceItems, array $openingMap): array
{
    $sourceMap = [];
    foreach ($sourceItems as $source) {
        if (!is_array($source)) {
            continue;
        }
        $desc = (string) ($source['desc'] ?? '');
        if ($desc === '') {
            continue;
        }
        $sourceMap[$desc] = $source;
    }

    $result = [];
    foreach (raw_materials_catalog() as $idx => $catalog) {
        $desc = (string) $catalog['desc'];
        $src = isset($sourceMap[$desc]) && is_array($sourceMap[$desc]) ? $sourceMap[$desc] : [];

        $opening = safe_num($openingMap[$desc] ?? 0);
        $receipt = safe_num($src['receipt'] ?? 0);
        $issue = safe_num($src['issue'] ?? 0);
        $total = $opening + $receipt;
        $closing = $total - $issue;

        $result[] = [
            'id' => $idx,
            'desc' => $desc,
            'unit' => (string) $catalog['unit'],
            'opening' => $opening,
            'receipt' => $receipt,
            'total' => $total,
            'issue' => $issue,
            'closing' => $closing,
            'remarks' => (string) ($src['remarks'] ?? ''),
        ];
    }

    return $result;
}

function build_default_raw_items(array $rawStock, string $date): array
{
    $prevDate = previous_date_iso($date);
    $baseline = null;

    if ($prevDate !== null && isset($rawStock[$prevDate]) && is_array($rawStock[$prevDate])) {
        $baseline = $rawStock[$prevDate];
    }

    if ($baseline === null) {
        $baseline = find_latest_stock_before($rawStock, $date);
    }

    $openingMap = build_raw_opening_map(is_array($baseline['items'] ?? null) ? $baseline['items'] : []);
    return recompute_raw_items_with_opening([], $openingMap);
}

function build_finished_opening_map(array $items): array
{
    $map = [];
    foreach ($items as $item) {
        if (!is_array($item)) {
            continue;
        }
        $size = (string) ($item['size'] ?? '');
        if ($size === '') {
            continue;
        }
        $map[$size] = safe_num($item['closing'] ?? 0);
    }
    return $map;
}

function recompute_finished_items_with_opening(array $sourceItems, array $openingMap): array
{
    $sourceMap = [];
    foreach ($sourceItems as $source) {
        if (!is_array($source)) {
            continue;
        }
        $size = (string) ($source['size'] ?? '');
        if ($size === '') {
            continue;
        }
        $sourceMap[$size] = $source;
    }

    $result = [];
    foreach (finished_sizes_catalog() as $idx => $size) {
        $src = isset($sourceMap[$size]) && is_array($sourceMap[$size]) ? $sourceMap[$size] : [];

        $opening = safe_num($openingMap[$size] ?? 0);
        $segregation = safe_num($src['segregation'] ?? 0);
        $sale = safe_num($src['sale'] ?? 0);
        $proRejection = safe_num($src['proRejection'] ?? 0);
        $loadingRejection = safe_num($src['loadingRejection'] ?? 0);
        $selfUse = safe_num($src['selfUse'] ?? 0);
        $closing = ($opening + $segregation) - ($sale + $proRejection + $loadingRejection + $selfUse);

        $result[] = [
            'id' => $idx,
            'size' => $size,
            'opening' => $opening,
            'segregation' => $segregation,
            'sale' => $sale,
            'proRejection' => $proRejection,
            'loadingRejection' => $loadingRejection,
            'selfUse' => $selfUse,
            'closing' => $closing,
        ];
    }

    return $result;
}

function recompute_finished_payload_with_opening(array $sourcePayload, array $openingMap, float $mortarOpening): array
{
    $items = recompute_finished_items_with_opening(
        is_array($sourcePayload['items'] ?? null) ? $sourcePayload['items'] : [],
        $openingMap
    );

    $sourceMortar = is_array($sourcePayload['mortarBag'] ?? null) ? $sourcePayload['mortarBag'] : [];
    $mortarReceipt = safe_num($sourceMortar['receipt'] ?? 0);
    $mortarSale = safe_num($sourceMortar['sale'] ?? 0);
    $mortarBag = [
        'opening' => $mortarOpening,
        'receipt' => $mortarReceipt,
        'sale' => $mortarSale,
        'closing' => $mortarOpening + $mortarReceipt - $mortarSale,
    ];

    $saleDaily = 0.0;
    foreach ($items as $item) {
        $saleDaily += safe_num($item['sale'] ?? 0);
    }

    $sourceSummary = is_array($sourcePayload['summary'] ?? null) ? $sourcePayload['summary'] : [];
    $summary = [
        'saleDaily' => $saleDaily,
        'productionDaily' => safe_num($sourceSummary['productionDaily'] ?? 0),
        'totalSale' => safe_num($sourceSummary['totalSale'] ?? 0),
        'totalProduction' => safe_num($sourceSummary['totalProduction'] ?? 0),
        'totalMortarSale' => safe_num($sourceSummary['totalMortarSale'] ?? 0),
    ];

    return [
        'items' => $items,
        'mortarBag' => $mortarBag,
        'summary' => $summary,
    ];
}

function build_default_finished_payload(array $finishedStock, string $date): array
{
    $prevDate = previous_date_iso($date);
    $baseline = null;

    if ($prevDate !== null && isset($finishedStock[$prevDate]) && is_array($finishedStock[$prevDate])) {
        $baseline = $finishedStock[$prevDate];
    }

    if ($baseline === null) {
        $baseline = find_latest_stock_before($finishedStock, $date);
    }

    $prevItems = is_array($baseline['items'] ?? null) ? $baseline['items'] : [];
    $prevOpeningMap = build_finished_opening_map($prevItems);
    $prevMortarClosing = safe_num($baseline['mortarBag']['closing'] ?? 0);
    $prevSummary = is_array($baseline['summary'] ?? null) ? $baseline['summary'] : [];

    $payload = recompute_finished_payload_with_opening([], $prevOpeningMap, $prevMortarClosing);
    $payload['summary']['totalSale'] = safe_num($prevSummary['totalSale'] ?? 0);
    $payload['summary']['totalProduction'] = safe_num($prevSummary['totalProduction'] ?? 0);

    return $payload;
}

function get_order(PDO $pdo, string $id): ?array
{
    $stmt = $pdo->prepare('SELECT data FROM app_orders WHERE id = ?');
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    if (!$row) return null;

    $decoded = json_decode((string) $row['data'], true);
    if (!is_array($decoded)) return null;
    return $decoded;
}

function upsert_order(PDO $pdo, string $id, array $order): void
{
    $order['id'] = $id;
    $payload = json_encode($order, JSON_UNESCAPED_SLASHES);

    $stmt = $pdo->prepare('INSERT INTO app_orders (id, data) VALUES (?, ?) ON DUPLICATE KEY UPDATE data = VALUES(data)');
    $stmt->execute([$id, $payload]);
}

function allowed_next_statuses(string $current): array
{
    $flow = [
        'Awaiting Truck' => ['Truck at Site'],
        'Truck at Site' => ['Loading'],
        'Loading' => ['Loading Complete'],
        'Loading Complete' => ['Invoiced'],
        'Invoiced' => ['Approved'],
        'Approved' => ['Dispatched'],
        'Dispatched' => [],
    ];

    return $flow[$current] ?? [];
}

function generate_dispatch_slip(array $order, string $uploadDir, string $orderId): ?string
{
    $slipDir = rtrim($uploadDir, DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . 'dispatch-slips' . DIRECTORY_SEPARATOR . $orderId;
    if (!is_dir($slipDir) && !mkdir($slipDir, 0775, true) && !is_dir($slipDir)) {
        return null;
    }

    if (!is_writable($slipDir)) {
        return null;
    }

    $timestamp = time();
    $filename = 'dispatch-slip-' . $timestamp . '.pdf';
    $filepath = $slipDir . DIRECTORY_SEPARATOR . $filename;
    
    // Generate clean PDF from scratch (no overlays)
    try {
        $pdfBytes = generateDispatchPDF($order);
    } catch (Exception $e) {
        @file_put_contents($slipDir . DIRECTORY_SEPARATOR . 'dispatch-error-' . $timestamp . '.txt', $e->getMessage());
        return null;
    }

    if (file_put_contents($filepath, $pdfBytes) === false) {
        return null;
    }

    return $filename;
}

ensure_schema($pdo);

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$path = request_path();

if ($path === '/health' && $method === 'GET') {
    json_response(['ok' => true]);
}

if ($path === '/auth/login' && $method === 'POST') {
    $body = read_json_body();
    $username = strtolower(trim((string) ($body['username'] ?? '')));
    $password = (string) ($body['password'] ?? '');

    if ($username === '' || $password === '') {
        json_error('username and password are required.', 400);
    }

    $stmt = $pdo->prepare('SELECT id, username, password_hash, role FROM app_users WHERE username = ? LIMIT 1');
    $stmt->execute([$username]);
    $user = $stmt->fetch();

    if (!$user || !password_verify($password, (string) $user['password_hash'])) {
        json_error('Invalid username or password.', 401);
    }

    $token = jwt_sign([
        'sub' => (string) $user['id'],
        'username' => (string) $user['username'],
        'role' => (string) $user['role'],
        'iat' => time(),
        'exp' => time() + (8 * 60 * 60),
    ], $cfg['jwt_secret']);

    json_response([
        'token' => $token,
        'user' => [
            'id' => (string) $user['id'],
            'username' => (string) $user['username'],
            'role' => (string) $user['role'],
        ],
    ]);
}

if ($path === '/auth/me' && $method === 'GET') {
    $auth = require_auth($cfg['jwt_secret']);
    json_response(['user' => $auth]);
}

if ($path === '/state' && $method === 'GET') {
    require_auth($cfg['jwt_secret']);
    $state = get_state($pdo);
    json_response([
        'orders' => $state['orders'] ?? [],
        'dieselEntries' => $state['dieselEntries'] ?? [],
        'logs' => $state['logs'] ?? [],
        'rawStock' => $state['rawStock'] ?? new stdClass(),
        'finishedStock' => $state['finishedStock'] ?? new stdClass(),
    ]);
}

if (preg_match('#^/state/([a-zA-Z0-9_]+)$#', $path, $m) && $method === 'PUT') {
    require_auth($cfg['jwt_secret']);
    $key = $m[1];
    $allowed = ['orders', 'dieselEntries', 'logs', 'rawStock', 'finishedStock'];
    if (!in_array($key, $allowed, true)) {
        json_error('Invalid state key.', 400);
    }

    $body = read_json_body();
    $value = $body['value'] ?? null;

    $state = get_state($pdo);
    $state[$key] = $value;
    set_state($pdo, $state);

    json_response(['ok' => true]);
}

if ($path === '/orders' && $method === 'GET') {
    require_auth($cfg['jwt_secret']);

    $rows = $pdo->query('SELECT data FROM app_orders')->fetchAll();
    $orders = [];
    foreach ($rows as $row) {
        $decoded = json_decode((string) $row['data'], true);
        if (is_array($decoded)) {
            $orders[] = order_with_urls($decoded);
        }
    }

    usort($orders, static function ($a, $b) {
        $ad = (string) ($a['orderDate'] ?? $a['createdAt'] ?? '');
        $bd = (string) ($b['orderDate'] ?? $b['createdAt'] ?? '');
        return strcmp($bd, $ad);
    });

    json_response(['orders' => $orders]);
}

if ($path === '/orders/client-profiles' && $method === 'GET') {
    require_auth($cfg['jwt_secret']);

    $query = isset($_GET['q']) ? trim((string) $_GET['q']) : '';
    $rows = $pdo->query('SELECT data FROM app_orders')->fetchAll();
    $orders = [];

    foreach ($rows as $row) {
        $decoded = json_decode((string) $row['data'], true);
        if (is_array($decoded)) {
            $orders[] = $decoded;
        }
    }

    json_response(['profiles' => build_client_profiles($orders, $query)]);
}

if ($path === '/orders' && $method === 'POST') {
    require_auth($cfg['jwt_secret']);

    $body = read_json_body();
    $id = (string) ($body['id'] ?? bin2hex(random_bytes(12)));
    if ($id === '') {
        $id = bin2hex(random_bytes(12));
    }

    $now = gmdate('c');
    $order = $body;
    $order['id'] = $id;
    $order['status'] = !empty($order['status']) ? (string) $order['status'] : 'Awaiting Truck';
    $order['createdAt'] = $order['createdAt'] ?? $now;
    $order['updatedAt'] = $now;
    $order['invoice'] = $order['invoice'] ?? null;
    $order['dispatchSlip'] = $order['dispatchSlip'] ?? null;

    upsert_order($pdo, $id, $order);

    json_response(['order' => order_with_urls($order)], 201);
}

if (preg_match('#^/orders/([^/]+)/documents/invoice$#', $path, $m) && $method === 'POST') {
    require_auth($cfg['jwt_secret']);

    $id = urldecode($m[1]);
    $order = get_order($pdo, $id);
    if ($order === null) {
        json_error('Order not found.', 404);
    }

    if (!isset($_FILES['file']) || !is_array($_FILES['file'])) {
        json_error('Invoice file is required.', 400);
    }

    $upload = $_FILES['file'];
    if (($upload['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
        json_error('File upload failed.', 400);
    }

    $originalName = (string) ($upload['name'] ?? 'invoice.pdf');
    $safeName = preg_replace('/[^A-Za-z0-9._-]/', '_', $originalName);
    if ($safeName === '' || $safeName === null) {
        $safeName = 'invoice.pdf';
    }

    $targetDir = rtrim($cfg['upload_dir'], DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . 'invoices' . DIRECTORY_SEPARATOR . $id;
    if (!is_dir($targetDir)) {
        if (!mkdir($targetDir, 0775, true) && !is_dir($targetDir)) {
            json_error('Failed to create invoice upload directory.', 500);
        }
    }

    if (!is_writable($targetDir)) {
        json_error('Invoice upload directory is not writable.', 500);
    }

    $filename = time() . '-' . $safeName;
    $targetPath = $targetDir . DIRECTORY_SEPARATOR . $filename;

    if (!move_uploaded_file((string) $upload['tmp_name'], $targetPath)) {
        json_error('Failed to store invoice.', 500);
    }

    $order['invoice'] = $filename;
    $order['status'] = 'Invoiced';
    $order['updatedAt'] = gmdate('c');

    upsert_order($pdo, $id, $order);

    json_response(['order' => order_with_urls($order)]);
}

if (preg_match('#^/orders/([^/]+)/(transition|dispatch|dispatched-edit)$#', $path, $m) && in_array($method, ['POST', 'PATCH'], true)) {
    require_auth($cfg['jwt_secret']);

    $id = urldecode($m[1]);
    $action = $m[2];
    $order = get_order($pdo, $id);
    if ($order === null) {
        json_error('Order not found.', 404);
    }

    $body = read_json_body();

    if ($action === 'transition') {
        $fromStatus = (string) ($order['status'] ?? 'Awaiting Truck');
        $toStatus = (string) ($body['toStatus'] ?? '');
        $data = is_array($body['data'] ?? null) ? $body['data'] : [];

        if ($toStatus === '') {
            json_error('toStatus is required.', 400);
        }

        $allowedNext = allowed_next_statuses($fromStatus);
        if (!in_array($toStatus, $allowedNext, true)) {
            json_error('Invalid transition: ' . $fromStatus . ' -> ' . $toStatus, 400);
        }

        $order['status'] = $toStatus;
        $order = array_merge($order, $data);
    } elseif ($action === 'dispatch') {
        $dispatchBody = $body;
        unset($dispatchBody['slipFormat']);

        $invoiceId = trim((string) ($dispatchBody['invoiceId'] ?? ($order['invoiceId'] ?? ($order['invoiceNumber'] ?? ''))));
        if ($invoiceId === '') {
            json_error('invoiceId is required to dispatch.', 400);
        }

        $dispatchBody['invoiceId'] = $invoiceId;
        $dispatchBody['purpose'] = 'Sales';

        $order = array_merge($order, $dispatchBody);
        $order['status'] = 'Dispatched';

        $generatedSlip = generate_dispatch_slip($order, $cfg['upload_dir'], $id);
        if ($generatedSlip) {
            $order['dispatchSlip'] = $generatedSlip;
            $order['dispatchSlipFormat'] = 'pdf';
        }
    } else {
        $order = array_merge($order, $body);
    }

    $order['updatedAt'] = gmdate('c');
    upsert_order($pdo, $id, $order);

    json_response(['order' => order_with_urls($order)]);
}

if (preg_match('#^/orders/([^/]+)$#', $path, $m) && $method === 'PATCH') {
    require_auth($cfg['jwt_secret']);

    $id = urldecode($m[1]);
    $order = get_order($pdo, $id);
    if ($order === null) {
        json_error('Order not found.', 404);
    }

    $body = read_json_body();
    // Prevent bypassing status flow via generic update endpoint.
    if (array_key_exists('status', $body)) {
        unset($body['status']);
    }
    $order = array_merge($order, $body);
    $order['id'] = $id;
    $order['updatedAt'] = gmdate('c');

    upsert_order($pdo, $id, $order);

    json_response(['order' => order_with_urls($order)]);
}

if (preg_match('#^/orders/([^/]+)$#', $path, $m) && $method === 'DELETE') {
    require_auth($cfg['jwt_secret']);

    $id = urldecode($m[1]);
    $stmt = $pdo->prepare('DELETE FROM app_orders WHERE id = ?');
    $stmt->execute([$id]);

    json_response(['ok' => true, 'id' => $id]);
}

if (preg_match('#^/orders/([^/]+)/(?:documents/)?mtc$#', $path, $m) && $method === 'POST') {
    $user = require_auth($cfg['jwt_secret']);
    require_roles($user, ['accounts', 'management']);

    $id = urldecode($m[1]);
    $order = get_order($pdo, $id);
    if ($order === null) {
        json_error('Order not found.', 404);
    }

    if ((string) ($order['status'] ?? '') !== 'Dispatched') {
        json_error('MTC can be generated only after dispatch.', 400);
    }

    $body = read_json_body();
    $dryDensityResult = trim((string) ($body['dryDensityResult'] ?? ''));
    $compressiveStrengthResult = trim((string) ($body['compressiveStrengthResult'] ?? ''));

    if ($dryDensityResult === '' || $compressiveStrengthResult === '') {
        json_error('Dry Density Result and Compressive Strength Result are required.', 400);
    }

    // Validate numeric values
    if (!is_numeric($dryDensityResult)) {
        json_error('Dry Density Result must be a number.', 400);
    }
    if (!is_numeric($compressiveStrengthResult)) {
        json_error('Compressive Strength Result must be a number.', 400);
    }

    // Validate reasonable ranges (optional but recommended)
    $dryDensity = (float) $dryDensityResult;
    $compressiveStrength = (float) $compressiveStrengthResult;
    
    if ($dryDensity < 0 || $dryDensity > 2000) {
        json_error('Dry Density Result must be between 0 and 2000 kg/m³.', 400);
    }
    if ($compressiveStrength < 0 || $compressiveStrength > 100) {
        json_error('Compressive Strength Result must be between 0 and 100 MPa.', 400);
    }

    // Calculate MTC dates:
    // Issue Date = Today
    // Testing Date = Issue Date - 10 days
    $issueDateIso = get_today_iso();
    $testingDateIso = subtract_days_iso($issueDateIso, 10);

    $testData = [
        'dryDensityResult' => $dryDensityResult,
        'compressiveStrengthResult' => $compressiveStrengthResult,
        'issueDate' => format_date_dd_mm_yyyy($issueDateIso),
        'testingDate' => format_date_dd_mm_yyyy($testingDateIso),
    ];

    $mtcDir = $cfg['upload_dir'] . DIRECTORY_SEPARATOR . 'mtc' . DIRECTORY_SEPARATOR . $id;
    if (!is_dir($mtcDir) && !mkdir($mtcDir, 0775, true) && !is_dir($mtcDir)) {
        json_error('Failed to create MTC directory.', 500);
    }

    if (!is_writable($mtcDir)) {
        json_error('MTC directory is not writable.', 500);
    }

    $timestamp = (int) round(microtime(true) * 1000);
    $filename = 'mtc-' . $timestamp . '.pdf';
    $filepath = $mtcDir . DIRECTORY_SEPARATOR . $filename;

    // Generate clean MTC PDF from scratch (no overlays)
    try {
        $pdfBytes = generateMTCPDF($order, $testData);
    } catch (Exception $e) {
        @file_put_contents($mtcDir . DIRECTORY_SEPARATOR . 'mtc-error-' . $timestamp . '.txt', $e->getMessage());
        json_error('Failed to generate MTC PDF: ' . $e->getMessage(), 500);
    }

    if (file_put_contents($filepath, $pdfBytes, LOCK_EX) === false) {
        json_error('Failed to write MTC PDF file.', 500);
    }

    $order['mtc'] = $filename;
    $order['mtcFormat'] = 'pdf';
    $order['updatedAt'] = gmdate('c');

    upsert_order($pdo, $id, $order);

    json_response([
        'order' => order_with_urls($order),
        'document' => [
            'filename' => $filename,
            'url' => order_with_urls($order)['mtcUrl'] ?? null,
        ],
    ]);
}

if (preg_match('#^/production/raw/(\d{4}-\d{2}-\d{2})$#', $path, $m) && $method === 'GET') {
    $user = require_auth($cfg['jwt_secret']);
    require_roles($user, ['production', 'management']);

    $date = (string) $m[1];
    $state = get_state($pdo);
    $rawStock = is_array($state['rawStock'] ?? null) ? $state['rawStock'] : [];

    if (isset($rawStock[$date]) && is_array($rawStock[$date])) {
        json_response([
            'date' => $date,
            'items' => is_array($rawStock[$date]['items'] ?? null) ? $rawStock[$date]['items'] : [],
        ]);
    }

    json_response([
        'date' => $date,
        'items' => build_default_raw_items($rawStock, $date),
    ]);
}

if (preg_match('#^/production/raw/(\d{4}-\d{2}-\d{2})$#', $path, $m) && $method === 'PUT') {
    $user = require_auth($cfg['jwt_secret']);
    require_roles($user, ['production', 'management']);

    $date = (string) $m[1];
    $body = read_json_body();
    $sourceItems = is_array($body['items'] ?? null) ? $body['items'] : [];

    $state = get_state($pdo);
    $rawStock = is_array($state['rawStock'] ?? null) ? $state['rawStock'] : [];

    $baseline = find_latest_stock_before($rawStock, $date);
    $openingMap = build_raw_opening_map(is_array($baseline['items'] ?? null) ? $baseline['items'] : []);

    $datesToRecalc = [$date];
    foreach ($rawStock as $d => $_snapshot) {
        $day = (string) $d;
        if ($day >= $date) {
            $datesToRecalc[] = $day;
        }
    }
    $datesToRecalc = array_values(array_unique($datesToRecalc));
    sort($datesToRecalc);

    $affected = [];
    foreach ($datesToRecalc as $day) {
        $existingSnapshot = isset($rawStock[$day]) && is_array($rawStock[$day]) ? $rawStock[$day] : [];
        $source = ($day === $date)
            ? $sourceItems
            : (is_array($existingSnapshot['items'] ?? null) ? $existingSnapshot['items'] : []);

        $items = recompute_raw_items_with_opening($source, $openingMap);
        $updatedAt = gmdate('c');

        $rawStock[$day] = [
            'items' => $items,
            'timestamp' => $updatedAt,
        ];

        $affected[] = [
            'date' => $day,
            'items' => $items,
            'updatedAt' => $updatedAt,
        ];

        $openingMap = build_raw_opening_map($items);
    }

    $state['rawStock'] = $rawStock;
    set_state($pdo, $state);

    json_response([
        'ok' => true,
        'date' => $date,
        'items' => is_array($rawStock[$date]['items'] ?? null) ? $rawStock[$date]['items'] : [],
        'affectedDates' => $affected,
    ]);
}

if (preg_match('#^/production/finished/(\d{4}-\d{2}-\d{2})$#', $path, $m) && $method === 'GET') {
    $user = require_auth($cfg['jwt_secret']);
    require_roles($user, ['production', 'management']);

    $date = (string) $m[1];
    $state = get_state($pdo);
    $finishedStock = is_array($state['finishedStock'] ?? null) ? $state['finishedStock'] : [];

    if (isset($finishedStock[$date]) && is_array($finishedStock[$date])) {
        $snapshot = $finishedStock[$date];
        json_response([
            'date' => $date,
            'items' => is_array($snapshot['items'] ?? null) ? $snapshot['items'] : [],
            'mortarBag' => is_array($snapshot['mortarBag'] ?? null) ? $snapshot['mortarBag'] : ['opening' => 0, 'receipt' => 0, 'sale' => 0, 'closing' => 0],
            'summary' => is_array($snapshot['summary'] ?? null) ? $snapshot['summary'] : ['saleDaily' => 0, 'productionDaily' => 0, 'totalSale' => 0, 'totalProduction' => 0, 'totalMortarSale' => 0],
        ]);
    }

    $seed = build_default_finished_payload($finishedStock, $date);
    json_response([
        'date' => $date,
        'items' => $seed['items'],
        'mortarBag' => $seed['mortarBag'],
        'summary' => $seed['summary'],
    ]);
}

if (preg_match('#^/production/finished/(\d{4}-\d{2}-\d{2})$#', $path, $m) && $method === 'PUT') {
    $user = require_auth($cfg['jwt_secret']);
    require_roles($user, ['production', 'management']);

    $date = (string) $m[1];
    $body = read_json_body();

    $state = get_state($pdo);
    $finishedStock = is_array($state['finishedStock'] ?? null) ? $state['finishedStock'] : [];

    $baseline = find_latest_stock_before($finishedStock, $date);
    $openingMap = build_finished_opening_map(is_array($baseline['items'] ?? null) ? $baseline['items'] : []);
    $mortarOpening = safe_num($baseline['mortarBag']['closing'] ?? 0);

    $datesToRecalc = [$date];
    foreach ($finishedStock as $d => $_snapshot) {
        $day = (string) $d;
        if ($day >= $date) {
            $datesToRecalc[] = $day;
        }
    }
    $datesToRecalc = array_values(array_unique($datesToRecalc));
    sort($datesToRecalc);

    $affected = [];
    foreach ($datesToRecalc as $day) {
        $existingSnapshot = isset($finishedStock[$day]) && is_array($finishedStock[$day]) ? $finishedStock[$day] : [];
        $sourcePayload = ($day === $date)
            ? $body
            : [
                'items' => is_array($existingSnapshot['items'] ?? null) ? $existingSnapshot['items'] : [],
                'mortarBag' => is_array($existingSnapshot['mortarBag'] ?? null) ? $existingSnapshot['mortarBag'] : [],
                'summary' => is_array($existingSnapshot['summary'] ?? null) ? $existingSnapshot['summary'] : [],
            ];

        $payload = recompute_finished_payload_with_opening(
            is_array($sourcePayload) ? $sourcePayload : [],
            $openingMap,
            $mortarOpening
        );

        $updatedAt = gmdate('c');
        $finishedStock[$day] = [
            'items' => $payload['items'],
            'mortarBag' => $payload['mortarBag'],
            'summary' => $payload['summary'],
            'timestamp' => $updatedAt,
        ];

        $affected[] = [
            'date' => $day,
            'items' => $payload['items'],
            'mortarBag' => $payload['mortarBag'],
            'summary' => $payload['summary'],
            'updatedAt' => $updatedAt,
        ];

        $openingMap = build_finished_opening_map($payload['items']);
        $mortarOpening = safe_num($payload['mortarBag']['closing'] ?? 0);
    }

    $state['finishedStock'] = $finishedStock;
    set_state($pdo, $state);

    $snapshot = is_array($finishedStock[$date] ?? null) ? $finishedStock[$date] : ['items' => [], 'mortarBag' => [], 'summary' => []];
    json_response([
        'ok' => true,
        'date' => $date,
        'items' => is_array($snapshot['items'] ?? null) ? $snapshot['items'] : [],
        'mortarBag' => is_array($snapshot['mortarBag'] ?? null) ? $snapshot['mortarBag'] : ['opening' => 0, 'receipt' => 0, 'sale' => 0, 'closing' => 0],
        'summary' => is_array($snapshot['summary'] ?? null) ? $snapshot['summary'] : ['saleDaily' => 0, 'productionDaily' => 0, 'totalSale' => 0, 'totalProduction' => 0, 'totalMortarSale' => 0],
        'affectedDates' => $affected,
    ]);
}

if ($path === '/production/reset' && $method === 'DELETE') {
    $user = require_auth($cfg['jwt_secret']);
    require_roles($user, ['management']);

    $state = get_state($pdo);
    $state['rawStock'] = [];
    $state['finishedStock'] = [];
    set_state($pdo, $state);

    json_response(['ok' => true]);
}

json_error('Not found', 404);
