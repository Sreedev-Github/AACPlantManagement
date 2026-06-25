<?php

declare(strict_types=1);

require_once __DIR__ . DIRECTORY_SEPARATOR . 'pdf_fpdi_helpers.php';

function generateMTCPDF(array $order, array $testData): string
{
    $pdf = pdf_fpdi_create_document();
    $invoiceNum = (string) ($order['invoiceId'] ?? ($order['invoiceNumber'] ?? ($order['invoiceNo'] ?? '')));
    $invoiceRef = format_invoice_id($invoiceNum, $order['orderDate'] ?? null);
    $truckNo = (string) ($order['vehicle'] ?? ($order['vehicleNumber'] ?? ($order['truckNo'] ?? '')));

    $pdf->SetFont('Helvetica', 'B', 19.0);
    $pdf->SetXY(0.0, 34.0);
    $pdf->Cell(210.0, 10.0, 'MATERIAL TEST CERTIFICATE', 0, 1, 'C');

    $metaRows = [
        [['Reference No.', $invoiceRef], ['Issue date', $testData['issueDate'] ?? '']],
        [['Date of testing', $testData['testingDate'] ?? ''], ['Customer name', $order['consignee'] ?? ($order['client'] ?? '')]],
        [['Product', 'AUTOCLAVED AERATED CONCRETE'], ['Invoice no', $invoiceRef]],
        [['Truck No', $truckNo], ['', '']],
    ];

    $metaStartY = 58.0;
    $metaRowHeight = 7.2;

    foreach ($metaRows as $index => $row) {
        $rowY = $metaStartY + ($index * $metaRowHeight);

        pdf_fpdi_write_cell($pdf, 18.0, $rowY, 28.0, $metaRowHeight, strtoupper($row[0][0]), 'Helvetica', 'B', 7.2, 'L', 0, 0.0);
        pdf_fpdi_write_cell($pdf, 50.0, $rowY, 48.0, $metaRowHeight, dispatch_pdf_to_upper_display($row[0][1]), 'Helvetica', 'B', 7.5, 'L', 0, 0.0);

        if ($row[1][0] !== '') {
            pdf_fpdi_write_cell($pdf, 108.0, $rowY, 24.0, $metaRowHeight, strtoupper($row[1][0]), 'Helvetica', 'B', 7.2, 'L', 0, 0.0);
            pdf_fpdi_write_cell($pdf, 136.0, $rowY, 40.0, $metaRowHeight, dispatch_pdf_to_upper_display($row[1][1]), 'Helvetica', 'B', 7.5, 'L', 0, 0.0);
        }
    }

    $tableLeft = 6.0;
    $tableTop = 108.0;
    $colWidths = [18.0, 60.0, 20.0, 28.0, 20.0, 24.0, 28.0];
    $rowHeights = [10.0, 12.0, 12.0, 10.0, 10.0, 10.0];

    $colXs = [$tableLeft];
    foreach ($colWidths as $width) {
        $colXs[] = end($colXs) + $width;
    }

    $rowYs = [$tableTop];
    foreach ($rowHeights as $rowHeight) {
        $rowYs[] = end($rowYs) + $rowHeight;
    }

    $headers = ['TEST NO', 'TEST CHECK', 'UNIT', 'REQUIREMENT', 'RESULT', 'CONFORMITY', 'TEST METHOD'];
    foreach ($headers as $index => $header) {
        pdf_fpdi_write_cell($pdf, $colXs[$index], $rowYs[0], $colWidths[$index], $rowHeights[0], $header, 'Helvetica', 'B', 8.0, 'C', 1, 1.0);
    }

    $dryDensity = dispatch_pdf_normalize_text($testData['dryDensityResult'] ?? '-');
    $compressiveStrength = dispatch_pdf_normalize_text($testData['compressiveStrengthResult'] ?? '-');

    $rows = [
        ['1', 'Dry Density', 'Kgs/M3', $testData['requirementField1'] ?? '551-660', $dryDensity, 'Yes', 'IS6441(1)'],
        ['2', 'Compressive Strength (Oven Dry)', 'N/MM2', $testData['requirementField2'] ?? '>=4.0', $compressiveStrength, 'Yes', 'IS6441(5)'],
    ];

    foreach ($rows as $rowIndex => $row) {
        $y = $rowYs[$rowIndex + 1];
        foreach ($row as $colIndex => $value) {
            $align = $colIndex === 0 || $colIndex >= 3 ? 'C' : 'L';
            $fontStyle = 'B';
            $fontSize = $colIndex === 1 ? 7.5 : 8.0;

            pdf_fpdi_write_cell($pdf, $colXs[$colIndex], $y, $colWidths[$colIndex], $rowHeights[$rowIndex + 1], (string) $value, 'Helvetica', $fontStyle, $fontSize, $align, 1, 1.0);
        }
    }

    $dimTop = $rowYs[3];
    $dimHeight = $rowHeights[3];
    $mergedWidth = array_sum(array_slice($colWidths, 1));

    pdf_fpdi_write_cell($pdf, $colXs[0], $dimTop, $colWidths[0], $dimHeight, '3', 'Helvetica', 'B', 8.0, 'C', 1, 1.0);
    $pdf->Rect($colXs[1], $dimTop, $mergedWidth, $dimHeight);
    $pdf->SetFont('Helvetica', 'B', 8.2);
    $pdf->SetXY($colXs[1] + 1.5, $dimTop);
    $pdf->Cell($mergedWidth - 3.0, $dimHeight, 'Dimensional Tolerance', 0, 0, 'C');

    $dimRows = [
        ['3a', 'Length', 'Mm', '±3', '+1', 'Yes', 'IS2185(3)'],
        ['3b', 'Height', 'Mm', '±2', '+0.05', 'Yes', 'IS2185(3)'],
        ['3c', 'Width', 'Mm', '±3', '+1', 'Yes', 'IS2185(3)'],
    ];

    foreach ($dimRows as $offset => $row) {
        $y = $rowYs[$offset + 4];

        for ($colIndex = 0; $colIndex < 6; $colIndex += 1) {
            $align = $colIndex === 0 || $colIndex >= 3 ? 'C' : 'L';
            $fontStyle = 'B';
            $fontSize = $colIndex === 1 ? 7.3 : 7.8;

            pdf_fpdi_write_cell($pdf, $colXs[$colIndex], $y, $colWidths[$colIndex], $dimHeight, (string) $row[$colIndex], 'Helvetica', $fontStyle, $fontSize, $align, 1, 1.0);
        }
    }

    $mergedColX = $colXs[6];
    $mergedColWidth = $colWidths[6];
    $mergedTop = $rowYs[4];
    $mergedHeight = $dimHeight * 3.0;

    $pdf->Rect($mergedColX, $mergedTop, $mergedColWidth, $mergedHeight);
    $pdf->SetFont('Helvetica', 'B', 8.0);
    $pdf->SetXY($mergedColX + 1.0, $mergedTop + ($mergedHeight / 3.0) - 1.0);
    $pdf->Cell($mergedColWidth - 2.0, 3.0, 'IS2185(3) 3,2,3', 0, 0, 'C');

    $equipmentTop = 194.0;
    $pdf->SetFont('Helvetica', 'B', 8.8);
    $pdf->SetXY(6.0, $equipmentTop);
    $pdf->Cell(80.0, 6.5, 'TEST EQUIPMENT USED', 0, 0, 'L');

    $equipmentText1 = 'Used digital Compressive Strength Testing RDK Machine makes AIMIL of Capacity 0250 kN, Accuracy Band Saw Machine (not Hand Saw) for cutting samples, Also used';
    $equipmentText2 = 'well Calibrated Drying Ovens, digital Balance sand measuring instruments installed at laboratory at our works.';

    pdf_fpdi_write_paragraph($pdf, 6.0, $equipmentTop + 5.5, 170.0, 4.0, $equipmentText1, 'Helvetica', 'B', 5.8, 'L');
    pdf_fpdi_write_paragraph($pdf, 6.0, $equipmentTop + 9.9, 170.0, 4.0, $equipmentText2, 'Helvetica', 'B', 5.8, 'L');

    $sigY = 238.0;
    $sigLineY = $sigY + 7.0;
    $sigLeft = 24.0;
    $sigRight = 134.0;
    $sigWidth = 50.0;
    $sigWidthRight = 54.0;

    $pdf->Line($sigLeft, $sigLineY, $sigLeft + $sigWidth, $sigLineY);
    $pdf->Line($sigRight, $sigLineY, $sigRight + $sigWidthRight, $sigLineY);

    $pdf->SetFont('Helvetica', 'B', 8.0);
    $pdf->SetXY($sigLeft, $sigY + 8.4);
    $pdf->Cell($sigWidth, 8.0, '( CHECKED BY )', 0, 0, 'C');

    $pdf->SetXY($sigRight, $sigY + 8.4);
    $pdf->Cell($sigWidthRight, 8.0, '(HOD, QC)', 0, 0, 'C');

    return $pdf->Output('S');
}
