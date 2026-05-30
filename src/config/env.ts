import 'dotenv/config';

function requireEnv(key: string): string {
  const value = process.env[key]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function parsePositiveInt(key: string, fallback: number): number {
  const raw = process.env[key];
  if (!raw) return fallback;

  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`Environment variable ${key} must be a positive integer`);
  }

  return value;
}

function parseBoolean(key: string, fallback: boolean): boolean {
  const raw = process.env[key];
  if (!raw) return fallback;

  if (raw === 'true') return true;
  if (raw === 'false') return false;

  throw new Error(`Environment variable ${key} must be true or false`);
}

function requireUrl(key: string, fallback: string): string {
  const raw = process.env[key]?.trim() || fallback;

  try {
    new URL(raw);
    return raw;
  } catch {
    throw new Error(`Environment variable ${key} must be a valid URL`);
  }
}

function optionalUrl(key: string): string | undefined {
  const raw = process.env[key]?.trim();

  if (!raw) {
    return undefined;
  }

  try {
    new URL(raw);
    return raw;
  } catch {
    throw new Error(`Environment variable ${key} must be a valid URL`);
  }
}

function optionalEnv(key: string): string | undefined {
  return process.env[key]?.trim() || undefined;
}

const nodeEnv = process.env.NODE_ENV || 'development';

export const env = {
  nodeEnv,
  baseUrl: requireUrl('BASE_URL', 'http://localhost:8080'),
  port: parsePositiveInt('PORT', 8080),
  postgresUrl: requireEnv('POSTGRES_URL'),
  googleClientId: requireEnv('GOOGLE_CLIENT_ID'),
  googleClientSecret: requireEnv('GOOGLE_CLIENT_SECRET'),
  googleCallbackUrl: requireUrl(
    'GOOGLE_CALLBACK_URL',
    'http://localhost:8080/api/v1/auth/google/callback',
  ),
  jwtSecret: requireEnv('JWT_SECRET'),
  refreshTokenSecret: requireEnv('REFRESH_TOKEN_SECRET'),
  dataEncryptionSecret: requireEnv('DATA_ENCRYPTION_KEY'),
  jwtAccessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
  jwtRefreshExpiresIn: parsePositiveInt('JWT_REFRESH_EXPIRES_IN_MS', 7 * 24 * 60 * 60 * 1000),
  clientUrl: requireUrl('CLIENT_URL', 'http://localhost:3000'),
  inferenceApiUrl: requireUrl('INFERENCE_API_URL', 'http://localhost:8000'),
  inferenceRequestTimeoutMs: parsePositiveInt('INFERENCE_REQUEST_TIMEOUT_MS', 75_000),
  redisUrl: requireUrl('REDIS_URL', 'redis://127.0.0.1:6379'),
  requestBodyLimit: process.env.REQUEST_BODY_LIMIT || '100kb',
  storageEndpoint: optionalUrl('STORAGE_ENDPOINT'),
  storageBucket: optionalEnv('STORAGE_BUCKET'),
  storageRegion: optionalEnv('STORAGE_REGION') || 'us-east-1',
  storageForcePathStyle: parseBoolean(
    'STORAGE_FORCE_PATH_STYLE',
    Boolean(process.env.STORAGE_ENDPOINT),
  ),
  storagePublicBaseUrl: optionalUrl('STORAGE_PUBLIC_BASE_URL'),
  storageMaxUploadSizeBytes: parsePositiveInt('STORAGE_MAX_UPLOAD_SIZE_BYTES', 25 * 1024 * 1024),
  dbSslRejectUnauthorized: parseBoolean('DB_SSL_REJECT_UNAUTHORIZED', nodeEnv === 'production'),
  rateLimitWindowMs: parsePositiveInt('RATE_LIMIT_WINDOW_MS', 15 * 60 * 1000),
  upstashRedisRestUrl:
    nodeEnv === 'production'
      ? requireEnv('UPSTASH_REDIS_REST_URL')
      : optionalEnv('UPSTASH_REDIS_REST_URL'),
  upstashRedisRestToken:
    nodeEnv === 'production'
      ? requireEnv('UPSTASH_REDIS_REST_TOKEN')
      : optionalEnv('UPSTASH_REDIS_REST_TOKEN'),
} as const;
