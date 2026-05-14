<?php

declare(strict_types=1);

require_once __DIR__ . DIRECTORY_SEPARATOR . 'mtc_pdf.php';
require_once __DIR__ . DIRECTORY_SEPARATOR . 'dispatch_pdf.php';

// Test data
$testOrder = [
    'id' => '123',
    'orderDate' => '2026-04-28',
    'invoiceNumber' => 'INV-2026-001',
    'client' => 'ONLINE BUILDERS PVT LTD',
    'location' => 'Cuttak, Odisha',
    'vehicle' => 'OD-05-Q-7607',
    'vehicleType' => '20W',
    'driverName' => 'John Doe',
    'driverContact' => '9876543210',
    'transporter' => 'ABC Transport',
    'size' => '600 x 200 x 250 mm',
    'piecesLoaded' => '150',
    'cbm' => '45.000',
    'loadStartTime' => '09:00 AM',
    'loadFinishTime' => '11:30 AM',
    'grossWeight' => '12500.500',
    'tareWeight' => '2500.100',
    'netWt' => '10000.400',
];

$mtcTestData = [
    'referenceNumber' => 'ABC/QC/146',
    'issueDate' => '2026-04-28',
    'testingDate' => '2026-04-27',
    'dryDensityResult' => '638',
    'compressiveStrengthResult' => '4.54',
];

try {
    echo "Testing Dispatch PDF generation...\n";
    $dispatchPdf = generateDispatchPDF($testOrder);
    $dispatchSize = strlen($dispatchPdf);
    echo "✓ Dispatch PDF generated successfully: $dispatchSize bytes\n";
    
    // Save to file for inspection
    $destDispatch = __DIR__ . '/../server/uploads/test-dispatch-new.pdf';
    @mkdir(dirname($destDispatch), 0755, true);
    file_put_contents($destDispatch, $dispatchPdf);
    echo "✓ Saved to: $destDispatch\n\n";
    
    echo "Testing MTC PDF generation...\n";
    $mtcPdf = generateMTCPDF($testOrder, $mtcTestData);
    $mtcSize = strlen($mtcPdf);
    echo "✓ MTC PDF generated successfully: $mtcSize bytes\n";
    
    // Save to file for inspection
    $destMtc = __DIR__ . '/../server/uploads/test-mtc-new.pdf';
    file_put_contents($destMtc, $mtcPdf);
    echo "✓ Saved to: $destMtc\n\n";
    
    echo "=== ALL TESTS PASSED ===\n";
    echo "Dispatch PDF: $dispatchSize bytes\n";
    echo "MTC PDF: $mtcSize bytes\n";
    
} catch (Exception $e) {
    echo "✗ ERROR: " . $e->getMessage() . "\n";
    echo "Stack trace:\n";
    echo $e->getTraceAsString() . "\n";
    exit(1);
}
