<?php

declare(strict_types=1);

require_once __DIR__ . DIRECTORY_SEPARATOR . 'pdf_fpdi_helpers.php';

function dispatch_pdf_build_values(array $order): array
{
    $truckType = dispatch_pdf_format_truck_type($order['truckType'] ?? ($order['vehicleType'] ?? ''));
    $invoiceNum = (string) ($order['invoiceId'] ?? ($order['invoiceNumber'] ?? ''));
    $formattedInvoiceId = format_invoice_id($invoiceNum, $order['orderDate'] ?? null);

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
        'size' => dispatch_pdf_format_size($order['size'] ?? ''),
        'piecesLoaded' => dispatch_pdf_normalize_text($order['piecesLoaded'] ?? null) !== '-'
            ? dispatch_pdf_format_number($order['piecesLoaded'], 0) . ' PCS'
            : '-',
        'cbm' => dispatch_pdf_normalize_text($order['cbm'] ?? null) !== '-'
            ? dispatch_pdf_format_number($order['cbm'], 3, true) . ' CBM'
            : '-',
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
    $tableWidth = 160.0;
    $labelWidth = 46.0;
    $valueWidth = $tableWidth - $labelWidth;
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
