import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';

import { httpError } from '../utils/httpError.js';

const MTC_DIR = 'mtc';
const PHP_MTC_BRIDGE_PATH = path.resolve(process.cwd(), 'api', 'mtc_pdf_cli.php');

// Format date as dd-mm-yyyy
const formatDateDdMmYyyy = (isoDate) => {
  if (!isoDate) return '';
  const match = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return '';
  const [, year, month, day] = match;
  return `${day}-${month}-${year}`;
};

// Get today's date in ISO format (yyyy-mm-dd)
const getTodayIso = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Calculate date minus N days (in ISO format)
const subtractDaysIso = (isoDate, days) => {
  const match = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return '';
  const date = new Date(Date.UTC(
    parseInt(match[1], 10),
    parseInt(match[2], 10) - 1,
    parseInt(match[3], 10),
    12,
    0,
    0
  ));
  date.setUTCDate(date.getUTCDate() - days);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const renderMtcPdfViaPhp = ({ order, testData }) => {
  if (!fs.existsSync(PHP_MTC_BRIDGE_PATH)) {
    throw httpError(500, `Missing PHP MTC bridge at ${PHP_MTC_BRIDGE_PATH}`);
  }

  const phpBinary = process.env.PHP_BINARY || 'php';
  const result = spawnSync(phpBinary, [PHP_MTC_BRIDGE_PATH], {
    input: JSON.stringify({ order, testData }),
    maxBuffer: 20 * 1024 * 1024,
  });

  if (result.error) {
    throw httpError(500, result.error.message || 'Failed to execute PHP MTC generator.');
  }

  if (result.status !== 0) {
    const stderr = result.stderr ? result.stderr.toString('utf8').trim() : '';
    throw httpError(500, stderr || `PHP MTC bridge exited with status ${result.status}.`);
  }

  return Buffer.from(result.stdout);
};

export const generateMtc = async ({ order, testData, uploadDir }) => {
  const orderId = String(order?.id || order?._id || '').trim();
  if (!orderId) {
    throw httpError(400, 'Cannot generate MTC without order id.');
  }

  // Calculate MTC dates:
  // Issue Date = Today
  // Testing Date = Issue Date - 10 days
  const issueDateIso = getTodayIso();
  const testingDateIso = subtractDaysIso(issueDateIso, 10);

  // Format dates as dd-mm-yyyy
  const testDataWithDates = {
    ...testData,
    issueDate: formatDateDdMmYyyy(issueDateIso),
    testingDate: formatDateDdMmYyyy(testingDateIso),
  };

  const targetDir = path.join(uploadDir, MTC_DIR, orderId);
  await fs.promises.mkdir(targetDir, { recursive: true });

  const pdfBuffer = renderMtcPdfViaPhp({ order, testData: testDataWithDates });
  const filename = `${Date.now()}-mtc.pdf`;
  const filePath = path.join(targetDir, filename);

  await fs.promises.writeFile(filePath, pdfBuffer);

  return {
    filename,
    path: filePath,
    size: pdfBuffer.length,
    format: 'pdf',
    mimeType: 'application/pdf',
  };
};