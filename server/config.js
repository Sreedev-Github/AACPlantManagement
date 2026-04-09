import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const envCandidates = [
  process.env.ENV_PATH,
  path.resolve(process.cwd(), '.env'),
  path.resolve(projectRoot, '.env'),
  path.resolve(__dirname, '.env'),
].filter(Boolean);

let loadedFromPath = null;

for (const candidate of envCandidates) {
  if (fs.existsSync(candidate)) {
    dotenv.config({ path: candidate });
    loadedFromPath = candidate;
    break;
  }
}

if (!loadedFromPath) {
  dotenv.config();
}

const getEnv = (name, fallback = '') => process.env[name] || fallback;

const getRequiredEnv = (name) => {
  const value = process.env[name];
  if (!value) {
    const checkedPaths = envCandidates.join(', ');
    throw new Error(`Missing required environment variable: ${name}. Checked .env paths: ${checkedPaths}`);
  }
  return value;
};

const getJwtSecret = () => {
  const value = process.env.JWT_SECRET;
  if (value) return value;

  if ((process.env.NODE_ENV || 'development') !== 'production') {
    console.warn('JWT_SECRET is missing. Using development fallback secret.');
    return 'dev-insecure-secret-change-me';
  }

  throw new Error('Missing required environment variable: JWT_SECRET');
};

export const config = {
  nodeEnv: getEnv('NODE_ENV', 'development'),
  port: Number(getEnv('PORT', '4000')),
  mongoUri: getRequiredEnv('MONGODB_URI'),
  mongoDb: getEnv('MONGODB_DB', 'aac_plant_management'),
  jwtSecret: getJwtSecret(),
  jwtExpiresIn: getEnv('JWT_EXPIRES_IN', '8h'),
  uploadDir: getEnv('UPLOAD_DIR', path.resolve(process.cwd(), 'server', 'uploads')),
};
