<?php

declare(strict_types=1);

use setasign\Fpdi\Fpdi;

function pdf_fpdi_bootstrap(): void
{
    static $bootstrapped = false;

    if ($bootstrapped) {
        return;
    }

    $autoloadPath = dirname(__DIR__) . DIRECTORY_SEPARATOR . 'vendor' . DIRECTORY_SEPARATOR . 'autoload.php';
    if (!is_file($autoloadPath)) {
        throw new RuntimeException('Composer autoload file is missing.');
    }

    require_once $autoloadPath;

    if (!class_exists(Fpdi::class)) {
        throw new RuntimeException('FPDI is not available. Run composer install.');
    }

    $bootstrapped = true;
}

function pdf_fpdi_resolve_letterhead_path(): string
{
    $candidates = [
        __DIR__ . DIRECTORY_SEPARATOR . 'public' . DIRECTORY_SEPARATOR . 'letter head.pdf',
        dirname(__DIR__) . DIRECTORY_SEPARATOR . 'public' . DIRECTORY_SEPARATOR . 'letter head.pdf',
        __DIR__ . DIRECTORY_SEPARATOR . 'letter head.pdf',
        dirname(__DIR__) . DIRECTORY_SEPARATOR . 'letter head.pdf',
    ];

    foreach ($candidates as $candidate) {
        if (is_file($candidate) && is_readable($candidate)) {
            return $candidate;
        }
    }

    throw new RuntimeException('Letterhead PDF not found. Expected public/letter head.pdf.');
}

function pdf_fpdi_create_document(): Fpdi
{
    pdf_fpdi_bootstrap();

    $sourceFile = pdf_fpdi_resolve_letterhead_path();
    $pdf = new Fpdi('P', 'mm', 'A4');
    $pdf->SetMargins(0, 0, 0);
    $pdf->SetAutoPageBreak(false);
    $pdf->SetDrawColor(0, 0, 0);
    $pdf->SetTextColor(0, 0, 0);

    $pdf->setSourceFile($sourceFile);
    $templateId = $pdf->importPage(1);
    $size = $pdf->getTemplateSize($templateId);

    $pdf->AddPage($size['orientation'], [$size['width'], $size['height']]);
    $pdf->useTemplate($templateId, 0, 0, $size['width'], $size['height'], true);

    return $pdf;
}

function dispatch_pdf_mm(float $mm): float
{
    return $mm;
}

function dispatch_pdf_normalize_text($value): string
{
    $text = trim(preg_replace('/\s+/u', ' ', (string) ($value ?? '')) ?? '');
    return $text === '' ? '-' : $text;
}

function dispatch_pdf_to_upper_display($value): string
{
    $text = dispatch_pdf_normalize_text($value);
    return $text === '-' ? '-' : strtoupper($text);
}

function dispatch_pdf_format_date($rawValue): string
{
    $raw = trim((string) ($rawValue ?? ''));
    if ($raw === '') {
        return date('d / m / Y');
    }

    if (preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $raw, $matches)) {
        return $matches[3] . ' / ' . $matches[2] . ' / ' . $matches[1];
    }

    $timestamp = strtotime($raw);
    if ($timestamp === false) {
        return $raw;
    }

    return date('d / m / Y', $timestamp);
}

function dispatch_pdf_format_number($value, int $decimals = 0, bool $trimTrailing = false): string
{
    if (dispatch_pdf_normalize_text($value) === '-') {
        return '-';
    }

    $number = (float) $value;
    if (!is_finite($number)) {
        return (string) $value;
    }

    $formatted = number_format($number, $decimals, '.', '');
    if (!$trimTrailing || $decimals === 0) {
        return $formatted;
    }

    return rtrim(rtrim($formatted, '0'), '.');
}

function dispatch_pdf_format_size($size): string
{
    $sizes = [];
    if (is_array($size)) {
        $sizes = $size;
    } else {
        $raw = trim((string) ($size ?? ''));
        if ($raw !== '') {
                $decoded = @json_decode($raw, true);
                if (is_array($decoded)) {
                    $sizes = $decoded;
                } else {
                    $sizes = preg_split('/[,\n|]+/', $raw, -1, PREG_SPLIT_NO_EMPTY);
                }
        }
    }

    $formatted = [];
    foreach ($sizes as $s) {
            $cleanSize = trim(str_replace(['"', "'", '[', ']', '\\'], '', (string) $s));
            $normalized = preg_replace('/\s*[xX]\s*/u', ' X ', $cleanSize);
        $normalized = preg_replace('/\s+/u', ' ', (string) $normalized);
        $normalized = trim((string) $normalized);

        if ($normalized === '') {
            continue;
        }

        if (!preg_match('/MM$/i', $normalized)) {
            $normalized .= ' MM';
        }
        $formatted[] = strtoupper($normalized);
    }

    if (count($formatted) === 0) {
        return '-';
    }

    return implode(', ', $formatted);
}

