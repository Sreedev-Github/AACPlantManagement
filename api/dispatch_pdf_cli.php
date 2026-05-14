<?php

declare(strict_types=1);

require_once __DIR__ . DIRECTORY_SEPARATOR . 'dispatch_pdf.php';

$input = stream_get_contents(STDIN);
if ($input === false) {
    fwrite(STDERR, 'Unable to read dispatch order payload.' . PHP_EOL);
    exit(1);
}

$order = json_decode($input, true);
if (!is_array($order)) {
    fwrite(STDERR, 'Invalid dispatch order JSON.' . PHP_EOL);
    exit(1);
}

try {
    echo generateDispatchPDF($order);
} catch (Throwable $exception) {
    fwrite(STDERR, $exception->getMessage() . PHP_EOL);
    exit(1);
}
