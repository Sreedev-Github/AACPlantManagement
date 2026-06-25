<?php

declare(strict_types=1);

require_once __DIR__ . DIRECTORY_SEPARATOR . 'pdf_fpdi_helpers.php';

function dispatch_pdf_sum_numeric_values($value): ?float
{
    if (is_array($value)) {
        $parts = $value;
    } else {
        $raw = trim((string) ($value ?? ''));
        if ($raw === '' || $raw === '-') {
            return null;
        }
        $decoded = @json_decode($raw, true);
        if (is_array($decoded)) {
            $parts = $decoded;
        } else {
            $parts = explode(',', $raw);
        }
    }

    $sum = 0.0;
    $hasValue = false;

    foreach ($parts as $p) {
        $str = trim(str_replace(['"', "'", '[', ']'], '', (string) $p));
        if ($str !== '' && is_numeric($str)) {
            $sum += (float) $str;
            $hasValue = true;
        }
    }

    return $hasValue ? $sum : null;
}

function dispatch_pdf_get_size_volume($size): ?float
{
    preg_match_all('/\d+(?:\.\d+)?/u', (string) $size, $matches);
    $parts = $matches[0] ?? [];
    if (count($parts) < 3) {
        return null;
    }
    $parts = array_slice($parts, 0, 3);
    $l = (float) $parts[0];
    $w = (float) $parts[1];
    $h = (float) $parts[2];
    if ($l <= 0 || $w <= 0 || $h <= 0) {
        return null;
    }
    return ($l / 1000.0) * ($w / 1000.0) * ($h / 1000.0);
}

function dispatch_pdf_derive_pieces($cbm, $size): int
{
    $cbmValue = (float) $cbm;
    $vol = dispatch_pdf_get_size_volume($size);
    if ($cbmValue <= 0 || $vol === null || $vol <= 0) {
        return 0;
    }
    return (int) max(0, round($cbmValue / $vol));
}