function dispatch_pdf_format_truck_type($value): string
{
    $digits = preg_replace('/\D+/u', '', (string) ($value ?? ''));
    if ($digits === null || $digits === '') {
        return '';
    }

    return $digits . ' W';
}

function calculate_financial_year($date = null): string
{
    if ($date === null) {
        $date = new DateTime('now', new DateTimeZone('UTC'));
    } elseif (is_string($date)) {
        $date = new DateTime($date, new DateTimeZone('UTC'));
    }
    
    $year = (int) $date->format('Y');
    $month = (int) $date->format('m');
    
    if ($month < 4) {
        $fyStart = $year - 1;
    } else {
        $fyStart = $year;
    }
    
    $fyEnd = $fyStart + 1;
    $fyStartSuffix = substr((string) $fyStart, -2);
    $fyEndSuffix = substr((string) $fyEnd, -2);

    return $fyStartSuffix . ' - ' . $fyEndSuffix;
}

function format_invoice_id($invoiceNumber, $date = null): string
{
    $invoiceNumber = trim((string) ($invoiceNumber ?? ''));
    if ($invoiceNumber === '') {
        return '';
    }
    
    $fy = calculate_financial_year($date);
    return 'ABC / ' . $fy . ' / ' . $invoiceNumber;
}

function dispatch_pdf_escape_text(string $text): string
{
    $normalized = trim(preg_replace('/\s+/u', ' ', $text) ?? '');
    if ($normalized === '') {
        return '-';
    }

    if (function_exists('iconv')) {
        $converted = @iconv('UTF-8', 'Windows-1252//TRANSLIT', $normalized);
        if ($converted !== false) {
            $normalized = $converted;
        }
    }

    return str_replace(["\r", "\n", "\t"], ' ', $normalized);
}

function dispatch_pdf_fit_text(Fpdi $pdf, string $text, float $maxWidth, string $fontFamily = 'Helvetica', string $fontStyle = '', float $fontSize = 10.0): string
{
    $safeText = dispatch_pdf_escape_text($text);

    if ($safeText === '-') {
        return '-';
    }

    $pdf->SetFont($fontFamily, $fontStyle, $fontSize);

    if ($pdf->GetStringWidth($safeText) <= $maxWidth) {
        return $safeText;
    }

    $currentFontSize = $fontSize;
    while ($currentFontSize > 4.0 && $pdf->GetStringWidth($safeText) > $maxWidth) {
        $currentFontSize -= 0.1;
        $pdf->SetFont($fontFamily, $fontStyle, $currentFontSize);
    }

    if ($pdf->GetStringWidth($safeText) <= $maxWidth) {
        return $safeText;
    }

    $ellipsis = '...';
    $fitted = $safeText;

    while ($fitted !== '' && $pdf->GetStringWidth($fitted . $ellipsis) > $maxWidth) {
        $fitted = substr($fitted, 0, -1);
    }

    return $fitted === '' ? $ellipsis : $fitted . $ellipsis;
}

function pdf_fpdi_write_cell(Fpdi $pdf, float $x, float $y, float $width, float $height, string $text, string $fontFamily = 'Helvetica', string $fontStyle = '', float $fontSize = 10.0, string $align = 'L', int $border = 1, float $padding = 1.2): void
{
    $pdf->SetFont($fontFamily, $fontStyle, $fontSize);

    $innerWidth = max($width - ($padding * 2.0), 1.0);
    $fittedText = dispatch_pdf_fit_text($pdf, $text, $innerWidth, $fontFamily, $fontStyle, $fontSize);

    $pdf->SetXY($x, $y);
    if ($border > 0) {
        $pdf->Rect($x, $y, $width, $height);
    }

    $pdf->SetXY($x + $padding, $y);
    $pdf->Cell($innerWidth, $height, $fittedText, 0, 0, $align);
}

function pdf_fpdi_write_paragraph(Fpdi $pdf, float $x, float $y, float $width, float $lineHeight, string $text, string $fontFamily = 'Helvetica', string $fontStyle = '', float $fontSize = 10.0, string $align = 'L'): float
{
    $pdf->SetFont($fontFamily, $fontStyle, $fontSize);
    $pdf->SetXY($x, $y);
    $pdf->MultiCell($width, $lineHeight, dispatch_pdf_escape_text($text), 0, $align);

    return $pdf->GetY();
}