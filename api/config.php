<?php

declare(strict_types=1);

function load_env_file(string $filePath): void
{
    if (!is_file($filePath)) {
        return;
    }

    $lines = file($filePath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    if ($lines === false) {
        return;
    }

    foreach ($lines as $line) {
        $trimmed = trim($line);
        if ($trimmed === '' || strpos($trimmed, '#') === 0) {
            continue;
        }

        $parts = explode('=', $trimmed, 2);
        if (count($parts) !== 2) {
            continue;
        }

        $key = trim($parts[0]);
        $value = trim($parts[1]);

        if ($key === '' || getenv($key) !== false) {
            continue;
        }

        putenv($key . '=' . $value);
        $_ENV[$key] = $value;
        $_SERVER[$key] = $value;
    }
}

$envCandidates = [
    dirname(__DIR__) . DIRECTORY_SEPARATOR . 'config' . DIRECTORY_SEPARATOR . 'config.env',
    dirname(__DIR__) . DIRECTORY_SEPARATOR . '.env',
    __DIR__ . DIRECTORY_SEPARATOR . '.env',
];

foreach ($envCandidates as $candidate) {
    load_env_file($candidate);
}

function env_value(string $key, ?string $fallback = null): ?string
{
    $value = getenv($key);
    if ($value === false || $value === '') {
        return $fallback;
    }

    return $value;
}

function parse_mysql_url(string $url): array
{
    $parts = parse_url($url);
    if ($parts === false) {
        throw new RuntimeException('Invalid SQLSERVER_URL format.');
    }

    $host = $parts['host'] ?? '';
    $port = isset($parts['port']) ? (int) $parts['port'] : 3306;
    $user = isset($parts['user']) ? urldecode($parts['user']) : '';
    $pass = isset($parts['pass']) ? urldecode($parts['pass']) : '';
    $dbName = isset($parts['path']) ? ltrim($parts['path'], '/') : '';

    if ($host === '' || $user === '' || $dbName === '') {
        throw new RuntimeException('SQLSERVER_URL must include host, username, and database name.');
    }

    return [
        'host' => $host,
        'port' => $port,
        'user' => $user,
        'pass' => $pass,
        'db' => $dbName,
    ];
}

function is_absolute_path(string $path): bool
{
    return $path !== '' && (
        $path[0] === '/' ||
        $path[0] === '\\' ||
        preg_match('/^[A-Za-z]:[\\\\\/]/', $path) === 1
    );
}

function app_config(): array
{
    $sqlUrl = env_value('SQLSERVER_URL');
    if ($sqlUrl === null) {
        throw new RuntimeException('Missing SQLSERVER_URL in environment/config file.');
    }

    $db = parse_mysql_url($sqlUrl);

    $rawUploadDir = (string) env_value('UPLOAD_DIR', __DIR__ . DIRECTORY_SEPARATOR . 'uploads');
    $uploadDir = $rawUploadDir;

    if (!is_absolute_path($uploadDir)) {
        $normalized = str_replace(['/', '\\'], DIRECTORY_SEPARATOR, ltrim($uploadDir, '/\\'));
        $uploadDir = dirname(__DIR__) . DIRECTORY_SEPARATOR . $normalized;
    }

    if (!is_dir($uploadDir)) {
        @mkdir($uploadDir, 0775, true);
    }

    if (!is_dir($uploadDir) || !is_writable($uploadDir)) {
        $uploadDir = __DIR__ . DIRECTORY_SEPARATOR . 'uploads';
        if (!is_dir($uploadDir)) {
            @mkdir($uploadDir, 0775, true);
        }
    }

    $rawCors = (string) env_value('CORS_ORIGIN', '*');
    $corsOrigins = array_values(array_filter(array_map('trim', explode(',', $rawCors)), static function ($item) {
        return $item !== '';
    }));

    if (count($corsOrigins) === 0) {
        $corsOrigins = ['*'];
    }

    return [
        'db' => $db,
        'jwt_secret' => env_value('JWT_SECRET', 'dev-insecure-secret-change-me'),
        'cors_origin' => $rawCors,
        'cors_origins' => $corsOrigins,
        'upload_dir' => $uploadDir,
    ];
}

function app_pdo(array $cfg): PDO
{
    $dsn = sprintf(
        'mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4',
        $cfg['db']['host'],
        $cfg['db']['port'],
        $cfg['db']['db']
    );

    return new PDO($dsn, $cfg['db']['user'], $cfg['db']['pass'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
}
