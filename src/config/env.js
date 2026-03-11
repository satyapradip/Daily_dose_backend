const { z } = require('zod');

const envSchema = z.object({
  // Server
  PORT: z.string().default('3000').transform(Number),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  API_PREFIX: z.string().default('/api/v1'),

  // Database
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  // Redis
  REDIS_URL: z.string().min(1, 'REDIS_URL is required'),

  // Auth
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters for security'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),

  // Google Gemini AI
  GEMINI_API_KEY: z.string().min(1, 'GEMINI_API_KEY is required'),
  GEMINI_MODEL: z.string().default('gemini-2.0-flash'),
  GEMINI_MAX_TOKENS: z.string().default('1000').transform(Number),
  GEMINI_TTS_MODEL: z.string().default('gemini-2.5-flash-preview-tts'),

  // Supabase (Data API)
  SUPABASE_URL: z.string().url('SUPABASE_URL must be a valid URL').optional().default(''),
  SUPABASE_ANON_KEY: z.string().optional().default(''),

  // CORS
  CORS_ORIGIN: z.string().default('*'),

  // YouTube
  YOUTUBE_API_KEY: z.string().min(1, 'YOUTUBE_API_KEY is required'),

  // Admin
  ADMIN_SECRET_KEY: z.string().min(1, 'ADMIN_SECRET_KEY is required'),

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.string().default('60000').transform(Number),
  RATE_LIMIT_MAX_REQUESTS: z.string().default('60').transform(Number),
});

function validateEnv() {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const errors = result.error.errors
      .map((e) => `  - ${e.path.join('.')}: ${e.message}`)
      .join('\n');
    console.error('❌ Invalid environment variables:\n' + errors);
    process.exit(1);
  }

  return result.data;
}

const env = validateEnv();

module.exports = { env };
