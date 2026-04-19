import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const configEnvPath = path.resolve(projectRoot, 'config', 'config.env');

const envCandidates = [
  process.env.ENV_PATH,
  configEnvPath,
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

const getSqlServerConfig = () => {
  const url = getEnv('SQLSERVER_URL', '');
  if (!url) {
    throw new Error('Missing required environment variable: SQLSERVER_URL');
  }

  return { url };
};

export const config = {
  nodeEnv: getEnv('NODE_ENV', 'development'),
  port: Number(getEnv('PORT', '4000')),
  sqlserver: getSqlServerConfig(),
  jwtSecret: getJwtSecret(),
  jwtExpiresIn: getEnv('JWT_EXPIRES_IN', '8h'),
  uploadDir: getEnv('UPLOAD_DIR', path.resolve(process.cwd(), 'server', 'uploads')),
};

