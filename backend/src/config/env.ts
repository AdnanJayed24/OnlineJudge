import 'dotenv/config';

function required(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required env var: ${key}`);
  return value;
}

export const env = {
  PORT: Number(process.env.PORT) || 3000,
  DATABASE_URL: required('DATABASE_URL'),
  JWT_ACCESS_SECRET: required('JWT_ACCESS_SECRET'),
  JWT_REFRESH_SECRET: required('JWT_REFRESH_SECRET'),
  REDIS_URL: process.env.REDIS_URL || 'redis://127.0.0.1:6379',
  FRONTEND_ORIGIN: process.env.FRONTEND_ORIGIN || 'http://localhost:5173',
  PISTON_URL: process.env.PISTON_URL || 'https://emkc.org/api/v2/piston',
  // Codeforces judge proxy (optional — only needed for CF problems)
  CF_HANDLE:   process.env.CF_HANDLE   ?? '',
  CF_EMAIL:    process.env.CF_EMAIL    ?? '',
  CF_PASSWORD: process.env.CF_PASSWORD ?? '',
  CF_COOKIE:   process.env.CF_COOKIE   ?? '', // pre-obtained session cookie (alternative to email/password)
};
