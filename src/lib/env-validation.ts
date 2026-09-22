/**
 * Environment variable validation
 * Uygulama başladığında gerekli environment variable'ları kontrol eder
 */

const requiredEnvVars = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'NEXT_PUBLIC_SITE_URL'
] as const;

const optionalEnvVars = [
  'BREVO_API_KEY',
  'BREVO_FROM_EMAIL',
  'BREVO_FROM_NAME',
  'GOOGLE_TRANSLATE_API_KEY',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET'
] as const;

export function validateEnv() {
  const missing: string[] = [];

  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      missing.push(envVar);
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}`
    );
  }

  // Warning for optional but recommended vars
  const missingOptional: string[] = [];
  for (const envVar of optionalEnvVars) {
    if (!process.env[envVar]) {
      missingOptional.push(envVar);
    }
  }

  if (missingOptional.length > 0 && process.env.NODE_ENV === 'production') {
    console.warn('Missing optional environment variables:', missingOptional.join(', '));
  }

  return {
    required: true,
    optional: missingOptional.length === 0
  };
}

export function getEnvVar(key: string, defaultValue?: string): string {
  const value = process.env[key];
  if (value === undefined) {
    if (defaultValue !== undefined) return defaultValue;
    throw new Error(`Environment variable ${key} is not set`);
  }
  return value;
}

export function getEnvVarNumber(key: string, defaultValue?: number): number {
  const value = process.env[key];
  if (value === undefined) {
    if (defaultValue !== undefined) return defaultValue;
    throw new Error(`Environment variable ${key} is not set`);
  }
  const num = parseInt(value, 10);
  if (isNaN(num)) {
    throw new Error(`Environment variable ${key} is not a valid number`);
  }
  return num;
}

export function getEnvVarBoolean(key: string, defaultValue: boolean = false): boolean {
  const value = process.env[key];
  if (value === undefined) return defaultValue;
  return value === 'true' || value === '1';
}