import { z } from 'zod';

const envSchema = z.object({
  // Database connection string (PostgreSQL / Supabase)
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  // Auth secrets: at least one of NEXTAUTH_SECRET or JWT_SECRET must be set
  NEXTAUTH_SECRET: z.string().min(16, 'NEXTAUTH_SECRET must be at least 16 characters').optional(),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters').optional(),
  NEXTAUTH_URL: z.string().url().optional(),

  // Supabase Configuration
  NEXT_PUBLIC_SUPABASE_URL: z.string().url('NEXT_PUBLIC_SUPABASE_URL must be a valid URL').optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),

  // Environment mode
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Optional configurations
  NEXT_PUBLIC_API_URL: z.string().url().optional().default('http://localhost:3000'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

  // Email (optional for development)
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().optional(),
}).refine(
  (data) => Boolean(data.NEXTAUTH_SECRET || data.JWT_SECRET),
  {
    message: 'CRITICAL SECURITY: Either NEXTAUTH_SECRET or JWT_SECRET must be set in environment variables.',
    path: ['JWT_SECRET'],
  }
);

let validated = false;

export function validateEnvironment(): boolean {
  if (validated) return true;

  try {
    envSchema.parse(process.env);
    validated = true;
    console.log('✅ Environment variables validated successfully');
    return true;
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('❌ Environment validation warnings/errors:');
      for (const issue of error.issues) {
        console.error(`   - [${issue.path.join('.') || 'env'}]: ${issue.message}`);
      }
    } else {
      console.error('❌ Environment validation error:', error);
    }

    if (process.env.NODE_ENV === 'production') {
      throw new Error('CRITICAL: Environment validation failed in production. Halting startup.');
    }
    return false;
  }
}