function dispatch_pdf_build_values(array $order): array
{
    $truckType = dispatch_pdf_format_truck_type($order['truckType'] ?? ($order['vehicleType'] ?? ''));
    $invoiceNum = (string) ($order['invoiceId'] ?? ($order['invoiceNumber'] ?? ''));
    $formattedInvoiceId = format_invoice_id($invoiceNum, $order['orderDate'] ?? null);
    
    $isDispatched = (isset($order['status']) && $order['status'] === 'Dispatched') || !empty($order['dispatchSlip']);

    $sizesList = [];
    $cbmsList = [];
    $piecesList = [];

    if ($isDispatched) {
        $rawSizes = explode(',', (string) ($order['size'] ?? ''));
        $rawSizes = array_values(array_filter(array_map('trim', $rawSizes)));
        
        $totalCbm = (float) ($order['cbm'] ?? 0);
        $totalPieces = (int) ($order['piecesLoaded'] ?? 0);
        
        $additional = $order['additionalProducts'] ?? [];
        if (!is_array($additional)) {
            $additional = [];
        }
        
        $additionalCbmSum = 0.0;
        $additionalPiecesSum = 0;
        
        $additionalItems = [];
        foreach ($additional as $p) {
            if (is_array($p)) {
                $pCbm = (float) ($p['cbm'] ?? 0);
                $pSize = $p['size'] ?? '';
                $pPieces = dispatch_pdf_derive_pieces($pCbm, $pSize);
                
                $additionalCbmSum += $pCbm;
                $additionalPiecesSum += $pPieces;
                
                $additionalItems[] = ['cbm' => $pCbm, 'pieces' => $pPieces];
            }
        }
        
        $primaryCbm = max(0.0, $totalCbm - $additionalCbmSum);
        $primaryPieces = max(0, $totalPieces - $additionalPiecesSum);
        
        foreach ($rawSizes as $idx => $sz) {
            $sizesList[] = $sz;
            if ($idx === 0) {
                $cbmsList[] = $primaryCbm;
                $piecesList[] = $primaryPieces;
            } else {
                $addIndex = $idx - 1;
                $addCbm = isset($additionalItems[$addIndex]) ? $additionalItems[$addIndex]['cbm'] : 0.0;
                $addPieces = isset($additionalItems[$addIndex]) ? $additionalItems[$addIndex]['pieces'] : 0;
                $cbmsList[] = $addCbm;
                $piecesList[] = $addPieces;
            }
        }
    } else {
        if (!empty($order['size'])) {
            $sizesList[] = $order['size'];
            $cbmsList[] = (float) ($order['cbm'] ?? 0);
            $piecesList[] = isset($order['piecesLoaded']) ? (int) $order['piecesLoaded'] : dispatch_pdf_derive_pieces($order['cbm'] ?? 0, $order['size']);
        }
        
        if (isset($order['sizes']) && is_array($order['sizes'])) {
            foreach ($order['sizes'] as $sRow) {
                if (is_array($sRow)) {
                    if (!empty($sRow['size'])) {
                        $sizesList[] = $sRow['size'];
                        $cbmsList[] = (float) ($sRow['cbm'] ?? 0);
                        $piecesList[] = dispatch_pdf_derive_pieces($sRow['cbm'] ?? 0, $sRow['size']);
                    }
                }
            }
        }

        if (isset($order['additionalProducts']) && is_array($order['additionalProducts'])) {
            foreach ($order['additionalProducts'] as $prod) {
                if (is_array($prod)) {
                    if (!empty($prod['size'])) {
                        $sizesList[] = $prod['size'];
                        $cbmsList[] = (float) ($prod['cbm'] ?? 0);
                        $piecesList[] = dispatch_pdf_derive_pieces($prod['cbm'] ?? 0, $prod['size']);
                    }
                }
            }
        }
    }

    $formattedSizes = dispatch_pdf_format_size($sizesList);

    $piecesParts = [];
    foreach ($piecesList as $p) {
        $piecesParts[] = dispatch_pdf_format_number((string) $p, 0) . ' PCS';
    }
    $piecesStr = !empty($piecesParts) ? implode(', ', $piecesParts) : '-';

    $cbmParts = [];
    foreach ($cbmsList as $c) {
        $cbmParts[] = dispatch_pdf_format_number($c, 3, true);
    }
    $cbmBase = implode(', ', $cbmParts);

    $bjmVal = $order['bjm'] ?? null;
    $hasBjm = ($bjmVal !== null && $bjmVal !== '' && $bjmVal !== 0 && $bjmVal !== '0' && $bjmVal !== '-');
    if ($hasBjm) {
        $bjmFormatted = dispatch_pdf_format_number($bjmVal, 3, true);
        if ($cbmBase === '' || $cbmBase === '-') {
            $cbmStr = $bjmFormatted . ' BJM';
        } else {
            $cbmStr = $cbmBase . ', ' . $bjmFormatted . ' BJM';
        }
    } else {
        $cbmStr = ($cbmBase === '') ? '-' : $cbmBase;
    }

    return [
        'dateInvoiceId' => dispatch_pdf_format_date($order['orderDate'] ?? '') . ' / ' . dispatch_pdf_to_upper_display($formattedInvoiceId),
        'consignee' => dispatch_pdf_to_upper_display($order['consignee'] ?? ($order['client'] ?? '')),
        'address' => dispatch_pdf_to_upper_display($order['address'] ?? ($order['location'] ?? '')),
        'vehicleAndType' => dispatch_pdf_to_upper_display(
            trim((string) ($order['vehicle'] ?? '')) . (
                $truckType !== ''
                    ? ' / ' . $truckType
                    : ''
            )
        ),
        'driverName' => dispatch_pdf_to_upper_display($order['driverName'] ?? ''),
        'mobileNumber' => dispatch_pdf_to_upper_display($order['driverContact'] ?? ''),
        'transporterName' => dispatch_pdf_to_upper_display($order['transporter'] ?? ''),
        'size' => $formattedSizes,
        'piecesLoaded' => $piecesStr,
        'cbm' => $cbmStr,
        'loadStartTime' => dispatch_pdf_to_upper_display($order['loadStartTime'] ?? ''),
        'loadFinishTime' => dispatch_pdf_to_upper_display($order['loadFinishTime'] ?? ''),
        'loading' => dispatch_pdf_to_upper_display($order['loadingBy'] ?? ''),
        'grossWeight' => dispatch_pdf_format_number($order['grossWeight'] ?? '-', 3),
        'tareWeight' => dispatch_pdf_format_number($order['tareWeight'] ?? '-', 3),
        'netWeight' => dispatch_pdf_format_number($order['netWt'] ?? '-', 3),
        'contactPerson' => dispatch_pdf_to_upper_display($order['contactPerson'] ?? ''),
    ];
}

