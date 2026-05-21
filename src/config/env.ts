import 'dotenv/config';

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number.parseInt(process.env.PORT || '8080', 10),
  postgresUrl: requireEnv('POSTGRES_URL'),
  googleClientId: requireEnv('GOOGLE_CLIENT_ID'),
  googleClientSecret: requireEnv('GOOGLE_CLIENT_SECRET'),
  googleCallbackUrl:
    process.env.GOOGLE_CALLBACK_URL || 'http://localhost:8080/api/v1/auth/google/callback',
  jwtSecret: requireEnv('JWT_SECRET'),
  jwtAccessExpiresIn: '15m',
  jwtRefreshExpiresIn: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
  clientUrl: process.env.CLIENT_URL || 'http://localhost:3000',
  inferenceApiUrl: process.env.INFERENCE_API_URL || 'http://localhost:8000',
} as const;
