<?php

declare(strict_types=1);

require_once __DIR__ . DIRECTORY_SEPARATOR . 'mtc_pdf.php';

$input = stream_get_contents(STDIN);
if ($input === false) {
    fwrite(STDERR, 'Unable to read MTC payload.' . PHP_EOL);
    exit(1);
}

$payload = json_decode($input, true);
if (!is_array($payload)) {
    fwrite(STDERR, 'Invalid MTC JSON payload.' . PHP_EOL);
    exit(1);
}

$order = is_array($payload['order'] ?? null) ? $payload['order'] : null;
$testData = is_array($payload['testData'] ?? null) ? $payload['testData'] : null;

if ($order === null || $testData === null) {
    fwrite(STDERR, 'MTC payload must include order and testData objects.' . PHP_EOL);
    exit(1);
}

try {
    echo generateMTCPDF($order, $testData);
} catch (Throwable $exception) {
    fwrite(STDERR, $exception->getMessage() . PHP_EOL);
    exit(1);
}