function generateDispatchPDF(array $order): string
{
    $values = dispatch_pdf_build_values($order);
    $pdf = pdf_fpdi_create_document();

    $tableLeft = 25.0;
    $tableTop = 55.0;
    $labelWidth = 46.0;
    $baseValueWidth = 114.0;

    // Dynamically increase value column width if any text is too long
    $pdf->SetFont('Helvetica', 'B', 8.8);
    $requiredValueWidth = $baseValueWidth;

    $fieldsToCheck = [
        $values['dateInvoiceId'],
        $values['consignee'],
        $values['address'],
        $values['vehicleAndType'],
        $values['driverName'],
        $values['mobileNumber'],
        $values['transporterName'],
        $values['size'],
        $values['cbm']
    ];

    foreach ($fieldsToCheck as $text) {
        $textWidth = $pdf->GetStringWidth((string) $text) + 2.4; // 1.2 padding on each side
        if ($textWidth > $requiredValueWidth) {
            $requiredValueWidth = $textWidth;
        }
    }

    $maxValueWidth = 200.0 - $tableLeft - $labelWidth; // Leaves a 10mm right margin threshold
    $valueWidth = min($requiredValueWidth, $maxValueWidth);
    $rowHeight = 10.0;

    $rows = [
        ['DATE / INVOICE ID', $values['dateInvoiceId']],
        ['CONSIGNEE', $values['consignee']],
        ['ADDRESS', $values['address']],
        ['VEHICLE NO. / TYPE', $values['vehicleAndType']],
        ['DRIVER NAME', $values['driverName']],
        ['MOBILE NUMBER', $values['mobileNumber']],
        ['TRANSPORTER NAME', $values['transporterName']],
        ['SIZE', $values['size']],
        ['PIECES LOADED', $values['piecesLoaded']],
        ['CBM', $values['cbm']],
        ['LOAD START TIME', $values['loadStartTime']],
        ['LOAD FINISH TIME', $values['loadFinishTime']],
        ['LOADING', $values['loading']],
    ];

    foreach ($rows as [$label, $value]) {
        pdf_fpdi_write_cell($pdf, $tableLeft, $tableTop, $labelWidth, $rowHeight, $label, 'Helvetica', '', 8.0, 'L', 1, 1.2);
        pdf_fpdi_write_cell($pdf, $tableLeft + $labelWidth, $tableTop, $valueWidth, $rowHeight, (string) $value, 'Helvetica', 'B', 8.8, 'C', 1, 1.2);
        $tableTop += $rowHeight;
    }

    $weightTop = $tableTop;
    $weightHeight = 20.0;
    $valueThird = $valueWidth / 3.0;

    pdf_fpdi_write_cell($pdf, $tableLeft, $weightTop, $labelWidth, $weightHeight, 'WEIGHTMENT DETAILS', 'Helvetica', '', 8.0, 'L', 1, 1.2);
    pdf_fpdi_write_cell($pdf, $tableLeft + $labelWidth, $weightTop, $valueThird, 10.0, 'Gross Wt.', 'Helvetica', '', 8.0, 'C', 1, 1.0);
    pdf_fpdi_write_cell($pdf, $tableLeft + $labelWidth + $valueThird, $weightTop, $valueThird, 10.0, 'Tare Wt.', 'Helvetica', '', 8.0, 'C', 1, 1.0);
    pdf_fpdi_write_cell($pdf, $tableLeft + $labelWidth + ($valueThird * 2.0), $weightTop, $valueThird, 10.0, 'Net Wt.', 'Helvetica', '', 8.0, 'C', 1, 1.0);

    pdf_fpdi_write_cell($pdf, $tableLeft + $labelWidth, $weightTop + 10.0, $valueThird, 10.0, $values['grossWeight'], 'Helvetica', 'B', 8.8, 'C', 1, 1.0);
    pdf_fpdi_write_cell($pdf, $tableLeft + $labelWidth + $valueThird, $weightTop + 10.0, $valueThird, 10.0, $values['tareWeight'], 'Helvetica', 'B', 8.8, 'C', 1, 1.0);
    pdf_fpdi_write_cell($pdf, $tableLeft + $labelWidth + ($valueThird * 2.0), $weightTop + 10.0, $valueThird, 10.0, $values['netWeight'], 'Helvetica', 'B', 8.8, 'C', 1, 1.0);

    $contactTop = $weightTop + $weightHeight;
    pdf_fpdi_write_cell($pdf, $tableLeft, $contactTop, $labelWidth, $rowHeight, 'CONTACT PERSON', 'Helvetica', '', 8.0, 'L', 1, 1.2);
    pdf_fpdi_write_cell($pdf, $tableLeft + $labelWidth, $contactTop, $valueWidth, $rowHeight, $values['contactPerson'], 'Helvetica', 'B', 8.8, 'C', 1, 1.2);

    $signatureLineY = 235.0;
    $signatureTextY = 237.0;

    $pdf->Line(25.0, $signatureLineY, 60.0, $signatureLineY);
    $pdf->Line(85.0, $signatureLineY, 125.0, $signatureLineY);
    $pdf->Line(150.0, $signatureLineY, 190.0, $signatureLineY);

    $pdf->SetFont('Helvetica', '', 8.0);
    $pdf->SetXY(25.0, $signatureTextY);
    $pdf->Cell(35.0, 5.0, 'DRIVER SIGNATURE', 0, 0, 'C');

    $pdf->SetXY(85.0, $signatureTextY);
    $pdf->Cell(40.0, 5.0, 'LOADING SUPERVISOR', 0, 0, 'C');

    $pdf->SetXY(150.0, $signatureTextY);
    $pdf->Cell(40.0, 5.0, 'FOR ABC ASHPRO', 0, 0, 'C');

    return $pdf->Output('S');
}
